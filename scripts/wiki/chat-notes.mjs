// His comments on the characters' conversations (Backstage → שיחות → הערות, techietech-api/chatnotes.js) - the session's side.
// He reviews conversations from time to time and comments on what he didn't like, or asks a question. Then he opens a
// session: "read my comments, let's discuss". The order: read them -> DISCUSS with him (what each one means, what it needs:
// nothing, an engine / architecture change in the chain - wiki-deep.js, a prompt, or, only when nothing else works,
// something character-specific) -> handle what you agreed -> answer under the comment (closes it). Never change anything
// from a comment before you discussed it with him.
//   node scripts/wiki/chat-notes.mjs open --out c.md       every open comment + its whole conversation + what the chain's steps decided (read with the Read tool - Hebrew)
//   node scripts/wiki/chat-notes.mjs all --out c.md              handled ones too
//   node scripts/wiki/chat-notes.mjs marks [good|bad] --out m.md  the conversations he marked 👍 / 👎 (with or without a comment)
//   (a Syncs meeting he marked / commented shows as "KIND: SYNCS MEETING" - key m:<meeting id> - with every speaker's lines and the wrap-up)
//   node scripts/wiki/chat-notes.mjs reply <id> --file r.txt     answer under his comment - closes it
//   node scripts/wiki/chat-notes.mjs done <id> [--open]          handled without an answer (or open again)
import fs from 'node:fs';
import { ownerKey } from '../owner-key.mjs';

const API = 'https://europe-west1-boostmind-b052c.cloudfunctions.net/verseOwner';
const KEY = ownerKey();   // (found by itself - scripts/owner-key.mjs; never ask him for it)
if (!KEY) { console.error('OWNER_KEY is needed (his owner key)'); process.exit(1); }
const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : null; };
async function api(op, body) {
  const r = await fetch(`${API}?op=${op}`, { method: 'POST', headers: { authorization: 'Key ' + KEY, 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`${op}: ${r.status} ${j.error || ''}`);
  return j;
}
const write = (text) => { const f = opt('out'); if (f) { fs.writeFileSync(f, text, 'utf8'); console.log('written to', f); } else console.log(text); };
const when = (t) => (t ? new Date(t).toISOString().slice(0, 16).replace('T', ' ') : '');
const [cmd, id] = argv;
// a Syncs meeting is a conversation too (since 2026-11-20): key 'm:<meeting id>' - chatThread gives the whole meeting. Its lines,
// by speaker, with the mute / left / silence moments and the wrap-up; a comment on one line marks it with >>>.
const NAMES = { amir: 'AMIR', ofer: 'OFER', daniel: 'DANIEL', ronit: 'RONIT', gilad: 'GILAD', yaniv: 'YANIV' };
const isMeeting = (k) => /^m:/.test(String(k || ''));
function meetingLines(M, hit = '') {
  if (!M) return ['(no longer kept)', ''];
  const v = M.visitor || {}, who = (w) => (w === 'user' ? `VISITOR (${v.name || '?'})` : NAMES[w] || String(w).toUpperCase());
  const out = [`KIND: SYNCS MEETING - with ${(M.room || []).map(who).join(', ')} + the visitor ${v.name || '?'}${v.title ? ` ("${v.title}")` : ''} - ${when(M.t)}${M.ended ? '' : ' - did not end'}`, ''];
  (M.log || []).forEach((l, i) => {
    const prev = M.log[i - 1], mark = `${M.id}L${i}` === hit ? '>>> ' : '';
    if (prev && prev.cut && prev.text && !l.left && !l.silent && prev.who !== 'user') out.push(`   [${who(l.who)} muted ${who(prev.who)}]`);
    if (l.left) out.push(`   [${who(l.who)} left the meeting]`);
    else if (l.silent) out.push('   [the visitor stayed silent - the room went on]');
    else out.push(`${mark}${who(l.who)}: ${l.text}${l.cut ? ' —' : ''}`);
  });
  if (M.ended && M.ender) out.push(`   [${who(M.ender)} ended the meeting]`);
  if (M.recap) out.push('', `WRAP-UP: ${JSON.stringify(M.recap)}`);
  return [...out, ''];
}

if (cmd === 'open' || cmd === 'all') {
  const { notes, marks = {} } = await api('chatNotes');
  const pick = notes.filter((n) => n.by !== 'claude' && (cmd === 'all' || !n.done)).sort((a, b) => (a.t || 0) - (b.t || 0));
  const out = [`# ${cmd === 'open' ? 'Open' : 'All'} comments on conversations: ${pick.length}`, ''];
  const threads = {};
  for (const n of pick) {
    if (!threads[n.key]) threads[n.key] = (await api('chatThread', { c: n.c, ids: n.ids }).catch(() => ({ chats: [] }))).chats.sort((a, b) => a.t - b.t);
    const th = threads[n.key];
    out.push(`## Comment ${n.id} - ${n.mode} - ${when(n.t)}${n.done ? ' (handled)' : ''}`, '',
      `On: ${n.msg ? 'one answer (marked >>> below)' : 'the whole conversation'}${marks[n.key] ? ` · he marked the conversation ${marks[n.key].toUpperCase()}` : ''}`, '', `HIS COMMENT: ${n.text}`, '');
    for (const r of notes.filter((x) => x.by === 'claude' && x.reply === n.id)) out.push(`Answered (${when(r.t)}): ${r.text}`, '');
    out.push('### The conversation', '');
    if (isMeeting(n.key)) { out.push(...meetingLines((await api('chatThread', { key: n.key }).catch(() => ({}))).meeting, n.msg)); continue; }
    if (!th.length) out.push(`(no longer kept - the message: Q: ${n.q} / A: ${n.a})`, '');
    for (const c of th) {
      const mark = c.id === n.msg ? '>>> ' : '';
      out.push(`${mark}VISITOR: ${c.q}`, `${mark}${String(n.mode).toUpperCase()}: ${c.a}`);
      if (c.think) out.push(`   (the chain's steps decided: ${JSON.stringify(c.think)})`);
      out.push('');
    }
  }
  write(out.join('\n'));
} else if (cmd === 'marks') {
  const { marks = {}, notes } = await api('chatNotes');
  const keys = Object.keys(marks).filter((k) => !id || marks[k] === id);
  const out = [`# Marked conversations: ${keys.length}`, ''];
  for (const k of keys) {
    const c = k.startsWith('c:') ? k.slice(2) : '';
    const n = notes.find((x) => x.key === k);
    if (isMeeting(k)) {
      const M = (await api('chatThread', { key: k }).catch(() => ({}))).meeting;
      out.push(`## ${marks[k].toUpperCase()} - syncs meeting - ${when(M?.t)} - ${k}${notes.some((x) => x.key === k && x.by !== 'claude') ? ' (has comments)' : ''}`, '', ...meetingLines(M));
      continue;
    }
    const th =(await api('chatThread', { c, ids: n?.ids || [] }).catch(() => ({ chats: [] }))).chats.sort((a, b) => a.t - b.t);
    out.push(`## ${marks[k].toUpperCase()} - ${th[0]?.mode || n?.mode || '?'} - ${when(th[0]?.t)} - ${k}${notes.some((x) => x.key === k && x.by !== 'claude') ? ' (has comments)' : ''}`, '');
    if (!th.length) out.push('(no longer kept)', '');
    for (const m of th) out.push(`VISITOR: ${m.q}`, `${String(m.mode).toUpperCase()}: ${m.a}`, ...(m.think ? [`   (the chain's steps decided: ${JSON.stringify(m.think)})`] : []), '');
  }
  write(out.join('\n'));
} else if (cmd === 'reply') {
  const text = fs.readFileSync(opt('file'), 'utf8').trim();
  const { notes } = await api('chatNotes');
  const n = notes.find((x) => x.id === id);
  if (!n) { console.error('no such comment:', id); process.exit(1); }
  await api('chatNote', { key: n.key, c: n.c, mode: n.mode, msg: n.msg, text, by: 'claude', reply: n.id });
  console.log(`answered ${id} - closed`);
} else if (cmd === 'done') {
  await api('chatNoteDone', { id, done: !argv.includes('--open') });
  console.log(argv.includes('--open') ? 'opened again' : 'handled');
} else {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).join('\n'));
}
