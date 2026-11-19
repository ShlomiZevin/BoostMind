// "איך מברך" - each resident's technique for a personal video (his ask, 2026-11-19: "a new section in the character page: how each
// character blesses for an event - the mechanics, the voice of personal videos. A special area for me, it must NOT go to the chat.
// I write it with ChatGPT through the MCP and put it back to the verse from there").
// Its own Firestore collection `greetingVoice/<character id>` = { text (markdown, Hebrew), t, by, why } - deliberately NOT a field
// of the character's record (catalogCharacters), so the composed brain, the site and the chat never see it. Every earlier text is
// kept in `greetingVoice/<id>/versions` (undo). No client rule = nobody reads it but the server.
// Read / written by: Backstage → דמויות (verseOwner ops charList + charGreet, charnotes.js) and the MCP (mcp.js: get_greeting_voice,
// update_greeting_voice, undo_greeting_voice).
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

const col = () => admin.firestore().collection('greetingVoice');
const idOk = (s) => /^[a-z0-9][a-z0-9-]{0,60}$/.test(String(s || ''));
const ms = (t) => (t && t.toMillis ? t.toMillis() : null);
const MAX = 20000;

async function get(id) {
  if (!idOk(id)) return null;
  const d = await col().doc(id).get();
  return d.exists ? { ...d.data(), t: ms(d.data().t) } : null;
}
// every resident that has one: {id: {text, t, by}}
async function all() {
  const s = await col().get();
  return Object.fromEntries(s.docs.map((d) => [d.id, { text: d.data().text || '', t: ms(d.data().t), by: d.data().by || '' }]));
}
// the whole new text (the old one goes to versions first)
async function put(id, text, by, why = '') {
  if (!idOk(id)) return { error: 'id' };
  text = String(text ?? '').replace(/\r/g, '').trim().slice(0, MAX);
  const ref = col().doc(id), was = await ref.get();
  if (was.exists && (was.data().text || '') === text) return { ok: true, same: true };
  if (was.exists) await ref.collection('versions').add({ ...was.data(), saved: FieldValue.serverTimestamp() });
  await ref.set({ text, by: String(by || '').slice(0, 80), why: String(why || '').slice(0, 500), t: FieldValue.serverTimestamp() });
  return { ok: true };
}
// back to the text before the last change
async function undo(id, by) {
  if (!idOk(id)) return { error: 'id' };
  const ref = col().doc(id);
  const v = await ref.collection('versions').orderBy('saved', 'desc').limit(1).get();
  if (v.empty) return { error: 'nothing to undo' };
  const prev = v.docs[0].data();
  await ref.set({ text: prev.text || '', by: String(by || '').slice(0, 80), why: 'undo', t: FieldValue.serverTimestamp() });
  await v.docs[0].ref.delete();
  return { ok: true, text: prev.text || '' };
}
module.exports = { get, all, put, undo };
