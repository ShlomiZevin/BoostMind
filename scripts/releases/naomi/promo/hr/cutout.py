"""Cut Naomi out of a raw frame with SAM 2 (the editor's keep.py model, run on one still at full size).
usage (the SAM venv):  KEEP_MODEL=small KEEP_RES=1024 zoomcut/tools/sam/.venv/Scripts/python.exe cutout.py <frame.png> <out.png>
out.png = the frame as RGBA, alpha = her (softened edge); out-check.jpg = her on magenta to look at the edge."""
import os, sys
import cv2
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "..", "zoomcut", "tools", "sam"))
import keep  # noqa: E402

src, out = sys.argv[1], sys.argv[2]
im = cv2.imread(src)
h, w = im.shape[:2]
p = keep.image_predictor()
p.set_image(cv2.cvtColor(im, cv2.COLOR_BGR2RGB))
# keep: face, wig both sides, headband, shawl left / right, shirt, hand; not: wall, door, keyboard, black panel, lamp
pts = [[0.40, 0.30, 1], [0.22, 0.25, 1], [0.58, 0.25, 1], [0.32, 0.11, 1], [0.12, 0.62, 1], [0.85, 0.60, 1],
       [0.48, 0.75, 1], [0.38, 0.65, 1], [0.47, 0.60, 1], [0.45, 0.85, 1],
       [0.80, 0.12, 0], [0.75, 0.40, 0], [0.50, 0.97, 0], [0.03, 0.25, 0], [0.92, 0.30, 0], [0.68, 0.24, 0]]
m, sc = keep.predict(p, w, h, pts)
m[int(h * 0.905):] = 0  # the keyboard band: everything below goes (the poster fades her out above it)
# the torso as one solid piece: below the chin, fill each row between her outer edges (striped shirt holes)
y0 = int(h * 0.45)
for y in range(y0, h):
    xs = np.flatnonzero(m[y])
    if len(xs) > 1:
        m[y, xs[0]:xs[-1] + 1] = 255
n, lab, st, _ = cv2.connectedComponentsWithStats(m)
if n > 2:
    big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    m[lab != big] = 0
# enclosed holes anywhere (the glasses' lenses show the wall): whatever the outside can't reach is her
ff = m.copy()
cv2.floodFill(ff, np.zeros((h + 2, w + 2), np.uint8), (w - 1, 0), 255)
m[ff == 0] = 255
m = cv2.GaussianBlur(cv2.erode(m, np.ones((3, 3), np.uint8)), (5, 5), 0)
rgba = np.dstack([im, m])
cv2.imwrite(out, rgba)
chk = im.copy().astype(np.float32)
a = (m.astype(np.float32) / 255)[..., None]
chk = chk * a + np.array([255, 0, 255], np.float32) * (1 - a)
cv2.imwrite(out.replace(".png", "-check.jpg"), chk.astype(np.uint8))
print(f"score {sc:.2f}")
