"""A logo on a plain background -> a transparent PNG, cropped to the logo.

    .venv\\Scripts\\python tools/cutout_logo.py <in.jpg> <out.png> [tolerance]

The background is what is connected to the picture's border and close to its colour (a white / cream sheet);
everything else - the badge, its glow, the sparkles inside - stays. The edge is softened a pixel or two.
"""
import sys

import cv2
import numpy as np


def cutout(src, dst, tol=22):
    img = cv2.imdecode(np.fromfile(src, np.uint8), cv2.IMREAD_COLOR)  # (a Hebrew path works too)
    h, w = img.shape[:2]
    mask = np.zeros((h + 2, w + 2), np.uint8)
    flags = 4 | cv2.FLOODFILL_MASK_ONLY | cv2.FLOODFILL_FIXED_RANGE | (255 << 8)
    lo = up = (tol, tol, tol)
    step = max(1, min(h, w) // 64)
    border = [(x, 0) for x in range(0, w, step)] + [(x, h - 1) for x in range(0, w, step)] + \
             [(0, y) for y in range(0, h, step)] + [(w - 1, y) for y in range(0, h, step)]
    for x, y in border:  # the sheet around the logo, from every side
        if mask[y + 1, x + 1] == 0 and img[y, x].astype(int).sum() > 3 * 170:
            cv2.floodFill(img, mask, (x, y), 0, lo, up, flags)
    bg = mask[1:-1, 1:-1] > 0
    bg = cv2.morphologyEx(bg.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    alpha = cv2.GaussianBlur(alpha, (0, 0), 1.1)  # a soft edge
    ys, xs = np.nonzero(alpha > 8)
    pad = 6
    y0, y1, x0, x1 = max(0, ys.min() - pad), min(h, ys.max() + pad + 1), max(0, xs.min() - pad), min(w, xs.max() + pad + 1)
    out = np.dstack([img, alpha])[y0:y1, x0:x1]
    cv2.imencode(".png", out)[1].tofile(dst)
    return out.shape[1], out.shape[0]


if __name__ == "__main__":
    print(cutout(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 22))
