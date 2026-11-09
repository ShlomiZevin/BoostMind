import sys
sys.path.insert(0, 'c:/workspace/plaxzy/make-game-kit/skills/make-game/tools')
from sheetcut import cut_sheet
OUT = '../../../../public/yotam-games/deadlock/assets/cars/'
names2 = ['yotam','erez','osnat','yaniv','ido','tzvika','amir','ronit','daniel','sagi','itay','ofer']
names3 = ['gilad','ofer-suv','shuttle']
for sheet, cols, rows, names, w in [('sheets/cars2.png',4,3,names2,420), ('sheets/cars3.png',1,3,names3,630)]:
    frames, rep = cut_sheet(sheet, cols, rows)
    print(sheet, rep)
    for (im, fx, h), n in zip(frames, names):
        im = im.crop(im.getbbox())
        r = w / im.width
        im = im.resize((w, round(im.height * r)))
        im.save(OUT + n + '.webp', quality=88)
        print(n, im.size)
