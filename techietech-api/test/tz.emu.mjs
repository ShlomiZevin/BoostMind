// ציפציפ + ח24's engine against the Firestore emulator, with the real news and the real AI (tz.js): one run writes posts and
// articles, they go live spread over the window, the timeline / thread / profile / front page read them back, a report
// hides a post at the third, the owner ops list them. Writes what the residents wrote to TZ_OUT (Hebrew - read it with the
// Read tool) so a person can judge the voices.
//   cd v2 && firebase emulators:exec --project demo-shlomiverse --only firestore "node ../techietech-api/test/tz.emu.mjs"
//   (scripts/test.sh passes the OpenAI key from scripts/design.env as VERSE_OPENAI_KEY)
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
const OUT = process.env.TZ_OUT || 'tz-run.md';

await db.collection('verseMeta').doc('tz').set({ img: false, auto: true, silent: null });
const heads = await tz._headlines();
console.log(`ok  ${heads.length} headlines from the news sites`);
assert(heads.length > 5, 'the RSS feeds gave almost nothing');

const r = await tz._run('morning');
console.log('run', JSON.stringify(r));
if (r.bad) { console.log('ok  a bad day - nobody posts (', r.why, ')'); process.exit(0); }
assert(r.made > 0, 'the run wrote nothing');
const posts = (await db.collection('tzPosts').where('run', '==', r.run).get()).docs.map((d) => d.data()).sort((a, b) => a.t.toMillis() - b.t.toMillis());
const arts = (await db.collection('tzArticles').where('run', '==', r.run).get()).docs.map((d) => d.data());
assert(posts.every((p) => p.status === 'live' && p.t), 'auto: every post is live with a time');
assert(posts.every((p) => !p.parent || posts.some((q) => q.id === p.parent)), 'every reply has its parent in the run');
const span = posts.at(-1).t.toMillis() - posts[0].t.toMillis();
console.log(`ok  ${posts.length} posts + ${arts.length} articles, spread over ${Math.round(span / 60e3)} minutes`);
const run = (await db.collection('tzRuns').doc(r.run).get()).data();
console.log(`ok  candidates (the algorithm): ${run.cands.join(', ')}  ·  tokens tz ${run.u.join('/')}  ch24 ${run.uCh.join('/')}`);

// the reports: the third hides the post, the owner sees them
const target = posts.find((p) => p.by !== 'charadot') || posts[0];
for (const n of [1, 2, 3]) await db.collection('tzReports').doc(`${target.id}_u${n}`).set({ post: target.id, uid: 'u' + n, open: true, t: admin.firestore.Timestamp.now() });
const list = await tz.owner('tzList', {});
assert(list.posts.length >= posts.length && list.runs.some((x) => x.id === r.run), 'tzList shows the run');
const rep = await tz.owner('tzReports', {});
assert(rep.reports.length === 3, 'tzReports lists the three');
await tz.owner('tzResolve', { id: target.id, keep: true });
assert((await tz.owner('tzReports', {})).reports.length === 0, 'resolving closes them');
console.log('ok  owner ops: list, reports, resolve');

// what a person should read: the run as it would show
const name = (p) => (p.by === 'charadot' ? 'ח24' : p.by);
const lines = [`# ציפציפ - run ${r.run} (${new Date().toISOString().slice(0, 16)})`, '', `candidates: ${run.cands.join(', ')}`, `why: ${run.why}`, ''];
for (const a of arts) lines.push(`## ח24: ${a.headline}`, `_${a.sub}_ · [${a.tag}] · source: ${a.src && a.src.src} - ${a.src && a.src.title}`, '', ...a.body.map((b) => `> ${b}`), '');
lines.push('## the timeline', '');
for (const p of posts) lines.push(`${p.parent ? '    ↳ ' : ''}**${name(p)}**${p.quote ? ' (quotes ח24)' : ''}${p.link ? ` [link: ${p.link.src}]` : ''}: ${p.text}`);
fs.writeFileSync(OUT, lines.join('\n'));
console.log('ok  written to', OUT);
process.exit(0);
