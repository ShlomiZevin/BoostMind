# GLB: keep only base-colour textures (drop normal / metal-roughness / occlusion / emissive maps), resize them to N px webp; repack.
import json,struct,sys,io
from PIL import Image
src,dst,N=sys.argv[1],sys.argv[2],int(sys.argv[3])
f=open(src,'rb').read(); l=struct.unpack('<I',f[12:16])[0]; j=json.loads(f[20:20+l]); B=f[20+l+8:]
for m in j.get('materials',[]):
    for k in ['normalTexture','occlusionTexture','emissiveTexture']: m.pop(k,None)
    pb=m.setdefault('pbrMetallicRoughness',{}); pb.pop('metallicRoughnessTexture',None); pb['metallicFactor']=0; pb['roughnessFactor']=0.75
    m.pop('extensions',None)
used={m['pbrMetallicRoughness']['baseColorTexture']['index'] for m in j.get('materials',[]) if 'baseColorTexture' in m.get('pbrMetallicRoughness',{})}
bv=j['bufferViews']; blob=bytearray(); newbv=[]; remap={}
def add(data,target=None):
    while len(blob)%4: blob.append(0)
    o=len(blob); blob.extend(data); v={'buffer':0,'byteOffset':o,'byteLength':len(data)}
    if target: v['target']=target
    newbv.append(v); return len(newbv)-1
imgs_used={j['textures'][t].get('source', j['textures'][t].get('extensions',{}).get('EXT_texture_webp',{}).get('source')) for t in used}
img_bv={i['bufferView'] for k,i in enumerate(j.get('images',[]))}
for k,v in enumerate(bv):
    if k in img_bv: continue
    o=v.get('byteOffset',0); remap[k]=add(B[o:o+v['byteLength']],v.get('target'))
    for kk in ('byteStride',):
        if kk in v: newbv[-1][kk]=v[kk]
for k,im in enumerate(j.get('images',[])):
    v=bv[im['bufferView']]; o=v.get('byteOffset',0); data=B[o:o+v['byteLength']]
    if k in imgs_used:
        p=Image.open(io.BytesIO(data)).convert('RGB'); p=p.resize((min(N,p.width),min(N,p.height)),Image.LANCZOS)
        b=io.BytesIO(); p.save(b,'WEBP',quality=82); data=b.getvalue(); im['mimeType']='image/webp'
    else: data=b''
    im['bufferView']=add(data)
for a in j['accessors']:
    if 'bufferView' in a: a['bufferView']=remap[a['bufferView']]
j['bufferViews']=newbv; j['buffers']=[{'byteLength':len(blob)}]
while len(blob)%4: blob.append(0)
js=json.dumps(j,separators=(',',':')).encode()
while len(js)%4: js+=b' '
open(dst,'wb').write(struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(blob))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(blob),0x004E4942)+bytes(blob))
print(dst, len(open(dst,'rb').read())//1024,'KB, textures kept', sorted(imgs_used))
