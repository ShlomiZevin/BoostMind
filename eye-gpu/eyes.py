"""Eye contact, generative (LivePortrait on a GPU) - the CapCut-class fix, made our own.

Every frame the face is rendered twice by LivePortrait - as filmed, and with the eyeballs turned to the lens - and only
the difference between the two, inside the eyes, is added to the real frame. So the network redraws the eye (white,
iris, lid shading) while every other pixel stays the filmed one. The turn per frame comes from where the iris is seen
in the picture (MediaPipe outline + the dark of the iris), so it follows the eyes as they read.

  python eyes.py SRC OUT [--seconds N] [--k 180] [--y 0] [--batch 8] [--preview]
"""
import argparse
import os
import subprocess
import sys
import time

import cv2
import numpy as np
import torch

HERE = os.path.dirname(os.path.abspath(__file__))
LP = os.environ.get("LP_REPO", os.path.join(HERE, "LivePortrait"))
sys.path.insert(0, LP)
from src.config.inference_config import InferenceConfig  # noqa: E402
from src.live_portrait_wrapper import LivePortraitWrapper  # noqa: E402
from src.utils.camera import get_rotation_matrix  # noqa: E402
from src.utils.crop import crop_image  # noqa: E402

FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
MODEL = os.path.join(HERE, "face_landmarker.task")

# MediaPipe face mesh: each eye's opening outline, corners and lids
CONTOUR = {
    "right": [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
    "left": [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
}
EYES = {"right": {"a": 33, "b": 133, "up": 159, "lo": 145}, "left": {"a": 362, "b": 263, "up": 386, "lo": 374}}


# ---- video in / out ---------------------------------------------------------------------------------------
def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate",
                          "-of", "default=nw=1", path], capture_output=True, text=True).stdout
    d = dict(l.split("=", 1) for l in out.splitlines() if "=" in l)
    n, m = d.get("r_frame_rate", "30/1").split("/")
    return int(d["width"]), int(d["height"]), float(n) / float(m or 1)


def display_size(path):
    """Width/height as the frames come out of ffmpeg (after the phone's rotation)."""
    out = subprocess.run([FFMPEG, "-v", "error", "-i", path, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True).stdout
    w, h, fps = probe(path)
    return (w, h, fps) if len(out) == w * h else (h, w, fps)


def colour_args(src):
    """The source's own colour format (filter apps export full range - keep it, or the tones wash)."""
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=pix_fmt,color_range,color_space,color_primaries,color_transfer",
                          "-of", "default=nw=1", src], capture_output=True, text=True).stdout
    d = dict(l.split("=", 1) for l in out.splitlines() if "=" in l)
    full = d.get("color_range") == "pc" or d.get("pix_fmt", "").startswith("yuvj")
    args = ["-pix_fmt", "yuvj420p" if full else "yuv420p", "-color_range", "pc" if full else "tv"]
    for k, flag in (("color_space", "-colorspace"), ("color_primaries", "-color_primaries"), ("color_transfer", "-color_trc")):
        if d.get(k) and d[k] != "unknown":
            args += [flag, d[k]]
    return args


def frames(path, w, h, seconds=None):
    args = [FFMPEG, "-v", "error", "-i", path] + (["-t", str(seconds)] if seconds else [])
    p = subprocess.Popen(args + ["-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    size = w * h * 3
    while True:
        buf = p.stdout.read(size)
        if len(buf) < size:
            break
        yield np.frombuffer(buf, np.uint8).reshape(h, w, 3)
    p.wait()


# ---- where the eyes look ------------------------------------------------------------------------------------
def iris_in_picture(gray, pts):
    """The iris = the dark round part inside the eye opening, found from the pixels (a face filter's drawn eyes
    don't follow the face model's own iris points). The outline is pulled in from the lids first."""
    c = pts.mean(axis=0)
    inner = c + (pts - c) * np.array([0.82, 0.55])
    x0, y0 = np.floor(inner.min(axis=0)).astype(int)
    x1, y1 = np.ceil(inner.max(axis=0)).astype(int) + 1
    if x1 - x0 < 6 or y1 - y0 < 3:
        return None
    roi = gray[y0:y1, x0:x1].astype(np.float32)
    mask = np.zeros(roi.shape, np.uint8)
    cv2.fillPoly(mask, [np.round(inner - [x0, y0]).astype(np.int32)], 1)
    vals = roi[mask > 0]
    if vals.size < 12:
        return None
    thr = np.percentile(vals, 40)
    wgt = np.clip(thr - roi, 0, None) * mask
    if wgt.sum() <= 0:
        return None
    yy, xx = np.mgrid[0:roi.shape[0], 0:roi.shape[1]]
    return np.array([(xx * wgt).sum() / wgt.sum() + x0, (yy * wgt).sum() / wgt.sum() + y0])


def iris_offset(gray, P):
    """Sideways iris position in eye widths from the middle (both eyes averaged); None in a blink / narrow eyes."""
    vals = []
    for name, e in EYES.items():
        poly = P[CONTOUR[name]]
        a, b = P[e["a"]], P[e["b"]]
        width = np.linalg.norm(b - a)
        if width < 12 or np.linalg.norm(P[e["lo"]] - P[e["up"]]) / width < 0.2:
            continue
        seen = iris_in_picture(gray, poly)
        if seen is not None:
            vals.append((seen[0] - (a[0] + b[0]) / 2) / width)
    return float(np.mean(vals)) if vals else None


def eye_mask_roi(P, x0, y0, sw, sh, grow=(1.25, 1.7)):
    """Both eyes (the opening grown to take in the lids' edge), soft - where the network's change is let in."""
    m = np.zeros((sh, sw), np.float32)
    for name in ("left", "right"):
        poly = P[CONTOUR[name]]
        c = poly.mean(axis=0)
        cv2.fillPoly(m, [np.round(c + (poly - c) * np.array(grow) - [x0, y0]).astype(np.int32)], 1.0)
    width = np.linalg.norm(P[33] - P[133])
    return cv2.GaussianBlur(m, (0, 0), max(1.5, width * 0.08))


def five_points(P):
    """LivePortrait's crop wants 5 points: the eyes, the nose tip, the mouth corners (image left first)."""
    le = P[[33, 133, 159, 145]].mean(axis=0)
    re = P[[362, 263, 386, 374]].mean(axis=0)
    eyes = sorted([le, re], key=lambda p: p[0])
    mouth = sorted([P[61], P[291]], key=lambda p: p[0])
    return np.array([eyes[0], eyes[1], P[1], mouth[0], mouth[1]], np.float32)


# ---- the network --------------------------------------------------------------------------------------------
class Redirect:
    def __init__(self, device):
        gpu = device.startswith("cuda")
        self.W = LivePortraitWrapper(inference_cfg=InferenceConfig(flag_force_cpu=not gpu, flag_use_half_precision=gpu, device_id=0))
        self.dev = self.W.device

    @torch.no_grad()
    def diffs(self, crops, xs, ys):
        """crops: B x 256 x 256 x 3 RGB uint8; xs, ys: eyeball turn per frame -> B x 512 x 512 x 3 float (turned - as filmed)."""
        W = self.W
        I = torch.from_numpy(np.stack(crops).astype(np.float32) / 255.0).permute(0, 3, 1, 2).to(self.dev)
        info = W.get_kp_info(I)
        f_s = W.extract_feature_3d(I)
        x_s = W.transform_keypoint(info)
        R = get_rotation_matrix(info["pitch"], info["yaw"], info["roll"])
        x = torch.tensor(xs, dtype=torch.float32, device=self.dev)[:, None]
        y = torch.tensor(ys, dtype=torch.float32, device=self.dev)[:, None]
        exp = info["exp"].clone()
        # LivePortrait's own eyeball-direction control (its retargeting UI), per frame
        exp[:, 11, 0] += torch.where(x > 0, x * 0.0007, x * 0.001)[:, 0]
        exp[:, 15, 0] += torch.where(x > 0, x * 0.001, x * 0.0007)[:, 0]
        blink = -y / 2.0
        exp[:, 11, 1] += (y * -0.001 + blink * -0.001)[:, 0]
        exp[:, 15, 1] += (y * -0.001 + blink * -0.001)[:, 0]
        exp[:, 13, 1] += (blink * 0.0003)[:, 0]
        exp[:, 16, 1] += (blink * 0.0003)[:, 0]

        def kp(e):
            k = info["kp"] @ R + e
            k = k * info["scale"][..., None]
            k[:, :, 0:2] += info["t"][:, None, 0:2]
            return W.stitching(x_s, k)

        out = W.warp_decode(torch.cat([f_s, f_s]), torch.cat([x_s, x_s]), torch.cat([kp(info["exp"]), kp(exp)]))["out"]
        n = len(crops)
        d = (out[n:] - out[:n]).clamp(-1, 1) * 255.0
        return d.permute(0, 2, 3, 1).float().cpu().numpy()


_NETS = {}


def run(src, out, seconds=None, k=180.0, y=0.0, batch=8, preview=False, device=None, log=print):
    import mediapipe as mp
    from mediapipe.tasks import python as mpt
    from mediapipe.tasks.python import vision
    device = device or ("cuda" if torch.cuda.is_available() else "cpu")
    t0 = time.time()
    if device not in _NETS:  # loaded once per container, kept warm between videos
        _NETS[device] = Redirect(device)
    net = _NETS[device]
    det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
        base_options=mpt.BaseOptions(model_asset_path=MODEL), running_mode=vision.RunningMode.VIDEO, num_faces=1))
    w, h, fps = display_size(src)
    ow = w * 2 if preview else w
    enc = subprocess.Popen([FFMPEG, "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{ow}x{h}", "-r", f"{fps}", "-i", "-",
                            *([] if preview else ["-i", src, "-map", "0:v", "-map", "1:a?", "-c:a", "copy"]),
                            *colour_args(src), "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-movflags", "+faststart", out],
                           stdin=subprocess.PIPE)
    log(f"loaded on {device} in {time.time() - t0:.1f}s; {w}x{h} @ {fps:.2f}")
    sm, n_done, n_fixed, t_gpu = None, 0, 0, 0.0
    pend = []  # frames waiting for the batch: (frame, P or None, turn or None)

    def flush():
        nonlocal n_fixed, t_gpu
        work = [i for i, (_, P, turn) in enumerate(pend) if P is not None and turn is not None]
        if work:
            crops, Ms, xs, ys = [], [], [], []
            for i in work:
                f, P, turn = pend[i]
                ci = crop_image(np.ascontiguousarray(f[:, :, ::-1]), five_points(P), dsize=512, scale=2.3, vy_ratio=-0.125, flag_do_rot=True)
                crops.append(cv2.resize(ci["img_crop"], (256, 256), interpolation=cv2.INTER_AREA))
                Ms.append(ci["M_c2o"][:2])
                xs.append(turn[0])
                ys.append(turn[1])
            tg = time.time()
            D = net.diffs(crops, xs, ys)
            t_gpu += time.time() - tg
            for j, i in enumerate(work):
                f, P, _ = pend[i]
                eyes = P[CONTOUR["left"] + CONTOUR["right"]]
                pad = int(np.linalg.norm(P[33] - P[133]) * 0.9)
                x0, y0 = max(0, int(eyes[:, 0].min()) - pad), max(0, int(eyes[:, 1].min()) - pad)
                x1, y1 = min(w, int(eyes[:, 0].max()) + pad), min(h, int(eyes[:, 1].max()) + pad)
                M = Ms[j].copy()
                M[:, 2] -= [x0, y0]  # straight into the eyes' box
                d = cv2.warpAffine(D[j], M, (x1 - x0, y1 - y0), flags=cv2.INTER_LINEAR)
                m = eye_mask_roi(P, x0, y0, x1 - x0, y1 - y0)[..., None]
                g = f.copy()
                g[y0:y1, x0:x1] = np.clip(f[y0:y1, x0:x1].astype(np.float32) + d[:, :, ::-1] * m, 0, 255).astype(np.uint8)
                pend[i] = (g, P, "done")
                n_fixed += 1
        for f, P, turn in pend:
            src_f = f
            enc.stdin.write((np.hstack([orig.pop(0), src_f]) if preview else src_f).tobytes())
        pend.clear()

    orig = []
    for i, f in enumerate(frames(src, w, h, seconds)):
        r = det.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(f[:, :, ::-1])), int(i * 1000 / fps))
        P, turn = None, None
        if r.face_landmarks:
            P = np.array([[p.x * w, p.y * h] for p in r.face_landmarks[0]], np.float32)
            off = iris_offset(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY), P)
            if off is None:
                sm = None  # blink / narrow: as filmed, and start fresh after it
            else:
                sm = off if sm is None else sm * 0.6 + off * 0.4  # steady - no shimmer
                if abs(sm) > 0.004 or y:
                    turn = (float(np.clip(-k * sm, -35, 35)), y)
        if preview:
            orig.append(f)
        pend.append((f, P, turn))
        n_done += 1
        if len(pend) >= batch:
            flush()
        if i % 300 == 0:
            log(f"  · {i / fps:.0f}s  ({time.time() - t0:.0f}s, GPU {t_gpu:.0f}s)")
    flush()
    enc.stdin.close()
    enc.wait()
    took = time.time() - t0
    log(f"done: {n_done} frames, {n_fixed} redrawn, {took:.0f}s total (GPU {t_gpu:.0f}s)")
    return {"frames": n_done, "redrawn": n_fixed, "seconds": round(took, 1), "gpu_seconds": round(t_gpu, 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--seconds", type=float)
    ap.add_argument("--k", type=float, default=180.0, help="eyeball turn per eye-width of iris offset (calibrated: 180)")
    ap.add_argument("--y", type=float, default=0.0, help="a constant up (+) / down (-) turn")
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--device")
    ap.add_argument("--preview", action="store_true", help="filmed | corrected side by side")
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    print(run(a.src, a.out, a.seconds, a.k, a.y, a.batch, a.preview, a.device))


if __name__ == "__main__":
    main()
