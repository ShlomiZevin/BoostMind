# cut the painted sheets into game pieces (webp, sized for the screen)
import sys, os
sys.path.insert(0, r'C:/workspace/plaxzy/make-game-kit/skills/make-game/tools')
from sheetcut import cut_sheet, qa_sheet
from PIL import Image
OUT = '../../../public/naomi-games/pause/assets'
os.makedirs(OUT, exist_ok=True)
def save(im, name, w):
    bb = im.getchannel('A').point(lambda p: 255 if p > 40 else 0).getbbox(); im = im.crop(bb)
    if im.width > w: im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(f'{OUT}/{name}.webp', quality=88); print(name, im.size)
qa = []
for sheet, cols, names, w in [('emp-sheet', 4, ['emp-calm','emp-worried','emp-panic','emp-relieved'], 360),
                              ('naomi-sheet', 3, ['naomi-coach','naomi-heart','naomi-concern'], 360)]:
    frames, rep = cut_sheet(f'art/raw/{sheet}.png', cols, 1)
    print(sheet, rep); qa.append((sheet, frames, rep))
    for f, n in zip(frames, names): save(f[0], n, w)
qa_sheet(qa, 'art/raw/_qa.png')
