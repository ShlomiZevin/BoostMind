# The planet logo for the page itself: the app icon (planet + "שלומיוורס" on its ring) without its black square.
# The planet and the ring stay solid; the orange glow around them fades out by its own brightness.
#   python scripts/v2-design/logo_cutout.py   ->  v2/site/verse/logo-512.png, logo-160.png
import numpy as np
from PIL import Image
from scipy import ndimage
from pathlib import Path

SITE = Path(__file__).resolve().parents[2] / 'v2' / 'site' / 'verse'
src = np.asarray(Image.open(SITE / 'icon-512.png').convert('RGB')).astype(np.float32)
bg = np.median(np.concatenate([src[:8, :8].reshape(-1, 3), src[-8:, -8:].reshape(-1, 3)]), axis=0)

lum = src.max(axis=2)
solid = ndimage.binary_fill_holes(ndimage.binary_closing(lum > 235, iterations=3))   # the planet's rim, the ring, all inside
solid = ndimage.binary_opening(solid, iterations=2)
# glow: alpha from how far a pixel is above the black, colour un-mixed from the black under it
glow_a = np.clip((lum - bg.max()) / 255.0 * 1.6, 0, 1)
alpha = np.where(solid, 1.0, glow_a)
alpha = np.maximum(alpha, ndimage.gaussian_filter(solid.astype(np.float32), 1.2) * (alpha > 0))  # soft edge on the planet
rgb = np.where(solid[..., None], src, (src - bg * (1 - glow_a[..., None])) / np.maximum(glow_a[..., None], 1e-3))
out = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)

img = Image.fromarray(out, 'RGBA')
img = img.crop(img.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())   # trim to where the glow is still visible
# feather the last 36 px to nothing, so the glow never ends in a visible edge
a = np.asarray(img).astype(np.float32); h, w = a.shape[:2]
yy, xx = np.mgrid[0:h, 0:w]
edge = np.minimum.reduce([xx, yy, w - 1 - xx, h - 1 - yy]).astype(np.float32)
a[..., 3] *= np.clip(edge / 36.0, 0, 1)
img = Image.fromarray(a.astype(np.uint8), 'RGBA')
img.save(SITE / 'logo-512.png', optimize=True)
small = img.copy(); small.thumbnail((160, 160), Image.LANCZOS); small.save(SITE / 'logo-160.png', optimize=True)
print(img.size, small.size)

# the browser tab's icon: the same see-through logo on a square canvas (the app icon keeps its black square - phones
# need an opaque home-screen icon, a tab doesn't)
side = max(img.size)
sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
sq.paste(img, ((side - img.width) // 2, (side - img.height) // 2), img)
for n in (32, 48, 192):
    sq.resize((n, n), Image.LANCZOS).save(SITE / f'favicon-{n}.png', optimize=True)
sq.resize((48, 48), Image.LANCZOS).save(SITE / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
print('favicons ok')
