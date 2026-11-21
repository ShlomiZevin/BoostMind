import subprocess, sys
from PIL import Image, ImageDraw, ImageFont
f=sys.argv[1]; out=sys.argv[2]; ts=[float(x) for x in sys.argv[3].split(',')]
F=ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',30)
ims=[]
for t in ts:
    p=subprocess.run(['ffmpeg','-v','error','-ss',str(t),'-i',f,'-frames:v','1','-vf','scale=360:640','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
    im=Image.frombytes('RGB',(360,640),p); d=ImageDraw.Draw(im)
    d.rectangle([0,0,110,40],fill=(0,0,0)); d.text((6,4),f'{t:.2f}',fill=(255,255,0),font=F)
    d.line([(0,83),(360,83)],fill=(255,0,0)); d.line([(0,553),(360,553)],fill=(255,0,0))   # IG safe zones 250 / 1660
    ims.append(im)
cols=8; rows=(len(ims)+cols-1)//cols
S=Image.new('RGB',(360*cols,640*rows),(30,30,30))
for i,im in enumerate(ims): S.paste(im,((i%cols)*360,(i//cols)*640))
S.save(out)
