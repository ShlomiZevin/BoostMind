// The Shlomiverse wiki's content -> live in seconds, no deploy: node scripts/wiki/push.cjs [--dry]
//
// Run after scripts/wiki/build.py. It uploads to Google Cloud Storage (project boostmind-b052c, his own Google login on
// this PC - the same credentials scripts/wiki/analytics_check.js uses):
//   public/wiki/v/*, public/wiki/img/c/*   -> gs://shlomiverse-media/wiki/...   only the files that changed (md5)
//   public/wiki/data/wiki.json             -> gs://shlomiverse-media/wiki/data/wiki.json, its media paths made
//                                             absolute (+ ?v=<md5> so a replaced video is never served stale), no-cache
//   techietech-api/wiki-brain.json         -> gs://shlomiverse-private/wiki-brain.json (never public)
// Since 2026-11-05 the list of videos lives in the database (techietech-api/catalog.js): this only ADDS a video the
// catalog doesn't have, uploads the rest as base.json / wiki-base-brain.json, and composes wiki.json + the brain from
// the catalog - a computer that lacks some videos can't take them off the site any more.
// The wiki, the links page and the stats page read wiki.json from the bucket (falling back to the site's own copy),
// and the chat agent (techietech-api/wiki.js) reads its brain from the private bucket within a few minutes.
// So a new video, character or profile line = build.py + this; the site's code is deployed only when the code changes.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('../../techietech-api/node_modules/firebase-admin');
const { compose } = require('../../techietech-api/catalog.js');

const ROOT = path.resolve(__dirname, '..', '..');
const WIKI = path.join(ROOT, 'public', 'wiki');
const MEDIA = 'shlomiverse-media';
const PRIVATE = 'shlomiverse-private';
const BASE = `https://storage.googleapis.com/${MEDIA}/wiki/`;
const dry = process.argv.includes('--dry');

admin.initializeApp({ projectId: 'boostmind-b052c' });
const storage = admin.storage();
const md5 = (buf) => crypto.createHash('md5').update(buf).digest('base64');
const TYPES = { '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' };

// The guard (his ask, 2026-11-05): a build on a computer missing something must not take it off the live site. Videos
// can't leave any more (the catalog only adds; a video leaves only by versePublish op=hide). A character missing from
// this build's base stops the push and is listed; meant to: --allow-drop=<id>,<id> (or --allow-drop=all).
async function guardCharacters(bucket, base) {
  const [buf] = await bucket.file('wiki/data/base.json').download().catch(() => [null]);
  if (!buf) return;
  const live = JSON.parse(buf.toString('utf8'));
  const arg = (process.argv.find((a) => a.startsWith('--allow-drop=')) || '').slice(13).split(',').filter(Boolean);
  const now = new Set(base.characters.map((c) => c.id));
  const gone = live.characters.map((c) => c.id).filter((id) => !now.has(id) && !arg.includes('all') && !arg.includes(id));
  if (!gone.length) return;
  console.error(`
  STOP - this push would take ${gone.length} character(s) off the live site: ${gone.join(', ')}
  Taking them off on purpose: node scripts/wiki/push.cjs --allow-drop=${gone.join(',')}
`);
  process.exit(2);
}

// Two computers (his ask, 2026-11-05): a computer that didn't pull would push old profiles / copy over the newer ones
function guardBehind() {
  const { execSync } = require('child_process');
  const git = (a) => execSync('git ' + a, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  try { git('fetch -q origin'); } catch { console.log('  ! could not reach git - pushing without the up-to-date check'); return; }
  const behind = +git('rev-list --count HEAD..@{u}');
  if (!behind) return;
  console.error(`
  STOP - this computer is ${behind} commit(s) behind git; its wiki would put older profiles live.
  git pull, run build.py again, then push.
`);
  process.exit(2);
}

async function main() {
  const t0 = Date.now();
  guardBehind();
  const bucket = storage.bucket(MEDIA);
  const [remote] = await bucket.getFiles({ prefix: 'wiki/' });
  const have = Object.fromEntries(remote.map((f) => [f.name, f.metadata.md5Hash]));
  const hashes = {};  // 'v/x.mp4' -> md5, for the ?v= in wiki.json

  // 1. media: the videos, posters and character portraits that are new or changed
  let sent = 0, bytes = 0;
  for (const dir of ['v', path.join('img', 'c')]) {
    for (const name of fs.readdirSync(path.join(WIKI, dir))) {
      const rel = path.join(dir, name).replace(/\\/g, '/');
      const file = path.join(WIKI, dir, name);
      const buf = fs.readFileSync(file);
      const h = md5(buf);
      hashes[rel] = h;
      if (have['wiki/' + rel] === h) continue;
      sent++; bytes += buf.length;
      console.log(`  ↑ ${rel} (${(buf.length / 1e6).toFixed(1)} MB)`);
      if (!dry) await bucket.upload(file, { destination: 'wiki/' + rel, resumable: buf.length > 8e6,
        metadata: { contentType: TYPES[path.extname(name).toLowerCase()] || 'application/octet-stream', cacheControl: 'public, max-age=31536000' } });
    }
  }

  // 2. wiki.json with absolute media URLs; last, so it never points at a file that isn't up yet
  const w = JSON.parse(fs.readFileSync(path.join(WIKI, 'data', 'wiki.json'), 'utf8'));
  const missing = [];
  const fix = (o) => {
    if (Array.isArray(o)) return o.map(fix);
    if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, fix(v)]));
    if (typeof o === 'string' && /^(v|img)\/[^\s]+\.(mp4|jpg|jpeg|png|webp)$/i.test(o)) {
      if (!hashes[o]) { missing.push(o); return o; }
      return BASE + o + '?v=' + Buffer.from(hashes[o], 'base64').toString('hex').slice(0, 8);
    }
    return o;
  };
  const out = fix(w);
  // the portraits' originals are git-ignored (zoomcut/characters/*/*.jpg), so a build on a computer without them has no
  // img - the one already in the bucket stays (his ask, 2026-11-05: a laptop build took every face but Asaf's off the site)
  const kept = [];
  for (const c of out.characters) {
    const h = !c.img && have[`wiki/img/c/${c.id}.jpg`];
    if (h) { c.img = BASE + `img/c/${c.id}.jpg?v=` + Buffer.from(h, 'base64').toString('hex').slice(0, 8); kept.push(c.id); }
  }
  if (kept.length) console.log(`  · ${kept.length} portrait(s) not on this computer - kept the live ones`);
  if (missing.length) console.log(`  ! wiki.json names files that aren't in public/wiki: ${missing.join(', ')}`);
  // 3. the videos live in the database (techietech-api/catalog.js, since 2026-11-05) - this push only ADDS a video the
  //    catalog doesn't have yet (the studio's publish and insta-to-verse still come this way until they call versePublish);
  //    it never changes or removes one there (two writers of one list overwrite each other - tzvika-1)
  const brainLocal = JSON.parse(fs.readFileSync(path.join(ROOT, 'techietech-api', 'wiki-brain.json'), 'utf8'));
  const times = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog-local.json'), 'utf8'));
  const bv = Object.fromEntries(brainLocal.videos.map((v) => [v.id, v]));
  const db = admin.firestore();
  const inCatalog = new Set((await db.collection('catalogVideos').select().get()).docs.map((d) => d.id));
  const fresh = out.videos.filter((v) => !inCatalog.has(v.id) && (v.url || /^https:/.test(v.src || '')));
  for (const v of fresh) {
    const { id, ...rest } = v;
    console.log(`  + catalog: ${id} (new video)`);
    if (dry) continue;
    await db.collection('catalogVideos').doc(id).set({ ...rest, t: times[id] || v.date || '', seq: 0, card: bv[id]?.card || v.teaser || '', hidden: false,
      source: v.archive ? 'reel' : v.url ? 'clip' : 'studio', created: admin.firestore.FieldValue.serverTimestamp(), updated: admin.firestore.FieldValue.serverTimestamp() });
    await db.collection('catalogTranscripts').doc(id).set({ text: bv[id]?.transcript || '' });
  }
  const notHere = out.videos.length - fresh.length - out.videos.filter((v) => inCatalog.has(v.id)).length;
  if (notHere) console.log(`  ! ${notHere} video(s) in wiki.json without their file up - not added (run again after the media upload)`);

  // 4. everything else the site and the chat read (characters, series, sites, games) - the base the catalog is composed on
  const base = { ...out, series: out.series.map((s) => ({ ...s, videos: [] })), characters: out.characters.map((c) => ({ ...c, videos: [] })) };
  delete base.videos;
  const baseBrain = { ...brainLocal, characters: brainLocal.characters.map((c) => ({ ...c, videos: [] })) };
  delete baseBrain.videos;
  await guardCharacters(bucket, base);
  const baseJson = Buffer.from(JSON.stringify(base)), brainJson = Buffer.from(JSON.stringify(baseBrain));
  if (have['wiki/data/base.json'] !== md5(baseJson)) { console.log(`  ↑ data/base.json (${base.characters.length} characters, ${base.series.length} series)`); if (!dry) await bucket.file('wiki/data/base.json').save(baseJson, { resumable: false, metadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-cache, max-age=0' } }); }
  else console.log('  · data/base.json unchanged');
  const [bm] = await storage.bucket(PRIVATE).file('wiki-base-brain.json').getMetadata().catch(() => [{}]);
  if (bm.md5Hash !== md5(brainJson)) { console.log(`  ↑ wiki-base-brain.json (${Math.round(brainJson.length / 1024)} KB, private)`); if (!dry) await storage.bucket(PRIVATE).file('wiki-base-brain.json').save(brainJson, { resumable: false, metadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' } }); }
  else console.log('  · wiki-base-brain.json unchanged');

  // 5. the site's wiki.json and the chat's brain, composed from the catalog + the base
  const c = await compose(admin, { dry, base, baseBrain });
  console.log(`  ${dry ? '·' : '↑'} wiki.json + wiki-brain.json from the catalog: ${c.wiki.characters.length} characters, ${c.videos} videos`);

  console.log(`${dry ? 'DRY - nothing sent. ' : ''}pushed ${sent} media file(s), ${(bytes / 1e6).toFixed(1)} MB, in ${((Date.now() - t0) / 1000).toFixed(0)} s` +
    ` - live on the wiki now, the chat within 3 minutes`);
}

main().catch((e) => { console.error('push failed:', e.message); process.exit(1); });
