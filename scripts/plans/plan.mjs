// Plans in Backstage - the session's side (2026-11-06). A plan is a folder with index.html (the brief, its mockups as
// <img src="img/NAME">) + img/. Backstage (תוכניות) shows it; he comments on any part and approves / asks for changes.
//   OWNER_KEY=<his key> node scripts/plans/plan.mjs publish <folder> --id <plan-id> [--title-file t.txt] [--summary-file s.txt] [--cover NAME] [--note-file n.txt] [--replaces old-id,old-id2]
//   OWNER_KEY=... node scripts/plans/plan.mjs list
//   OWNER_KEY=... node scripts/plans/plan.mjs comments <plan-id> --out comments.md     (read it with the Read tool - Hebrew)
//   OWNER_KEY=... node scripts/plans/plan.mjs reply <plan-id> --file reply.txt [--anchor <part>] [--to <comment id>]
//   OWNER_KEY=... node scripts/plans/plan.mjs archive <plan-id> [--back]      (off his list - a newer round replaced it; --back returns it)
// Hebrew always through files (the console mangles it). Re-publishing the same id = a new version, back to "waiting for him".
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://europe-west1-boostmind-b052c.cloudfunctions.net/verseOwner';
const KEY = process.env.OWNER_KEY;
if (!KEY) { console.error('OWNER_KEY is needed (his owner key)'); process.exit(1); }
const [cmd, arg] = process.argv.slice(2);
const opt = (n) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
const readOpt = (n) => (opt(n) ? fs.readFileSync(opt(n), 'utf8').trim() : null);
async function api(op, body) {
  const r = await fetch(`${API}?op=${op}`, { method: body ? 'POST' : 'GET', headers: { authorization: 'Key ' + KEY, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`${op}: ${r.status} ${j.error || ''}`);
  return j;
}

if (cmd === 'publish') {
  const dir = arg, id = opt('id');
  if (!dir || !id) { console.error('publish <folder> --id <plan-id>'); process.exit(1); }
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const title = readOpt('title-file') || opt('title') || (html.match(/<title>([^<]+)<\/title>/) || [])[1]?.replace(/\s*·.*$/, '') || id;
  // the files the page shows: <img src="img/NAME">, <video src="img/NAME.mp4" poster="img/NAME.jpg">
  const names = [...new Set([...html.matchAll(/(?:src|poster)="img\/([\w.-]+)"/g)].map((m) => m[1]))].filter((n) => fs.existsSync(path.join(dir, 'img', n)));
  const type = (n) => (/\.png$/i.test(n) ? 'image/png' : /\.webp$/i.test(n) ? 'image/webp' : /\.mp4$/i.test(n) ? 'video/mp4' : 'image/jpeg');
  for (let i = 0; i < names.length; i += 4) {
    const files = names.slice(i, i + 4).map((n) => ({ name: n, type: type(n), b64: fs.readFileSync(path.join(dir, 'img', n)).toString('base64') }));
    const r = await api('planFiles', { id, files });
    console.log(`pictures ${i + r.files}/${names.length}`);
  }
  const r = await api('planPut', { id, title, html, summary: readOpt('summary-file') || '', cover: opt('cover') || names[0] || null, note: readOpt('note-file') || '', replaces: (opt('replaces') || '').split(',').filter(Boolean) });
  console.log(`plan "${id}" is in Backstage (תוכניות) - ${names.length} pictures`, r.ok ? '' : r);
} else if (cmd === 'list') {
  const { plans } = await api('plans');
  for (const p of plans) console.log(`${p.id}  [${p.status}]  v${p.version}  open comments: ${p.open}`);
} else if (cmd === 'comments') {
  const { plan, comments } = await api('plan', { id: arg });
  const lines = [`# ${plan.title} (v${plan.version}) - status: ${plan.status}`, ''];
  for (const c of comments) {
    const who = c.by === 'claude' ? 'Claude' : 'שלומי', when = c.t ? new Date(c.t).toISOString().slice(0, 16).replace('T', ' ') : '';
    if (c.kind === 'status') lines.push(`- [${when}] ${who}: STATUS -> ${c.status}${c.text ? ' - ' + c.text : ''}`);
    else if (c.kind === 'version') lines.push(`- [${when}] new version: ${c.text}`);
    else lines.push(`- [${when}] ${who}${c.done ? ' (handled)' : ''} on "${c.label || c.anchor || 'the whole plan'}" (anchor ${c.anchor || '-'}, id ${c.id}): ${c.text}`);
  }
  const out = opt('out') || `plan-${arg}-comments.md`;
  fs.writeFileSync(out, lines.join('\n') + '\n', 'utf8');
  console.log(`${comments.filter((c) => c.kind === 'comment' && !c.done && c.by !== 'claude').length} open comments from him -> ${out}`);
} else if (cmd === 'archive') {
  await api('planArchive', { id: arg, archived: !process.argv.includes('--back') });
  console.log(`plan "${arg}" ${process.argv.includes('--back') ? 'is back on' : 'is off'} his list`);
} else if (cmd === 'reply') {
  const text = readOpt('file');
  if (!arg || !text) { console.error('reply <plan-id> --file reply.txt [--anchor x] [--to id]'); process.exit(1); }
  await api('planComment', { id: arg, text, anchor: opt('anchor') || '', by: 'claude', reply: opt('to') || null });
  if (opt('to')) await api('planDone', { id: arg, comment: opt('to'), done: true });
  console.log('replied');
} else {
  console.error('commands: publish | list | comments | reply');
  process.exit(1);
}
