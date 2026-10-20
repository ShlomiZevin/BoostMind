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
    r = subprocess.run([FFMPEG, "-y", "-v", "error", *args], capture_output=True, text=True, encoding="utf-8", errors="replace",
                       cwd=ROOT)  # from the studio folder: model paths in filters stay relative (a drive's ':' breaks filter syntax)
    if r.returncode:
        raise RuntimeError(r.stderr[-1500:])


def ff_progress(total_frames, *args):
    """ffmpeg that says how far it is: "Rendered n/total" lines (the editor shows them as Exporting · n%)."""
    p = subprocess.Popen([FFMPEG, "-y", "-v", "error", "-progress", "pipe:1", "-nostats", *args], stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace", cwd=ROOT)
    last = -1
    for line in p.stdout:
        if line.startswith("frame="):
            n = int(line.split("=", 1)[1].strip() or 0)
            step = n * 50 // max(1, total_frames)  # about every 2%
            if step != last:
                last = step
                log(f"Rendered {min(n, total_frames)}/{total_frames}")
    err = p.stderr.read()
    if p.wait():
        raise RuntimeError(err[-1500:])


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
        ec = eye_cfg(ls)
        named = (ec or {}).get("file")  # episode.json "eye_contact": {"file": "goodone.mp4"} - CapCut's export, by name
        outside = [os.path.join(ls.cfg["input_dir"], named)] if named else             sorted(glob.glob(os.path.join(ls.cfg["input_dir"], n + "*eye*.*")))  # or e.g. IMG_9980_eyes.mp4
        if ec and outside:
            # CapCut's (or any app's) eye-contact export: it must be the same video, frame for frame
            dur = lambda f: float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f],
                                                 capture_output=True, text=True).stdout.strip() or 0)
            d0, d1 = dur(t), dur(outside[0])
            if abs(d0 - d1) > 0.15:
                raise SystemExit(f"{os.path.basename(outside[0])} is {d1:.2f}s but {n} is {d0:.2f}s - export it from CapCut "
                                 f"without trimming (same length, 30 fps), or the mouth will not match the voice")
            g = ls.work("gaze", f"{n}.{gaze_sig(ls)}.mp4")
            if not os.path.exists(g) or os.path.getmtime(g) < os.path.getmtime(outside[0]):
                ff("-i", outside[0], "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "15", "-pix_fmt", "yuv420p", g)
                log(f"  · eye contact {n}: using {os.path.basename(outside[0])}")
        elif ec:  # you read off to the side: the eyes are brought back to the lens before anything is cut
            g = ls.work("gaze", f"{n}.{gaze_sig(ls)}.mp4")
            mode = ec.get("mode", "nvidia")
            fell_back = g + ".fallback"  # made by v6 because NVIDIA failed - try NVIDIA again next time
            if not os.path.exists(g) or (mode == "nvidia" and os.path.exists(fell_back)):
                done = False
                if mode == "nvidia":  # NVIDIA Maxine's eye contact + our blink handling (tools/eyes_nvidia.py) - beat CapCut
                    r = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "eyes_nvidia.py"), t, g[:-4] + ".part.mp4"],
                                       capture_output=True, text=True, encoding="utf-8", errors="replace")
                    if r.returncode == 0 and os.path.exists(g[:-4] + ".part.mp4"):
                        os.replace(g[:-4] + ".part.mp4", g)
                        if os.path.exists(fell_back):
                            os.remove(fell_back)
                        log(f"  · eye contact {n} (NVIDIA)")
                        done = True
                    else:  # out of trial credits, endpoint changed, offline... - never stop the build for it
                        log(f"  · NVIDIA eye contact failed for {n} - using our own (v6) instead: {(r.stdout + r.stderr).strip()[-300:]}")
                if not done and not os.path.exists(g):
                    args = [sys.executable, os.path.join(ROOT, "tools", "gaze_video.py"), t, g[:-4] + ".part.mp4",
                            "--mode", "neural" if mode == "nvidia" else mode,
                            "--strength", str(ec.get("strength", 1.0)), "--dy", str(ec.get("dy", 0.6))]
                    if ec.get("nudge"):
                        args.append("--nudge=" + ",".join(str(v) for v in ec["nudge"]))
                    r = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace")
                    if r.returncode:
                        raise RuntimeError("eye contact failed: " + r.stderr[-800:])
                    os.replace(g[:-4] + ".part.mp4", g)
                    if mode == "nvidia":
                        open(fell_back, "w").close()
                    log(f"  · eye contact {n} ({'v6, NVIDIA fallback' if mode == 'nvidia' else mode})")
        mk = matte_path(ls, n)
        if ls.cfg.get("cutout") is False:  # their own place stays: no cut-out needed
            continue
        if not os.path.exists(mk) and ls.cfg.get("matte_engine") == "hybrid":
            hybrid_matte(ls, t, n)
            log(f"  · cut out {n} (hybrid: quality + the head kept)")
        elif not os.path.exists(mk):
            matte(t, mk[:-4] + ".part.mkv", ls.cfg.get("matte_engine", "fast"))
            os.replace(mk[:-4] + ".part.mkv", mk)  # a stopped run never leaves a half cut-out that looks finished
            log(f"  · cut out {n}")


def matte_path(ls, n):
    eng = ls.cfg.get("matte_engine", "fast")
    return ls.work("matte", n + (".mkv" if eng == "fast" else f".{eng}.mkv"))


def face_boxes(src, out_json):
    """Per frame: the face's box (in 0-1 coordinates), from MediaPipe's face landmarks - where the head is."""
    import mediapipe as mp
    from mediapipe.tasks import python as mpt
    from mediapipe.tasks.python import vision
    det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
        base_options=mpt.BaseOptions(model_asset_path=os.path.join(ROOT, "models", "face_landmarker.task")),
        running_mode=vision.RunningMode.VIDEO, num_faces=1))
    dec = subprocess.Popen([FFMPEG, "-v", "error", "-i", src, "-vf", f"scale={MATTE_W}:{MATTE_H},fps={FPS}",
                            "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    size, boxes, n = MATTE_W * MATTE_H * 3, [], 0
    while True:
        buf = dec.stdout.read(size)
        if len(buf) < size:
            break
        r = det.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.frombuffer(buf, np.uint8).reshape(MATTE_H, MATTE_W, 3)),
                                 int(n * 1000 / FPS))
        if r.face_landmarks:
            xs = [p.x for p in r.face_landmarks[0]]
            ys = [p.y for p in r.face_landmarks[0]]
            boxes.append([min(xs), min(ys), max(xs), max(ys)])
        else:
            boxes.append(boxes[-1] if boxes else None)
        n += 1
    dec.wait()
    save_json(out_json, boxes)
    return boxes


def keep_cfg(ls, take):
    """The desk / props kept for a take: its own setting, else the one for every take ("*")."""
    kp = ls.cfg.get("keep") or {}
    return kp.get(take) or kp.get("*")


def keep_png(ls, take):
    """The real things on his desk stay in front of the new set (episode.json "keep": {"<take>": {"below": y,
    "bright_in": [x0, y0, x1, y1]}}, in the take's own pixels): everything under the desk's front edge, and the
    bright objects (a white lamp / mouse) standing on it inside the box. A still mask - the camera does not move -
    OR-ed into his matte, so the desk, the keyboard and the mouse are the take's own pixels, his hands too."""
    k = keep_cfg(ls, take)
    if not k:
        return None
    import hashlib
    import cv2
    out = ls.work("keep", f"{take}.{hashlib.md5(json.dumps(k, sort_keys=True).encode()).hexdigest()[:8]}.png")
    if os.path.exists(out):
        return out
    src = os.path.join(ls.cfg["input_dir"], take + os.path.splitext(ls.takes[0])[1])
    cap = cv2.VideoCapture(src)
    nf = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frames = []
    for i in np.linspace(0, nf - 1, 9).astype(int):
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(i))
        ok, fr = cap.read()
        if ok:
            frames.append(fr)
    img = np.median(np.stack(frames), axis=0).astype(np.uint8)
    h, w = img.shape[:2]
    m = np.zeros((h, w), np.uint8)
    below = int(k["below"]) if "below" in k else int(h * float(k.get("below_frac", 1.0)))
    k = {**k, "below": below}
    if k.get("objects") and not k.get("bright_in"):  # the editor's slider: bright things standing on the desk are kept too
        k["bright_in"] = [0, max(0, below - int(0.22 * h)), w, below]
    m[below:, :] = 255
    if k.get("bright_in"):
        x0, y0, x1, y1 = k["bright_in"]
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        br = ((hsv[..., 2] >= k.get("bright", 175)) & (hsv[..., 1] <= k.get("sat", 60))).astype(np.uint8) * 255
        box = np.zeros_like(br)
        box[y0:y1, x0:x1] = br[y0:y1, x0:x1]
        box = cv2.morphologyEx(box, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
        box = cv2.morphologyEx(box, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        n_, lab, st, _ = cv2.connectedComponentsWithStats(box)
        for j in range(1, n_):  # the objects standing on the desk: the parts that reach down to its edge
            if st[j, cv2.CC_STAT_TOP] + st[j, cv2.CC_STAT_HEIGHT] >= int(k["below"]) - 4 and st[j, cv2.CC_STAT_AREA] > 400:
                m[lab == j] = 255
    for x0, y0, x1, y1 in k.get("boxes", []):  # a fixed object in front (a mic on its stand): its box stays, in fractions
        m[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)] = 255
    if k.get("stable"):  # things that never move (a microphone on its stand): whatever the cut-out keeps in almost
        # every frame of the take is kept in all of them - the cut-out loses a mic now and then, it is not a person
        mc = cv2.VideoCapture(matte_path(ls, take))
        mn = int(mc.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
        acc, cnt = None, 0
        for fi in np.linspace(0, mn - 1, 48).astype(int):
            mc.set(cv2.CAP_PROP_POS_FRAMES, int(fi))
            ok, fr = mc.read()
            if not ok:
                continue
            g = cv2.resize(fr[..., 0] if fr.ndim == 3 else fr, (w, h)) > 128
            acc = g.astype(np.float32) if acc is None else acc + g
            cnt += 1
        if cnt:
            st = (acc / cnt) >= float(k["stable"])
            st[: int(h * float(k.get("stable_from", 0.45))), :] = False  # only the lower part (the desk / the mic), not the head
            st = cv2.morphologyEx(st.astype(np.uint8) * 255, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
            m = np.maximum(m, st)
    m = cv2.GaussianBlur(m, (0, 0), k.get("feather", 2.0))
    # (cv2.imwrite cannot write a Hebrew path on Windows - it garbles the name)
    cv2.imencode(".png", cv2.resize(m, (MATTE_W * 2, MATTE_H * 2), interpolation=cv2.INTER_AREA))[1].tofile(out)
    return out


def hybrid_matte(ls, t, n):
    """The quality cut-out everywhere, and around the head the fast one too: a white wig against a white wall
    can make the quality model drop the whole head for a moment; the fast model knows a head is a head."""
    q = ls.work("matte", n + ".quality.mkv")
    f = ls.work("matte", n + ".mkv")
    for path, engine in ((q, "quality"), (f, "fast")):
        if not os.path.exists(path):
            matte(t, path[:-4] + ".part.mkv", engine)
            os.replace(path[:-4] + ".part.mkv", path)
    fj = ls.work("matte", n + ".faces.json")
    boxes = load_json(fj) if os.path.exists(fj) else face_boxes(t, fj)
    out = ls.work("matte", n + ".hybrid.part.mkv")
    rd = lambda p: subprocess.Popen([FFMPEG, "-v", "error", "-i", p, "-f", "rawvideo", "-pix_fmt", "gray", "-"], stdout=subprocess.PIPE)
    dq, df = rd(q), rd(f)
    enc = subprocess.Popen([FFMPEG, "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{MATTE_W}x{MATTE_H}",
                            "-r", str(FPS), "-i", "-", "-c:v", "ffv1", out], stdin=subprocess.PIPE)
    size, k = MATTE_W * MATTE_H, 0
    while True:
        a, b = dq.stdout.read(size), df.stdout.read(size)
        if len(a) < size or len(b) < size:
            break
        mq = np.frombuffer(a, np.uint8).reshape(MATTE_H, MATTE_W).copy()
        box = boxes[k] if k < len(boxes) else None
        if box:  # the head: the face box, wide for the hair, high for a wig, down to the chin
            x0, y0, x1, y1 = box
            w, h = x1 - x0, y1 - y0
            X0, X1 = int(max(0, x0 - 0.45 * w) * MATTE_W), int(min(1, x1 + 0.45 * w) * MATTE_W)
            Y0, Y1 = int(max(0, y0 - 0.75 * h) * MATTE_H), int(min(1, y1 + 0.15 * h) * MATTE_H)
            mf = np.frombuffer(b, np.uint8).reshape(MATTE_H, MATTE_W)
            mq[Y0:Y1, X0:X1] = np.maximum(mq[Y0:Y1, X0:X1], mf[Y0:Y1, X0:X1])
        enc.stdin.write(mq.tobytes())
        k += 1
    enc.stdin.close()
    enc.wait()
    dq.wait()
    df.wait()
    os.replace(out, ls.work("matte", n + ".hybrid.mkv"))


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
    src16 = ls.work("audio16", n + ".wav")
    if ls.cfg.get("denoise", {}).get("rnn"):
        # a hum (an air conditioner) close to a quiet voice: find the pauses in the cleaned voice - the one you hear
        dn = take_audio(ls, n, denoise=True)
        src16 = dn[:-4] + ".16k.wav"
        if not os.path.exists(src16) or os.path.getmtime(src16) < os.path.getmtime(dn):
            ff("-i", dn, "-ac", "1", "-ar", "16000", src16)
    env = Env(src16)
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
    if c.get("whole"):  # nobody talks in it (a reaction, a stare): the whole take
        tight = [[0.0, dur]]
    keep = (c.get("keep_pauses") or {}).get(n, [])  # {"<take>": [[from, to], ...]}: he is listening there - never cut
    if keep and tight:
        joined = [tight[0]]
        for a, b in tight[1:]:
            if any(r0 < a and r1 > joined[-1][1] for r0, r1 in keep):
                joined[-1] = [joined[-1][0], b]
            else:
                joined.append([a, b])
        tight = joined
    if tight and c.get("silence") is False:  # keep his pauses: one piece from his first word to his last
        tight = [[tight[0][0], tight[-1][1]]]
    words = load_json(ls.work("words", n + ".json"), [])
    if words:  # a short burst with no word in it is a tap / a breath, not speech (a long one stays: the recogniser drops words)
        tight = [sp for sp in tight if sp[1] - sp[0] >= 0.6 or any(w["s"] < sp[1] and w["e"] > sp[0] for w in words)]
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
    end_at = (c.get("end_at") or {}).get(n)
    if end_at is not None:  # a hard cut, even in the middle of a word (the punchline is cut off)
        tight = [[a, min(b, end_at)] for a, b in tight if a < end_at]
    lead = (c.get("lead_in") or {}).get(n)
    if lead and tight and lead[1] < tight[0][0]:  # a silent moment before he talks (at work, then someone calls him)
        tight = [list(lead)] + tight
    edges = (c.get("edges") or {}).get(n)
    if edges and tight:  # a piece's start / end dragged in the editor: more (or less) of the original take
        tight = [list(sp) for sp in tight]
        for was, now in edges:
            for sp in tight:
                for k in (0, 1):
                    if abs(sp[k] - was) < 0.12:
                        sp[k] = min(max(0.0, float(now)), dur)
        tight = sorted([sp for sp in tight if sp[1] - sp[0] >= 0.1])
        merged = [tight[0]] if tight else []
        for a, b in tight[1:]:  # dragged into the next piece: they become one
            if a <= merged[-1][1] + 0.02:
                merged[-1][1] = max(merged[-1][1], b)
            else:
                merged.append([a, b])
        tight = merged
    for r0, r1 in (c.get("removes") or {}).get(n, []):  # parts taken out in the editor (split twice, delete the piece)
        kept = []
        for a, b in tight:
            if b <= r0 or a >= r1:
                kept.append([a, b])
                continue
            if a < r0:
                kept.append([a, r0])
            if b > r1:
                kept.append([r1, b])
        tight = kept
    for sp in sorted((c.get("splits") or {}).get(n, [])):  # split points: a piece in two, nothing lost
        out = []
        for a, b in tight:
            out += [[a, sp], [sp, b]] if a + 0.05 < sp < b - 0.05 else [[a, b]]
        tight = out
    return [sp for sp in tight if sp[1] - sp[0] >= 0.05]


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
            if ins.get("at_start"):  # before anything is said (an opening): at the first spoken part's start
                cuts.append((sp[0][0], ins))
                continue
            if "at" in ins:  # an exact moment of his take (seconds), e.g. the end of his look after a line
                cuts.append((float(ins["at"]), ins))
                after = float(ins["at"])
                continue
            if ins.get("with_prev") and cuts:  # right after the previous insert, at the same moment of his take
                cuts.append((cuts[-1][0], ins))
                continue
            # ("search_from": seconds in the take - the word said earlier too, e.g. the second "אה")
            at = find_word(words, ins.get("before") or ins["after"], max(after, ins.get("search_from", 0)), before="before" in ins)
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
    # the whole video's start / end, marked in the editor (cut "video_start" / "video_end": {take, t}) - every layer follows
    c = cut_cfg(ls)
    vs, ve = c.get("video_start"), c.get("video_end")
    if vs:
        k = next((i for i, it in enumerate(items) if it["kind"] == "clip" and it["take"] == vs["take"] and it["a"] <= vs["t"] < it["a"] + it["n"] / FPS), None)
        if k is not None:
            it = items[k]
            cut_f = round((vs["t"] - it["a"]) * FPS)
            items = [{**it, "a": vs["t"], "n": it["n"] - cut_f}] + items[k + 1:]
    if ve:
        k = next((i for i, it in enumerate(items) if it["kind"] == "clip" and it["take"] == ve["take"] and it["a"] < ve["t"] <= it["a"] + it["n"] / FPS + 0.02), None)
        if k is not None:
            it = items[k]
            items = items[:k] + [{**it, "n": max(1, round((ve["t"] - it["a"]) * FPS))}]
    # jump cuts: the picture cuts `join` early and the next part starts there, while the previous part's
    # sound runs on underneath for that moment (crossfaded) - no gap, the next word lands on the last one
    ov = round(cut_cfg(ls)["join"] * FPS)
    for prev, nxt in zip(items, items[1:]):
        follows = nxt.get("take") == prev.get("take") and abs(nxt.get("a", -9) - (prev.get("a", 0) + prev["n"] / FPS)) < 0.04
        if prev["kind"] == "clip" and nxt["kind"] == "clip" and prev["n"] > ov + 6 and not follows:
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
def script_path(ls):
    """The project's script (episode.json "script": "<id>" -> scripts/<id>.txt) - the one the Reader shows."""
    s = ls.cfg.get("script")
    return os.path.join(ROOT, "scripts", f"{s}.txt") if s else None


def script_tokens(ls):
    """The words said on camera, from the script: no notes (#), no directions ([..] / (..)) or on-screen texts;
    with several speakers, only the on-camera one's lines (the one with the most lines)."""
    from collections import Counter
    rows, last = [], None
    raw_rows = [r.strip() for r in open(script_path(ls), encoding="utf-8").read().splitlines()]
    pref = lambda r: re.match(r"^([^:：]{1,24})[:：]\s*(.*)$", r.replace("**", ""))
    named = Counter(m.group(1).strip() for m in map(pref, raw_rows) if m and len(m.group(1).split()) <= 3)
    for r in raw_rows:
        if not r or r.startswith("#") or re.fullmatch(r"\[.*\]|\(.*\)", r):
            continue
        r = re.sub(r"\[[^\]]*\]|\([^)]*\)", " ", r)
        m = pref(r)
        who, text = None, r.replace("**", "")
        if m and (named[m.group(1).strip()] >= 2 or r.startswith("**")):  # a speaker's name (seen more than once, or bold)
            who, text = m.group(1).strip(), m.group(2)
        who = who or last
        last = who
        rows.append((who, text))
    speakers = Counter(w for w, _ in rows if w)
    main = speakers.most_common(1)[0][0] if speakers else None
    toks = []
    for who, text in rows:
        if main and who and who != main:
            continue
        toks += [t for t in re.sub(r'["“”]', "", text).split() if t.strip(".,!?:;-–—")]
    return toks


def script_blocks(ls):
    """The script's words per take, matched to what he says: a passage he skipped is left out, a longer ad-lib
    comes in as he said it; small words the recogniser misses stay."""
    toks = script_tokens(ls)
    heard = [(name(t), w) for t in ls.takes for w in load_json(ls.work("words", name(t) + ".json"), [])]
    blocks = {name(t): [] for t in ls.takes}
    if not heard:
        return blocks
    sm = difflib.SequenceMatcher(a=[norm(x) for x in toks], b=[norm(w["w"]) for _, w in heard], autojunk=False)
    take_at = lambda j: heard[min(max(j, 0), len(heard) - 1)][0]
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal" or (tag == "replace" and i2 - i1 == j2 - j1):
            for i, j in zip(range(i1, i2), range(j1, j2)):
                blocks[take_at(j)].append(toks[i])
        elif tag == "replace":  # wording close to the script: the script's words, in the take where they are said
            blocks[take_at(j1)] += toks[i1:i2]
        elif tag == "delete" and i2 - i1 <= 2:  # a word or two the recogniser dropped
            blocks[take_at(j1 - 1)] += toks[i1:i2]
        elif tag == "insert" and j2 - j1 >= 3:  # an ad-lib: what he said
            for j in range(j1, j2):
                blocks[take_at(j)].append(heard[j][1]["w"])
    return blocks


def sync_captions(ls):
    """The script is the source of the subtitles: when it changed after captions.txt (or captions.txt has no
    words), captions.txt is made again from it. A line fixed in the editor stays until the script changes again.
    episode.json "captions_from": "file" keeps captions.txt as it is (finished videos)."""
    sp = script_path(ls)
    if not sp or not os.path.exists(sp) or ls.cfg.get("captions_from") == "file":
        return
    cp = ls.p("captions.txt")
    has_words = os.path.exists(cp) and any(l.strip() and not l.startswith(("#", "==")) for l in open(cp, encoding="utf-8"))
    if has_words and os.path.getmtime(cp) >= os.path.getmtime(sp):
        return
    blocks = script_blocks(ls)
    with open(cp, "w", encoding="utf-8") as fh:
        fh.write(f"# Subtitles from scripts/{ls.cfg['script']}.txt (the script is the source: update it in the Reader; a line fixed here stays until the script changes)\n")
        for t in ls.takes:
            fh.write(f"== {name(t)}\n{' '.join(blocks[name(t)])}\n")
    log(f"  · subtitles from the script ({sum(len(b) for b in blocks.values())} words)")

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
    other = []
    pl = placed_sounds(ls, items)
    for si, s in enumerate(ls.cfg.get("sounds", [])):
        if s.get("captions") and si in pl:
            o0 = pl[si][0] - s.get("from", 0.0)
            other += [{"from": int((o0 + a) * FPS), "to": int((o0 + b) * FPS), "text": tx, "who": "other", "over": True}
                      for a, b, tx in s["captions"]]
    for it in items:
        ins = it.get("insert") or {}
        if it["kind"] == "hold" and ins.get("captions"):
            o0 = it["out"] - ins.get("lead", 0) * FPS - ins.get("from", 0) * FPS
            other += [{"from": int(o0 + a * FPS), "to": int(o0 + b * FPS), "text": tx, "who": "other"} for a, b, tx in ins["captions"]]
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
    for o in [o for o in other if not o.get("over")]:  # his subtitles give way to the other side's (a pause opened for them)
        for c in caps:
            if c["from"] < o["from"] < c["to"]:
                c["to"] = o["from"]
    return sorted(caps + other, key=lambda c: c["from"])


TEXT_STYLE = 2  # bump when lesson_text.mjs changes how captions look, so cached images are redrawn


# ---- 4. pictures -----------------------------------------------------------------------------------
def layout(ls):
    p = ls.cfg.get("person", {})
    s = p.get("scale", 1.0)
    pw, ph = int(W * s) // 2 * 2, int(H * s) // 2 * 2
    return pw, ph, (W - pw) // 2 + p.get("x", 0), H - ph + p.get("y", 0)


def find_phrase(words, phrase, after=0.0, last=False):
    """Where he says a phrase (its first words, or with last=True its last ones): (start, end) in the take, or None."""
    want = [norm(t) for t in phrase.split() if norm(t)]
    want = want[-4:] if last else want[:4]
    have = [norm(w["w"]) for w in words]
    best, at = 0.0, None
    for i in range(len(words) - len(want) + 1):
        if words[i]["s"] < after - 0.01:
            continue
        r = difflib.SequenceMatcher(a=want, b=have[i:i + len(want)], autojunk=False).ratio()
        if r > best + 1e-6:
            best, at = r, i
    if at is None or best < 0.6:
        return None
    return words[at]["s"], words[at + len(want) - 1]["e"]


def time_overlays(ls, items, total):
    """Overlays tied to what he says ("from_words", "to_words", "take"): their start / end follow the cut. One with
    no "to_words" stays until the next one tied to words starts (a question until the next question), or the end."""
    ov = ls.cfg.get("overlays") or []
    by_sound = [o for o in ov if o.get("sound") is not None]
    if by_sound:
        pl = placed_sounds(ls, items)
        for o in by_sound:
            if o["sound"] in pl:
                a, b = pl[o["sound"]]
                o["start"], o["end"] = round(max(0.0, a - 0.05), 2), round(b + o.get("hold", 0.35), 2)
        seq = sorted([o for o in by_sound if o.get("start") is not None], key=lambda o: o["start"])
        for o, nxt in zip(seq, seq[1:]):  # one bubble at a time: it is gone before the next one appears
            if nxt.get("style") == o.get("style"):
                o["end"] = round(min(o["end"], nxt["start"] - 0.03), 2)
    tied = [o for o in ov if o.get("from_words")]
    if not tied:
        if by_sound:
            p = ls.p("episode.json")
            cfg = load_json(p)
            cfg["overlays"] = ov
            save_json(p, cfg)
        return
    after = {}
    for o in tied:
        hit = take = None  # "from_words" may list alternatives: the question read aloud, else the answer's first words;
        for ph in (o["from_words"] if isinstance(o["from_words"], list) else [o["from_words"]]):  # in any take, inside the cut
            for tk in ([o["take"]] if o.get("take") else [name(t) for t in ls.takes]):
                words = load_json(ls.work("words", tk + ".json"), [])
                h = find_phrase(words, ph, after.get(tk, 0.0))
                if h and to_out(items, tk, h[0]) is not None and any(it["kind"] == "clip" and it["take"] == tk and it["a"] <= h[0] <= it["a"] + it["n"] / FPS for it in items):
                    hit, take = h, tk
                    break
            if hit:
                break
        if not hit:
            log(f"  · overlay words not heard: {str(o['from_words'])[:60]}")
            continue
        after[take] = hit[0]
        words = load_json(ls.work("words", take + ".json"), [])
        o["start"] = round(out_time(items, take, hit[0]) or 0.0, 2)
        if o.get("to_words"):
            end = find_phrase(words, o["to_words"], hit[0], last=True)
            o["end"] = round(out_time(items, take, end[1]) + o.get("hold", 0.4), 2) if end else None
        else:
            o["end"] = None
    timed = sorted([o for o in tied if o.get("start") is not None], key=lambda o: o["start"])
    for o, nxt in zip(timed, timed[1:] + [None]):
        if o.get("end") is None:
            o["end"] = round(nxt["start"] - 0.1, 2) if nxt else round(total / FPS, 2)
    for o in ov:  # "until": "question" - shown until the first of those appears (a hook until the first question)
        if o.get("until"):
            firsts = [x["start"] for x in ov if x.get("style") == o["until"] and x.get("start") is not None]
            if firsts:
                o["end"] = round(min(firsts) - 0.05, 2)
    p = ls.p("episode.json")  # the editor shows them where they now are
    cfg = load_json(p)
    cfg["overlays"] = ov
    save_json(p, cfg)


def overlays(ls):
    """Text on video - the same items (text, font, theme, opacity, y, size, start/end) the Zoom template uses."""
    ov = ls.cfg.get("overlays")
    if ov is None and ls.cfg.get("title"):
        ov = [{"text": ls.cfg["title"], "style": "pov", "font": "stam-ashkenaz", "theme": "gold", "opacity": 0, "y": 270, "size": 64}]
    out = [o for o in (ov or []) if ((o.get("text") or "").strip() or o.get("image"))
           and not ((o.get("from_words") or o.get("sound") is not None) and o.get("start") is None)]  # not placed yet: not drawn
    for o in out:
        if o.get("image"):
            o["image_abs"] = ls.asset(o["image"]).replace("\\", "/")
    return out


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


def cap_y_of(ls, c):
    """A subtitle's height: his at captions_y; the other side's (said over him) above it (captions_other.y)."""
    y = ls.cfg.get("captions_y", 1330)
    return (ls.cfg.get("captions_other") or {}).get("y", y - 150) if c.get("over") else y


THOUGHT_V = 2  # bump when render/ui/thought_anim.js changes, so the thought clips are made again


def text_layers(ls, caps):
    spec = {"fontsDir": os.path.join(ROOT, "fonts"), "items": []}
    c, sw, sh, cx, cy = bg_place(ls)
    pb = ls.cfg.get("plaque_bg", {"cx": 570, "top": 222, "w": 300, "size": 40})  # in the photo's own pixels
    pl = {"x": pb["cx"] * c - cx, "y": pb["top"] * c - cy, "w": pb["w"] * c, "size": pb["size"] * c}
    anims = []
    for i, o in enumerate(overlays(ls)):
        o["png"] = ls.work("text", f"ov{i}.png")
        if o.get("style") == "thought":  # animated (render/ui/thought_anim.js): a transparent clip, made once per text and timing
            import hashlib
            k = {f: o.get(f) for f in ("text", "y", "size", "start", "end")}
            o["anim"] = ls.work("text", "anim", hashlib.md5(json.dumps([THOUGHT_V, k], ensure_ascii=False).encode()).hexdigest()[:14] + ".mov")
            o["anim_y"] = max(0, round(float(o.get("y") or 1150) - 220))  # the clip's top (tools/thought_frames.mjs)
            if not os.path.exists(o["anim"]):
                anims.append({"out": o["anim"], "text": o["text"], "y": float(o.get("y") or 1150), "size": o.get("size") or 70,
                              "start": float(o["start"]), "end": float(o["end"])})
            continue
        spec["items"].append({"out": o["png"], "kind": "overlay", **{k: v for k, v in o.items() if k != "png"}})
    if anims:
        asp = ls.work("text", "anim", "spec.json")
        json.dump({"fontsDir": os.path.join(ROOT, "fonts"), "fps": FPS, "items": anims}, open(asp, "w", encoding="utf-8"), ensure_ascii=False)
        log(f"  · animating {len(anims)} thoughts")
        r = subprocess.run(["node", os.path.join(ROOT, "tools", "thought_frames.mjs"), asp], capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode:
            raise RuntimeError(r.stderr[-1500:])
    quad = ls.cfg.get("plaque_quad")  # the plate's corners in the photo (TL, TR, BR, BL): text follows its angle
    if quad and c:
        spec["items"].append({"out": ls.work("text", "plaque_flat.png"), "kind": "plaque", "lines": ls.cfg.get("plaque", []),
                              "x": 540, "w": FLAT[2] - 40, "y": FLAT[1], "h": FLAT[3], "size": pb.get("flat_size", 62)})

    cap_y = ls.cfg.get("captions_y", 1330)  # (not "cy": that is the background's crop, used below)
    import hashlib
    for c in caps:  # a subtitle image is named after its own text: an edit re-renders only that one
        style = {**(ls.cfg.get("captions_style") or {}), **((ls.cfg.get("captions_other") or {}) if c.get("who") == "other" else {})}
        key = hashlib.md5(f"{TEXT_STYLE}|{c['text']}|{cap_y_of(ls, c)}|{json.dumps(style, sort_keys=True)}".encode("utf-8")).hexdigest()[:14]
        c["png"] = ls.work("text", "caps", f"{key}.png")
        if not os.path.exists(c["png"]):
            spec["items"].append({"out": c["png"], "kind": "caption", "text": c["text"], "y": cap_y_of(ls, c), "style": style})
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


def grade(ls, width=1080):
    """Blend him into the set: warm him toward the room's light (episode.json "grade"); "smooth" 0..1 = a skin
    smoothing that keeps edges (bilateral), scaled to the picture's size so the preview and the export match."""
    g = ls.cfg.get("grade", {})
    sm = float(g.get("smooth", 0) or 0)
    smooth = f"bilateral=sigmaS={max(0.5, 7 * sm * width / 1080):.2f}:sigmaR={0.03 + 0.07 * sm:.3f}," if sm > 0.01 else ""
    return (f"{smooth}eq=brightness={g.get('brightness', 0.0)}:contrast={g.get('contrast', 1.05)}:saturation={g.get('saturation', 1.08)},"
            f"colorbalance=rs={g.get('warm', 0.06)}:gs={g.get('warm', 0.06) / 3}:bs={-g.get('warm', 0.06)}:"
            f"rm={g.get('warm', 0.06)}:bm={-g.get('warm', 0.06)}")


def look_matrix(lk):
    """episode.json "look": {warm, brightness, saturation, smooth} -> a 3x3 colour matrix (rows R, G, B).
    The editor builds the very same matrix (render/ui/editor.tsx lookMatrix) for its live SVG filter."""
    w, b, s = float(lk.get("warm", 0)), float(lk.get("brightness", 0)), float(lk.get("saturation", 1))
    L = (0.2126, 0.7152, 0.0722)
    sat = [[(1 - s) * L[j] + (s if i == j else 0) for j in range(3)] for i in range(3)]
    gains = (1 + w, 1 + w / 3, 1 - w)
    return [[(1 + b) * gains[i] * sat[i][j] for j in range(3)] for i in range(3)]


def look_soft(lk):
    """Skin smoothing as a soft focus: a gaussian blur (sigma px at the picture's size) mixed in at `mix`."""
    sm = float(lk.get("smooth", 0))
    return 4.0 * sm, 0.65 * sm


def person_chain(ls, pw, ph, src="[0:v]", out="[p]"):
    """His picture, scaled and graded, up to the mask: the live look ("look") or the baked one ("grade")."""
    lk = ls.cfg.get("look")
    if not lk:
        return f"{src}scale={pw}:{ph},{grade(ls, pw)},format=yuva420p{out}"
    m = look_matrix(lk)
    mix = "colorchannelmixer=" + ":".join(f"{c}{d}={m[i][j]:.5f}" for i, c in enumerate("rgb") for j, d in enumerate("rgb"))
    sigma, amt = look_soft(lk)
    if amt < 0.01:
        return f"{src}scale={pw}:{ph},format=gbrp,{mix},format=yuva420p{out}"
    return (f"{src}scale={pw}:{ph},format=gbrp,{mix},split[lka][lkb];[lkb]gblur=sigma={sigma:.3f}[lkbb];"
            f"[lka][lkbb]blend=all_mode=normal:all_opacity={1 - amt:.4f},format=yuva420p{out}")


def gaze_sig(ls):
    import hashlib
    e = dict(eye_cfg(ls) or {})
    e.pop("on", None)  # switching it on / off must not redo the corrected copy
    e["v"] = 3  # 3: the source's own colour format kept (full range)
    return hashlib.md5(json.dumps(e, sort_keys=True).encode()).hexdigest()[:8]


def piece(ls, it, out_v, out_m, gaze=False):
    """One cut piece of the person layer: his own video and his mask, frame for frame - no background,
    no position, no text. Those are layers too, put together in one pass at the end."""
    take = os.path.join(ls.cfg["input_dir"], it["take"] + os.path.splitext(ls.takes[0])[1])
    if gaze:
        take = ls.work("gaze", f"{it['take']}.{gaze_sig(ls)}.mp4")  # the eye-contact copy (same frames, same timing)
    mk = matte_path(ls, it["take"])
    enc = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "15", "-g", "30", "-pix_fmt", "yuv420p", "-an"]
    n = it["n"]
    if it["kind"] == "clip":
        t = it["a"]
        ff("-ss", f"{t:.3f}", "-i", take, "-vf", f"fps={FPS},scale={MATTE_W * 2}:{MATTE_H * 2}", "-frames:v", str(n), *enc, out_v)
    elif (it.get("insert") or {}).get("hide"):  # an opening / a cutaway: he is not in the picture at all
        ff("-ss", f"{it['t']:.3f}", "-i", take, "-vf", f"fps={FPS},scale={MATTE_W * 2}:{MATTE_H * 2},loop=loop={n}:size=1:start=0",
           "-frames:v", str(n), *enc, out_v)
        ff("-f", "lavfi", "-i", f"color=c=black:s={MATTE_W * 2}x{MATTE_H * 2}:r={FPS}", "-vf", "format=gray", "-frames:v", str(n), *enc, out_m)
    elif (it.get("insert") or {}).get("footage"):  # the other side talks over live footage of him listening (no freeze)
        fo = it["insert"]["footage"]
        src = os.path.join(ls.cfg["input_dir"], fo["take"] + os.path.splitext(ls.takes[0])[1])
        if gaze:
            src = ls.work("gaze", f"{fo['take']}.{gaze_sig(ls)}.mp4")
        ff("-ss", f"{fo['from']:.3f}", "-i", src, "-vf", f"fps={FPS},scale={MATTE_W * 2}:{MATTE_H * 2}", "-frames:v", str(n), *enc, out_v)
        mask_piece(ls, fo["take"], fo["from"], n, enc, out_m)
        return
    else:  # hold on him (the other side talks): a frozen frame
        ff("-ss", f"{it['t']:.3f}", "-i", take, "-vf", f"fps={FPS},scale={MATTE_W * 2}:{MATTE_H * 2},loop=loop={n}:size=1:start=0",
           "-frames:v", str(n), *enc, out_v)
        mask_piece(ls, it["take"], it["t"], n, enc, out_m, freeze=True)
        return
    if it["kind"] == "clip":
        mask_piece(ls, it["take"], it["a"], n, enc, out_m)


def mask_piece(ls, take, t, n, enc, out_m, freeze=False):
    """His mask for a piece, with the desk's still mask (keep_png) added - the real desk stays in front of the set."""
    if ls.cfg.get("cutout") is False:  # the whole frame is the person layer
        ff("-f", "lavfi", "-i", f"color=c=white:s={MATTE_W * 2}x{MATTE_H * 2}:r={FPS}", "-vf", "format=gray", "-frames:v", str(n), *enc, out_m)
        return
    mk = matte_path(ls, take)
    vf = f"fps={FPS},scale={MATTE_W * 2}:{MATTE_H * 2},format=gray" + (f",loop=loop={n}:size=1:start=0" if freeze else "")
    keep = keep_png(ls, take)
    if not keep:
        ff("-ss", f"{t:.3f}", "-i", mk, "-vf", vf, "-frames:v", str(n), *enc, out_m)
        return
    ff("-ss", f"{t:.3f}", "-i", mk, "-loop", "1", "-i", keep, "-filter_complex",
       f"[0:v]{vf}[a];[1:v]scale={MATTE_W * 2}:{MATTE_H * 2},format=gray[k];[a][k]blend=all_mode=lighten,format=gray",
       "-frames:v", str(n), *enc, out_m)


def piece_atomic(ls, it, out_v, out_m, gaze=False):
    pv, pm = out_v[:-4] + ".part.mp4", out_m[:-4] + ".part.mp4"  # a stopped run never leaves a half piece
    piece(ls, it, pv, pm, gaze)
    os.replace(pv, out_v)
    os.replace(pm, out_m)


# ---- 5. sound --------------------------------------------------------------------------------------
# how a voice sounds coming out of a device in the room (insert / sound "filter": "phone" | "speaker")
SOUND_FILTERS = {
    "phone": "highpass=f=380,lowpass=f=3000,acompressor",
    # an inner voice, as films do it: very close, a little warmth, a soft short echo around it, even level
    "thought": ("highpass=f=95,lowpass=f=9000,equalizer=f=220:t=q:w=1:g=2,equalizer=f=3000:t=q:w=1.2:g=1.5,"
                "acompressor=threshold=-22dB:ratio=3:attack=5:release=80,aecho=0.85:0.6:38|77|121:0.24|0.14|0.08,"
                "loudnorm=I=-16:TP=-2:LRA=9"),  # every thought at one level, however it was recorded
    # a laptop's small speakers: no lows, a boxy mid bump, a little crunch, then his room around it
    "speaker": ("highpass=f=330,highpass=f=330,lowpass=f=7000,equalizer=f=1200:t=q:w=1.1:g=5,equalizer=f=3200:t=q:w=1.4:g=3,"
                "equalizer=f=500:t=q:w=1:g=-3,acompressor=threshold=-22dB:ratio=5:attack=4:release=60,"
                "asoftclip=type=tanh:threshold=0.85,aecho=0.85:0.5:17|29:0.16|0.09"),
}


def load_sound(path, phone=False, pitch=1.0):
    filt = phone if isinstance(phone, str) else ("phone" if phone else None)
    tmp = path + (f".{filt}" if filt else "") + (f".p{pitch}" if pitch != 1 else "") + ".wav"
    if not os.path.exists(tmp):
        af = SOUND_FILTERS[filt] if filt else "anull"
        if pitch != 1:
            af = f"asetrate={int(SR * pitch)},aresample={SR}," + af
        ff("-i", path, "-ac", "1", "-ar", str(SR), "-af", af, tmp)
    return read_wav(tmp)[0]


# the voice filters, presets and loudness live in render/ui/sound.ts - one chain for the editor and the export
DENOISE = "afftdn=nf=-28:tn=1"


def denoise_filter(ls):
    """The noise reduction for this episode: the default, or stronger (episode.json "denoise": {"nr": 24, "nf": -30})."""
    d = ls.cfg.get("denoise")
    if not d:
        return DENOISE
    if d.get("rnn"):  # RNNoise, trained on speech: takes out steady noise (an air conditioner, a fan) the FFT one leaves
        return f"arnndn=m={d['rnn']}"
    return f"afftdn=nr={float(d.get('nr', 12)):.0f}:nf={float(d.get('nf', -28)):.0f}:tn=1"


def take_audio(ls, take, denoise=False):
    """His raw voice for a take, or the same through noise reduction (both are offered to the editor)."""
    raw = ls.work("audio", take + ".wav")
    if not denoise:
        return raw
    import hashlib
    sig = "" if denoise_filter(ls) == DENOISE else "." + hashlib.md5(denoise_filter(ls).encode()).hexdigest()[:6]
    out = ls.work("audio", f"{take}.dn{sig}.wav")
    if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(raw):
        ff("-i", raw, "-af", denoise_filter(ls), "-ar", str(SR), "-ac", "1", out)
    return out


def write_wav(path, x):
    import wave
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
    return path


def voice_stem(ls, items, total, denoise=False):
    """His voice alone along the cut (joins crossfaded) - raw or noise-reduced."""
    out = np.zeros(int(total / FPS * SR) + SR, np.float32)
    takes = {}
    fade = int(0.012 * SR)
    for it in items:
        if it["kind"] != "clip":
            continue
        o = int(it["out"] / FPS * SR)
        n = int(it.get("an", it["n"]) / FPS * SR)
        x = takes.setdefault(it["take"], read_wav(take_audio(ls, it["take"], denoise))[0])
        a = int(it["a"] * SR)
        seg = x[a:a + n].copy()
        seg[:fade] *= np.linspace(0, 1, min(fade, len(seg)))[:len(seg[:fade])]
        tail = int((it["an"] - it["n"]) / FPS * SR) if "an" in it else fade  # crossfade under the next part
        tail = max(fade, min(tail, len(seg)))
        seg[-tail:] *= np.linspace(1, 0, tail)
        out[o:o + len(seg)] += seg
    return out[:int(total / FPS * SR)]


def stems(ls, items, total):
    """The sound as separate tracks, so the editor can change voice filters and music volume live:
    voice (raw and noise-reduced), effects (phone, the other side of a call), music (at full level)."""
    voice = voice_stem(ls, items, total)
    voice_dn = voice_stem(ls, items, total, denoise=True)
    ducks = [(pl, s["duck"]) for i, (s, pl) in enumerate((s, placed_sounds(ls, items).get(i)) for i, s in enumerate(ls.cfg.get("sounds", [])))
             if s.get("duck") and pl]
    if ducks:  # films lower the room while we hear a thought
        g = np.ones(len(voice), np.float32)
        r = int(0.08 * SR)
        for (a, b), db in ducks:
            i0, i1 = max(0, int(a * SR) - r), min(len(g), int(b * SR) + r)
            env = np.ones(i1 - i0, np.float32) * (10 ** (db / 20))
            env[:r] = np.linspace(1, env[r] if len(env) > r else 1, min(r, len(env)))
            env[-r:] = np.linspace(env[-r - 1] if len(env) > r else 1, 1, min(r, len(env)))
            g[i0:i1] = np.minimum(g[i0:i1], env)
        voice, voice_dn = voice * g, voice_dn * g[:len(voice_dn)]
    fx, music = fx_and_music(ls, items, total)
    return {"voice": write_wav(ls.work("stems", "voice.wav"), voice), "voice_dn": write_wav(ls.work("stems", "voice_dn.wav"), voice_dn),
            "fx": write_wav(ls.work("stems", "fx.wav"), fx), "music": write_wav(ls.work("stems", "music.wav"), music)}


def mix(ls, items, total):
    """The export's sound, made by the editor's own audio code (render/ui/sound.ts run in headless Chrome by
    tools/mixdown.mjs): voice through the chosen filters + effects + music + the loudness step - identical to the editor."""
    st = stems(ls, items, total)
    job = ls.work("mixdown.json")
    final = ls.work("mix.wav")
    save_json(job, {"stems": st, "seconds": total / FPS, "voice": ls.cfg.get("voice"), "music": ls.cfg.get("music"), "out": final})
    r = subprocess.run(["node", os.path.join(ROOT, "tools", "mixdown.mjs"), job], capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        raise SystemExit(f"mixdown failed:\n{r.stdout}\n{r.stderr}")
    log("  · " + r.stdout.strip().splitlines()[-1])
    return final


PLACED = ("end_word", "start_word", "at", "after_prev")


def placed_sounds(ls, items):
    """{index in "sounds": (start, end) in seconds of the video} for every sound placed on the cut, in order
    (a thought "after_prev" follows the one before it)."""
    out, prev = {}, None
    for i, s in enumerate(ls.cfg.get("sounds", [])):
        if any(k in s for k in PLACED):
            out[i] = sound_place(ls, items, s, prev)
            prev = out[i][1]
    return out


def sound_place(ls, items, s, prev_end=None):
    """A sound that ends where he reacts: {"take", "end_word", "end_after" (seconds in his take, to find the right one),
    "end_offset", "from"/"to" (the part of the sound file)} -> (start, end) in seconds of the video."""
    dur = (s["to"] if s.get("to") is not None else len(load_sound(ls.asset(s["sound"]), s.get("filter"))) / SR) - s.get("from", 0.0)
    if "after_prev" in s:  # a gap (seconds) after the previous placed sound ends
        o = (prev_end or 0.0) + float(s["after_prev"])
        return o, o + dur
    if "at" in s:  # a moment of the take (seconds)
        o = out_time(items, s.get("take") or name(ls.takes[0]), float(s["at"]))
        if o is None:
            raise SystemExit(f"sound {s} could not be placed")
        return o, o + dur
    words = load_json(ls.work("words", s["take"] + ".json"), [])
    end = "end_word" in s
    key = "end" if end else "start"
    t = word_time(words, s[key + "_word"], s.get(key + "_edge", "start"), s.get(key + "_after", 0.0)) + s.get(key + "_offset", 0.0)
    o = out_time(items, s["take"], t)
    if o is None:
        raise SystemExit(f"sound {s} could not be placed")
    return (o - dur, o) if end else (o, o + dur)


def fx_and_music(ls, items, total):
    out = np.zeros(int(total / FPS * SR) + SR, np.float32)
    for it in items:
        o = int(it["out"] / FPS * SR)
        n = int(it.get("an", it["n"]) / FPS * SR)
        if it["kind"] == "clip":
            continue
        if it["insert"].get("sound"):  # (a hold can be for the picture only: a chime, a look)
            ins = it["insert"]
            snd = load_sound(ls.asset(ins["sound"]), ins.get("filter") or ins.get("phone"))
            lead = int(ins.get("lead", 0) * SR)
            start = int(ins.get("from", 0) * SR)
            tail = int(ins.get("tail", 0) * SR)  # e.g. the opening theme carrying on under his first words
            seg = snd[start:start + n + lead + tail].copy() * ins.get("gain", 0.55 if ins.get("phone") else 0.8)
            f2, fo = int(0.08 * SR), int(ins.get("fade_out", 0.08) * SR)
            seg[:f2] *= np.linspace(0, 1, len(seg[:f2]))
            seg[-fo:] *= np.linspace(1, 0, len(seg[-fo:]))
            o0 = max(0, o - lead)
            out[o0:o0 + len(seg)] += seg
        if it["insert"].get("chime"):
            ch = it["insert"]["chime"]
            cs = load_sound(ls.asset(ch["sound"])) * ch.get("gain", 0.7)
            a = o + int(ch.get("at", 0) * SR)
            out[a:a + len(cs)] += cs[:max(0, len(out) - a)]
    # an opening sound from the very first frame ("intro_sound": {sound, from, seconds, gain, fade_out}): the theme
    # under the opening video and his first words - no pause is opened for it
    isd = ls.cfg.get("intro_sound")
    if isd:
        snd = load_sound(ls.asset(isd["sound"]))
        a0 = int(isd.get("from", 0) * SR)
        seg = snd[a0:a0 + int(isd.get("seconds", 4) * SR)].copy() * isd.get("gain", 0.8)
        fo = int(isd.get("fade_out", 1.5) * SR)
        seg[-fo:] *= np.linspace(1, 0, len(seg[-fo:]))
        out[:len(seg)] += seg[: len(out)]
    # sounds that run under him while he keeps talking (episode.json "sounds"): a phone ringing until he
    # answers, the wife mumbling through the phone for the whole call - nothing waits for them
    pl = placed_sounds(ls, items)
    for si, snd_cfg in enumerate(ls.cfg.get("sounds", [])):
        if si in pl:
            o0, o1 = pl[si]
            if snd_cfg.get("chime"):  # an effect with it (a whoosh / pop as a thought bubble appears)
                ch = snd_cfg["chime"]
                cs = load_sound(ls.asset(ch["sound"])) * ch.get("gain", 0.6)
                ca = max(0, int((o0 + ch.get("at", 0.0)) * SR))
                out[ca:ca + len(cs)] += cs[:max(0, len(out) - ca)]
            snd = load_sound(ls.asset(snd_cfg["sound"]), snd_cfg.get("filter") or snd_cfg.get("phone"))
            a0 = int(snd_cfg.get("from", 0) * SR)
            seg = snd[a0:a0 + int((o1 - o0) * SR)].copy() * snd_cfg.get("gain", 0.8)
            fi, fo = int(snd_cfg.get("fade_in", 0.02) * SR), int(snd_cfg.get("fade_out", 0.06) * SR)
            seg[:fi] *= np.linspace(0, 1, len(seg[:fi]))
            seg[-fo:] *= np.linspace(1, 0, len(seg[-fo:]))
            a = int(o0 * SR)
            if a < 0:
                seg, a = seg[-a:], 0
            out[a:a + len(seg)] += seg[:max(0, len(out) - a)]
            ls.placed = getattr(ls, "placed", []) + [{"name": os.path.basename(snd_cfg["sound"]).rsplit(".", 1)[0],
                                                      "from": round(o0, 3), "to": round(o1, 3)}]
            continue
        words = load_json(ls.work("words", snd_cfg["take"] + ".json"), [])
        t0 = word_time(words, snd_cfg["from_word"], snd_cfg.get("from_edge", "start"), 0.0) + snd_cfg.get("from_offset", 0.0)
        t1 = word_time(words, snd_cfg["to_word"], snd_cfg.get("to_edge", "start"), max(0.0, t0)) + snd_cfg.get("to_offset", 0.0)
        o0 = out_time(items, snd_cfg["take"], t0)
        o1 = out_time(items, snd_cfg["take"], t1)
        if o0 is None or o1 is None or o1 <= o0:
            raise SystemExit(f"sound {snd_cfg} could not be placed")
        n = int((o1 - o0) * SR)
        snd = load_sound(ls.asset(snd_cfg["sound"]), snd_cfg.get("filter") or snd_cfg.get("phone"), snd_cfg.get("pitch", 1.0))
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
    n = int(total / FPS * SR)
    music = np.zeros(n, np.float32)
    mus = ls.cfg.get("music")
    if mus:  # a bed under him for the whole video (a short loop repeats seamlessly); its volume is set later
        bed = load_sound(ls.asset(mus["sound"]))
        music = np.tile(bed, n // max(1, len(bed)) + 1)[:n].copy()
        f_in, f_out = int(mus.get("fade_in", 1.5) * SR), int(mus.get("fade_out", 2.5) * SR)
        music[:f_in] *= np.linspace(0, 1, len(music[:f_in]))
        music[-f_out:] *= np.linspace(1, 0, len(music[-f_out:]))
    return out[:n], music


# ---- 6. assemble -----------------------------------------------------------------------------------
def build(ls, still_at=None, preview=False):
    log(f"▶ {ls.slug} — {len(ls.takes)} takes")
    prepare(ls)
    items, total = plan(ls)
    log(f"  · cut: {sum(1 for i in items if i['kind'] == 'clip')} pieces, {total / FPS:.1f}s "
        f"(raw {sum(len(read_wav(ls.work('audio16', name(t) + '.wav'))[0]) / 16000 for t in ls.takes):.1f}s)")
    sync_captions(ls)
    time_overlays(ls, items, total)
    caps = captions(ls, items, total)
    # keep what the editor needs from the last preview (photo size, sounds) - a still or an export must not wipe it
    prev_edit = load_json(ls.work("edit.json"), {}) or {}
    save_json(ls.work("edit.json"), {**{k: prev_edit[k] for k in ("photo", "sounds", "speed") if k in prev_edit},
                                     "items": items, "total": total, "captions": caps})
    bg = text_layers(ls, caps)
    if still_at is not None:
        person, mask = person_layer(ls, items, gaze=eye_on(ls))
        audio = mix(ls, items, total)
        out = compose(ls, items, total, caps, bg, person, mask, audio, False, still_frame=int(still_at * FPS))
        log(f"✔ still → {out}")
        return
    if preview:
        eyes = eye_cfg(ls) is not None
        person, mask = person_layer(ls, items, gaze=eyes)
        person_preview(ls, person, mask, "person.webm")
        if eyes:  # the original too: the editor's Eye contact switch flips between them live
            raw_p, raw_m = person_layer(ls, items, gaze=False)
            person_preview(ls, raw_p, raw_m, "person_raw.webm")
        st = stems(ls, items, total)
        import shutil
        for k, path in st.items():  # the editor plays these together and filters the voice live - the very files the export mixes
            shutil.copyfile(path, ls.work("public", f"{k}.wav"))
        if ls.cfg.get("intro_video"):  # the opening video, for the editor (the export reads the original)
            ff("-ss", str(ls.cfg["intro_video"].get("from", 0)), "-i", ls.asset(ls.cfg["intro_video"]["file"]), "-t", str(ls.cfg["intro_video"].get("seconds", 5)), "-an",
               "-vf", "scale=540:960:force_original_aspect_ratio=increase,crop=540:960", "-c:v", "libx264", "-crf", "23",
               "-pix_fmt", "yuv420p", ls.work("public", "intro.mp4"))
        import cv2
        ph_, pw_ = cv2.imread(ls.asset(ls.cfg["background"])).shape[:2]
        save_json(ls.work("edit.json"), {"items": items, "total": total, "captions": caps, "speed": 1.0, "photo": [pw_, ph_],
                                         "sounds": getattr(ls, "placed", [])})
        log(f"✔ layers ready ({total / FPS:.1f}s) — the editor puts them together live")
        return
    person, mask = person_layer(ls, items, gaze=eye_on(ls))
    audio = mix(ls, items, total)
    compose(ls, items, total, caps, bg, person, mask, audio, preview)


def eye_cfg(ls):
    """episode.json "eye_contact": {mode, strength, dy, nudge, on} - present = both versions are prepared."""
    return ls.cfg.get("eye_contact") or None


def eye_on(ls):
    e = eye_cfg(ls)
    return bool(e) and e.get("on", True)


def person_preview(ls, person, mask, name="person.webm"):
    """The person layer for the editor: his video with its mask as transparency (VP9 alpha) and the sound.
    Background, size, position, subtitles and text are stacked on it live; Export uses the same numbers."""
    import hashlib
    sig = hashlib.md5("|".join([str(os.path.getmtime(x)) for x in (person, mask)] + ["live" if ls.cfg.get("look") else grade(ls), str(ls.cfg.get("matte_cut", 175))]).encode()).hexdigest()[:12]
    out, stamp = ls.work("public", name), ls.work("public", name + ".stamp")
    if os.path.exists(out) and os.path.exists(stamp) and open(stamp).read() == sig:
        return out
    cut = ls.cfg.get("matte_cut", 175)
    ff("-i", person, "-i", mask, "-filter_complex",
       f"[1:v]lutyuv=y='clip((val-{cut})*255/{255 - cut},0,255)',scale=540:960:flags=bicubic,gblur=sigma=0.7,format=gray[m];"
       f"[0:v]scale=540:960,{'null' if ls.cfg.get('look') else grade(ls, 540)},format=yuva420p[p];[p][m]alphamerge[v]",
       "-map", "[v]", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-deadline", "realtime", "-cpu-used", "8",
       "-row-mt", "1", "-b:v", "2500k", "-auto-alt-ref", "0", "-an", out)
    open(stamp, "w").write(sig)
    return out


def person_layer(ls, items, gaze=False):
    """The person layer for the whole video: cut pieces (cached by their cut and source), joined."""
    import hashlib
    tag = ("gaze-" + gaze_sig(ls)) if gaze else "orig"
    vids, masks, todo = [], [], []
    for it in items:
        # the eye-contact copy can be redone (NVIDIA retried after a v6 fallback): its time is part of the key
        gz = ls.work("gaze", f"{it.get('take')}.{gaze_sig(ls)}.mp4") if gaze and it.get("take") else None
        src_v = int(os.path.getmtime(gz)) if gz and os.path.exists(gz) else 0
        key = hashlib.md5(json.dumps({**{k: it[k] for k in ("kind", "take", "a", "t", "n") if k in it}, "src": tag, "src_v": src_v,
                                      "hide": bool((it.get("insert") or {}).get("hide")),
                                      "footage": (it.get("insert") or {}).get("footage"),
                                      "keep": keep_cfg(ls, ((it.get("insert") or {}).get("footage") or {}).get("take") or it.get("take")),
                                      "matte": ls.cfg.get("matte_engine", "fast") if ls.cfg.get("cutout") is not False else "none"},
                                     sort_keys=True).encode()).hexdigest()[:16]
        v, m = ls.work("pieces", f"{key}.v.mp4"), ls.work("pieces", f"{key}.m.mp4")
        vids.append(v)
        masks.append(m)
        if not (os.path.exists(v) and os.path.exists(m)):
            todo.append((it, v, m, gaze))
    if todo:
        log(f"  · cutting {len(todo)} new pieces of {len(items)}")
        with ThreadPoolExecutor(max_workers=6) as pool:
            for fu in [pool.submit(piece_atomic, ls, *x) for x in todo]:
                fu.result()
    out = []
    for name_, files in ((f"person.{tag}", vids), (f"mask.{tag}", masks)):
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
    over = [c for c in caps if c.get("over")]  # the other side, said over him: a second subtitle stream
    caps = [c for c in caps if not c.get("over")]
    cl2 = ls.work("text", "captions_over.txt")
    with open(cl2, "w", encoding="utf-8") as fh:
        t = 0
        for c in over:
            if c["from"] > t:
                fh.write(f"file '{blank.replace(os.sep, '/')}'\nduration {(c['from'] - t) / FPS:.4f}\n")
            fh.write(f"file '{c['png'].replace(os.sep, '/')}'\nduration {(c['to'] - c['from']) / FPS:.4f}\n")
            t = c["to"]
        fh.write(f"file '{blank.replace(os.sep, '/')}'\nduration {max(0.1, (total - t) / FPS):.4f}\n")
        fh.write(f"file '{blank.replace(os.sep, '/')}'\n")
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
        if o.get("anim"):  # an animated thought: its clip starts at its moment
            inputs += ["-itsoffset", f"{float(o['start']):.3f}", "-i", o["anim"]]
        else:
            inputs += ["-loop", "1", "-i", o["png"]]
    ov_in = None
    if over:
        ov_in = first_ov + len(ovs)
        inputs += ["-f", "concat", "-safe", "0", "-i", cl2]
    iv = ls.cfg.get("intro_video")
    iv_in = None
    if iv:
        iv_in = first_ov + len(ovs) + (1 if over else 0)
        inputs += ["-ss", f"{float(iv.get('from', 0)):.3f}", "-t", f"{float(iv.get('seconds', 5)):.3f}", "-i", ls.asset(iv["file"])]
    fc = (matte_filter(ls, pw, ph, 5 if ramp else None) + ";"
          + person_chain(ls, pw, ph) + ";[p][m]alphamerge[fg];"
          + "".join(f"[{first_ov + k}:v]scale={w}:{h}[ob{k}];" for k, o in enumerate(ovs) if o.get("behind")) +
          f"[2:v]scale={w}:{h}[b]" +
          "".join(f";[b][ob{k}]overlay=enable='between(t,{float(o.get('start') or 0):.3f},{float(o.get('end') or total / FPS):.3f})'[b]"
                  for k, o in enumerate(ovs) if o.get("behind")) +
          f";[b][fg]overlay={x}:{y}:shortest=1:format=auto[s];"
          f"[3:v]fps={FPS},scale={w}:{h},format=rgba[c];[s][c]overlay=eof_action=pass[v0]")
    if ov_in is not None:
        fc += f";[{ov_in}:v]fps={FPS},scale={w}:{h},format=rgba[c2];[v0][c2]overlay=eof_action=pass[v0b]"
    last = "v0b" if ov_in is not None else "v0"
    if iv_in is not None:
        ivs, ivf = float(iv.get("seconds", 5)), float(iv.get("fade", 0))
        fade = f",format=yuva420p,fade=t=out:st={max(0.0, ivs - ivf):.3f}:d={ivf:.3f}:alpha=1" if ivf > 0 else ""
        fc += (f";[{iv_in}:v]fps={FPS},scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setpts=PTS-STARTPTS{fade}[iv]"
               f";[{last}][iv]overlay=eof_action=pass[vi]")
        last = "vi"
    for k, o in enumerate(ovs):
        a, b = float(o.get("start") or 0), float(o.get("end") or total / FPS)
        if o.get("behind"):  # already on the set, under him
            continue
        if o.get("style") == "ticker":
            # a ticker: a band across the frame, the strip scrolling through it in the direction Hebrew reads (to the
            # right), looping - the same formula as the editor's live preview
            import cv2
            sh_, sw_ = cv2.imread(o["png"], cv2.IMREAD_UNCHANGED).shape[:2]
            tw, th, ty = int(sw_ * f), int(sh_ * f), int((o.get("y") or 1560) * f)
            v = float(o.get("speed") or 120) * f
            band = f"black@{float(o.get('opacity') if o.get('opacity') is not None else 0.55):.2f}"
            fc += (f";[{last}]drawbox=x=0:y={ty - int(10 * f)}:w=iw:h={th + int(20 * f)}:color={band}:t=fill:enable='between(t,{a:.3f},{b:.3f})'[d{k}]"
                   f";[{first_ov + k}:v]scale={tw}:{th}[o{k}];[d{k}][o{k}]overlay=x='mod({v:.2f}*t,{w}+{tw})-{tw}':y={ty}:enable='between(t,{a:.3f},{b:.3f})'[v{k + 1}]")
        elif o.get("anim"):
            fc += (f";[{first_ov + k}:v]format=rgba,scale={w}:-2[o{k}];"
                   f"[{last}][o{k}]overlay=x=0:y={int(o['anim_y'] * f)}:eof_action=pass:enable='between(t,{a:.3f},{b:.3f})'[v{k + 1}]")
        else:
            fc += f";[{first_ov + k}:v]scale={w}:{h}[o{k}];[{last}][o{k}]overlay=enable='between(t,{a:.3f},{b:.3f})'[v{k + 1}]"
        last = f"v{k + 1}"
    fc += f";[{last}]setpts=PTS/{spd},fps={FPS},format=yuv420p[v];[4:a]atempo={spd}[a]"
    if still_frame is not None:
        out = ls.work("still.png")
        fc_still = fc.replace(f";[4:a]atempo={spd}[a]", "")  # a frame needs no sound
        ff(*inputs, "-filter_complex", fc_still, "-map", "[v]", "-ss", f"{still_frame / FPS:.3f}", "-frames:v", "1", out)
        return out
    if preview:
        out, enc = ls.work("public", "preview.mp4"), ["-preset", "veryfast", "-crf", "26"]
    else:
        out, enc = ls.p("out", ls.slug + ".mp4"), ["-preset", "medium", "-crf", "19"]
    os.makedirs(os.path.dirname(out), exist_ok=True)
    ff_progress(frames, *inputs, "-filter_complex", fc, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", *enc, "-c:a", "aac", "-b:a", "192k",
                "-frames:v", str(frames), "-movflags", "+faststart", out)
    if preview:  # (an export leaves the editor's layer info - photo size, sounds - as it is)
        save_json(ls.work("edit.json"), {"items": items, "total": total, "captions": caps, "speed": spd})
    log(f"✔ {out}  ({frames / FPS:.1f}s{f', x{spd}' if spd != 1 else ''})")


def new_from(dst, src_slug, input_dir, script=None, takes=None):
    """episodes/<new> with every setting of an earlier episode of the series (background, music, voice, eye
    contact, grade, layout, subtitle style, speed) - only the takes and the subtitle text are new."""
    src = os.path.join(os.path.dirname(os.path.abspath(dst)), src_slug)
    cfg = load_json(os.path.join(src, "episode.json"))
    cfg["input_dir"] = input_dir.replace("\\", "/")
    cfg["takes"] = takes or "IMG_*.MP4"  # the new video's files, not the old episode's
    if cfg.get("eye_contact"):  # eye contact stays on - by the default (NVIDIA), never an old take's CapCut file or mode
        cfg["eye_contact"] = {"on": cfg["eye_contact"].get("on", True)}
    os.makedirs(dst, exist_ok=True)
    save_json(os.path.join(dst, "episode.json"), cfg)
    takes = sorted(glob.glob(os.path.join(input_dir, cfg.get("takes", "*.MP4"))))
    text = ""
    if script:  # a Reader script (zoomcut/scripts/<id>.txt): its lines become the subtitles
        lines = open(os.path.join(ROOT, "scripts", script + ".txt"), encoding="utf-8").read().splitlines()
        text = " ".join(l.strip() for l in lines if l.strip() and not l.startswith("#"))
    with open(os.path.join(dst, "captions.txt"), "w", encoding="utf-8") as fh:
        fh.write("# Subtitles, one block per take (in order). Timing is aligned to the audio automatically.\n")
        for i, t in enumerate(takes):
            fh.write(f"== {name(t)}\n{text if i == 0 else ''}\n")
    print(f"✔ {dst}: {len(takes)} takes, settings from {src_slug}" + (f", subtitles from {script}" if script else " - put the text in captions.txt"))


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "new":  # lesson.py new episodes/tadar-2 --from tadar-1 --input <folder> [--script <id>]
        nap = argparse.ArgumentParser()
        nap.add_argument("cmd")
        nap.add_argument("episode")
        nap.add_argument("--from", dest="src", required=True)
        nap.add_argument("--input", required=True)
        nap.add_argument("--script")
        nap.add_argument("--takes", help="which files in the folder, e.g. IMG_9980.MP4 (default: all IMG_*.MP4)")
        n = nap.parse_args()
        sys.stdout.reconfigure(encoding="utf-8")
        new_from(n.episode, n.src, n.input, n.script, n.takes)
        sys.exit(0)
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--still", type=float)
    ap.add_argument("--preview", action="store_true", help="quick 540p copy for the editor instead of the final export")
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    build(Lesson(a.episode), a.still, a.preview)
