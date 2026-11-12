# cut crowd sheets by the white gaps (shapes), centre-crop each tile square, save 512 webp; writes a QA picture
import os, numpy as np
from PIL import Image
W=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A=os.path.join(W,'..','..','..','public','techytech-games','meetings','assets')
def runs(mask):
    out=[];s=None
    for i,v in enumerate(mask):
        if v and s is None: s=i
        if not v and s is not None:
            if i-s>60: out.append((s,i))
            s=None
    if s is not None and len(mask)-s>60: out.append((s,len(mask)))
    return out
def cut(sheet, names):
    im=Image.open(os.path.join(W,'art',sheet+'.png')).convert('RGB'); a=np.asarray(im).astype(int)
    dark=(a.min(axis=2)<235)
    rows=runs(dark.mean(axis=1)>0.15); tiles=[]
    for (y0,y1) in rows:
        cols=runs(dark[y0:y1].mean(axis=0)>0.15)
        for (x0,x1) in cols:
            # tighten to the tile within this cell
            sub=dark[y0:y1,x0:x1]; ys=np.where(sub.mean(axis=1)>0.5)[0]; xs=np.where(sub.mean(axis=0)>0.5)[0]
            tiles.append((x0+xs[0]+3,y0+ys[0]+3,x0+xs[-1]-3,y0+ys[-1]-3))
    print(sheet,len(tiles),'tiles')
    qa=[]
    for n,(x0,y0,x1,y1) in zip(names,tiles):
        w,h=x1-x0,y1-y0; s=min(w,h); cx=(x0+x1)//2; top=y0 if h>w else y0
        box=(cx-s//2,top,cx-s//2+s,top+s)
        t=im.crop(box).resize((512,512),Image.LANCZOS); t.save(os.path.join(A,n+'.webp'),quality=82); qa.append(t)
    return qa
qa=cut('crowd-sheet-1',['crowd-%02d'%i for i in range(1,13)])+cut('crowd-sheet-2',['crowd-%02d'%i for i in range(13,25)])+cut('crowd-talk-sheet',['crowd-%02d-talk'%i for i in range(1,9)])
Q=Image.new('RGB',(8*130,((len(qa)+7)//8)*130),(255,0,255))
for i,t in enumerate(qa): Q.paste(t.resize((128,128)),((i%8)*130,(i//8)*130))
Q.save(os.path.join(W,'art','_crowd-qa.jpg'))
