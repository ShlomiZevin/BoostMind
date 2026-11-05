// The content in the database (content.js) end to end on the local emulators (project demo-shlomiverse - nothing live):
//   python scripts/wiki/build.py   (records.json + wiki.json + the brain of THIS computer - the real data)
//   cd v2 && firebase emulators:exec --project demo-shlomiverse --only auth,firestore,functions,storage "node ../techietech-api/test/content.emu.mjs"
// 1. the real records synced in, the site composed from the database = what build.py made (the same site, same chat)
// 2. the rules: the same files again change nothing; an API edit survives a sync of unchanged files; a real file edit
//    goes through; a computer missing a character / a bio / a portrait takes nothing off; hide / show; the log.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FN = 'http://127.0.0.1:5001/demo-shlomiverse/europe-west1/versePublish';
const KEY = process.env.VERSE_PUBLISH_KEY || 'local-publish';
const MEDIA = 'shlomiverse-media', PRIV = 'shlomiverse-private';
const admin = createRequire(import.meta.url)('../node_modules/firebase-admin');
admin.initializeApp({ projectId: 'demo-shlomiverse' });
const db = admin.firestore();
const call = async (body) => { const r = await fetch(FN, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Key ' + KEY }, body: JSON.stringify({ by: 'test', ...body }) }); const j = await r.json(); return j; };
const ok = (m) => console.log('ok  ' + m);
const getObj = async (b, n) => JSON.parse((await admin.storage().bucket(b).file(n).download())[0].toString('utf8'));
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

const records = read('scripts/wiki/records.json'), built = read('public/wiki/data/wiki.json'), brainBuilt = read('techietech-api/wiki-brain.json');
const times = read('scripts/wiki/catalog-local.json');

// what is already live elsewhere: the portraits (files) and the videos (the catalog)
for (const c of built.characters.filter((c) => c.img)) await admin.storage().bucket(MEDIA).file(`wiki/img/c/${c.id}.jpg`).save(Buffer.from('face ' + c.id), { resumable: false, metadata: { contentType: 'image/jpeg' } });
const bw = Object.fromEntries(brainBuilt.videos.map((v) => [v.id, v]));
let batch = db.batch(), n = 0;
for (const [i, v] of built.videos.entries()) {
  const { id, ...rest } = v;
  batch.set(db.collection('catalogVideos').doc(id), { ...rest, t: times[id] || v.date || '', seq: i, card: bw[id]?.card || '', hidden: false });
  batch.set(db.collection('catalogTranscripts').doc(v.id), { text: bw[v.id]?.transcript || '' });
  if (++n % 200 === 0) { await batch.commit(); batch = db.batch(); }
}
await batch.commit();

// 1. the real records in, the site out
const sync = async (kind, items) => call({ op: 'sync', kind, items, noCompose: true });
for (const [kind, items] of [['series', records.series], ['character', records.characters], ['game', records.games], ['site', records.sites]]) {
  const r = await sync(kind, items);
  assert.ok(r.ok, kind + ' ' + JSON.stringify(r).slice(0, 300));
  assert.equal(r.added.length, items.length, `${kind}: every record added (${r.added.length}/${items.length}) ${JSON.stringify(r.skipped)}`);
}
assert.ok((await call({ op: 'rebuild' })).ok);
const w = await getObj(MEDIA, 'wiki/data/wiki.json'), b = await getObj(PRIV, 'wiki-brain.json');
const strip = (c) => ({ ...c, img: !!c.img });
assert.deepStrictEqual(w.characters.map(strip), built.characters.map(strip), 'the characters, in the same order, with the same faces');
assert.deepStrictEqual(w.series, built.series, 'the series');
assert.deepStrictEqual(w.sites, built.sites, 'the site cards');
assert.deepStrictEqual(w.site_list, built.site_list, 'the sites list');
assert.deepStrictEqual(w.games, built.games, 'the games');
assert.deepStrictEqual(w.videos.map((v) => v.id), built.videos.map((v) => v.id), 'the videos');
assert.deepStrictEqual(b.worlds, brainBuilt.worlds, 'the chat: worlds');
assert.deepStrictEqual(b.characters, brainBuilt.characters, 'the chat: characters');
assert.deepStrictEqual(b.sites, brainBuilt.sites, 'the chat: sites');
assert.deepStrictEqual(b.games, brainBuilt.games, 'the chat: games');
ok(`the site composed from the database = build.py's: ${w.characters.length} characters, ${w.series.length} series, ${w.games.length} games, ${w.site_list.length} sites, ${w.videos.length} videos; the chat too`);

// 2. the rules
const again = await sync('character', records.characters);
assert.deepStrictEqual([again.added.length, again.changed.length], [0, 0], 'the same files again change nothing');
ok('the same files again: nothing changes');

const osnat = records.characters.find((c) => c.id === 'osnat');
assert.ok((await call({ op: 'put', kind: 'character', id: 'osnat', tagline: 'נכתב דרך ה-API' })).ok);
await sync('character', records.characters);
assert.equal((await call({ op: 'get', kind: 'character', id: 'osnat' })).tagline, 'נכתב דרך ה-API', 'an API edit survives a sync of unchanged files');
ok('an edit through the API survives another computer syncing its unchanged files');

const edited = records.characters.map((c) => (c.id === 'osnat' ? { ...c, tagline: 'נערך בקבצים' } : c));
const e = await sync('character', edited);
assert.deepStrictEqual(e.changed, ['osnat: tagline'], 'a real file edit goes through: ' + JSON.stringify(e));
ok('a real edit in the files goes through (only that field)');

const lacking = edited.filter((c) => c.id !== 'hani').map((c) => (c.id === 'yotam' ? { ...c, bio: '', relations: [] } : c));
const l = await sync('character', lacking);
assert.deepStrictEqual(l.changed, [], 'nothing blanked: ' + JSON.stringify(l));
await call({ op: 'rebuild' });
const w2 = await getObj(MEDIA, 'wiki/data/wiki.json');
const yotam = w2.characters.find((c) => c.id === 'yotam'), hani = w2.characters.find((c) => c.id === 'hani');
assert.ok(hani && hani.img, 'a character missing from a computer stays, with its face');
assert.ok(yotam.bio && yotam.relations.length, 'a bio / relations missing on a computer are not blanked');
assert.equal(w2.characters.filter((c) => c.img).length, built.characters.filter((c) => c.img).length, 'every face stays (portraits are files in the bucket)');
ok('a computer missing a character, a bio, relations or portraits takes nothing off the site');

assert.equal((await call({ op: 'put', kind: 'character', id: 'new-guy' })).error, 'missing', 'a new character needs a name');
assert.ok((await call({ op: 'put', kind: 'character', id: 'new-guy', name: 'חדש', series: 'techytech', role: 'בדיקה' })).created);
let w3 = await getObj(MEDIA, 'wiki/data/wiki.json');
assert.ok(w3.characters.some((c) => c.id === 'new-guy') && w3.series.find((s) => s.id === 'techytech').characters.includes('new-guy'), 'a new character through the API is on the site and in its series');
await call({ op: 'hide', kind: 'character', id: 'new-guy' });
w3 = await getObj(MEDIA, 'wiki/data/wiki.json');
assert.ok(!w3.characters.some((c) => c.id === 'new-guy'), 'hidden = off the site');
await call({ op: 'hide', kind: 'character', id: 'new-guy', hidden: false });
w3 = await getObj(MEDIA, 'wiki/data/wiki.json');
assert.ok(w3.characters.some((c) => c.id === 'new-guy'), 'shown again');
ok('a new character through the API; hide / show');

const cl = await call({ op: 'put', kind: 'character', id: 'new-guy', clear: ['role'] });
assert.deepStrictEqual(cl.changed, ['role']);
assert.equal((await call({ op: 'put', kind: 'character', id: 'new-guy', role: '' })).changed.length, 0, 'an empty value in a put never blanks');
ok('blanking only through clear');

const log = await call({ op: 'log', kind: 'character', id: 'osnat' });
assert.ok(log.log.length >= 2 && log.log.every((x) => x.by === 'test') && log.log.some((x) => x.op === 'put' && x.before.tagline), 'the log: who, what, the value before');
ok('every change is in the log with who and the value before');

const bad = await call({ op: 'sync', kind: 'planet', items: [] });
assert.equal(bad.error, 'kind');
console.log('content: all good');
process.exit(0);
