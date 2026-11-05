# The Shlomiverse's brand bookends on any layered project (his ask, 2026-11-05 - every teaser / preview):
#   "שלומיוורס מציגים" before it (episodes/_assets/shlomiverse/verse-presents.mp4, 4 s: the logo turns slowly in space)
#   "רק בשלומיוורס"   after it  (episodes/_assets/shlomiverse/verse-only.mp4, 4 s: the logo whips in, the line slams)
# Each is a clip with its own Shlomiverse sound (the trailer's music / landing, whoosh, shimmer). The tool uploads them,
# moves every item of the project later by the intro's length, adds a "Shlomiverse" picture layer (both clips, on top)
# and their sound layer, and makes the project that much longer - all through the studio's ops, one undoable write.
#   python tools/verse_bookends.py <project> [--no-intro] [--no-outro] [--muted]
#   --muted: the clips' sound layer muted (a version where he lays his own music over everything, e.g. Instagram)
# Run once per project (it refuses a project that already has them). The clips are remade with
# episodes/_assets/shlomiverse/source/render.py (python render.py in that folder; it reads its sound from presents.wav /
# only.wav there).
import json, os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'http://localhost:4747/api/p/'
CLIPS = {'intro': os.path.join(ROOT, 'episodes', '_assets', 'shlomiverse', 'verse-presents.mp4'),
         'outro': os.path.join(ROOT, 'episodes', '_assets', 'shlomiverse', 'verse-only.mp4')}

def call(path, body=None, raw=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    ct = 'application/octet-stream' if raw is not None else 'application/json'
    req = urllib.request.Request(BASE + path, data=data, headers={'content-type': ct}, method='POST' if data is not None else 'GET')
    try: return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e: sys.exit(f'{path}: {e.code} {e.read()[:300]}')

def main():
    pid = sys.argv[1]
    want = {'intro': '--no-intro' not in sys.argv, 'outro': '--no-outro' not in sys.argv}
    p = call(pid)['project']
    if any(l['id'] == 'verse.picture' for l in p['layers']): sys.exit('this project has the Shlomiverse bookends already')
    fps = p['canvas']['fps']
    ids = {k: call(f'{pid}/assets?name={os.path.basename(f)}', raw=open(f, 'rb').read())['id'] for k, f in CLIPS.items() if want[k]}
    p = call(pid)['project']
    dur = {k: int(round(p['assets'][a]['duration'] * fps)) for k, a in ids.items()}
    shift = dur.get('intro', 0)
    ops = []
    if shift:
        for l in p['layers']:
            for it in l.get('items', []):
                ops.append({'op': 'item.update', 'layer': l['id'], 'id': it['id'], 'set': {'from': it['from'] + shift}})
    end = p['duration'] + shift
    W, H = p['canvas']['w'], p['canvas']['h']
    pic, snd = [], []
    if 'intro' in ids:
        pic.append({'id': 'intro', 'asset': ids['intro'], 'in': 0, 'from': 0, 'dur': dur['intro'], 'box': {'x': 0, 'y': 0, 'w': W, 'h': H}})
        snd.append({'id': 'intro', 'asset': ids['intro'], 'in': 0, 'from': 0, 'dur': dur['intro']})
    if 'outro' in ids:
        pic.append({'id': 'outro', 'asset': ids['outro'], 'in': 0, 'from': end, 'dur': dur['outro'], 'box': {'x': 0, 'y': 0, 'w': W, 'h': H}, 'pin': 'end'})
        snd.append({'id': 'outro', 'asset': ids['outro'], 'in': 0, 'from': end, 'dur': dur['outro'], 'pin': 'end'})
        end += dur['outro']
    ops.append({'op': 'project', 'set': {'duration': end}})
    ops.append({'op': 'layer.add', 'layer': {'id': 'verse.picture', 'kind': 'video', 'name': 'Shlomiverse presents / only in the Shlomiverse',
                'group': 'Shlomiverse', 'props': {'fit': 'cover'}, 'items': pic}, 'index': len(p['layers'])})
    ops.append({'op': 'layer.add', 'layer': {'id': 'verse.sound', 'kind': 'audio', 'name': 'Shlomiverse sound', 'group': 'Shlomiverse',
                'muted': '--muted' in sys.argv, 'props': {'volume': 1}, 'items': snd}})
    r = call(f'{pid}/ops', {'rev': p['rev'], 'ops': ops})
    print(f"{pid}: {'intro ' if 'intro' in ids else ''}{'outro ' if 'outro' in ids else ''}added, everything moved {shift / fps:.1f} s later, "
          f"now {end / fps:.1f} s (rev {r['rev']})")

if __name__ == '__main__':
    main()
