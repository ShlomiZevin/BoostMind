"""Eye contact for video - you read off to the side, the result looks into the lens. No AI re-drawing: the irises
are moved inside the eye openings (the same warp as tools/gaze_fix.py, which Shlomi approved on his photo), so the
face, lids, glasses and skin stay exactly as filmed.

    .venv\\Scripts\\python tools/gaze_video.py in.mp4 out.mp4                  full clip, sound kept
    .venv\\Scripts\\python tools/gaze_video.py in.mp4 out.mp4 --preview 12     first 12 s, before | after side by side
    .venv\\Scripts\\python tools/gaze_video.py in.mp4 out.mp4 --strength 0.8 --dy 0.5

How: MediaPipe's face landmarks (with iris points) on every frame. Where your eyes REST while reading (the median
iris position in each eye, over the whole clip) is your reading offset - only that is removed, so the small natural
movements stay and the eyes do not go dead. Blinks and big glances away are left alone; the shift is smoothed.
Works best for a screen near the lens (a small offset); for a screen far to the side the head turns too.
"""
import argparse
import os
import subprocess
import sys

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = os.path.join(ROOT, "models", "face_landmarker.task")
FFMPEG = "ffmpeg"

# MediaPipe face mesh (478 points with irises): per eye the two corners, the lids and the iris centre
# the eye opening's outline (face mesh), to find the iris in the picture itself
CONTOUR = {
    "right": [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
    "left": [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
}


def iris_in_picture(gray, pts):
    """The iris = the dark round part inside the eye opening, found from the pixels (the face model's own iris
    points don't follow a face filter's drawn eyes). The outline is pulled in from the lids so the lashes and
    the lid shadow are not taken for the iris."""
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


EYES = {
    "right": {"a": 33, "b": 133, "up": 159, "lo": 145, "iris": 468},
    "left": {"a": 362, "b": 263, "up": 386, "lo": 374, "iris": 473},
}


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=width,height,r_frame_rate:stream_side_data=rotation", "-of", "default=nw=1", path],
                         capture_output=True, text=True).stdout
    d = dict(l.split("=", 1) for l in out.splitlines() if "=" in l)
    n, m = d.get("r_frame_rate", "30/1").split("/")
    return int(d["width"]), int(d["height"]), float(n) / float(m or 1)


def colour_args(src):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=pix_fmt,color_range",
                          "-of", "default=nw=1", src], capture_output=True, text=True).stdout
    full = "yuvj" in out or "color_range=pc" in out
    return ["-pix_fmt", "yuvj420p", "-color_range", "pc"] if full else ["-pix_fmt", "yuv420p"]


def frames(path, w, h, seconds=None):
    """Decoded frames (ffmpeg applies the phone's rotation itself)."""
    args = [FFMPEG, "-v", "error", "-i", path]
    if seconds:
        args += ["-t", str(seconds)]
    p = subprocess.Popen(args + ["-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    size = w * h * 3
    while True:
        buf = p.stdout.read(size)
        if len(buf) < size:
            break
        yield np.frombuffer(buf, np.uint8).reshape(h, w, 3)
    p.wait()


def display_size(path):
    """Width/height as the frames come out of ffmpeg (after rotation)."""
    out = subprocess.run([FFMPEG, "-v", "error", "-i", path, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
                         capture_output=True).stdout
    w, h, fps = probe(path)
    if len(out) == w * h:
        return w, h, fps
    return h, w, fps  # rotated 90 degrees


def landmarks(path, w, h, fps, seconds=None):
    """Per frame: per eye {iris, centre, width, open} in pixels, or None when no face."""
    import mediapipe as mp
    from mediapipe.tasks import python as mpt
    from mediapipe.tasks.python import vision
    det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
        base_options=mpt.BaseOptions(model_asset_path=MODEL), running_mode=vision.RunningMode.VIDEO, num_faces=1))
    res = []
    for i, f in enumerate(frames(path, w, h, seconds)):
        r = det.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(f[:, :, ::-1])),
                                 int(i * 1000 / fps))
        if not r.face_landmarks:
            res.append(None)
            continue
        L = r.face_landmarks[0]
        P = lambda k: np.array([L[k].x * w, L[k].y * h])
        gray = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
        eyes = {}
        for name, e in EYES.items():
            a, b, up, lo, iris = P(e["a"]), P(e["b"]), P(e["up"]), P(e["lo"]), P(e["iris"])
            width = np.linalg.norm(b - a)
            centre = np.array([(a[0] + b[0]) / 2, (up[1] + lo[1]) / 2])
            seen = iris_in_picture(gray, np.array([P(k) for k in CONTOUR[name]]))
            eyes[name] = {"iris": iris, "seen": seen, "centre": centre, "width": width, "open": np.linalg.norm(lo - up) / max(width, 1)}
        res.append(eyes)
        if i % 150 == 0:
            print(f"  · tracking eyes {i / fps:.0f}s", flush=True)
    return res


# ---- neural mode: "Look at Me! Correcting Eye Gaze in Live Video Communication" (Hsu et al., ACM TOMM 2019,
# BSD weights via github.com/WangWilly/gaze-correction-cam, converted to ONNX). A small CNN takes a 64x48 crop of
# each eye + its six outline points + the angle the gaze has to turn, and redraws the eye (a learned warp + light).
NEURAL = {"L": [362, 385, 387, 263, 373, 380], "R": [33, 160, 158, 133, 153, 144]}  # the six points per eye
NEURAL_CENTRE = {"L": (474, 476), "R": (471, 469)}  # the iris edges: the crop centres on the iris
NEURAL_SEQ = {"L": [3, 2, 1, 0, 5, 4], "R": [0, 1, 2, 3, 4, 5]}


class NeuralGaze:
    def __init__(self):
        import onnxruntime as ort
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 2
        self.s = {k: ort.InferenceSession(os.path.join(ROOT, "models", f"gaze_{k}.onnx"), opts, providers=["CPUExecutionProvider"])
                  for k in "LR"}

    @staticmethod
    def crop(pts, centre):
        eye_len = abs(pts[3][0] - pts[0][0])
        half_w = eye_len * 3 / 4
        box_h = 1.5 * half_w
        top, bottom = int(centre[1] - box_h * 7 / 12), int(centre[1] + box_h * 5 / 12)
        left, right = int(centre[0] - half_w), int(centre[0] + half_w)
        return top, bottom, left, right

    def eye(self, frame, side, pts, centre, angle):
        """Redraw one eye; returns (top, left, patch in 0-255) or None."""
        top, bottom, left, right = self.crop(pts, centre)
        H, W = frame.shape[:2]
        if top < 0 or left < 0 or bottom > H or right > W or bottom - top < 6 or right - left < 8:
            return None
        crop = frame[top:bottom, left:right]
        oh, ow = crop.shape[:2]
        img = cv2.resize(crop, (64, 48)).astype(np.float32) / 255.0
        maps = []
        for idx in NEURAL_SEQ[side]:
            px = int((pts[idx][0] - left) * 64 / ow)
            py = int((pts[idx][1] - top) * 48 / oh)
            maps.append(np.tile((np.arange(64) - px)[None, :], (48, 1)))
            maps.append(np.tile((np.arange(48) - py)[:, None], (1, 64)))
        fp = np.stack(maps, axis=2).astype(np.float32)
        out = self.s[side].run(None, {"img:0": img[None], "fp:0": fp[None], "ang:0": np.array([angle], np.float32)})[0][0]
        return top, left, cv2.resize(np.clip(out, 0, 1) * 255, (ow, oh))


def present(patch, sharpen=0.8, contrast=1.18, iris=0.78):
    """A 'present' eye like CapCut's: the network works on a 64x48 crop, so the redrawn eye comes back soft -
    sharpen it, lift the contrast a little and set the iris a touch darker against the white."""
    p = patch.astype(np.float32)
    p = cv2.addWeighted(p, 1 + sharpen, cv2.GaussianBlur(p, (0, 0), 1.2), -sharpen, 0)
    mean = p.mean(axis=(0, 1), keepdims=True)
    p = (p - mean) * contrast + mean
    lum = p.mean(axis=2, keepdims=True)
    dark = np.clip((lum.mean() - lum) / 40.0, 0, 1)  # the iris and pupil: darker than the eye's average
    p = p * (1 - dark * (1 - iris))
    return np.clip(p, 0, 255)


def iris_move(roi, eye_poly, c0, c1, r):
    """Move the real iris disk from c0 to c1 inside one eye (roi coordinates): its old place is filled with the eye's
    own white (inpainting), the disk keeps its colour and texture, and the lids stay on top (only the opening shows)."""
    h, w = roi.shape[:2]
    opening = np.zeros((h, w), np.uint8)
    cv2.fillPoly(opening, [np.round(eye_poly).astype(np.int32)], 255)
    # what moves = only the iris itself: the dark blob around c0, inside the opening pulled in from the lid line
    # (the filter's thick eyeliner at the corners is dark too - a plain circle dragged it along as a black wedge)
    cpoly = eye_poly.mean(axis=0)
    inner = np.zeros((h, w), np.uint8)
    cv2.fillPoly(inner, [np.round(cpoly + (eye_poly - cpoly) * np.array([0.86, 0.62])).astype(np.int32)], 255)
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY).astype(np.float32)
    ring = np.zeros((h, w), np.uint8)
    cv2.circle(ring, (int(round(c0[0])), int(round(c0[1]))), int(round(r * 1.1)), 255, -1)
    zone = (ring > 0) & (inner > 0)
    if zone.sum() < 6:
        return roi
    thr = (np.percentile(gray[inner > 0], 35) + np.percentile(gray[inner > 0], 75)) / 2
    disk = ((gray < thr) & zone).astype(np.float32)
    disk = cv2.morphologyEx(disk, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    disk = cv2.GaussianBlur(disk, (0, 0), 0.8)
    old = cv2.dilate((disk > 0.2).astype(np.uint8) * 255, np.ones((3, 3), np.uint8))
    white = cv2.inpaint(roi, old, 4, cv2.INPAINT_TELEA)  # the old place: white again (only where the iris really was)
    M = np.float32([[1, 0, c1[0] - c0[0]], [0, 1, c1[1] - c0[1]]])
    moved = cv2.warpAffine(present(roi.astype(np.float32), sharpen=0.5, contrast=1.15, iris=0.8), M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    a = cv2.warpAffine(disk, M, (w, h))[..., None] * (opening[..., None] / 255.0)  # lids on top of the moved iris
    out = white.astype(np.float32) * (1 - a) + moved * a
    feather = cv2.GaussianBlur((opening > 0).astype(np.float32), (0, 0), 1.0)[..., None]  # only inside the eye opening
    return np.clip(roi * (1 - feather) + out * feather, 0, 255).astype(np.uint8)


def iris_correct(src, out, w, h, fps, pull=1.0, seconds=None, preview=False):
    """CapCut-like eye contact: each frame, the real iris is moved to the middle of the eye opening (sideways, by
    `pull`), its old place filled with white, lids kept on top. Narrow eyes and blinks are left as filmed."""
    import mediapipe as mp
    from mediapipe.tasks import python as mpt
    from mediapipe.tasks.python import vision
    det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
        base_options=mpt.BaseOptions(model_asset_path=MODEL), running_mode=vision.RunningMode.VIDEO, num_faces=1))
    ow = w * 2 if preview else w
    enc = subprocess.Popen([FFMPEG, "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{ow}x{h}", "-r", f"{fps}",
                            "-i", "-", *([] if preview else ["-i", src, "-map", "0:v", "-map", "1:a?", "-c:a", "copy"]),
                            *colour_args(src), "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-movflags", "+faststart", out],
                           stdin=subprocess.PIPE)
    sm = {}
    for i, f in enumerate(frames(src, w, h, seconds)):
        g = f.copy()
        r_ = det.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(f[:, :, ::-1])), int(i * 1000 / fps))
        if r_.face_landmarks:
            L = r_.face_landmarks[0]
            P = lambda k: np.array([L[k].x * w, L[k].y * h])
            gray = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
            for name, e in EYES.items():
                poly = np.array([P(k) for k in CONTOUR[name]])
                a, b = P(e["a"]), P(e["b"])
                width = np.linalg.norm(b - a)
                if width < 12 or np.linalg.norm(P(e["lo"]) - P(e["up"])) / width < 0.2:
                    sm.pop(name, None)
                    continue
                seen = iris_in_picture(gray, poly)
                if seen is None:
                    continue
                st = np.array([seen[0], seen[1], width])
                st = st if name not in sm else sm[name] * 0.55 + st * 0.45  # steady - no shimmer
                sm[name] = st
                c0 = st[:2]
                r = 0.2 * st[2]
                c1 = np.array([c0[0] + pull * ((a[0] + b[0]) / 2 - c0[0]), c0[1]])  # to the middle, sideways only
                if abs(c1[0] - c0[0]) < 0.6:
                    continue
                x0, y0 = int(max(0, poly[:, 0].min() - r)), int(max(0, poly[:, 1].min() - r))
                x1, y1 = int(min(w, poly[:, 0].max() + r)), int(min(h, poly[:, 1].max() + r))
                g[y0:y1, x0:x1] = iris_move(g[y0:y1, x0:x1].copy(), poly - [x0, y0], c0 - [x0, y0], c1 - [x0, y0], r)
        enc.stdin.write((np.hstack([f, g]) if preview else g).tobytes())
        if i % 150 == 0:
            print(f"  · eyes {i / fps:.0f}s", flush=True)
    enc.stdin.close()
    enc.wait()


def neural_correct(src, out, w, h, fps, angle, seconds=None, preview=False, gain=140.0, follow=True):
    """Every frame: find the eyes (MediaPipe, smoothed), redraw them with the network turned by `angle`
    ([vertical, horizontal] degrees - where the reading screen is from the lens), blend them back in softly."""
    import mediapipe as mp
    from mediapipe.tasks import python as mpt
    from mediapipe.tasks.python import vision
    det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
        base_options=mpt.BaseOptions(model_asset_path=MODEL), running_mode=vision.RunningMode.VIDEO, num_faces=1))
    net = NeuralGaze()
    ow = w * 2 if preview else w
    enc = subprocess.Popen([FFMPEG, "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{ow}x{h}", "-r", f"{fps}",
                            "-i", "-", *([] if preview else ["-i", src, "-map", "0:v", "-map", "1:a?", "-c:a", "copy"]),
                            *colour_args(src), "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-movflags", "+faststart", out],
                           stdin=subprocess.PIPE)
    smooth, look = {}, None
    for i, f in enumerate(frames(src, w, h, seconds)):
        g = f.copy()
        gray = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
        r = det.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(f[:, :, ::-1])), int(i * 1000 / fps))
        if r.face_landmarks:
            L = r.face_landmarks[0]
            P = lambda k: np.array([L[k].x * w, L[k].y * h])
            if follow:
                # where the eyes look THIS frame (like CapCut): each iris as seen in the picture vs the middle of its
                # eye, in eye widths -> degrees (an iris a tenth of an eye width off = ~14 deg); both eyes averaged
                offs = []
                for name, e in EYES.items():
                    seen = iris_in_picture(gray, np.array([P(k) for k in CONTOUR[name]]))
                    width = np.linalg.norm(P(e["b"]) - P(e["a"]))
                    if seen is None or width < 4 or np.linalg.norm(P(e["lo"]) - P(e["up"])) / width < 0.16:
                        continue
                    centre = np.array([(P(e["a"])[0] + P(e["b"])[0]) / 2, (P(e["up"])[1] + P(e["lo"])[1]) / 2])
                    offs.append((seen - centre) / width)
                if offs:
                    o = np.mean(offs, axis=0)
                    # calibrated on CapCut (tadar IMG_9984 vs its CapCut export): it pulls the iris ~56% of the way to the
                    # middle sideways and leaves the height; the network moves the iris ~0.003 eye widths per degree, and a
                    # positive horizontal angle moves it to the right -> turn by -187 deg per eye width of offset
                    want = np.clip(np.array([0.0 * angle[0], -333.0 * o[0] * angle[1]]), -28, 28)  # [vertical, horizontal] - all the way to the middle
                    look = want if look is None else look * 0.6 + want * 0.4  # smooth - the eyes do not twitch
            use = list(look) if (follow and look is not None) else angle
            for side in "LR":
                pts = np.array([P(k) for k in NEURAL[side]])
                c = (P(NEURAL_CENTRE[side][0]) + P(NEURAL_CENTRE[side][1])) / 2
                cur = np.vstack([pts, c])
                prev = smooth.get(side)
                cur = cur if prev is None else prev * 0.5 + cur * 0.5  # steady crops - no shimmer
                smooth[side] = cur
                open_ratio = np.linalg.norm(cur[4] - cur[1]) / max(1e-6, np.linalg.norm(cur[3] - cur[0]))
                if open_ratio < 0.2:  # a blink or a narrowed eye: leave it exactly as filmed (the network smears it)
                    continue
                res = net.eye(f, side, cur[:6], cur[6], use)
                if res is None:
                    continue
                top, left, patch = res
                ph, pw = patch.shape[:2]
                # the WHOLE eye opening comes from the redrawn eye (its outline from the face mesh, a little wider,
                # feathered) - a small oval in the middle left the old iris showing where it had been
                outline = np.array([P(k) for k in CONTOUR["left" if side == "L" else "right"]]) - [left, top]
                c0 = outline.mean(axis=0)
                outline = c0 + (outline - c0) * np.array([1.12, 1.35])
                m = np.zeros((ph, pw), np.float32)
                cv2.fillPoly(m, [np.round(outline).astype(np.int32)], 1)
                m = cv2.GaussianBlur(m, (0, 0), max(1.0, pw * 0.035), borderType=cv2.BORDER_CONSTANT)
                bw, bh = max(2, pw // 12), max(2, ph // 12)  # the network's own crop edge is never used (it left a seam)
                m[:bh], m[-bh:], m[:, :bw], m[:, -bw:] = 0, 0, 0, 0
                m = m[..., None]
                roi = g[top:top + ph, left:left + pw].astype(np.float32)
                g[top:top + ph, left:left + pw] = (roi * (1 - m) + present(patch) * m).astype(np.uint8)
        enc.stdin.write((np.hstack([f, g]) if preview else g).tobytes())
        if i % 150 == 0:
            print(f"  · eyes {i / fps:.0f}s", flush=True)
    enc.stdin.close()
    enc.wait()


def centring(track, strength, dy_gain):
    """Frame by frame: move each iris (as seen in the picture) to the middle of its eye opening. Smoothed so it
    does not jitter, left alone during blinks, capped so a big glance away is not dragged all the way."""
    shifts, sm = [], {n: None for n in EYES}
    for e in track:
        cur = {}
        for n in EYES:
            if not e or e[n]["seen"] is None or e[n]["open"] < 0.16:
                sm[n] = None if not e else (sm[n] * 0.5 if sm[n] is not None else None)  # blink: ease off
                cur[n] = sm[n]
                continue
            off = (e[n]["centre"] - e[n]["seen"]) / e[n]["width"]
            target = np.clip(off * np.array([strength, strength * dy_gain]), -0.28, 0.28)
            sm[n] = target if sm[n] is None else sm[n] * 0.55 + target * 0.45
            cur[n] = sm[n] * e[n]["width"]
        shifts.append(cur)
    xs = [np.linalg.norm(c["right"]) / max(1e-6, e["right"]["width"]) for c, e in zip(shifts, track) if e and c.get("right") is not None]
    print(f"  · centring: average move {np.mean(xs) if xs else 0:.3f} eye widths per frame")
    return shifts


def offsets(track, strength, dy_gain, nudge=None):
    """The shift to apply per frame and eye: minus the reading offset (median iris position), smoothed,
    faded out on blinks and on big glances away."""
    shifts = []
    rel = {n: [] for n in EYES}
    for e in track:
        for n in EYES:
            if e and e[n]["open"] > 0.2:
                rel[n].append((e[n]["iris"] - e[n]["centre"]) / e[n]["width"])
    per_eye = {n: (np.median(np.array(v), axis=0) if v else np.zeros(2)) for n, v in rel.items()}
    # only what both eyes share is where you look; the difference between the eyes is anatomy (and where the
    # model puts the corners) - correcting it would cross or spread the eyes
    common = (per_eye["right"] + per_eye["left"]) / 2
    if nudge is not None:  # set by hand (eye widths): the measured offset is replaced
        common = -np.array(nudge, float)
    print("  · per eye (eye widths): " + ", ".join(f"{n} {v[0]:+.3f},{v[1]:+.3f}" for n, v in per_eye.items())
          + f"  ->  reading offset {common[0]:+.3f},{common[1]:+.3f}")
    sm = {n: None for n in EYES}
    for e in track:
        cur = {}
        for n in EYES:
            if not e:
                cur[n] = None
                continue
            r = (e[n]["iris"] - e[n]["centre"]) / e[n]["width"]
            want = -common * np.array([strength, strength * dy_gain])
            gate = 1.0
            if e[n]["open"] < 0.18:  # a blink: leave it
                gate = 0.0
            elif nudge is None and np.linalg.norm(r - per_eye[n]) > 0.22:  # looking far away on purpose: let it be
                gate = 0.0
            target = want * gate
            sm[n] = target if sm[n] is None else sm[n] * 0.6 + target * 0.4  # no jitter
            cur[n] = sm[n] * e[n]["width"]  # back to pixels
        shifts.append(cur)
    return shifts


def warp(img, eyes, shift):
    """Move each iris by its shift: a smooth local warp around the iris, inside the eye only."""
    out = img
    for n in EYES:
        if not eyes or shift.get(n) is None or np.abs(shift[n]).max() < 0.15:
            continue
        cx, cy = eyes[n]["seen"] if eyes[n].get("seen") is not None else eyes[n]["iris"]
        wdt = eyes[n]["width"]
        sx, sy = shift[n]
        r = int(wdt * 1.1)
        x0, y0 = max(0, int(cx - r)), max(0, int(cy - r))
        x1, y1 = min(img.shape[1], int(cx + r)), min(img.shape[0], int(cy + r))
        if x1 - x0 < 4 or y1 - y0 < 4:
            continue
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        sigx, sigy = wdt * 0.28, wdt * 0.20  # about the iris, wider than tall - the lids barely move
        k = np.exp(-(((xx - cx) ** 2) / (2 * sigx ** 2) + ((yy - cy) ** 2) / (2 * sigy ** 2)))
        mx, my = (xx - sx * k).astype(np.float32), (yy - sy * k).astype(np.float32)
        if out is img:
            out = img.copy()
        out[y0:y1, x0:x1] = cv2.remap(img, mx, my, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--strength", type=float, default=1.0, help="how much of the reading offset to remove (0-1)")
    ap.add_argument("--dy", type=float, default=0.6, help="vertical share (reading below the lens is usually fine to keep a little)")
    ap.add_argument("--preview", type=float, help="only the first N seconds, before | after side by side")
    ap.add_argument("--angle", default="1,1", help="neural mode: per-axis strength 'vertical,horizontal' (follow mode, 1 = full) or fixed degrees with --fixed")
    ap.add_argument("--fixed", action="store_true", help="neural mode: one fixed angle for the whole clip instead of following the eyes")
    ap.add_argument("--pull", type=float, default=1.0, help="iris mode: how far to the middle (1 = all the way)")
    ap.add_argument("--mode", choices=["iris", "neural", "center", "offset"], default="neural",
                    help="center: every frame, the iris to the middle of the eye (default); offset: remove only the steady reading offset")
    ap.add_argument("--nudge", help="move the eyes by hand: 'x,y' in eye widths (e.g. -0.1,0 = 10%% of an eye width to the left)")
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    w, h, fps = display_size(a.src)
    print(f"▶ {os.path.basename(a.src)}  {w}x{h} @ {fps:.2f}fps")
    if a.mode == "iris":
        iris_correct(a.src, a.out, w, h, fps, a.pull, a.preview, bool(a.preview))
        print(f"✔ {a.out}")
        return
    if a.mode == "neural":
        neural_correct(a.src, a.out, w, h, fps, [float(v) for v in a.angle.split(",")], a.preview, bool(a.preview), follow=not a.fixed)
        print(f"✔ {a.out}")
        return
    track = landmarks(a.src, w, h, fps, a.preview)
    found = sum(1 for e in track if e)
    print(f"  · face found in {found}/{len(track)} frames")
    if a.mode == "center" and not a.nudge:
        shifts = centring(track, a.strength, a.dy)
    else:
        shifts = offsets(track, a.strength, a.dy, [float(v) for v in a.nudge.split(",")] if a.nudge else None)
    ow = w * 2 if a.preview else w
    enc = subprocess.Popen([FFMPEG, "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{ow}x{h}", "-r", f"{fps}",
                            "-i", "-", *([] if a.preview else ["-i", a.src, "-map", "0:v", "-map", "1:a?", "-c:a", "copy"]),
                            # the same colour format as the source (filter apps export full-range video; saving it as
                            # limited range washed the tones) - the round trip then leaves every colour where it was
                            *colour_args(a.src), "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-movflags", "+faststart", a.out],
                           stdin=subprocess.PIPE)
    for i, f in enumerate(frames(a.src, w, h, a.preview)):
        g = warp(f, track[i] if i < len(track) else None, shifts[i] if i < len(shifts) else {})
        enc.stdin.write((np.hstack([f, g]) if a.preview else g).tobytes())
    enc.stdin.close()
    enc.wait()
    print(f"✔ {a.out}")


if __name__ == "__main__":
    main()
