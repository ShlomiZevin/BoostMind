"""One Instagram reel -> ready for the Shlomiverse wiki. Nothing is published here.

  zoomcut/.venv/Scripts/python scripts/insta/reel.py <media-id>          # every step that isn't done yet
  zoomcut/.venv/Scripts/python scripts/insta/reel.py <media-id> --redo subs

Steps (each writes into scripts/insta/work/<media-id>/ and is skipped when its file exists):
  fetch      video.mp4 (the Instagram key's media_url), audio.wav, f1..f4.jpg + strip.jpg
  words      words.json - the local Hebrew model (ivrit turbo, the editor's), NO voice filter: his mumbled character
             speech over room noise was cut by it (2026-10-31: 1 line of 5 with the filter, all 5 without)
  twin       twin.json - is this reel already on the wiki as an editor video? (free; his Oct-2026 reels were made in
             Sketch Studio and came in by Publish - the 2026-10-15 Techy-Tech reel = the 'follow-up' episode). The
             reel's words against every episode's captions/script; a match stops here (state.json -> twin)
  fix        words.json corrected by Luna against the second ear (~$0.0015): mishearings, English terms, names
  ear        ear.json - OpenAI gpt-4o-mini-transcribe as a second ear (~$0.003 a minute): a local line it never heard AND the
             local model was unsure of = likely invented on music / noise -> "doubt", left out of the subtitles
  who        who.json - Luna looks at the frames + words + caption against the editor's characters (~$0.02)
  subs       subs.ass + web.mp4 (720p, subtitles burned in, faststart) + poster.jpg
Costs and seconds per step go into cost.json.
"""
import base64, json, os, re, subprocess, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ZC = os.path.join(ROOT, 'zoomcut')
WORK = os.path.join(HERE, 'work')
TERRA = (2.00, 0.20, 12.00)  # $ per 1M tokens: input, cached input, output (developers.openai.com pricing, 2026-10-31)
# the machine steps (who / fix) run on Luna, the cheap 5.6 model: tested 2026-10-31 - the same corrections as Terra at 1/9
# the price, the right character; Terra stays for the words people read (the wiki's copy) and the characters' voices
LUNA, LUNA_USD = 'gpt-5.6-luna', (0.20, 0.02, 1.20)


def env(path):
    out = {}
    for line in open(path, encoding='utf8'):
        if '=' in line and not line.startswith('#'):
            k, v = line.rstrip('\n').split('=', 1)
            out[k.strip()] = v.strip().strip('"\'')
    return out


E = env(os.path.join(ZC, '.env'))
load = lambda p, d=None: json.load(open(p, encoding='utf8')) if os.path.exists(p) else d


def save(p, o):
    with open(p, 'w', encoding='utf8') as f:
        json.dump(o, f, ensure_ascii=False, indent=1)


def ff(*a):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *a], check=True)


def openai(path, body=None, file=None):
    """JSON body, or (with file=(name, bytes, type)) a multipart form of body's fields + the file."""
    h = {'Authorization': 'Bearer ' + E['OPENAI_API_KEY']}
    if file:
        b = '----reel' + os.urandom(8).hex()
        parts = [f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode() for k, v in body.items()]
        parts.append(f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{file[0]}"\r\nContent-Type: {file[2]}\r\n\r\n'.encode() + file[1] + b'\r\n')
        data, h['Content-Type'] = b''.join(parts) + f'--{b}--\r\n'.encode(), f'multipart/form-data; boundary={b}'
    else:
        data, h['Content-Type'] = json.dumps(body).encode(), 'application/json'
    try:
        return json.loads(urllib.request.urlopen(urllib.request.Request('https://api.openai.com/v1/' + path, data=data, headers=h), timeout=300).read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f'OpenAI {path}: {e.code} {e.read()[:400]}')


def fetch(d, m):
    mp4 = os.path.join(d, 'video.mp4')
    if not os.path.exists(mp4):
        url = json.loads(urllib.request.urlopen(
            f"https://graph.instagram.com/v23.0/{m['id']}?fields=media_url&access_token={E['IG_TOKEN']}", timeout=60).read()).get('media_url')
        if not url:  # Instagram withholds the file of some reels (licensed music) - mark it and go on
            st = load(os.path.join(HERE, 'state.json'), {})
            st[m['id']] = {**st.get(m['id'], {}), 'status': 'no-file', 'permalink': m.get('permalink')}
            save(os.path.join(HERE, 'state.json'), st)
            print('NO FILE: Instagram gives no media_url for this reel (licensed music?) - skip it'); sys.exit(0)
        urllib.request.urlretrieve(url, mp4)
    dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).decode())
    if not subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', mp4]).strip():
        # the file comes without its sound (licensed music Instagram strips) - nothing to hear or subtitle: skip it
        st = load(os.path.join(HERE, 'state.json'), {})
        st[m['id']] = {**st.get(m['id'], {}), 'status': 'no-file', 'why': 'no audio track', 'permalink': m.get('permalink')}
        save(os.path.join(HERE, 'state.json'), st)
        print('NO FILE: the video has no audio track (licensed music stripped?) - skip it'); sys.exit(0)
    ff('-i', mp4, '-ac', '1', '-ar', '16000', os.path.join(d, 'audio.wav'))
    for i, frac in enumerate((0.15, 0.4, 0.65, 0.9), 1):
        ff('-ss', str(dur * frac), '-i', mp4, '-frames:v', '1', '-vf', 'scale=512:-2', os.path.join(d, f'f{i}.jpg'))
    ff(*sum((['-i', os.path.join(d, f'f{i}.jpg')] for i in range(1, 5)), []), '-filter_complex', 'hstack=4,scale=1200:-2', os.path.join(d, 'strip.jpg'))
    return {'seconds': round(dur, 1), 'mb': round(os.path.getsize(mp4) / 1e6, 1)}


def words(d):
    import wave, numpy as np
    from faster_whisper import WhisperModel
    m = WhisperModel(os.path.join(ZC, 'models', 'he-turbo'), device='cpu', compute_type='int8', cpu_threads=max(4, os.cpu_count() - 2))
    with wave.open(os.path.join(d, 'audio.wav')) as w:  # samples, like the editor (faster-whisper's decoder breaks on this PyAV)
        s = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    segs, _ = m.transcribe(s, language='he', vad_filter=False, word_timestamps=True)
    clean = lambda t: re.sub(r'[‎‏‪-‮]', '', t).strip()
    save(os.path.join(d, 'words.json'), [{'start': round(g.start, 2), 'end': round(g.end, 2), 'text': clean(g.text),
                                          'sure': round(g.avg_logprob, 2), 'silence': round(g.no_speech_prob, 2),
                                          'words': [{'w': clean(w.word), 's': round(w.start, 2), 'e': round(w.end, 2)} for w in g.words or []]} for g in segs])
    return {}


def ear(d, secs):
    wav = open(os.path.join(d, 'audio.wav'), 'rb').read()
    j = openai('audio/transcriptions', body={'model': 'gpt-4o-mini-transcribe', 'language': 'he'}, file=('a.wav', wav, 'audio/wav'))
    save(os.path.join(d, 'ear.json'), j)
    # a local line whose words the second ear mostly never heard = likely invented
    heard = set(re.findall(r'[֐-׿A-Za-z0-9]+', j.get('text', '')))
    segs = load(os.path.join(d, 'words.json'), [])
    for g in segs:
        toks = re.findall(r'[֐-׿A-Za-z0-9]+', g['text'])
        g['heard'] = round(sum(t in heard for t in toks) / max(1, len(toks)), 2)
        # the second ear also drops real lines (it missed his last line on a re-run), so only both doubting removes one
        g['doubt'] = g['heard'] < 0.34 and (g.get('sure', 0) < -0.8 or g.get('silence', 0) > 0.5)
    save(os.path.join(d, 'words.json'), segs)
    return {'usd': round(secs / 60 * 0.003, 4)}  # gpt-4o-mini-transcribe


def roster():
    out = []
    for cid in sorted(os.listdir(os.path.join(ZC, 'characters'))):
        c = load(os.path.join(ZC, 'characters', cid, 'character.json'))
        if not c:
            continue
        txt = lambda v: (v if isinstance(v, str) else json.dumps(v, ensure_ascii=False))[:220]
        out.append({'id': cid, 'name': c.get('name'), 'aka': c.get('aka', [])[:3], 'world': c.get('world'),
                    'role': txt(c.get('role', '')), 'look': txt(c.get('look', '')), 'speech': txt(c.get('speech', ''))})
    return out


def who(d, m):
    text = ' '.join(g['text'] for g in load(os.path.join(d, 'words.json'), []) if not g.get('doubt'))
    # the roster first and unchanged, so OpenAI caches it from the 2nd reel on
    content = [{'type': 'input_text', 'text': (
        'Known characters of Shlomi Zevin\'s Hebrew comedy world (JSON):\n' + json.dumps(roster(), ensure_ascii=False) + '\n\n'
        'Below: 4 frames and the transcript of one of his Instagram reels. Shlomi plays every character himself, so tell '
        'them apart by costume, setting, speech style and content - never by his face. Read the text burned into the frames.\n'
        f'Instagram caption: {m.get("caption") or "(none)"}\nTranscript:\n{text or "(no speech)"}\n\n'
        'Answer JSON only: {"known": [ids of known characters who appear], "new": [{"name_guess": "", "who": "one line, Hebrew", '
        '"look": "costume / setting, Hebrew"}], "is_shlomi_himself": bool, "on_screen_text": "the burned-in text, Hebrew", '
        '"title_he": "a short fan title", "confidence": 0-1, "why": "one line"}')}]
    for i in range(1, 5):
        b = base64.b64encode(open(os.path.join(d, f'f{i}.jpg'), 'rb').read()).decode()
        content.append({'type': 'input_image', 'image_url': 'data:image/jpeg;base64,' + b, 'detail': 'low'})
    r = openai('responses', body={'model': LUNA, 'input': [{'role': 'user', 'content': content}], 'text': {'format': {'type': 'json_object'}}})
    out = next(c['text'] for o in r['output'] if o['type'] == 'message' for c in o['content'] if c['type'] == 'output_text')
    save(os.path.join(d, 'who.json'), json.loads(out))
    u = r.get('usage', {})
    cached = (u.get('input_tokens_details') or {}).get('cached_tokens', 0)
    usd = ((u.get('input_tokens', 0) - cached) * LUNA_USD[0] + cached * LUNA_USD[1] + u.get('output_tokens', 0) * LUNA_USD[2]) / 1e6
    return {'usd': round(usd, 4), 'tokens': {'in': u.get('input_tokens'), 'cached': cached, 'out': u.get('output_tokens')}}


def fix(d):
    """Terra corrects the local model's words against the second ear (OpenAI) - Hebrew mishearings, English tech terms,
    names - keeping his slang and the segments (their timings stay; chunks() spreads a fixed text over them). It
    replaced fixing words by hand (Amir's "בפנוכו", Yotam's "Dunning-Kruger", Tzvika's "null pointer exception")."""
    W = load(os.path.join(d, 'words.json'), [])
    segs = [g for g in W if not g.get('doubt') and g['text']]
    heard = (load(os.path.join(d, 'ear.json'), {}) or {}).get('text', '')
    if not segs or not heard:
        return {}
    prompt = ('Two speech-to-text transcripts of the same short Hebrew comedy video (one person playing characters, '
              'slang, English tech words). A = a local model, split into segments; B = a second model, one text.\n'
              'Correct each A segment: fix words A misheard when B (or plain sense) shows the right word, write English '
              'terms in English (LLM, AI, Survivorship Bias), fix names. Keep his slang, mistakes made on purpose and '
              'the character\'s way of speaking; don\'t rephrase, don\'t add or drop sentences, keep each segment\'s '
              'content in its own segment. Same number of segments, same order.\n'
              f'A: {json.dumps([g["text"] for g in segs], ensure_ascii=False)}\nB: {heard}\n'
              'Answer JSON only: {"segments": ["..."]}')
    r = openai('responses', body={'model': LUNA, 'input': prompt, 'reasoning': {'effort': 'low'},
                                  'text': {'format': {'type': 'json_object'}}})
    out = json.loads(next(c['text'] for o in r['output'] if o['type'] == 'message' for c in o['content'] if c['type'] == 'output_text'))
    new = out.get('segments') or []
    changed = 0
    if len(new) == len(segs):
        for g, t in zip(segs, new):
            if t.strip() and t.strip() != g['text']:
                g.setdefault('local', g['text'])
                g['text'], g['fixed'] = t.strip(), True
                changed += 1
        save(os.path.join(d, 'words.json'), W)
    u = r.get('usage', {})
    usd = (u.get('input_tokens', 0) * LUNA_USD[0] + u.get('output_tokens', 0) * LUNA_USD[2]) / 1e6
    return {'usd': round(usd, 4), 'changed': changed, 'of': len(segs)}


def twin(d, mid):
    """Share of the reel's 3-word runs found in an editor episode's captions/script; > 0.3 = the same video."""
    norm = lambda t: re.sub(r'[^\w\s]', ' ', t).split()
    grams = lambda w: {tuple(w[i:i + 3]) for i in range(len(w) - 2)}
    mine = grams(norm(' '.join(x['text'] for x in load(os.path.join(d, 'words.json'), []))))
    best = (0, '')
    for f in [*__import__('glob').glob(os.path.join(ZC, 'episodes', '*', 'captions.txt')),
              *__import__('glob').glob(os.path.join(ZC, 'episodes', '*', 'script.txt'))]:
        eid = os.path.basename(os.path.dirname(f))
        if eid.startswith('_') or eid.endswith('-test') or not mine:
            continue
        score = len(mine & grams(norm(open(f, encoding='utf8').read()))) / len(mine)
        best = max(best, (round(score, 2), eid))
    out = {'score': best[0], 'episode': best[1] if best[0] > 0.3 else None, 'closest': best[1]}
    save(os.path.join(d, 'twin.json'), out)
    if out['episode']:
        st = load(os.path.join(HERE, 'state.json'), {})
        st[mid] = {**st.get(mid, {}), 'status': 'twin', 'episode': out['episode'], 'score': out['score']}
        save(os.path.join(HERE, 'state.json'), st)
        print(f"TWIN: already on the wiki as the editor episode '{out['episode']}' ({out['score']:.0%} of its words) - skip this reel")
        sys.exit(0)
    return out


def ass_time(t):
    return f'{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}'


def chunks(g, soft=26, hard=38):
    """A long monologue segment -> short subtitle lines (2 rows at most on screen), split on the word timings:
    after a comma / full stop once past `soft` characters, always past `hard`."""
    ws = [w for w in g.get('words') or [] if w['w'].strip()]
    if not ws or len(g['text']) <= hard:
        return [g]
    if g.get('fixed'):  # Terra's corrected text no longer matches the word timings one by one: spread it over them
        words, out, first = g['text'].split(), [], 0
        at = lambda j: ws[min(len(ws) - 1, j * len(ws) // len(words))]
        for k, w in enumerate(words):
            text = ' '.join(words[first:k + 1])
            if (len(text) >= soft and w[-1:] in ',.?!:') or len(text) >= hard or k == len(words) - 1:
                out.append({'start': at(first)['s'], 'end': at(k)['e'] if k < len(words) - 1 else ws[-1]['e'], 'text': text}); first = k + 1
        return out
    # each word's place in the segment's own text (the words come without their spacing: ב-AI is two of them)
    full, pos, spans = g['text'], 0, []
    for w in ws:
        i = full.find(w['w'].strip(), pos)
        i = pos if i < 0 else i
        pos = i + len(w['w'].strip()) if i >= pos else pos
        spans.append((i, pos))
    out, first = [], 0
    for k, w in enumerate(ws):
        text = full[spans[first][0]:spans[k][1]].strip()
        if (len(text) >= soft and w['w'].strip()[-1:] in ',.?!:') or len(text) >= hard or k == len(ws) - 1:
            out.append({'start': ws[first]['s'], 'end': w['e'], 'text': text}); first = k + 1
    return out


def subs(d):
    """The editor's one-camera subtitles, in the reel: Assistant ExtraBold, white, thick black outline + soft shadow,
    top of the box at 76% of the height (the editor's y 1470 of 1920) - under the burned-in meme text, which sits mid-frame."""
    w, h = map(int, subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height',
                                             '-of', 'csv=p=0', os.path.join(d, 'video.mp4')]).decode().split(',')[:2])
    k = w / 1080
    lines = [c for g in load(os.path.join(d, 'words.json'), []) if g['text'] and not g.get('doubt') for c in chunks(g)]
    if os.path.exists(os.path.join(d, 'own-subs')):  # he burned in his own subtitles (his Yotam reels) - ours would sit on them
        lines = []
    ass = ['[Script Info]', 'ScriptType: v4.00+', f'PlayResX: {w}', f'PlayResY: {h}', 'WrapStyle: 0', '',
           '[V4+ Styles]', 'Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
           f'Style: S,Assistant ExtraBold,{round(76 * k)},&H00FFFFFF,&H00000000,&H8C000000,0,{round(7 * k, 1)},{round(4 * k, 1)},8,{round(60 * k)},{round(60 * k)},0,-1', '',  # Encoding -1: libass finds the base direction (RTL) itself
           '[Events]', 'Format: Layer, Start, End, Style, Text']
    # where the subtitles' top sits: the editor's 76.6%, or a reel's own `subs-y` file (e.g. 0.84 under a text box he
    # burned in at the same height - Matan Nistor's question box)
    sy = float(open(os.path.join(d, 'subs-y')).read()) if os.path.exists(os.path.join(d, 'subs-y')) else 0.766
    for i, g in enumerate(lines):
        end = min(g['end'] + 0.3, lines[i + 1]['start']) if i + 1 < len(lines) else g['end'] + 0.4
        text = re.sub(r'([\u05d0-\u05ea])-(?=[A-Za-z0-9])', '\\1-\u200f', g['text'])  # ל-OpenAI: the hyphen stays with the Hebrew
        ass.append(f'Dialogue: 0,{ass_time(g["start"])},{ass_time(end)},S,{{\\pos({w // 2},{round(h * sy)})}}{text}')
    open(os.path.join(d, 'subs.ass'), 'w', encoding='utf8').write('\n'.join(ass) + '\n')
    esc = lambda p: p.replace('\\', '/').replace(':', '\\:')  # a Windows path inside an ffmpeg filter
    ff('-i', os.path.join(d, 'video.mp4'), '-vf', f"scale=720:-2,ass='{esc(os.path.join(d, 'subs.ass'))}':fontsdir='{esc(os.path.join(ZC, 'fonts'))}'",
       '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', os.path.join(d, 'web.mp4'))
    ff('-ss', '1.5', '-i', os.path.join(d, 'web.mp4'), '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', os.path.join(d, 'poster.jpg'))
    return {'mb': round(os.path.getsize(os.path.join(d, 'web.mp4')) / 1e6, 1)}


def main():
    mid, args = sys.argv[1], sys.argv[2:]
    redo = args[args.index('--redo') + 1].split(',') if '--redo' in args else []
    m = next(x for x in load(os.path.join(WORK, 'media.json')) if x['id'] == mid)
    d = os.path.join(WORK, mid)
    os.makedirs(d, exist_ok=True)
    cost = load(os.path.join(d, 'cost.json'), {})
    steps = [('fetch', 'strip.jpg', lambda: fetch(d, m)), ('words', 'words.json', lambda: words(d)),
             ('twin', 'twin.json', lambda: twin(d, mid)),
             ('ear', 'ear.json', lambda: ear(d, cost['fetch']['seconds'])), ('fix', 'words.json', lambda: fix(d)),
             ('who', 'who.json', lambda: who(d, m)),
             ('subs', 'web.mp4', lambda: subs(d))]
    for name, done, fn in steps:
        if os.path.exists(os.path.join(d, done)) and name not in redo and name in cost:
            continue
        t0 = time.time()
        cost[name] = {**(fn() or {}), 'secs': round(time.time() - t0, 1)}
        save(os.path.join(d, 'cost.json'), cost)
        print(name, cost[name], flush=True)
    print('total $', round(sum(v.get('usd', 0) for v in cost.values()), 4))


if __name__ == '__main__':
    main()
