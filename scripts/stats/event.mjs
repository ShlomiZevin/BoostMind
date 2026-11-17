// The events log - the session's side (2026-11-16, his ask: "an event table, so we can check the stats until then and
// from then"). Every session that changes something visitors feel (a release, a mail to everyone, a new game, a marketing
// push, an outage) logs it here; Backstage draws it on every day chart (סקירה → אירועים) with a before / after.
//   node scripts/stats/event.mjs add --day 2026-11-16 --kind release --title-file t.txt [--note-file n.txt] [--link URL] [--at HH:MM] [--counts view,video]
//   node scripts/stats/event.mjs edit <id> [--at HH:MM] [--counts view,video] [--day ...] [--kind ...] [--title-file ...] [--note-file ...]
// --at = when it went live that day (Backstage's "since the event" starts there); --counts = the metric keys this change counts
// differently from now on (video, view, chat_message, game_start, visitors...) - Backstage won't compare them across it.
//   node scripts/stats/event.mjs list [--from 2026-11-01] [--to 2026-11-30] [--out events.md]
//   node scripts/stats/event.mjs del <id>
//   node scripts/stats/event.mjs seed scripts/stats/seed-events.json      (skips one already there: same day + title)
// kind: release | mail | content | marketing | incident | other. --day defaults to today (Israel).
// Hebrew always through files (the console mangles it): titles / notes in, the list out with --out (read it with the Read tool).
import fs from 'node:fs';
import { ownerKey } from '../owner-key.mjs';

const API = 'https://europe-west1-boostmind-b052c.cloudfunctions.net/verseOwner';
const KEY = ownerKey();   // (found by itself - scripts/owner-key.mjs; never ask him for it)
if (!KEY) { console.error('OWNER_KEY is needed (his owner key)'); process.exit(1); }
const [cmd, arg] = process.argv.slice(2);
const opt = (n) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
const readOpt = (n) => (opt(n) ? fs.readFileSync(opt(n), 'utf8').trim() : null);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
async function api(op, body) {
  const r = await fetch(`${API}?op=${op}`, { method: body ? 'POST' : 'GET', headers: { authorization: 'Key ' + KEY, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`${op}: ${r.status} ${j.error || ''}`);
  return j;
}

if (cmd === 'add') {
  const title = readOpt('title-file');
  if (!title) { console.error('add --title-file t.txt [--day YYYY-MM-DD] [--kind release] [--note-file n.txt] [--link URL]'); process.exit(1); }
  const r = await api('eventAdd', { day: opt('day') || today(), kind: opt('kind') || 'other', title, note: readOpt('note-file') || '', link: opt('link') || '', at: opt('at') || '', counts: opt('counts') || '', by: 'session' });
  console.log(`event added (${opt('day') || today()}, ${opt('kind') || 'other'}) - id ${r.id}`);
} else if (cmd === 'list') {
  const body = {};
  if (opt('from')) body.from = opt('from');
  if (opt('to')) body.to = opt('to');
  const { events } = await api('events', body);
  const lines = events.map((e) => `- ${e.day} [${e.kind}] ${e.title}${e.note ? ' - ' + e.note.replace(/\s+/g, ' ') : ''}${e.link ? ' (' + e.link + ')' : ''}  (by ${e.by || '-'}, id ${e.id})`);
  const out = opt('out');
  if (out) { fs.writeFileSync(out, `# events (${events.length})\n\n${lines.join('\n')}\n`, 'utf8'); console.log(`${events.length} events -> ${out}`); }
  else for (const e of events) console.log(`${e.day}  [${e.kind}]  id ${e.id}  by ${e.by || '-'}`);   // no Hebrew on the console: --out for the titles
} else if (cmd === 'edit') {
  if (!arg) { console.error('edit <id> [--at HH:MM] [--counts a,b] [--day ..] [--kind ..] [--title-file ..] [--note-file ..] [--link ..]'); process.exit(1); }
  const b = { id: arg };
  for (const k of ['at', 'counts', 'day', 'kind', 'link']) if (opt(k) != null) b[k] = opt(k);
  if (opt('title-file')) b.title = readOpt('title-file');
  if (opt('note-file')) b.note = readOpt('note-file');
  await api('eventEdit', b);
  console.log(`event ${arg} edited`);
} else if (cmd === 'del') {
  if (!arg) { console.error('del <id>'); process.exit(1); }
  await api('eventDel', { id: arg });
  console.log(`event ${arg} deleted`);
} else if (cmd === 'seed') {
  if (!arg) { console.error('seed <file.json>'); process.exit(1); }
  const list = JSON.parse(fs.readFileSync(arg, 'utf8'));
  const have = new Set((await api('events', {})).events.map((e) => `${e.day}|${e.title}`));
  let added = 0, skipped = 0;
  for (const e of list) {
    if (have.has(`${e.day}|${e.title.replace(/\s+/g, ' ').trim()}`)) { skipped++; continue; }
    await api('eventAdd', { day: e.day, kind: e.kind || 'other', title: e.title, note: e.note || '', link: e.link || '', by: e.by || 'session' });
    added++;
  }
  console.log(`seed: ${added} added, ${skipped} already there`);
} else {
  console.error('commands: add | edit | list | del | seed');
  process.exit(1);
}
