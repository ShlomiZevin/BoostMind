# cut realistic Hani out of the plain grey studio background -> name-cut.png (soft alpha, edge colour cleanup)
#   python cut.py glad point phone book   [--hole-top 0.35: only gaps in the top part (head/neck) count as backdrop - keeps a grey laptop / white shirt]
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

HT = 1.0
args = sys.argv[1:]
if '--hole-top' in args:
    i = args.index('--hole-top'); HT = float(args[i + 1]); del args[i:i + 2]
for name in args:
    im = np.asarray(Image.open(f'{name}.png').convert('RGB')).astype(np.float32)
    h, w, _ = im.shape
    border = np.concatenate([im[:8].reshape(-1, 3), im[-8:].reshape(-1, 3), im[:, :8].reshape(-1, 3), im[:, -8:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    # the backdrop has a soft gradient - compare against a blurred local background estimate
    d = np.sqrt(((im - bg) ** 2).sum(2))
    sat = im.max(2) - im.min(2)
    score = np.maximum(d, sat * 2.5)
    lum = im.mean(2)
    # backdrop (lit or shadowed) = grey: almost no colour and not dark; head covering is black, clothes navy, skin coloured
    fg = (score > 26) & ~((sat < 13) & (lum > 105) & (lum < bg.mean() + 25))
    # background = low-score region connected to the frame edge
    lab, _ = ndimage.label(~fg)
    edge_labels = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgmask = np.isin(lab, list(edge_labels))
    solid = fg & ~bgmask
    solid = ndimage.binary_opening(solid, iterations=2)
    # enclosed gaps (between head covering and neck) are backdrop too - only tiny holes count as body
    holes = ndimage.binary_fill_holes(solid) & ~solid
    hl, hn = ndimage.label(holes)
    if hn:
        hs = ndimage.sum(holes, hl, range(1, hn + 1))
        ys = ndimage.center_of_mass(holes, hl, range(1, hn + 1))
        top = np.where(solid.any(1))[0]; y0, y1 = top[0], top[-1]
        solid = solid | np.isin(hl, [i + 1 for i, v in enumerate(hs) if v < 400 or ys[i][0] > y0 + HT * (y1 - y0)])
    keep, n = ndimage.label(solid)
    if n > 1:
        sizes = ndimage.sum(solid, keep, range(1, n + 1))
        solid = keep == (1 + int(np.argmax(sizes)))
    a = Image.fromarray((solid * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6))
    alpha = np.asarray(a).astype(np.float32) / 255
    alpha = np.clip((alpha - 0.1) / 0.8, 0, 1)
    # decontaminate: remove grey spill on semi-transparent edge pixels
    ae = np.maximum(alpha, 1e-3)[..., None]
    col = np.where(alpha[..., None] < 0.98, (im - bg * (1 - ae)) / ae, im)
    col = np.clip(col, 0, 255)
    out = np.dstack([col, alpha * 255]).astype(np.uint8)
    img = Image.fromarray(out, 'RGBA')
    img = img.crop(img.getbbox())
    img.save(f'{name}-cut.png')
    print(name, img.size)
