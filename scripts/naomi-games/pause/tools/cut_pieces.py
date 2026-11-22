# pieces sheet -> each piece by its solid shape (glow halo kept around it)
import numpy as np
from PIL import Image
from scipy import ndimage
OUT='../../../public/naomi-games/pause/assets'
im=Image.open('art/raw/pieces.png').convert('RGBA'); a=np.array(im)
solid=a[:,:,3]>200
lab,n=ndimage.label(solid)
objs=ndimage.find_objects(lab)
sizes=ndimage.sum(solid,lab,range(1,n+1))
big=sorted([(sizes[i],objs[i],i+1) for i in range(n) if sizes[i]>3000],key=lambda t:(t[1][1].start>700, t[1][0].start, t[1][1].start))
for s,(ys,xs),l in big: print(int(s), ys.start,ys.stop,xs.start,xs.stop)
names=['card-red','card-warm','card-white','card-gold','breath','gauge','needle']
for (s,(ys,xs),l),nm in zip(big,names):
    p=8; box=(max(xs.start-p,0),max(ys.start-p,0),min(xs.stop+p,im.width),min(ys.stop+p,im.height))
    c=np.array(im.crop(box)); c[:,:,3]=np.where(c[:,:,3]<60,0,c[:,:,3]); out=Image.fromarray(c)
    if nm in('breath','gauge'): out=out.resize((out.width*3//4,out.height*3//4),Image.LANCZOS)
    out.save(f'{OUT}/{nm}.webp',quality=90); print(nm,out.size)
