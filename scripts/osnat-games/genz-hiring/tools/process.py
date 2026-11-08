# run from scripts/osnat-games/genz-hiring:  python tools/process.py
# cut the painted sheets by their shapes (alpha blobs) and write the game's assets
import numpy as np, os
from PIL import Image
from scipy import ndimage
A='art'; OUT=r'C:/workspace/BoostMind/public/osnat-games/not-a-cog/assets'
def trim(im, pad=6):
    a=np.asarray(im)[:,:,3]; ys,xs=np.where(a>12)
    return im.crop((max(0,xs.min()-pad),max(0,ys.min()-pad),min(im.width,xs.max()+pad+1),min(im.height,ys.max()+pad+1)))
def blobs(im, n):
    a=np.asarray(im)[:,:,3]>20
    a=ndimage.binary_dilation(a,iterations=6)
    lab,k=ndimage.label(a); sizes=ndimage.sum(a,lab,range(1,k+1))
    keep=np.argsort(sizes)[::-1][:n]+1
    out=[]
    for l in keep:
        sl=ndimage.find_objects((lab==l).astype(int))[0]
        m=(lab==l)
        arr=np.asarray(im).copy(); arr[~m,3]=0
        out.append((sl[1].start, sl[0].start, trim(Image.fromarray(arr).crop((sl[1].start,sl[0].start,sl[1].stop,sl[0].stop)),2)))
    return out
def save(im,name,h):
    im=im.copy(); 
    if im.height>h: im=im.resize((round(im.width*h/im.height),h),Image.LANCZOS)
    im.save(f'{OUT}/{name}.webp',quality=86,method=6); print(name,im.size)
for p in ['idle','run','laugh','snack','sad']:
    save(trim(Image.open(f'{A}/osnat-{p}.png').convert('RGBA')),f'osnat-{p}',420)
save(trim(Image.open(f'{A}/desk.png').convert('RGBA')),'desk',300)
save(trim(Image.open(f'{A}/chair.png').convert('RGBA')),'chair',260)
for i in range(1,11):
    b=sorted(blobs(Image.open(f'{A}/c{i}.png').convert('RGBA'),2),key=lambda t:t[0])
    save(b[0][2],f'c{i}-stand',400); save(b[1][2],f'c{i}-sit',360)
ITEMS=['dog','ring','matcha','title','calendar','headphones','charger','contract','snack']
b=blobs(Image.open(f'{A}/items.png').convert('RGBA'),9)
b=sorted(b,key=lambda t:(t[1]//300,t[0]))
for name,(x,y,im) in zip(ITEMS,b): save(im,'i-'+name,200)
t=trim(Image.open(f'{A}/title.png').convert('RGBA')); save(t,'title',360); t.save(f'{OUT}/title.png')
cov=Image.open(f'{A}/cover.png').convert('RGB')
c=cov.resize((1200,round(cov.height*1200/cov.width)),Image.LANCZOS)
top=(c.height-630)//2; c=c.crop((0,top,1200,top+630)); c.save(os.path.dirname(OUT)+'/cover.jpg',quality=85)
h=c.copy().convert('RGBA'); tt=t.copy(); tt.thumbnail((430,230)); h.alpha_composite(tt,(24,18))
h.convert('RGB').save(f'{OUT}/hero.jpg',quality=85); h.convert('RGB').save(f'{OUT}/share.jpg',quality=85)
bg=Image.open(f'{A}/bg.png').convert('RGB'); bg.resize((720,1080),Image.LANCZOS).save(f'{OUT}/bg.jpg',quality=82)
