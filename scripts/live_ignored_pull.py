# Run before EVERY hosting deploy (scripts/deploy.sh does it): the site's files that git never holds - his face (Hani's
# pictures in אופנת חני, the Friedmans, Dorit, the Techy-Tech team), videos, game sounds - exist only on the computer that
# made them. A deploy from the other computer (or a fresh clone) went out without them and the live site lost ~850 files
# overnight (2026-11-12: אופנת חני's picture, the links page, every site's portraits). His rule: nothing either computer
# has or lacks may break the site.
# So: every live file that is missing here AND that git ignores is downloaded from the live site into public/ first. The
# set only grows - a deploy can no longer drop a file just because this computer never had it. Files in git are not
# touched (deleting one of those on purpose still deletes it); a local copy is never overwritten.
#   python scripts/live_ignored_pull.py
import json, os, subprocess, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
API = 'https://firebasehosting.googleapis.com/v1beta1'
SITE = 'https://boostmind-b052c.web.app'

token = subprocess.run('gcloud auth print-access-token', shell=True, capture_output=True, text=True).stdout.strip()
HDR = {'Authorization': 'Bearer ' + token, 'x-goog-user-project': 'boostmind-b052c'}

def api(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=HDR), timeout=60) as r:
        return json.load(r)

version = api(API + '/sites/boostmind-b052c/releases?pageSize=1')['releases'][0]['version']['name']
live, tok = [], ''
while True:
    r = api(f'{API}/{version}/files?pageSize=1000&pageToken={tok}')
    live += [f['path'] for f in r.get('files', [])]
    tok = r.get('nextPageToken')
    if not tok:
        break

missing = [p for p in live if not p.startswith('/__/') and not os.path.exists(os.path.join(ROOT, 'public', p.lstrip('/')))]   # /__/ = Firebase's own
ignored = []
if missing:
    # which of them git ignores (the ones only a computer holds) - one call for all; NUL-separated bytes (Windows text
    # mode turned '\n' into '\r\n' and git matched only the last path)
    out = subprocess.run(['git', 'check-ignore', '--stdin', '-z'], cwd=ROOT, input='\0'.join('public' + p for p in missing).encode('utf8'),
                         capture_output=True).stdout.decode('utf8')
    ignored = [l[len('public'):] for l in out.split('\0') if l.strip()]

def get(p):
    dest = os.path.join(ROOT, 'public', p.lstrip('/'))
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    url = SITE + urllib.parse.quote(p)
    with urllib.request.urlopen(urllib.request.Request(url, headers={'Cache-Control': 'no-cache'}), timeout=120) as r, open(dest + '.part', 'wb') as f:
        f.write(r.read())
    os.replace(dest + '.part', dest)
    return p

with ThreadPoolExecutor(12) as ex:
    done = list(ex.map(get, ignored))
print(f'live: {len(live)} files · missing here: {len(missing)} · brought from live (git-ignored): {len(done)}')
for p in done[:20]:
    print('  +', p)
if len(done) > 20:
    print(f'  ... and {len(done) - 20} more')
