// Backstage → שיחות (2026-11-12, his ask): his comments on the characters' conversations, when he reviews them from time to
// time - what he didn't like, or a question. On the whole conversation or on one answer. Nothing acts on them by itself: he
// opens a session ("read my comments, let's discuss"), they discuss, then handle (scripts/wiki/chat-notes.mjs).
// The comment keeps a copy of what it is on (the message + the thread's log ids), so it outlives the chat log's 90 days.
// Private: Firestore `chatNotes` (no client rule = nobody reads it). Called only from verseOwner (his key):
// ops chatNotes, chatMark, chatNote, chatNoteDone, chatNoteEdit, chatNoteDel, chatThread (a key 'm:<id>' = a Syncs meeting).
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

const db = () => admin.firestore();
const idOk = (s) => /^[A-Za-z0-9]{6,40}$/.test(String(s || ''));
const charOk = (s) => /^[a-z0-9][a-z0-9-]{0,60}$/.test(String(s || ''));
const clip = (s, n) => String(s ?? '').slice(0, n);
const ms = (t) => (t && t.toMillis ? t.toMillis() : null);
const row = (d) => ({ id: d.id, ...d.data(), t: ms(d.data().t), edited: ms(d.data().edited) });

// ---------- Syncs meetings as conversations (his ask 2026-11-20: "eventually it's just a conversation") ----------
// A meeting (meeting-fn.js, Firestore meetings/<id>) is one conversation in שיחות, key 'm:<id>', mode 'syncs'. It takes the same
// marks as a chat (star, good / bad, comments, לסטורי). A marked meeting is kept a year (a meeting alone lives 7 days), so the
// Voice session (chat-notes.mjs) and the chat-story skill (chat-find.cjs --picked) still find it later.
const MEET_KEY = /^m:([A-Za-z0-9]{3,30})$/;
const meetIdOf = (k) => (MEET_KEY.exec(String(k || '')) || [])[1] || '';
// what Backstage and the scripts get: who was in it, the visitor, every line (mute = a cut line followed by the next speaker, left,
// the visitor's silence), the wrap-up, the cost - never the owner's uid beyond what Backstage already knows (people list)
function meetingOut(d) {
  const x = d.data() || {}, room = x.all || x.room || [];
  return { id: d.id, t: ms(x.t), uid: x.uid || '', room, left: x.left || [],
    visitor: { name: (x.visitor || {}).name || '', title: (x.visitor || {}).title || '', photo: (x.visitor || {}).photo || '' },
    log: (x.log || []).map((l) => (l.left ? { who: l.who, left: true } : l.silent ? { who: l.who, silent: true } : { who: l.who, text: l.text || '', cut: !!l.cut, ...(l.hand ? { hand: true } : {}) })),
    recap: x.recap || null, ended: !!x.ended, ender: x.ended ? (room.includes('gilad') ? 'gilad' : 'amir') : null,   // meeting.js ender()
    shared: !!x.shared, ms: x.ms || 0, cost: x.cost || 0, kept: !!x.kept, preview: x.uid === 'preview' };
}
async function meetingGet(id) {
  if (!/^[A-Za-z0-9]{3,30}$/.test(String(id || '')) || id === 'demo') return null;
  const d = await db().collection('meetings').doc(id).get();
  return d.exists && d.data().uid !== 'demo' ? meetingOut(d) : null;
}
// marked = kept a year (never shortens a longer keep)
async function keepMeeting(key) {
  const id = meetIdOf(key);
  if (!id || id === 'demo') return;
  const ref = db().collection('meetings').doc(id), x = (await ref.get()).data();
  if (!x || x.uid === 'demo') return;
  const exp = Date.now() + 365 * 864e5;
  if (!x.exp || x.exp.toMillis() < exp - 864e5) await ref.update({ exp: admin.firestore.Timestamp.fromMillis(exp), kept: true });
}

async function owner(op, b) {
  const notes = db().collection('chatNotes');
  if (op === 'chatNotes') {   // every comment + the good / bad marks (the tab's one call)
    const [n, m] = await Promise.all([notes.orderBy('t', 'desc').limit(1500).get(), db().collection('owner').doc('chatMarks').get()]);
    return { notes: n.docs.map(row), marks: (m.data() || {}).m || {} };
  }
  // a quick mark on a conversation (his ask 2026-11-12): v 'good' | 'bad', '' takes it off. owner/chatMarks {m: {threadKey: v}}
  if (op === 'chatMark') {
    const k = clip(b.key, 90);
    if (!k || !['good', 'bad', ''].includes(b.v)) return { error: 'mark' };
    await db().collection('owner').doc('chatMarks').set({ m: { [k]: b.v ? b.v : FieldValue.delete() } }, { merge: true });
    if (b.v) await keepMeeting(k).catch((e) => console.error('keep meeting', e.message));
    return { ok: true };
  }
  // a comment. key = the thread's key in Backstage; c = the conversation's id; msg = the answer's log id ('' = the whole
  // conversation); q / a = a copy of that message; ids = the thread's log ids. by 'claude' = a session's answer (reply = the
  // comment it answers - closes it)
  if (op === 'chatNote') {
    const text = clip(String(b.text || '').trim(), 6000);
    if (!text) return { error: 'empty' };
    const by = b.by === 'claude' ? 'claude' : 'shlomi';
    if (by === 'claude' && !idOk(b.reply)) return { error: 'reply' };
    const d = { key: clip(b.key, 90), c: clip(b.c, 12), mode: charOk(b.mode) ? b.mode : clip(b.mode, 40), msg: idOk(b.msg) ? b.msg : '',
      q: clip(b.q, 1500), a: clip(b.a, 4000), at: Number(b.at) || null, ids: (Array.isArray(b.ids) ? b.ids : []).filter(idOk).slice(0, 60),
      text, by, reply: by === 'claude' ? b.reply : null, done: by === 'claude', t: FieldValue.serverTimestamp() };
    const ref = await notes.add(d);
    if (by === 'shlomi') await keepMeeting(d.key).catch((e) => console.error('keep meeting', e.message));
    if (by === 'claude') await notes.doc(b.reply).update({ done: true }).catch(() => {});
    return { ok: true, id: ref.id };
  }
  if (op === 'chatNoteDone') {   // handled, or open again
    if (!idOk(b.id)) return { error: 'id' };
    await notes.doc(b.id).update({ done: b.done !== false });
    return { ok: true };
  }
  if (op === 'chatNoteEdit') {
    if (!idOk(b.id)) return { error: 'id' };
    const text = clip(String(b.text || '').trim(), 6000);
    if (!text) return { error: 'empty' };
    await notes.doc(b.id).update({ text, edited: FieldValue.serverTimestamp() });
    return { ok: true };
  }
  if (op === 'chatNoteDel') {   // his comment and the answers under it
    if (!idOk(b.id)) return { error: 'id' };
    const kids = await notes.where('reply', '==', b.id).get();
    await Promise.all([notes.doc(b.id).delete(), ...kids.docs.map((d) => d.ref.delete())]);
    return { ok: true };
  }
  // one conversation's messages, wherever it is in time (a comment opens its thread even when the range on screen doesn't hold it)
  if (op === 'chatThread') {
    if (meetIdOf(b.key)) return { chats: [], meeting: await meetingGet(meetIdOf(b.key)) };   // a Syncs meeting: the whole meeting
    const L = db().collection('chat_logs');
    let docs = [];
    if (b.c && /^[A-Za-z0-9]{1,12}$/.test(b.c)) docs = (await L.where('c', '==', b.c).limit(200).get()).docs;
    if (!docs.length && Array.isArray(b.ids)) docs = (await Promise.all(b.ids.filter(idOk).slice(0, 60).map((id) => L.doc(id).get()))).filter((d) => d.exists);
    return { chats: docs.map((x) => { const c = x.data(); delete c.exp; return { id: x.id, ...c, t: ms(c.t) }; }) };
  }
  return null;
}

module.exports = { owner, meetingOut, meetingGet, keepMeeting, meetIdOf };
