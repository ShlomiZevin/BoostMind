# the title came back with a painted checkerboard instead of transparency -> assets/title.png
# 1. hard mask: flood-fill the light grey/white checks from the border + every enclosed hole inside the letters
# 2. soft edges: an edge pixel is part letter, part light check - its alpha comes from how coloured/dark it is,
#    and the light check is taken back out of its colour, so no white halo is left around the letters
import os
import numpy as np
from PIL import Image
from collections import deque
from scipy import ndimage

G = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
im = np.array(Image.open(os.path.join(G, 'art', 'title-gpt.png')).convert('RGB')).astype(float)
h, w, _ = im.shape
mx, mn = im.max(axis=2), im.min(axis=2)
candles = np.zeros((h, w), bool); candles[:, int(w * .85):] = True   # the white candles live at the far right
bgish = (mn > 200) & (mx - mn < 18)
bg = np.zeros((h, w), bool)
q = deque((y, x) for y in range(h) for x in (0, w - 1) if bgish[y, x])
q.extend((y, x) for x in range(w) for y in (0, h - 1) if bgish[y, x])
for y, x in q: bg[y, x] = True
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx] and bgish[ny, nx]:
            bg[ny, nx] = True; q.append((ny, nx))
lab, n = ndimage.label(bgish & ~bg)
for k in range(1, n + 1):
    m = lab == k
    if not (m & candles).any(): bg |= m
# soft alpha in the letters: saturated (gold) or dark (navy) = letter, light and grey = check
sat = np.clip((mx - mn - 12) / 55, 0, 1)
dark = np.clip((205 - mn) / 70, 0, 1)
soft = np.maximum(sat, dark)
alpha = np.where(bg, 0.0, 1.0)
edge = ~candles
alpha[edge] = np.minimum(alpha[edge], soft[edge])
alpha = ndimage.uniform_filter(alpha, 2)                    # a hair of smoothing on the cut
alpha[~candles & bg] = 0
# take the light check back out of edge colours: c = a*fg + (1-a)*B  ->  fg = (c - (1-a)*B) / a
B = 228.0
a3 = np.clip(alpha, 1e-3, 1)[..., None]
fg = np.where(a3 < .98, (im - (1 - a3) * B) / a3, im)
fg = np.clip(fg, 0, 255)
out = Image.fromarray(np.dstack([fg, alpha * 255]).astype(np.uint8), 'RGBA')
box = out.getbbox(); out = out.crop((max(0, box[0] - 8), max(0, box[1] - 8), min(w, box[2] + 8), min(h, box[3] + 8)))
out.save(os.path.join(G, 'assets', 'title.png'), optimize=True)
print('title', out.size)
