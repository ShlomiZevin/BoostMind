// Ready-made ElevenLabs sound effects - FREE downloads, no credits (2026-11-24, his ask: "look if there are things to
// download ready, no cost, in 11 Labs"). Every topic page elevenlabs.io/sound-effects/<slug> (crowd-laughing,
// classroom, school, laughter, people-laughing, audience-laughing, applause, door, phone, ...) carries ~10 made sounds
// with their description; on our paid plan they are royalty-free for commercial use, no credit (their FAQ).
//   node tools/el_sfx_pages.mjs --find airport,plane,crowd      which topic pages exist (~2,400, from the sitemap)
//   node tools/el_sfx_pages.mjs <slug> [<slug> ...] --out <dir> [--grep <word>]
// Downloads each sound as <slug>-NN.mp3 and writes <dir>/index.txt (file | description | page). Listen / measure,
// pick, and only then add the picks to a project / the library (tools/library_add.mjs). A slug that is not a page = 404.
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const out = opt('--out') || 'el-sfx';
const grep = (opt('--grep') || '').toLowerCase();
// --find <word>[,<word>...] = which pages exist (the sitemap lists ~2,400 topic pages), e.g. --find airport,plane,crowd
const find = opt('--find');
if (find) {
  const sm = await (await fetch('https://elevenlabs.io/sitemap/sound-effect-categories__en.xml', { headers: { 'user-agent': 'Mozilla/5.0' } })).text();
  const slugs = [...new Set([...sm.matchAll(/https:\/\/elevenlabs\.io\/sound-effects\/([a-z0-9-]+)/g)].map((m) => m[1]))];
  const words = find.toLowerCase().split(',').map((w) => w.trim()).filter(Boolean);
  console.log(slugs.filter((s) => words.some((w) => s.includes(w))).join('\n') || '(none)');
  process.exit(0);
}
if (!args.length) { console.log('node tools/el_sfx_pages.mjs <slug> [...] --out <dir> [--grep <word>]'); process.exit(1); }
fs.mkdirSync(out, { recursive: true });
const lines = [];
for (const slug of args) {
  const url = `https://elevenlabs.io/sound-effects/${slug}`;
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!r.ok) { console.log(`${slug}: HTTP ${r.status}`); continue; }
  const h = (await r.text()).replace(/\\"/g, '"');
  const re = /"title":"([^"]*)","description":"([^"]*)"[^{}]*?"audioUrl":"(https:\/\/eleven-public-cdn\.elevenlabs\.io\/[^"]+\.mp3)"/g;
  const seen = new Set(); let m; let n = 0;
  while ((m = re.exec(h))) {
    const [, , desc, au] = m;
    if (seen.has(au)) continue; seen.add(au);
    if (grep && !desc.toLowerCase().includes(grep)) continue;
    const file = `${slug}-${String(n++).padStart(2, '0')}.mp3`;
    const a = await fetch(au); if (!a.ok) continue;
    fs.writeFileSync(path.join(out, file), Buffer.from(await a.arrayBuffer()));
    lines.push(`${file} | ${desc} | ${url}`); console.log(`${file}  ${desc}`);
  }
  if (!n) console.log(`${slug}: no sounds found${grep ? ` matching "${grep}"` : ''}`);
}
fs.appendFileSync(path.join(out, 'index.txt'), lines.join('\n') + (lines.length ? '\n' : ''));
