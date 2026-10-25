// One video to YouTube as soon as the channel's daily upload limit opens (tries every 10 min), then the Shorts
// backlog goes on (tools/shorts_backlog.mjs). Uses the project's own post (publish.json: title, caption).
//   node tools/yt_when_open.mjs <project-id> [public|unlisted|private]
// The result goes into the project's publish.json (last.items.youtube) - the Send window shows it.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [id, privacy = 'public'] = process.argv.slice(2);
if (!['public', 'unlisted', 'private'].includes(privacy)) throw new Error('privacy: public | unlisted | private');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const EP = path.join(ROOT, 'episodes', id), FILE = path.join(EP, 'out', `${id}.mp4`), PJ = path.join(EP, 'publish.json');
const pj = JSON.parse(fs.readFileSync(PJ, 'utf8'));
const title = (pj.title || id).slice(0, 100), caption = (pj.caption || '').trim();
const description = /#shorts/i.test(caption) ? caption : `${caption}\n\n#Shorts`.trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function upload() {
  const t = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.YT_CLIENT_ID, client_secret: env.YT_CLIENT_SECRET, refresh_token: env.YT_REFRESH_TOKEN, grant_type: 'refresh_token' }) })).json();
  const size = fs.statSync(FILE).size;
  const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', { method: 'POST',
    headers: { Authorization: `Bearer ${t.access_token}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(size) },
    body: JSON.stringify({ snippet: { title, description, categoryId: '23' }, status: { privacyStatus: privacy, selfDeclaredMadeForKids: false } }) });
  const at = init.headers.get('location');
  if (!at) { const txt = await init.text(); return { limit: /exceeded the number of videos|uploadLimit|quota/i.test(txt), error: txt.slice(0, 200) }; }
  const v = await (await fetch(at, { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(size) }, body: fs.readFileSync(FILE) })).json();
  return v.id ? { v } : { error: JSON.stringify(v).slice(0, 200) };
}

for (;;) {
  console.log(new Date().toISOString(), 'uploading', id, `as ${privacy.toUpperCase()}`);
  const r = await upload();
  if (r.v) {
    console.log('  ✓', `https://youtube.com/shorts/${r.v.id}`, 'uploaded as', r.v.status?.privacyStatus);
    const cur = JSON.parse(fs.readFileSync(PJ, 'utf8'));
    cur.last = { ...(cur.last || {}), items: { ...(cur.last?.items || {}), youtube: { state: 'done', url: `https://youtube.com/shorts/${r.v.id}`, note: `uploaded as ${String(r.v.status?.privacyStatus).toUpperCase()}` } } };
    fs.writeFileSync(PJ, JSON.stringify(cur, null, 2));
    break;
  }
  if (r.limit) { console.log("  YouTube's daily upload limit - trying again in 10 min"); await sleep(10 * 60e3); continue; }
  console.log('  ✗', r.error); process.exit(1);
}
// then the backlog goes on (it waits for the limit too)
console.log('now the Shorts backlog');
spawn(process.execPath, [path.join(ROOT, 'tools', 'shorts_backlog.mjs')], { stdio: 'inherit' }).on('exit', (c) => process.exit(c ?? 0));
