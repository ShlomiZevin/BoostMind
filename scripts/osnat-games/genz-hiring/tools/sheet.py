import sys
from PIL import Image
files=sys.argv[2:]; out=sys.argv[1]
cell=360; cols=4; rows=(len(files)+cols-1)//cols
S=Image.new('RGB',(cols*cell,rows*cell),(255,0,255))
for i,f in enumerate(files):
    im=Image.open(f).convert('RGBA'); im.thumbnail((cell-8,cell-8))
    bg=Image.new('RGBA',(cell,cell),(60,200,120,255)); bg.alpha_composite(im,((cell-im.width)//2,(cell-im.height)//2))
    S.paste(bg.convert('RGB'),((i%cols)*cell,(i//cols)*cell))
S.save(out,quality=85)
