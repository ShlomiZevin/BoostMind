"""Build the characters wiki (/wiki/) from the editor's canon.

  python scripts/wiki/build.py            # site data + portraits + the chat agent's brain
  sh scripts/wiki/encode.sh <episode-id>  # web copy + poster of a new export (build.py lists the missing ones)

Sources, in order of authority:
  zoomcut/characters/<id>/character.json  the bible of every character (the editor's; a new character is added there)
  zoomcut/episodes/<id>                   finished exports + transcripts
  scripts/wiki/copy.json                  fan-facing copy: tagline, bio, questions, video titles (hand-editable)
  scripts/wiki/portraits/<id>.jpg         a portrait made for the wiki (overrides the editor's)
  scripts/wiki/clips.json                 videos that live only on TikTok / Instagram: [{"url", "title", "cast": [ids]}]
Writes:
  public/wiki/data/wiki.json        what the site shows
  public/wiki/img/c/<id>.jpg        character portraits, 480x600
  techietech-api/wiki-brain.json    everything the chat agent knows (full bibles + transcripts) - never served
After a build: deploy hosting, and the function (firebase deploy --only functions:wikiChat from techietech-api/).
"""
import json, os
from itertools import zip_longest
from PIL import Image
from canon import characters, episodes, load_json, ROOT, HERE

PUB = os.path.join(ROOT, 'public', 'wiki')
COPY = load_json(os.path.join(HERE, 'copy.json'), {})
CLIPS = load_json(os.path.join(HERE, 'clips.json'), [])

# a URL id for each series (the editor's world name is the key)
SERIES = {
    'טקי-טק': 'techytech', 'תדר - הפודקאסט הרוחני': 'tadar', 'קהילת שערי בג״ץ': 'bagatz', 'HINDSIGHT VIP': 'hindsight',
    'המכון': 'gym', 'Homo Useless': 'homo-useless', 'מבזק חדשות': 'news', 'גן זי': 'genz',
    'דורית מרקורי – אסטרולוגיה ונומרולוגיה': 'dorit',
}
# a portrait made for the wiki (scripts/wiki/portraits/<id>.jpg, Leonardo from a frame) wins over the editor's list
PORTRAITS = os.path.join(HERE, 'portraits')
BRAIN_KEYS = ('id', 'name', 'name_en', 'aka', 'world', 'role', 'brief', 'personality', 'catchphrases', 'speech',
              'behavior', 'comedy', 'themes', 'dont', 'look', 'writing_rules', 'relations', 'videos')


def series_id(world):
    return SERIES.get(world) or (world or 'other').lower().replace(' ', '-')


def portrait(src, dst):
    """4:5 crop from the top (faces sit high in his frames), 480x600."""
    im = Image.open(src).convert('RGB')
    w, h = im.size
    if w / h > .8:
        cw = int(h * .8)
        im = im.crop(((w - cw) // 2, 0, (w - cw) // 2 + cw, h))
    else:
        im = im.crop((0, 0, w, int(w / .8)))
    im.resize((480, 600), Image.LANCZOS).save(dst, quality=84)


def interleave(chars):
    """One from each series in turn, so no single series fills the top of the page."""
    groups = {}
    for c in chars:
        groups.setdefault(c['series'], []).append(c)
    for g in groups.values():
        g.sort(key=lambda c: (not c['img'], -len(c['videos'])))
    order = sorted(groups.values(), key=lambda g: -sum(len(c['videos']) for c in g))
    mixed = [c for row in zip_longest(*order) for c in row if c]
    return [c for c in mixed if c['img']] + [c for c in mixed if not c['img']]


def main():
    chars, worlds = characters()
    eps = episodes(chars)
    os.makedirs(os.path.join(PUB, 'data'), exist_ok=True)
    os.makedirs(os.path.join(PUB, 'img', 'c'), exist_ok=True)
    missing = []
    world_of = {c['id']: c.get('world') for c in chars}

    videos = []
    for e in eps:
        if not os.path.exists(os.path.join(PUB, 'v', e['id'] + '.mp4')):
            missing.append(f"encode: sh scripts/wiki/encode.sh {e['id']}")
            continue
        c = COPY.get('videos', {}).get(e['id']) or {}
        if not c:
            missing.append(f"copy: video {e['id']}")
        world = next((world_of[i] for i in e['cast'] if world_of.get(i)), None)
        videos.append({'id': e['id'], 'title': c.get('title') or e['editor_title'], 'teaser': c.get('teaser', ''),
                       'series': series_id(world), 'cast': e['cast'], 'src': f"v/{e['id']}.mp4", 'poster': f"v/{e['id']}.jpg",
                       '_transcript': e['transcript']})
    for i, clip in enumerate(CLIPS):
        world = next((world_of[c] for c in clip.get('cast', []) if world_of.get(c)), None)
        videos.append({'id': clip.get('id') or f'clip-{i + 1}', 'title': clip['title'], 'teaser': clip.get('teaser', ''),
                       'series': series_id(world), 'cast': clip.get('cast', []), 'url': clip['url'],
                       'poster': clip.get('poster'), '_transcript': clip.get('transcript', '')})
    by_char = {}
    for v in videos:
        for cid in v['cast']:
            by_char.setdefault(cid, []).append(v['id'])

    out_chars = []
    for ch in chars:
        cid = ch['id']
        c = COPY.get('characters', {}).get(cid) or {}
        if not c:
            missing.append(f'copy: character {cid}')
        img = None
        dst = os.path.join(PUB, 'img', 'c', cid + '.jpg')
        own = os.path.join(PORTRAITS, cid + '.jpg')
        src = own if os.path.exists(own) else next((p for p in (ch.get('assets') or {}).get('portraits', []) if os.path.isabs(p) and os.path.exists(p)), None)
        if src and os.path.exists(src):
            if not os.path.exists(dst) or os.path.getmtime(src) > os.path.getmtime(dst):
                portrait(src, dst)
            img = f'img/c/{cid}.jpg'
        out_chars.append({
            'id': cid, 'name': ch['name'], 'aka': [a for a in ch.get('aka', []) if not a.isascii() or ' ' in a][:4],
            'series': series_id(ch.get('world')), 'role': ch.get('role', ''),
            'tagline': c.get('tagline', ''), 'bio': c.get('bio', ''), 'ask': c.get('ask', []),
            'quotes': (ch.get('catchphrases') or [])[:4],
            'color': ch.get('color') or '#ff7a45', 'img': img, 'site': (ch.get('site') or {}).get('url'),
            'videos': by_char.get(cid, []),
            'relations': [{'id': r['id']} for r in ch.get('relations') or [] if r.get('id')],
        })
    out_chars = interleave(out_chars)

    out_series = []
    for key, w in worlds.items():
        c = COPY.get('worlds', {}).get(key, {})
        sid = series_id(key)
        out_series.append({'id': sid, 'title': c.get('title') or w['name'], 'blurb': c.get('blurb', ''), 'site': w.get('site') or None,
                           'characters': [ch['id'] for ch in out_chars if ch['series'] == sid],
                           'videos': [v['id'] for v in videos if v['series'] == sid]})
    out_series.sort(key=lambda s: -len(s['videos']))

    site = {'series': out_series, 'characters': out_chars,
            'videos': [{k: v for k, v in x.items() if not k.startswith('_')} for x in videos]}
    with open(os.path.join(PUB, 'data', 'wiki.json'), 'w', encoding='utf8') as f:
        json.dump(site, f, ensure_ascii=False, separators=(',', ':'))

    raw = {c['id']: c for c in chars}
    brain = {
        'worlds': [{'id': s['id'], 'title': s['title'], 'blurb': s['blurb'], 'site': s['site'],
                    'brief': next((w.get('brief', '') for k, w in worlds.items() if series_id(k) == s['id']), '')} for s in out_series],
        'characters': [{**{k: raw[c['id']][k] for k in BRAIN_KEYS if k in raw[c['id']]}, 'site': c['site'],
                        'videos': c['videos'], 'tagline': c['tagline'], 'bio': c['bio']} for c in out_chars],
        'videos': [{'id': v['id'], 'title': v['title'], 'teaser': v['teaser'], 'cast': v['cast'], 'transcript': v['_transcript']} for v in videos],
    }
    with open(os.path.join(ROOT, 'techietech-api', 'wiki-brain.json'), 'w', encoding='utf8') as f:
        json.dump(brain, f, ensure_ascii=False, separators=(',', ':'))

    print(f'wiki.json: {len(out_series)} series, {len(out_chars)} characters ({sum(1 for c in out_chars if c["img"])} with portraits), {len(videos)} videos')
    print('brain:', os.path.getsize(os.path.join(ROOT, 'techietech-api', 'wiki-brain.json')) // 1024, 'KB')
    for m in missing:
        print('MISSING', m)


if __name__ == '__main__':
    main()
