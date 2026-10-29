# Shlomi's version of the look story (941x1672): the image model drew the label pills a little crooked.
# This erases each label's two pills (the cream name, the gold tag) with the backdrop around them and writes
# pills.html, which draws them again as clean rounded pills in the same place, size and colour, with the same text.
#   python fix_pills.py && shoot.mjs jobs-pills.json  ->  chat-pills.png
import json, statistics
import numpy as np
from PIL import Image

SRC = 'chat-fixed.png'
# label: (cream y-centre, cream x0, x1, name), (gold y-centre, x0, x1, tag)  - measured from the image
L = [
  ((291.5, 636, 920, 'מטפחת סריגה שחורה'), (331.5, 758, 916, 'אופנת חני · ₪35')),
  ((322.5, 75, 297, 'משקפיים דקות'),      (364.0, 118, 292, 'אופטיקה בשכונה · ₪150')),
  ((559.5, 664, 919, 'חולצה מכופתרת נייבי'), (600.0, 737, 916, 'אופנת חני · ₪59')),
  ((567.5, 115, 296, 'פלאפון כשר'),        (608.0, 45, 293, 'סלולר כשר בשכונה · ₪129')),
  ((908.5, 669, 919, 'חצאית מקסי שחורה'),  (949.5, 737, 916, 'אופנת חני · ₪69')),
  ((1163.5, 42, 292, 'נעלי בובה שטוחות'),  (1206.0, 95, 292, 'נעליים ברבי עקיבא · ₪79')),
]
CH, GH = 45, 31          # pill heights
# the gold dots each arrow starts from (the erase takes them with the pills)
DOTS = [(630, 292), (300, 321), (660, 558), (300, 567), (662, 907), (302, 1211)]
im = Image.open(SRC).convert('RGB'); px = im.load(); W, H = im.size
a = np.asarray(im).astype(int)

def backdrop_row(y0, y1, x0, x1):
    """per-column backdrop colour from rows y0..y1: the lightest sample, then a running median across x"""
    col = {x: max((px[x, y] for y in range(y0, y1)), key=sum) for x in range(max(0, x0 - 30), min(W, x1 + 31))}
    out = {}
    for x in range(x0, x1 + 1):
        w = [col[k] for k in range(x - 30, x + 31) if k in col]
        out[x] = tuple(int(statistics.median(p[i] for p in w)) for i in range(3))
    return out

gold_px = []
for (cy, cx0, cx1, _), (gy, gx0, gx1, _) in L:
    s = a[int(gy) - 6:int(gy) + 6, gx0 + 20:gx1 - 20].reshape(-1, 3)
    gold_px += [tuple(p) for p in s if p.min() < 200 and p[0] - p[2] > 70]
GOLD = tuple(int(statistics.median(p[i] for p in gold_px)) for i in range(3))
cream_px = [tuple(p) for (cy, cx0, cx1, _), _ in L for p in a[int(cy) - 14:int(cy) - 10, cx0 + 30:cx1 - 30].reshape(-1, 3) if p.min() > 215]
CREAM = tuple(int(statistics.median(p[i] for p in cream_px)) for i in range(3))

for (cy, cx0, cx1, _), (gy, gx0, gx1, _) in L:
    top, bot = int(cy - CH / 2) - 5, int(gy + GH / 2) + 5
    x0, x1 = min(cx0, gx0) - 3, max(cx1, gx1) + 3
    above, below = backdrop_row(top - 4, top, x0, x1), backdrop_row(bot, bot + 4, x0, x1)
    for x in range(x0, x1 + 1):
        for y in range(top, bot + 1):
            t = (y - top) / (bot - top)
            px[x, y] = tuple(int(above[x][i] * (1 - t) + below[x][i] * t) for i in range(3))
im.save('chat-nopills.png')

pills = []
for (cy, cx0, cx1, name), (gy, gx0, gx1, tag) in L:
    pills.append(f'<div class="c" style="top:{cy - CH / 2}px;left:{cx0}px;width:{cx1 - cx0}px">{name}</div>')
    pills.append(f'<div class="g" style="top:{gy - GH / 2}px;right:{W - gx1}px">{tag}</div>')
pills += [f'<i style="left:{x - 5}px;top:{y - 5}px"></i>' for x, y in DOTS]
html = f'''<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
/* written by fix_pills.py */
@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@700;800&display=swap');
* {{ margin:0; padding:0; box-sizing:border-box; }}
html, body {{ width:{W}px; height:{H}px; overflow:hidden; background:url(chat-nopills.png) 0 0 / {W}px {H}px; }}
.c, .g {{ position:absolute; display:flex; align-items:center; justify-content:center; white-space:nowrap; font-family:Heebo, sans-serif; }}
.c {{ height:{CH}px; border-radius:{CH / 2}px; background:rgb{CREAM}; color:rgb(16,28,63); font-weight:800; font-size:26px;
  box-shadow:0 2px 6px rgba(28,42,74,0.13); padding-bottom:2px; }}
i {{ position:absolute; width:10px; height:10px; border-radius:50%; background:rgb{GOLD}; }}
.g {{ height:{GH}px; border-radius:{GH / 2}px; background:rgb{GOLD}; color:#fff; font-weight:700; font-size:17.5px; padding:0 15px 1px; }}
</style></head><body>
{chr(10).join(pills)}
</body></html>'''
open('pills.html', 'w', encoding='utf-8').write(html)
json.dump([{'html': 'C:/workspace/BoostMind/zoomcut/episodes/_assets/haredit/look/pills.html',
            'out': 'C:/workspace/BoostMind/zoomcut/episodes/_assets/haredit/look/chat-pills.png', 'w': W, 'h': H}], open('jobs-pills.json', 'w'))
print('gold', GOLD, 'cream', CREAM)
