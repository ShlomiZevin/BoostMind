# Face swap - the Snapchat way (his ask, 2026-11-03: "Snapchat is good enough, I do imitation, it gives the vibe - I need
# it fast"): no AI drawing a face. 478 face points (MediaPipe) on the image and on every frame of his take; the image's
# face is stretched over his like a rubber mask that moves with him, takes his light and shadow (QS_BLEND light, + Poisson
# = the most blended), fades out wide at its borders; his own eyeballs and the inside of his mouth stay his, so blinks,
# gaze and talking are real. ~13 frames/s at 1080p on his PC (6 cores painting at once).
#   tools/faceswap/.venv/Scripts/python tools/faceswap/quick.py <video> <image> [out.mp4]
# The studio runs it for a take (pipeline/face_layers.py, a beta in the clip's window); his own command for any video:
# tools/faceswap/faceswap.cmd. Its own .venv (mediapipe, opencv-python, numpy) - never the studio's Python.
import os, subprocess, sys, time
import cv2, numpy as np, mediapipe as mp
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from mediapipe.tasks.python import vision, BaseOptions

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(HERE, '..', '..', 'models', 'face_landmarker.task')  # (models/ stays on this computer; fetched once)
MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150,
        136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
EYES = [[33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7],
        [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382]]
EYE_GROW = float(os.environ.get('QS_EYE', '1.0'))  # only his eyeball (white + iris): the lids and the skin around are the image's
LIGHT = float(os.environ.get('QS_LIGHT', '0.55'))  # how much of his light and shadow (0 = the image's own)
WORKERS = int(os.environ.get('QS_WORKERS', '6'))  # frames painted at once (his PC: 10 cores; the rest stays free)
BLEND = os.environ.get('QS_BLEND', 'light+poisson')  # light | poisson | light+poisson | flat
MOUTH = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95]

def landmarker(mode):
    if not os.path.exists(MODEL):
        import urllib.request; os.makedirs(os.path.dirname(MODEL), exist_ok=True)
        urllib.request.urlretrieve(MODEL_URL, MODEL + '.part'); os.replace(MODEL + '.part', MODEL)
    return vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=MODEL), running_mode=mode, num_faces=1, output_face_blendshapes=True))

def points(res, w, h):
    if not res.face_landmarks: return None
    return np.array([(p.x * w, p.y * h) for p in res.face_landmarks[0][:468]], np.float32)

def triangles(pts, w, h):
    sub = cv2.Subdiv2D((0, 0, w, h))
    for p in pts: sub.insert((float(min(max(p[0], 0), w - 1)), float(min(max(p[1], 0), h - 1))))
    near = {}
    for t in sub.getTriangleList():
        idx = []
        for k in range(3):
            d = np.sum((pts - t[2 * k:2 * k + 2]) ** 2, axis=1); i = int(np.argmin(d))
            if d[i] > 1: break
            idx.append(i)
        if len(idx) == 3: near[tuple(sorted(idx))] = idx
    return np.array(list(near.values()), np.int32)

def warp(src, sp, dp, tris, out):
    """each triangle of the image's face, stretched onto the same triangle of his face - in one go: a map of which
    triangle every pixel is in, each triangle's affine (his -> the image's), then a single remap"""
    H, W = out.shape[:2]
    ids = np.full((H, W), -1, np.int32)
    for i, t in enumerate(tris): cv2.fillConvexPoly(ids, dp[t].astype(np.int32), i)
    D = np.concatenate([dp[tris], np.ones((len(tris), 3, 1), np.float32)], axis=2)  # T x 3 x 3
    A = np.linalg.pinv(D) @ sp[tris]  # T x 3 x 2: [x y 1] of his -> the image's x y
    ys, xs = np.nonzero(ids >= 0); t = ids[ys, xs]
    mx = np.full((H, W), -1, np.float32); my = np.full((H, W), -1, np.float32)
    mx[ys, xs] = xs * A[t, 0, 0] + ys * A[t, 1, 0] + A[t, 2, 0]
    my[ys, xs] = xs * A[t, 0, 1] + ys * A[t, 1, 1] + A[t, 2, 1]
    warped = cv2.remap(src, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    inside = ids >= 0; out[inside] = warped[inside]

def paint(frame, dp, src, sp, tris):
    """the image's face onto one frame of his, at his face points dp (runs on several cores at once)"""
    H, W = frame.shape[:2]
    x, y, w, h = cv2.boundingRect(dp[OVAL].astype(np.int32))
    pad = int(0.08 * max(w, h)); x0, y0 = max(0, x - pad), max(0, y - pad); x1, y1 = min(W, x + w + pad), min(H, y + h + pad)
    roi = frame[y0:y1, x0:x1]; rh, rw = roi.shape[:2]
    # the face work at about 480 px wide (the image's face is no sharper than that), back to full size to blend
    s = min(1.0, 480 / rw); small = cv2.resize(roi, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    d = ((dp - (x0, y0)) * s).astype(np.float32)
    face = small.copy(); warp(src, sp, d, tris, face)
    fw = small.shape[1]
    outer = np.zeros(small.shape[:2], np.uint8); cv2.fillPoly(outer, [d[OVAL].astype(np.int32)], 255)
    his = np.zeros(small.shape[:2], np.uint8)  # what stays his: the inside of the mouth and the eyes (blinks, gaze)
    cv2.fillPoly(his, [d[MOUTH].astype(np.int32)], 255)
    for eye in EYES:
        e = d[eye]; c = e.mean(0); cv2.fillPoly(his, [((e - c) * EYE_GROW + c).astype(np.int32)], 255)
    kb = max(3, int(0.14 * fw) | 1); ke = max(3, int(0.015 * fw) | 1)  # a wide fade at the borders, a soft one at eyes / mouth
    inner = cv2.erode(outer, np.ones((kb // 2 | 1, kb // 2 | 1), np.uint8))
    skin = cv2.bitwise_and(inner, cv2.bitwise_not(his))
    # skin colour: the image's face takes his light (mean / spread per Lab channel inside the face, as 3 lookups)
    fl, rl = cv2.cvtColor(face, cv2.COLOR_BGR2LAB), cv2.cvtColor(small, cv2.COLOR_BGR2LAB)
    fm, fs = cv2.meanStdDev(fl, mask=skin); rm, rs = cv2.meanStdDev(rl, mask=skin)
    g = np.clip(rs / (fs + 1e-3), 0.6, 1.6); v = np.arange(256, dtype=np.float32)
    lut = np.stack([np.clip((v - fm[c]) * g[c] + rm[c], 0, 255) for c in range(3)], 1).astype(np.uint8)[:, None, :]
    face = cv2.cvtColor(cv2.LUT(fl, lut), cv2.COLOR_LAB2BGR)
    if 'light' in BLEND:  # his light and shadow, the image's details (eyes, brows, beard, the shapes)
        # blurred inside his face only (the wall behind him must not light the cheeks); then his share of the light
        sig = 0.035 * fw; f = face.astype(np.float32); hm = small.astype(np.float32)
        w8 = outer.astype(np.float32)[..., None] / 255; ws = cv2.GaussianBlur(w8, (0, 0), sig)[..., None] + 1e-3
        lf = cv2.GaussianBlur(f * w8, (0, 0), sig) / ws; lh = cv2.GaussianBlur(hm * w8, (0, 0), sig) / ws
        face = np.clip(f - lf + LIGHT * lh + (1 - LIGHT) * lf, 0, 255).astype(np.uint8)
    if 'poisson' in BLEND:  # the edges melt into his skin (Poisson blending)
        m = cv2.erode(outer, np.ones((5, 5), np.uint8)); m[:2], m[-2:], m[:, :2], m[:, -2:] = 0, 0, 0, 0
        bx, by, bw, bh = cv2.boundingRect(m)
        try: face = cv2.seamlessClone(face, small, m, (bx + bw // 2, by + bh // 2), cv2.NORMAL_CLONE)
        except cv2.error: pass
    a = cv2.GaussianBlur(inner, (kb, kb), 0).astype(np.float32) / 255 * (1 - cv2.GaussianBlur(his, (ke, ke), 0).astype(np.float32) / 255)
    face = cv2.resize(face, (rw, rh), interpolation=cv2.INTER_LINEAR)
    a = cv2.resize(a, (rw, rh), interpolation=cv2.INTER_LINEAR)
    frame[y0:y1, x0:x1] = cv2.blendLinear(face, roi, a, 1 - a)
    return frame

def main():
    video, image = sys.argv[1], sys.argv[2]
    out_path = sys.argv[3] if len(sys.argv) > 3 else os.path.splitext(video)[0] + '.quick.mp4'
    src = cv2.imdecode(np.fromfile(image, np.uint8), cv2.IMREAD_COLOR)  # (cv2.imread cannot open Hebrew paths)
    if src is None: sys.exit(f"cannot read the image {image}")
    if max(src.shape[:2]) > 1400: src = cv2.resize(src, None, fx=1400 / max(src.shape[:2]), fy=1400 / max(src.shape[:2]))
    sh, sw = src.shape[:2]
    sp = points(landmarker(vision.RunningMode.IMAGE).detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(src, cv2.COLOR_BGR2RGB))), sw, sh)
    if sp is None: sys.exit('no face found in the image')
    # take the image's face from a little inside its outline: on the very edge there is background / hair, which came out
    # as a pale haze on his cheeks
    tris = triangles(sp, sw, sh)  # (on the real outline - moving points first folds triangles: jagged gaps)
    c = sp[OVAL].mean(0); sp[OVAL] = c + (sp[OVAL] - c) * 0.96
    # the take's average frame rate (a phone's 30.01 kept as it is: the copy lines up frame for frame with the original)
    probe = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=avg_frame_rate', '-of', 'csv=p=0', video], capture_output=True, text=True).stdout.strip().split(',')[0]
    num, _, den = probe.partition('/')
    fps = (float(num) / float(den or 1)) if probe and float(den or 1) and float(num) else 30.0
    # ffmpeg turns phone videos upright by itself; the size comes from the first decoded frame
    size = subprocess.run(['ffmpeg', '-v', 'error', '-i', video, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], capture_output=True).stdout
    first = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:stream_side_data=rotation', '-of', 'json', video], capture_output=True, text=True).stdout
    import json; st = json.loads(first)['streams'][0]; W, H = st['width'], st['height']
    if abs(int((st.get('side_data_list') or [{}])[0].get('rotation', 0) or 0)) == 90: W, H = H, W
    assert len(size) == W * H * 3, 'frame size'
    dec = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', video, '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], stdout=subprocess.PIPE)
    enc = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(fps), '-i', '-',
                            '-i', video, '-map', '0:v', '-map', '1:a?', '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast',
                            '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', out_path], stdin=subprocess.PIPE)
    lm = landmarker(vision.RunningMode.VIDEO)
    prev, n, t0 = None, 0, time.time()
    pool, futs = ThreadPoolExecutor(WORKERS), deque()
    while True:
        buf = dec.stdout.read(W * H * 3)
        if len(buf) < W * H * 3: break
        frame = np.frombuffer(buf, np.uint8).reshape(H, W, 3).copy()
        res = lm.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)), int(n * 1000 / fps))
        dp = points(res, W, H)
        bs = {c.category_name: c.score for c in res.face_blendshapes[0]} if res.face_blendshapes else {}
        if dp is not None:
            dp = dp if prev is None else (0.6 * dp + 0.4 * prev).astype(np.float32)  # a little smoothing against jitter
            prev = dp
            futs.append(pool.submit(paint, frame, dp, src, sp, tris))
        else: futs.append(pool.submit(lambda f: f, frame))
        n += 1
        while len(futs) > 2 * WORKERS: enc.stdin.write(futs.popleft().result().tobytes())  # in order
    while futs: enc.stdin.write(futs.popleft().result().tobytes())
    pool.shutdown()
    enc.stdin.close(); enc.wait(); dec.wait()
    dt = time.time() - t0
    print(f'{n} frames in {dt:.1f} s = {n / dt:.1f} frames/s ({dt / max(1, n / fps):.2f} s per second of video) -> {out_path}')

if __name__ == '__main__':
    main()
