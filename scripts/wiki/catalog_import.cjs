// One time (2026-11-05): today's live wiki -> the catalog (techietech-api/catalog.js). Copies exactly what visitors see:
// every video of the live wiki.json (with its live media addresses), its words and chat card from the live chat brain,
// its sort time from scripts/wiki/catalog-local.json (build.py), and the rest (characters, series, sites, games) into
// base.json / wiki-base-brain.json. Then it composes the wiki from the database and checks it equals the live one.
//   node scripts/wiki/catalog_import.cjs            check only (compose dry, compare, nothing written)
//   node scripts/wiki/catalog_import.cjs --write    write the catalog + base files, compose dry again, compare
// It never overwrites a record that is already in the catalog.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const admin = require('../../techietech-api/node_modules/firebase-admin');
const { compose, MEDIA, PRIVATE } = require('../../techietech-api/catalog.js');

admin.initializeApp({ projectId: 'boostmind-b052c' });
const write = process.argv.includes('--write');
const read = async (bucket, name) => JSON.parse((await admin.storage().bucket(bucket).file(name).download())[0].toString('utf8'));

(async () => {
  const db = admin.firestore();
  const live = await read(MEDIA, 'wiki/data/wiki.json'), brain = await read(PRIVATE, 'wiki-brain.json');
  const times = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog-local.json'), 'utf8'));
  const bv = Object.fromEntries(brain.videos.map((v) => [v.id, v]));
  const base = { ...live, videos: undefined, series: live.series.map((s) => ({ ...s, videos: [] })), characters: live.characters.map((c) => ({ ...c, videos: [] })) };
  delete base.videos;
  const baseBrain = { ...brain, characters: brain.characters.map((c) => ({ ...c, videos: [] })) };
  delete baseBrain.videos;
  const missingT = live.videos.filter((v) => !times[v.id]).map((v) => v.id);
  if (missingT.length) console.log('no sort time (their date is used):', missingT.join(', '));
  const have = new Set((await db.collection('catalogVideos').select().get()).docs.map((d) => d.id));
  let added = 0;
  if (write) {
    let batch = db.batch(), n = 0;
    for (const [i, v] of live.videos.entries()) {
      if (have.has(v.id)) continue;
      const { id, ...rest } = v;
      batch.set(db.collection('catalogVideos').doc(id), { ...rest, t: times[id] || v.date || '', seq: i, card: bv[id]?.card || v.teaser || '', hidden: false,
        source: v.archive ? 'reel' : v.url ? 'clip' : 'studio', created: admin.firestore.FieldValue.serverTimestamp(), updated: admin.firestore.FieldValue.serverTimestamp() });
      batch.set(db.collection('catalogTranscripts').doc(id), { text: bv[id]?.transcript || '' });
      added++;
      if (++n >= 200) { await batch.commit(); batch = db.batch(); n = 0; }
    }
    if (n) await batch.commit();
    await admin.storage().bucket(MEDIA).file('wiki/data/base.json').save(Buffer.from(JSON.stringify(base)), { resumable: false, metadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'no-cache, max-age=0' } });
    await admin.storage().bucket(PRIVATE).file('wiki-base-brain.json').save(Buffer.from(JSON.stringify(baseBrain)), { resumable: false, metadata: { contentType: 'application/json; charset=utf-8' } });
    console.log(`catalog: ${added} added (${have.size} were there), base.json + wiki-base-brain.json written`);
  }
  if (!write && !have.size) { console.log(`(nothing in the catalog yet - ${live.videos.length} videos would be imported; run with --write)`); return; }
  // the proof: the wiki composed from the database = the live one
  const out = await compose(admin, { dry: true });
  assert.deepStrictEqual(out.wiki.videos.map((v) => v.id), live.videos.map((v) => v.id), 'the same videos, in the same order');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(out.wiki)), live, 'the composed wiki.json equals the live one');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(out.brain)), brain, 'the composed chat brain equals the live one');
  console.log(`ok - composed from the database: ${out.videos} videos, wiki.json and the chat brain identical to what is live`);
})().catch((e) => { console.error('FAILED', e.message.slice(0, 2000)); process.exit(1); });
