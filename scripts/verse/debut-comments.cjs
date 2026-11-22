// The residents in a video comment under it (techietech-api/comments.js debut() - the same code the site runs when a video goes
// up). For videos that went up before it existed. A dry run prints the comments; --write puts them up.
//   node scripts/verse/debut-comments.cjs --last 2            the last 2 videos (not archive), dry run
//   node scripts/verse/debut-comments.cjs <videoId> [--write]
// Keys from scripts/design.env (never printed). Each resident = one chain run (~2-4c).
const fs = require('fs');
const path = require('path');
const API = path.join(__dirname, '../../techietech-api');
const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '../design.env'), 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const admin = require(path.join(API, 'node_modules/firebase-admin'));
if (!admin.apps.length) admin.initializeApp({ projectId: 'boostmind-b052c' });
const { FieldValue } = admin.firestore;
const db = admin.firestore();

(async () => {
  const args = process.argv.slice(2), write = args.includes('--write'), n = args.includes('--last') ? +args[args.indexOf('--last') + 1] : 0;
  let ids = args.filter((a) => !a.startsWith('--') && !/^\d+$/.test(a));
  if (n) {
    const all = (await db.collection('catalogVideos').get()).docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((v) => !v.hidden && !v.archive).sort((a, b) => String(b.t || b.date).localeCompare(String(a.t || a.date)));
    ids = all.slice(0, n).map((v) => v.id);
  }
  const cur = await require(path.join(API, 'wiki'))._canon();
  const comments = require(path.join(API, 'comments'));
  let total = 0;
  for (const id of ids) {
    const video = { id, ...(await db.collection('catalogVideos').doc(id).get()).data() };
    const tw = (await db.collection('catalogTranscripts').doc(id).get()).data() || {};
    const there = await db.collection('comments').where('videoId', '==', id).get();
    console.log(`\n=== ${id} | ${video.title} | cast: ${(video.cast || []).join(', ')} | ${there.size} comments there`);
    const r = await comments.debut({ key: env.OPENAI_API_KEY, akey: env.ANTHROPIC_API_KEY || null, cur, video, words: tw.text || '', onScreen: tw.onScreen || '',
      mineOf: (who) => comments.mine(db, who),
      out: async (who, text) => {
        console.log(`${cur.byId[who].name}: ${text}`);
        if (!write) return;
        await db.collection('comments').add({ videoId: id, parentId: null, replyTo: null, uid: null, char: who, nick: cur.byId[who].name, photo: null, text,
          likeCount: 0, replyCount: 0, hidden: false, debut: true, t: FieldValue.serverTimestamp() });
        await db.collection('videoStats').doc(id).set({ comments: FieldValue.increment(1) }, { merge: true });
      } });
    total += r.cost;
  }
  console.log(`\n${write ? 'WRITTEN' : 'DRY RUN'} - cost $${total.toFixed(3)}`);
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
