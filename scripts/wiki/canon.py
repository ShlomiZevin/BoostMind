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


VERSE = 'https://europe-west1-boostmind-b052c.cloudfunctions.net/versePublish'


def verse_key():
    env = os.path.join(ZC, '.env')
    if os.path.exists(env):
        m = re.search(r'^VERSE_PUBLISH_KEY=(.+)$', open(env, encoding='utf8').read(), re.M)
        if m:
            return m.group(1).strip().strip('"' + "'")
    import subprocess
    return subprocess.check_output('gcloud secrets versions access latest --secret=VERSE_PUBLISH_KEY --project=boostmind-b052c', shell=True).decode().strip()


def verse(body):
    """versePublish (techietech-api/publish.js) - the one door to the Shlomiverse's records."""
    import urllib.request
    req = urllib.request.Request(VERSE, data=json.dumps(body).encode(), method='POST',
                                 headers={'authorization': 'Key ' + verse_key(), 'content-type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        out = json.loads(r.read().decode('utf8'))
    if out.get('error'):
        raise RuntimeError(f"versePublish {body.get('op')}: {out}")
    return out


def characters():
    """Every character and world from the database - the only copy since 2026-11-06 (no character.json / index.json in
    git, his ask: no duplication). A character in the old file shape: site = {url, notes}; worlds keyed by the studio's
    world name: {name, site, brief, title, blurb, id}. Hidden ones are left out."""
    chars = [c for c in verse({'op': 'list', 'kind': 'character', 'full': True})['items'] if not c.get('hidden')]
    series = [s for s in verse({'op': 'list', 'kind': 'series', 'full': True})['items'] if not s.get('hidden')]
    order = lambda x: (x.get('order') if x.get('order') is not None else 1e9, x['id'])
    for c in chars:
        url, notes = c.pop('site', None), c.pop('site_notes', None)
        if url or notes:
            c['site'] = {k: v for k, v in (('url', url), ('notes', notes)) if v}
    worlds = {s.get('world') or s['id']: {'id': s['id'], 'name': s.get('name') or s.get('title') or s['id'], 'site': s.get('site'),
                                          'brief': s.get('brief', ''), 'title': s.get('title', ''), 'blurb': s.get('blurb', '')}
              for s in sorted(series, key=order)}
    return sorted(chars, key=order), worlds


def reels():
    """His old Instagram reels brought into the wiki (scripts/insta, scripts/wiki/reels.json): history, not news -
    each keeps its Instagram date and is marked archive (never in the 'latest' rows)."""
    return load_json(os.path.join(HERE, 'reels.json'), [])


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
        # the studio's export - or, when it isn't on this computer (projects live in the online studio since 2026-11-05;
        # haredit-2's export wasn't here and the build dropped the video from the live wiki), the site's own web copy
        src = export_path(eid)
        web = os.path.join(ZC, '..', 'public', 'wiki', 'v', eid + '.mp4')
        if not src and os.path.exists(web):
            src = web
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
