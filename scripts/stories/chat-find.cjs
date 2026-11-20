// Find good conversations with one resident for a chat story (the chat-story skill, zoomcut/skill/chat-story).
//   node scripts/stories/chat-find.cjs <character id> [--days 2] [--min 2] [--out file.md]
//   node scripts/stories/chat-find.cjs --picked [--all] [--out file.md]   the ones he marked "לסטורי" in Backstage (storyPicks,
//                                                                          a copy of the thread), not made yet (--all: also done)
//   node scripts/stories/chat-find.cjs --done <key>                        a pick made into a story (Backstage shows "סטורי נעשה")
// A pick can be a Syncs meeting (since 2026-11-20 - Backstage lists meetings with the conversations): key 'm:<meeting id>', kind
// 'meeting', with the whole meeting copied - who was in it, the visitor (name + the title the meeting gave them), every line with
// its speaker, who muted whom / who left / the visitor's silences, and Amir's wrap-up. The file marks it "KIND: SYNCS MEETING".
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
    if (x.kind === 'meeting' && x.meeting) { txt += meetingText(x); continue; }
    const m = x.msgs || [];
    txt += `## ${x.key} - ${x.mode} - ${m.length} exchanges - ${m[0] ? il(m[0].t) : ''}${x.done ? ' - DONE' : ''}\n`;
    for (const e of m) txt += `V: ${e.q}\nR: ${String(e.a).replace(/\n+/g, ' ')}\n`;
    txt += '\n';
  }
  if (out) { fs.writeFileSync(out, txt); console.log(txt.split('\n')[0], '->', out); } else process.stdout.write(txt);
  process.exit(0);
}
// a Syncs meeting as text: the speakers by name, the moments the page shows (a mute, someone leaving), the wrap-up
const NAMES = { amir: 'אמיר', ofer: 'עופר', daniel: 'דניאל', ronit: 'רונית', gilad: 'גלעד', yaniv: 'יניב' };
function meetingText(x) {
  const M = x.meeting, v = M.visitor || {}, who = (id) => (id === 'user' ? `${v.name || 'המבקר/ת'} (המבקר/ת)` : NAMES[id] || id);
  const out = [`## ${x.key} - KIND: SYNCS MEETING - ${(M.log || []).filter((l) => l.text).length} lines - ${M.t ? il(M.t) : ''}${x.done ? ' - DONE' : ''}`,
    `In the meeting: ${(M.room || []).map(who).join(', ')} + the visitor ${v.name || '?'}${v.title ? ` ("${v.title}")` : ''}${M.ms ? ` · ${Math.max(1, Math.round(M.ms / 60000))} min` : ''}${M.ended ? '' : ' · did not end'}`, ''];
  (M.log || []).forEach((l, i) => {
    const prev = M.log[i - 1];
    if (prev && prev.cut && prev.text && !l.left && !l.silent && prev.who !== 'user') out.push(`   [${who(l.who)} muted ${who(prev.who)}]`);
    if (l.left) out.push(`   [${who(l.who)} left the meeting]`);
    else if (l.silent) out.push('   [the visitor stayed silent - the room went on]');
    else out.push(`${who(l.who)}: ${l.text}${l.cut ? ' —' : ''}`);
  });
  if (M.ended && M.ender) out.push(`   [${who(M.ender)} ended the meeting]`);
  const R = M.recap;
  if (R) {
    out.push('', `WRAP-UP (by ${who(R.by || 'amir')}): ${R.title || ''}`, R.summary || '');
    for (const q of R.points || []) out.push(`- said: ${who(q.who)} - ${q.text}`);
    for (const q of R.items || []) out.push(`- action item: ${who(q.who)} - ${q.text}`);
    if (R.next) out.push(`Next: ${R.next}`);
  }
  return out.join('\n') + '\n\n';
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
