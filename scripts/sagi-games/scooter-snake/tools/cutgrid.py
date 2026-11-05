# cut a sheet laid out on a known grid: python cutgrid.py sheet.png outdir COLSxROWS name1,name2,... [maxH]
# each cell keeps every solid piece inside it (the soft glows are dropped)
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage
src, out, grid, names = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4].split(',')
maxH = int(sys.argv[5]) if len(sys.argv) > 5 else 360
C, R = map(int, grid.split('x'))
a = np.array(Image.open(src).convert('RGBA')); H, W = a.shape[:2]
alpha = a[:, :, 3].astype(float)
na = np.clip((alpha - 110) * 255 / 120, 0, 255)
os.makedirs(out, exist_ok=True)
for k, name in enumerate(names):
    cx, cy = k % C, k // C
    x0, x1, y0, y1 = W * cx // C, W * (cx + 1) // C, H * cy // R, H * (cy + 1) // R
    cell = alpha[y0:y1, x0:x1] > 200
    lab, n = ndimage.label(cell)
    sizes = ndimage.sum(cell, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 400])
    keep = ndimage.binary_dilation(keep, iterations=3)
    rgba = a[y0:y1, x0:x1].copy(); rgba[:, :, 3] = (na[y0:y1, x0:x1] * keep).astype(np.uint8)
    ys, xs = np.where(rgba[:, :, 3] > 0)
    crop = Image.fromarray(rgba).crop((max(0, xs.min() - 2), max(0, ys.min() - 2), xs.max() + 3, ys.max() + 3))
    if crop.height > maxH: crop = crop.resize((round(crop.width * maxH / crop.height), maxH), Image.LANCZOS)
    crop.save(os.path.join(out, name + '.webp'), quality=88, method=6)
    print(name, crop.size)
