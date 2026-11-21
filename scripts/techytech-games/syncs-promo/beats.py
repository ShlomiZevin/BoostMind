# tempo + beat phase of a music bed (numpy only): onset envelope -> autocorrelation tempo -> best phase
import sys, wave, numpy as np
w = wave.open(sys.argv[1]); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
hop = 256; n = 1024; fr = np.lib.stride_tricks.sliding_window_view(x, n)[::hop] * np.hanning(n)
S = np.log1p(np.abs(np.fft.rfft(fr, axis=1)) * 10); on = np.maximum(0, np.diff(S, axis=0)).sum(1); on -= on.mean()
fps = sr / hop; ac = np.correlate(on, on, 'full')[len(on) - 1:]
lags = np.arange(int(fps * 60 / 160), int(fps * 60 / 80)); L = lags[np.argmax(ac[lags])]; bpm = 60 * fps / L
per = 60 / bpm; best = max(np.arange(0, per, 0.005), key=lambda p: sum(on[int((p + k * per) * fps)] for k in range(int((len(on) / fps - p) / per))))
rms = [float(np.sqrt((x[int(t * sr):int((t + .5) * sr)] ** 2).mean())) for t in np.arange(0, len(x) / sr, .5)]
print(f'bpm {bpm:.2f} period {per:.4f} phase {best:.3f} len {len(x)/sr:.2f}')
print('rms/0.5s', ' '.join(f'{r:.2f}' for r in rms))
