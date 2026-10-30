// Put game folders on the live site WITHOUT a full `firebase deploy` (this PC's BoostMind clone is old and would
// overwrite the site). Copies the live hosting version, adds/replaces only /hani-games/<slug>/ files, releases it.
// Stops if someone else releases in between. Sets Cache-Control: no-cache on /hani-games/** (players always get the newest files).   node tools/deploy-onto-live.js nisei-nissim ketoret [--dry]
//   --soon        only each game's card (game.json with status "soon" + cover.jpg) - for the games page's "בקרוב"
//   --hub=FILE    also put FILE as /hani-games/index.html (the games page; start from the live one)
//   --page=/path/in/site=FILE   also put FILE at that site path (start from the live page; owner is another session)
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto'), { execSync } = require('child_process');
const SITE = 'boostmind-b052c', API = 'https://firebasehosting.googleapis.com/v1beta1/';
const ROOT = path.join(__dirname, '..'), args = process.argv.slice(2), dry = args.includes('--dry');
const games = args.filter(a => !a.startsWith('--')), soon = args.includes('--soon'), hub = (args.find(a => a.startsWith('--hub=')) || '').slice(6);
const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
const H = { Authorization: 'Bearer ' + token, 'x-goog-user-project': SITE, 'Content-Type': 'application/json' };
async function api(method, url, body) {
  const r = await fetch(url.startsWith('http') ? url : API + url, { method, headers: H, body: body && JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(method + ' ' + url + ' ' + r.status + ' ' + JSON.stringify(j).slice(0, 400));
  return j;
}
const wait = ms => new Promise(r => setTimeout(r, ms));

// what goes up: index.html, game.js, game.json, cover.jpg, story.json (if any), assets/ without assets/models/
const files = {};
for (const g of games) {
  const D = path.join(ROOT, g), add = (rel, buf) => {
    const gz = zlib.gzipSync(buf || fs.readFileSync(path.join(D, rel)), { level: 9 });
    files[`/hani-games/${g}/${rel.split(path.sep).join('/')}`] = { gz, hash: crypto.createHash('sha256').update(gz).digest('hex') };
  };
  if (soon) {
    const m = JSON.parse(fs.readFileSync(path.join(D, 'game.json'), 'utf8')); m.status = 'soon';
    add('game.json', Buffer.from(JSON.stringify(m, null, 2), 'utf8')); add('cover.jpg'); continue;
  }
  for (const f of ['index.html', 'game.js', 'game.json', 'cover.jpg']) add(f);
  for (const f of ['story.json']) if (fs.existsSync(path.join(D, f))) add(f);   // a game's own data beside its code (יוסף מוקיר שבת's text)
  const walk = d => { for (const e of fs.readdirSync(path.join(D, d), { withFileTypes: true })) { const rel = path.join(d, e.name); if (e.isDirectory()) { if (rel !== path.join('assets', 'models')) walk(rel); } else add(rel); } };
  walk('assets');
}
if (hub) { const gz = zlib.gzipSync(fs.readFileSync(hub), { level: 9 }); files['/hani-games/index.html'] = { gz, hash: crypto.createHash('sha256').update(gz).digest('hex') }; }
if (args.some(a => a.startsWith('--page='))) for (const a of args.filter(a => a.startsWith('--page='))) { const [dest, src] = a.slice(7).split('='); const gz = zlib.gzipSync(fs.readFileSync(src), { level: 9 }); files[dest] = { gz, hash: crypto.createHash('sha256').update(gz).digest('hex') }; }
console.log(Object.keys(files).length, 'files,', Math.round(Object.values(files).reduce((a, f) => a + f.gz.length, 0) / 1024), 'KB gzipped');

(async () => {
  const live = (await api('GET', `sites/${SITE}/releases?pageSize=1`)).releases[0];
  console.log('live release', live.name, live.version.name);
  if (dry) return;
  let op = await api('POST', `sites/${SITE}/versions:clone`, { sourceVersion: live.version.name, finalize: false });
  while (!op.done) { await wait(2000); op = await api('GET', op.name); }
  if (op.error) throw new Error(JSON.stringify(op.error));
  const ver = op.response.name; console.log('cloned into', ver);
  // every load checks for a new version (no-cache = revalidate by ETag; an unchanged file is a tiny 304) - only under /hani-games
  { const v = await api('GET', ver), cfg = v.config || {}, hs = (cfg.headers || []).filter((h) => h.glob !== '/hani-games/**');
    hs.push({ glob: '/hani-games/**', headers: { 'Cache-Control': 'no-cache' } });
    await api('PATCH', `${ver}?update_mask=config`, { config: { ...cfg, headers: hs } }); console.log('headers: /hani-games/** no-cache'); }
  const pop = await api('POST', `${ver}:populateFiles`, { files: Object.fromEntries(Object.entries(files).map(([p, f]) => [p, f.hash])) });
  const need = new Set(pop.uploadRequiredHashes || []);
  console.log('uploading', need.size);
  for (const f of Object.values(files)) if (need.has(f.hash)) {
    const r = await fetch(pop.uploadUrl + '/' + f.hash, { method: 'POST', headers: { Authorization: H.Authorization, 'x-goog-user-project': SITE, 'Content-Type': 'application/octet-stream' }, body: f.gz });
    if (!r.ok) throw new Error('upload ' + r.status); need.delete(f.hash);
  }
  await api('PATCH', `${ver}?update_mask=status`, { status: 'FINALIZED' });
  const now = (await api('GET', `sites/${SITE}/releases?pageSize=1`)).releases[0];
  if (now.name !== live.name) throw new Error('someone released meanwhile (' + now.name + ') - not releasing; run again');
  const rel = await api('POST', `sites/${SITE}/releases?versionName=${ver}`, { message: 'hani-games: ' + games.join(', ') });
  console.log('released', rel.name);
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
