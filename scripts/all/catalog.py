"""Everything Shlomi runs, in one list - for his private page /all/.

  python scripts/all/catalog.py       -> techietech-api/catalog.json
  then: firebase deploy --only functions:stats  (from techietech-api/) - the list is served only to his Google account

Every page under public/ is found by itself (title from <title>, date from git or the file); the ones that fit no group
land in "new / unsorted" so nothing gets lost. The rest of the world (other sites, local tools, servers) is EXTRA below.
"""
import glob, io, json, os, re, subprocess, datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PUB = os.path.join(ROOT, 'public')
SITE = 'https://boostmind-b052c.web.app'

GROUPS = [
    ('verse', 'השלומיוורס והרשתות'),
    ('characters', 'אתרי הדמויות'),
    ('tools', 'הכלים שלי'),
    ('wholos', 'Wholos'),
    ('proposals', 'הצעות ללקוחות'),
    ('boostart', 'Boostart'),
    ('personal', 'פרויקטים אישיים, משחקים וטיולים'),
    ('other_sites', 'אתרים אחרים'),
    ('servers', 'שרתים ופונקציות'),
    ('new', 'חדש / לא ממוין'),
]
FOLDER = {
    'links': 'verse', 'wiki': 'verse', 'stats': 'verse', 'all': 'tools', 'micro-comedy': 'verse', 'shlomi-zevin': 'verse',
    'ayelet': 'characters', 'demokratovich': 'characters', 'hindsight': 'characters', 'homo-useless': 'characters',
    'yotamverse': 'characters', 'techietech': 'characters', 'dorit': 'characters', 'ofnat-hani': 'characters',
    'sketch-studio': 'tools', 'karaoke': 'tools', 'storyboard': 'tools', 'noam-leads': 'tools',
    'wholos': 'wholos', 'wholos-app': 'wholos', 'matzav': 'wholos', 'matzav-app': 'wholos', 'marketing-hub': 'wholos',
    'brand-strip': 'wholos', 'uploads': 'wholos', 'meeting-sergio': 'wholos', 'trial-options': 'wholos', 'wellbeing': 'wholos',
    'boostart': 'boostart', 'bancs-ogen': 'proposals', 'claude-guide': 'proposals',
    'mundial': 'personal', 'party': 'personal', 'kabai': 'personal', 'stop-game': 'personal', 'gps-game': 'personal',
    'gps-live': 'personal', 'breathe': 'personal', 'corfu': 'personal', 'sicilia': 'personal', 'humblo': 'personal',
    'room-designer': 'personal', 'eyeloveyou-chat': 'personal', 'rotem': 'personal', 'young-schema': 'personal',
    'tzach-cv': 'personal', 'aspect-insights': 'personal', 'thegapper': 'personal', 'webrtc-tv-poc': 'personal',
}
PROPOSAL = re.compile(r'שלומי זוין|נועם זוין|Shlomi Zovin|Shlomi Zevin|CTO as a Service|הצעה|הצעת')

EXTRA = [
    # the Shlomiverse and his socials
    ('verse', 'TikTok', 'https://www.tiktok.com/@shlomizevin', 'רשת'),
    ('verse', 'Instagram', 'https://www.instagram.com/shlomizevin', 'רשת'),
    ('verse', 'YouTube', 'https://www.youtube.com/@shlomizevin', 'רשת'),
    ('verse', 'Facebook', 'https://www.facebook.com/shazbak/', 'רשת'),
    ('verse', 'X', 'https://x.com/ShlomiZevin', 'רשת'),
    ('verse', 'תמונת פרופיל (סטודיו)', SITE + '/links/shlomi.jpg', 'תמונה'),
    ('verse', 'תמונת פרופיל ישנה', SITE + '/links/profile.jpg', 'תמונה'),
    ('verse', 'קאבר פייסבוק', SITE + '/links/img/fb-cover-2x.jpg', 'תמונה'),
    ('characters', 'Techy-Tech (הדומיין שלו)', 'https://techytech.web.app', 'אתר'),
    ('verse', 'שלומידגם - ליל הבחירות', 'https://shlomidgam.web.app', 'אתר'),
    # his tools
    # personal tools - their own repo (c:\workspace\shlomi-tools) and project (shlomi-tools) since 2026-10-31
    ('tools', 'Vault', 'https://shlomi-vault.web.app', 'כספת'),
    ('tools', 'החבושים - הספר', 'https://chavushim.web.app', 'אתר'),
    ('tools', 'shlomi-tools - Firebase console', 'https://console.firebase.google.com/project/shlomi-tools/overview', 'קונסול'),
    ('tools', 'Sketch Studio - העורך', 'http://localhost:4747', 'מקומי'),
    ('tools', 'Karaoke Booth (מקומי)', 'http://localhost:4747/karaoke/', 'מקומי'),
    ('tools', 'הדרופ - העלאת צילומים מהאייפון', 'https://drop-463727469066.me-west1.run.app', 'שרת'),
    ('tools', 'Fleet Command - כל הסשנים', 'http://localhost:5199', 'מקומי'),
    ('tools', 'Firebase console', 'https://console.firebase.google.com/project/boostmind-b052c/overview', 'קונסול'),
    ('tools', 'Google Cloud console', 'https://console.cloud.google.com/home/dashboard?project=boostmind-b052c', 'קונסול'),
    ('tools', 'Firestore', 'https://console.firebase.google.com/project/boostmind-b052c/firestore', 'קונסול'),
    # Boostart - his freelance work, its own repo (c:\workspace\boostart) and project (boostart-pro) since 2026-10-31
    ('boostart', 'Boostart - דף העליי (pro.boostart.io)', 'https://pro.boostart.io/', 'אתר'),
    ('boostart', 'Boostart - ערכת המכרזים הממשלתיים', 'https://pro.boostart.io/gov/', 'אתר'),
    ('boostart', 'Boostart - Firebase console', 'https://console.firebase.google.com/project/boostart-pro/overview', 'קונסול'),
    # other sites
    ('other_sites', 'Trip Planner', 'https://boostart-trips.web.app', 'אתר'),
    ('other_sites', 'Trip Planner - דף משקיעים', 'https://boostart-trips.web.app/invest', 'אתר'),
    ('other_sites', 'Plaxzy (של נועם)', 'https://plaxzy.com', 'אתר'),
    ('other_sites', 'wholos.com', 'https://wholos.com', 'אתר'),
    ('other_sites', 'Wholos - Firebase console (wholos-app, c:\\workspace\\wholos)', 'https://console.firebase.google.com/project/wholos-app/overview', 'קונסול'),
    # servers (Cloud Run / functions on boostmind-b052c)
    ('servers', 'wikiChat - הצ\'אט של הדמויות', 'https://console.cloud.google.com/run/detail/europe-west1/wikichat/metrics?project=boostmind-b052c', 'פונקציה'),
    ('servers', 'track + stats - האנליטיקס', 'https://console.cloud.google.com/run/detail/europe-west1/track/metrics?project=boostmind-b052c', 'פונקציה'),
    ('servers', 'siteLead - טפסים מאתרי הדמויות', 'https://console.cloud.google.com/run/detail/europe-west1/sitelead/metrics?project=boostmind-b052c', 'פונקציה'),
    ('servers', 'techietechApply - קורות חיים לטקי-טק', 'https://console.cloud.google.com/run/detail/europe-west1/techietechapply/metrics?project=boostmind-b052c', 'פונקציה'),
    ('servers', 'drop', 'https://console.cloud.google.com/run/detail/me-west1/drop/metrics?project=boostmind-b052c', 'שרת'),
    ('servers', 'trip-chat', 'https://console.cloud.google.com/run/detail/me-west1/trip-chat/metrics?project=boostmind-b052c', 'שרת'),
    ('servers', 'workout-ai', 'https://console.cloud.google.com/run/detail/me-west1/workout-ai/metrics?project=boostmind-b052c', 'שרת'),
    ('servers', 'כל השירותים ב-Cloud Run', 'https://console.cloud.google.com/run?project=boostmind-b052c', 'קונסול'),
]


def git_date(path):
    try:
        out = subprocess.run(['git', 'log', '-1', '--format=%cs', '--', path], cwd=ROOT, capture_output=True, text=True).stdout.strip()
        if out:
            return out
    except Exception:
        pass
    return datetime.date.fromtimestamp(os.path.getmtime(path)).isoformat()


def main():
    items, folder_group = [], {}
    pages = sorted(glob.glob(os.path.join(PUB, '**', '*.html'), recursive=True))
    # a folder's group comes from its main page; its demos and extra pages follow it
    pages.sort(key=lambda p: not p.endswith(os.sep + 'index.html') or os.path.relpath(p, PUB).count(os.sep) > 1)
    for p in pages:
        rel = os.path.relpath(p, PUB).replace(os.sep, '/')
        if '/node_modules/' in rel or (rel.startswith('wiki/') and rel != 'wiki/index.html'):
            continue
        head = io.open(p, encoding='utf8', errors='ignore').read(5000)
        m = re.search(r'<title>(.*?)</title>', head, re.S)
        title = re.sub(r'\s+', ' ', m.group(1)).strip() if m else rel
        folder = rel.split('/')[0]
        group = FOLDER.get(folder) or folder_group.get(folder) or ('wholos' if folder.startswith('marketing') else 'proposals' if PROPOSAL.search(title) else 'new')
        folder_group.setdefault(folder, group)
        url = SITE + '/' + (rel[:-len('index.html')] if rel.endswith('index.html') else rel)
        sub = rel.split('/')[-1]
        tag = 'ניהול' if 'admin' in sub else 'דמו' if '/demo/' in rel else ''
        items.append({'g': group, 'title': title, 'url': url, 'tag': tag, 'date': git_date(p)})
    for g, title, url, tag in EXTRA:
        items.append({'g': g, 'title': title, 'url': url, 'tag': tag, 'date': ''})
    out = {'built': datetime.datetime.now().isoformat(timespec='minutes'), 'groups': [{'id': g, 'title': t} for g, t in GROUPS], 'items': items}
    dst = os.path.join(ROOT, 'techietech-api', 'catalog.json')
    with open(dst, 'w', encoding='utf8') as f:
        json.dump(out, f, ensure_ascii=False, indent=0)
    counts = {}
    for i in items:
        counts[i['g']] = counts.get(i['g'], 0) + 1
    print('catalog.json:', len(items), 'items', counts)


if __name__ == '__main__':
    main()
