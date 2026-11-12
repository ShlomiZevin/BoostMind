// Backstage → שיחות (2026-11-12, his ask): his comments on the characters' conversations, when he reviews them from time to
// time - what he didn't like, or a question. On the whole conversation or on one answer. Nothing acts on them by itself: he
// opens a session ("read my comments, let's discuss"), they discuss, then handle (scripts/wiki/chat-notes.mjs).
// The comment keeps a copy of what it is on (the message + the thread's log ids), so it outlives the chat log's 90 days.
// Private: Firestore `chatNotes` (no client rule = nobody reads it). Called only from verseOwner (his key):
// ops chatNotes, chatNote, chatNoteDone, chatNoteEdit, chatNoteDel, chatThread.
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

const db = () => admin.firestore();
const idOk = (s) => /^[A-Za-z0-9]{6,40}$/.test(String(s || ''));
const charOk = (s) => /^[a-z0-9][a-z0-9-]{0,60}$/.test(String(s || ''));
const clip = (s, n) => String(s ?? '').slice(0, n);
const ms = (t) => (t && t.toMillis ? t.toMillis() : null);
const row = (d) => ({ id: d.id, ...d.data(), t: ms(d.data().t), edited: ms(d.data().edited) });

async function owner(op, b) {
  const notes = db().collection('chatNotes');
  if (op === 'chatNotes') {   // every comment (the tab's one call)
    const n = await notes.orderBy('t', 'desc').limit(1500).get();
    return { notes: n.docs.map(row) };
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
    const L = db().collection('chat_logs');
    let docs = [];
    if (b.c && /^[A-Za-z0-9]{1,12}$/.test(b.c)) docs = (await L.where('c', '==', b.c).limit(200).get()).docs;
    if (!docs.length && Array.isArray(b.ids)) docs = (await Promise.all(b.ids.filter(idOk).slice(0, 60).map((id) => L.doc(id).get()))).filter((d) => d.exists);
    return { chats: docs.map((x) => { const c = x.data(); delete c.exp; return { id: x.id, ...c, t: ms(c.t) }; }) };
  }
  return null;
}

module.exports = { owner };
