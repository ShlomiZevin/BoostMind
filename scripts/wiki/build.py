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
    'דורית מרקורי – אסטרולוגיה ונומרולוגיה': 'dorit', 'המורה רוזנבלום': 'rosenblum', 'הסטטוסים של האחיין': 'nephew', 'ליאור סליים': 'lior-slime', 'עודד קטש': 'oded', 'השכן המציק': 'neighbor', 'המשפחה של אברם': 'avram', 'אסף': 'asaf', 'נווה דרומי': 'neve-dromi', 'נהג המונית': 'taxi-driver', 'המתבגרת': 'teen', 'נווה דוגי': 'neve-dugi', 'מרדכי דוד': 'mordechai-david', 'הבחור מהלילה': 'night-guy', 'גדי איזנקוט': 'eisenkot', 'רינה המזכירה': 'rina', 'פרופסור חצרוני': 'hatzroni', 'שוקי המתווך': 'shuki', 'משה פייגלין': 'feiglin', 'אבי שושן': 'avi-shushan', 'ד״ר סאמר': 'dr-samer', 'המוכרת מחנות התכשיטים': 'jeweler', 'מרים המזכירה': 'miriam', 'עמי ואורן': 'ami', 'יניב מ-KSP': 'ksp-seller', 'נפתלי בנט': 'bennett', 'יותם זמרי': 'yotam-zamri', 'נאור ציון': 'naor-zion', 'מתן ניסטור': 'matan', 'אלון גונן': 'alon', 'דני בולר': 'danny-buller', 'אלכס דניאל': 'alex-daniel', 'דור אקשטיין': 'dor-eckstein', 'עומר קולי': 'omer-koli',
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

    site_card, site_list = site_cards(out_series, out_chars, {c['id']: c for c in chars})
    topics = site_topics(site_list)
    site = {'series': out_series, 'characters': out_chars,
            'videos': [{k: v for k, v in x.items() if not k.startswith('_')} for x in videos],
            'sites': site_card,   # card id -> card ([[site:ID]] in the chat)
            # every site once, for a list on the page: {id, url, title, about, img, whose, in (the site a game is part of)}
            # + topic (a SITE_TOPICS key) and tagline, by AI (site_topics)
            'site_list': [{**s, 'img': site_card[s['id']]['img'], **topics.get(s['id'], {})} for s in site_list],
            # every live game, newest first - the character page, the games page and the home read this one list
            'games': games({c['id'] for c in out_chars})}
    with open(os.path.join(PUB, 'data', 'wiki.json'), 'w', encoding='utf8') as f:
        json.dump(site, f, ensure_ascii=False, separators=(',', ':'))
    # each video's sort time (to the second) - push.cjs gives a video the catalog doesn't have yet its place in the list
    # (techietech-api/catalog.js: the list itself lives in the database since 2026-11-05)
    with open(os.path.join(HERE, 'catalog-local.json'), 'w', encoding='utf8') as f:
        json.dump({v['id']: v.get('_t') or v.get('date') or '' for v in videos}, f, ensure_ascii=False, indent=0)

    card = cards(videos)
    raw = {c['id']: c for c in chars}
    brain = {
        'worlds': [{'id': s['id'], 'title': s['title'], 'blurb': s['blurb'], 'site': s['site'],
                    'brief': next((w.get('brief', '') for k, w in worlds.items() if series_id(k) == s['id']), '')} for s in out_series],
        'characters': [{**{k: raw[c['id']][k] for k in BRAIN_KEYS if k in raw[c['id']]}, 'site': c['site'],
                        'videos': c['videos'], 'tagline': c['tagline'], 'bio': c['bio']} for c in out_chars],
        'videos': [{'id': v['id'], 'title': v['title'], 'teaser': v['teaser'], 'cast': v['cast'], 'date': v.get('date', ''),
                    'card': card.get(v['id']) or v['teaser'], 'transcript': v['_transcript']} for v in videos],
        'sites': site_list,
        'games': [{k: g[k] for k in ('id', 'url', 'title', 'tagline', 'chars', 'record') if k in g} for g in games({c['id'] for c in out_chars})],
    }
    with open(os.path.join(ROOT, 'techietech-api', 'wiki-brain.json'), 'w', encoding='utf8') as f:
        json.dump(brain, f, ensure_ascii=False, separators=(',', ':'))

    print(f'wiki.json: {len(out_series)} series, {len(out_chars)} characters ({sum(1 for c in out_chars if c["img"])} with portraits), {len(videos)} videos')
    print('brain:', os.path.getsize(os.path.join(ROOT, 'techietech-api', 'wiki-brain.json')) // 1024, 'KB')
    for m in missing:
        print('MISSING', m)


PUBLIC = 'https://shlomiverse.com'  # his address since 2026-10-31 (the same site as boostmind-b052c.web.app)


def games(char_ids):
    """Every live game of the Shlomiverse (his ask, 2026-11-03: games per character are part of the infrastructure).
    A game = a folder public/<site>/<slug>/ with a game.json (the make-verse-game skill): status "live" only. Whose:
    game.json "chars" (a list - a game can star several), else "character", else the site's name ("hani-games" ->
    hani). The date: game.json "date", else the day the folder first reached git. Newest first."""
    import glob, subprocess
    out = []
    for gj in glob.glob(os.path.join(ROOT, 'public', '*', '*', 'game.json')):
        try:
            g = json.load(open(gj, encoding='utf8'))
        except ValueError:
            continue
        if g.get('status', 'live') != 'live':
            continue
        folder = os.path.dirname(gj)
        site, slug = os.path.basename(os.path.dirname(folder)), os.path.basename(folder)
        chars = g.get('chars') or ([g['character']] if g.get('character') else [site.removesuffix('-games')])
        date = g.get('date') or subprocess.run(['git', 'log', '--diff-filter=A', '--format=%as', '-1', '--', gj], cwd=ROOT,
                                               capture_output=True, text=True).stdout.strip()
        cover = g.get('cover') or 'cover.jpg'
        url = f'{PUBLIC}/{site}/{slug}/'
        out.append({'id': f'{site}-{slug}', 'url': url, 'title': g.get('title') or slug, 'tagline': g.get('tagline', ''),
                    'img': url + cover if os.path.exists(os.path.join(folder, cover)) else None,
                    'chars': [c for c in chars if c in char_ids], 'site': site, 'date': date or ''})
        rec = g.get('record')
        if isinstance(rec, dict) and rec.get('unit'):   # daily records (verse/records.js): the game reports a score at game over
            out[-1]['record'] = {'unit': rec['unit'], 'better': 'low' if rec.get('better') == 'low' else 'high', **({'max': rec['max']} if rec.get('max') else {})}
    out.sort(key=lambda x: x['date'], reverse=True)
    return out


def site_cards(series, chars, raw):
    """Every site of the Shlomiverse as a chat card (his ask, 2026-11-01: a link should be a nice card with its
    picture, like the video cards; and the chat must know ALL the sites - it missed Hani's games). A site = a world's
    site, a character's `site` or any of their `links` that lives here (shlomiverse.com / techytech.web.app), and every
    game inside one (a folder with a game.json - Hani's games). Per site its title, og:image and description, read
    from the page in public/ (techytech.web.app is public/techietech/).
    Returns (cards, sites): cards = {card id: {url, title, img, host}} for the page - keyed by the site's own id (its
    folder, '/' -> '-') and, as before, by every resident / series id whose main site it is; sites = the list for the
    chat's map: {id, url, title, about, whose}."""
    import re as _re
    by_url, owners = {}, {}

    def read(url, fallback):
        url = url.replace('https://boostmind-b052c.web.app', PUBLIC).rstrip('/') + '/'
        if 'techytech.web.app' in url or url == PUBLIC + '/techietech/':
            url, path = 'https://techytech.web.app', 'techietech'
        elif url.startswith(PUBLIC + '/'):
            path = url[len(PUBLIC) + 1:].strip('/')
        else:
            return None
        if url in by_url:
            return by_url[url]
        page = os.path.join(ROOT, 'public', *path.split('/'), 'index.html')
        if not path or not os.path.exists(page):
            return None
        h = open(page, encoding='utf8').read()
        game = os.path.join(os.path.dirname(page), 'game.json')
        g = json.load(open(game, encoding='utf8')) if os.path.exists(game) else {}
        m = _re.search(r'<title>([^<]+)', h)
        parts = _re.split(r'\s*[|—✨•]\s*', m.group(1).strip()) if m else [fallback]
        m = _re.search(r'og:description"\s+content="([^"]+)', h)
        about = []
        for x in [*parts[1:], g.get('tagline', ''), m.group(1) if m else '']:
            if x and not any(x in a or a in x for a in about):
                about.append(x)
        about = ' - '.join(about)
        m = _re.search(r'og:image"\s+content="([^"]+)', h)
        img = m.group(1) if m else ('cover.jpg' if os.path.exists(os.path.join(os.path.dirname(page), 'cover.jpg')) else None)
        if img and not img.startswith('http'):
            img = url.rstrip('/') + '/' + img
        sid = 'techytech' if path == 'techietech' else path.replace('/', '-')
        by_url[url] = {'id': sid, 'url': url, 'title': g.get('title') or parts[0], 'about': about,
                       'img': img and img.replace('https://boostmind-b052c.web.app', PUBLIC), 'host': url.split('://', 1)[1].rstrip('/')}
        # the games inside it
        for sub in sorted(os.listdir(os.path.dirname(page))):
            gj = os.path.join(os.path.dirname(page), sub, 'game.json')
            if os.path.exists(gj) and json.load(open(gj, encoding='utf8')).get('status', 'live') == 'live':
                s = read(url + sub + '/', sub)
                if s:
                    s['in'] = sid
        return by_url[url]

    cards = {}
    for x in [*series, *chars]:
        r = raw.get(x['id'], {})
        urls = [x.get('site')] + [l.get('url') for l in r.get('links') or [] if isinstance(l, dict)]
        for i, u in enumerate(urls):
            s = u and read(u, x.get('title') or x.get('name'))
            if not s:
                continue
            if x['id'] not in owners.setdefault(s['url'], []):
                owners[s['url']].append(x['id'])
            if i == 0:
                cards[x['id']] = s
    sites = []
    for s in by_url.values():
        whose = owners.get(s['url']) or owners.get(next((o['url'] for o in by_url.values() if o['id'] == s.get('in')), ''), [])
        card = {k: s[k] for k in ('url', 'title', 'img', 'host')}
        cards[s['id']] = card
        for k in list(cards):
            if cards[k] is s:
                cards[k] = card
        sites.append({'id': s['id'], 'url': s['url'], 'title': s['title'], 'about': s['about'], 'whose': whose, 'in': s.get('in')})
    return cards, sites


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


SITE_TOPICS = {'shop': 'חנויות', 'games': 'משחקים', 'spirit': 'רוחניות ותחזיות', 'community': 'קהילה ודת',
               'business': 'עסקים והייטק', 'culture': 'ספרים, משפחה ותרבות'}


def site_topics(sites):
    """The sites page groups the sites by subject (his ask, 2026-11-01: "you wrote Hani and then all the rest, lazy").
    Per site the AI picks a `topic` (one of SITE_TOPICS) and writes a short Hebrew `tagline` in the site's own voice -
    judgement is the AI's, never a list here (his rule). Terra (it is shown to visitors), once per site: kept in
    site_topics.json with the hash of what it was given; only new / changed sites are sent, in one call."""
    path = os.path.join(HERE, 'site_topics.json')
    have = load_json(path, {}) or {}
    h = lambda s: hashlib.md5(('topics-v1' + s['title'] + s['about'] + (s.get('in') or '')).encode('utf8')).hexdigest()[:10]
    todo = [s for s in sites if have.get(s['id'], {}).get('h') != h(s)]
    if todo:
        try:
            env = dict(l.rstrip('\n').split('=', 1) for l in open(os.path.join(ZC, '.env'), encoding='utf8') if '=' in l and not l.startswith('#'))
            items = [{'id': s['id'], 'title': s['title'], 'about': s['about'][:400], 'owner': ', '.join(s['whose']),
                      **({'a game inside': s['in']} if s.get('in') else {})} for s in todo]
            prompt = ('These are the websites of characters in a Hebrew comedy world (each character treats their site as '
                      'completely real). For each site: (1) "topic" - the ONE subject a visitor would look for it under, one '
                      'of these keys: ' + json.dumps(SITE_TOPICS, ensure_ascii=False) + '; (2) "tagline" - one short Hebrew '
                      'line, at most 45 characters, in the site\'s own voice (as the site itself would say it, serious, no '
                      'explaining the joke, no emoji) - what you get there.\n' + json.dumps(items, ensure_ascii=False) +
                      '\nAnswer JSON only: {"<id>": {"topic": "<key>", "tagline": "<line>"}, ...}')
            body = json.dumps({'model': 'gpt-5.6-terra', 'input': prompt, 'reasoning': {'effort': 'low'},
                               'text': {'format': {'type': 'json_object'}}}).encode()
            req = urllib.request.Request('https://api.openai.com/v1/responses', data=body, headers={
                'Authorization': 'Bearer ' + env['OPENAI_API_KEY'].strip().strip('"\''), 'Content-Type': 'application/json'})
            r = json.loads(urllib.request.urlopen(req, timeout=300).read())
            out = json.loads(next(c['text'] for o in r['output'] if o['type'] == 'message' for c in o['content'] if c['type'] == 'output_text'))
            for s in todo:
                x = out.get(s['id']) or {}
                if x.get('topic') in SITE_TOPICS:
                    have[s['id']] = {'h': h(s), 'topic': x['topic'], 'tagline': (x.get('tagline') or '').strip()}
            u = r.get('usage', {})
            print(f"site topics: {len(todo)} by AI, ${(u.get('input_tokens', 0) * 2 + u.get('output_tokens', 0) * 12) / 1e6:.4f}")
            with open(path, 'w', encoding='utf8') as f:
                json.dump(have, f, ensure_ascii=False, indent=1)
        except Exception as e:  # no key / no network: the page shows them under 'עוד', the next build tries again
            print('site topics: not written now -', str(e)[:200])
    return {k: {'topic': v['topic'], 'tagline': v['tagline']} for k, v in have.items()}


if __name__ == '__main__':
    main()
