# Cut the painted art into the game's assets (public/night-guy-games/garden/assets) + a QA picture to look at.
import sys, os
sys.path.insert(0, 'c:/workspace/plaxzy/make-game-kit/skills/make-game/tools')
from sheetcut import cut_sheet, qa_sheet
from PIL import Image
ART = os.path.join(os.path.dirname(__file__), '..', 'art')
OUT = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'public', 'night-guy-games', 'garden', 'assets')
def trim(im):
    bb = im.getbbox(); return im.crop(bb) if bb else im
def save(im, name, h):
    im = trim(im); w = round(im.width * h / im.height)
    im.resize((w, h), Image.LANCZOS).save(os.path.join(OUT, name + '.webp'), quality=88); print(name, w, h)
for n in ['walk', 'talk', 'caught']:
    save(Image.open(os.path.join(ART, 'guy-%s.png' % n)).convert('RGBA'), 'guy-' + n, 256)
save(Image.open(os.path.join(ART, 'police.png')).convert('RGBA'), 'police', 220)
qa = []
for g in ['dog', 'shake', 'phone', 'laptop']:
    sheet = os.path.join(ART, 'girl-%s.png' % g)
    frames, rep = cut_sheet(sheet, 2, 1); print(g, rep)
    for f, v in zip(frames, ['walk', 'run']): save(f[0], 'girl-%s-%s' % (g, v), 256)
    pass
frames, rep = cut_sheet(os.path.join(ART, 'faces.png'), 3, 1); print('faces', rep)
for f, v in zip(frames, ['polite', 'unsure', 'horror']): save(f[0], 'face-' + v, 128)
m = Image.open(os.path.join(ART, 'map.png')).convert('RGB'); m.resize((1024, 1536), Image.LANCZOS).save(os.path.join(OUT, 'map.jpg'), quality=86)
