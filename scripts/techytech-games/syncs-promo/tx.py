import sys, os, json, wave, numpy as np
from faster_whisper import WhisperModel
m = WhisperModel(r'C:/workspace/BoostMind/zoomcut/models/he-turbo', device='cpu', compute_type='int8', cpu_threads=max(4, os.cpu_count() - 2))
d = os.path.join(os.path.dirname(__file__), 'src')
out = open(os.path.join(os.path.dirname(__file__), 'transcripts.txt'), 'w', encoding='utf-8')
for f in sorted(os.listdir(d)):
    if not f.endswith('.wav'): continue
    w = wave.open(os.path.join(d, f)); a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    segs, _ = m.transcribe(a, language='he', vad_filter=True)
    out.write(f'=== {f}\n')
    for s in segs: out.write(f'[{s.start:6.1f}-{s.end:6.1f}] {s.text.strip()}\n')
    out.flush()
