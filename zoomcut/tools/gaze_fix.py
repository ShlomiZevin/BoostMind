"""Eye contact fix — move the irises so the person looks straight into the lens. No AI, nothing regenerated:
only the pixels inside each eye opening move (a smooth local warp around the pupil), so the face, lids,
glasses and background stay exactly as they are.

    .venv\\Scripts\\python tools/gaze_fix.py in.jpg out.jpg            irises down 5px (the usual "looking above the camera" fix)
    .venv\\Scripts\\python tools/gaze_fix.py in.jpg out.jpg --dy 4 --dx -2
    .venv\\Scripts\\python tools/gaze_fix.py in.jpg out.jpg --sheet     also writes out.eyes.png: original vs 3/4/5/6px to pick from

Shifts are in pixels of a 1024px-wide image and scale with the picture. Tuned on Shlomi's X profile
(AI portraits often look a hair above the lens: iris touching the upper lid, white showing below).
"""
import argparse

import cv2
import numpy as np


def find_pupils(img):
    """Pupil = the darkest point inside each detected eye (works through glasses)."""
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    s = img.shape[1] / 1024
    eyes = []
    for name in ("haarcascade_eye_tree_eyeglasses.xml", "haarcascade_eye.xml"):
        det = cv2.CascadeClassifier(cv2.data.haarcascades + name)
        found = det.detectMultiScale(g, 1.08, 6, minSize=(int(40 * s), int(40 * s)))
        if len(found) >= 2:
            eyes = sorted(found, key=lambda e: -e[2] * e[3])[:2]
            break
    if len(eyes) < 2:
        raise SystemExit("could not find both eyes — pass a tighter crop of the face")
    blur = cv2.GaussianBlur(g, (5, 5), 0)
    pupils = []
    for x, y, w, h in sorted(eyes, key=lambda e: e[0]):
        # skip the eyebrow / frame: search the middle of the eye box
        x0, y0, x1, y1 = x + w // 5, y + h // 4, x + w - w // 5, y + h - h // 5
        yy, xx = np.unravel_index(np.argmin(blur[y0:y1, x0:x1]), (y1 - y0, x1 - x0))
        pupils.append((x0 + xx, y0 + yy))
    return pupils


def warp(img, pupils, dy, dx=0.0, sigma=15.0):
    H, W = img.shape[:2]
    s = W / 1024
    dy, dx, sigma = dy * s, dx * s, sigma * s
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    mx, my = xx.copy(), yy.copy()
    for px, py in pupils:
        k = np.exp(-(((xx - px) ** 2) / (2 * (sigma * 1.3) ** 2) + ((yy - py) ** 2) / (2 * sigma ** 2)))
        mx -= dx * k
        my -= dy * k
    return cv2.remap(img, mx, my, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--dy", type=float, default=5.0, help="move irises down (px at 1024 wide); negative = up")
    ap.add_argument("--dx", type=float, default=0.0, help="move irises right (px at 1024 wide)")
    ap.add_argument("--sheet", action="store_true", help="also write <out>.eyes.png comparing 0/3/4/5/6px")
    a = ap.parse_args()
    img = cv2.imread(a.src)
    pupils = find_pupils(img)
    print("pupils:", [(int(x), int(y)) for x, y in pupils])
    cv2.imwrite(a.out, warp(img, pupils, a.dy, a.dx), [cv2.IMWRITE_JPEG_QUALITY, 95])
    if a.sheet:
        (x0, y0), (x1, y1) = pupils
        pad = int(abs(x1 - x0) * 0.6)
        crop = lambda im: cv2.resize(im[max(0, y0 - pad // 2):y0 + pad // 2, max(0, x0 - pad):x1 + pad], None, fx=2, fy=2)
        rows = [crop(img)] + [crop(warp(img, pupils, d, a.dx)) for d in (3, 4, 5, 6)]
        cv2.imwrite(a.out.rsplit(".", 1)[0] + ".eyes.png", np.vstack(rows))
    print("->", a.out)
