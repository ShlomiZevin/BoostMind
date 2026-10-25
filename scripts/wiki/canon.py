"""Read the editor's canon (zoomcut/characters + zoomcut/episodes) for the the characters wiki site.

Shared by build.py (writes the site data and the chat agent's brain) and copy_brief.py
(asks SOL for the fan-facing copy). The editor is the only source: a new character or a
finished export there shows up here on the next build.
"""
import json, os, re, glob

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ZC = os.path.join(ROOT, 'zoomcut')
HERE = os.path.dirname(os.path.abspath(__file__))


def load_json(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding='utf8') as f:
        return json.load(f)


def characters():
    index = load_json(os.path.join(ZC, 'characters', 'index.json'))
    out = []
    for cid in index['order']:
        c = load_json(os.path.join(ZC, 'characters', cid, 'character.json'))
        if c:
            prof = os.path.join(ZC, 'characters', cid, 'profile.md')
            c['_profile'] = open(prof, encoding='utf8').read() if os.path.exists(prof) else ''
            out.append(c)
    return out, index.get('worlds', {})


def export_path(eid):
    p = os.path.join(ZC, 'episodes', eid, 'out', f'{eid}.mp4')
    return p if os.path.exists(p) else None


def transcript(eid):
    """The spoken words of an episode: captions.txt without the '== take' headers, else the script."""
    for name in ('captions.txt', 'script.txt'):
        p = os.path.join(ZC, 'episodes', eid, name)
        if os.path.exists(p):
            lines = [l.rstrip() for l in open(p, encoding='utf8') if not l.startswith('==') and not l.startswith('#')]
            return re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip()
    return ''


def episodes(chars):
    """Finished episodes that have an export: id, editor title, cast (characters who list it)."""
    cast = {}
    for c in chars:
        for v in c.get('videos') or []:
            cast.setdefault(v, []).append(c['id'])
    out = []
    for ep in sorted(glob.glob(os.path.join(ZC, 'episodes', '*', 'episode.json'))):
        eid = os.path.basename(os.path.dirname(ep))
        if eid.startswith('_') or eid.endswith('-test'):
            continue
        meta = load_json(ep, {})
        src = export_path(eid)
        if not meta.get('done') or not src:
            continue
        # the cast: the characters who list the video + the project's own list (the editor's Characters page reads both)
        proj = (load_json(os.path.join(os.path.dirname(ep), 'project.json'), {}) or {}).get('characters') or []
        known = {c['id'] for c in chars}
        out.append({
            'id': eid,
            'editor_title': meta.get('title') or eid,
            'series': meta.get('series'),
            'cast': list(dict.fromkeys(cast.get(eid, []) + [c for c in proj if c in known])),
            'mtime': os.path.getmtime(src),
            'transcript': transcript(eid),
        })
    out.sort(key=lambda e: -e['mtime'])
    return out
