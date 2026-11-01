"""Who is in each reel, from its Instagram cover picture alone - a cheap index of the reels not imported yet, so "bring
all of <character>" works without hashtags (his ask, 2026-11-01). A guess only: every reel still goes through reel.py.

  python scripts/insta/covers.py test [N=20]     # N reels already on the wiki: real cost + how many it got right
  python scripts/insta/covers.py run [MIN_LIKES=0] [AFTER=]  # every reel not in state.json -> scripts/insta/work/covers.json

One Luna call per cover (detail low); the roster goes first and unchanged, so it is cached from the 2nd call on."""
import base64, json, os, sys, urllib.request, random
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reel  # roster(), openai(), LUNA, LUNA_USD, E, load, save

WORK = reel.WORK
OUT = os.path.join(WORK, 'covers.json')
HIT = [0, 0]  # cached / all input tokens - printed, so a cache miss shows at once


def cover(mid):
    url = json.loads(urllib.request.urlopen(f"https://graph.instagram.com/v23.0/{mid}?fields=thumbnail_url&access_token={reel.E['IG_TOKEN']}",
                                            timeout=60).read()).get('thumbnail_url')
    return urllib.request.urlopen(url, timeout=60).read() if url else None


def guess(m):
    img = cover(m['id'])
    if not img:
        return m['id'], {'error': 'no cover'}, 0.0
    content = [{'type': 'input_text', 'text': (
        'Known characters of Shlomi Zevin\'s Hebrew comedy world (JSON):\n' + json.dumps(reel.roster(), ensure_ascii=False) + '\n\n'
        'Below: the cover picture of one of his Instagram reels. Shlomi plays every character himself, so tell them apart by '
        'costume, wig, glasses, setting and the text burned into the picture - never by his face.\n'
        'Answer JSON only: {"ids": [ids of known characters you see, best first], "new": "a few Hebrew words if it looks like '
        'someone not in the list, else empty", "confidence": 0-1}')},
        {'type': 'input_text', 'text': f'Caption: {(m.get("caption") or "(none)")[:300]}'},
        {'type': 'input_image', 'image_url': 'data:image/jpeg;base64,' + base64.b64encode(img).decode(), 'detail': 'low'}]
    r = reel.openai('responses', body={'model': reel.LUNA, 'input': [{'role': 'user', 'content': content}],
                                       'reasoning': {'effort': 'low'}, 'text': {'format': {'type': 'json_object'}},
                                       # one cache key holds ~15 requests a minute; more spill to machines without the
                                       # cache ($0.0024 a cover instead of $0.0004 - the 228 of 2026-11-01): a key per worker
                                       'prompt_cache_key': f'covers-roster-{int(m["id"]) % 3}'})
    out = json.loads(next(c['text'] for o in r['output'] if o['type'] == 'message' for c in o['content'] if c['type'] == 'output_text'))
    u = r.get('usage', {}); cached = (u.get('input_tokens_details') or {}).get('cached_tokens', 0)
    P = reel.LUNA_USD
    usd = ((u.get('input_tokens', 0) - cached) * P[0] + cached * P[1] + u.get('output_tokens', 0) * P[2]) / 1e6
    HIT[0] += cached; HIT[1] += u.get('input_tokens', 0)
    return m['id'], out, usd


def run_all(items, workers=3):
    res, total = {}, 0.0
    warm, seen = [], set()  # one call per cache key alone first, so every key has the roster cached
    for m in items:
        if int(m['id']) % 3 not in seen:
            seen.add(int(m['id']) % 3); warm.append(m)
    for m in warm:
        mid, out, usd = guess(m); res[mid] = out; total += usd
    with ThreadPoolExecutor(workers) as ex:
        for mid, out, usd in ex.map(guess, [m for m in items if m not in warm]):
            res[mid] = out; total += usd
    return res, total


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'test'
    media = {m['id']: m for m in reel.load(os.path.join(WORK, 'media.json'))}
    state = reel.load(os.path.join(os.path.dirname(WORK), 'state.json'), {})
    if cmd == 'test':
        n = int(sys.argv[2]) if len(sys.argv) > 2 else 20
        done = [(mid, s['cast']) for mid, s in state.items() if s.get('cast') and mid in media]
        random.seed(7); sample = random.sample(done, min(n, len(done)))
        res, total = run_all([media[mid] for mid, _ in sample])
        hit = top = 0
        for mid, cast in sample:
            ids = res[mid].get('ids') or []
            ok = bool(set(ids) & set(cast)); hit += ok; top += bool(ids and ids[0] in cast)
            print(('OK ' if ok else 'XX ') + mid, 'real', cast, 'guess', ids, res[mid].get('new') or '')
        print(f'{len(sample)} covers: {hit} right (any), {top} right (first guess); cost ${total:.4f} = ${total / len(sample):.5f} each; cache {HIT[0] * 100 // max(1, HIT[1])}%')
    else:
        min_likes = int(sys.argv[2]) if len(sys.argv) > 2 else 0
        after = sys.argv[3] if len(sys.argv) > 3 else ''
        todo = [m for m in media.values() if m.get('media_product_type') == 'REELS' and m['id'] not in state
                and (m.get('like_count') or 0) >= min_likes and after <= m['timestamp'] < '2026-10-17']
        prev = reel.load(OUT, {})
        todo = [m for m in todo if m['id'] not in prev]
        res, total = run_all(todo) if todo else ({}, 0.0)
        prev.update(res); reel.save(OUT, prev)
        print(f'{len(res)} covers, ${total:.3f} (${total / max(1, len(res)):.5f} each, cache {HIT[0] * 100 // max(1, HIT[1])}%); covers.json has {len(prev)}')
