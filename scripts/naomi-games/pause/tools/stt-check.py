# speech-to-text check of the voice lines (ivrit he-turbo): the words must match the written line, nothing repeated, no tag read.
#   python stt-check.py [glob]          -> prints each clip + OK/BAD; last line "BAD: id,id,..." (for voice.mjs --ids)
import glob, os, re, subprocess, sys, json, difflib
import numpy as np
from faster_whisper import WhisperModel
ROOT = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..')
m = WhisperModel(os.path.join(ROOT, 'zoomcut/models/he-turbo'), device='cpu', compute_type='int8')
game = open(os.path.join(ROOT, 'public/naomi-games/pause/game.js'), encoding='utf-8').read()
say_src = game[game.index('const SAY = {') + 12: game.index('};', game.index('const SAY = {')) + 1]
SAY = json.loads(subprocess.run(['node', '-e', f'process.stdout.write(JSON.stringify({say_src}))'], capture_output=True, text=True, encoding='utf-8').stdout)
def norm(t):
    t = re.sub('[֑-ׇ]', '', t)
    t = re.sub(r'[^א-ת]', '', t)
    return t.replace('כול', 'כל').replace('ו', '')
pat = sys.argv[1] if len(sys.argv) > 1 else '*'
bad = []
for f in sorted(glob.glob(os.path.join(ROOT, f'public/naomi-games/pause/assets/vo/{pat}.mp3'))):
    cid = os.path.basename(f)[:-4]; k, i = cid.rsplit('-', 1); want = SAY[k][int(i)]
    a = np.frombuffer(subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f, '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'], capture_output=True).stdout, np.float32)
    segs, _ = m.transcribe(a, language='he', beam_size=1)
    got = ''.join(s.text for s in segs).strip()
    r = difflib.SequenceMatcher(None, norm(want), norm(got)).ratio()
    ok = r >= 0.86 and len(norm(got)) <= len(norm(want)) * 1.15 and not re.search('[A-Za-z]{4,}', got.replace('skin', ''))
    if not ok: bad.append(cid)
    print(cid, round(len(a) / 16000, 1), 'OK ' if ok else 'BAD', round(r, 2), '|', got)
print('BAD:', ','.join(bad))
