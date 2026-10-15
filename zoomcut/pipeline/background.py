"""Virtual background: cut each character out and put them in front of backgrounds/<character>.jpg.
Writes clips/<id>_bg.mp4 next to the proxy.

Two engines (episode.json "background_engine"):
  fast    (default) MediaPipe selfie segmenter — the kind of model video-call apps and CapCut use.
          ~45 fps on CPU; the whole episode takes a couple of minutes.
  quality RobustVideoMatting — finer hair edges, ~7 fps on CPU.
"""
import os
import subprocess

import numpy as np

from .common import FFMPEG, FPS, ROOT, log

MODEL = os.path.join(ROOT, "models", "rvm_mobilenetv3_fp32.onnx")
MP_MODEL = os.path.join(ROOT, "models", "selfie_segmenter.tflite")


class FastMatte:
    """MediaPipe selfie segmentation with light temporal smoothing against flicker."""

    def __init__(self, mode="video"):
        import mediapipe as mp
        from mediapipe.tasks import python as mpt
        from mediapipe.tasks.python import vision
        self.mp = mp
        self.video = mode == "video"
        self.seg = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(
            base_options=mpt.BaseOptions(model_asset_path=MP_MODEL),
            running_mode=vision.RunningMode.VIDEO if self.video else vision.RunningMode.IMAGE, output_confidence_masks=True))
        self.prev = None

    def reset(self):
        self.prev = None

    def __call__(self, rgb, n):
        import cv2
        img = self.mp.Image(image_format=self.mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))
        r = self.seg.segment_for_video(img, int(n * 1000 / FPS)) if self.video else self.seg.segment(img)
        m = r.confidence_masks[-1].numpy_view()
        if m.shape != rgb.shape[:2]:
            m = cv2.resize(m, (rgb.shape[1], rgb.shape[0]))
        if not self.video:
            return np.clip((m - 0.25) / 0.5, 0, 1)
        self.prev = m if self.prev is None else 0.6 * m + 0.4 * self.prev
        return np.clip((self.prev - 0.25) / 0.5, 0, 1)


class QualityMatte:
    """RobustVideoMatting; recurrent state keeps the matte stable between frames."""

    def __init__(self):
        self.sess = _session()
        self.ratio = np.array([0.5], np.float32)
        self.reset()

    def reset(self):
        self.rec = [np.zeros((1, 1, 1, 1), np.float32)] * 4

    def __call__(self, rgb, n):
        x = (rgb.astype(np.float32) / 255.0).transpose(2, 0, 1)[None]
        _, pha, *self.rec = self.sess.run(None, {"src": x, "r1i": self.rec[0], "r2i": self.rec[1], "r3i": self.rec[2],
                                                 "r4i": self.rec[3], "downsample_ratio": self.ratio})
        return np.clip((pha[0, 0] - 0.12) / 0.6, 0, 1)  # firm body, soft hair edge
_sess = None


def _session():
    global _sess
    if _sess is None:
        import onnxruntime as ort
        o = ort.SessionOptions()
        o.intra_op_num_threads = max(4, os.cpu_count() - 2)
        _sess = ort.InferenceSession(MODEL, o, providers=["CPUExecutionProvider"])
    return _sess


def find_background(ep, char):
    for ext in ("jpg", "jpeg", "png", "webp"):
        p = ep.p("backgrounds", f"{char}.{ext}")
        if os.path.exists(p):
            return p
    return None


def _cover(img, w, h):
    import cv2
    ih, iw = img.shape[:2]
    s = max(w / iw, h / ih)
    r = cv2.resize(img, (int(iw * s + 0.5), int(ih * s + 0.5)), interpolation=cv2.INTER_AREA)
    y, x = (r.shape[0] - h) // 2, (r.shape[1] - w) // 2
    return r[y:y + h, x:x + w]


def replace(ep, clip, bg_path, ranges=None, reuse=False, engine="fast"):
    """Matte small (long side 768), composite at full res in ffmpeg.
    ranges: [(start_s, end_s)] the edit actually shows; other frames are skipped (left as-is)."""
    import hashlib
    src = os.path.join(ep.public, clip["proxy"])
    dst = os.path.join(ep.public, "clips", clip["id"] + "_bg.mp4")
    matte = ep.work("matte", clip["id"] + ".mkv")
    need = None
    if engine == "fast":
        ranges = None  # ~45 fps: cheaper to cut out the whole take once than to redo it per edit
    if ranges is not None:
        n_frames = int(clip["duration"] * FPS) + 2
        need = np.zeros(n_frames, bool)
        for a, b in ranges:
            need[max(0, int(a * FPS) - 20): min(n_frames, int(b * FPS) + 2)] = True
    sig = hashlib.sha1(need.tobytes()).hexdigest()[:10] if need is not None else "all"
    stamp = f"{os.path.getmtime(src)}|{os.path.getmtime(bg_path)}|{sig}|{engine}"
    stamp_file = dst + ".stamp"
    if reuse and engine != "fast" and os.path.exists(dst) and os.path.exists(stamp_file):
        return "clips/" + clip["id"] + "_bg.mp4"  # preview: a slightly stale matte is fine
    if os.path.exists(dst) and os.path.exists(stamp_file) and open(stamp_file).read() == stamp:
        return "clips/" + clip["id"] + "_bg.mp4"
    w, h = clip["w"], clip["h"]
    # matte small (long side 768) and let ffmpeg scale the alpha up: a soft edge reads as a real
    # Zoom virtual background, and it is ~4x cheaper than matting at 960
    long_side = 768
    mw = long_side if w >= h else int(round(long_side * w / h / 2) * 2)
    mh = int(round(mw * h / w / 2) * 2)
    share = f", {need.mean() * 100:.0f}% of frames" if need is not None else ""
    log(f"  · background ({engine}) → {clip['rel']} ({os.path.basename(bg_path)}{share})")
    dec = subprocess.Popen([FFMPEG, "-v", "error", "-i", src, "-vf", f"scale={mw}:{mh}:flags=area",
                            "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen([FFMPEG, "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{mw}x{mh}",
                            "-r", str(FPS), "-i", "-", "-c:v", "ffv1", matte], stdin=subprocess.PIPE)
    matte_fn = FastMatte() if engine == "fast" else QualityMatte()
    every = 1 if engine == "fast" else 2  # quality engine reuses each matte for the next frame
    size = mw * mh * 3
    full = bytes([255]) * (mw * mh)
    last = None
    n = 0
    while True:
        buf = dec.stdout.read(size)
        if len(buf) < size:
            break
        if n % 150 == 0 and n:
            log(f"    cutting out {clip['rel']}: {n / FPS:.0f}s of {clip['duration']:.0f}s")
        if need is not None and (n >= len(need) or not need[n]):
            enc.stdin.write(full)
            matte_fn.reset()
            last = None
            n += 1
            continue
        if n % every and last is not None:
            enc.stdin.write(last)
            n += 1
            continue
        a = matte_fn(np.frombuffer(buf, np.uint8).reshape(mh, mw, 3), n)
        last = (a * 255).astype(np.uint8).tobytes()
        enc.stdin.write(last)
        n += 1
    enc.stdin.close()
    enc.wait()
    dec.wait()
    # soften the matte edge a touch, scale it up, and lay the person over the background
    fc = (f"[1:v]scale={w}:{h}:flags=bicubic,gblur=sigma=1.0,format=gray[a];"
          f"[0:v][a]alphamerge[fg];"
          f"[2:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},format=yuv420p[bg];"
          f"[bg][fg]overlay=shortest=1:format=auto,format=yuv420p[v]")
    from .common import run
    run([FFMPEG, "-y", "-v", "error", "-i", src, "-i", matte, "-loop", "1", "-framerate", str(FPS), "-i", bg_path,
         "-filter_complex", fc, "-map", "[v]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-g", "15",
         "-movflags", "+faststart", dst])
    open(stamp_file, "w").write(stamp)
    return "clips/" + clip["id"] + "_bg.mp4"
