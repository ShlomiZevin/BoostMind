# cut a transparent sprite sheet into its figures: python cut.py sheet.png outdir name1,name2,... [maxH]
# figures are found as big blobs of solid alpha (the painter's soft glows are dropped), ordered by rows then RTL-free x
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage
src, out, names = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
maxH = int(sys.argv[4]) if len(sys.argv) > 4 else 360
im = Image.open(src).convert('RGBA'); a = np.array(im)
alpha = a[:, :, 3].astype(float)
solid = alpha > 200
grown = ndimage.binary_dilation(solid, iterations=int(os.environ.get("GROW","14")))
lab, n = ndimage.label(grown)
objs = ndimage.find_objects(lab)
blobs = []
for i, sl in enumerate(objs):
    area = (lab[sl] == i + 1).sum()
    if area > 0.004 * solid.size: blobs.append((sl, i + 1, area))
blobs.sort(key=lambda b: b[2], reverse=True); blobs = blobs[:len(names)]
H = a.shape[0]
blobs.sort(key=lambda b: (round(((b[0][0].start + b[0][0].stop) / 2) / (H / 2.2)), b[0][1].start))
os.makedirs(out, exist_ok=True)
na = np.clip((alpha - 110) * 255 / 120, 0, 255)
for (sl, lid, _), name in zip(blobs, names):
    m = (lab == lid)
    rgba = a.copy(); rgba[:, :, 3] = (na * m).astype(np.uint8)
    ys, xs = np.where(rgba[:, :, 3] > 0)
    crop = Image.fromarray(rgba).crop((xs.min() - 2, ys.min() - 2, xs.max() + 3, ys.max() + 3))
    if crop.height > maxH: crop = crop.resize((round(crop.width * maxH / crop.height), maxH), Image.LANCZOS)
    crop.save(os.path.join(out, name + '.webp'), quality=88, method=6)
    print(name, crop.size)
