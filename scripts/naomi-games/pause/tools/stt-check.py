# speech-to-text check of the voice lines (ivrit he-turbo): the words right, no tag read aloud
import glob, os, subprocess, sys
import numpy as np
from faster_whisper import WhisperModel
m = WhisperModel('models/he-turbo', device='cpu', compute_type='int8')
pat = sys.argv[1] if len(sys.argv) > 1 else '*'
for f in sorted(glob.glob(f'../public/naomi-games/pause/assets/vo/{pat}.mp3')):
    a = np.frombuffer(subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f, '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'], capture_output=True).stdout, np.float32)
    segs, _ = m.transcribe(a, language='he', beam_size=1)
    print(os.path.basename(f), round(len(a) / 16000, 1), '|', ''.join(s.text for s in segs).strip())
