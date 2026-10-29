# the family tree's layout: where each person's frame sits on the 1024x1536 painting (x, y, r)
# children in the crown, aunts/uncles on the branches, parents on the trunk, grandparents at the roots
import json
from PIL import Image, ImageDraw
L = {
 'shterni': (812,250,60), 'brachi': (662,230,60), 'chaimi': (512,220,60), 'sruli': (362,230,60), 'feigy': (212,250,60),
 'yanky': (737,390,60), 'ruchami': (587,380,60), 'malki': (437,380,60), 'shloimi': (287,390,60),
 'yossi': (905,600,56), 'rachli': (775,640,56), 'esti': (905,770,56), 'menachem': (775,810,56),
 'dovid': (249,640,56), 'pnina': (119,600,56),
 'avraham-moshe': (612,930,80), 'hani': (412,930,80),
 'saba-friedman': (844,1250,64), 'savta-friedman': (694,1290,64), 'saba-berger': (330,1290,64), 'savta-berger': (180,1250,64),
}
json.dump(L, open('layout.json','w'))
im = Image.new('RGB', (1024,1536), (240,228,200)); d = ImageDraw.Draw(im)
d.polygon([(450,1380),(574,1380),(560,1000),(600,600),(424,600),(464,1000)], fill=(110,78,48))   # trunk
d.rectangle([0,1400,1024,1536], fill=(150,180,190))                                              # the stream
for k,(x,y,r) in L.items():
    d.line([(512,980 if y>1100 else 600),(x,y)], fill=(110,78,48), width=14 if y>1100 else 10)   # roots / branches
d.ellipse([60,60,964,520], fill=(120,150,80))                                                    # the crown
for k,(x,y,r) in L.items():
    d.ellipse([x-r-8,y-r-8,x+r+8,y+r+8], fill=(196,150,60)); d.ellipse([x-r,y-r,x+r,y+r], fill=(255,255,255))
im.save('layout.png')
