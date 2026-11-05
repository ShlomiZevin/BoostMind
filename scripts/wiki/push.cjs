// The Shlomiverse wiki's content -> live in seconds, no deploy: node scripts/wiki/push.cjs [--dry]
//
// Run after scripts/wiki/build.py. Since 2026-11-05 evening the site is composed ONLY from the database (his rule: "two
// computers must never break the site - content can't come from git"); this script is a computer's way of telling the
// database what ITS files changed - never a copy of the computer's whole view:
//   1. git: a computer behind git stops here (its files are older than what's live)
//   2. files: public/wiki/v/* and public/wiki/img/c/* -> gs://shlomiverse-media/wiki/..., only a file that is different AND
//      newer than the live one (a computer with an older portrait / video never puts it back)
//   3. videos: a video the catalog doesn't have yet is ADDED (the catalog only grows; versePublish op=hide takes one off)
//   4. characters, series, games, sites: scripts/wiki/records.json -> versePublish op=sync, three-way per field
//      (techietech-api/content.js): only the fields these files changed since they last reached the database are
//      written; something this computer lacks is never removed or blanked; an edit made through the API stays
//   5. the site (wiki.json) and the chat's brain are composed again from the database, on the server
// Every change lands in catalogLog with this computer's name: `node scripts/verse/content.mjs log` shows who changed what.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const admin = require('../../techietech-api/node_modules/firebase-admin');

const ROOT = path.resolve(__dirname, '..', '..');
const WIKI = path.join(ROOT, 'public', 'wiki');
const MEDIA = 'shlomiverse-media';
const API = 'https://europe-west1-boostmind-b052c.cloudfunctions.net/versePublish';
const dry = process.argv.includes('--dry');
const BY = `${os.hostname()} push.cjs${process.env.MIND_SESSION ? ' ' + process.env.MIND_SESSION.slice(0, 8) : ''}`;

admin.initializeApp({ projectId: 'boostmind-b052c' });
const md5 = (buf) => crypto.createHash('md5').update(buf).digest('base64');
const TYPES = { '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

function key() {
  const env = path.join(ROOT, 'zoomcut', '.env');
  const m = fs.existsSync(env) && fs.readFileSync(env, 'utf8').match(/^VERSE_PUBLISH_KEY=(.+)$/m);
  if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  return execSync('gcloud secrets versions access latest --secret=VERSE_PUBLISH_KEY --project=boostmind-b052c', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
}
async function api(body) {
  const r = await fetch(API, { method: 'POST', headers: { authorization: 'Key ' + key(), 'content-type': 'application/json' }, body: JSON.stringify({ by: BY, ...body }) });
  const j = await r.json().catch(() => ({ error: 'http ' + r.status }));
  if (!r.ok || j.error) throw new Error(`versePublish ${body.op} ${body.kind || ''}: ${j.error || r.status}${j.detail ? ' - ' + j.detail : ''}`);
  return j;
}

// Two computers (his ask, 2026-11-05): a computer that didn't pull would send older profiles / copy
function guardBehind() {
  const git = (a) => execSync('git ' + a, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  try { git('fetch -q origin'); } catch { console.log('  ! could not reach git - pushing without the up-to-date check'); return; }
  const behind = +git('rev-list --count HEAD..@{u}');
  if (!behind) return;
  console.error(`
  STOP - this computer is ${behind} commit(s) behind git; its wiki would send older profiles.
  git pull, run build.py again, then push.
`);
  process.exit(2);
}

async function main() {
  const t0 = Date.now();
  guardBehind();
  const bucket = admin.storage().bucket(MEDIA);
  const [remote] = await bucket.getFiles({ prefix: 'wiki/' });
  const live = Object.fromEntries(remote.map((f) => [f.name, { md5: f.metadata.md5Hash, t: +(f.metadata.metadata?.mtime || 0) || Date.parse(f.metadata.updated) }]));

  // 1. files: different AND newer than the live one
  let sent = 0, bytes = 0, older = [];
  const upped = new Set(Object.keys(live));
  for (const dir of ['v', path.join('img', 'c')]) {
    if (!fs.existsSync(path.join(WIKI, dir))) continue;
    for (const name of fs.readdirSync(path.join(WIKI, dir))) {
      const rel = path.join(dir, name).replace(/\\/g, '/'), file = path.join(WIKI, dir, name);
      const buf = fs.readFileSync(file), was = live['wiki/' + rel], mtime = Math.round(fs.statSync(file).mtimeMs);
      if (was && was.md5 === md5(buf)) continue;
      if (was && mtime <= was.t) { older.push(rel); continue; }
      sent++; bytes += buf.length; upped.add('wiki/' + rel);
      console.log(`  ↑ ${rel} (${(buf.length / 1e6).toFixed(1)} MB)${was ? ' - newer than the live one' : ''}`);
      if (!dry) await bucket.upload(file, { destination: 'wiki/' + rel, resumable: buf.length > 8e6,
        metadata: { contentType: TYPES[path.extname(name).toLowerCase()] || 'application/octet-stream', cacheControl: 'public, max-age=31536000', metadata: { mtime: String(mtime), by: BY } } });
    }
  }
  if (older.length) console.log(`  · ${older.length} file(s) here are older than the live ones - kept the live ones (${older.slice(0, 6).join(', ')}${older.length > 6 ? ', ...' : ''})`);

  // 2. videos the catalog doesn't have yet - ADDED (the studio / insta-to-verse use versePublish directly; this catches the rest)
  const w = JSON.parse(fs.readFileSync(path.join(WIKI, 'data', 'wiki.json'), 'utf8'));
  const brain = JSON.parse(fs.readFileSync(path.join(ROOT, 'techietech-api', 'wiki-brain.json'), 'utf8'));
  const times = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog-local.json'), 'utf8'));
  const bv = Object.fromEntries(brain.videos.map((v) => [v.id, v]));
  const db = admin.firestore();
  const inCatalog = new Set((await db.collection('catalogVideos').select().get()).docs.map((d) => d.id));
  let fresh = 0;
  for (const v of w.videos.filter((x) => !inCatalog.has(x.id))) {
    if (!v.url && !upped.has(`wiki/v/${v.id}.mp4`)) continue;   // its file isn't up (an older copy kept, or no file)
    console.log(`  + video: ${v.id} (new)`);
    fresh++;
    if (dry) continue;
    await api({ op: 'video', id: v.id, title: v.title, teaser: v.teaser, cast: v.cast, series: v.series, date: v.date, t: times[v.id] || undefined,
      ...(v.url ? { url: v.url, poster: v.poster } : {}), ...(v.archive ? { archive: true, ig: v.ig } : {}), card: bv[v.id]?.card || undefined, transcript: bv[v.id]?.transcript || '' });
  }

  // 3. characters, series, games, sites - three-way per field on the server
  const records = JSON.parse(fs.readFileSync(path.join(__dirname, 'records.json'), 'utf8'));
  let changes = 0;
  for (const [kind, items] of [['series', records.series], ['character', records.characters], ['game', records.games], ['site', records.sites]]) {
    const r = await api({ op: 'sync', kind, items, noCompose: true, dryRun: dry });
    changes += r.added.length + r.changed.length;
    for (const a of r.added) console.log(`  + ${kind}: ${a} (new)`);
    for (const c of r.changed) console.log(`  ~ ${kind} ${c}`);
    for (const s of r.skipped) console.log(`  ! ${kind} skipped: ${s}`);
  }

  // 4. the site and the chat, composed on the server from the database
  if (!dry && (changes || fresh || sent)) { const c = await api({ op: 'rebuild' }); console.log(`  ↑ the site + the chat composed: ${c.characters} characters, ${c.videos} videos`); }
  else if (!changes && !fresh && !sent) console.log('  · nothing new from this computer - the site is as it was');
  console.log(`${dry ? 'DRY - nothing sent. ' : ''}${sent} file(s), ${(bytes / 1e6).toFixed(1)} MB, ${fresh} new video(s), ${changes} record change(s), in ${((Date.now() - t0) / 1000).toFixed(0)} s` +
    (dry ? '' : ' - live on the wiki now, the chat within 3 minutes'));
}

main().catch((e) => { console.error('push failed:', e.message); process.exit(1); });
