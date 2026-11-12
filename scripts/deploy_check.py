# Runs before EVERY hosting deploy (firebase.json "predeploy" - deploy.sh, a bare `firebase deploy --only hosting`, either
# computer, any session). The rule (his, 2026-11-12, after a deploy from the other computer took ~850 files off the site):
# THE LIVE SITE IS EXACTLY WHAT IS PUSHED TO GIT. Everything the site serves is in git - pictures, videos, sounds, Hani's
# games (no more releasing onto live from outside git) - so any computer that is up to date deploys the whole site.
# It stops the deploy when:
#   - this computer is behind origin/main (git pull first) or ahead of it (git push first - otherwise the next deploy from
#     the other computer, which doesn't have these commits, would take them off the site);
#   - public/ has anything not committed (commit + push first - otherwise the site holds what git doesn't; it is also how
#     another session's draft went live once).
# A preview channel (hosting:channel:deploy) for a draft: SITE_PREVIEW=1 skips the "not committed" part only.
#   python scripts/deploy_check.py
import os, subprocess, sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
git = lambda *a: subprocess.run(['git', *a], cwd=ROOT, capture_output=True, text=True, encoding='utf8')

stops = []
f = git('fetch', '-q', 'origin', 'main')
if f.returncode:
    stops.append('could not reach git (git fetch failed): ' + f.stderr.strip()[:200])
else:
    behind, ahead = git('rev-list', '--left-right', '--count', 'origin/main...HEAD').stdout.split()
    if int(behind):
        stops.append(f'this computer is {behind} commit(s) behind git - run: git pull')
    if int(ahead):
        stops.append(f'this computer has {ahead} commit(s) not pushed - run: git push (the other computer would deploy without them)')
if os.environ.get('SITE_PREVIEW') != '1':
    dirty = [l for l in git('status', '--porcelain', '--untracked-files=all', '--', 'public').stdout.splitlines() if l.strip()]
    if dirty:
        stops.append(f'{len(dirty)} file(s) under public/ are not committed - commit + push them first (or, if they are another session\'s work, ask it):\n'
                     + '\n'.join('    ' + l for l in dirty[:25]) + ('\n    ...' if len(dirty) > 25 else ''))
if stops:
    print('\nDEPLOY STOPPED - the live site must be exactly what is pushed to git:')
    for s in stops:
        print('  - ' + s)
    sys.exit(1)
print('deploy check: up to date with git, public/ committed - the site = git')
