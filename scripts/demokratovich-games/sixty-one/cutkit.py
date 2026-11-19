from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage
im=Image.open('art/kit.png').convert('RGBA'); a=np.array(im).astype(int)
bgc=a[5,5,:3]; d=np.abs(a[:,:,:3]-bgc).sum(2)
bgmask=d<28
lab,n=ndimage.label(bgmask); edge=set(lab[0,:])|set(lab[-1,:])|set(lab[:,0])|set(lab[:,-1]); edge.discard(0)
outside=np.isin(lab,list(edge))
fg=~outside
fg=ndimage.binary_opening(fg,iterations=2)
lab2,n2=ndimage.label(fg)
objs=ndimage.find_objects(lab2)
pieces=[]
for i,s in enumerate(objs):
    h=s[0].stop-s[0].start; w=s[1].stop-s[1].start
    if h*w<5000: continue
    pieces.append((s[0].start,s[1].start,i+1,s))
pieces.sort()
names=['main','back','plain','record','sound','panel','plaque']
# order by y then x
pieces.sort(key=lambda p:(round(p[0]/150),p[1]))
for nm,(y,x,idx,s) in zip(names,pieces):
    m=(lab2[s]==idx)
    m=ndimage.binary_fill_holes(m)
    crop=a[s].copy().astype(np.uint8); crop[:,:,3]=(m*255).astype(np.uint8)
    Image.fromarray(crop).save(f'../../../public/demokratovich-games/sixty-one/assets/ui-{nm}.png')
    print(nm,x,y,crop.shape)
