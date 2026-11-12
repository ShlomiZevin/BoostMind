import sys,os
from PIL import Image,ImageDraw
W=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pairs=[a.split(':') for a in sys.argv[2:]]
S=256; im=Image.new('RGB',(S*4,S*((len(pairs)+1)//2)),'white')
for i,(art,ref) in enumerate(pairs):
    x=(i%2)*2*S; y=(i//2)*S
    for j,p in enumerate([os.path.join(W,'refs',ref+'.jpg') if ref else None, os.path.join(W,'art',art+'.png')]):
        if p and os.path.exists(p):
            t=Image.open(p).convert('RGB'); t.thumbnail((S,S)); im.paste(t,(x+j*S,y))
    ImageDraw.Draw(im).text((x+4,y+4),art,fill='red')
im.save(sys.argv[1])
