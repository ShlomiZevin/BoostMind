# Runs before EVERY hosting deploy - firebase.json "predeploy", so from either computer, from any session, even a bare
# `firebase deploy --only hosting`. Why (2026-11-12): the site's files that git never holds (the repo is public) - his face
# as the characters (אופנת חני, the Friedmans, Dorit, the Techy-Tech team), the characters' videos, game sounds - lived only
# on the computer that made them; a deploy from the other one went out without them and the live site lost ~850 files
# overnight. His rule: nothing either computer has or lacks may break the site.
#   1. BACK UP: every git-ignored file under public/ is copied to gs://shlomiverse-private/site-files/ (new or changed only),
#      so they live somewhere that is not a computer.
#   2. BRING: every git-ignored file the live site or the backup has and this computer lacks is downloaded into public/.
#   3. STOP SIGN: if the deploy would still remove more than a few live files (files deleted in git on purpose are the only
#      ones left), it stops and lists them. SITE_DELETE_OK=1 lets a real clean-up through.
# A local copy is never overwritten. To delete a git-ignored file for real: delete it here AND in the backup bucket.
#   python scripts/site_files_guard.py
import base64, hashlib, json, os, subprocess, sys, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
PUB = os.path.join(ROOT, 'public')
HOSTING = 'https://firebasehosting.googleapis.com/v1beta1'
SITE = 'https://boostmind-b052c.web.app'
BUCKET, PREFIX = 'shlomiverse-private', 'site-files/'
SKIP = ('/wiki/v/',)          # firebase.json ignores it: old video copies, the videos live in gs://shlomiverse-media since 2026-10-31
MAX_REMOVED = 15

token = subprocess.run('gcloud auth print-access-token', shell=True, capture_output=True, text=True).stdout.strip()
if not token:
    sys.exit('site_files_guard: no gcloud login on this computer (gcloud auth login) - not deploying blind')
HDR = {'Authorization': 'Bearer ' + token, 'x-goog-user-project': 'boostmind-b052c'}

def req(url, data=None, headers=None, method=None):
    r = urllib.request.Request(url, data=data, headers={**HDR, **(headers or {})}, method=method)
    with urllib.request.urlopen(r, timeout=120) as res:
        return res.read()

def jget(url):
    return json.loads(req(url))

# the live site's files
version = jget(HOSTING + '/sites/boostmind-b052c/releases?pageSize=1')['releases'][0]['version']['name']
live, tok = set(), ''
while True:
    r = jget(f'{HOSTING}/{version}/files?pageSize=1000&pageToken={tok}')
    live |= {f['path'] for f in r.get('files', []) if not f['path'].startswith('/__/')}   # /__/ = Firebase's own
    tok = r.get('nextPageToken')
    if not tok:
        break

# the backup's files (path -> md5, base64 as Cloud Storage gives it)
backup, tok = {}, ''
while True:
    q = urllib.parse.urlencode({'prefix': PREFIX, 'fields': 'items(name,md5Hash),nextPageToken', 'pageToken': tok})
    r = jget(f'https://storage.googleapis.com/storage/v1/b/{BUCKET}/o?{q}')
    backup.update({'/' + o['name'][len(PREFIX):]: o['md5Hash'] for o in r.get('items', [])})
    tok = r.get('nextPageToken')
    if not tok:
        break

def git_ignored(paths):
    """which of these site paths git ignores (NUL-separated bytes: Windows text mode once broke '\\n')"""
    if not paths:
        return set()
    out = subprocess.run(['git', 'check-ignore', '--stdin', '-z'], cwd=ROOT, input='\0'.join('public' + p for p in paths).encode('utf8'),
                         capture_output=True).stdout.decode('utf8')
    return {l[len('public'):] for l in out.split('\0') if l.strip()}

local_ign = subprocess.run(['git', 'ls-files', '--others', '--ignored', '--exclude-standard', '-z', 'public/'], cwd=ROOT, capture_output=True).stdout.decode('utf8')
local_ign = {'/' + p[len('public/'):] for p in local_ign.split('\0') if p and '/.' not in p and '/node_modules/' not in p}
local_ign = {p for p in local_ign if not p.startswith(SKIP)}

def md5(path):
    h = hashlib.md5()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return base64.b64encode(h.digest()).decode()

# 1. back up what this computer has (new or changed)
def up(p):
    local = os.path.join(PUB, p.lstrip('/'))
    if backup.get(p) == md5(local):
        return None
    with open(local, 'rb') as f:
        req(f'https://storage.googleapis.com/upload/storage/v1/b/{BUCKET}/o?uploadType=media&name=' + urllib.parse.quote(PREFIX + p.lstrip('/'), safe=''),
            data=f.read(), headers={'Content-Type': 'application/octet-stream'}, method='POST')
    return p

# 2. bring what this computer lacks - the live copy first, else the backup
def bring(p):
    dest = os.path.join(PUB, p.lstrip('/'))
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if p in live:
        with urllib.request.urlopen(urllib.request.Request(SITE + urllib.parse.quote(p), headers={'Cache-Control': 'no-cache'}), timeout=120) as r:
            data = r.read()
    else:
        data = req(f'https://storage.googleapis.com/storage/v1/b/{BUCKET}/o/' + urllib.parse.quote(PREFIX + p.lstrip('/'), safe='') + '?alt=media')
    with open(dest + '.part', 'wb') as f:
        f.write(data)
    os.replace(dest + '.part', dest)
    return p

lacking = [p for p in (live | set(backup)) if not p.startswith(SKIP) and not os.path.exists(os.path.join(PUB, p.lstrip('/')))]
to_bring = sorted(git_ignored(lacking))
with ThreadPoolExecutor(12) as ex:
    uploaded = [p for p in ex.map(up, sorted(local_ign)) if p]
    brought = list(ex.map(bring, to_bring))

# 3. the stop sign: what this deploy would still take off the live site
removed = sorted(p for p in live if not p.startswith(SKIP) and not os.path.exists(os.path.join(PUB, p.lstrip('/'))))
print(f'site files: live {len(live)} · backed up {len(uploaded)} new/changed (backup holds {len(set(backup) | set(uploaded))}) · '
      f'brought here {len(brought)} · this deploy removes {len(removed)}')
for p in brought[:10]:
    print('  + brought', p)
if len(removed) > MAX_REMOVED and os.environ.get('SITE_DELETE_OK') != '1':
    print(f'\nSTOP: this deploy would take {len(removed)} files off the live site:')
    for p in removed[:40]:
        print('  -', p)
    sys.exit('Not deploying. If they were deleted on purpose, run again with SITE_DELETE_OK=1. Otherwise: git pull, then deploy.')
for p in removed:
    print('  - removes', p)
