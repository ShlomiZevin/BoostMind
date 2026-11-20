// Find good conversations with one resident for a chat story (the chat-story skill, zoomcut/skill/chat-story).
//   node scripts/stories/chat-find.cjs <character id> [--days 2] [--min 2] [--out file.md]
//   node scripts/stories/chat-find.cjs --picked [--all] [--out file.md]   the ones he marked "לסטורי" in Backstage (storyPicks,
//                                                                          a copy of the thread), not made yet (--all: also done)
//   node scripts/stories/chat-find.cjs --done <key>                        a pick made into a story (Backstage shows "סטורי נעשה")
// Lists every conversation (chat_logs, one thread per `c`) with that resident that had at least --min exchanges and
// ended within the last --days days, longest first, with its date in Israel time. Never prints visitor ids or uids.
const fs = require('fs'), path = require('path');
const admin = require(path.join(__dirname, '..', '..', 'techietech-api', 'node_modules', 'firebase-admin'));
const a = process.argv.slice(2), char = a[0], opt = (k, d) => { const i = a.indexOf(k); return i > 0 ? a[i + 1] : d; };
if (!char) { console.error('usage: chat-find.cjs <character id> [--days 2] [--min 2] [--out file.md]'); process.exit(1); }
const days = +opt('--days', 2), min = +opt('--min', 2), out = opt('--out', '');
admin.initializeApp({ projectId: 'boostmind-b052c' });
async function picked() {
  const col = admin.firestore().collection('storyPicks');
  if (char === '--done') {
    const k = a[1]; if (!k) { console.error('usage: chat-find.cjs --done <key>'); process.exit(1); }
    await col.doc(encodeURIComponent(k)).update({ done: true, doneAt: Date.now() }); console.log('done', k); process.exit(0);
  }
  const snap = await col.get(), all = a.includes('--all');
  const list = snap.docs.map((d) => d.data()).filter((x) => all || !x.done).sort((x, y) => y.t - x.t);
  let txt = `# ${list.length} conversations marked for a story${all ? '' : ' (not made yet)'}\n\n`;
  for (const x of list) {
    const m = x.msgs || [];
    txt += `## ${x.key} - ${x.mode} - ${m.length} exchanges - ${m[0] ? il(m[0].t) : ''}${x.done ? ' - DONE' : ''}\n`;
    for (const e of m) txt += `V: ${e.q}\nR: ${String(e.a).replace(/\n+/g, ' ')}\n`;
    txt += '\n';
  }
  if (out) { fs.writeFileSync(out, txt); console.log(txt.split('\n')[0], '->', out); } else process.stdout.write(txt);
  process.exit(0);
}
const il = (t) => new Date(t).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' });
if (char === '--picked' || char === '--done') picked();
else (async () => {
  const snap = await admin.firestore().collection('chat_logs').where('mode', '==', char).get();
  const by = {};
  for (const d of snap.docs) { const x = d.data(); const k = x.c || 'solo_' + d.id; (by[k] = by[k] || []).push({ t: x.t.toMillis(), q: x.q, a: x.a }); }
  const since = Date.now() - days * 864e5;
  const threads = Object.entries(by).map(([c, m]) => [c, m.sort((x, y) => x.t - y.t)])
    .filter(([, m]) => m.length >= min && m[m.length - 1].t >= since).sort((x, y) => y[1].length - x[1].length);
  let txt = `# ${char}: ${threads.length} conversations with ${min}+ exchanges in the last ${days} days (of ${snap.size} exchanges kept)\n\n`;
  for (const [c, m] of threads) {
    txt += `## ${c} - ${m.length} exchanges - ${il(m[0].t)}\n`;
    for (const e of m) txt += `V: ${e.q}\nR: ${String(e.a).replace(/\n+/g, ' ')}\n`;
    txt += '\n';
  }
  if (out) { fs.writeFileSync(out, txt); console.log(txt.split('\n')[0], '->', out); } else process.stdout.write(txt);
  process.exit(0);
})();
