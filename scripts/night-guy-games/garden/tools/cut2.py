# polish round: walk / run sheets (3 cols front|back|side x 2 rows stride|pass) -> frames on one canvas per sheet, feet
# on the same point; prop sheets (3x2) -> props; grounds -> jpg. QA picture art2/qa-cut2.jpg.
import sys, os
sys.path.insert(0, 'c:/workspace/plaxzy/make-game-kit/skills/make-game/tools')
from sheetcut import cut_sheet
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(D, '..', 'art2'); OUT = os.path.join(D, '..', '..', '..', '..', 'public', 'night-guy-games', 'garden', 'assets')
os.makedirs(os.path.join(OUT, 'anim'), exist_ok=True); os.makedirs(os.path.join(OUT, 'props'), exist_ok=True)
qa = []
def sheet_frames(name, outname, H=240):
    frames, rep = cut_sheet(os.path.join(A, name + '.png'), 3, 2)
    if rep: print(name, rep)
    ims = []
    for f in frames:
        im, fx, h = f; bb = im.getbbox(); ox = bb[0]; im = im.crop(bb); fx -= ox; ims.append((im, fx))
    mh = max(i.height for i, _ in ims); k = H / mh
    L = max(fx for _, fx in ims) * k; R = max(i.width - fx for i, fx in ims) * k
    Wc = int(L + R) + 4
    labels = ['f1', 'b1', 's1', 'f2', 'b2', 's2']
    for (im, fx), lab in zip(ims, labels):
        c = Image.new('RGBA', (Wc, H + 2), (0, 0, 0, 0))
        r = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
        c.alpha_composite(r, (int(L - fx * k) + 2, H + 2 - r.height))
        c.save(os.path.join(OUT, 'anim', f'{outname}-{lab}.webp'), quality=88); qa.append(c)
    print(outname, Wc, H, 'feet at', round(L + 2))
    return round((L + 2) / Wc, 3)
FEET = {}
FEET['guy'] = sheet_frames('guy-walk', 'guy')
for g in ['dog', 'shake', 'phone', 'laptop']:
    FEET[g] = sheet_frames(g + '-walk', g + '-walk'); FEET[g + '-run'] = sheet_frames(g + '-run', g + '-run')
print('FEET', FEET)
PROPS = {'park': ['bench', 'bin', 'lamp', 'tree', 'bush', 'fountain'], 'playground': ['slide', 'swings', 'sandbox', 'seesaw', 'horse', 'dome'],
         'botanic': ['pond', 'statue', 'pot', 'topiary', 'birdbath', 'glamp'], 'beach': ['palm', 'tower', 'icecream', 'umbrella', 'bluebin', 'blamp']}
for th, names in PROPS.items():
    frames, rep = cut_sheet(os.path.join(A, 'props-%s.png' % th), 3, 2)
    if rep: print(th, rep)
    for f, n in zip(frames, names):
        im = f[0].crop(f[0].getbbox()); h = 220; im = im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
        im.save(os.path.join(OUT, 'props', n + '.webp'), quality=88); qa.append(im)
h = Image.open(os.path.join(A, 'house.png')).convert('RGBA'); h = h.crop(h.getbbox()); h = h.resize((300, round(h.height * 300 / h.width)), Image.LANCZOS)
h.save(os.path.join(OUT, 'props', 'house.webp'), quality=88); qa.append(h)
for a in ['park', 'playground', 'botanic', 'beach']:
    Image.open(os.path.join(A, 'ground-%s.png' % a)).convert('RGB').save(os.path.join(OUT, 'ground-%s.jpg' % a), quality=84)
# QA
row = [q.resize((int(q.width * 120 / q.height), 120)) for q in qa]
lines = [row[i:i + 12] for i in range(0, len(row), 12)]
s = Image.new('RGBA', (max(sum(i.width + 6 for i in l) for l in lines), 124 * len(lines)), (0, 150, 0, 255))
for y, l in enumerate(lines):
    x = 0
    for i in l: s.alpha_composite(i, (x, y * 124)); x += i.width + 6
s.convert('RGB').save(os.path.join(A, 'qa-cut2.jpg'), quality=80)
