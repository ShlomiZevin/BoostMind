"""A published video -> all his sites, in one run: python scripts/wiki/publish_site.py <episode-id>... [--no-deploy]

The studio runs it by itself after every Publish (render/publish.mjs, a "site" job in the Jobs list); a session runs
it for a video that missed it. Steps (wiki.md "A finished video -> the Shlomiverse"):
  1. the project is marked done (the studio's endpoint) and has its full export
  2. the web copy + poster (encode.sh)
  3. the fan copy for anything new - the video's title / teaser, a new character's tagline / bio / questions (Terra)
  4. the build (wiki.json for the wiki and the links page, wiki-brain.json for the chat agent)
  5. deploy the site and the chat agent, then check the live wiki has the video
A character of the Techy-Tech world without a card on the company site is reported - that card is written by hand.
"""
import glob, json, os, re, shutil, subprocess, sys, tempfile, time, urllib.request

from canon import HERE, ROOT, ZC, characters, episodes, load_json

STUDIO = 'http://localhost:4747'
SOL = os.path.expanduser('~/.claude/skills/sol-leonardo/scripts/sol.js')
KEYS = 'C:/workspace/aspect/aspect-agent-server/.env'  # the working OpenAI key (BoostMind's own is revoked)
WIKI = 'https://shlomiverse.com/wiki/'


def say(m):
    print(m, flush=True)


def run(cmd, cwd=ROOT, check=True):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding='utf8', errors='replace', shell=isinstance(cmd, str))
    if check and r.returncode:
        raise SystemExit(f'failed: {cmd if isinstance(cmd, str) else " ".join(cmd)}\n{(r.stdout + r.stderr)[-1200:]}')
    return r.stdout + r.stderr


def mark_done(eid):
    ep = os.path.join(ZC, 'episodes', eid, 'episode.json')
    if (load_json(ep, {}) or {}).get('done'):
        return
    try:  # through the studio (it also tidies the Drop's cloud copy), else in the file
        req = urllib.request.Request(f'{STUDIO}/api/ep/{eid}/done', data=b'{"done": true}', headers={'Content-Type': 'application/json'})
        urllib.request.urlopen(req, timeout=10).read()
    except Exception:
        cfg = load_json(ep, {})
        cfg['done'] = True
        with open(ep, 'w', encoding='utf8') as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
    say(f'  · {eid} marked done')


def others_pages():
    """Pages under public/ that differ from the live site - another session's work the deploy would take along
    (this job's own wiki files aside). [(path, minutes since it changed)]"""
    out = run(['git', 'status', '--porcelain', '--', 'public'], check=False)
    files = []
    for line in out.splitlines():
        p = line[3:].strip().strip('"')
        if p.startswith(('public/wiki/data', 'public/wiki/v/', 'public/wiki/img')):
            continue
        files += glob.glob(os.path.join(ROOT, p, '**', '*.html'), recursive=True) if p.endswith('/') else [os.path.join(ROOT, p)] if p.endswith('.html') else []
    res = []
    for f in files:
        rel = os.path.relpath(f, os.path.join(ROOT, 'public')).replace('\\', '/')
        url = 'https://boostmind-b052c.web.app/' + (rel[:-len('index.html')] if rel.endswith('index.html') else rel)
        try:
            live = urllib.request.urlopen(f'{url}?n={time.time()}', timeout=20).read()
        except Exception:
            live = b''
        if live != open(f, 'rb').read():
            res.append((rel, (time.time() - os.path.getmtime(f)) / 60))
    return res


def settle():
    """The deploy takes the whole site as it is on his PC: a page another session is in the middle of would go live
    half-done. A page changed in the last 10 minutes = still being worked on -> wait (every 5 minutes, up to 30 - he
    doesn't mind a few minutes), then deploy anyway and say what went along (2026-10-25)."""
    for _ in range(6):
        busy = [p for p, age in others_pages() if age < 10]
        if not busy:
            break
        say(f'  · waiting for another session to finish: {", ".join(busy)}')
        time.sleep(300)
    went = [p for p, _ in others_pages()]
    if went:
        say(f'  ! went live along with it (other sessions\' changes): {", ".join(went)}')


def places(eid, cast, world):
    """The places a video's characters must reach. Done here: the wiki (their page + the video), the links page's
    videos (it reads wiki.json), the chat agent's brain. Checked and reported with '  !' (a session adds it):
    the character's portrait, a Techy-Tech card on the company site, their own site on the links page and the video
    on their own site."""
    out = []
    brain = open(os.path.join(ROOT, 'techietech-api', 'wiki-brain.json'), encoding='utf8').read()
    if f'"{eid}"' not in brain and eid not in brain:
        out.append(f'  ! the chat agent\'s brain has no {eid} - rerun scripts/wiki/build.py')
    company = open(os.path.join(ROOT, 'public', 'techietech', 'index.html'), encoding='utf8').read()
    links = open(os.path.join(ROOT, 'public', 'links', 'index.html'), encoding='utf8').read()
    for cid in cast:
        c = world.get(cid, {})
        name = c.get('name', cid)
        if not os.path.exists(os.path.join(ROOT, 'public', 'wiki', 'img', 'c', cid + '.jpg')):  # build.py's output
            out.append(f'  ! {name} has no portrait on the wiki - give the studio profile one (assets.portraits) or add scripts/wiki/portraits/<id>.jpg')
        if c.get('world') == 'טקי-טק' and f"id: '{cid}'" not in company:
            out.append(f'  ! {name} works at Techy-Tech but has no card on the company site - add it (SKILL.md step 12)')
        url = (c.get('site') or {}).get('url', '')
        m = re.match(r'https://(?:boostmind-b052c\.web\.app|(?:www\.)?shlomiverse\.com)/([\w-]+)/', url)
        if not m or m.group(1) == 'techietech':
            continue
        folder = os.path.join(ROOT, 'public', m.group(1))
        if f'/{m.group(1)}/' not in links:
            out.append(f'  ! {name}\'s site /{m.group(1)}/ has no button on the links page')
        files = [open(f, encoding='utf8', errors='ignore').read()
                 for f in glob.glob(os.path.join(folder, '**', '*.*'), recursive=True) if f.endswith(('.html', '.js', '.json'))]
        # only a site that shows videos at all (a shop or a family tree doesn't); its own file names differ from the
        # episode ids, so this is a question for the session, not a certainty
        if any('<video' in t for t in files) and not any(eid in t for t in files):
            out.append(f"  ! {name}'s own site /{m.group(1)}/ shows videos but not {eid} - add it if it belongs there (SKILL.md step 12)")
    return out or [f'  · {eid}: every place checked - nothing missing']


def main():
    ids = [a for a in sys.argv[1:] if not a.startswith('--')]
    deploy = '--no-deploy' not in sys.argv
    if not ids:
        raise SystemExit(__doc__)
    for eid in ids:
        if not os.path.exists(os.path.join(ZC, 'episodes', eid, 'out', f'{eid}.mp4')):
            raise SystemExit(f'{eid}: no full export (out/{eid}.mp4) - export it first')
        mark_done(eid)

    sh = shutil.which('sh') or 'C:/Program Files/Git/bin/sh.exe'
    run([sh, 'scripts/wiki/encode.sh', *ids])
    say('  · web copy + poster')

    chars, _ = characters()
    eps = {e['id']: e for e in episodes(chars)}
    copy = load_json(os.path.join(HERE, 'copy.json'), {}) or {}
    need = [i for i in ids if i not in copy.get('videos', {})]
    need += [c for i in ids for c in eps.get(i, {}).get('cast', []) if c not in copy.get('characters', {})]
    if need:
        run([sys.executable, 'scripts/wiki/copy_brief.py', '--only-missing'])
        work = tempfile.mkdtemp()  # sol.js reads ./.env first - a project folder's key is revoked
        run(['node', SOL, '--in', os.path.join(HERE, 'work', 'copy-brief.txt'), '--out', os.path.join(HERE, 'work', 'copy-answer.md'),
             '--model', 'gpt-5.6-terra', '--env', KEYS], cwd=work)
        run([sys.executable, 'scripts/wiki/merge_copy.py'])
        say(f'  · fan copy by Terra for {", ".join(need)}')

    out = run([sys.executable, 'scripts/wiki/build.py'])
    missing = [l for l in out.splitlines() if l.startswith('MISSING') and any(i in l for i in ids)]
    if missing:
        raise SystemExit('the build still misses:\n' + '\n'.join(missing))
    say('  · built: ' + next((l for l in out.splitlines() if l.startswith('wiki.json')), 'wiki.json'))

    # every place each character of the video must reach (SKILL.md step 12) - what can't be done here is reported
    for i in ids:
        for line in places(i, eps.get(i, {}).get('cast', []), {c['id']: c for c in chars}):
            say(line)

    if not deploy:
        say('  · not deployed (--no-deploy)')
        return
    settle()
    # the safe deploy: it pulls Hani's games from live first, so a video publish never puts old game files back
    run([shutil.which('bash') or 'C:/Program Files/Git/bin/bash.exe', 'scripts/deploy.sh'])
    say('  · site deployed')
    run('firebase deploy --only functions:wikiChat --project boostmind-b052c', cwd=os.path.join(ROOT, 'techietech-api'))
    say('  · chat agent deployed (it knows the new videos)')
    live = urllib.request.urlopen(f'{WIKI}data/wiki.json?n={os.getpid()}', timeout=30).read().decode('utf8')
    gone = [i for i in ids if f'"{i}"' not in live]
    if gone:
        raise SystemExit(f'deployed, but the live wiki does not list: {", ".join(gone)}')
    for i in ids:
        say(f'✔ on the Shlomiverse: {WIKI}#/v/{i}')


if __name__ == '__main__':
    main()
