// What's marked in the archive (shlomiverse.com/archive/) and not brought yet - read-only, straight from Firestore with
// this computer's Google login (no owner key). The insta-to-verse session reads it when he says "bring what I marked".
//   node scripts/insta/wishes.mjs            -> the open wishes, most-asked first: ig id, n, permalink
//   node scripts/insta/wishes.mjs --json out.json
// A wish closes by itself once ig-<id> is in the verse (verseAutoAnnounce, every 15 minutes), telling whoever asked.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../../techietech-api/package.json', import.meta.url));
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'boostmind-b052c' });
const snap = await admin.firestore().collection('wishes').where('done', '==', false).get();
const open = (await Promise.all(snap.docs.filter((d) => (d.data().n || 0) > 0).map(async (d) => {
  const w = d.data();
  // what the people who asked wrote with it (wishes/<ig>/notes/<uid>) - e.g. which character, why
  const notes = (await d.ref.collection('notes').get()).docs.map((x) => x.data().text || x.data().note).filter(Boolean);
  return { ig: d.id, n: w.n, permalink: w.permalink || null, t: w.t?.toDate?.().toISOString() || null, notes };
}))).sort((a, b) => b.n - a.n || String(a.t).localeCompare(String(b.t)));
const i = process.argv.indexOf('--json');
if (i > -1) fs.writeFileSync(process.argv[i + 1], JSON.stringify(open, null, 1));
else for (const w of open) console.log(w.ig, w.n, w.permalink || '', w.notes.length ? '| ' + w.notes.join(' | ') : '');
console.log(open.length, 'open');
process.exit(0);
