# art/*.png -> public assets (cut, trimmed, sized). python tools/prep.py
import sys, os, numpy as np
from PIL import Image
sys.path.insert(0, 'C:/workspace/plaxzy/make-game-kit/skills/make-game/tools')
from sheetcut import cut_sheet, qa_sheet
S = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); A = S + '/art'
P = 'C:/workspace/BoostMind-hani/public/hani-games/shabbat-door/assets'
def trim(im):
    bb = im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox(); return im.crop(bb)
def fit_h(im, h): return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
frames, rep = cut_sheet(A + '/hani-back.png', 4, 1); print('\n'.join(rep))
try: qa_sheet(A + '/hani-back.png', 4, 1, A + '/qa-back.png')
except Exception as e: print('qa', e)
H = 560; base = max(f[0].height for f in frames)
for (im, fx, h), n in zip(frames, ['walk1', 'walk2', 'stand', 'oops']):
    im = trim(im); im = im.resize((round(im.width * H / base), round(im.height * H / base)), Image.LANCZOS)
    im.save(P + '/hani-%s.png' % n); print(n, im.size)
fit_h(trim(Image.open(A + '/hani-joy.png').convert('RGBA')), H).save(P + '/hani-joy.png')
# the Shabbat door: frame + two sliding glass panels (glass made see-through)
d = np.array(Image.open(A + '/door.png').convert('RGBA'))
x0, x1, y0, y1 = 200, 1336, 196, 926; mid = 768
rgb = d[:, :, :3].astype(int); glass = (rgb[:, :, 2] > rgb[:, :, 0] + 25)
fr = d.copy(); fr[y0:y1, x0:x1, 3] = 0
pan = d.copy(); g = glass & (pan[:, :, 3] > 0); pan[g, 3] = 120
box = (102, 74, 1435, 952)
def save(arr, crop, name):
    im = Image.fromarray(arr).crop(crop); im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS); im.save(P + '/' + name); return im.size
print('frame', save(fr, box, 'door-frame.png'))
print('left', save(pan, (x0, y0, mid, y1), 'door-left.png'), 'right', save(pan, (mid, y0, x1, y1), 'door-right.png'))
print('door geometry (frame px, halved): opening x', (x0 - box[0]) / 2, (x1 - box[0]) / 2, 'y', (y0 - box[1]) / 2, (y1 - box[1]) / 2, 'frame w', (box[2] - box[0]) / 2, 'h', (box[3] - box[1]) / 2)
fit_h(trim(Image.open(A + '/orderly.png').convert('RGBA')), 600).save(P + '/orderly.png')
r = trim(Image.open(A + '/roll.png').convert('RGBA')); r.thumbnail((160, 160)); r.save(P + '/roll.png')
for n in ['er', 'ward', 'out']:
    Image.open(A + '/corridor-%s.png' % n).convert('RGB').resize((768, 1152), Image.LANCZOS).save(P + '/bg-%s.jpg' % n, quality=84)
# the other visitors (seen from behind), cut by shapes
vf, vrep = cut_sheet(A + '/visitors.png', 3, 1); print('\n'.join(vrep))
vbase = max(f[0].height for f in vf)
for k, (im, fx, h) in enumerate(vf):
    im = trim(im); im = im.resize((round(im.width * 540 / vbase), round(im.height * 540 / vbase)), Image.LANCZOS); im.save(P + '/visitor-%d.png' % (k + 1)); print('visitor', k + 1, im.size)
