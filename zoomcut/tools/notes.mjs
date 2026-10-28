// His notes for Claude (the editor's "+ Note" / N: a moment, his words, maybe a spot on the picture) - "fix notes".
//   node tools/notes.mjs <episode>                    the open notes: when, his words, the spot, what is on screen there
//                                                     (every layer's item at that frame) + a still of that exact frame
//                                                     with the spot boxed: episodes/<ep>/work/notes/<id>.png
//   node tools/notes.mjs <episode> --all --no-stills  answered ones too / skip the stills (faster)
//   node tools/notes.mjs <episode> done <id> "what I did"   answer it: done + the reply he reads on the note
//   node tools/notes.mjs <episode> reply <id> "a question"  a reply, the note stays open (when it needs his answer)
// Through the studio's ops API with the rev (the studio must be running) - he presses F5 to see the answers.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = 'http://127.0.0.1:4747';
const args = process.argv.slice(2);
const [ep, cmd, id, ...rest] = args.filter((a) => !a.startsWith('--'));
const flag = (f) => args.includes(f);
if (!ep) { console.log('node tools/notes.mjs <episode> [done|reply <id> "text"] [--all] [--no-stills]'); process.exit(1); }

const view = await (await fetch(`${base}/api/p/${encodeURIComponent(ep)}`)).json();
const p = view.project;
if (!p) { console.log(`no layered project "${ep}"`); process.exit(1); }
const fps = p.canvas.fps, speed = p.speed || 1;
const notes = Array.isArray(p.notes) ? p.notes : [];
const mmss = (f) => { const s = f / fps / speed; return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`; };

if (cmd === 'done' || cmd === 'reply') {
  const n = notes.find((x) => x.id === id);
  if (!n) { console.log(`no note "${id}" - ids: ${notes.map((x) => x.id).join(', ')}`); process.exit(1); }
  const next = notes.map((x) => (x.id === id ? { ...x, reply: rest.join(' ').trim() || x.reply, ...(cmd === 'done' ? { done: true } : {}) } : x));
  const r = await fetch(`${base}/api/p/${encodeURIComponent(ep)}/ops`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ rev: p.rev, ops: [{ op: 'project', set: { notes: next } }] }) });
  const j = await r.json().catch(() => ({}));
  console.log(r.ok ? `✓ note ${id} ${cmd === 'done' ? 'done' : 'answered'} - tell him F5` : `✗ ${j.error || r.status}${j.problems ? ': ' + j.problems.join('; ') : ''}`);
  process.exit(r.ok ? 0 : 1);
}

const list = notes.filter((n) => flag('--all') || !n.done).sort((a, b) => a.at - b.at);
if (!list.length) { console.log(notes.length ? `no open notes (${notes.length} answered - --all shows them)` : 'no notes'); process.exit(0); }

// what is on screen / heard at a frame: every layer (top first) and its item there
const at = (f) => [...p.layers].reverse().flatMap((l) => (l.items || []).filter((i) => f >= i.from && f < i.from + i.dur).map((i) => {
  const a = p.assets?.[i.asset ?? l.props?.asset];
  const line = i.ref?.line != null ? (p.script || []).find((s) => s.n === i.ref.line) : null;
  const what = i.text != null ? `"${i.text}"` : line ? `line ${line.n} "${line.text}"` : a ? path.basename(String(a.src)) : '';
  const ref = i.ref ? ' ref ' + JSON.stringify(i.ref) : '';
  return `   ${l.hidden || l.muted ? '(off) ' : ''}${l.kind.padEnd(9)} ${l.id} / ${i.id}  ${(i.from / fps).toFixed(2)}-${((i.from + i.dur) / fps).toFixed(2)} s  ${what}${ref}${i.user ? '  (his)' : ''}`;
}));

let still = null;
if (!flag('--no-stills')) {
  const need = createRequire(path.join(ROOT, 'render', 'package.json'));  // (Remotion lives in render/node_modules)
  const { bundle } = need('@remotion/bundler');
  const { renderStill, selectComposition } = need('@remotion/renderer');
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'render', 'src', 'index.ts'), webpackOverride: (c) => c });
  const inputProps = { project: p, urls: view.urls, mode: 'full' };
  const composition = await selectComposition({ serveUrl, id: 'Layers', inputProps });
  const dir = path.join(ROOT, 'episodes', ep, 'work', 'notes');
  fs.mkdirSync(dir, { recursive: true });
  still = async (n) => {
    const out = path.join(dir, `${n.id}.png`);
    await renderStill({ composition, serveUrl, output: out, inputProps, frame: Math.max(0, Math.min(p.duration - 1, Math.round(n.at))) });
    if (n.x != null) {  // (the spot he pointed at: a yellow box around it)
      const s = 120, x = Math.round(n.x - s / 2), y = Math.round(n.y - s / 2), tmp = out.replace(/\.png$/, '.raw.png');
      fs.renameSync(out, tmp);
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', tmp, '-vf', `drawbox=x=${x}:y=${y}:w=${s}:h=${s}:color=0xf0b44c:t=8`, out]);
      fs.rmSync(tmp);
    }
    return out;
  };
}

console.log(`${ep}: ${list.length} note${list.length === 1 ? '' : 's'}${speed !== 1 ? ` (times as he sees them, at ${speed}x)` : ''}\n`);
for (const n of list) {
  console.log(`● ${n.id}${n.done ? ' (done)' : ''}  at ${mmss(n.at)}  (frame ${Math.round(n.at)} of ${p.duration})${n.x != null ? `  spot x ${n.x}, y ${n.y} of ${p.canvas.w}x${p.canvas.h}` : ''}`);
  console.log(`  his note: ${n.text}`);
  if (n.reply) console.log(`  replied: ${n.reply}`);
  console.log('  on screen / heard there:');
  console.log(at(n.at).join('\n') || '   (nothing)');
  if (still) console.log(`  still: ${await still(n)}`);
  console.log('');
}
