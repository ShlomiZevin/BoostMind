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
import json, os, shutil, subprocess, sys, tempfile, urllib.request

from canon import HERE, ROOT, ZC, characters, episodes, load_json

STUDIO = 'http://localhost:4747'
SOL = os.path.expanduser('~/.claude/skills/sol-leonardo/scripts/sol.js')
KEYS = 'C:/workspace/aspect/aspect-agent-server/.env'  # the working OpenAI key (BoostMind's own is revoked)
WIKI = 'https://boostmind-b052c.web.app/wiki/'


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

    # Techy-Tech people need a card on the company site (written by hand: a corporate bio, a headshot)
    site = open(os.path.join(ROOT, 'public', 'techietech', 'index.html'), encoding='utf8').read()
    world = {c['id']: c for c in chars}
    for i in ids:
        for cid in eps.get(i, {}).get('cast', []):
            c = world.get(cid, {})
            if c.get('world') == 'טקי-טק' and f"id: '{cid}'" not in site:
                say(f'  ! {c.get("name", cid)} works at Techy-Tech but has no card on the company site - add it (SKILL.md step 12)')

    if not deploy:
        say('  · not deployed (--no-deploy)')
        return
    run('firebase deploy --only hosting --project boostmind-b052c')
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
