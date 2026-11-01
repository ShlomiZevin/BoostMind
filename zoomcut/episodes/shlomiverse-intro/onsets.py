import subprocess, sys, numpy as np
for k in sys.argv[1:] or 'abc':
    raw = subprocess.run(['ffmpeg','-v','error','-i',(f'music/take-{k}.mp3' if k.startswith('A') else f'music/option-{k}.mp3'),'-ac','1','-ar','8000','-f','s16le','-'],capture_output=True).stdout
    x = np.frombuffer(raw,np.int16).astype(float)/32768
    w=400  # 50ms
    rms=np.array([20*np.log10(np.sqrt(np.mean(x[i:i+w]**2))+1e-9) for i in range(0,len(x)-w,w)])
    # onset strength: rms minus the max of the previous 150 ms
    ons=[]
    for i in range(3,len(rms)):
        s=rms[i]-rms[i-3:i].max()
        if s>3 and rms[i]>-30: ons.append((round(i*0.05,2),round(s,1),round(rms[i],1)))
    print(k, 'peak', round(rms.argmax()*0.05,2), round(rms.max(),1))
    print('  onsets', ons)
