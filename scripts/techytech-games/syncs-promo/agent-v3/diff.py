import subprocess, numpy as np, sys
f=sys.argv[1]; W,H=78,169
p=subprocess.run(['ffmpeg','-v','error','-i',f,'-vf',f'fps=10,scale={W}:{H},format=gray','-f','rawvideo','-'],capture_output=True).stdout
a=np.frombuffer(p,np.uint8).reshape(-1,H,W).astype(float)
d=np.abs(np.diff(a,axis=0)).mean((1,2))
for i,v in enumerate(d):
    if v>1.5: print(f'{(i+1)/10:6.1f} {v:5.1f}')
