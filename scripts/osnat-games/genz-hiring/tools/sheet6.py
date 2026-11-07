import sys
from PIL import Image
out=sys.argv[1]; fs=sys.argv[2:]
ims=[Image.open(f).convert('RGB') for f in fs]; w=390; ims=[im.resize((w,round(im.height*w/im.width))) for im in ims]; h=max(i.height for i in ims)
cols=min(3,len(ims)); rows=(len(ims)+cols-1)//cols
S=Image.new('RGB',(w*cols,h*rows),'white');[S.paste(im,((i%cols)*w,(i//cols)*h)) for i,im in enumerate(ims)];S.save(out,quality=80)
