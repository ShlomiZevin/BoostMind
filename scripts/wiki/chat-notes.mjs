// His comments on the characters' conversations (Backstage → שיחות → הערות, techietech-api/chatnotes.js) - the session's side.
// He reviews conversations from time to time and comments on what he didn't like, or asks a question. Then he opens a
// session: "read my comments, let's discuss". The order: read them -> DISCUSS with him (what each one means, what it needs:
// nothing, an engine / architecture change in the chain - wiki-deep.js, a prompt, or, only when nothing else works,
// something character-specific) -> handle what you agreed -> answer under the comment (closes it). Never change anything
// from a comment before you discussed it with him.
//   OWNER_KEY=<his key> node scripts/wiki/chat-notes.mjs open --out c.md       every open comment + its whole conversation + what the chain's steps decided (read with the Read tool - Hebrew)
//   OWNER_KEY=... node scripts/wiki/chat-notes.mjs all --out c.md              handled ones too
//   OWNER_KEY=... node scripts/wiki/chat-notes.mjs reply <id> --file r.txt     answer under his comment - closes it
//   OWNER_KEY=... node scripts/wiki/chat-notes.mjs done <id> [--open]          handled without an answer (or open again)
import fs from 'node:fs';

const API = 'https://europe-west1-boostmind-b052c.cloudfunctions.net/verseOwner';
const KEY = process.env.OWNER_KEY;
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

if (cmd === 'open' || cmd === 'all') {
  const { notes } = await api('chatNotes');
  const pick = notes.filter((n) => n.by !== 'claude' && (cmd === 'all' || !n.done)).sort((a, b) => (a.t || 0) - (b.t || 0));
  const out = [`# ${cmd === 'open' ? 'Open' : 'All'} comments on conversations: ${pick.length}`, ''];
  const threads = {};
  for (const n of pick) {
    if (!threads[n.key]) threads[n.key] = (await api('chatThread', { c: n.c, ids: n.ids }).catch(() => ({ chats: [] }))).chats.sort((a, b) => a.t - b.t);
    const th = threads[n.key];
    out.push(`## Comment ${n.id} - ${n.mode} - ${when(n.t)}${n.done ? ' (handled)' : ''}`, '',
      `On: ${n.msg ? 'one answer (marked >>> below)' : 'the whole conversation'}`, '', `HIS COMMENT: ${n.text}`, '');
    for (const r of notes.filter((x) => x.by === 'claude' && x.reply === n.id)) out.push(`Answered (${when(r.t)}): ${r.text}`, '');
    out.push('### The conversation', '');
    if (!th.length) out.push(`(no longer kept - the message: Q: ${n.q} / A: ${n.a})`, '');
    for (const c of th) {
      const mark = c.id === n.msg ? '>>> ' : '';
      out.push(`${mark}VISITOR: ${c.q}`, `${mark}${String(n.mode).toUpperCase()}: ${c.a}`);
      if (c.think) out.push(`   (the chain's steps decided: ${JSON.stringify(c.think)})`);
      out.push('');
    }
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
