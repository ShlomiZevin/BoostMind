"""Build the characters wiki (/wiki/) from the editor's canon.

  python scripts/wiki/build.py            # site data + portraits + the chat agent's brain
  sh scripts/wiki/encode.sh <episode-id>  # web copy + poster of a new export (build.py lists the missing ones)

Sources, in order of authority:
  zoomcut/characters/<id>/character.json  the bible of every character (the editor's; a new character is added there)
  zoomcut/episodes/<id>                   finished exports + transcripts
  scripts/wiki/copy.json                  fan-facing copy: tagline, bio, questions, video titles (hand-editable)
  scripts/wiki/portraits/<id>.jpg         a portrait made for the wiki (overrides the editor's)
  scripts/wiki/clips.json                 videos that live only on TikTok / Instagram: [{"url", "title", "cast": [ids]}]
  scripts/wiki/reels.json                 his old Instagram reels, imported with subtitles (scripts/insta): their own
                                          date, "archive" - the 'latest' rows (wiki home, links page) skip them
Writes:
  public/wiki/data/wiki.json        what the site shows
  public/wiki/img/c/<id>.jpg        character portraits, 480x600
  techietech-api/wiki-brain.json    everything the chat agent knows (full bibles + transcripts + a card per video) -
                                    never served (the private bucket)
  scripts/wiki/cards.json           the video cards: 1-2 lines on what happens + its topics, written by AI once per video
                                    (redone only when its words change) - the chat's map of every video
After a build: node scripts/wiki/push.cjs (live in seconds, no deploy).
"""
import hashlib, json, os, urllib.request
from itertools import zip_longest
from PIL import Image
import time
from canon import characters, episodes, reels, load_json, ROOT, HERE, ZC

PUB = os.path.join(ROOT, 'public', 'wiki')
COPY = load_json(os.path.join(HERE, 'copy.json'), {})
CLIPS = load_json(os.path.join(HERE, 'clips.json'), [])

# a URL id for each series (the editor's world name is the key)
SERIES = {
    'טקי-טק': 'techytech', 'תדר - הפודקאסט הרוחני': 'tadar', 'קהילת שערי בג״ץ': 'bagatz', 'HINDSIGHT VIP': 'hindsight',
    'המכון': 'gym', 'Homo Useless': 'homo-useless', 'מבזק חדשות': 'news', 'גן זי': 'genz',
    'דורית מרקורי – אסטרולוגיה ונומרולוגיה': 'dorit', 'המורה רוזנבלום': 'rosenblum', 'הסטטוסים של האחיין': 'nephew', 'ליאור סליים': 'lior-slime', 'עודד קטש': 'oded', 'השכן המציק': 'neighbor', 'המשפחה של אברם': 'avram', 'אסף': 'asaf', 'מרדכי דוד': 'mordechai-david', 'הבחור מהלילה': 'night-guy', 'גדי איזנקוט': 'eisenkot', 'רינה המזכירה': 'rina', 'פרופסור חצרוני': 'hatzroni', 'שוקי המתווך': 'shuki', 'משה פייגלין': 'feiglin', 'אבי שושן': 'avi-shushan', 'ד״ר סאמר': 'dr-samer', 'המוכרת מחנות התכשיטים': 'jeweler', 'מרים המזכירה': 'miriam', 'עמי ואורן': 'ami', 'יניב מ-KSP': 'ksp-seller', 'נפתלי בנט': 'bennett', 'יותם זמרי': 'yotam-zamri', 'נאור ציון': 'naor-zion', 'מתן ניסטור': 'matan', 'אלון גונן': 'alon', 'דני בולר': 'danny-buller', 'אלכס דניאל': 'alex-daniel', 'דור אקשטיין': 'dor-eckstein', 'עומר קולי': 'omer-koli',
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
                       'date': time.strftime('%Y-%m-%d', time.localtime(e['mtime'])),
                       '_t': time.strftime('%Y-%m-%dT%H:%M:%S', time.localtime(e['mtime'])), '_transcript': e['transcript']})
    for r in reels():
        if not os.path.exists(os.path.join(PUB, 'v', r['id'] + '.mp4')):
            missing.append(f"reel video: public/wiki/v/{r['id']}.mp4")
            continue
        c = COPY.get('videos', {}).get(r['id']) or {}
        if not c:
            missing.append(f"copy: video {r['id']}")
        # its world from the cast, or a reel's own "world" (a Techy-Tech sketch with no one specific in it)
        world = next((world_of[i] for i in r['cast'] if world_of.get(i)), None) or r.get('world')
        videos.append({'id': r['id'], 'title': c.get('title') or r.get('title', r['id']), 'teaser': c.get('teaser', ''),
                       'series': series_id(world), 'cast': r['cast'], 'src': f"v/{r['id']}.mp4", 'poster': f"v/{r['id']}.jpg",
                       'date': r['date'][:10], '_t': r['date'], 'archive': True, 'ig': r.get('permalink'), '_transcript': r.get('transcript', '')})
    for i, clip in enumerate(CLIPS):
        world = next((world_of[c] for c in clip.get('cast', []) if world_of.get(c)), None)
        videos.append({'id': clip.get('id') or f'clip-{i + 1}', 'title': clip['title'], 'teaser': clip.get('teaser', ''),
                       'series': series_id(world), 'cast': clip.get('cast', []), 'url': clip['url'],
                       'poster': clip.get('poster'), 'date': clip.get('date', ''), '_transcript': clip.get('transcript', '')})
    videos.sort(key=lambda v: v.get('_t') or v.get('date') or '', reverse=True)  # newest first, every source by its own date
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
        here = lambda p: p if os.path.isabs(p) else os.path.join(ZC, 'characters', cid, p)  # relative = the character's folder
        src = own if os.path.exists(own) else next((here(p) for p in [ch.get('portrait'), *(ch.get('assets') or {}).get('portraits', [])] if p and os.path.exists(here(p))), None)
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

    card = cards(videos)
    raw = {c['id']: c for c in chars}
    brain = {
        'worlds': [{'id': s['id'], 'title': s['title'], 'blurb': s['blurb'], 'site': s['site'],
                    'brief': next((w.get('brief', '') for k, w in worlds.items() if series_id(k) == s['id']), '')} for s in out_series],
        'characters': [{**{k: raw[c['id']][k] for k in BRAIN_KEYS if k in raw[c['id']]}, 'site': c['site'],
                        'videos': c['videos'], 'tagline': c['tagline'], 'bio': c['bio']} for c in out_chars],
        'videos': [{'id': v['id'], 'title': v['title'], 'teaser': v['teaser'], 'cast': v['cast'], 'date': v.get('date', ''),
                    'card': card.get(v['id']) or v['teaser'], 'transcript': v['_transcript']} for v in videos],
    }
    with open(os.path.join(ROOT, 'techietech-api', 'wiki-brain.json'), 'w', encoding='utf8') as f:
        json.dump(brain, f, ensure_ascii=False, separators=(',', ':'))

    print(f'wiki.json: {len(out_series)} series, {len(out_chars)} characters ({sum(1 for c in out_chars if c["img"])} with portraits), {len(videos)} videos')
    print('brain:', os.path.getsize(os.path.join(ROOT, 'techietech-api', 'wiki-brain.json')) // 1024, 'KB')
    for m in missing:
        print('MISSING', m)


def cards(videos):
    """The chat's map of every video: 1-2 Hebrew lines on what happens + its topics, so the chat can find a video by
    meaning without reading every transcript. Written by AI once per video (Luna - an internal note nobody reads),
    kept in cards.json with the hash of its words; only new / changed videos are sent, in one call."""
    path = os.path.join(HERE, 'cards.json')
    have = load_json(path, {}) or {}
    h = lambda v: hashlib.md5(('cards-v2' + v['title'] + v['_transcript']).encode('utf8')).hexdigest()[:10]  # v2: every topic, even in passing
    todo = [v for v in videos if v.get('_transcript') and have.get(v['id'], {}).get('h') != h(v)]
    if todo:
        try:
            env = dict(l.rstrip('\n').split('=', 1) for l in open(os.path.join(ZC, '.env'), encoding='utf8') if '=' in l and not l.startswith('#'))
            items = [{'id': v['id'], 'title': v['title'], 'cast': v['cast'], 'words': v['_transcript'][:4000]} for v in todo]
            prompt = ('Short Hebrew comedy videos (one actor, recurring characters). For each, write a "card" in Hebrew: '
                      'one sentence on what happens, then "נושאים:" and a comma list of EVERY topic, place, object, event, '
                      'person and idea mentioned - even in passing (a wedding someone went to, coffee, a dog) - up to 18 '
                      'items, so a question like "is there a video about an elevator / a wedding / AI agents?" finds it. '
                      'Plain facts, no jokes explained.\n' + json.dumps(items, ensure_ascii=False) +
                      '\nAnswer JSON only: {"<id>": "<card>", ...}')
            body = json.dumps({'model': 'gpt-5.6-luna', 'input': prompt, 'reasoning': {'effort': 'low'},
                               'text': {'format': {'type': 'json_object'}}}).encode()
            req = urllib.request.Request('https://api.openai.com/v1/responses', data=body, headers={
                'Authorization': 'Bearer ' + env['OPENAI_API_KEY'].strip().strip('"\''), 'Content-Type': 'application/json'})
            r = json.loads(urllib.request.urlopen(req, timeout=300).read())
            out = json.loads(next(c['text'] for o in r['output'] if o['type'] == 'message' for c in o['content'] if c['type'] == 'output_text'))
            for v in todo:
                if out.get(v['id']):
                    have[v['id']] = {'h': h(v), 'card': out[v['id']].strip()}
            u = r.get('usage', {})
            print(f"cards: {len(todo)} written by AI, ${(u.get('input_tokens', 0) * 0.2 + u.get('output_tokens', 0) * 1.2) / 1e6:.4f}")
            with open(path, 'w', encoding='utf8') as f:
                json.dump(have, f, ensure_ascii=False, indent=1)
        except Exception as e:  # no key / no network: the teaser stands in, the next build tries again
            print('cards: not written now -', str(e)[:200])
    return {k: v['card'] for k, v in have.items()}


if __name__ == '__main__':
    main()
