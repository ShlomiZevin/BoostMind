"""Footage discovery, proxies, audio extraction, face framing, loudness envelope."""
import hashlib
import os
import re
import wave

import numpy as np

from .common import FFMPEG, FPS, SR, ffprobe, load_json, log, run, save_json

VIDEO_EXT = {".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi", ".mts"}
LISTEN_WORDS = ("listen", "react", "idle", "silent", "שקט", "הקשבה", "תגובה", "תגובות", "מקשיב")


def scan(ep):
    """Find every video under input/ and decide character + kind (lines | listen)."""
    root = ep.cfg.get("input_dir") or ep.p("input")
    explicit = {k.lower(): v for k, v in ep.cfg.get("files", {}).items()}
    clips, unassigned = [], []
    for dirpath, _, files in os.walk(root):
        for fn in sorted(files):
            if os.path.splitext(fn)[1].lower() not in VIDEO_EXT:
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, root).replace("\\", "/")
            spec = explicit.get(rel.lower()) or explicit.get(fn.lower())
            if isinstance(spec, str):
                spec = {"char": spec}
            if (spec or {}).get("skip"):  # e.g. a retake that replaced this file
                continue
            char = (spec or {}).get("char") or _guess_char(rel, ep.characters)
            kind = (spec or {}).get("kind") or ("listen" if any(w in rel.lower() for w in LISTEN_WORDS) else "lines")
            if not char:
                unassigned.append(rel)
                continue
            cid = f"{char}_{hashlib.sha1(rel.encode()).hexdigest()[:6]}"
            clips.append({"id": cid, "char": char, "kind": kind, "rel": rel, "src": full})
    return clips, unassigned


def _guess_char(rel, characters):
    parts = [p.lower() for p in re.split(r"[\\/]", rel)]
    tokens = " ".join(parts)
    hits = []
    for c in characters:
        for a in {c["id"], c["name"], *c.get("aliases", [])}:
            a = a.lower()
            if re.search(r"(?<![a-z֐-׿])" + re.escape(a) + r"(?![a-z֐-׿])", tokens):
                hits.append(c["id"])
                break
    return hits[0] if len(set(hits)) == 1 else None


def prepare(ep, clip):
    """Make a CFR 30fps proxy for rendering and two wavs (clean 48k for the mix, raw 16k for ASR).
    Audio is shifted so that t=0 is the first video frame. Skips work that is already up to date."""
    src_m = os.path.getmtime(clip["src"])
    proxy = os.path.join(ep.public, "clips", clip["id"] + ".mp4")
    wav = ep.work("audio", clip["id"] + ".wav")
    wav16 = ep.work("audio16", clip["id"] + ".wav")
    meta_path = ep.work("meta", clip["id"] + ".json")
    meta = load_json(meta_path)
    if meta and meta.get("src_mtime") == src_m and all(os.path.exists(p) for p in (proxy, wav, wav16)):
        clip.update(meta["clip"])
        if clip.get("framing", {}).get("v") != FRAMING_VERSION:
            clip["framing"] = face_framing(proxy, clip["w"], clip["h"])
            meta["clip"]["framing"] = clip["framing"]
            save_json(meta_path, meta)
        return clip

    info = ffprobe(clip["src"])
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    a = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
    rot = int(float((v.get("tags") or {}).get("rotate", 0) or 0))
    for sd in v.get("side_data_list", []) or []:
        if "rotation" in sd:
            rot = int(float(sd["rotation"]))
    w, h = int(v["width"]), int(v["height"])
    if abs(rot) in (90, 270):
        w, h = h, w
    scale = min(1.0, 1920 / max(w, h))
    pw, ph = int(round(w * scale / 2) * 2), int(round(h * scale / 2) * 2)
    os.makedirs(os.path.dirname(proxy), exist_ok=True)
    log(f"  · proxy {clip['rel']} ({w}×{h} → {pw}×{ph})")
    run([FFMPEG, "-y", "-v", "error", "-i", clip["src"], "-an",
         "-vf", f"fps={FPS},scale={pw}:{ph}:flags=lanczos,format=yuv420p",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-g", "15", "-movflags", "+faststart", proxy])

    if a is None:
        raise RuntimeError(f"{clip['rel']} has no audio track")
    offset = float(a.get("start_time", 0) or 0) - float(v.get("start_time", 0) or 0)
    shift = (f"adelay={int(offset * 1000)}:all=1," if offset > 0.005 else
             f"atrim=start={-offset:.4f},asetpts=PTS-STARTPTS," if offset < -0.005 else "")
    run([FFMPEG, "-y", "-v", "error", "-i", clip["src"], "-vn",
         "-af", shift + "highpass=f=80,afftdn=nr=12:nf=-35", "-ac", "1", "-ar", str(SR), wav])
    run([FFMPEG, "-y", "-v", "error", "-i", clip["src"], "-vn",
         "-af", (shift[:-1] if shift else "anull"), "-ac", "1", "-ar", "16000", wav16])

    dur = float(info["format"]["duration"])
    clip.update({"w": pw, "h": ph, "duration": dur, "proxy": "clips/" + clip["id"] + ".mp4",
                 "framing": face_framing(proxy, pw, ph)})
    save_json(meta_path, {"src_mtime": src_m, "clip": {k: clip[k] for k in ("w", "h", "duration", "proxy", "framing")}})
    return clip


FRAMING_VERSION = 2


def face_framing(video, w, h, samples=12):
    """Where the person is, from the selfie-segmentation silhouette (works with wigs, hats and face
    filters, where face detectors give up): median head-top and horizontal centre of the head."""
    import cv2
    from .background import FastMatte
    cap = cv2.VideoCapture(video)
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
    seg = FastMatte(mode="image")
    tops, xs, widths = [], [], []
    for i in range(samples):
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(n * (i + 0.5) / samples))
        ok, frame = cap.read()
        if not ok:
            continue
        small = cv2.resize(frame, (256, int(256 * h / w)))
        m = seg(cv2.cvtColor(small, cv2.COLOR_BGR2RGB), i) > 0.5
        rows = np.where(m.mean(axis=1) > 0.04)[0]
        if not len(rows):
            continue
        top = rows[0]
        head = m[top: top + max(4, int(m.shape[0] * 0.15))]
        cols = np.where(head.any(axis=0))[0]
        tops.append(top / m.shape[0])
        xs.append((cols.mean() if len(cols) else m.shape[1] / 2) / m.shape[1])
        widths.append(len(cols) / m.shape[1] if len(cols) else 0.3)
    cap.release()
    if not tops:
        return {"v": FRAMING_VERSION, "cx": 0.5, "top": 0.12, "hw": 0.35, "found": False}
    return {"v": FRAMING_VERSION, "cx": round(float(np.median(xs)), 4), "top": round(float(np.median(tops)), 4),
            "hw": round(float(np.median(widths)), 4), "found": True}


def read_wav(path):
    with wave.open(path, "rb") as wf:
        sr = wf.getframerate()
        data = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    return data, sr


def envelope(path, hop=0.01):
    """RMS in dB per 10 ms window."""
    data, sr = read_wav(path)
    n = int(sr * hop)
    frames = len(data) // n
    if frames == 0:
        return np.array([-90.0]), hop
    x = data[: frames * n].reshape(frames, n)
    rms = np.sqrt((x ** 2).mean(axis=1) + 1e-12)
    return 20 * np.log10(rms + 1e-9), hop


def preview_copy(ep, rel_src):
    """A light 540p copy for the editor's browser preview (three full-res phone videos at once make
    the browser fall behind the audio). The export always renders from the full-resolution file."""
    src = os.path.join(ep.public, rel_src)
    rel = rel_src[:-4] + ".preview.mp4"
    dst = os.path.join(ep.public, rel)
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        return rel
    run([FFMPEG, "-y", "-v", "error", "-i", src, "-vf", "scale='if(gt(iw,ih),960,540)':-2:flags=bilinear",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-g", "10", "-pix_fmt", "yuv420p", "-an",
         "-movflags", "+faststart", dst + ".tmp.mp4"])
    os.replace(dst + ".tmp.mp4", dst)
    return rel
