# start-screen pieces (design B) by shape + title art + key art
import numpy as np
from PIL import Image
from scipy import ndimage
OUT='../../../public/naomi-games/pause/assets/ui'
import os; os.makedirs(OUT, exist_ok=True)
im=Image.open('art/raw/ui-sheet.png').convert('RGBA'); a=np.array(im)
solid=ndimage.binary_erosion(a[:,:,3]>200, iterations=2); lab,n=ndimage.label(solid); objs=ndimage.find_objects(lab); sizes=ndimage.sum(solid,lab,range(1,n+1))
big=sorted([(objs[i],sizes[i]) for i in range(n) if sizes[i]>5000], key=lambda t:(t[0][0].start//150, -t[0][1].start))
names={}
for (ys,xs),s in big:
    cx=(xs.start+xs.stop)/2; cy=(ys.start+ys.stop)/2
    nm='play' if cy<380 else ('mid' if cx<1200 else 'snd') if cy<700 else 'rec'
    p=4; c=np.array(im.crop((max(xs.start-p,0),max(ys.start-p,0),min(xs.stop+p,im.width),min(ys.stop+p,im.height)))); c[:,:,3]=np.where(c[:,:,3]<60,0,c[:,:,3])
    o=Image.fromarray(c); w={'play':640,'mid':420,'back':420,'rec':480,'snd':160}[nm]
    o=o.resize((w,round(o.height*w/o.width)),Image.LANCZOS); o.save(f'{OUT}/{nm}.webp',quality=90); print(nm,o.size,(xs.start,ys.start,xs.stop,ys.stop))
t=Image.open('art/raw/title.png').convert('RGBA'); ta=np.array(t); ta[:,:,3]=np.where(ta[:,:,3]<60,0,ta[:,:,3]); t=Image.fromarray(ta)
t=t.crop(t.getchannel('A').point(lambda v:255 if v>60 else 0).getbbox()); t=t.resize((760,round(t.height*760/t.width)),Image.LANCZOS)
t.save('../../../public/naomi-games/pause/assets/title.webp',quality=90); print('title',t.size)
k=Image.open('art/raw/key.png').convert('RGB').resize((768,1152),Image.LANCZOS); k.save(f'{OUT}/key.jpg',quality=84); print('key',k.size)
