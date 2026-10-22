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
from pipeline.film_fx import FxFrame as _FxFrame
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
            segs, _ = model.transcribe(x, language=ls.cfg.get("language", "he"), word_timestamps=True, vad_filter=True, beam_size=5)  # "language": "en" - he speaks English
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
        if not os.path.exists(mk) and ls.cfg.get("matte_engine") in ("hybrid", "body"):
            hybrid_matte(ls, t, n, ls.cfg["matte_engine"])
            log(f"  · cut out {n} ({'hybrid: quality + the head kept' if ls.cfg['matte_engine'] == 'hybrid' else 'body: quality head, fast below the chin'})")
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


def hybrid_matte(ls, t, n, mode="hybrid"):
    """The quality cut-out everywhere, and around the head the fast one too: a white wig against a white wall
    can make the quality model drop the whole head for a moment; the fast model knows a head is a head.
    mode "body" - the other way round: the quality one for the head and hair (clean edge, nothing of the room kept
    above the wig), the fast one too below the chin, where the quality model drops hands and a phone held up."""
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
        if mode == "body":
            mf = np.frombuffer(b, np.uint8).reshape(MATTE_H, MATTE_W)
            chin = int(min(1, box[3] + 0.05 * (box[3] - box[1])) * MATTE_H) if box else int(0.45 * MATTE_H)
            mq[chin:] = np.maximum(mq[chin:], mf[chin:])
            box = None
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
    os.replace(out, ls.work("matte", n + f".{mode}.mkv"))


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
    return w.lower().translate(str.maketrans("ךםןףץ", "כמנפצ"))


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
    # clicks, mic bumps - but a short burst running straight into speech is its first consonant ("כ" of "כי")
    out = [s for i, s in enumerate(out) if s[1] - s[0] >= 0.12 or (i + 1 < len(out) and out[i + 1][0] - s[1] < 0.25)]
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


def take_len(it, an=False):
    """How much of his take a piece shows (seconds): its frames x its speed (a slow-motion piece shows less)."""
    return (it.get("an", it["n"]) if an else it["n"]) * it.get("sp", 1.0) / FPS


def speed_steps(ls, n, p, q):
    """The part [p, q] of a take as [(from, to, speed)]: episode.json cut "slow": {"<take>": [[from, to, speed], ...]}
    (take seconds; 0.5 = half speed; ranges may touch, e.g. 0.8 then 0.58), every change eased over cut "slow_ramp"
    seconds of the take in a few steps."""
    c = cut_cfg(ls)
    rngs = (c.get("slow") or {}).get(n, [])
    if not rngs:
        return [(p, q, 1.0)]
    ramp = float(c.get("slow_ramp", 0.4))

    def target(t):
        for a, b, f in rngs:
            if a <= t < b:
                return float(f)
        return 1.0

    def at(t):  # the speed eased across every change (1 -> slow, or one slow speed into another) over `ramp` seconds
        return sum(target(t + ramp * (j / 8 - 0.5)) for j in range(9)) / 9 if ramp > 0 else target(t)
    marks = {p, q}
    for a, b, _ in rngs:
        for e in (a, b):
            marks |= {e + ramp * (i / 4 - 0.5) for i in range(5)}
    marks = sorted(m for m in marks if p <= m <= q)
    out = []
    for a, b in zip(marks, marks[1:]):
        if b - a < 0.02:
            continue
        sp = round(at((a + b) / 2), 3)
        if out and out[-1][2] == sp:
            out[-1] = (out[-1][0], b, sp)
        else:
            out.append((a, b, sp))
    return out


def find_word(words, key, after, before=False):
    k = norm(key)
    for w in words:
        if w["s"] >= after - 0.01 and norm(w["w"]) == k:
            return (w["s"] - 0.08) if before else (w["e"] + 0.06)
    raise SystemExit(f"insert: word '{key}' not found after {after:.2f}s")


def segments(ls):
    """The edit order: episode.json "sequence": [{"take", "from"?, "to"?}, ...] - parts of takes in the order they are
    shown (a re-take of a passage placed in the middle of another take); without it, every take whole, in name order."""
    seq = ls.cfg.get("sequence")
    if not seq:
        return [(name(t), 0.0, 1e9) for t in ls.takes]
    return [(s["take"], float(s.get("from", 0.0)), float(s.get("to", 1e9))) for s in seq]


def plan(ls):
    """Timeline items in frames: {'kind': 'clip', take, a, n} | {'kind': 'hold', take, t, n, insert}."""
    items, out_f = [], 0
    for n, s0, s1 in segments(ls):
        words = load_json(ls.work("words", n + ".json"), [])
        sp = [[max(a, s0), min(b, s1)] for a, b in spans(ls, n) if b > s0 and a < s1]  # this segment's part of the take
        for was, now in (cut_cfg(ls).get("edges") or {}).get(n, []):  # an edge dragged past this part's own from / to
            for x in sp:
                for k_, lim in ((0, s0), (1, s1)):
                    if abs(x[k_] - lim) < 1e-6 and abs(was - lim) < 0.12:  # (never past the take's own end)
                        x[k_] = min(max(0.0, float(now)), len(read_wav(ls.work("audio16", n + ".wav"))[0]) / 16000 - 0.05)
        sp = [x for x in sp if x[1] - x[0] >= 0.05]
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
        def clip(p, q):  # a kept part of the take, in pieces of one speed each (slow motion: more frames than it shows)
            for a_, b_, s_ in speed_steps(ls, n, p, q):
                items.append({"kind": "clip", "take": n, "a": a_, "n": round((b_ - a_) / s_ * FPS), **({"sp": s_} if s_ != 1 else {})})
        for a, b in sp:
            inside = [(at, ins) for at, ins in cuts if a <= at <= b]
            pos = a
            for at, ins in inside:
                if at - pos > 0.05:
                    clip(pos, at)
                items.append({"kind": "hold", "take": n, "t": at, "n": round(ins["seconds"] * FPS), "insert": ins})
                pos = at
            if b - pos > 0.05:
                clip(pos, b)
        missed = [ins for at, ins in cuts if not any(a <= at <= b for a, b in sp) and s0 <= at <= s1]
        for ins in missed:
            raise SystemExit(f"insert {ins} falls in a cut pause")
    # the whole video's start / end, marked in the editor (cut "video_start" / "video_end": {take, t}) - every layer follows
    c = cut_cfg(ls)
    vs, ve = c.get("video_start"), c.get("video_end")
    if vs:
        k = next((i for i, it in enumerate(items) if it["kind"] == "clip" and it["take"] == vs["take"] and it["a"] <= vs["t"] < it["a"] + take_len(it)), None)
        if k is not None:
            it = items[k]
            cut_f = round((vs["t"] - it["a"]) / it.get("sp", 1.0) * FPS)
            items = [{**it, "a": vs["t"], "n": it["n"] - cut_f}] + items[k + 1:]
    if ve:
        k = next((i for i, it in enumerate(items) if it["kind"] == "clip" and it["take"] == ve["take"] and it["a"] < ve["t"] <= it["a"] + take_len(it) + 0.02), None)
        if k is not None:
            it = items[k]
            items = items[:k] + [{**it, "n": max(1, round((ve["t"] - it["a"]) / it.get("sp", 1.0) * FPS))}]
    # jump cuts: the picture cuts `join` early and the next part starts there, while the previous part's
    # sound runs on underneath for that moment (crossfaded) - no gap, the next word lands on the last one
    ov = round(cut_cfg(ls)["join"] * FPS)
    for prev, nxt in zip(items, items[1:]):
        follows = nxt.get("take") == prev.get("take") and abs(nxt.get("a", -9) - (prev.get("a", 0) + take_len(prev))) < 0.04
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
        a, b = it["a"], it["a"] + take_len(it)
        if a <= t <= b:
            return it["out"] + (t - a) / it.get("sp", 1.0) * FPS
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
    heard = [(n, w) for n, s0, s1 in segments(ls) for w in load_json(ls.work("words", n + ".json"), []) if s0 - 0.05 <= w["s"] < s1]
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
    import hashlib
    sig = hashlib.md5(json.dumps([segments(ls), [name(t) for t in ls.takes]]).encode()).hexdigest()[:10]  # the edit order
    body = open(cp, encoding="utf-8").read() if os.path.exists(cp) else ""
    has_words = any(l.strip() and not l.startswith(("#", "==")) for l in body.splitlines())
    if has_words and os.path.getmtime(cp) >= os.path.getmtime(sp) and f"order:{sig}" in body:
        return
    blocks = script_blocks(ls)
    with open(cp, "w", encoding="utf-8") as fh:
        fh.write(f"# Subtitles from scripts/{ls.cfg['script']}.txt (the script is the source: update it in the Reader; a line fixed here stays until the script changes) order:{sig}\n")
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
        words = load_json(ls.work("words", n + ".json"), [])
        # (a take with no block yet - a new project: the recogniser's own words, so there are subtitles from the first
        # Analyze; writing the take's block in captions.txt (corrected) replaces them)
        toks = blocks.get(n) or [w["w"] for w in words]
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
                kept = any(it["kind"] == "clip" and it["take"] == n and it["a"] - 0.35 <= times[chunk[0]][0] <= it["a"] + take_len(it, an=True) + 0.35
                           for it in items)
                if a is not None and kept:
                    caps.append({"from": int(a), "text": text, "take": n, "end_hint": to_out(items, n, times[chunk[-1]][1])})
                chunk = []
    other = []
    pl = placed_sounds(ls, items)
    for si, s in enumerate(ls.cfg.get("sounds", [])):
        if s.get("captions") and si in pl:
            rate = float(s.get("tempo", 1.0) or 1.0) * float(s.get("pitch", 1.0) or 1.0)  # file seconds -> video seconds
            o0, f0 = pl[si][0], s.get("from", 0.0)
            other += [{"from": int((o0 + (a - f0) / rate) * FPS), "to": int((o0 + (b - f0) / rate) * FPS), "text": tx, "who": "other", "over": True}
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


TEXT_STYLE = 3  # bump when lesson_text.mjs changes how captions look, so cached images are redrawn


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
            if nxt.get("style") == o.get("style") and not o.get("overlap"):  # ("overlap": it lingers on in its own spot)
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
                if h and to_out(items, tk, h[0]) is not None and any(it["kind"] == "clip" and it["take"] == tk and it["a"] <= h[0] <= it["a"] + take_len(it) for it in items):
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
        if o.get("to_words"):  # alternatives too: the first one heard after the start
            end = next(filter(None, (find_phrase(words, ph, hit[0], last=True) for ph in
                                     (o["to_words"] if isinstance(o["to_words"], list) else [o["to_words"]]))), None)
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
    out = [o for o in (ov or []) if ((o.get("text") or "").strip() or o.get("image") or o.get("video"))
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


def paint_sign(ls, photo, s):
    """A picture hung in the set (episode.json "sign": {image, quad: [TL, TR, BR, BL] in the photo's pixels, light,
    warm, shadow}) - painted into the photo in perspective, so it zooms, moves and blurs with the room. A logo
    on the wall: the room's light on it (light < 1 dims it, warm tints it toward the photo under it), a soft shadow."""
    import cv2
    img = cv2.imread(ls.asset(s["image"]), cv2.IMREAD_UNCHANGED)
    if img is None:
        log(f"  · sign not found: {s['image']}")
        return photo
    if img.shape[2] == 3:
        img = np.dstack([img, np.full(img.shape[:2], 255, np.uint8)])
    h, w = img.shape[:2]
    ph, pw = photo.shape[:2]
    M = cv2.getPerspectiveTransform(np.float32([[0, 0], [w, 0], [w, h], [0, h]]), np.float32(s["quad"]))
    lay = cv2.warpPerspective(img, M, (pw, ph), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_CONSTANT,
                              borderValue=(0, 0, 0, 0)).astype(np.float32)
    a = lay[:, :, 3:] / 255.0
    base = photo.astype(np.float32)
    sh = s.get("shadow", 0.35)
    if sh:  # it hangs a little off the wall: a soft shadow down and to the side the light falls
        dx, dy = s.get("shadow_offset", [6, 8])
        sa = cv2.GaussianBlur(np.roll(np.roll(a[:, :, 0], dy, 0), dx, 1), (0, 0), s.get("shadow_blur", 7))[:, :, None]
        base = base * (1 - sa * sh)
    rgb = lay[:, :, :3] * s.get("light", 0.9)
    warm = s.get("warm", 0.15)
    if warm:  # the room's colour on it: mix in the blurred photo's tint behind it
        tint = cv2.GaussianBlur(photo, (0, 0), 25).astype(np.float32)
        rgb = rgb * (1 - warm) + rgb * (tint / max(tint.mean(), 1.0)) * warm
    return np.clip(base * (1 - a) + rgb * a, 0, 255).astype(np.uint8)


def scene_png(ls):
    """Two layers in the photo's own pixels (so zooming / moving them is just a resize): the set photo
    (blurred later, it sits behind him) and the plaque text on the plate in perspective (kept sharp)."""
    import cv2
    photo = cv2.imread(ls.asset(ls.cfg["background"]))
    out = ls.work("public", "scene.png")
    plaque_out = ls.work("public", "plaque.png")
    for s in ([ls.cfg["sign"]] if isinstance(ls.cfg.get("sign"), dict) else ls.cfg.get("sign") or []):
        photo = paint_sign(ls, photo, s)
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


THOUGHT_V = 6  # bump when render/ui/thought_anim.js changes, so the thought clips are made again
MARKET_V = 5  # the same for render/ui/market_anim.js
STICKER_V = 1  # ... and render/ui/sticker_anim.js


def text_layers(ls, caps, anims_too=True):
    """The text as images for the export (the editor draws it live). anims_too=False: not the animated thoughts -
    a frame-by-frame browser render, left to the background render and the export."""
    spec = {"fontsDir": os.path.join(ROOT, "fonts"), "items": []}
    c, sw, sh, cx, cy = bg_place(ls)
    pb = ls.cfg.get("plaque_bg", {"cx": 570, "top": 222, "w": 300, "size": 40})  # in the photo's own pixels
    pl = {"x": pb["cx"] * c - cx, "y": pb["top"] * c - cy, "w": pb["w"] * c, "size": pb["size"] * c}
    anims, markets, stickers = [], [], []
    for i, o in enumerate(overlays(ls)):
        o["png"] = ls.work("text", f"ov{i}.png")
        if o.get("style") == "thought":  # animated (render/ui/thought_anim.js): a transparent clip, made once per text and timing
            import hashlib
            k = {f: o.get(f) for f in ("text", "y", "size", "start", "end", "motion", "x", "w", "hold", "grow")}
            o["anim"] = ls.work("text", "anim", hashlib.md5(json.dumps([THOUGHT_V, k], ensure_ascii=False).encode()).hexdigest()[:14] + ".mov")
            o["anim_y"] = max(0, round(float(o.get("y") or 1150) - 220))  # the clip's top (tools/thought_frames.mjs)
            ls.anims_used = getattr(ls, "anims_used", []) + [o["anim"]]
            if not os.path.exists(o["anim"]) and anims_too:
                anims.append({"out": o["anim"][:-4] + f".{os.getpid()}.part.mov", "final": o["anim"], "text": o["text"], "y": float(o.get("y") or 1150), "size": o.get("size") or 70,
                              "start": float(o["start"]), "end": float(o["end"]), "motion": o.get("motion"), "x": o.get("x"), "w": o.get("w"),
                              "hold": o.get("hold", 0.35), "grow": o.get("grow", 1)})
            continue
        if o.get("style") == "sticker" and o.get("motion") == "video":  # a green-screen clip (money rain): keyed, cover-cropped to the frame
            import hashlib
            src = ls.asset(o["video"])
            a0, dur = float(o.get("from", 0)), float(o["end"]) - float(o["start"])
            key = [STICKER_V, src, os.stat(src).st_mtime, a0, round(dur, 3), o.get("key", "0x00FF00"), o.get("similarity", 0.22)]
            o["anim"] = ls.work("text", "anim", "v" + hashlib.md5(json.dumps(key).encode()).hexdigest()[:13] + ".mov")
            o["anim_y"] = 0
            ls.anims_used = getattr(ls, "anims_used", []) + [o["anim"]]
            if not os.path.exists(o["anim"]) and anims_too:
                fo = min(0.4, dur / 3)
                part = o["anim"][:-4] + f".{os.getpid()}.part.mov"
                ff("-ss", f"{a0:.3f}", "-t", f"{dur:.3f}", "-i", src, "-an", "-vf",
                   f"fps={FPS},scale=-2:{H}:flags=lanczos,crop={W}:{H},chromakey={o.get('key', '0x00FF00')}:{o.get('similarity', 0.22)}:0.06,"
                   f"despill=type=green:mix=0.6:expand=0.1,format=argb,fade=t=out:st={max(0.0, dur - fo):.3f}:d={fo:.3f}:alpha=1",
                   "-c:v", "qtrle", part)
                os.replace(part, o["anim"])
            continue
        if o.get("style") == "sticker":  # a picture that pops in / rains down (render/ui/sticker_anim.js): a full-frame clip
            import hashlib
            k = {f: v for f, v in o.items() if f not in ("png", "anim", "anim_y", "from_words", "to_words", "take", "hold", "sound")}
            st = os.stat(o["image_abs"])
            o["anim"] = ls.work("text", "anim", "s" + hashlib.md5(json.dumps([STICKER_V, k, st.st_mtime], ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:13] + ".mov")
            o["anim_y"] = 0
            ls.anims_used = getattr(ls, "anims_used", []) + [o["anim"]]
            if not os.path.exists(o["anim"]) and anims_too:
                stickers.append({"out": o["anim"][:-4] + f".{os.getpid()}.part.mov", "final": o["anim"], "o": k})
            continue
        if o.get("style") == "market":  # a finance-news panel (render/ui/market_anim.js): a transparent clip, like a thought
            import hashlib
            k = {f: v for f, v in o.items() if f not in ("png", "anim", "anim_y", "from_words", "to_words", "take", "hold")}
            o["anim"] = ls.work("text", "anim", "m" + hashlib.md5(json.dumps([MARKET_V, k], ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:13] + ".mov")
            o["anim_y"] = max(0, round(float(o.get("y") if o.get("y") is not None else 300) - 30)) & ~1  # the clip's top (tools/market_frames.mjs)
            ls.anims_used = getattr(ls, "anims_used", []) + [o["anim"]]
            if not os.path.exists(o["anim"]) and anims_too:
                markets.append({"out": o["anim"][:-4] + f".{os.getpid()}.part.mov", "final": o["anim"], "o": k})
            continue
        spec["items"].append({"out": o["png"], "kind": "overlay", **{k: v for k, v in o.items() if k != "png"}})
    if stickers:
        ssp = ls.work("text", "anim", "sticker.json")
        json.dump({"fps": FPS, "items": stickers}, open(ssp, "w", encoding="utf-8"), ensure_ascii=False)
        log(f"  · drawing {len(stickers)} stickers")
        r = subprocess.run(["node", os.path.join(ROOT, "tools", "sticker_frames.mjs"), ssp], capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode:
            raise RuntimeError(r.stderr[-1500:])
        for it in stickers:
            os.replace(it["out"], it["final"])
    if markets:
        msp = ls.work("text", "anim", "market.json")
        json.dump({"fontsDir": os.path.join(ROOT, "fonts"), "fps": FPS, "items": markets}, open(msp, "w", encoding="utf-8"), ensure_ascii=False)
        log(f"  · drawing {len(markets)} market panels")
        r = subprocess.run(["node", os.path.join(ROOT, "tools", "market_frames.mjs"), msp], capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode:
            raise RuntimeError(r.stderr[-1500:])
        for it in markets:
            os.replace(it["out"], it["final"])
    if anims:
        asp = ls.work("text", "anim", "spec.json")
        json.dump({"fontsDir": os.path.join(ROOT, "fonts"), "fps": FPS, "items": anims}, open(asp, "w", encoding="utf-8"), ensure_ascii=False)
        log(f"  · animating {len(anims)} thoughts")
        r = subprocess.run(["node", os.path.join(ROOT, "tools", "thought_frames.mjs"), asp], capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode:
            raise RuntimeError(r.stderr[-1500:])
        for it in anims:  # done: in place in one step (a stopped run never leaves a half clip that looks finished)
            os.replace(it["out"], it["final"])
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
    # the set sits behind him: a little out of focus and a touch darker ("bg_dim": false = the photo's own light)
    blur = float(ls.cfg.get("bg_blur", 2.2))
    depth = ",".join(([f"gblur=sigma={blur}"] if blur > 0 else []) + (["eq=brightness=-0.04:saturation=0.95"] if ls.cfg.get("bg_dim", True) else [])) or "null"
    ff("-i", scene, "-i", plaque, "-filter_complex",
       f"[0]scale={sw}:{sh},crop={W}:{H}:{cx}:{cy},{depth}[b];[1]scale={sw}:{sh},crop={W}:{H}:{cx}:{cy}[t];[b][t]overlay=0:0",
       "-frames:v", "1", bg)
    return bg


def mask_curve(cut):
    """The mask's values -> how solid he is: the mask videos are stored in TV range (black 16, white 235), so first to
    0..255, then everything under "matte_cut" drops away. (Read straight, white 235 made him 70-75% solid - see-through.)"""
    return f"clip(((val-16)*255/219-{cut})*255/{255 - cut},0,255)"


def matte_filter(ls, pw, ph, ramp_in):
    """His mask, sized for the frame: drop the half-sure halo (white wall around raised hands), soften,
    and fade the sides of his picture when it does not reach the frame's edges."""
    cut = ls.cfg.get("matte_cut", 175)
    f = (f"[1:v]lutyuv=y='{mask_curve(cut)}',scale={pw}:{ph}:flags=bicubic,"
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


def slow_vf(ls, sp, mask=False):
    """Slow motion for a piece (sp < 1): its frames spread out, the missing ones made up - motion-compensated for the
    picture (cut "slow_mode": "mci" | "blend" | "dup"), blended for the mask."""
    if not sp or sp == 1:
        return ""
    mode = "blend" if mask else cut_cfg(ls).get("slow_mode", "mci")
    fill = {"mci": f"minterpolate=fps={FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1",
            "blend": f"minterpolate=fps={FPS}:mi_mode=blend", "dup": f"fps={FPS}"}[mode]
    return f",setpts=(PTS-STARTPTS)/{sp},{fill}"


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
        ff("-ss", f"{t:.3f}", "-i", take, "-vf", f"fps={FPS},scale={MATTE_W * 2}:{MATTE_H * 2}{slow_vf(ls, it.get('sp'))}",
           "-frames:v", str(n), *enc, out_v)
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
        mask_piece(ls, it["take"], it["a"], n, enc, out_m, sp=it.get("sp"))


def mask_piece(ls, take, t, n, enc, out_m, freeze=False, sp=None):
    """His mask for a piece, with the desk's still mask (keep_png) added - the real desk stays in front of the set."""
    if ls.cfg.get("cutout") is False:  # the whole frame is the person layer
        ff("-f", "lavfi", "-i", f"color=c=white:s={MATTE_W * 2}x{MATTE_H * 2}:r={FPS}", "-vf", "format=gray", "-frames:v", str(n), *enc, out_m)
        return
    mk = matte_path(ls, take)
    vf = (f"fps={FPS},scale={MATTE_W * 2}:{MATTE_H * 2},format=gray" + (f",loop=loop={n}:size=1:start=0" if freeze else "")
          + slow_vf(ls, sp, mask=True))
    keep = keep_png(ls, take)
    if not keep:
        ff("-ss", f"{t:.3f}", "-i", mk, "-vf", vf, "-frames:v", str(n), *enc, out_m)
        return
    ff("-ss", f"{t:.3f}", "-i", mk, "-loop", "1", "-i", keep, "-filter_complex",
       f"[0:v]{vf}[a];[1:v]scale={MATTE_W * 2}:{MATTE_H * 2},format=gray[k];[a][k]blend=all_mode=lighten,format=gray",
       "-frames:v", str(n), *enc, out_m)


def piece_atomic(ls, it, out_v, out_m, gaze=False):
    tag = f".{os.getpid()}.part.mp4"  # a stopped run never leaves a half piece (and two runs never share a part file)
    pv, pm = out_v[:-4] + tag, out_m[:-4] + tag
    piece(ls, it, pv, pm, gaze)
    os.replace(pv, out_v)
    os.replace(pm, out_m)


# ---- 5. sound --------------------------------------------------------------------------------------
# how a voice sounds coming out of a device in the room (insert / sound "filter": "phone" | "speaker")
SOUND_FILTERS = {
    "phone": "highpass=f=380,lowpass=f=3000,acompressor",
    # the other side of a call on speaker, the phone held in front of him: a phone line (8 kHz), a tiny speaker's
    # honk around 1.7 kHz and no body below 500 Hz, a little codec crunch and speaker strain, the room right around it
    "speakerphone": ("aresample=8000,highpass=f=480,highpass=f=480,lowpass=f=3300,lowpass=f=3300,"
                     "equalizer=f=1700:t=q:w=1.1:g=7,equalizer=f=800:t=q:w=1:g=-3,"
                     "acompressor=threshold=-24dB:ratio=5:attack=3:release=60:makeup=4,"
                     "acrusher=bits=9:mode=log:aa=1:mix=0.3,asoftclip=type=tanh:threshold=0.5,"
                     "aresample=48000,aecho=0.85:0.45:17|31|53|89:0.28|0.2|0.13|0.08"),
    # an inner voice, as films do it: very close, a little warmth, a soft short echo around it, even level
    "thought": ("highpass=f=95,lowpass=f=9000,equalizer=f=220:t=q:w=1:g=2,equalizer=f=3000:t=q:w=1.2:g=1.5,"
                "acompressor=threshold=-22dB:ratio=3:attack=5:release=80,aecho=0.85:0.6:38|77|121:0.24|0.14|0.08,"
                "loudnorm=I=-16:TP=-2:LRA=9"),  # every thought at one level, however it was recorded
    # an inner voice in a dark scene (a horror moment): close, darker, a long hall of echoes behind it
    "echo": ("highpass=f=90,lowpass=f=7500,equalizer=f=180:t=q:w=1:g=2.5,equalizer=f=2600:t=q:w=1.2:g=1.5,"
             "acompressor=threshold=-22dB:ratio=3:attack=5:release=80,"
             "aecho=0.8:0.72:70|150|260|410|620:0.32|0.24|0.17|0.11|0.07,loudnorm=I=-16:TP=-2:LRA=9"),
    # someone talking to you while you are not listening: low, far, through cotton - no word comes through
    "muffled": ("highpass=f=110,lowpass=f=420,lowpass=f=420,equalizer=f=250:t=q:w=1:g=3,"
                "acompressor=threshold=-24dB:ratio=3:attack=10:release=120,aecho=0.8:0.55:45|95|170:0.3|0.2|0.12,"
                "loudnorm=I=-20:TP=-3:LRA=11"),
    # a laptop's small speakers: no lows, a boxy mid bump, a little crunch, then his room around it
    "speaker": ("highpass=f=330,highpass=f=330,lowpass=f=7000,equalizer=f=1200:t=q:w=1.1:g=5,equalizer=f=3200:t=q:w=1.4:g=3,"
                "equalizer=f=500:t=q:w=1:g=-3,acompressor=threshold=-22dB:ratio=5:attack=4:release=60,"
                "asoftclip=type=tanh:threshold=0.85,aecho=0.85:0.5:17|29:0.16|0.09"),
}


RNN_MODEL = "models/rnnoise/cb.rnnn"


def echo_filter(amount):
    """The dark inner voice with its echo scaled (sound "echo": 0 = none, 1 = as tuned, 2 = a big hall)."""
    a = max(0.0, float(amount))
    taps = "|".join(f"{min(0.95, d * a):.3f}" for d in (0.32, 0.24, 0.17, 0.11, 0.07))
    echo = f"aecho=0.8:0.72:70|150|260|410|620:{taps}," if a > 0.01 else ""
    return SOUND_FILTERS["echo"].replace("aecho=0.8:0.72:70|150|260|410|620:0.32|0.24|0.17|0.11|0.07,", echo)


def load_sound(path, phone=False, pitch=1.0, denoise=False, tempo=1.0, echo=None):
    """A sound file through its filter; "denoise" = RNNoise first (a voice note recorded on the phone: hum, hiss);
    "tempo" = faster / slower speech at the same pitch; "echo" = the echo filter's amount."""
    filt = phone if isinstance(phone, str) else ("phone" if phone else None)
    tempo = float(tempo or 1.0)
    tag = (".rnn" if denoise else "") + (f".{filt}" if filt else "") + (f".e{float(echo):g}" if filt == "echo" and echo is not None else "") + \
        (f".p{pitch}" if pitch != 1 else "") + (f".t{tempo:g}" if tempo != 1 else "")
    tmp = path + tag + ".wav"
    if not os.path.exists(tmp) or os.path.getsize(tmp) == 0 or os.path.getmtime(tmp) < os.path.getmtime(path):
        af = (echo_filter(echo) if filt == "echo" and echo is not None else SOUND_FILTERS[filt]) if filt else "anull"
        if tempo != 1:  # before the room / echo: the words faster, the echo as it is
            af = f"atempo={tempo}," + af
        if pitch != 1:
            af = f"asetrate={int(SR * pitch)},aresample={SR}," + af
        if denoise:  # (at 48 kHz, the rate RNNoise is trained at)
            af = f"aresample=48000,arnndn=m={RNN_MODEL}," + af
        ff("-i", path, "-ac", "1", "-ar", str(SR), "-af", af, tmp[:-4] + ".part.wav")
        os.replace(tmp[:-4] + ".part.wav", tmp)  # (a stopped run never leaves an empty file that looks finished)
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


def voice_pitch(ls):
    """episode.json voice "pitch": semitones up (+) or down (-) for his voice - the editor's Pitch slider."""
    v = ls.cfg.get("voice")
    return round(float((v or {}).get("pitch") or 0), 2) if isinstance(v, dict) else 0.0


def pitched(ls, path):
    """A take's voice at his chosen pitch: higher or lower, same timing (the lips stay in sync), the formants kept so it
    is still his voice, not a chipmunk (rubberband). Cached per take, noise version and pitch."""
    st = voice_pitch(ls)
    if not st:
        return path
    out = f"{path[:-4]}.p{st:+g}.wav"
    if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(path):
        ff("-i", path, "-af", f"rubberband=pitch={2 ** (st / 12):.6f}:formant=preserved:pitchq=quality:transients=smooth",
           "-ar", str(SR), "-ac", "1", out)
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
        x = takes.setdefault(it["take"], read_wav(pitched(ls, take_audio(ls, it["take"], denoise)))[0])
        a = int(it["a"] * SR)
        seg = x[a:a + int(n * it.get("sp", 1.0))].copy()
        if it.get("sp", 1.0) != 1 and len(seg) > 1:  # slow motion: its sound stretched with it (slower, lower)
            seg = np.interp(np.linspace(0, len(seg) - 1, n), np.arange(len(seg)), seg).astype(np.float32)
        seg[:fade] *= np.linspace(0, 1, min(fade, len(seg)))[:len(seg[:fade])]
        tail = int((it["an"] - it["n"]) / FPS * SR) if "an" in it else fade  # crossfade under the next part
        tail = max(fade, min(tail, len(seg)))
        seg[-tail:] *= np.linspace(1, 0, tail)
        out[o:o + len(seg)] += seg
    return out[:int(total / FPS * SR)]


def duck_curve(voice, db, hop=0.01, attack=0.12, release=0.6, hold=0.35):
    """The music under his voice, the way an editor mixes a talk: down by `db` while he speaks, back up in his pauses
    (it waits `hold` seconds after a word before coming up, so it doesn't pump between words)."""
    h = int(hop * SR)
    nf = len(voice) // h + 1
    fr = np.pad(voice, (0, nf * h - len(voice))).reshape(nf, h)
    lv = 20 * np.log10(np.sqrt((fr ** 2).mean(1)) + 1e-9)
    on = lv > np.percentile(lv, 95) - 24
    k = int(hold / hop)
    if k:
        on = np.convolve(on.astype(float), np.ones(k + 1))[:nf] > 0
    tgt = np.where(on, 10 ** (db / 20), 1.0)
    g, cur = np.empty(nf), 1.0
    ka, kr = 1 - np.exp(-hop / attack), 1 - np.exp(-hop / release)
    for i, t in enumerate(tgt):
        cur += (t - cur) * (ka if t < cur else kr)
        g[i] = cur
    return np.interp(np.arange(len(voice)), np.arange(nf) * h + h / 2, g).astype(np.float32)


def lift_curve(voice, db, fade, hop=0.01, after=0.15):
    """The music up by `db` once he has stopped talking for good (an end card, a poster): flat until his last word,
    then a smooth rise over `fade` seconds."""
    h = int(hop * SR)
    nf = len(voice) // h + 1
    fr = np.pad(voice, (0, nf * h - len(voice))).reshape(nf, h)
    lv = 20 * np.log10(np.sqrt((fr ** 2).mean(1)) + 1e-9)
    on = np.nonzero(lv > np.percentile(lv, 95) - 24)[0]
    g = np.ones(len(voice), np.float32)
    if not len(on):
        return g
    a = int(((on[-1] + 1) * hop + after) * SR)
    n = max(1, int(fade * SR))
    x = np.clip((np.arange(len(voice)) - a) / n, 0, 1)
    return (1 + (10 ** (db / 20) - 1) * x * x * (3 - 2 * x)).astype(np.float32)


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
    duck = float((ls.cfg.get("music") or {}).get("duck") or 0)  # music "duck": dB under his voice (the Music card)
    if duck < 0 and music.any():
        music = music * duck_curve(voice_dn[:len(music)], duck)[:len(music)]
    lift = (ls.cfg.get("music") or {}).get("lift")  # music "lift": {"db", "fade"} - up when he stops talking for good
    if lift and float(lift.get("db") or 0) and music.any():
        music = music * lift_curve(voice_dn[:len(music)], float(lift["db"]), float(lift.get("fade", 1.0)))[:len(music)]
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
    S = ls.cfg.get("sounds", [])
    for i, s in enumerate(S):
        if any(k in s for k in PLACED):
            out[i] = sound_place(ls, items, s, prev)
            prev = out[i][1]
    for i, s in enumerate(S):  # "until": {"sound": j, "offset": s} - it ends where that one starts (a bed stopping on the boom)
        u = s.get("until")
        if i in out and u and u.get("sound") in out:
            out[i] = (out[i][0], max(out[i][0] + 0.05, min(out[i][1], out[u["sound"]][0] + float(u.get("offset", 0.0)))))
    return out


def sound_place(ls, items, s, prev_end=None):
    """A sound that ends where he reacts: {"take", "end_word", "end_after" (seconds in his take, to find the right one),
    "end_offset", "from"/"to" (the part of the sound file)} -> (start, end) in seconds of the video."""
    dur = sum(b - a for a, b in sound_parts(ls, s))
    dur = max(0.05, dur - float(s.get("trim_in", 0) or 0))  # its ends dragged in the editor: less of its start / end
    if s.get("len"):
        dur = min(dur, float(s["len"]))
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


def sound_parts(ls, s):
    """The parts of a placed sound's file that play, in seconds of the processed sound: from..to (file seconds) without
    its "skip" ranges (a pause inside the recording taken out), all divided by its tempo."""
    tp = float(s.get("tempo", 1.0) or 1.0) * float(s.get("pitch", 1.0) or 1.0)  # (a lower pitch plays slower too: a slowed tape)
    a0 = float(s.get("from", 0.0))
    a1 = float(s["to"]) if s.get("to") is not None else \
        len(load_sound(ls.asset(s["sound"]), s.get("filter"), s.get("pitch", 1.0), s.get("denoise"), s.get("tempo", 1.0), s.get("echo"))) / SR * tp
    parts, pos = [], a0
    for k0, k1 in sorted(s.get("skip", [])):
        if k0 > pos and k0 < a1:
            parts.append((pos, k0))
        pos = max(pos, k1)
    if a1 > pos:
        parts.append((pos, a1))
    return [(a / tp, b / tp) for a, b in parts]


def voice_bed(ls, pl, out):
    """episode.json "voice_bed": {"sounds": [indices] (default: every thought), "gain": 1}: the voice-over's own room
    noise between its lines - taken from the quiet parts of the very same processed recording - so the voice-over never
    drops into dead silence between thoughts (you would hear each one start and stop)."""
    vb = ls.cfg.get("voice_bed")
    if not vb:
        return
    S = ls.cfg.get("sounds", [])
    idx = [i for i in (vb.get("sounds") or [i for i, s in enumerate(S) if s.get("filter") in ("thought", "echo")]) if i in pl]
    if not idx:
        return
    s0 = S[idx[0]]
    x = load_sound(ls.asset(s0["sound"]), s0.get("filter"), s0.get("pitch", 1.0), s0.get("denoise"), s0.get("tempo", 1.0), s0.get("echo"))
    hop = int(0.02 * SR)
    db = np.array([20 * np.log10(np.sqrt(np.mean(x[i:i + hop] ** 2)) + 1e-9) for i in range(0, len(x) - hop, hop)])
    quiet = db < np.percentile(db, 25) + 4
    bank, run, xf = [], [], int(0.01 * SR)
    for k, q in enumerate(np.append(quiet, False)):  # quiet runs of 0.12 s or more, their edges trimmed
        if q:
            run.append(k)
            continue
        if len(run) * hop >= 0.12 * SR:
            seg = x[(run[0] + 2) * hop:(run[-1] - 1) * hop].astype(np.float32).copy()
            if len(seg) > 2 * xf:
                seg[:xf] *= np.linspace(0, 1, xf)
                seg[-xf:] *= np.linspace(1, 0, xf)
                bank.append(seg)
        run = []
    if not bank:
        return
    noise = np.concatenate(bank)
    a, b = int(min(pl[i][0] for i in idx) * SR), int(max(pl[i][1] for i in idx) * SR)
    b = min(b, len(out))
    if b <= a:
        return
    bed = np.tile(noise, (b - a) // max(1, len(noise)) + 1)[:b - a]
    gate = np.ones(b - a, np.float32)
    f = int(0.08 * SR)
    for i in idx:  # the lines have their own noise: the bed only in the gaps, crossfaded
        i0, i1 = max(0, int(pl[i][0] * SR) - a), min(b - a, int(pl[i][1] * SR) - a)
        if i1 <= i0:
            continue
        gate[i0:i1] = 0
        gate[max(0, i0 - f):i0] = np.minimum(gate[max(0, i0 - f):i0], np.linspace(1, 0, i0 - max(0, i0 - f)))
        gate[i1:i1 + f] = np.minimum(gate[i1:i1 + f], np.linspace(0, 1, len(gate[i1:i1 + f])))
    out[a:b] += bed * gate * float(vb.get("gain", 1.0)) * float(s0.get("gain", 1.0))


_IRS = {}


def room_ir(rt60):
    """A large room's answer (impulse response) - the same room as render/ui/sound.ts roomIR (his voice's Room):
    early reflections, a tail that dies over rt60 seconds and loses its highs, the wet path's 220 Hz-5.5 kHz band and
    22 ms pre-delay. Seeded, so every build sounds the same."""
    if rt60 in _IRS:
        return _IRS[rt60]
    n = max(1, int(SR * min(4.0, rt60 * 1.1)))
    t = np.arange(n) / SR
    env = np.exp(-6.91 * t / rt60) * np.minimum(1, t / 0.012)
    a = np.minimum(0.92, 0.25 + t / rt60 * 0.7)
    noise = np.random.default_rng(0x9E3779B9).uniform(-1, 1, n)
    d, lp = np.zeros(n), 0.0
    for i in range(n):  # more and more low-passed as it decays
        lp = lp * a[i] + noise[i] * (1 - a[i])
        d[i] = lp
    d *= env * (1 + a * 1.5)
    for ms, g in ((11, 0.55), (19, -0.42), (27, 0.36), (38, -0.3), (52, 0.24), (67, -0.2)):
        d[int(ms / 1000 * SR)] += g
    f = np.fft.rfftfreq(2 * n, 1 / SR)
    band = 1 / np.sqrt(1 + (220 / np.maximum(f, 1)) ** 4) / np.sqrt(1 + (f / 5500) ** 4)
    d = np.fft.irfft(np.fft.rfft(d, 2 * n) * band)[:n]
    d /= np.sqrt(np.sum(d ** 2)) or 1
    _IRS[rt60] = np.concatenate([np.zeros(int(0.022 * SR)), d]).astype(np.float32)
    return _IRS[rt60]


def with_room(ls, s, x):
    """A sound in the same room as his voice (sounds "room": true - his Room amount and size - or a number = amount)."""
    v = ls.cfg.get("voice")
    vs = v if isinstance(v, dict) else ({"room": 0.45, "roomSize": 1.8} if v == "hall" else {})
    r = s.get("room")
    amt = float(r) if not isinstance(r, bool) else float(vs.get("room") or 0.3)
    ir = room_ir(round(float(s.get("roomSize") or vs.get("roomSize") or 1.6), 2))
    m = 1 << int(np.ceil(np.log2(len(x) + len(ir))))
    wet = np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[:len(x) + len(ir)]
    out = wet * 1.1 * amt
    out[:len(x)] += x * (1 - 0.45 * amt)
    return out.astype(np.float32)


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
            snd = load_sound(ls.asset(snd_cfg["sound"]), snd_cfg.get("filter") or snd_cfg.get("phone"), snd_cfg.get("pitch", 1.0),
                             denoise=snd_cfg.get("denoise"), tempo=snd_cfg.get("tempo", 1.0), echo=snd_cfg.get("echo"))
            if snd_cfg.get("room"):  # in his room, like his voice
                snd = with_room(ls, snd_cfg, snd)
            if snd_cfg.get("reverse"):  # backwards (a muffled voice nobody can make out)
                snd = snd[::-1].copy()
            xf = int(0.015 * SR)
            seg = np.zeros(0, np.float32)
            for pa, pb in sound_parts(ls, snd_cfg):  # a skipped pause: the two sides joined with a short crossfade
                piece_ = snd[int(pa * SR):int(pb * SR)].astype(np.float32).copy()
                if len(seg) > xf and len(piece_) > xf:
                    piece_[:xf] *= np.linspace(0, 1, xf)
                    seg[-xf:] *= np.linspace(1, 0, xf)
                    seg = np.concatenate([seg[:-xf], seg[-xf:] + piece_[:xf], piece_[xf:]])
                else:
                    seg = np.concatenate([seg, piece_])
            seg = seg[int(float(snd_cfg.get("trim_in", 0) or 0) * SR):]  # (its start dragged in: that part is left out)
            seg = seg[:int((o1 - o0) * SR)] * snd_cfg.get("gain", 0.8)
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
        snd = load_sound(ls.asset(snd_cfg["sound"]), snd_cfg.get("filter") or snd_cfg.get("phone"), snd_cfg.get("pitch", 1.0),
                         denoise=snd_cfg.get("denoise"), tempo=snd_cfg.get("tempo", 1.0), echo=snd_cfg.get("echo"))
        if snd_cfg.get("room"):  # in his room, like his voice
            snd = with_room(ls, snd_cfg, snd)
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
    voice_bed(ls, pl, out)
    n = int(total / FPS * SR)
    music = np.zeros(n, np.float32)
    mus = ls.cfg.get("music")
    # a bed under him (a short loop repeats seamlessly); its volume is set later. Its time on the video is moved / its
    # ends dragged on its lane in the editor ("start", "end" seconds of the video; no end = to the end), "off" = taken off
    a0 = int(max(0.0, float((mus or {}).get("start") or 0)) * SR)
    a1 = n if (mus or {}).get("end") is None else min(n, int(float(mus["end"]) * SR))
    if mus and not mus.get("off") and a1 - a0 > SR // 10:
        bed = load_sound(ls.asset(mus["sound"]))
        m = np.tile(bed, (a1 - a0) // max(1, len(bed)) + 1)[:a1 - a0].copy()
        f_in, f_out = int(mus.get("fade_in", 1.5) * SR), int(mus.get("fade_out", 2.5) * SR)
        m[:f_in] *= np.linspace(0, 1, len(m[:f_in]))
        m[-f_out:] *= np.linspace(1, 0, len(m[-f_out:]))
        music[a0:a1] = m
    return out[:n], music


# ---- 6b. camera & film (episode.json "fx", render/ui/fx.js) -------------------------------------------
def time_fx(ls, items, total):
    """Hits and blackouts tied to a sound ({"sound": i, "offset": s}) get their moment from where that sound landed;
    written back into episode.json so the editor shows them in place."""
    fx = ls.cfg.get("fx")
    if not fx:
        return
    pl = placed_sounds(ls, items)
    changed = False
    for h in fx.get("hits", []) + fx.get("blackouts", []):
        if "sound" in h and h["sound"] in pl:
            at = round(pl[h["sound"]][0] + float(h.get("offset", 0.0)), 3)
            if h.get("at") != at:
                h["at"], changed = at, True
    if changed:
        cfg = load_json(ls.p("episode.json"))
        cfg["fx"] = fx
        save_json(ls.p("episode.json"), cfg)


def fx_spec(ls):
    """The fx for render/ui/fx.js: blackouts ("from this moment on") become black ranges."""
    fx = dict(ls.cfg.get("fx") or {})
    fx["black"] = list(fx.get("black", [])) + [[b["at"], 1e6] for b in fx.get("blackouts", []) if b.get("at") is not None]
    return fx


def fx_curve(ls, frames):
    spec = ls.work("fx", "curve_spec.json")
    out = ls.work("fx", "curve.json")
    save_json(spec, {"fx": fx_spec(ls), "frames": frames, "fps": FPS, "out": out})
    r = subprocess.run(["node", os.path.join(ROOT, "tools", "fx_curve.mjs"), spec], capture_output=True, text=True, encoding="utf-8")
    if r.returncode:
        raise RuntimeError("fx curve: " + r.stderr[-800:])
    return load_json(out)


class FxFrame(_FxFrame):
    """The film look on one frame (pipeline/film_fx.py - shared with the layered exporter), from episode.json "fx"."""
    def __init__(self, ls, w, h):
        super().__init__(ls.cfg.get("fx") or {}, w, h, FPS)


def fx_pass(ls, src, dst, frames, w, h):
    """The picture (set + person) through the camera and the film look, frame by frame. src: a video file, or the
    ffmpeg arguments that draw the picture (it is read straight from that ffmpeg - no picture file in between)."""
    curve = fx_curve(ls, frames)
    fxf = FxFrame(ls, w, h)
    cmd = [FFMPEG, "-v", "error", "-i", src] if isinstance(src, str) else [FFMPEG, "-v", "error", *src]
    dec = subprocess.Popen(cmd + ["-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE, cwd=ROOT)
    enc = subprocess.Popen([FFMPEG, "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "veryfast", "-crf", "12", "-pix_fmt", "yuv420p", dst], stdin=subprocess.PIPE, cwd=ROOT)
    size, f, hist, todo = w * h * 3, 0, [], []
    from collections import deque
    todo = deque()
    with ThreadPoolExecutor(max_workers=max(2, min(6, (os.cpu_count() or 4) - 2))) as pool:  # (OpenCV / numpy free the GIL)
        while f < frames:
            buf = dec.stdout.read(size)
            if len(buf) < size:
                break
            img = np.frombuffer(buf, np.uint8).reshape(h, w, 3)
            hist.append(img)
            if len(hist) > fxf.lag + 1:
                hist.pop(0)
            prev = hist[0] if fxf.lag and len(hist) > fxf.lag else None
            todo.append(pool.submit(fxf, img, curve[min(f, len(curve) - 1)], f, prev))
            f += 1
            while len(todo) > 8 or (todo and todo[0].done()):
                enc.stdin.write(todo.popleft().result().tobytes())
            if f % 60 == 0:
                log(f"Rendered {f}/{frames} (camera & film)")
        while todo:
            enc.stdin.write(todo.popleft().result().tobytes())
    enc.stdin.close()
    enc.wait()
    dec.stdout.close()
    dec.wait()
    return dst



# ---- 6. assemble -----------------------------------------------------------------------------------
def build(ls, still_at=None, preview=False):
    log(f"▶ {ls.slug} — {len(ls.takes)} takes")
    prepare(ls)
    items, total = plan(ls)
    log(f"  · cut: {sum(1 for i in items if i['kind'] == 'clip')} pieces, {total / FPS:.1f}s "
        f"(raw {sum(len(read_wav(ls.work('audio16', name(t) + '.wav'))[0]) / 16000 for t in ls.takes):.1f}s)")
    sync_captions(ls)
    time_overlays(ls, items, total)
    time_fx(ls, items, total)
    caps = captions(ls, items, total)
    # keep what the editor needs from the last preview (photo size, sounds) - a still or an export must not wipe it
    prev_edit = load_json(ls.work("edit.json"), {}) or {}
    save_json(ls.work("edit.json"), {**{k: prev_edit[k] for k in ("photo", "sounds", "speed") if k in prev_edit},
                                     "items": items, "total": total, "captions": caps})
    if preview:
        stop_warm(ls)  # (a newer edit: the background render starts again from it at the end)
    elif still_at is None:
        wait_warm(ls)  # the export: let the background render finish what it started (the same work)
    bg = text_layers(ls, caps, anims_too=not preview)
    if still_at is not None:
        person, mask = person_layer(ls, items, gaze=eye_on(ls))
        audio = mix(ls, items, total)
        out = compose(ls, items, total, caps, bg, person, mask, audio, False, still_frame=int(still_at * FPS))
        log(f"✔ still → {out}")
        return
    if preview:
        eyes = eye_cfg(ls) is not None
        take_proxies(ls)  # the editor plays the cut over these, live - the cut person layer is the export's (background)
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
        if os.path.exists(ls.work("edit.full.json")):  # (End here keeps the full edit beside the shortened one)
            os.remove(ls.work("edit.full.json"))
        save_json(ls.work("edit.json"), {"items": items, "total": total, "captions": caps, "speed": 1.0, "photo": [pw_, ph_],
                                         "sounds": getattr(ls, "placed", [])})
        log(f"✔ layers ready ({total / FPS:.1f}s) — the editor puts them together live")
        layered(ls)  # (the one editor: the analysis lands in project.json; the layered export needs no warm render)
        return
    person, mask = person_layer(ls, items, gaze=eye_on(ls))
    audio = mix(ls, items, total)
    compose(ls, items, total, caps, bg, person, mask, audio, preview)
    check_export(ls, total)
    tidy(ls, items, caps)


# ---- the background render: after every edit, the export's heavy layers (the cut person in slow-motion chunks, the
# animated thoughts, the fallback preview) are made at low priority, so Export finds them ready -------------------
def _alive(pid):
    """Is this process still running? (Never os.kill on Windows - signal 0 terminates it there.)"""
    if os.name != "nt":
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False
    import ctypes
    k = ctypes.windll.kernel32
    h = k.OpenProcess(0x1000, False, pid)
    if not h:
        return False
    code = ctypes.c_ulong()
    k.GetExitCodeProcess(h, ctypes.byref(code))
    k.CloseHandle(h)
    return code.value == 259


def warm_pid(ls):
    try:
        pid = int(open(ls.work("warm.pid")).read().strip())
        return pid if pid != os.getpid() and _alive(pid) else None
    except (OSError, ValueError):
        return None


def spawn_warm(ls):
    stop_warm(ls)
    flags = (0x00000008 | 0x00000200 | 0x00004000) if os.name == "nt" else 0  # detached, own group, below-normal priority
    p = subprocess.Popen([sys.executable, os.path.abspath(__file__), ls.dir, "--warm"], cwd=ROOT, creationflags=flags,
                         stdout=open(ls.work("warm.log"), "w", encoding="utf-8"), stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
    open(ls.work("warm.pid"), "w").write(str(p.pid))
    log("  · the export's layers render in the background (Export uses them)")


def stop_warm(ls):
    pid = warm_pid(ls)
    if pid:
        subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"] if os.name == "nt" else ["kill", str(pid)], capture_output=True)


def wait_warm(ls):
    import time
    if warm_pid(ls):
        log("  · finishing the background render (the same work the export needs)")
        while warm_pid(ls):
            time.sleep(1)


def warm(ls):
    """The background render itself: what the export will need, from the edit as it is now."""
    open(ls.work("warm.pid"), "w").write(str(os.getpid()))
    items, total = plan(ls)
    caps = captions(ls, items, total)
    text_layers(ls, caps)
    person, mask = person_layer(ls, items, gaze=eye_on(ls))
    person_preview(ls, person, mask, "person.webm")  # (the editor's fallback when it cannot play the takes)
    plain_preview(ls, person)
    if eye_cfg(ls) is not None:
        raw_p, raw_m = person_layer(ls, items, gaze=False)
        person_preview(ls, raw_p, raw_m, "person_raw.webm")
    log("✔ background render done")


# ---- after an export: is the file what the edit says? then the work folder keeps only what this edit uses -------
def check_export(ls, total):
    out = ls.p("out", ls.slug + ".mp4")
    spd = min(2.0, max(0.5, float(ls.cfg.get("speed", 1.0))))
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate",
                        "-of", "json", out], capture_output=True, text=True)
    info = json.loads(r.stdout or "{}")
    st = info.get("streams", [])
    v = next((x for x in st if x.get("codec_type") == "video"), {})
    dur, want = float(info.get("format", {}).get("duration", 0)), round(total / spd) / FPS
    problems = []
    if (v.get("width"), v.get("height")) != (W, H):
        problems.append(f"size {v.get('width')}x{v.get('height')}")
    if v.get("r_frame_rate") != f"{FPS}/1":
        problems.append(f"frame rate {v.get('r_frame_rate')}")
    if not any(x.get("codec_type") == "audio" for x in st):
        problems.append("no sound")
    if abs(dur - want) > 0.25:
        problems.append(f"{dur:.2f}s long, the edit is {want:.2f}s")
    if problems:
        raise SystemExit("the exported file is wrong: " + ", ".join(problems))
    log(f"  · checked: {dur:.1f}s, {W}x{H}, {FPS} fps, with sound - as the edit")


def tidy(ls, items, caps):
    """Delete what this edit no longer uses: animated thoughts and subtitle images of earlier versions, the camera
    pass's picture, filtered copies of the project's own sounds; person pieces unused for a day (undo stays cheap)."""
    import time
    keep = {os.path.normcase(os.path.abspath(x)) for x in getattr(ls, "anims_used", [])}
    keep |= {os.path.normcase(os.path.abspath(c["png"])) for c in caps if c.get("png")}
    freed = 0

    def rm(p):
        nonlocal freed
        try:
            freed += os.path.getsize(p)
            os.remove(p)
        except OSError:
            pass
    for d, ext in ((ls.work("text", "anim"), ".mov"), (ls.work("text", "caps"), ".png")):
        for f in os.listdir(d) if os.path.isdir(d) else []:
            p = os.path.join(d, f)
            if f.endswith(ext) and os.path.normcase(os.path.abspath(p)) not in keep:
                rm(p)
    for f in ("picture.mp4", "picture_fx.mp4", "picture.mp4.png", "picture_fx.mp4.png"):
        rm(ls.work("fx", f))
    used = set()
    for s in ls.cfg.get("sounds", []):  # the filtered copies this edit uses (load_sound's names)
        filt = s.get("filter") or s.get("phone")
        filt = filt if isinstance(filt, str) else ("phone" if filt else None)
        tempo, pitch, echo = float(s.get("tempo", 1.0) or 1.0), s.get("pitch", 1.0), s.get("echo")
        tag = (".rnn" if s.get("denoise") else "") + (f".{filt}" if filt else "") + (f".e{float(echo):g}" if filt == "echo" and echo is not None else "") + \
            (f".p{pitch}" if pitch != 1 else "") + (f".t{tempo:g}" if tempo != 1 else "")
        used.add(os.path.normcase(os.path.abspath(ls.asset(s["sound"]) + tag + ".wav")))
    own = {os.path.basename(ls.asset(x["sound"])) for x in ls.cfg.get("sounds", [])}
    for root, _, files in os.walk(ls.dir):  # the project's own folder only - shared library sounds stay
        if os.path.normcase(root).startswith(os.path.normcase(ls.p("work"))):
            continue
        for f in files:  # a filtered copy of one of its sounds ("<sound>.<filters>.wav") that this edit does not use
            p = os.path.join(root, f)
            if f.endswith(".wav") and any(f.startswith(o + ".") for o in own) and os.path.normcase(os.path.abspath(p)) not in used:
                rm(p)
    pieces = ls.work("pieces")
    live = {os.path.basename(x) for x in ls.__dict__.get("pieces_used", [])}
    for f in os.listdir(pieces) if os.path.isdir(pieces) else []:
        p = os.path.join(pieces, f)
        if f.endswith(".mp4") and f not in live and time.time() - os.path.getmtime(p) > 86400:
            rm(p)
    if freed:
        log(f"  · tidied the work folder: {freed / 1e6:.0f} MB of earlier versions removed")


def eye_cfg(ls):
    """episode.json "eye_contact": {mode, strength, dy, nudge, on} - present = both versions are prepared."""
    return ls.cfg.get("eye_contact") or None


def eye_on(ls):
    e = eye_cfg(ls)
    return bool(e) and e.get("on", True)


def plain_preview(ls, person):
    """His footage as it was filmed (no cut-out), for the editor: Keep desk shows its bottom band over the set and
    Keep original place shows all of it - live, no rebuild (Export applies the real masks)."""
    out = ls.work("public", "plain.mp4")
    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(person):
        return out
    ff("-i", person, "-vf", "scale=540:960", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p", "-an", out)
    return out


def take_src(ls, n, gaze):
    """A take's video file: the original, or its eye-contact copy (same frames, same timing)."""
    g = ls.work("gaze", f"{n}.{gaze_sig(ls)}.mp4")
    return g if gaze and os.path.exists(g) else os.path.join(ls.cfg["input_dir"], n + os.path.splitext(ls.takes[0])[1])


def take_proxy(ls, n, gaze, kind):
    """One take, whole, for the editor (540x960, a keyframe every half second so it seeks at once):
    "cut" = him cut out (VP9 alpha, his matte + the kept desk), "plain" = as filmed. Made again only when its source,
    cut-out or look changes."""
    import hashlib
    src = take_src(ls, n, gaze)
    cutout = ls.cfg.get("cutout") is not False
    mk, keep = (matte_path(ls, n), keep_png(ls, n)) if kind == "cut" and cutout else (None, None)
    if mk and not os.path.exists(mk):
        return None
    look = "null" if ls.cfg.get("look") else grade(ls, 540)
    sig = hashlib.md5("|".join([src, str(os.path.getmtime(src)), str(mk and os.path.getmtime(mk)), str(keep), look,
                                str(ls.cfg.get("matte_cut", 175)), kind, "v1"]).encode()).hexdigest()[:12]
    name_ = f"{n}{'.raw' if kind == 'cut' and not gaze and eye_cfg(ls) else ''}.{'webm' if kind == 'cut' else 'mp4'}"
    if kind == "plain":
        name_ = f"{n}.plain.mp4"
    out, stamp = ls.work("public", "takes", name_), ls.work("public", "takes", name_ + ".stamp")
    if os.path.exists(out) and os.path.exists(stamp) and open(stamp).read() == sig:
        return out
    os.makedirs(os.path.dirname(out), exist_ok=True)
    part = out[:-5] + ".part" + out[-5:] if out.endswith(".webm") else out[:-4] + ".part.mp4"
    pic = f"fps={FPS},scale=540:960,{look}"
    if kind == "plain":
        ff("-i", src, "-vf", pic, "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-g", "15", "-pix_fmt", "yuv420p", "-an", part)
    elif not mk:  # no cut-out: the whole frame is him
        ff("-i", src, "-vf", pic, "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-row-mt", "1", "-b:v", "2000k",
           "-g", "15", "-an", part)
    else:
        cut = ls.cfg.get("matte_cut", 175)
        m = f"[1:v]fps={FPS},scale=540:960,format=gray"
        fc = (f"{m}[a];[2:v]scale=540:960,format=gray[k];[a][k]blend=all_mode=lighten,format=gray" if keep else m)
        fc += (f",lutyuv=y='clip((val-{cut})*255/{255 - cut},0,255)',gblur=sigma=0.7,format=gray[m];"
               f"[0:v]{pic},format=yuva420p[p];[p][m]alphamerge[v]")
        ff("-i", src, "-i", mk, *(["-loop", "1", "-i", keep] if keep else []), "-filter_complex", fc, "-map", "[v]", "-shortest",
           "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-deadline", "realtime", "-cpu-used", "8", "-row-mt", "1", "-b:v", "2000k",
           "-g", "15", "-auto-alt-ref", "0", "-an", part)
    os.replace(part, out)
    open(stamp, "w").write(sig)
    return out


def take_proxies(ls):
    """Every take whole, for the editor, which plays the cut over them: a piece's edge dragged shows the new part
    at once, because the whole take is always there behind the cut. Him cut out, him as filmed (Keep desk / no
    cut-out, live) and, when eye contact is prepared, his original eyes too (the live switch)."""
    eyes = eye_cfg(ls) is not None
    jobs = [(name(t), eyes, k) for t in ls.takes for k in ("cut", "plain")] + ([(name(t), False, "cut") for t in ls.takes] if eyes else [])
    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(lambda j: take_proxy(ls, *j), jobs))
    log(f"  · the takes, whole, for the editor ({len(ls.takes)})")


def replan(ls):
    """The edit again without any picture work (a piece's edge dragged in the editor): the cut, the subtitles, the
    sound layers - about a second. The editor plays the cut over the takes' full videos, so the picture is already there."""
    items, total = plan(ls)
    sync_captions(ls)
    time_overlays(ls, items, total)
    time_fx(ls, items, total)
    caps = captions(ls, items, total)
    st = stems(ls, items, total)
    import shutil
    for k, path in st.items():
        shutil.copyfile(path, ls.work("public", f"{k}.wav"))
    if os.path.exists(ls.work("edit.full.json")):  # (plan() applies the End mark itself)
        os.remove(ls.work("edit.full.json"))
    e = load_json(ls.work("edit.json"), {}) or {}
    e.update({"items": items, "total": total, "captions": caps, "sounds": getattr(ls, "placed", [])})
    save_json(ls.work("edit.json"), e)
    log(f"✔ cut ready ({total / FPS:.1f}s)")
    layered(ls)


def layered(ls):
    """The project as layers for the one editor (pipeline/to_layers_solo.py: this file's own decisions translated into
    project.json, merged so his edits there stay) - after every analysis and every re-cut."""
    from pipeline import to_layers_solo
    to_layers_solo.build(ls.dir)


def build_stems(ls):
    """Only the sound layers (a sound moved / removed in the editor): seconds, no picture work."""
    items, total = plan(ls)
    st = stems(ls, items, total)
    import shutil
    for k, path in st.items():
        shutil.copyfile(path, ls.work("public", f"{k}.wav"))
    e = load_json(ls.work("edit.json"), {}) or {}
    e["sounds"] = getattr(ls, "placed", [])
    save_json(ls.work("edit.json"), e)
    log(f"✔ sounds ready ({len(e['sounds'])})")


def person_preview(ls, person, mask, name="person.webm"):
    """The person layer for the editor: his video with its mask as transparency (VP9 alpha) and the sound.
    Background, size, position, subtitles and text are stacked on it live; Export uses the same numbers."""
    import hashlib
    sig = hashlib.md5("|".join([str(os.path.getmtime(x)) for x in (person, mask)] + ["live" if ls.cfg.get("look") else grade(ls), str(ls.cfg.get("matte_cut", 175)), "mask-tv"]).encode()).hexdigest()[:12]
    out, stamp = ls.work("public", name), ls.work("public", name + ".stamp")
    if os.path.exists(out) and os.path.exists(stamp) and open(stamp).read() == sig:
        return out
    cut = ls.cfg.get("matte_cut", 175)
    ff("-i", person, "-i", mask, "-filter_complex",
       f"[1:v]lutyuv=y='{mask_curve(cut)}',scale=540:960:flags=bicubic,gblur=sigma=0.7,format=gray[m];"
       f"[0:v]scale=540:960,{'null' if ls.cfg.get('look') else grade(ls, 540)},format=yuva420p[p];[p][m]alphamerge[v]",
       "-map", "[v]", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-deadline", "realtime", "-cpu-used", "8",
       "-row-mt", "1", "-b:v", "2500k", "-auto-alt-ref", "0", "-an", out)
    open(stamp, "w").write(sig)
    return out


CHUNK = 2.0  # seconds of a take per cached person piece


def chunks(it):
    """A clip rendered in chunks on a fixed 2 s grid of its take: a cut, an end mark or a split re-renders only the chunk it
    falls in (a slow-motion piece is minutes of frame interpolation - never all of it again). The chunks inside sit exactly
    on the grid, so their cache keys never change; the frames add up to the clip's own."""
    if it["kind"] != "clip":
        return [it]
    sp, a, n = it.get("sp", 1.0), it["a"], it["n"]
    t1 = a + n * sp / FPS
    grid = [k * CHUNK for k in range(int(a // CHUNK) + 1, int(t1 // CHUNK) + 1) if a + 0.05 < k * CHUNK < t1 - 0.05]
    if not grid:
        return [it]
    starts = [a] + grid
    ns = [round((grid[0] - a) / sp * FPS)] + [round(CHUNK / sp * FPS)] * (len(grid) - 1) + [0]
    ns[-1] = n - sum(ns[:-1])  # the last one takes what is left: the frames add up exactly
    return [{**it, "a": round(st, 4), "n": k} for st, k in zip(starts, ns) if k > 0]


def person_layer(ls, items, gaze=False):
    """The person layer for the whole video: cut pieces in chunks (cached by their cut and source), joined."""
    import hashlib
    tag = ("gaze-" + gaze_sig(ls)) if gaze else "orig"
    vids, masks, todo = [], [], []
    parts = [c for x in items for c in chunks(x)]
    for it in parts:
        # the eye-contact copy can be redone (NVIDIA retried after a v6 fallback): its time is part of the key
        gz = ls.work("gaze", f"{it.get('take')}.{gaze_sig(ls)}.mp4") if gaze and it.get("take") else None
        src_v = int(os.path.getmtime(gz)) if gz and os.path.exists(gz) else 0
        key = hashlib.md5(json.dumps({**{k: it[k] for k in ("kind", "take", "a", "t", "n", "sp") if k in it}, "src": tag, "src_v": src_v,
                                      "hide": bool((it.get("insert") or {}).get("hide")),
                                      "footage": (it.get("insert") or {}).get("footage"),
                                      "keep": keep_cfg(ls, ((it.get("insert") or {}).get("footage") or {}).get("take") or it.get("take")),
                                      "matte": ls.cfg.get("matte_engine", "fast") if ls.cfg.get("cutout") is not False else "none"},
                                     sort_keys=True).encode()).hexdigest()[:16]
        v, m = ls.work("pieces", f"{key}.v.mp4"), ls.work("pieces", f"{key}.m.mp4")
        vids.append(v)
        masks.append(m)
        ls.pieces_used = getattr(ls, "pieces_used", []) + [v, m]
        if not (os.path.exists(v) and os.path.exists(m)):
            todo.append((it, v, m, gaze))
    if todo:
        log(f"  · cutting {len(todo)} new pieces of {len(parts)}")
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


def pop_expr(a, b=None):
    """A layer's size over time when it pops in (springs past its size and settles in 0.35 s) and shrinks away in its
    last 0.2 s - the editor's popScale (render/ui/editor.tsx), as an ffmpeg expression of t."""
    p = f"clip((t-{a:.3f})/0.35,0,1)"
    s = f"(0.3+0.7*(1+2.70158*pow({p}-1,3)+1.70158*pow({p}-1,2)))"
    if b is not None:
        s += f"*(0.3+0.7*clip(({b:.3f}-t)/0.2,0,1))"
    return s


def compose(ls, items, total, caps, bg, person, mask, audio, preview, still_frame=None):
    """One pass: background photo + person (masked, graded, placed) + subtitles + text on video + speed.
    The preview is composed at half size, so it is quick; Export composes full size."""
    f = 0.5 if preview else 1.0
    w, h = int(W * f), int(H * f)
    pw, ph, x, y = layout(ls)
    pw, ph, x, y = int(pw * f) // 2 * 2, int(ph * f) // 2 * 2, int(x * f), int(y * f)
    spd = 1.0 if preview else min(2.0, max(0.5, float(ls.cfg.get("speed", 1.0))))
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
            inputs += ["-loop", "1", "-framerate", str(FPS), "-i", o["png"]]
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
          f";[b][fg]overlay={x}:{y}:shortest=1:format=auto[s]")
    if ls.cfg.get("fx"):  # camera & film: the picture alone, through fx_pass (OpenCV), then the text on top of it
        import cv2
        pic, pic_fx = ls.work("fx", "picture.mp4"), ls.work("fx", "picture_fx.mp4")
        if still_frame is not None:
            ff(*inputs, "-filter_complex", fc + ";[s]format=yuv420p[pv]", "-map", "[pv]", "-ss", f"{still_frame / FPS:.3f}",
               "-frames:v", "1", pic + ".png")
            curve = fx_curve(ls, still_frame + 1)
            cv2.imwrite(pic_fx + ".png", FxFrame(ls, w, h)(cv2.imread(pic + ".png"), curve[still_frame], still_frame))
            inputs += ["-loop", "1", "-framerate", str(FPS), "-i", pic_fx + ".png"]
        else:
            log("  · picture (set + person) -> camera & film")
            fx_pass(ls, [*inputs, "-filter_complex", fc + ";[s]format=bgr24[pv]", "-map", "[pv]", "-frames:v", str(total)], pic_fx, total, w, h)
            inputs += ["-i", pic_fx]
        fc = f"[{sum(1 for a in inputs if a == '-i') - 1}:v]setpts=PTS-STARTPTS,format=yuv420p[s]"
    fc += ";[s]null[v0]"  # (the subtitles go on last - over every sticker, panel and text)
    last = "v0"
    if iv_in is not None:
        ivs, ivf = float(iv.get("seconds", 5)), float(iv.get("fade", 0))
        fade = f",format=yuva420p,fade=t=out:st={max(0.0, ivs - ivf):.3f}:d={ivf:.3f}:alpha=1" if ivf > 0 else ""
        fc += (f";[{iv_in}:v]fps={FPS},scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setpts=PTS-STARTPTS{fade}[iv]"
               f";[{last}][iv]overlay=eof_action=pass[vi]")
        last = "vi"
    for k, o in enumerate(ovs):
        a, b = float(o.get("start") or 0), float(o.get("end") or total / FPS)
        en = f"between(t,{a:.3f},{b:.3f})"
        if o.get("blink"):  # a call to action that blinks: on 72% of each second - the editor's blinkOn()
            en += f"*lt(mod(t-{a:.3f},1),0.72)"
        fi, fo = float(o.get("fade_in") or 0), float(o.get("fade_out") or 0)  # seconds - the editor's fadeOp()
        fd = ((",format=rgba" + (f",fade=t=in:st={a:.3f}:d={fi:.3f}:alpha=1" if fi else "")
               + (f",fade=t=out:st={b - fo:.3f}:d={fo:.3f}:alpha=1" if fo else "")) if fi or fo else "")
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
        elif o.get("pop") and not o.get("anim"):
            # only the layer's own box (its visible pixels) is cut from the frame-size image and scaled around its centre
            import cv2
            al = cv2.imread(o["png"], cv2.IMREAD_UNCHANGED)
            ys_, xs_ = np.nonzero(al[..., 3] > 8) if al is not None and al.ndim == 3 and al.shape[2] == 4 else ([], [])
            if len(xs_):
                sx = w / al.shape[1]
                x0, y0 = int(xs_.min() * sx) // 2 * 2, int(ys_.min() * sx) // 2 * 2
                cw = min(w - x0, (int((xs_.max() + 1) * sx) - x0 + 1) // 2 * 2)
                ch = min(h - y0, (int((ys_.max() + 1) * sx) - y0 + 1) // 2 * 2)
                S = pop_expr(a, b if o.get("end") is not None else None)
                fc += (f";[{first_ov + k}:v]scale={w}:{h},format=rgba,crop={cw}:{ch}:{x0}:{y0},"
                       f"scale=w='max(2,trunc({cw}*{S}/2)*2)':h='max(2,trunc({ch}*{S}/2)*2)':eval=frame[o{k}]"
                       f";[{last}][o{k}]overlay=x='{x0 + cw / 2:.1f}-w/2':y='{y0 + ch / 2:.1f}-h/2':enable='{en}'[v{k + 1}]")
            else:
                fc += f";[{first_ov + k}:v]scale={w}:{h}{fd}[o{k}];[{last}][o{k}]overlay=enable='{en}'[v{k + 1}]"
        elif o.get("anim"):
            fc += (f";[{first_ov + k}:v]format=rgba,scale={w}:-2[o{k}];"
                   f"[{last}][o{k}]overlay=x=0:y={int(o['anim_y'] * f)}:eof_action=pass:enable='between(t,{a:.3f},{b:.3f})'[v{k + 1}]")
        else:
            fc += f";[{first_ov + k}:v]scale={w}:{h}{fd}[o{k}];[{last}][o{k}]overlay=enable='{en}'[v{k + 1}]"
        last = f"v{k + 1}"
    cap_en = f":enable='gte(t,{float(iv.get('seconds', 5)):.3f})'" if iv_in is not None else ""  # (not over the opening clip)
    fc += f";[3:v]fps={FPS},scale={w}:{h},format=rgba[c];[{last}][c]overlay=eof_action=pass{cap_en}[vc]"
    last = "vc"
    if ov_in is not None:
        fc += f";[{ov_in}:v]fps={FPS},scale={w}:{h},format=rgba[c2];[vc][c2]overlay=eof_action=pass{cap_en}[vc2]"
        last = "vc2"
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
    ap.add_argument("--stems", action="store_true", help="only the sound layers (a sound moved / removed in the editor)")
    ap.add_argument("--replan", action="store_true", help="the cut, subtitles and sound again - no picture work (an edge dragged)")
    ap.add_argument("--takes", action="store_true", help="only the takes' full videos the editor plays the cut over")
    ap.add_argument("--warm", action="store_true", help="the background render: the export's heavy layers, ready before Export")
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    if a.stems:
        build_stems(Lesson(a.episode))
    elif a.replan:
        replan(Lesson(a.episode))
    elif a.takes:
        take_proxies(Lesson(a.episode))
    elif a.warm:
        warm(Lesson(a.episode))
    else:
        build(Lesson(a.episode), a.still, a.preview)
