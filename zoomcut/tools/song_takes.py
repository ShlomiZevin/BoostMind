"""Sung takes -> a song project's layers: each WHOLE take on its own audio layer, placed where it lines up with the song.
  python tools/song_takes.py <project> <ref vocal> <ref at> <take> [take ...] [--dry]
- ref vocal: what the takes sang along to - the original singer's vocal (Demucs stem, cut to the part) or a take that's
  already placed; ref at: where that ref starts on the clip (s). Takes recorded in the Karaoke tool are already
  song-aligned (Downloads/karaoke/<song>/<track>.wav: sample 0 = the song's start) - ref = the song's vocal from 0.
- each take: its offset (onset envelope, 5 ms), girl / boy (pitch), its words (Whisper) - printed, then one layer per
  take: the whole take, never cut into lines (he: "each track is exactly on the pitch, no need to cut").
- the sound is the layer's LIVE chain, his voice untouched (natural, low cut, light comp / de-ess, room, echo); the
  first girl and the first boy lead, the rest sit lower - he balances by ear (boys ~2x the girls' level, 2026-10-29).
The studio must be running. skill/make-songs/SKILL.md."""
import json, os, subprocess, sys, urllib.request
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
API = 'http://localhost:4747'
SR = 48000

def load(p, sr=SR):
    return np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', str(sr), '-f', 'f64le', '-'],
                                        capture_output=True).stdout, np.float64).copy()

def flux(x, hop=240):  # rises in loudness per 5 ms - the rhythm of the singing, whatever the words
    e = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2) + 1e-12) for i in range(0, len(x) - hop, hop)])
    return np.maximum(0, np.diff(np.log(e + 1e-4), prepend=np.log(e[0] + 1e-4)))

def offset(ref, take):
    """Where the ref's start falls in the take (s): sung-frame overlap first (10 ms), then the onsets (5 ms)."""
    env = lambda x: np.array([np.sqrt(np.mean(x[i:i + 480] ** 2)) for i in range(0, len(x) - 480, 480)])
    er, et = env(ref), env(take)
    br, bt = (er > 0.1 * er.max()).astype(float), (et > 0.1 * np.percentile(et, 99)).astype(float)
    best, bv = 0, -1
    for d in range(-len(br) // 2, len(bt)):
        lo, hi = max(0, d), min(len(bt), d + len(br))
        if hi - lo < 200: continue
        v = np.dot(bt[lo:hi], br[lo - d:hi - d])
        if v > bv: bv, best = v, d
    fr, ft = flux(ref), flux(take)
    c0, best2, bv2 = best * 2, best * 2, -1
    for d in range(c0 - 40, c0 + 41):
        a = max(0, d); seg = ft[a:a + len(fr)]; r = fr[a - d:a - d + len(seg)]
        if len(seg) < len(fr) * 0.5: continue
        v = float(np.dot(r, seg))
        if v > bv2: bv2, best2 = v, d
    return best2 / 200

def api(path, body=None, raw=None):
    req = urllib.request.Request(API + path, data=raw if raw is not None else (json.dumps(body).encode() if body is not None else None),
                                 headers={'content-type': 'application/json'} if body is not None else {})
    return json.load(urllib.request.urlopen(req))

def main():
    args = [a for a in sys.argv[1:] if a != '--dry']
    if len(args) < 4: print(__doc__); sys.exit(1)
    ep, refp, at, takes = args[0], args[1], float(args[2]), args[3:]
    import pyworld as pw
    from pipeline.transcribe import _get_model
    model = _get_model()
    ref = load(refp)
    found = []
    for f in takes:
        x = load(f)
        f0, _ = pw.harvest(load(f, 16000), 16000, f0_floor=70, f0_ceil=900, frame_period=10)
        hz = float(np.median(f0[f0 > 0])) if (f0 > 0).any() else 0
        segs, _ = model.transcribe(load(f, 16000).astype(np.float32), language='he', beam_size=5, vad_filter=False)
        off = offset(ref, x)
        found.append({'file': f, 'at': off, 'girl': hz > 320, 'hz': round(hz), 'len': len(x) / SR, 'words': ' '.join(s.text.strip() for s in segs)})
        print(f"{os.path.basename(f)}: {'girl' if hz > 320 else 'boy'} {round(hz)} Hz, the ref starts {off:.3f} s into it | {found[-1]['words'][:90]}")
    if '--dry' in sys.argv: return
    v = api(f'/api/p/{ep}'); p = v.get('project', v); D = p['duration']
    ops, girls, boys = [], 0, 0
    for k, t in enumerate(found):
        name = 'take-' + os.path.basename(t['file']).replace(' ', '_')
        aid = api(f'/api/p/{ep}/assets?name={urllib.parse.quote(name)}', raw=open(t['file'], 'rb').read())['id']
        n = girls if t['girl'] else boys
        if t['girl']: girls += 1
        else: boys += 1
        vol = (0.56 if n == 0 else 0.24) if t['girl'] else (0.75 if n == 0 else 0.42)
        inn = t['at'] - at                                 # the take's second at clip time 0
        frm = max(0.0, -inn); inn = max(0.0, inn)
        ops.append({'op': 'layer.add', 'layer': {'id': f'take{len(p["layers"]) + k + 1}', 'kind': 'audio', 'group': 'שירה',
            'name': f"{'בנות' if t['girl'] else 'בנים'} – {'סולו' if n == 0 else f'טייק {n + 1}'}",
            'props': {'volume': vol, 'level': 'speech', 'clean': 'mild', 'fx': {'echo': 0.6},
                      'voice': {'preset': 'natural', 'lowcut': 90 if t['girl'] else 70, 'comp': 0.4, 'deess': 0.3, 'room': 0.38, 'roomSize': 2.2}},
            'items': [{'id': 'take', 'asset': aid, 'in': round(inn, 3), 'from': round(frm * 30, 1),
                       'dur': round(min(D - frm * 30, (t['len'] - inn) * 30), 1), 'gain': 1, 'fade_in': 0.02, 'fade_out': 0.3}]}})
    v = api(f'/api/p/{ep}'); p = v.get('project', v)
    print(api(f'/api/p/{ep}/ops', {'rev': p['rev'], 'ops': ops}).get('ok'), f'- {len(ops)} take layers added')

if __name__ == '__main__':
    import urllib.parse
    main()
