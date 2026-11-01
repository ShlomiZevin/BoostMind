// The Shlomiverse wiki's content -> live in seconds, no deploy: node scripts/wiki/push.cjs [--dry]
//
// Run after scripts/wiki/build.py. It uploads to Google Cloud Storage (project boostmind-b052c, his own Google login on
// this PC - the same credentials scripts/wiki/analytics_check.js uses):
//   public/wiki/v/*, public/wiki/img/c/*   -> gs://shlomiverse-media/wiki/...   only the files that changed (md5)
//   public/wiki/data/wiki.json             -> gs://shlomiverse-media/wiki/data/wiki.json, its media paths made
//                                             absolute (+ ?v=<md5> so a replaced video is never served stale), no-cache
//   techietech-api/wiki-brain.json         -> gs://shlomiverse-private/wiki-brain.json (never public)
// The wiki, the links page and the stats page read wiki.json from the bucket (falling back to the site's own copy),
// and the chat agent (techietech-api/wiki.js) reads its brain from the private bucket within a few minutes.
// So a new video, character or profile line = build.py + this; the site's code is deployed only when the code changes.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('../../techietech-api/node_modules/firebase-admin');

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

async function main() {
  const t0 = Date.now();
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
  if (missing.length) console.log(`  ! wiki.json names files that aren't in public/wiki: ${missing.join(', ')}`);
  const json = Buffer.from(JSON.stringify(out));
  if (have['wiki/data/wiki.json'] !== md5(json)) {
    console.log(`  ↑ data/wiki.json (${w.characters.length} characters, ${w.videos.length} videos)`);
    if (!dry) await bucket.file('wiki/data/wiki.json').save(json, { resumable: false,
      metadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-cache, max-age=0' } });
  } else console.log('  · data/wiki.json unchanged');

  // 3. the chat agent's brain, private
  const brainFile = path.join(ROOT, 'techietech-api', 'wiki-brain.json');
  const brain = fs.readFileSync(brainFile);
  const [meta] = await storage.bucket(PRIVATE).file('wiki-brain.json').getMetadata().catch(() => [{}]);
  if (meta.md5Hash !== md5(brain)) {
    console.log(`  ↑ wiki-brain.json (${Math.round(brain.length / 1024)} KB, private)`);
    if (!dry) await storage.bucket(PRIVATE).file('wiki-brain.json').save(brain, { resumable: false,
      metadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-store' } });
  } else console.log('  · wiki-brain.json unchanged');

  console.log(`${dry ? 'DRY - nothing sent. ' : ''}pushed ${sent} media file(s), ${(bytes / 1e6).toFixed(1)} MB, in ${((Date.now() - t0) / 1000).toFixed(0)} s` +
    ` - live on the wiki now, the chat within 3 minutes`);
}

main().catch((e) => { console.error('push failed:', e.message); process.exit(1); });
