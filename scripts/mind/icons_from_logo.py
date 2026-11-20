# The app's logo + home-screen icons from one transparent logo (renamed "PA" on 2026-11-20 - his call).
#   python scripts/mind/icons_from_logo.py <logo-1024.png>
# -> public/mind/logo-512.png, logo-200.png (transparent) and icon-64/180/192/512 + icon-maskable-512 (on #05070d, the
#    app's dark background; maskable keeps the logo inside the 80% safe circle)
import sys
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parents[2] / 'public' / 'mind'
BG = (5, 7, 13, 255)
src = Image.open(sys.argv[1]).convert('RGBA')
src = src.crop(src.getbbox())   # tight around the logo


def fit(size, pad):
    """the logo centred in a size x size square, `pad` = margin as a share of the side"""
    box = int(size * (1 - 2 * pad))
    lg = src.copy()
    lg.thumbnail((box, box), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(lg, ((size - lg.width) // 2, (size - lg.height) // 2))
    return canvas


def on_bg(img):
    bg = Image.new('RGBA', img.size, BG)
    bg.alpha_composite(img)
    return bg.convert('RGB')


fit(512, 0.02).save(OUT / 'logo-512.png')
fit(200, 0.02).save(OUT / 'logo-200.png')
for s in (64, 180, 192, 512):
    on_bg(fit(s, 0.06)).save(OUT / f'icon-{s}.png')
on_bg(fit(512, 0.14)).save(OUT / 'icon-maskable-512.png')
print('ok', OUT)
