# Run before EVERY hosting deploy from this repo (scripts/deploy.sh does it for you): the Hani games are released by
# another session (on another machine) straight onto the live site - it clones the live version and adds
# /hani-games/<slug>/ - so this folder never has its newest game files, and a deploy from public/ would put old copies back.
# This brings every file of every game folder in the current live release into public/hani-games/<slug>/.
# The site page itself (index.html, img/, audio/, video/, sounds/) is ours and is never pulled.
#
# Fast: the Hosting API gives each live file's hash. .firebase/hani-pull-cache.json remembers, per file, the live hash
# and the local sha256 from the last pull - a file is downloaded only when the live one changed, the local copy is
# missing, or someone edited the local copy since.
#   python scripts/hani_games_pull.py
import hashlib, json, os, subprocess, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CACHE = os.path.join(ROOT, '.firebase', 'hani-pull-cache.json')
API = 'https://firebasehosting.googleapis.com/v1beta1'
SITE = 'https://boostmind-b052c.web.app'
OURS = ('/hani-games/img/', '/hani-games/audio/', '/hani-games/video/', '/hani-games/sounds/')

token = subprocess.run('gcloud auth print-access-token', shell=True, capture_output=True, text=True).stdout.strip()
HDR = {'Authorization': 'Bearer ' + token, 'x-goog-user-project': 'boostmind-b052c'}

def api(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=HDR), timeout=60) as r:
        return json.load(r)

def sha(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()

version = api(API + '/sites/boostmind-b052c/releases?pageSize=1')['releases'][0]['version']['name']
print('live:', version)
live, tok = {}, ''
while True:
    r = api(f'{API}/{version}/files?pageSize=1000&pageToken={tok}')
    for f in r.get('files', []):
        p = f['path']
        if p.startswith('/hani-games/') and p.count('/') >= 3 and not p.startswith(OURS):
            live[p] = f['hash']
    tok = r.get('nextPageToken', '')
    if not tok:
        break

try:
    cache = json.load(open(CACHE, encoding='utf8'))
except (OSError, ValueError):
    cache = {}

def local(p):
    return os.path.join(ROOT, 'public', *p.strip('/').split('/'))

def needs(p):
    c, f = cache.get(p), local(p)
    return not c or c['live'] != live[p] or not os.path.isfile(f) or sha(f) != c['local']

def pull(p):
    f = local(p)
    with urllib.request.urlopen(urllib.request.Request(SITE + urllib.request.quote(p), headers={'Cache-Control': 'no-cache'}), timeout=60) as r:
        data = r.read()
    old = open(f, 'rb').read() if os.path.isfile(f) else None
    if old != data:
        os.makedirs(os.path.dirname(f), exist_ok=True)
        open(f, 'wb').write(data)
    cache[p] = {'live': live[p], 'local': hashlib.sha256(data).hexdigest()}
    return p if old != data else None

todo = [p for p in live if needs(p)]
failed = []
with ThreadPoolExecutor(16) as ex:
    futs = {p: ex.submit(pull, p) for p in todo}
    updated = []
    for p, fu in futs.items():
        try:
            if fu.result():
                updated.append(p)
        except Exception as e:
            failed.append(p)
            print('FAIL', p, e)
for p in updated:
    print('updated', p)
os.makedirs(os.path.dirname(CACHE), exist_ok=True)
json.dump(cache, open(CACHE, 'w', encoding='utf8'))
print(f'game files: {len(live)} live, {len(todo)} downloaded, {len(updated)} updated')
sys.exit(1 if failed else 0)
