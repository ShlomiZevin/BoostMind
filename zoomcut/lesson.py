"""Lesson template — one speaker, takes recorded in order → a tight vertical video.

    .venv\\Scripts\\python lesson.py episodes/<slug>            full build → out/<slug>.mp4
    .venv\\Scripts\\python lesson.py episodes/<slug> --still 40  one frame at 40s → work/still.png (layout check)

episode.json ("type": "lesson"): title, input_dir, takes (glob, sorted = order), background, plaque lines,
inserts (a pause opened inside a take for a sound: phone ring, the wife on the phone).
captions.txt: the subtitle text per take (== <take>), timed by aligning it to the recogniser's words.

The cut: each take keeps its voice; a pause longer than MERGE becomes a jump cut with PAD_IN/PAD_OUT air.
"""
import argparse
import difflib
import glob
import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

import numpy as np

from pipeline.common import FFMPEG, FPS, ROOT, SR, load_json, log, save_json
from pipeline.media import read_wav
from pipeline.match import Env

# the cut (episode.json "cut" overrides): pauses shorter than merge stay, longer ones become a jump cut;
# at every jump cut the next part starts `join` seconds early, on top of the last word's tail (rhythm)
CUT = {"merge": 0.25, "pad_in": 0.05, "pad_out": 0.1, "join": 0.18, "above_floor": 10, "voice_above_floor": 20}
W, H = 1080, 1920
MATTE_W, MATTE_H = 432, 768


class Lesson:
    def __init__(self, d):
        self.dir = os.path.abspath(d)
        self.slug = os.path.basename(self.dir)
        self.cfg = load_json(self.p("episode.json"))
        src = self.cfg["input_dir"]
        self.takes = sorted(glob.glob(os.path.join(src, self.cfg.get("takes", "*.MP4"))))
        if not self.takes:
            raise SystemExit(f"no takes in {src}")

    def p(self, *a):
        return os.path.join(self.dir, *a)

    def work(self, *a):
        path = self.p("work", *a)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        return path

    def asset(self, rel):
        return os.path.normpath(os.path.join(self.dir, rel))


def name(take):
    return os.path.splitext(os.path.basename(take))[0]


def ff(*args):
    r = subprocess.run([FFMPEG, "-y", "-v", "error", *args], capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        raise RuntimeError(r.stderr[-1500:])


# ---- 1. per take: audio, words, matte -------------------------------------------------------------
def prepare(ls):
    model = None
    for t in ls.takes:
        n = name(t)
        a48, a16 = ls.work("audio", n + ".wav"), ls.work("audio16", n + ".wav")
        if not os.path.exists(a48):
            ff("-i", t, "-ac", "1", "-ar", str(SR), a48)
            ff("-i", t, "-ac", "1", "-ar", "16000", a16)
        wj = ls.work("words", n + ".json")
        if not os.path.exists(wj):
            if model is None:
                from pipeline.transcribe import _get_model
                model = _get_model()
            x, _ = read_wav(a16)
            segs, _ = model.transcribe(x, language="he", word_timestamps=True, vad_filter=True, beam_size=5)
            words = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for s in segs for w in (s.words or [])]
            save_json(wj, words)
            log(f"  · words {n}: {len(words)}")
        mk = matte_path(ls, n)
        if not os.path.exists(mk):
            matte(t, mk[:-4] + ".part.mkv", ls.cfg.get("matte_engine", "fast"))
            os.replace(mk[:-4] + ".part.mkv", mk)  # a stopped run never leaves a half cut-out that looks finished
            log(f"  · cut out {n}")


def matte_path(ls, n):
    eng = ls.cfg.get("matte_engine", "fast")
    return ls.work("matte", n + (".mkv" if eng == "fast" else f".{eng}.mkv"))


def matte(src, out, engine="fast"):
    """fast = MediaPipe (~45 fps); quality = RobustVideoMatting (clean hands and hair against a white wall)."""
    from pipeline.background import FastMatte, QualityMatte
    dec = subprocess.Popen([FFMPEG, "-v", "error", "-i", src, "-vf", f"scale={MATTE_W}:{MATTE_H}:flags=area,fps={FPS}",
                            "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen([FFMPEG, "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{MATTE_W}x{MATTE_H}",
                            "-r", str(FPS), "-i", "-", "-c:v", "ffv1", out], stdin=subprocess.PIPE)
    fm, size, n = (FastMatte() if engine == "fast" else QualityMatte()), MATTE_W * MATTE_H * 3, 0
    while True:
        buf = dec.stdout.read(size)
        if len(buf) < size:
            break
        a = fm(np.frombuffer(buf, np.uint8).reshape(MATTE_H, MATTE_W, 3), n)
        enc.stdin.write((a * 255).astype(np.uint8).tobytes())
        n += 1
    enc.stdin.close()
    enc.wait()
    dec.wait()


# ---- 2. the cut ------------------------------------------------------------------------------------
def norm(w):
    w = re.sub(r"[֑-ׇ]", "", w)  # niqqud
    w = re.sub(r"[^\w֐-׿]", "", w)
    return w.translate(str.maketrans("ךםןףץ", "כמנפצ"))


def cut_cfg(ls):
    return {**CUT, **ls.cfg.get("cut", {})}


def spans(ls, n):
    c = cut_cfg(ls)
    env = Env(ls.work("audio16", n + ".wav"))
    # silence = near the room's own noise floor. (A take where he talks almost non-stop has speech even in
    # its quietest 15%, so the matcher's threshold sat inside quiet syllables and cut "הלכה כבית השמאל".)
    level = np.percentile(env.db, 3) + c.get("above_floor", 12)
    on = env.db > level
    # (not the recogniser's word times: they stretch a word over the pause after it, and kept real silences)
    hop, out, start = env.hop, [], None
    for i, v in enumerate(np.append(on, False)):
        if v and start is None:
            start = i
        if not v and start is not None:
            out.append([start * hop, i * hop])
            start = None
    out = [s for s in out if s[1] - s[0] >= 0.12]  # clicks, mic bumps
    merged = []
    for a, b in out:
        if merged and a - merged[-1][1] < c["merge"]:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    dur = len(env.db) * hop
    # edges: the first / last moment that is clearly his voice, not a breath or a rustle before it
    voice = np.percentile(env.db, 3) + c.get("voice_above_floor", 20)
    tight = []
    for a, b in merged:
        i0, i1 = int(a / hop), int(b / hop)
        loud = np.nonzero(env.db[i0:i1] > voice)[0]
        if len(loud):
            a, b = (i0 + loud[0]) * hop, (i0 + loud[-1] + 1) * hop
        tight.append([max(0.0, a - c["pad_in"]), min(dur, b + c["pad_out"])])
    words = load_json(ls.work("words", n + ".json"), [])
    if words and tight:
        # the take ends where his voice after the last word stops - a held / sung last word stays whole,
        # a phone put down on the table after a moment of silence does not
        k, gap = int(words[-1]["e"] / hop), 0
        while k < len(env.db) and gap < int(0.12 / hop):
            gap = gap + 1 if env.db[k] <= voice else 0
            k += 1
        last = (k - gap) * hop + c.get("after_last_word", 0.25)
        tight = [sp for sp in tight if sp[0] < last]
        if tight:
            tight[-1][1] = min(tight[-1][1], max(last, tight[-1][0] + 0.2))
    return tight


def find_word(words, key, after, before=False):
    k = norm(key)
    for w in words:
        if w["s"] >= after - 0.01 and norm(w["w"]) == k:
            return (w["s"] - 0.08) if before else (w["e"] + 0.06)
    raise SystemExit(f"insert: word '{key}' not found after {after:.2f}s")


def plan(ls):
    """Timeline items in frames: {'kind': 'clip', take, a, n} | {'kind': 'hold', take, t, n, insert}."""
    items, out_f = [], 0
    for t in ls.takes:
        n = name(t)
        words = load_json(ls.work("words", n + ".json"), [])
        sp = spans(ls, n)
        cuts, after = [], 0.0
        for ins in [i for i in ls.cfg.get("inserts", []) if i["take"] == n]:
            at = find_word(words, ins.get("before") or ins["after"], after, before="before" in ins)
            cuts.append((at, ins))
            after = at
        for a, b in sp:
            inside = [(at, ins) for at, ins in cuts if a <= at <= b]
            pos = a
            for at, ins in inside:
                if at - pos > 0.05:
                    items.append({"kind": "clip", "take": n, "a": pos, "n": round((at - pos) * FPS)})
                items.append({"kind": "hold", "take": n, "t": at, "n": round(ins["seconds"] * FPS), "insert": ins})
                pos = at
            if b - pos > 0.05:
                items.append({"kind": "clip", "take": n, "a": pos, "n": round((b - pos) * FPS)})
        missed = [ins for at, ins in cuts if not any(a <= at <= b for a, b in sp)]
        for ins in missed:
            raise SystemExit(f"insert {ins} falls in a cut pause")
    # jump cuts: the picture cuts `join` early and the next part starts there, while the previous part's
    # sound runs on underneath for that moment (crossfaded) - no gap, the next word lands on the last one
    ov = round(cut_cfg(ls)["join"] * FPS)
    for prev, nxt in zip(items, items[1:]):
        if prev["kind"] == "clip" and nxt["kind"] == "clip" and prev["n"] > ov + 6:
            prev["an"] = prev["n"]
            prev["n"] -= ov
    for it in items:
        it["out"] = out_f
        out_f += it["n"]
    return items, out_f


def word_time(words, key, edge, after):
    k = norm(key)
    for w in words:
        if w["s"] >= after - 0.01 and norm(w["w"]) == k:
            return w["s"] if edge == "start" else w["e"]
    raise SystemExit(f"word '{key}' not found after {after:.2f}s")


def out_time(items, take, t):
    """A moment in a take -> seconds in the output (a moment before the take's first kept frame is placed
    that far before it, so a ring can start while he is still finishing the previous take)."""
    f = to_out(items, take, t)
    if f is not None:
        return f / FPS
    first = next((it for it in items if it["take"] == take and it["kind"] == "clip"), None)
    return None if first is None else max(0.0, first["out"] / FPS - (first["a"] - t))


def to_out(items, take, t):
    """A time in a take → frame in the output (a cut-away moment snaps to the next kept frame)."""
    best = None
    for it in items:
        if it["take"] != take or it["kind"] != "clip":
            continue
        a, b = it["a"], it["a"] + it["n"] / FPS
        if a <= t <= b:
            return it["out"] + (t - a) * FPS
        if t < a and best is None:
            best = it["out"]
    return best


# ---- 3. captions -----------------------------------------------------------------------------------
def captions(ls, items, total):
    blocks, cur = {}, None
    for line in open(ls.p("captions.txt"), encoding="utf-8"):
        line = line.strip()
        if line.startswith("#") or not line:
            continue
        if line.startswith("=="):
            cur = line[2:].strip()
            blocks[cur] = []
            continue
        blocks[cur] += line.split()
    caps = []
    for t in ls.takes:
        n = name(t)
        toks = blocks.get(n, [])
        words = load_json(ls.work("words", n + ".json"), [])
        if not toks or not words:
            continue
        times = [None] * len(toks)
        sm = difflib.SequenceMatcher(a=[norm(x) for x in toks], b=[norm(w["w"]) for w in words], autojunk=False)
        for blk in sm.get_matching_blocks():
            for k in range(blk.size):
                w = words[blk.b + k]
                times[blk.a + k] = (w["s"], w["e"])
        # tokens the recogniser heard differently: spread them between their matched neighbours
        known = [i for i, v in enumerate(times) if v]
        if not known:
            continue
        for i in range(len(toks)):
            if times[i]:
                continue
            lo = max([k for k in known if k < i], default=None)
            hi = min([k for k in known if k > i], default=None)
            t0 = times[lo][1] if lo is not None else words[0]["s"]
            t1 = times[hi][0] if hi is not None else words[-1]["e"]
            ia = lo if lo is not None else -1
            ib = hi if hi is not None else len(toks)
            f = (i - ia) / (ib - ia)
            s = t0 + (t1 - t0) * f
            times[i] = (s, s + 0.25)
        # chunks: up to 4 words / 22 letters, breaking after punctuation
        chunk = []
        for i, tok in enumerate(toks):
            chunk.append(i)
            text = " ".join(toks[j] for j in chunk)
            end_punct = re.search(r"[.?!:,—]$", tok) and len(chunk) >= 2
            if len(chunk) >= 4 or len(text) >= 22 or end_punct or i == len(toks) - 1:
                a = to_out(items, n, times[chunk[0]][0])
                if a is not None:
                    caps.append({"from": int(a), "text": text, "take": n, "end_hint": to_out(items, n, times[chunk[-1]][1])})
                chunk = []
    caps.sort(key=lambda c: c["from"])
    holds = [(it["out"], it["out"] + it["n"]) for it in items if it["kind"] == "hold"]
    for c, nxt in zip(caps, caps[1:] + [None]):
        end = nxt["from"] if nxt else total
        if c.get("end_hint"):
            end = min(end, int(c["end_hint"]) + 12)
        for h0, h1 in holds:  # no subtitle on screen while the other side of the call talks
            if c["from"] < h0 < end:
                end = h0
        c["to"] = max(c["from"] + 6, end)
    return caps


TEXT_STYLE = 2  # bump when lesson_text.mjs changes how captions look, so cached images are redrawn


# ---- 4. pictures -----------------------------------------------------------------------------------
def layout(ls):
    p = ls.cfg.get("person", {})
    s = p.get("scale", 1.0)
    pw, ph = int(W * s) // 2 * 2, int(H * s) // 2 * 2
    return pw, ph, (W - pw) // 2 + p.get("x", 0), H - ph + p.get("y", 0)


def overlays(ls):
    """Text on video - the same items (text, font, theme, opacity, y, size, start/end) the Zoom template uses."""
    ov = ls.cfg.get("overlays")
    if ov is None and ls.cfg.get("title"):
        ov = [{"text": ls.cfg["title"], "style": "pov", "font": "stam-ashkenaz", "theme": "gold", "opacity": 0, "y": 150, "size": 64}]
    return [o for o in (ov or []) if (o.get("text") or "").strip()]


def bg_place(ls):
    """Cover the frame with the set, then zoom / shift it (episode.json "bg": {zoom, x, y}). Returns the
    scale and the crop origin, so things painted in the photo (the plaque) can be located."""
    import cv2
    b = cv2.imread(ls.asset(ls.cfg["background"]))
    bh, bw = b.shape[:2]
    g = ls.cfg.get("bg", {})
    c = max(W / bw, H / bh) * g.get("zoom", 1.0)
    sw, sh = int(bw * c) // 2 * 2, int(bh * c) // 2 * 2
    cx = min(max(0, (sw - W) / 2 - g.get("x", 0)), sw - W)
    cy = min(max(0, (sh - H) / 2 - g.get("y", 0)), sh - H)
    return c, sw, sh, int(cx), int(cy)


FLAT = (240, 600, 600, 250)  # where the plaque text is drawn flat (x, y, w, h) before it is put on the plate


def scene_png(ls):
    """Two layers in the photo's own pixels (so zooming / moving them is just a resize): the set photo
    (blurred later, it sits behind him) and the plaque text on the plate in perspective (kept sharp)."""
    import cv2
    photo = cv2.imread(ls.asset(ls.cfg["background"]))
    out = ls.work("public", "scene.png")
    plaque_out = ls.work("public", "plaque.png")
    cv2.imwrite(out, photo)
    empty = np.zeros((photo.shape[0], photo.shape[1], 4), np.uint8)
    quad = ls.cfg.get("plaque_quad")
    if quad and os.path.exists(ls.work("text", "plaque_flat.png")):
        flat = cv2.imread(ls.work("text", "plaque_flat.png"), cv2.IMREAD_UNCHANGED)
        q = np.array(quad, np.float32)
        mid = q.mean(axis=0)
        q = mid + (q - mid) * ls.cfg.get("plaque_inset", 0.86)
        x, y, w, h = FLAT
        src = np.array([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], np.float32)
        M = cv2.getPerspectiveTransform(src, q)
        # the text is drawn at ~2x the photo's scale: supersample the warp, then bring it down
        big = cv2.warpPerspective(flat, M, (photo.shape[1], photo.shape[0]), flags=cv2.INTER_AREA,
                                  borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
        cv2.imwrite(plaque_out, big)
    else:
        cv2.imwrite(plaque_out, empty)
    return out, plaque_out


def text_layers(ls, caps):
    spec = {"fontsDir": os.path.join(ROOT, "fonts"), "items": []}
    c, sw, sh, cx, cy = bg_place(ls)
    pb = ls.cfg.get("plaque_bg", {"cx": 570, "top": 222, "w": 300, "size": 40})  # in the photo's own pixels
    pl = {"x": pb["cx"] * c - cx, "y": pb["top"] * c - cy, "w": pb["w"] * c, "size": pb["size"] * c}
    for i, o in enumerate(overlays(ls)):
        o["png"] = ls.work("text", f"ov{i}.png")
        spec["items"].append({"out": o["png"], "kind": "overlay", **{k: v for k, v in o.items() if k != "png"}})
    quad = ls.cfg.get("plaque_quad")  # the plate's corners in the photo (TL, TR, BR, BL): text follows its angle
    if quad and c:
        spec["items"].append({"out": ls.work("text", "plaque_flat.png"), "kind": "plaque", "lines": ls.cfg.get("plaque", []),
                              "x": 540, "w": FLAT[2] - 40, "y": FLAT[1], "h": FLAT[3], "size": pb.get("flat_size", 62)})

    cap_y = ls.cfg.get("captions_y", 1330)  # (not "cy": that is the background's crop, used below)
    import hashlib
    for c in caps:  # a subtitle image is named after its own text: an edit re-renders only that one
        key = hashlib.md5(f"{TEXT_STYLE}|{c['text']}|{cap_y}".encode("utf-8")).hexdigest()[:14]
        c["png"] = ls.work("text", "caps", f"{key}.png")
        if not os.path.exists(c["png"]):
            spec["items"].append({"out": c["png"], "kind": "caption", "text": c["text"], "y": cap_y})
    sp = ls.work("text", "spec.json")
    json.dump(spec, open(sp, "w", encoding="utf-8"), ensure_ascii=False)
    r = subprocess.run(["node", os.path.join(ROOT, "tools", "lesson_text.mjs"), sp], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr[-1500:])
    scene, plaque = scene_png(ls)
    bg = ls.work("bg.png")
    depth = f"gblur=sigma={ls.cfg.get('bg_blur', 2.2)},eq=brightness=-0.04:saturation=0.95"  # the set sits behind him
    ff("-i", scene, "-i", plaque, "-filter_complex",
       f"[0]scale={sw}:{sh},crop={W}:{H}:{cx}:{cy},{depth}[b];[1]scale={sw}:{sh},crop={W}:{H}:{cx}:{cy}[t];[b][t]overlay=0:0",
       "-frames:v", "1", bg)
    return bg


def matte_filter(ls, pw, ph, ramp_in):
    """His mask, sized for the frame: drop the half-sure halo (white wall around raised hands), soften,
    and fade the sides of his picture when it does not reach the frame's edges."""
    cut = ls.cfg.get("matte_cut", 175)
    f = (f"[1:v]lutyuv=y='clip((val-{cut})*255/{255 - cut},0,255)',scale={pw}:{ph}:flags=bicubic,"
         f"gblur=sigma={1.4 * pw / W:.2f},format=gray")
    if ramp_in is None:
        return f + "[m]"
    return f + f"[m0];[{ramp_in}:v]format=gray,scale={pw}:{ph}[r];[m0][r]blend=all_mode=multiply,format=gray[m]"


def ramp_png(ls):
    import cv2
    ramp = ls.work("ramp.png")
    if not os.path.exists(ramp):
        x = np.clip(np.minimum(np.arange(W), W - 1 - np.arange(W)) / (W * 0.07), 0, 1)
        cv2.imwrite(ramp, np.tile((x * 255).astype(np.uint8), (H, 1)))
    return ramp


def grade(ls):
    """Blend him into the set: warm him toward the room's light (episode.json "grade")."""
    g = ls.cfg.get("grade", {})
    return (f"eq=brightness={g.get('brightness', 0.0)}:contrast={g.get('contrast', 1.05)}:saturation={g.get('saturation', 1.08)},"
            f"colorbalance=rs={g.get('warm', 0.06)}:gs={g.get('warm', 0.06) / 3}:bs={-g.get('warm', 0.06)}:"
            f"rm={g.get('warm', 0.06)}:bm={-g.get('warm', 0.06)}")


def piece(ls, it, out_v, out_m):
    """One cut piece of the person layer: his own video and his mask, frame for frame - no background,
    no position, no text. Those are layers too, put together in one pass at the end."""
    take = os.path.join(ls.cfg["input_dir"], it["take"] + os.path.splitext(ls.takes[0])[1])
    mk = matte_path(ls, it["take"])
    enc = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "15", "-g", "30", "-pix_fmt", "yuv420p", "-an"]
    n = it["n"]
    if it["kind"] == "clip":
        t = it["a"]
        ff("-ss", f"{t:.3f}", "-i", take, "-vf", f"fps={FPS},scale={MATTE_W * 2}:{MATTE_H * 2}", "-frames:v", str(n), *enc, out_v)
        ff("-ss", f"{t:.3f}", "-i", mk, "-vf", f"fps={FPS},scale={MATTE_W * 2}:{MATTE_H * 2},format=gray", "-frames:v", str(n), *enc, out_m)
    else:  # hold on him (the other side talks): a frozen frame
        for src, out, fmt in ((take, out_v, ""), (mk, out_m, ",format=gray")):
            ff("-ss", f"{it['t']:.3f}", "-i", src, "-vf", f"fps={FPS},scale={MATTE_W * 2}:{MATTE_H * 2}{fmt},loop=loop={n}:size=1:start=0",
               "-frames:v", str(n), *enc, out)


def piece_atomic(ls, it, out_v, out_m):
    pv, pm = out_v[:-4] + ".part.mp4", out_m[:-4] + ".part.mp4"  # a stopped run never leaves a half piece
    piece(ls, it, pv, pm)
    os.replace(pv, out_v)
    os.replace(pm, out_m)


# ---- 5. sound --------------------------------------------------------------------------------------
def load_sound(path, phone=False, pitch=1.0):
    tmp = path + (".phone" if phone else "") + (f".p{pitch}" if pitch != 1 else "") + ".wav"
    if not os.path.exists(tmp):
        af = "highpass=f=380,lowpass=f=3000,acompressor" if phone else "anull"
        if pitch != 1:
            af = f"asetrate={int(SR * pitch)},aresample={SR}," + af
        ff("-i", path, "-ac", "1", "-ar", str(SR), "-af", af, tmp)
    return read_wav(tmp)[0]


def mix(ls, items, total):
    out = np.zeros(int(total / FPS * SR) + SR, np.float32)
    takes = {}
    fade = int(0.012 * SR)
    for it in items:
        o = int(it["out"] / FPS * SR)
        n = int(it.get("an", it["n"]) / FPS * SR)
        if it["kind"] == "clip":
            x = takes.setdefault(it["take"], read_wav(ls.work("audio", it["take"] + ".wav"))[0])
            a = int(it["a"] * SR)
            seg = x[a:a + n].copy()
            seg[:fade] *= np.linspace(0, 1, min(fade, len(seg)))[:len(seg[:fade])]
            tail = int((it["an"] - it["n"]) / FPS * SR) if "an" in it else fade  # crossfade under the next part
            tail = max(fade, min(tail, len(seg)))
            seg[-tail:] *= np.linspace(1, 0, tail)
            out[o:o + len(seg)] += seg
        else:
            ins = it["insert"]
            snd = load_sound(ls.asset(ins["sound"]), ins.get("phone"))
            lead = int(ins.get("lead", 0) * SR)
            start = int(ins.get("from", 0) * SR)
            seg = snd[start:start + n + lead].copy() * ins.get("gain", 0.55 if ins.get("phone") else 0.8)
            f2 = int(0.08 * SR)
            seg[:f2] *= np.linspace(0, 1, len(seg[:f2]))
            seg[-f2:] *= np.linspace(1, 0, len(seg[-f2:]))
            o0 = max(0, o - lead)
            out[o0:o0 + len(seg)] += seg
    # sounds that run under him while he keeps talking (episode.json "sounds"): a phone ringing until he
    # answers, the wife mumbling through the phone for the whole call - nothing waits for them
    for snd_cfg in ls.cfg.get("sounds", []):
        words = load_json(ls.work("words", snd_cfg["take"] + ".json"), [])
        t0 = word_time(words, snd_cfg["from_word"], snd_cfg.get("from_edge", "start"), 0.0) + snd_cfg.get("from_offset", 0.0)
        t1 = word_time(words, snd_cfg["to_word"], snd_cfg.get("to_edge", "start"), max(0.0, t0)) + snd_cfg.get("to_offset", 0.0)
        o0 = out_time(items, snd_cfg["take"], t0)
        o1 = out_time(items, snd_cfg["take"], t1)
        if o0 is None or o1 is None or o1 <= o0:
            raise SystemExit(f"sound {snd_cfg} could not be placed")
        n = int((o1 - o0) * SR)
        snd = load_sound(ls.asset(snd_cfg["sound"]), snd_cfg.get("phone"), snd_cfg.get("pitch", 1.0))
        if len(snd) < n:  # loop a short recording
            snd = np.tile(snd, n // len(snd) + 1)
        seg = snd[:n].copy() * snd_cfg.get("gain", 0.5)
        fi, fo = int(snd_cfg.get("fade_in", 0.05) * SR), int(snd_cfg.get("fade_out", 0.04) * SR)
        seg[:fi] *= np.linspace(0, 1, len(seg[:fi]))
        seg[-fo:] *= np.linspace(1, 0, len(seg[-fo:]))
        a = int(o0 * SR)
        out[a:a + len(seg)] += seg
        ls.placed = getattr(ls, "placed", []) + [{"name": os.path.basename(snd_cfg["sound"]).rsplit(".", 1)[0],
                                                  "from": round(o0, 3), "to": round(o1, 3)}]
    raw = ls.work("mix.raw.wav")
    import wave
    with wave.open(raw, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes((np.clip(out[:int(total / FPS * SR)], -1, 1) * 32767).astype(np.int16).tobytes())
    final = ls.work("mix.wav")
    ff("-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", str(SR), final)
    return final


# ---- 6. assemble -----------------------------------------------------------------------------------
def build(ls, still_at=None, preview=False):
    log(f"▶ {ls.slug} — {len(ls.takes)} takes")
    prepare(ls)
    items, total = plan(ls)
    log(f"  · cut: {sum(1 for i in items if i['kind'] == 'clip')} pieces, {total / FPS:.1f}s "
        f"(raw {sum(len(read_wav(ls.work('audio16', name(t) + '.wav'))[0]) / 16000 for t in ls.takes):.1f}s)")
    caps = captions(ls, items, total)
    save_json(ls.work("edit.json"), {"items": items, "total": total, "captions": caps})
    bg = text_layers(ls, caps)
    if still_at is not None:
        person, mask = person_layer(ls, items)
        audio = mix(ls, items, total)
        out = compose(ls, items, total, caps, bg, person, mask, audio, False, still_frame=int(still_at * FPS))
        log(f"✔ still → {out}")
        return
    person, mask = person_layer(ls, items)
    audio = mix(ls, items, total)
    if preview:
        person_preview(ls, person, mask, audio)
        import cv2
        ph_, pw_ = cv2.imread(ls.asset(ls.cfg["background"])).shape[:2]
        save_json(ls.work("edit.json"), {"items": items, "total": total, "captions": caps, "speed": 1.0, "photo": [pw_, ph_],
                                         "sounds": getattr(ls, "placed", [])})
        log(f"✔ layers ready ({total / FPS:.1f}s) — the editor puts them together live")
        return
    compose(ls, items, total, caps, bg, person, mask, audio, preview)


def person_preview(ls, person, mask, audio):
    """The person layer for the editor: his video with its mask as transparency (VP9 alpha) and the sound.
    Background, size, position, subtitles and text are stacked on it live; Export uses the same numbers."""
    import hashlib
    sig = hashlib.md5("|".join([str(os.path.getmtime(x)) for x in (person, mask, audio)] + [grade(ls), str(ls.cfg.get("matte_cut", 175))]).encode()).hexdigest()[:12]
    out, stamp = ls.work("public", "person.webm"), ls.work("public", "person.stamp")
    if os.path.exists(out) and os.path.exists(stamp) and open(stamp).read() == sig:
        return out
    cut = ls.cfg.get("matte_cut", 175)
    ff("-i", person, "-i", mask, "-i", audio, "-filter_complex",
       f"[1:v]lutyuv=y='clip((val-{cut})*255/{255 - cut},0,255)',scale=540:960:flags=bicubic,gblur=sigma=0.7,format=gray[m];"
       f"[0:v]scale=540:960,{grade(ls)},format=yuva420p[p];[p][m]alphamerge[v]",
       "-map", "[v]", "-map", "2:a", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-deadline", "realtime", "-cpu-used", "8",
       "-row-mt", "1", "-b:v", "2500k", "-auto-alt-ref", "0", "-c:a", "libopus", "-b:a", "128k", out)
    open(stamp, "w").write(sig)
    return out


def person_layer(ls, items):
    """The person layer for the whole video: cut pieces (cached by their cut only), joined."""
    import hashlib
    vids, masks, todo = [], [], []
    for it in items:
        key = hashlib.md5(json.dumps({k: it[k] for k in ("kind", "take", "a", "t", "n") if k in it}, sort_keys=True).encode()).hexdigest()[:16]
        v, m = ls.work("pieces", f"{key}.v.mp4"), ls.work("pieces", f"{key}.m.mp4")
        vids.append(v)
        masks.append(m)
        if not (os.path.exists(v) and os.path.exists(m)):
            todo.append((it, v, m))
    if todo:
        log(f"  · cutting {len(todo)} new pieces of {len(items)}")
        with ThreadPoolExecutor(max_workers=6) as pool:
            for fu in [pool.submit(piece_atomic, ls, *x) for x in todo]:
                fu.result()
    out = []
    for name_, files in (("person", vids), ("mask", masks)):
        lst = ls.work("pieces", f"{name_}.txt")
        with open(lst, "w", encoding="utf-8") as fh:
            fh.writelines(f"file '{f.replace(os.sep, '/')}'\n" for f in files)
        dst = ls.work(f"{name_}.mp4")
        ff("-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", dst)
        out.append(dst)
    return out


def compose(ls, items, total, caps, bg, person, mask, audio, preview, still_frame=None):
    """One pass: background photo + person (masked, graded, placed) + subtitles + text on video + speed.
    The preview is composed at half size, so it is quick; Export composes full size."""
    f = 0.5 if preview else 1.0
    w, h = int(W * f), int(H * f)
    pw, ph, x, y = layout(ls)
    pw, ph, x, y = int(pw * f) // 2 * 2, int(ph * f) // 2 * 2, int(x * f), int(y * f)
    spd = 1.0 if preview else min(1.3, max(1.0, float(ls.cfg.get("speed", 1.0))))
    frames = round(total / spd)
    # captions as one image stream
    cl, blank = ls.work("text", "captions.txt"), ls.work("text", "blank.png")
    if not os.path.exists(blank):
        ff("-f", "lavfi", "-i", f"color=c=black@0.0:s={W}x{H},format=rgba", "-frames:v", "1", blank)
    with open(cl, "w", encoding="utf-8") as fh:
        t = 0
        for c in caps:
            if c["from"] > t:
                fh.write(f"file '{blank.replace(os.sep, '/')}'\nduration {(c['from'] - t) / FPS:.4f}\n")
            fh.write(f"file '{c['png'].replace(os.sep, '/')}'\nduration {(c['to'] - c['from']) / FPS:.4f}\n")
            t = c["to"]
        fh.write(f"file '{blank.replace(os.sep, '/')}'\nduration {max(0.1, (total - t) / FPS):.4f}\n")
        fh.write(f"file '{blank.replace(os.sep, '/')}'\n")
    ovs = [] if preview else overlays(ls)  # the editor draws text on video live over the preview
    ramp = ramp_png(ls) if (pw < w or x > 0 or x + pw < w) else None
    inputs = ["-i", person, "-i", mask, "-loop", "1", "-framerate", str(FPS), "-i", bg, "-f", "concat", "-safe", "0", "-i", cl, "-i", audio]
    if ramp:
        inputs += ["-loop", "1", "-framerate", str(FPS), "-i", ramp]
    first_ov = 6 if ramp else 5
    for o in ovs:
        inputs += ["-loop", "1", "-i", o["png"]]
    fc = (matte_filter(ls, pw, ph, 5 if ramp else None) + ";"
          f"[0:v]scale={pw}:{ph},{grade(ls)},format=yuva420p[p];[p][m]alphamerge[fg];"
          f"[2:v]scale={w}:{h}[b];[b][fg]overlay={x}:{y}:shortest=1:format=auto[s];"
          f"[3:v]fps={FPS},scale={w}:{h},format=rgba[c];[s][c]overlay=eof_action=pass[v0]")
    last = "v0"
    for k, o in enumerate(ovs):
        a, b = float(o.get("start") or 0), float(o.get("end") or total / FPS)
        fc += f";[{first_ov + k}:v]scale={w}:{h}[o{k}];[{last}][o{k}]overlay=enable='between(t,{a:.3f},{b:.3f})'[v{k + 1}]"
        last = f"v{k + 1}"
    fc += f";[{last}]setpts=PTS/{spd},fps={FPS},format=yuv420p[v];[4:a]atempo={spd}[a]"
    if still_frame is not None:
        out = ls.work("still.png")
        ff(*inputs, "-filter_complex", fc, "-map", "[v]", "-vf" if False else "-ss", f"{still_frame / FPS:.3f}", "-frames:v", "1", out)
        return out
    if preview:
        out, enc = ls.work("public", "preview.mp4"), ["-preset", "veryfast", "-crf", "26"]
    else:
        out, enc = ls.p("out", ls.slug + ".mp4"), ["-preset", "medium", "-crf", "19"]
    os.makedirs(os.path.dirname(out), exist_ok=True)
    ff(*inputs, "-filter_complex", fc, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", *enc, "-c:a", "aac", "-b:a", "192k",
       "-frames:v", str(frames), "-movflags", "+faststart", out)
    if preview:  # (an export leaves the editor's layer info - photo size, sounds - as it is)
        save_json(ls.work("edit.json"), {"items": items, "total": total, "captions": caps, "speed": spd})
    log(f"✔ {out}  ({frames / FPS:.1f}s{f', x{spd}' if spd != 1 else ''})")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--still", type=float)
    ap.add_argument("--preview", action="store_true", help="quick 540p copy for the editor instead of the final export")
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    build(Lesson(a.episode), a.still, a.preview)
