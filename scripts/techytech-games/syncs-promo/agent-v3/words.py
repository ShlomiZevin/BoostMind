import sys, os, wave, numpy as np
from faster_whisper import WhisperModel
m = WhisperModel(r'C:/workspace/BoostMind/zoomcut/models/he-turbo', device='cpu', compute_type='int8')
for spec in sys.argv[1:]:
    f,a,b=spec.split(':'); a=float(a); b=float(b)
    w=wave.open(f); sr=w.getframerate(); ch=w.getnchannels(); w.setpos(int(a*sr))
    x=np.frombuffer(w.readframes(int((b-a)*sr)),np.int16).astype(np.float32).reshape(-1,ch).mean(1)/32768
    if sr!=16000:
        n=int(len(x)*16000/sr); x=np.interp(np.linspace(0,len(x)-1,n),np.arange(len(x)),x).astype(np.float32)
    segs,_=m.transcribe(x,language='he',word_timestamps=True)
    print('==',spec)
    for s in segs:
        for wd in s.words: print(f'{a+wd.start:7.2f}-{a+wd.end:7.2f} {wd.word}')
