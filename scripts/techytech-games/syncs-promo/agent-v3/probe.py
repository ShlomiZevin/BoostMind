import subprocess, sys, numpy as np
from PIL import Image, ImageDraw, ImageFont
items=[x.split('@') for x in sys.argv[2:]]
F=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',22)
ims=[]
for f,t in items:
    p=subprocess.run(['ffmpeg','-v','error','-ss',t,'-i',f,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
    im=Image.frombytes('RGB',(780,1688),p); d=ImageDraw.Draw(im)
    for y in range(0,1688,100): d.line([(0,y),(30,y)],fill=(0,255,0),width=2); d.text((32,y-10),str(y),fill=(0,255,0),font=F)
    d.text((300,5),f'{f[-6:]} {t}',fill=(255,0,0),font=F)
    ims.append(im.resize((390,844)))
n=len(ims); cols=min(n,6); rows=(n+cols-1)//cols
S=Image.new('RGB',(390*cols,844*rows))
for i,im in enumerate(ims): S.paste(im,((i%cols)*390,(i//cols)*844))
S.save(sys.argv[1])
