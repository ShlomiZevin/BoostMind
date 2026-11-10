# Cut the painted sheets (art/*.png) into the game's sprite strips and props (public/rosenblum-games/drill/assets/).
#   python tools/cut.py      -> assets/*.webp|png + assets/sprites.json + art/_qa.png (look at it)
# Every frame of a strip sits in the same cell, feet at the bottom centre, so the game draws a strip frame by frame.
import json, os, sys
from PIL import Image
sys.path.insert(0, 'c:/workspace/plaxzy/make-game-kit/skills/make-game/tools')
from sheetcut import cut_sheet, qa_sheet

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(HERE, 'art')
OUT = os.path.join(HERE, '..', '..', '..', 'public', 'rosenblum-games', 'drill', 'assets')
os.makedirs(OUT, exist_ok=True)

# name: (sheet, cols, rows, [cell indexes], target height px, flip)
STRIPS = {
    'pairA':  ('pairs', 4, 3, [0, 1, 2, 3], 132, False),
    'pairB':  ('pairs', 4, 3, [4, 5, 6, 7], 132, False),
    'pairC':  ('pairs', 4, 3, [8, 9, 10, 11], 132, False),
    'shahar': ('special', 4, 2, [0, 1, 2, 3], 132, False),
    'omer':   ('special', 4, 2, [4, 5, 6, 7], 132, False),
    'block':  ('actions', 4, 2, [0, 1], 132, False),
    'build':  ('actions', 4, 2, [2], 120, False),
    'open':   ('actions', 4, 2, [3], 132, False),
    'fall':   ('actions', 4, 2, [4], 96, False),
    'cheer':  ('actions', 4, 2, [5], 132, False),
    'turn':   ('actions', 4, 2, [6], 132, False),
    'sad':    ('actions', 4, 2, [7], 124, False),
    'reut':   ('reut', 4, 2, [0, 1, 2, 3], 140, False),
    'reutKids': ('reut', 4, 2, [4, 5, 6, 7], 132, False),
    'rosen':  ('rosen', 4, 1, [0, 1, 2, 3], 150, True),
}
PROPS = ['doorClass', 'doorWc', 'doorYard', 'doorShelter', 'doorLocked', 'stairs', 'cone', 'chair',
         'board', 'lockers', 'plant', 'exitSign']
PROP_H = {'stairs': 260, 'cone': 70, 'chair': 90, 'board': 110, 'lockers': 150, 'plant': 90, 'exitSign': 50}

cache, qa, meta = {}, [], {}
def sheet(name, cols, rows):
    k = (name, cols, rows)
    if k not in cache:
        cache[k] = cut_sheet(os.path.join(ART, name + '.png'), cols, rows)
        qa.append(('%s %dx%d' % k, *cache[k]))
    return cache[k][0]

for name, (sh, cols, rows, cells, th, flip) in STRIPS.items():
    frames = [sheet(sh, cols, rows)[i] for i in cells]
    hmax = max(f[2] for f in frames)
    k = th / hmax
    # cell: wide enough for every frame around its feet
    left = max(f[1] for f in frames); right = max(f[0].width - f[1] for f in frames)
    cw, chh = int((2 * max(left, right)) * k) + 4, th + 2
    strip = Image.new('RGBA', (cw * len(frames), chh))
    for i, (im, fx, h) in enumerate(frames):
        t = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)
        if flip: t = t.transpose(Image.FLIP_LEFT_RIGHT); fx = im.width - fx
        strip.paste(t, (i * cw + cw // 2 - int(fx * k), chh - t.height), t)
    strip.save(os.path.join(OUT, name + '.webp'), quality=88, method=6)
    meta[name] = {'w': cw, 'h': chh, 'n': len(frames)}

props = sheet('props', 4, 3)
for i, name in enumerate(PROPS):
    im = props[i][0]; th = PROP_H.get(name, 200)
    t = im.resize((int(im.width * th / im.height), th), Image.LANCZOS)
    t.save(os.path.join(OUT, name + '.webp'), quality=88, method=6)
    meta[name] = {'w': t.width, 'h': t.height}

heads = sheet('heads', 3, 1)
for i, name in enumerate(['headTalk', 'headAngry', 'headShock']):
    im = heads[i][0]; t = im.resize((int(im.width * 220 / im.height), 220), Image.LANCZOS)
    t.save(os.path.join(OUT, name + '.webp'), quality=90, method=6)
    meta[name] = {'w': t.width, 'h': t.height}

for name, ext, w, crop in [('wall', 'jpg', 512, None), ('concrete', 'jpg', 512, None), ('slab', 'jpg', 768, (0, 0, 1536, 470))]:
    im = Image.open(os.path.join(ART, name + '.' + ext)).convert('RGB')
    if crop: im = im.crop(crop)
    im = im.resize((w, int(im.height * w / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.jpg'), quality=82)
    meta[name] = {'w': im.width, 'h': im.height}

json.dump(meta, open(os.path.join(OUT, 'sprites.json'), 'w'), indent=1)
qa_sheet(qa, os.path.join(ART, '_qa.png'))
for n, _, rep in qa:
    for r in rep: print(n, r)
print('ok', len(meta))
