// His finished videos -> YouTube Shorts, released one a day by YouTube itself: each is uploaded PRIVATE with a
// scheduled publishAt (19:00 Israel). A new Google app can upload ~6 videos a day (quota), so the run uploads what it
// can, waits for the quota to come back (checks every 30 min) and goes on - resumable: a plan file keeps what went up.
//   node tools/shorts_backlog.mjs --dry      the plan, nothing uploaded
//   node tools/shorts_backlog.mjs            upload (keep the PC on; run again any time - it skips what's up)
// Keys: zoomcut/.env YT_* (never printed). Plan + results: zoomcut/work/shorts-backlog.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EPS = path.join(ROOT, 'episodes'), PLAN = path.join(ROOT, 'work', 'shorts-backlog.json');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const DRY = process.argv.includes('--dry');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LINKS = 'כל הקישורים: https://boostmind-b052c.web.app/links/';
const TAGS = {
  techy: '#טקיטק #הייטק #AI #מערכון #קומדיה',
  ayelet: '#איילתהשחר #תודעהגבוהה #רוחניות #מערכון #קומדיה',
  demo: '#דמוקרטוביץ #בחירות #סאטירה #מערכון #קומדיה',
};
// in the order he made them (each series keeps its sequence), one a day from Oct 25
const VIDEOS = [
  ['agentic-sync', 'סנכרון אסטרטגי | AI', TAGS.techy],
  ['follow-up', 'סנכרון אסטרטגי | פגישת המשך', TAGS.techy],
  ['tadar-3', 'איילת השחר – תודעה גבוהה', TAGS.ayelet],
  ['ronit-joins', 'סנכרון אסטרטגי | יישור קו', TAGS.techy],
  ['news-1', 'חדשות הערב', '#חדשות #סאטירה #מערכון #קומדיה'],
  ['security-1', 'סיקיוריטי שבור', TAGS.techy],
  ['tadar-4', 'איילת השחר – שאלות ותשובות', TAGS.ayelet],
  ['gym-1', 'המכון – הבלונים של סיגל', '#חדרכושר #מערכון #קומדיה'],
  ['genz-1', "מחשבות של ג'ן זי – בקופה", '#גןזי #GenZ #מערכון #קומדיה'],
  ['yuval-1', 'Yuval Know All Harari – Homo Useless', '#HomoUseless #AI #מערכון #קומדיה'],
  ['tadar-5', 'איילת השחר – פסיכולוגיה, פסיכיאטריה ותודעה גבוהה', TAGS.ayelet],
  ['crypto-1', 'גורו הקריפטו – המטבע של אתמול', '#קריפטו #ביטקוין #מערכון #קומדיה'],
  ['gilad-joins', 'סנכרון אסטרטגי | עדכון לגלעד', TAGS.techy],
  ['tadar-6', 'איילת השחר – בחירות ובחירה חופשית', TAGS.ayelet],
  ['demokratovich-shut', 'הרב דמוקרטוביץ – שו״ת הלכות בחירות', TAGS.demo],
  ['demokratovich-songs-he', 'הרב דמוקרטוביץ – מחרוזת שירי הבחירות', TAGS.demo],
];
// 19:00 Israel; Israel is on winter time (UTC+2) from Oct 25 2026, so 17:00 UTC
const releaseAt = (i) => new Date(Date.UTC(2026, 9, 25 + i, 17, 0, 0)).toISOString();

const plan = fs.existsSync(PLAN) ? JSON.parse(fs.readFileSync(PLAN, 'utf8')) : {};
const save = () => { fs.mkdirSync(path.dirname(PLAN), { recursive: true }); fs.writeFileSync(PLAN, JSON.stringify(plan, null, 2)); };
const items = VIDEOS.map(([id, title, tags], i) => ({ id, title, description: `${tags} #Shorts\n\n${LINKS}`, publishAt: plan[id]?.publishAt && plan[id].publishAt !== 'now' ? plan[id].publishAt : releaseAt(i), file: path.join(EPS, id, 'out', `${id}.mp4`) }));
for (const it of items) {
  if (!fs.existsSync(it.file)) throw new Error('missing ' + it.file);
  // (a date already in the plan wins - a schedule moved by a reschedule stays)
  plan[it.id] = { ...(plan[it.id] || {}), title: it.title, publishAt: plan[it.id]?.publishAt || it.publishAt };
}
save();
if (DRY) { for (const it of items) console.log(it.publishAt, '|', it.id, '|', it.title, '|', plan[it.id].videoId ? 'UP ' + plan[it.id].videoId : 'to upload'); process.exit(0); }

async function token() {
  const t = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.YT_CLIENT_ID, client_secret: env.YT_CLIENT_SECRET, refresh_token: env.YT_REFRESH_TOKEN, grant_type: 'refresh_token' }) })).json();
  if (!t.access_token) throw new Error('YouTube key: ' + (t.error_description || t.error));
  return t.access_token;
}
async function upload(it) {
  const T = await token(), size = fs.statSync(it.file).size;
  const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', { method: 'POST',
    headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(size) },
    body: JSON.stringify({ snippet: { title: it.title, description: it.description, categoryId: '23', defaultLanguage: 'iw' },
      status: { privacyStatus: 'private', publishAt: it.publishAt, selfDeclaredMadeForKids: false } }) });
  const at = init.headers.get('location');
  if (!at) { const t = await init.text(); const e = new Error(t.slice(0, 300)); e.quota = /quota|uploadLimit|rateLimit/i.test(t); throw e; }
  const r = await fetch(at, { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(size) }, body: fs.readFileSync(it.file) });
  const v = await r.json().catch(() => ({}));
  if (!v.id) { const e = new Error(JSON.stringify(v).slice(0, 300)); e.quota = /quota|uploadLimit|rateLimit/i.test(JSON.stringify(v)); throw e; }
  return v;
}

for (const it of items) {
  if (plan[it.id].videoId) continue;
  for (;;) {
    try {
      console.log(new Date().toISOString(), 'uploading', it.id, `(${Math.round(fs.statSync(it.file).size / 1048576)} MB) → release ${it.publishAt}`);
      const v = await upload(it);
      plan[it.id] = { ...plan[it.id], videoId: v.id, privacy: v.status?.privacyStatus, scheduled: v.status?.publishAt || null, uploadedAt: new Date().toISOString() };
      save();
      console.log('  ✓', v.id, 'privacy', v.status?.privacyStatus, 'releases', v.status?.publishAt);
      break;
    } catch (e) {
      if (e.quota) { console.log('  daily upload limit reached - trying again in 30 min'); await sleep(30 * 60e3); continue; }
      console.log('  ✗', it.id, e.message); plan[it.id].error = e.message; save(); break;
    }
  }
}
console.log('done:', items.filter((it) => plan[it.id].videoId).length, 'of', items.length, 'uploaded');
