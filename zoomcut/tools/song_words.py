"""The song's words on screen, timed to the singing: Whisper's word times on a sung track -> one `lyric` item per line.
  python tools/song_words.py <project> <sung audio> <audio at> <lyrics.txt> [--layer words] [--dry]
- sung audio: the clearest vocal (the lead take, or the original vocal stem when the words are the same);
  audio at: the clip time of the audio's second 0 (a take whose item has in=2.3 at from=0 -> -2.3).
- lyrics.txt: one line per screen line; " / " = a row break inside it; *word* or *a run* = the accent (big, pink).
- his words are matched to what Whisper heard, in order (a word it missed gets the time between its neighbours).
- writes / replaces the items of a text layer with style `lyric` (layers.md), lines back to back; each line's box
  alternates right / centre / left and its tilt flips - move them in the editor. skill/make-songs/SKILL.md."""
import difflib, json, os, re, subprocess, sys, urllib.request
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
API = 'http://localhost:4747'
norm = lambda w: re.sub(r'[^א-תa-z0-9]', '', w.lower())

def api(path, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'content-type': 'application/json'} if body is not None else {})
    return json.load(urllib.request.urlopen(req))

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) < 4: print(__doc__); sys.exit(1)
    ep, audio, at, lyr = args[0], args[1], float(args[2]), args[3]
    layer = sys.argv[sys.argv.index('--layer') + 1] if '--layer' in sys.argv else 'words'
    from pipeline.transcribe import _get_model
    a = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', audio, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'],
                                     capture_output=True).stdout, np.float32)
    segs, _ = _get_model().transcribe(a, language='he', beam_size=5, word_timestamps=True, vad_filter=False)
    heard = [(w.word.strip(), w.start + at, w.end + at) for s in segs for w in s.words]
    lines = [l.strip() for l in open(lyr, encoding='utf-8').read().splitlines() if l.strip()]
    toks = [w for l in lines for w in l.replace(' / ', ' ').split()]
    sm = difflib.SequenceMatcher(None, [norm(w) for w in toks], [norm(h[0]) for h in heard], autojunk=False)
    times = [None] * len(toks)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag in ('equal', 'replace') and i2 - i1 == j2 - j1:
            for k in range(i2 - i1): times[i1 + k] = [heard[j1 + k][1], heard[j1 + k][2]]
    known = [i for i, t in enumerate(times) if t]
    for i, t in enumerate(times):  # a word Whisper didn't hear: between its neighbours
        if t is None:
            lo = max([k for k in known if k < i], default=None); hi = min([k for k in known if k > i], default=None)
            s = times[lo][1] if lo is not None else (times[hi][0] - 0.4 if hi is not None else 0)
            e = times[hi][0] if hi is not None else s + 0.4
            times[i] = [s, s + max(0.12, (e - s) / 2)]
    print(f'{len(known)} of {len(toks)} words heard')
    v = api(f'/api/p/{ep}'); p = v.get('project', v); FPS = p['canvas']['fps']
    items, k = [], 0
    spans = []
    for l in lines:
        n = len(l.replace(' / ', ' ').split()); spans.append(times[k:k + n]); k += n
    for i, (l, ws) in enumerate(zip(lines, spans)):
        start = ws[0][0] - 0.8 if i == 0 else max(ws[0][0] - 0.8, spans[i - 1][-1][1] + 0.12)
        nxt = (max(spans[i + 1][0][0] - 0.8, ws[-1][1] + 0.12)) if i + 1 < len(lines) else ws[-1][1] + 0.9
        fr, to = max(0, round(start * FPS)), round(nxt * FPS)
        f0 = fr / FPS
        items.append({'id': f'w{i + 1}', 'from': fr, 'dur': max(1, to - fr), 'text': l.replace(' / ', '\n'),
                      'words': [[round(a - f0, 3), round(b - f0, 3)] for a, b in ws],
                      'box': {'x': 540, 'y': 1340, 'w': 940, 'anchor': 'c'}, 'align': ['right', 'center', 'left'][i % 3], 'tilt': 3 if i % 2 else -3})
        print(f'{fr / FPS:6.2f}  {l}')
    if '--dry' in sys.argv: return
    ops = [{'op': 'layer.remove', 'id': layer}] if any(x['id'] == layer for x in p['layers']) else []
    ops.append({'op': 'layer.add', 'layer': {'id': layer, 'kind': 'text', 'name': 'מילים', 'items': items,
                'props': {'style': 'lyric', 'size': 100, 'accent': 1.35, 'stroke': 8, 'fill': '#ff3ea5'}}})
    print(api(f'/api/p/{ep}/ops', {'rev': p['rev'], 'ops': ops}).get('ok'), f'- {len(items)} lines on layer {layer}')

if __name__ == '__main__':
    main()
