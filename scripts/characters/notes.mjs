// His notes on the characters (Backstage → דמויות, techietech-api/charnotes.js) - the session's side. He writes messy notes on
// any part of a character; a session puts them in order into the record (scripts/verse/content.mjs put) and answers here.
//   OWNER_KEY=<his key> node scripts/characters/notes.mjs open --out notes.md        every open note + the line it is on (read it with the Read tool - Hebrew)
//   OWNER_KEY=... node scripts/characters/notes.mjs char <id> --out notes.md        all of one character's notes, handled ones too
//   OWNER_KEY=... node scripts/characters/notes.mjs reply <note-id> --file r.txt     answer under his note - it closes the note
//   OWNER_KEY=... node scripts/characters/notes.mjs done <note-id> [--open]          handled without an answer (or open again)
// The order of work: open -> change the record (content.mjs put, Hebrew through a file) -> reply with what changed, in a line
// or two of Hebrew. He sees the answer and the changed lines marked green the next time he opens the character.
import fs from 'node:fs';

const API = 'https://europe-west1-boostmind-b052c.cloudfunctions.net/verseOwner';
const KEY = process.env.OWNER_KEY;
if (!KEY) { console.error('OWNER_KEY is needed (his owner key)'); process.exit(1); }
const [cmd, arg] = process.argv.slice(2);
const opt = (n) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
async function api(op, body) {
  const r = await fetch(`${API}?op=${op}`, { method: 'POST', headers: { authorization: 'Key ' + KEY, 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`${op}: ${r.status} ${j.error || ''}`);
  return j;
}
const write = (text) => { const f = opt('out'); if (f) { fs.writeFileSync(f, text, 'utf8'); console.log('written to', f); } else console.log(text); };

// the line a note is on, as it is live now ('field:3' = the 4th item of the field)
function lineOf(c, anchor) {
  if (!anchor) return '(the character as a whole)';
  const [f, i] = anchor.split(':');
  if (f === 'rel') return `relation to ${i}: ${(c.relations || []).find((r) => r.id === i)?.relation || '(gone)'}`;
  if (f === 'video') return `video ${i}`;
  const v = c[f];
  if (i != null && Array.isArray(v)) return `${f}[${i}]: ${v[+i] ?? '(gone)'}`;
  return `${f}: ${Array.isArray(v) ? v.join(' | ') : v ?? '(empty)'}`;
}

if (cmd === 'open' || cmd === 'char') {
  const { chars, notes } = await api('charList');
  const by = Object.fromEntries(chars.map((c) => [c.id, c]));
  const pick = cmd === 'open' ? notes.filter((n) => n.by === 'shlomi' && !n.done) : notes.filter((n) => n.char === arg);
  const out = [`# ${cmd === 'open' ? `Open notes: ${pick.length}` : `Notes on ${arg}`}`, ''];
  for (const id of [...new Set(pick.map((n) => n.char))]) {
    const c = by[id] || { id, name: id };
    out.push(`## ${c.name} (${id})`, '');
    for (const n of pick.filter((x) => x.char === id)) {
      const when = n.t ? new Date(n.t).toISOString().slice(0, 16).replace('T', ' ') : '';
      out.push(`- [${when}] ${n.by === 'claude' ? 'Claude' : 'שלומי'}${n.done ? ' (handled)' : ''} - note ${n.id}${n.reply ? ` (answers ${n.reply})` : ''}`,
        `  on: ${lineOf(c, n.anchor)}`, `  ${n.text.replace(/\n/g, '\n  ')}`, '');
    }
  }
  write(out.join('\n'));
} else if (cmd === 'reply') {
  const text = fs.readFileSync(opt('file'), 'utf8').trim();
  const { notes } = await api('charNotes', {});
  const n = notes.find((x) => x.id === arg) || (await api('charList')).notes.find((x) => x.id === arg);
  if (!n) { console.error('no such note:', arg); process.exit(1); }
  await api('charNote', { char: n.char, anchor: n.anchor, label: n.label, text, by: 'claude', reply: n.id });
  console.log(`answered ${arg} (${n.char}) - closed`);
} else if (cmd === 'done') {
  await api('charNoteDone', { id: arg, done: !process.argv.includes('--open') });
  console.log(process.argv.includes('--open') ? 'opened again' : 'handled');
} else {
  console.error('open | char <id> | reply <note-id> --file r.txt | done <note-id> [--open]');
  process.exit(1);
}
