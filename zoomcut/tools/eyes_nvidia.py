"""Eye contact by NVIDIA Maxine (the model behind NVIDIA Broadcast) + our own blink handling - the studio's default.

  python tools/eyes_nvidia.py SRC OUT [--raw] [--open 0.18,0.26] [--keep-raw RAW.mp4] [--seconds N]

1. The take goes to NVIDIA's hosted Eye Contact (an upright H.264 copy - iPhone takes are HEVC), with the settings that
   won against CapCut: NVIDIA's own closure detection OFF (it takes filter-drawn eyes for closed ones and stops
   correcting), a wider eye blend, redirection kept on up to wide glances.
2. Only the eye region of NVIDIA's result is laid on the ORIGINAL frames, faded in by how open the eyes are (MediaPipe,
   per frame, smoothed over time, both eyes together) - closed / narrowed eyes and everything else stay as filmed, so
   no tone shift and no re-encode loss. Frames where the face tracker misses are filled from the frames around them
   (a missed frame is not a blink).

Key: NVIDIA_API_KEY (nvapi-...) in zoomcut/.env, never printed. NVIDIA's client: nim-clients/eye-contact (MAXINE_CLIENT).
The hosted API is NVIDIA's trial (evaluation licence); a production licence is NVIDIA AI Enterprise.
"""
import argparse
import os
import subprocess
import sys
import tempfile
import time

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gaze_video as G  # noqa: E402  (frames, sizes, colour format, the eye outlines, the face model)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIENT = os.environ.get("MAXINE_CLIENT", "C:/tmp/maxine/nim-clients/eye-contact/scripts")
PY = os.environ.get("MAXINE_PY", "C:/tmp/maxine/venv/Scripts/python.exe")
FUNCTION_ID = "480bffcb-6fea-4571-9741-eb50212c9c0f"  # "ai-eyecontact" on NVIDIA's cloud (their README's id is stale)
NV_FLAGS = ["--detect-closure", "0", "--eye-size-sensitivity", "5",
            "--gaze-pitch-threshold-low", "30", "--gaze-pitch-threshold-high", "35",
            "--gaze-yaw-threshold-low", "30", "--gaze-yaw-threshold-high", "35"]


def key():
    if os.environ.get("NVIDIA_API_KEY"):
        return os.environ["NVIDIA_API_KEY"]
    p = os.path.join(ROOT, ".env")
    if os.path.exists(p):
        for line in open(p, encoding="utf-8"):
            k, _, v = line.strip().partition("=")
            if k == "NVIDIA_API_KEY" and v:
                return v.strip().strip('"').strip("'")
    raise SystemExit("no NVIDIA_API_KEY - put NVIDIA_API_KEY=nvapi-... in zoomcut/.env")


def nvidia(src, out, seconds=None, extra=()):
    """The take through NVIDIA's Eye Contact -> out (NVIDIA's whole frame)."""
    with tempfile.TemporaryDirectory() as tmp:
        h264 = os.path.join(tmp, "in.mp4")  # upright H.264, every frame kept as it is (NVIDIA takes H.264 MP4 only)
        subprocess.run([G.FFMPEG, "-y", "-v", "error", "-i", src, *(["-t", str(seconds)] if seconds else []), "-map", "0:v", "-map", "0:a?",
                        "-c:v", "libx264", "-preset", "fast", "-crf", "12", "-pix_fmt", "yuv420p", "-fps_mode", "passthrough",
                        "-c:a", "aac", "-movflags", "+faststart", h264], check=True)
        r = subprocess.run([PY, "eye-contact.py", "--preview-mode", "--target", "grpc.nvcf.nvidia.com:443", "--function-id", FUNCTION_ID,
                            "--api-key", key(), "--input", h264, "--output", os.path.abspath(out), *NV_FLAGS, *extra],
                           cwd=CLIENT, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0 or not os.path.exists(out) or os.path.getsize(out) < 1000 or "error occurred" in r.stdout.lower():
        tail = (r.stdout + r.stderr).replace(key(), "***")[-600:]
        raise SystemExit(f"NVIDIA eye contact failed: {tail}")


def smooth(e0, e1, x):
    t = np.clip((np.asarray(x, np.float32) - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def over_time(x, sigma=2.0):
    """Gaussian over time, both ways: a blink fades out just before it starts and back in just after it ends."""
    k = np.exp(-0.5 * (np.arange(-6, 7) / sigma) ** 2)
    return np.convolve(np.pad(np.asarray(x, np.float32), 6, mode="edge"), k / k.sum(), mode="valid")


def track(src, w, h, fps, seconds=None):
    import mediapipe as mp
    from mediapipe.tasks import python as mpt
    from mediapipe.tasks.python import vision
    det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
        base_options=mpt.BaseOptions(model_asset_path=G.MODEL), running_mode=vision.RunningMode.VIDEO, num_faces=1))
    tr = []
    for i, f in enumerate(G.frames(src, w, h, seconds)):
        r = det.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(f[:, :, ::-1])), int(i * 1000 / fps))
        tr.append(np.array([[p.x * w, p.y * h] for p in r.face_landmarks[0]], np.float32) if r.face_landmarks else None)
    found = [i for i, P in enumerate(tr) if P is not None]
    for i, P in enumerate(tr):  # a missed frame or two (motion blur): filled from the frames around it
        if P is None and found:
            prv = max((j for j in found if j < i), default=None)
            nxt = min((j for j in found if j > i), default=None)
            if prv is not None and nxt is not None and nxt - prv <= 12:
                u = (i - prv) / (nxt - prv)
                tr[i] = tr[prv] * (1 - u) + tr[nxt] * u
            elif prv is not None and i - prv <= 6:
                tr[i] = tr[prv]
            elif nxt is not None and nxt - i <= 6:
                tr[i] = tr[nxt]
    return tr, len(found)


def openness(P, name):
    e = G.EYES[name]
    width = np.linalg.norm(P[e["b"]] - P[e["a"]])
    return float(np.linalg.norm(P[e["lo"]] - P[e["up"]]) / max(width, 1.0))


def blend(src, nv, out, lo=0.18, hi=0.26, seconds=None, log=print, tracked=None):
    """NVIDIA's eyes on the original frames, only while the eyes are open."""
    w, h, fps = G.display_size(src)
    tr, n_found = tracked or track(src, w, h, fps, seconds)
    wt = [np.clip(over_time(smooth(lo, hi, [openness(P, n) if P is not None else 0.0 for P in tr])), 0, 1) for n in ("left", "right")]
    both = np.minimum(*wt)  # a person blinks with both eyes - they never disagree
    log(f"  · face in {n_found}/{len(tr)} frames; NVIDIA's eyes used in {np.mean(both > 0.5) * 100:.0f}% of them")
    enc = subprocess.Popen([G.FFMPEG, "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", f"{fps}", "-i", "-",
                            "-i", src, "-map", "0:v", "-map", "1:a?", "-c:a", "copy", *G.colour_args(src),
                            "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-movflags", "+faststart", out], stdin=subprocess.PIPE)
    nvf = G.frames(nv, w, h, seconds)
    for i, f in enumerate(G.frames(src, w, h, seconds)):
        n = next(nvf, None)
        g = f
        P = tr[i] if i < len(tr) else None
        if n is not None and P is not None and both[i] > 0.01:
            # only the box around the eyes is touched (the rest of the frame is the original, untouched)
            width = np.linalg.norm(P[33] - P[133])
            pts = P[G.CONTOUR["left"] + G.CONTOUR["right"]]
            pad = int(width * 0.9) + 4
            x0, y0 = max(0, int(pts[:, 0].min()) - pad), max(0, int(pts[:, 1].min()) - pad)
            x1, y1 = min(w, int(pts[:, 0].max()) + pad), min(h, int(pts[:, 1].max()) + pad)
            m = np.zeros((y1 - y0, x1 - x0), np.float32)
            for name in ("left", "right"):
                poly = P[G.CONTOUR[name]]
                c = poly.mean(axis=0)
                cv2.fillPoly(m, [np.round(c + (poly - c) * np.array([1.35, 2.1]) - [x0, y0]).astype(np.int32)], 1.0)
            m = cv2.GaussianBlur(m, (0, 0), max(2.0, width * 0.12))[..., None] * both[i]
            g = f.copy()
            g[y0:y1, x0:x1] = np.clip(f[y0:y1, x0:x1] * (1 - m) + n[y0:y1, x0:x1] * m, 0, 255).astype(np.uint8)
        enc.stdin.write(np.ascontiguousarray(g).tobytes())
    enc.stdin.close()
    enc.wait()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--raw", action="store_true", help="NVIDIA's whole frame, without our blink handling")
    ap.add_argument("--keep-raw", help="also keep NVIDIA's whole-frame result here")
    ap.add_argument("--open", default="0.18,0.26", help="eye openness: below the first = filmed, above the second = NVIDIA")
    ap.add_argument("--seconds", type=float)
    a, extra = ap.parse_known_args()
    sys.stdout.reconfigure(encoding="utf-8")
    t0 = time.time()
    if a.raw:
        nvidia(a.src, a.out, a.seconds, extra)
    else:
        with tempfile.TemporaryDirectory() as tmp:
            raw = a.keep_raw or os.path.join(tmp, "nvidia.mp4")
            # the face is tracked here while NVIDIA works on the take (they don't need each other)
            import threading
            w, h, fps = G.display_size(a.src)
            got = {}
            th = threading.Thread(target=lambda: got.update(tr=track(a.src, w, h, fps, a.seconds)))
            th.start()
            try:
                nvidia(a.src, raw, a.seconds, extra)
            except SystemExit:
                th.join()  # let the tracker finish before leaving (a clean failure, not a thread traceback)
                raise
            print(f"  · NVIDIA done ({time.time() - t0:.0f}s)", flush=True)
            th.join()
            blend(a.src, raw, a.out, *map(float, a.open.split(",")), seconds=a.seconds, tracked=got["tr"])
    print(f"✔ {a.out}  ({time.time() - t0:.0f}s)")


if __name__ == "__main__":
    main()
