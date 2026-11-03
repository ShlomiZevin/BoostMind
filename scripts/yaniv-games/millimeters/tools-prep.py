# trims the painted parts/poses, finds each joint support (brace / tape), writes webp + parts.json into the game
import json, numpy as np
from PIL import Image
OUT = '../../../../public/yaniv-games/millimeters/assets/'
parts = {}
for n in ['wrist', 'elbow', 'knee', 'ankle', 'finger']:
    im = Image.open('parts/%s.png' % n).convert('RGBA'); im = im.crop(im.getchannel('A').getbbox())
    a = np.array(im).astype(int); op = a[..., 3] > 128
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    sup = op & ((((r + g + b) / 3) < 70) if n != 'finger' else ((b > r + 40) & (b > 120)))
    col = sup.sum(0) / np.maximum(op.sum(0), 1)
    xs = np.where(col > 0.35)[0]
    # the biggest run of support columns
    runs, s = [], xs[0]
    for i in range(1, len(xs)):
        if xs[i] != xs[i-1] + 1: runs.append((s, xs[i-1])); s = xs[i]
    runs.append((s, xs[-1])); x0, x1 = max(runs, key=lambda t: t[1] - t[0])
    ys = np.where(sup[:, x0:x1+1].any(1))[0]
    W = 900; k = W / im.width; im2 = im.resize((W, round(im.height * k)), Image.LANCZOS)
    im2.save(OUT + 'parts/%s.webp' % n, quality=88)
    parts[n] = {'w': im2.width, 'h': im2.height, 'b0': round(x0 * k), 'b1': round(x1 * k), 'py': round((ys.min() + ys.max()) / 2 * k)}
    print(n, parts[n])
json.dump(parts, open(OUT + 'parts.json', 'w'), indent=1)
for n in ['serious', 'wince', 'scream', 'talk', 'deadpan']:
    im = Image.open('poses/%s.png' % n).convert('RGBA').resize((640, 640), Image.LANCZOS); im.save(OUT + 'poses/%s.webp' % n, quality=88)
Image.open('bg.png').convert('RGB').save(OUT + 'bg.jpg', quality=84)
