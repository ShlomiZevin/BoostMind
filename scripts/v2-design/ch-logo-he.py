# ח24's wide logo said "חרדות" - his note 2026-11-08: "החרדות missing an ה". The ה is made from the logo's own ח (same font,
# same roof): a copy of the ח with a gap cut between its roof and its left leg, set to the ח's right, the ח24 box moved over.
#   python scripts/v2-design/ch-logo-he.py   (rewrites public/charadot/img/logo-wide*.png; the old ones stay in Documents/shlomiverse-v2-design/news-logos/)
import os
from PIL import Image

D = 'C:/workspace/BoostMind/public/charadot/img/'

def runs(cols, th):
    out, on = [], False
    for x, v in enumerate(cols):
        if v > th and not on: s, on = x, True
        if v <= th and on: out.append((s, x)); on = False
    if on: out.append((s, len(cols)))
    return out

def ink(im, x, y):   # is this pixel part of the white letters?
    p = im.getpixel((x, y))
    return (p[3] > 40) if len(p) == 4 else (min(p[:3]) > 170)

def fix(name):
    src = D + name
    old = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/news-logos/' + name.replace('.png', '-old.png')   # the logo before the ה
    if not os.path.exists(old): Image.open(src).save(old)
    im = Image.open(old)
    rgba = im.mode == 'RGBA'
    w, h = im.size
    cols = [sum(ink(im, x, y) for y in range(h)) for x in range(w)]
    r = [g for g in runs(cols, 2) if g[1] - g[0] > 20]
    # the last two groups from the left: the ח (text's rightmost letter) and the ח24 box
    het, box = r[-2], r[-1]
    hx0, hx1 = het
    rows = [y for y in range(h) if any(ink(im, x, y) for x in range(hx0, hx1))]
    top, bot = rows[0], rows[-1]
    mid = (hx0 + hx1) // 2
    roof = next(y for y in range(top, bot) if not ink(im, mid, y))   # the roof's bottom edge
    # the left leg: from the ח's left edge to where the roof row's ink stops being a leg (first gap at a mid row)
    ymid = (roof + bot) // 2
    leg1 = next(x for x in range(hx0, hx1) if not ink(im, x, ymid))
    # the left leg's right edge: the first background pixel after the leg's ink, on a row in the middle of the leg
    x = hx0
    while not ink(im, x, ymid): x += 1
    while ink(im, x, ymid): x += 1
    leg1 = x
    # the letter as a mask (alpha, or how white a pixel is on the red), with the gap between the roof and the left leg
    # cleared - only the white is pasted, so the background never shows a seam
    crop = im.crop((hx0, 0, hx1, h))
    mask = crop.split()[3] if rgba else crop.convert('L').point(lambda v: max(0, min(255, int((v - 95) * 255 / 140))))
    g0, g1 = roof - 1, roof + int((bot - roof) * 0.32)
    for yy in range(g0, g1):
        for xx in range(0, leg1 - hx0 + 3):
            mask.putpixel((xx, yy), 0)
    color = Image.new(im.mode, crop.size, crop.getpixel((mid - hx0, (top + roof) // 2)))
    space = (het[0] - r[-3][1] if len(r) >= 3 else 20) + 6
    add = (hx1 - hx0) + space
    out = Image.new(im.mode, (w + add, h), (0, 0, 0, 0) if rgba else (0, 0, 0))
    if not rgba:   # the red background under the new letter: the background between the ח and the box, stretched
        out.paste(im.crop((hx1, 0, box[0], h)).resize((box[0] - hx1 + add, h)), (hx1, 0))
    out.paste(im.crop((0, 0, hx1 + 3, h)), (0, 0))
    out.paste(im.crop((hx1 + 2, 0, w, h)), (hx1 + 2 + add, 0))
    out.paste(color, (hx1 + space, 0), mask)
    out.save(src, optimize=True)
    print(name, im.size, '->', out.size, 'ח', het, 'box', box, 'roof', roof, 'leg', leg1)

for n in ['logo-wide-white.png', 'logo-wide-red.png', 'logo-wide.png']:
    fix(n)
