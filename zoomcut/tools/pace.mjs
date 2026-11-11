// One speed for a section of a project (his note on rosenblum-1-v3, 2026-11-10: "from 'שני טורים' to the end at 1.25
// instead of the project's 1.4"): every group that starts in the range gets its own speed - the same as "Its own" on
// each group's panel (ui/layers/group.ts rangeSpeedOps - this runs that very code): its clips play at it (voices keep
// their pitch), the groups get longer / shorter, everything after moves, music and sounds of no group stretch with them.
// Through the studio's ops API with the rev - one change in the history; --undo takes the last one back.
//   node tools/pace.mjs <episode> --from <s> --to <s|end> --pace 1.25     (seconds on the timeline, as the editor shows)
//   node tools/pace.mjs <episode> --from 95.2 --to end --pace project     (back to the project's speed)
//   node tools/pace.mjs <episode> ... --dry                                (only say what it would do)
//   node tools/pace.mjs <episode> --undo                                   (take the last pace change back)
// ZC_PORT=4848 for a test studio.
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const base = `http://127.0.0.1:${process.env.ZC_PORT || 4747}`;
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const ep = args.find((a, i) => !a.startsWith('--') && !['--from', '--to', '--pace'].includes(args[i - 1]));
const dry = args.includes('--dry'), undo = args.includes('--undo');
if (!ep || (!undo && (opt('from') == null || opt('pace') == null))) {
  console.log('node tools/pace.mjs <episode> --from <s> --to <s|end> --pace <1.25|project> [--dry]   |   <episode> --undo');
  process.exit(1);
}
const api = (u, body) => fetch(`${base}/api/p/${encodeURIComponent(ep)}${u}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {})
  .then(async (r) => ({ ok: r.ok, status: r.status, json: await r.json().catch(() => ({})) }));
const undoDir = path.join(HERE, '..', 'episodes', ep, 'work', 'history');

const v = await api('');
if (!v.ok || !v.json.project) { console.log(`no layered project "${ep}" (is the studio up on ${base}?)`); process.exit(1); }
const p = v.json.project, fps = p.canvas.fps;

if (undo) {
  const last = fs.existsSync(undoDir) ? fs.readdirSync(undoDir).filter((f) => /^pace-\d+\.undo\.json$/.test(f)).sort((a, b) => parseInt(b.slice(5)) - parseInt(a.slice(5)))[0] : null;
  if (!last) { console.log('no pace change to take back'); process.exit(1); }
  const u = JSON.parse(fs.readFileSync(path.join(undoDir, last), 'utf8'));
  if (u.rev !== p.rev) { console.log(`the project changed after that pace change (rev ${u.rev} -> ${p.rev}) - undo it in the editor (Ctrl+Z) or by hand`); process.exit(1); }
  const r = await api('/ops', { rev: p.rev, ops: u.ops, by: 'pace.mjs undo' });
  if (r.ok) fs.renameSync(path.join(undoDir, last), path.join(undoDir, last.replace('.undo.json', '.undone.json')));
  console.log(r.ok ? `✓ taken back (${last}) - tell him F5` : `✗ ${r.json.error || r.status}`);
  process.exit(r.ok ? 0 : 1);
}

// the editor's own code (TypeScript), bundled once for Node
const esbuild = await import(pathToFileURL(path.join(HERE, '..', 'render', 'node_modules', 'esbuild', 'lib', 'main.js')).href);
const out = path.join(os.tmpdir(), `zc-group-${process.pid}.mjs`);
await (esbuild.default || esbuild).build({ entryPoints: [path.join(HERE, '..', 'render', 'ui', 'layers', 'group.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const G = await import(pathToFileURL(out).href);
const { apply, inverse, validate } = await import(pathToFileURL(path.join(HERE, '..', 'render', 'src', 'layers', 'ops.js')).href);
fs.rmSync(out, { force: true });

const from = Math.round(+opt('from') * fps), to = opt('to') == null || opt('to') === 'end' ? Infinity : Math.round(+opt('to') * fps);
const pace = opt('pace') === 'project' ? null : +opt('pace');
if (pace != null && !(pace >= 0.25 && pace <= 4)) { console.log('--pace 0.25 .. 4, or "project"'); process.exit(1); }
const { ops, groups, skipped } = G.rangeSpeedOps(p, from, to, pace);
const tc = (f) => `${Math.floor(f / fps / 60)}:${(f / fps % 60).toFixed(2).padStart(5, '0')}`;
const after = apply(p, ops);
console.log(`${ep}: ${groups} group(s) starting ${tc(from)} – ${to === Infinity ? 'the end' : tc(to)} -> ${pace ?? `the project's ${p.speed || 1}`}×` +
  ` (project ${p.speed || 1}×); length ${tc(p.duration)} -> ${tc(after.duration)}${skipped ? `; ${skipped} builder take(s) left as they are` : ''}`);
const problems = validate(after);
if (problems.length) { console.log('✗ the project would break:', problems.slice(0, 5)); process.exit(1); }
if (!ops.length || dry) process.exit(0);
const undoOps = inverse(p, ops);
const r = await api('/ops', { rev: p.rev, ops, by: 'pace.mjs' });
if (!r.ok) { console.log(`✗ ${r.json.error || r.status}`); process.exit(1); }
fs.mkdirSync(undoDir, { recursive: true });
fs.writeFileSync(path.join(undoDir, `pace-${r.json.rev}.undo.json`), JSON.stringify({ rev: r.json.rev, ops: undoOps }));
console.log(`✓ done (rev ${r.json.rev}) - tell him F5; take it back: node tools/pace.mjs ${ep} --undo`);
