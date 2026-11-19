# rewrite a GLB: constant animation channels -> 1 key, drop non-hips translation/scale channels; repack buffer
import json,struct,sys,numpy as np
src,dst=sys.argv[1],sys.argv[2]
f=open(src,'rb').read(); l=struct.unpack('<I',f[12:16])[0]; j=json.loads(f[20:20+l])
binoff=20+l+8; B=f[binoff:]
bv=j['bufferViews']; acc=j['accessors']
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}; DT={5126:np.float32,5125:np.uint32,5123:np.uint16,5121:np.uint8}
def read(i):
    a=acc[i]; v=bv[a['bufferView']]; n=NC[a['type']]
    off=v.get('byteOffset',0)+a.get('byteOffset',0)
    return np.frombuffer(B,dtype=DT[a['componentType']],count=a['count']*n,offset=off).reshape(a['count'],n)
nodes=j['nodes']
newacc=[];newbv=[];blob=bytearray()
def push(arr,ctype,typ,target=None,minmax=False,norm=False):
    arr=np.ascontiguousarray(arr)
    while len(blob)%4: blob.append(0)
    o=len(blob); blob.extend(arr.tobytes())
    v={'buffer':0,'byteOffset':o,'byteLength':arr.nbytes}
    if target: v['target']=target
    newbv.append(v)
    a={'bufferView':len(newbv)-1,'componentType':ctype,'count':arr.shape[0],'type':typ}
    if norm: a['normalized']=True
    if minmax: a['min']=arr.min(0).tolist(); a['max']=arr.max(0).tolist()
    newacc.append(a); return len(newacc)-1
remap={}
def copyacc(i):
    if i in remap: return remap[i]
    a=acc[i]; v=bv[a['bufferView']]
    arr=read(i)
    k=push(arr,a['componentType'],a['type'],v.get('target'),'min' in a,a.get('normalized',False))
    if 'min' in a: newacc[k]['min']=a['min']; newacc[k]['max']=a['max']
    remap[i]=k; return k
for m in j['meshes']:
    for p in m['primitives']:
        p['attributes']={k:copyacc(v) for k,v in p['attributes'].items()}
        p['indices']=copyacc(p['indices'])
        for t in p.get('targets',[]):
            for k in list(t): t[k]=copyacc(t[k])
for s in j.get('skins',[]):
    if 'inverseBindMatrices' in s: s['inverseBindMatrices']=copyacc(s['inverseBindMatrices'])
for im in j.get('images',[]):
    v=bv[im['bufferView']]; data=B[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
    while len(blob)%4: blob.append(0)
    o=len(blob); blob.extend(data); newbv.append({'buffer':0,'byteOffset':o,'byteLength':len(data)}); im['bufferView']=len(newbv)-1
for an in j['animations']:
    chans=[];samps=[]
    for c in an['channels']:
        s=an['samplers'][c['sampler']]; node=nodes[c['target']['node']]['name']; path=c['target']['path']
        if path in('translation','scale') and not node.endswith('Hips'): continue
        t=read(s['input']).astype(np.float32); v=read(s['output']).astype(np.float32)
        if np.abs(v-v[0]).max()<1e-4: t=t[:1]; v=v[:1]
        else:
            # every other frame (15 fps)
            keep=np.arange(0,len(t),2)
            if keep[-1]!=len(t)-1: keep=np.append(keep,len(t)-1)
            t=t[keep]; v=v[keep]
        ti=push(t,5126,'SCALAR',minmax=True); vi=push(v,5126,acc[s['output']]['type'])
        samps.append({'input':ti,'output':vi,'interpolation':s.get('interpolation','LINEAR')})
        chans.append({'sampler':len(samps)-1,'target':c['target']})
    an['channels']=chans; an['samplers']=samps
j['accessors']=newacc; j['bufferViews']=newbv; j['buffers']=[{'byteLength':len(blob)}]
while len(blob)%4: blob.append(0)
js=json.dumps(j,separators=(',',':')).encode()
while len(js)%4: js+=b' '
out=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(blob))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(blob),0x004E4942)+bytes(blob)
open(dst,'wb').write(out); print(dst,len(out)//1024,'KB')
