# cut the painted sheets into the game's pictures (public/lola-games/pills/assets)
import sys, os
sys.path.insert(0, 'c:/workspace/plaxzy/make-game-kit/skills/make-game/tools')
from sheetcut import cut_sheet
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ART = os.path.join(HERE, '..', 'art')
OUT = os.path.join(HERE, '..', '..', '..', '..', 'public', 'lola-games', 'pills', 'assets')
os.makedirs(OUT, exist_ok=True)
def fit(im, m):
    k = min(1, m / max(im.size)); return im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
PILLS = ['aspirin', 'bisoprolol', 'warfarin', 'omeprazole', 'metformin', 'atorvastatin', 'calcium', 'vitd', 'omega3', 'iron']
fr, _ = cut_sheet(os.path.join(ART, 'pills-sheet.png'), 5, 2)
for n, f in zip(PILLS, fr): fit(f[0], 220).save(os.path.join(OUT, 'pill-' + n + '.webp'), quality=88)
for who, poses in [('lola', ['please', 'water', 'oops']), ('savta', ['suspect', 'whisper', 'pleased'])]:
    fr, _ = cut_sheet(os.path.join(ART, who + '-sheet.png'), 3, 1)
    for n, f in zip(poses, fr): fit(f[0], 400).save(os.path.join(OUT, who + '-' + n + '.webp'), quality=86)
Image.open(os.path.join(ART, 'room.png')).convert('RGB').resize((720, 1080), Image.LANCZOS).save(os.path.join(OUT, 'room.jpg'), quality=82)
b = Image.open(os.path.join(ART, 'bottle2.png')); b = b.crop(b.split()[3].getbbox()); fit(b, 420).save(os.path.join(OUT, 'bottle.webp'), quality=88)
Image.open(os.path.join(ART, 'cell.png')).convert('RGB').resize((160, 160), Image.LANCZOS).save(os.path.join(OUT, 'cell.jpg'), quality=85)
print(sorted(os.listdir(OUT)))

# ---- round 2: the designer's pieces (design/) ----
D = os.path.join(HERE, '..', 'design')
t = Image.open(os.path.join(D, 'title.png')); t = t.crop(t.split()[3].getbbox()); fit(t, 760).save(os.path.join(OUT, 'title.png'), optimize=True)
h = Image.open(os.path.join(D, 'hero.png')).convert('RGB'); hh = round(h.width / 1.905); y0 = 70
h = h.crop((0, y0, h.width, y0 + hh))
h.resize((960, 504), Image.LANCZOS).save(os.path.join(OUT, 'hero.jpg'), quality=84)
COVER = os.path.join(OUT, '..', 'cover.jpg'); h.resize((1200, 630), Image.LANCZOS).save(COVER, quality=86)
sh = h.resize((1200, 630), Image.LANCZOS).convert('RGBA'); tt = fit(t, 470); sh.alpha_composite(tt, ((1200 - tt.width) // 2, 630 - tt.height - 6)); sh.convert('RGB').save(os.path.join(OUT, 'share.jpg'), quality=86)
fr, _ = cut_sheet(os.path.join(D, 'ui.png'), 4, 1)
for n, f in zip(['hand', 'cap', 'star', 'bulb'], fr): fit(f[0], 200).save(os.path.join(OUT, n + '.webp'), quality=90)
s = Image.open(os.path.join(D, 'thumbs.png')); s = s.crop(s.split()[3].getbbox()); fit(s, 400).save(os.path.join(OUT, 'savta-thumbs.webp'), quality=86)
# the compartment, paler like the designer's pill box
from PIL import ImageEnhance
c = Image.open(os.path.join(ART, 'cell.png')).convert('RGB').resize((160, 160), Image.LANCZOS)
c = ImageEnhance.Color(c).enhance(.55); c = Image.blend(c, Image.new('RGB', c.size, (236, 244, 252)), .35); c.save(os.path.join(OUT, 'cell.jpg'), quality=88)
if os.path.exists(os.path.join(D, 'icons2.png')):
    fr, rep = cut_sheet(os.path.join(D, 'icons2.png'), 3, 1); print('icons', rep)
    for n, f in zip(['mode-box', 'mode-sort', 'mode-tray'], fr):
        if f: fit(f[0], 300).save(os.path.join(OUT, n + '.webp'), quality=88)
print(sorted(os.listdir(OUT)))
