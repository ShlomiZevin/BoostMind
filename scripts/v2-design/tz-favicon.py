# ציפציפ's tab icon from GPT Image's favicon painting (G-fav.png, tz-logo-gpt.mjs fav - his note 2026-11-08: "the logo on
# the tab is still not good"): its black corners made transparent (a rounded square), scaled down to every tab size.
#   python scripts/v2-design/tz-favicon.py   ->  public/tziftzif/img/favicon-16|32|48|64.png
from PIL import Image, ImageDraw
SRC = 'C:/Users/shazbak/Documents/shlomiverse-v2-design/tz-logo/G-fav.png'
OUT = 'C:/workspace/BoostMind/public/tziftzif/img/'
im = Image.open(SRC).convert('RGBA')
w = im.width
m = 18   # the painting's black corner frame
im = im.crop((m, m, w - m, w - m))
big = 1024
im = im.resize((big, big), Image.LANCZOS)
mask = Image.new('L', (big * 4, big * 4), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, big * 4 - 1, big * 4 - 1), radius=int(big * 4 * 0.22), fill=255)
im.putalpha(mask.resize((big, big), Image.LANCZOS))
for n in (16, 32, 48, 64):
    im.resize((n, n), Image.LANCZOS).save(OUT + f'favicon-{n}.png', optimize=True)
print('ok')
