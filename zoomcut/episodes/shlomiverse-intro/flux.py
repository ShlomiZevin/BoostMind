import subprocess, sys, numpy as np
k=sys.argv[1]
raw = subprocess.run(['ffmpeg','-v','error','-i',f'music/take-{k}.mp3','-ac','1','-ar','22050','-f','s16le','-'],capture_output=True).stdout
x = np.frombuffer(raw,np.int16).astype(float)/32768
hop=441; n=2048
fr=[]
for i in range(0,len(x)-n,hop):
    S=np.abs(np.fft.rfft(x[i:i+n]*np.hanning(n)))
    fr.append(np.log1p(S*10))
fr=np.array(fr)
flux=np.maximum(fr[1:]-fr[:-1],0).sum(1)
flux=(flux-np.median(flux))/flux.std()
peaks=[(i+1) for i in range(1,len(flux)-1) if flux[i]>flux[i-1] and flux[i]>=flux[i+1] and flux[i]>2.0]
print(k, [(round(p*hop/22050,2), round(flux[p-1],1)) for p in peaks])
