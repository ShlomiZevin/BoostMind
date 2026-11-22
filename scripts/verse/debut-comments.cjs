// The residents in a video comment under it (techietech-api/comments.js debut() - the same code the site runs when a video goes
// up). For videos that went up before it existed. A video whose residents already commented is skipped.
//   node scripts/verse/debut-comments.cjs --last 10 --out c.json     the last 10 videos (not archive): a dry run, saved to c.json
//   node scripts/verse/debut-comments.cjs --post c.json              puts up exactly what c.json holds (after reading it)
//   node scripts/verse/debut-comments.cjs <videoId> [--write]        one video, written at once
//   --again                                                          also videos whose residents already commented (a test run)
// Keys from scripts/design.env (never printed). Each resident = one chain run (~2-6c).
const fs = require('fs');
const path = require('path');
const API = path.join(__dirname, '../../techietech-api');
const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '../design.env'), 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const admin = require(path.join(API, 'node_modules/firebase-admin'));
if (!admin.apps.length) admin.initializeApp({ projectId: 'boostmind-b052c' });
const { FieldValue } = admin.firestore;
const db = admin.firestore();

const put = async (videoId, char, nick, text) => {
  await db.collection('comments').add({ videoId, parentId: null, replyTo: null, uid: null, char, nick, photo: null, text,
    likeCount: 0, replyCount: 0, hidden: false, debut: true, t: FieldValue.serverTimestamp() });
  await db.collection('videoStats').doc(videoId).set({ comments: FieldValue.increment(1) }, { merge: true });
};
const arg = (args, k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);

(async () => {
  const args = process.argv.slice(2), write = args.includes('--write'), n = +(arg(args, '--last') || 0), outFile = arg(args, '--out'), postFile = arg(args, '--post');
  if (postFile) {   // exactly the texts that were read
    for (const x of JSON.parse(fs.readFileSync(postFile, 'utf8'))) {
      const dup = await db.collection('comments').where('videoId', '==', x.videoId).where('char', '==', x.char).get();
      if (!dup.empty) { console.log('already there', x.videoId, x.char); continue; }
      await put(x.videoId, x.char, x.nick, x.text);
      console.log('posted', x.videoId, x.nick);
    }
    process.exit(0);
  }
  const skip = new Set([outFile, postFile].filter(Boolean));
  let ids = args.filter((a) => !a.startsWith('--') && !/^\d+$/.test(a) && !skip.has(a));
  if (n) {
    const all = (await db.collection('catalogVideos').get()).docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((v) => !v.hidden && !v.archive).sort((a, b) => String(b.t || b.date).localeCompare(String(a.t || a.date)));
    ids = all.slice(0, n).map((v) => v.id);
  }
  const cur = await require(path.join(API, 'wiki'))._canon();
  const comments = require(path.join(API, 'comments'));
  let total = 0;
  const saved = [];
  for (const id of ids) {
    const video = { id, ...(await db.collection('catalogVideos').doc(id).get()).data() };
    const there = (await db.collection('comments').where('videoId', '==', id).get()).docs.map((d) => d.data());
    if (!args.includes('--again') && there.some((c) => c.char && (video.cast || []).includes(c.char))) { console.log(`\n=== ${id} - its residents already commented, skipped`); continue; }
    const tw = (await db.collection('catalogTranscripts').doc(id).get()).data() || {};
    console.log(`\n=== ${id} | ${video.title} | cast: ${(video.cast || []).join(', ')} | ${there.length} comments there`);
    const r = await comments.debut({ key: env.OPENAI_API_KEY, akey: env.ANTHROPIC_API_KEY || null, cur, video, words: tw.text || '', onScreen: tw.onScreen || '',
      mineOf: (who) => comments.mine(db, who),
      out: async (who, text) => {
        console.log(`${cur.byId[who].name}: ${text}`);
        saved.push({ videoId: id, title: video.title, char: who, nick: cur.byId[who].name, text });
        if (write) await put(id, who, cur.byId[who].name, text);
      } });
    total += r.cost;
  }
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(saved, null, 1));
  console.log(`\n${write ? 'WRITTEN' : 'DRY RUN'} - cost $${total.toFixed(3)}`);
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
