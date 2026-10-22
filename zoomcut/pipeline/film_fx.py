"""Film effects on frames - the export's half of render/ui/fx.js (the editor does the same with CSS):
ghost -> camera (zoom / move / turn around the centre) -> colour + light -> vignette -> grain -> flash -> black.

FxFrame is shared by the one-camera engine (lesson.py, episode.json "fx") and the layered exporter (effect layers,
render/src/layers/effect_curve.js -> tools/effects_curve.mjs). apply_chunk() runs a composited chunk through it."""
import json
import os
import subprocess
from collections import deque
from concurrent.futures import ThreadPoolExecutor

import numpy as np

from .common import FFMPEG, ROOT, log


class FxFrame:
    """The film look on one frame, exactly as the editor's CSS does it: transform around the centre, then
    saturate -> contrast -> brightness x light, the vignette, the grain, the flash, black.
    fx: the settings (center, grain on, ghost + ghost_lag); base_w: the width the curve's moves are in (1080)."""
    def __init__(self, fx, w, h, fps, base_w=1080):
        import cv2
        self.cv2 = cv2
        fx = fx or {}
        self.w, self.h = w, h
        self.base_w = base_w
        self.cx, self.cy = [float(v) for v in fx.get("center", [0.5, 0.36])]
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2) / np.sqrt(2)  # CSS ellipse, farthest-corner
        self.vshape = np.clip((r - 0.45) / 0.55, 0, 1)[..., None].astype(np.float32)  # = the editor's radial overlay at full
        rng = np.random.default_rng(3)
        # the grain: a few full-size fields (made once, twice as tall) - each frame takes a window of one (no copy)
        self.noise = [cv2.resize(rng.standard_normal((h, w // 2)).astype(np.float32), (w, 2 * h), interpolation=cv2.INTER_LINEAR)
                      for _ in range(4)] if fx.get("grain") else []
        self.lag = max(1, round(float(fx.get("ghost_lag", 0.2)) * fps)) if fx.get("ghost") else 0
        self.hist = []  # the last frames, for the ghost (= the editor's lagged copy of him)

    def __call__(self, img, s, f, prev=False):
        """prev: the picture ghost_lag frames back (given by the caller, which works on several frames at once);
        not given = kept here, frame by frame."""
        cv2 = self.cv2
        h, w = self.h, self.w
        if self.lag and prev is False:
            self.hist.append(img)
            if len(self.hist) > self.lag + 1:
                self.hist.pop(0)
            prev = self.hist[0] if len(self.hist) > self.lag else None
        if self.lag and prev is not None and s.get("ghost", 0) > 1e-3:
            img = cv2.addWeighted(img, 1 - s["ghost"], prev, s["ghost"], 0)
        if abs(s["z"] - 1) > 1e-4 or abs(s["dx"]) > 0.01 or abs(s["dy"]) > 0.01 or abs(s["rot"]) > 1e-4:
            ox, oy = self.cx * w, self.cy * h
            sc = w / self.base_w  # the curve is in base_w-wide pixels
            a = np.deg2rad(s["rot"])
            m = np.array([[np.cos(a), -np.sin(a)], [np.sin(a), np.cos(a)]]) * s["z"]
            t = np.array([ox + s["dx"] * sc, oy + s["dy"] * sc]) - m @ np.array([ox, oy])
            img = cv2.warpAffine(img, np.hstack([m, t[:, None]]).astype(np.float32), (w, h), flags=cv2.INTER_LINEAR,
                                 borderMode=cv2.BORDER_REFLECT)
        x = img.astype(np.float32) * (1 / 255)
        sat, con, bri = s.get("sat", 1), s.get("con", 1), 1 + s.get("bri", 0)  # each filter as much as its layer is on now
        b = bri * s["light"]
        if abs(sat - 1) > 1e-3 or abs(con - 1) > 1e-3 or abs(b - 1) > 1e-3:
            # CSS saturate -> contrast -> brightness as one colour matrix with an offset, applied in one pass (BGR)
            wts = np.array([0.0722, 0.7152, 0.2126], np.float32)
            S = np.tile(wts, (3, 1)) * (1 - sat) + np.eye(3, dtype=np.float32) * sat
            M = np.hstack([b * con * S, np.full((3, 1), b * 0.5 * (1 - con), np.float32)])
            x = cv2.transform(x, M)
        if s.get("vig", 0) > 1e-3:
            x *= 1 - s["vig"] * self.vshape
        if s.get("grain", 0) > 1e-3 and self.noise:
            off = (f * 37) % h
            n = self.noise[f % len(self.noise)][off:off + h]
            x += (n * (0.075 * s["grain"]))[..., None] * (0.35 + 0.65 * np.clip(x, 0, 1))  # finer and stronger in the light
        if s["flash"] > 0.002:
            x = x + (1 - x) * min(1.0, s["flash"])
        if s["black"]:
            x[:] = 0
        return (np.clip(x, 0, 1) * 255).astype(np.uint8)


# ---- the layered project's effect layers --------------------------------------------------------------------------
def effect_settings(project):
    """What FxFrame needs once for a project: the centre, whether there is grain, the ghost and its lag."""
    fx = {"center": [0.5, 0.36]}
    for l in project.get("layers", []):
        if l["kind"] != "effect" or l.get("hidden"):
            continue
        p = l.get("props") or {}
        if p.get("center"):
            fx["center"] = p["center"]
        if p.get("filter") in ("grain", "ghost") and l.get("items"):
            fx[p["filter"]] = 1
            if p["filter"] == "ghost":
                fx["ghost_lag"] = p.get("ghost_lag", 0.2)
    return fx


def top_effect(project):
    """Index of the top-most shown effect layer (-1: none) - every layer below it is filtered, the ones above are not."""
    k = -1
    for i, l in enumerate(project.get("layers", [])):
        if l["kind"] == "effect" and not l.get("hidden"):
            k = i
    return k


def preroll(project):
    """Frames a chunk must start earlier so the ghost has the picture it lags behind."""
    fx = effect_settings(project)
    return max(1, round(float(fx.get("ghost_lag", 0.2)) * project["canvas"]["fps"])) if fx.get("ghost") else 0


def curve(ep, project, f0, f1):
    """render/src/layers/effect_curve.js evaluated for frames [f0, f1) (the editor's own code, in node)."""
    d = ep.work("layers", "fx")
    os.makedirs(d, exist_ok=True)
    spec, out = os.path.join(d, f"spec{f0}.json"), os.path.join(d, f"curve{f0}.json")
    with open(spec, "w", encoding="utf-8") as fh:
        json.dump({"project": project, "f0": f0, "f1": f1, "out": out}, fh, ensure_ascii=False)
    r = subprocess.run(["node", os.path.join(ROOT, "tools", "effects_curve.mjs"), spec], capture_output=True, text=True, encoding="utf-8")
    if r.returncode:
        raise RuntimeError("effects curve: " + r.stderr[-800:])
    with open(out, encoding="utf-8") as fh:
        c = json.load(fh)
    os.remove(spec)
    os.remove(out)
    return c


def apply_chunk(ep, project, src, dst, f0, n, pre, w, h, crf="18", preset="medium"):
    """A composited chunk (the layers below the top effect) through the effects. src starts `pre` frames before f0
    (the ghost's history); dst = frames f0 .. f0 + n."""
    fps = project["canvas"]["fps"]
    pre = min(pre, f0)  # (the caller starts src at max(0, f0 - preroll))
    c = curve(ep, project, f0 - pre, f0 + n)
    fxf = FxFrame(effect_settings(project), w, h, fps)  # (fx.js moves in fractions of a 1080-wide frame, any output size)
    dec = subprocess.Popen([FFMPEG, "-v", "error", "-i", src, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE, cwd=ROOT)
    enc = subprocess.Popen([FFMPEG, "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-",
                            "-c:v", "libx264", "-preset", preset, "-crf", crf, "-pix_fmt", "yuv420p", dst], stdin=subprocess.PIPE, cwd=ROOT)
    size, k, hist, todo = w * h * 3, 0, [], deque()
    with ThreadPoolExecutor(max_workers=max(2, min(4, (os.cpu_count() or 4) - 2))) as pool:
        while k < pre + n:
            buf = dec.stdout.read(size)
            if len(buf) < size:
                break
            img = np.frombuffer(buf, np.uint8).reshape(h, w, 3)
            hist.append(img)
            if len(hist) > fxf.lag + 1:
                hist.pop(0)
            prev = hist[0] if fxf.lag and len(hist) > fxf.lag else None
            if k >= pre:
                todo.append(pool.submit(fxf, img, c[min(k, len(c) - 1)], f0 + k - pre, prev))
            k += 1
            while len(todo) > 8 or (todo and todo[0].done()):
                enc.stdin.write(todo.popleft().result().tobytes())
        while todo:
            enc.stdin.write(todo.popleft().result().tobytes())
    enc.stdin.close()
    enc.wait()
    dec.stdout.close()
    dec.wait()
    if k - pre < n:
        log(f"  · effects: chunk at {f0} had {k - pre} of {n} frames")
    return dst
