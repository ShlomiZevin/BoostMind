import subprocess, sys, numpy as np
for k in (__import__('sys').argv[1:] or 'abc'):
    raw = subprocess.run(['ffmpeg','-v','error','-i',(f'music/take-{k}.mp3' if k.startswith('A') else f'music/option-{k}.mp3'),'-ac','1','-ar','8000','-f','s16le','-'],capture_output=True).stdout
    x = np.frombuffer(raw,np.int16).astype(float)/32768
    w=2000  # 0.25s
    rms=[20*np.log10(np.sqrt(np.mean(x[i:i+w]**2))+1e-9) for i in range(0,len(x)-w,w)]
    # onset: biggest jump
    d=np.diff(rms)
    top=np.argsort(d)[-4:][::-1]
    print(k,' '.join(f'{v:.0f}' for v in rms))
    print('  biggest jumps at', [(round((i+1)*0.25,2), round(d[i],1)) for i in top])
