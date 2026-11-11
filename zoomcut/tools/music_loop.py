"""A music bed as a seamless loop (his rule, savta-1, 2026-11-11: "don't create more than 40 sec, then loop it - no silence
between connections"): finds the stretch of 24-40 s whose end sounds like its start (pitch classes + band energies over
3 s), lines the end up with the start to the sample, blends the last 10 ms, writes a WAV (an mp3 adds silence at the start).
Put it back to back on the music row with fade_in / fade_out 0. Prints the match (0.8 = clean) and the quietest 20 ms at
the joins.
usage: .venv/Scripts/python.exe tools/music_loop.py <in> <out.wav> [max 40] [min 24]"""
import subprocess, sys
import numpy as np

src, out = sys.argv[1], sys.argv[2]
MAX = float(sys.argv[3]) if len(sys.argv) > 3 else 40.0
MIN = float(sys.argv[4]) if len(sys.argv) > 4 else 24.0
SR = 48000


def decode(path, sr, ch):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", str(ch), "-ar", str(sr), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch)


st = decode(src, SR, 2)
mono = st.mean(1)
dur = len(mono) / SR

# onset envelope (spectral flux) at hop 512 on a 22.05k copy
a = mono[::2].astype(np.float64); sr2 = SR // 2; hop = 512; n = 2048
frames = 1 + (len(a) - n) // hop
win = np.hanning(n)
spec = np.abs(np.fft.rfft(np.stack([a[i * hop:i * hop + n] * win for i in range(frames)]), axis=1))
logs = np.log1p(spec * 10)
flux = np.maximum(0, np.diff(logs, axis=0)).sum(1)
flux = (flux - flux.mean()) / (flux.std() + 1e-9)
fps = sr2 / hop

# tempo by autocorrelation (70-180 bpm)
ac = np.correlate(flux, flux, "full")[len(flux) - 1:]
lags = np.arange(len(ac)) / fps
ok = (lags > 60 / 180) & (lags < 60 / 70)
period = lags[ok][np.argmax(ac[ok])]
bpm = 60 / period
bar = 4 * period
nbars = int(MAX // bar)
L = nbars * bar
# features for similarity: band energies (24 bands) per frame
bands = np.array_split(np.arange(logs.shape[1]), 24)
feat = np.stack([logs[:, b].mean(1) for b in bands], 1)
feat = (feat - feat.mean(0)) / (feat.std(0) + 1e-9)

# chroma-ish: 12 pitch classes from the spectrum + 16 band energies, per frame, smoothed over 0.25 s
freqs = np.fft.rfftfreq(n, 1 / sr2)
pc = np.full(len(freqs), -1)
okf = (freqs > 60) & (freqs < 4000)
pc[okf] = (np.round(12 * np.log2(freqs[okf] / 440)) % 12).astype(int)
chroma = np.stack([spec[:, pc == c].sum(1) for c in range(12)], 1)
chroma = chroma / (chroma.sum(1, keepdims=True) + 1e-9)
F = np.concatenate([chroma * 3, feat[:, ::2] * 0.3], 1)
k5 = int(0.25 * fps)
F = np.stack([np.convolve(F[:, c], np.ones(k5) / k5, "same") for c in range(F.shape[1])], 1)
F = (F - F.mean(0)) / (F.std(0) + 1e-9)
F /= np.linalg.norm(F, axis=1, keepdims=True) + 1e-9
w = int(3.0 * fps)
best = None
for Lf in range(int(MIN * fps), int(MAX * fps)):
    for i in range(w + int(1 * fps), len(F) - Lf - w - int(2 * fps), 4):
        s = float((F[i - w:i + w] * F[i + Lf - w:i + Lf + w]).sum(1).mean())
        if best is None or s > best[0]:
            best = (s, i / fps, Lf / fps)
score, start, L = best
end = start + L
nbars = round(L / bar, 2)
# fine alignment: shift the end +-25 ms to best match the waveform at the start
i0 = int(start * SR); j0 = int(end * SR); m = int(0.03 * SR); r = int(0.025 * SR)
ref = mono[i0 - m:i0 + m]
cands = [(np.dot(ref, mono[j0 + k - m:j0 + k + m]) / (np.linalg.norm(mono[j0 + k - m:j0 + k + m]) + 1e-9), k) for k in range(-r, r)]
k = max(cands)[1]
j0 += k
seg = st[i0:j0].copy()
# 10 ms seam blend: the loop's last 10 ms crossfade into what comes right before its start
x = int(0.01 * SR)
fade = np.linspace(0, 1, x)[:, None]
seg[-x:] = seg[-x:] * (1 - fade) + st[i0 - x:i0] * fade

import wave
pcm = (np.clip(seg, -1, 1) * 32767).astype("<i2")
with wave.open(out, "wb") as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())

# check: three copies back to back, RMS per 20 ms around each seam must not dip
loop3 = np.concatenate([seg.mean(1)] * 3)
def rms(z): return 20 * np.log10(np.sqrt(np.mean(z ** 2)) + 1e-9)
seams = []
for s_ in (len(seg), 2 * len(seg)):
    win20 = int(0.02 * SR)
    seams.append(min(rms(loop3[s_ + q:s_ + q + win20]) for q in range(-5 * win20, 5 * win20, win20)))
body = rms(loop3)
print(f"{src.split('/')[-1]}: {bpm:.1f} bpm, {nbars} bars, loop {start:.2f}-{start + len(seg) / SR:.2f} s "
      f"({len(seg) / SR:.2f} s), match {score:.2f}, overall {body:.1f} dB, quietest 20 ms at seams {min(seams):.1f} dB")
