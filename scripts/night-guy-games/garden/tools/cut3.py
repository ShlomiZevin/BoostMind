# the start screen's painted pieces (menu/signs.png 3x2, menu/backsign.png) + the tall background
import sys, os
sys.path.insert(0, 'c:/workspace/plaxzy/make-game-kit/skills/make-game/tools')
from sheetcut import cut_sheet
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__)); M = os.path.join(D, '..', 'menu'); OUT = os.path.join(D, '..', '..', '..', '..', 'public', 'night-guy-games', 'garden', 'assets', 'ui')
os.makedirs(OUT, exist_ok=True)
frames, rep = cut_sheet(os.path.join(M, 'signs.png'), 3, 2); print(rep)
names = ['sign-play', 'sign-mid', 'badge-record', 'btn-sound', 'sign-thin']
for f, n in zip([x for x in frames if x], names):
    im = f[0].crop(f[0].getbbox()); w = 640 if n == 'sign-play' else 420; im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, n + '.webp'), quality=90); print(n, im.size)
b = Image.open(os.path.join(M, 'backsign.png')).convert('RGBA'); b = b.crop(b.getbbox()); b = b.resize((480, round(b.height * 480 / b.width)), Image.LANCZOS); b.save(os.path.join(OUT, 'sign-back.webp'), quality=90); print('sign-back', b.size)
t = Image.open(os.path.join(D, '..', '..', 'garden-promo', 'tall.png')).convert('RGB'); t.resize((768, 1152), Image.LANCZOS).save(os.path.join(OUT, 'start-bg.jpg'), quality=84)
