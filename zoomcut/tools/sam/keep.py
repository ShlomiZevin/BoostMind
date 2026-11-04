"""Keep things in the cut-out - tap / paint what to keep on a frame, SAM 2 finds its edges and follows it through the take
(his ask, 2026-11-04: "mark what I want to keep... it catches the thing to its edges, like CapCut"). Runs in its own
venv (tools/sam/.venv: torch CPU + Meta's sam2; models in tools/sam/models, not in git).

  keep.py serve                                   the editor's helper: JSON lines on stdin / stdout (render/keep.mjs)
      {"cmd": "frame", "take": path, "t": s}       -> {"w", "h", "jpg": base64}   (the frame the marks are made on)
      {"cmd": "mask", "points": [[fx, fy, 1|0]]}   -> {"png": base64, "score"}     (1 = keep this, 0 = not this)
  keep.py preview <take> <t> <fx,fy[,0]> ... <out.jpg>   a session checks its marks on a still (kept bright, rest dim)
  keep.py track <take> <objects.json> <out.mkv> <w> <h> <fps> <frames>
      the build: every object followed through its span (SAM 2 on 10 frames a second at 512 px - CPU: ~5 s per second
      of video; the frames between follow the motion by optical flow), one grey mask a frame, <w>x<h>, ffv1.
objects = [{"what": "cookie box", "t": 3.5, "points": [[0.72, 0.62, 1], ...], "from": s?, "to": s?}] (take seconds,
fractions of the RAW take's frame - before any mirror)."""
import base64
import json
import os
import subprocess
import sys
import tempfile

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))


def _find_ff(name):  # (as pipeline/common.py: PATH, else WinGet's folder - the studio's own PATH may not have it)
    import glob
    import shutil
    p = shutil.which(name)
    if p:
        return p
    hits = glob.glob(os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "WinGet", "Packages", "Gyan.FFmpeg*", "ffmpeg-*", "bin", name + ".exe"))
    if hits:
        return hits[0]
    raise SystemExit(f"{name} not found")


FF = _find_ff("ffmpeg")
MODEL = ("configs/sam2.1/sam2.1_hiera_t.yaml", os.path.join(HERE, "models", "sam2.1_hiera_tiny.pt"))
RES = 512        # the model's input (1024 = 6x slower on this CPU, the same edges at this size)
KFPS = 10        # frames a second the model sees; the rest follow the motion
SH = 540         # the frames' height (the matte is 768: the mask is scaled up, softly)
OV = [f"++model.image_size={RES}"]


def _torch():
    import torch
    torch.set_num_threads(os.cpu_count() or 8)
    return torch


def frame_at(take, t, h=SH):
    raw = subprocess.run([FF, "-v", "error", "-ss", f"{max(0.0, t):.3f}", "-i", take, "-frames:v", "1", "-vf", f"scale=-2:{h}",
                          "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True).stdout
    im = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if im is None:
        raise SystemExit(f"no frame at {t}s in {take}")
    return im


def image_predictor():
    _torch()
    from sam2.build_sam import build_sam2
    from sam2.sam2_image_predictor import SAM2ImagePredictor
    p = SAM2ImagePredictor(build_sam2(MODEL[0], MODEL[1], device="cpu", hydra_overrides_extra=OV))
    p._bb_feat_sizes = [(RES // 4, RES // 4), (RES // 8, RES // 8), (RES // 16, RES // 16)]  # (it assumes 1024)
    return p


def clean(m):
    """The mask as one solid thing: no specks, no pin holes (the CUDA hole-filling step isn't there on this CPU)."""
    m = m.astype(np.uint8) * 255
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    if n > 1:
        big = st[1:, cv2.CC_STAT_AREA].max()
        for i in range(1, n):
            if st[i, cv2.CC_STAT_AREA] < max(40, big * 0.02):
                m[lab == i] = 0
    inv = cv2.bitwise_not(m)
    n, lab, st, _ = cv2.connectedComponentsWithStats(inv)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 200:
            m[lab == i] = 255
    return m


def predict(p, w, h, points):
    pts = np.array([[x * w, y * h] for x, y, *_ in points], np.float32)
    lab = np.array([int(q[2]) if len(q) > 2 else 1 for q in points], np.int32)
    masks, scores, _ = p.predict(point_coords=pts, point_labels=lab, multimask_output=len(points) == 1)
    i = int(np.argmax(scores))
    return clean(masks[i] > 0), float(scores[i])


def serve():
    p, cur = None, None
    # (UTF-8 both ways whatever the console: takes live in Hebrew folders - "חני שייבה" - and -I ignores PYTHONIOENCODING)
    stdin = open(sys.stdin.fileno(), encoding="utf-8", errors="replace", closefd=False)
    sys.stdout.reconfigure(encoding="utf-8")
    for line in stdin:
        q = {}
        try:
            q = json.loads(line)
            if p is None:
                p = image_predictor()
            if q["cmd"] == "frame":
                im = frame_at(q["take"], float(q["t"]))
                p.set_image(cv2.cvtColor(im, cv2.COLOR_BGR2RGB))
                cur = im.shape[:2]
                ok, jpg = cv2.imencode(".jpg", im, [cv2.IMWRITE_JPEG_QUALITY, 88])
                out = {"w": cur[1], "h": cur[0], "jpg": base64.b64encode(jpg).decode()}
            elif q["cmd"] == "mask":
                if cur is None:
                    raise ValueError("no frame yet")
                m, sc = predict(p, cur[1], cur[0], q["points"])
                rgba = np.zeros((*m.shape, 4), np.uint8)
                rgba[..., :3] = 255
                rgba[..., 3] = m
                out = {"png": base64.b64encode(cv2.imencode(".png", rgba)[1]).decode(), "score": round(sc, 3)}
            else:
                raise ValueError(f"cmd {q.get('cmd')}")
            out["id"] = q.get("id")
        except Exception as e:  # (one bad request answers with its error - the helper stays up)
            out = {"id": q.get("id") if isinstance(q, dict) else None, "error": str(e)[:300]}
        sys.stdout.write(json.dumps(out) + "\n")
        sys.stdout.flush()


def preview(take, t, marks, out):
    im = frame_at(take, t)
    p = image_predictor()
    p.set_image(cv2.cvtColor(im, cv2.COLOR_BGR2RGB))
    m, sc = predict(p, im.shape[1], im.shape[0], marks)
    show = im.copy()
    show[m == 0] = (show[m == 0] * 0.3).astype(np.uint8)
    cnt, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(show, cnt, -1, (80, 220, 120), 2)
    for x, y, *l in marks:
        cv2.circle(show, (int(x * im.shape[1]), int(y * im.shape[0])), 6, (80, 220, 120) if not l or l[0] else (60, 60, 240), -1)
    cv2.imwrite(out, show)
    print(f"score {sc:.2f} -> {out}")


def track(take, objs, out, ow, oh, fps, nframes):
    """Every object followed through its span -> one grey mask a frame (all objects together), ow x oh, nframes long."""
    torch = _torch()
    from sam2.build_sam import build_sam2_video_predictor
    dur = nframes / fps
    spans = [(max(0.0, float(o.get("from", 0))), min(dur, float(o.get("to", dur)))) for o in objs]
    t0, t1 = min(a for a, _ in spans), max(b for _, b in spans)
    tmp = tempfile.mkdtemp(prefix="keep-")
    kdir = os.path.join(tmp, "k")
    os.makedirs(kdir)
    subprocess.run([FF, "-v", "error", "-ss", f"{t0:.3f}", "-t", f"{t1 - t0 + 0.2:.3f}", "-i", take, "-vf", f"fps={KFPS},scale=-2:{SH}",
                    "-q:v", "3", "-start_number", "0", os.path.join(kdir, "%05d.jpg")], check=True)
    nk = len(os.listdir(kdir))
    kw, kh = cv2.imread(os.path.join(kdir, "00000.jpg")).shape[1::-1]
    vp = build_sam2_video_predictor(MODEL[0], MODEL[1], device="cpu", hydra_overrides_extra=OV)
    km = np.zeros((nk, kh, kw), np.uint8)  # the keyframes' masks, every object together
    with torch.inference_mode():
        st = vp.init_state(video_path=kdir, offload_video_to_cpu=True)
        for oi, o in enumerate(objs):
            ki = int(round((float(o["t"]) - t0) * KFPS))
            ki = max(0, min(nk - 1, ki))
            pts = np.array([[x * kw, y * kh] for x, y, *_ in o["points"]], np.float32)
            lab = np.array([int(q[2]) if len(q) > 2 else 1 for q in o["points"]], np.int32)
            vp.add_new_points_or_box(st, frame_idx=ki, obj_id=oi + 1, points=pts, labels=lab)
        done = 0
        for rev in (False, True):  # (after the marked frame, then before it)
            for fi, ids, logits in vp.propagate_in_video(st, reverse=rev):
                for j, oid in enumerate(ids):
                    a, b = spans[oid - 1]
                    tt = t0 + fi / KFPS
                    if a - 0.05 <= tt <= b + 0.05:
                        km[fi] = np.maximum(km[fi], (logits[j, 0] > 0).cpu().numpy().astype(np.uint8) * 255)
                done += 1
                if done % 10 == 0:
                    print(f"followed {done}/{nk * 2}", flush=True)
    for i in range(nk):
        km[i] = clean(km[i] > 127)
    # every frame of the take: the keyframes' masks moved with the picture (optical flow) between them
    small = subprocess.run([FF, "-v", "error", "-i", take, "-vf", f"fps={fps},scale={kw // 2}:{kh // 2}", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
                           capture_output=True).stdout
    sw, sh = kw // 2, kh // 2
    allf = np.frombuffer(small, np.uint8)[: (len(small) // (sw * sh)) * sw * sh].reshape(-1, sh, sw)
    gx, gy = np.meshgrid(np.arange(kw, dtype=np.float32), np.arange(kh, dtype=np.float32))
    enc = subprocess.Popen([FF, "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{ow}x{oh}", "-r", str(fps), "-i", "-",
                            "-c:v", "ffv1", out + ".part.mkv"], stdin=subprocess.PIPE)
    blank = np.zeros((oh, ow), np.uint8).tobytes()

    def moved(k, f):  # keyframe k's mask, moved to where things are in frame f
        fk = min(len(allf) - 1, int(round((t0 + k / KFPS) * fps)))
        if fk == f or f >= len(allf):
            return km[k].astype(np.float32)
        flow = cv2.calcOpticalFlowFarneback(allf[f], allf[fk], None, 0.5, 3, 15, 3, 5, 1.2, 0)
        flow = cv2.resize(flow, (kw, kh)) * 2
        return cv2.remap(km[k].astype(np.float32), gx + flow[..., 0], gy + flow[..., 1], cv2.INTER_LINEAR)

    for f in range(nframes):
        tt = f / fps
        if tt < t0 - 0.05 or tt > t1 + 0.05:
            enc.stdin.write(blank)
            continue
        x = (tt - t0) * KFPS
        a = max(0, min(nk - 1, int(np.floor(x))))
        b = min(nk - 1, a + 1)
        u = min(1.0, max(0.0, x - a))
        m = moved(a, f) if u < 0.02 or a == b else moved(b, f) if u > 0.98 else moved(a, f) * (1 - u) + moved(b, f) * u
        m = cv2.resize(m, (ow, oh), interpolation=cv2.INTER_LINEAR)
        m = cv2.GaussianBlur(np.where(m > 127, 255, 0).astype(np.uint8), (3, 3), 0)
        enc.stdin.write(m.tobytes())
    enc.stdin.close()
    enc.wait()
    os.replace(out + ".part.mkv", out)
    print(f"kept objects -> {out}", flush=True)


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        raise SystemExit(__doc__)
    if a[0] == "serve":
        serve()
    elif a[0] == "preview":
        marks = [[float(v) for v in s.split(",")] for s in a[3:-1]]
        preview(a[1], float(a[2]), marks, a[-1])
    elif a[0] == "track":
        track(a[1], json.load(open(a[2], encoding="utf-8")), a[3], int(a[4]), int(a[5]), int(a[6]), int(a[7]))
    else:
        raise SystemExit(__doc__)
