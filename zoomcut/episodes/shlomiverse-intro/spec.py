import subprocess, sys, numpy as np
for k in sys.argv[1:]:
    f = f'music/take-{k}.mp3' if k.startswith('A') else f'music/{k}.mp3'
    raw = subprocess.run(['ffmpeg','-v','error','-i',f,'-ac','1','-ar','16000','-f','s16le','-'],capture_output=True).stdout
    x = np.frombuffer(raw,np.int16).astype(float)/32768
    out=[]
    for s in range(0,int(len(x)/16000)):
        seg=x[s*16000:(s+1)*16000]
        S=np.abs(np.fft.rfft(seg*np.hanning(len(seg))))
        fr=np.fft.rfftfreq(len(seg),1/16000)
        low=S[fr<200].sum()/S.sum()
        cen=(S*fr).sum()/S.sum()
        out.append(f'{s}s:c{cen:.0f}/L{low:.2f}')
    print(k,' '.join(out))
