// What the Reader will show for a script - run it after writing or changing ANY script a session hands him.
//   node tools/reader_check.mjs <project id | path/to/script.txt>
// Uses the Reader's own parser (render/reader/parse.js). Exit 1 = he would see missing text: no spoken lines, or rows
// of the file the Reader drops (2026-11-27: a colon inside a direction once hid every spoken line).
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
await import(new URL('../render/reader/parse.js', import.meta.url).href);
const arg = process.argv[2];
if (!arg) { console.error('usage: node tools/reader_check.mjs <project id | script.txt>'); process.exit(2); }
let file = arg;
if (!fs.existsSync(file)) {  // a project id: the script the Reader opens for it (episode.json "script" = scripts/<id>.txt, else script.txt)
  const ep = path.join(ROOT, 'episodes', arg);
  const cfg = fs.existsSync(path.join(ep, 'episode.json')) ? JSON.parse(fs.readFileSync(path.join(ep, 'episode.json'), 'utf8')) : {};
  file = cfg.script ? path.join(ROOT, 'scripts', cfg.script + '.txt') : path.join(ep, 'script.txt');
}
const text = fs.readFileSync(file, 'utf8');
const lines = globalThis.parseScript(text);
const rows = text.split(/\r?\n/).map((r, k) => ({ r: r.trim(), k })).filter(({ r }) => r && !r.startsWith('#'));
const used = new Set(lines.flatMap((l) => l.rows));
const lost = rows.filter(({ k }) => !used.has(k));
const spoken = lines.filter((l) => !l.dir);
const solo = lines.some((l) => l.solo);
const who = [...new Set(spoken.map((l) => l.who).filter(Boolean))];
console.log(`${file}\n${solo ? 'monologue (prompter)' : 'dialogue: ' + who.join(', ')} - ${spoken.length} spoken lines, ${lines.length - spoken.length} directions`);
for (const l of lines) console.log(l.dir ? `  [הוראת בימוי] ${l.text}` : `  ${l.who ? l.who + ': ' : ''}${l.text}`);
if (lost.length) console.log(`\n!! ${lost.length} rows of the file are NOT shown in the Reader:\n` + lost.map((x) => `   row ${x.k + 1}: ${x.r}`).join('\n'));
if (!spoken.length) console.log('\n!! no spoken lines - the Reader would show only directions');
process.exit(lost.length || !spoken.length ? 1 : 0);
