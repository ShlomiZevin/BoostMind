// ח24's desk against the Firestore emulator, with the real news and the real AI (tz.js desk()): one call covers the day's
// headlines across the sections and makes each the worst case; the articles go live at once, a second desk skips what the
// first covered. Writes the articles to TZ_OUT (Hebrew - read it with the Read tool) so a person can judge the tone.
//   cd v2 && firebase emulators:exec --project demo-shlomiverse --only firestore "node ../techietech-api/test/tz-desk.emu.mjs"
import assert from 'node:assert';
import fs from 'node:fs';
import { createRequire } from 'node:module';

process.env.FUNCTIONS_EMULATOR = 'true';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-shlomiverse';
if (!process.env.VERSE_OPENAI_KEY) {
  const env = fs.readFileSync(new URL('../../scripts/design.env', import.meta.url), 'utf8');
  process.env.VERSE_OPENAI_KEY = /OPENAI_API_KEY=(.+)/.exec(env)[1].trim().replace(/^["']|["']$/g, '');
}
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const tz = require('../tz.js');
const db = admin.firestore();
const OUT = process.env.TZ_OUT || 'tz-desk.md';

await db.collection('verseMeta').doc('tz').set({ img: false, silent: null });
const t0 = Date.now();
const r = await tz._desk('manual', 6);
console.log('desk', JSON.stringify(r), `${Math.round((Date.now() - t0) / 1000)}s`);
if (r.bad) { console.log('ok  a bad day - ח24 is silent (', r.why, ')'); process.exit(0); }
assert(r.articles > 0, 'the desk wrote nothing');
const arts = (await db.collection('tzArticles').where('run', '==', r.run).get()).docs.map((d) => d.data()).sort((a, b) => b.t.toMillis() - a.t.toMillis());
assert(arts.every((a) => a.status === 'live' && a.t && a.desk && !a.post), 'live at once, no ציפציפ post');
const run = (await db.collection('tzRuns').doc(r.run).get()).data();
console.log(`ok  ${arts.length} articles · sections: ${arts.map((a) => a.tag).join(', ')} · tokens ${run.uCh.join('/')}`);
assert(new Set(arts.map((a) => a.src.url)).size === arts.length, 'one article per story');

const r2 = await tz._desk('manual', 3);
const urls2 = (await db.collection('tzArticles').where('run', '==', r2.run || '-').get()).docs.map((d) => d.data().src.url);
assert(!urls2.some((u) => arts.some((a) => a.src.url === u)), 'the second desk skips what the first covered');
console.log(`ok  a second desk: ${r2.articles} new stories, none covered twice`);

fs.writeFileSync(OUT, arts.map((a) => `## [${a.tag}] ${a.headline}\n_${a.sub}_\n\nמקור: ${a.src.src} - ${a.src.title}\n\n${a.body.join('\n\n')}\n\nציוץ: ${a.post || '-'}\n`).join('\n---\n'));
console.log('ok  written to', OUT);
process.exit(0);
