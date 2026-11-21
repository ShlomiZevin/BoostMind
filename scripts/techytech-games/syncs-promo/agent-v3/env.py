import sys, wave, numpy as np
w=wave.open(sys.argv[1]); sr=w.getframerate(); ch=w.getnchannels()
a,b=float(sys.argv[2]),float(sys.argv[3])
w.setpos(int(a*sr)); x=np.frombuffer(w.readframes(int((b-a)*sr)),np.int16).astype(np.float32).reshape(-1,ch).mean(1)/32768
h=int(sr*0.05)
for i in range(len(x)//h):
    r=np.sqrt((x[i*h:(i+1)*h]**2).mean()); print(f'{a+i*0.05:6.2f} {"#"*int(r*300)}')
