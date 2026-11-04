// Builder action "keep": the "Keep things…" window (ui/layers/inspect/keep.tsx) - he taps / paints what to keep on a
// frame of a take, SAM 2 shows its outline at once (tools/sam/keep.py serve - one helper, kept loaded 10 min after the
// last tap), Save writes episode.json keep_objects[<take>] and runs Analyze, which follows each thing through the take
// (lesson.py keep_objects_matte) into the cut-out.
// body: {op: 'state'} -> {ready, objects} | {op: 'frame', asset, t} -> {w, h, jpg} | {op: 'mask', points} -> {png, score}
//       | {op: 'save', asset, objects, build} -> a job (Analyze) or {ok}
import fs from 'node:fs';
import path from 'node:path';
import { spawn as spawnProc } from 'node:child_process';

let W = null;  // the helper: {p, buf, wait: Map(id -> resolve), n, idle}
const files = (ROOT) => ({ py: path.join(ROOT, 'tools', 'sam', '.venv', 'Scripts', 'python.exe'), keep: path.join(ROOT, 'tools', 'sam', 'keep.py'),
  model: path.join(ROOT, 'tools', 'sam', 'models', 'sam2.1_hiera_tiny.pt') });

function helper(ROOT) {
  if (W && W.p.exitCode == null && !W.p.killed) return W;
  const f = files(ROOT);
  const p = spawnProc(f.py, ['-I', f.keep, 'serve'], { cwd: ROOT, windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8', TQDM_DISABLE: '1' } });
  const w = { p, buf: '', wait: new Map(), n: 0, idle: null };
  p.stdout.on('data', (b) => {
    w.buf += b;
    for (let i; (i = w.buf.indexOf('\n')) >= 0;) {
      const line = w.buf.slice(0, i);
      w.buf = w.buf.slice(i + 1);
      try { const j = JSON.parse(line); const done = w.wait.get(j.id); if (done) { w.wait.delete(j.id); done(j); } } catch {}
    }
  });
  p.stderr.on('data', () => {});  // (torch's warnings - read so the pipe never fills)
  p.on('exit', () => { for (const done of w.wait.values()) done({ error: 'the outline helper stopped' }); w.wait.clear(); if (W === w) W = null; });
  W = w;
  return w;
}

const ask = (ROOT, q, ms = 90e3) => new Promise((ok) => {
  const w = helper(ROOT);
  const id = ++w.n;
  const t = setTimeout(() => { w.wait.delete(id); ok({ error: 'the outline helper took too long' }); }, ms);
  w.wait.set(id, (j) => { clearTimeout(t); ok(j); });
  w.p.stdin.write(JSON.stringify({ ...q, id }) + '\n');
  clearTimeout(w.idle);
  w.idle = setTimeout(() => { try { w.p.kill(); } catch {} }, 10 * 60e3);  // (its memory back when he's done)
});

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const writeJson = (f, v) => { fs.writeFileSync(f + '.tmp', JSON.stringify(v, null, 2)); fs.renameSync(f + '.tmp', f); };
// the take's file and its name (lesson.py names a take by its file name without the extension)
const takeOf = (dir, asset) => {
  const a = readJson(path.join(dir, 'project.json'), {})?.assets?.[asset];
  if (!a?.src) throw Object.assign(new Error('no such take'), { status: 400 });
  const file = path.resolve(dir, a.src);
  return { file, take: path.parse(file).name };
};

export default async ({ id, dir, body, runJob, pub, ROOT }) => {
  const b = body || {};
  const f = files(ROOT);
  if (b.op === 'state') {
    const cfg = readJson(path.join(dir, 'episode.json'), {});
    const take = b.asset ? takeOf(dir, b.asset).take : null;
    return { ready: fs.existsSync(f.py) && fs.existsSync(f.model), take, objects: (cfg.keep_objects || {})[take] || [] };
  }
  if (b.op === 'frame') return ask(ROOT, { cmd: 'frame', take: takeOf(dir, b.asset).file, t: +b.t || 0 });
  if (b.op === 'mask') return ask(ROOT, { cmd: 'mask', points: (b.points || []).map((q) => q.map(Number)) }, 30e3);
  if (b.op === 'save') {
    const { take } = takeOf(dir, b.asset);
    const ef = path.join(dir, 'episode.json');
    const cfg = readJson(ef, {});
    const objs = (b.objects || []).filter((o) => o?.points?.some((q) => +q[2] !== 0)).map((o) => ({
      what: String(o.what || '').slice(0, 60) || 'a thing', t: +(+o.t).toFixed(3), points: o.points.map((q) => [+(+q[0]).toFixed(4), +(+q[1]).toFixed(4), +q[2] ? 1 : 0]),
      ...(o.from != null ? { from: +o.from } : {}), ...(o.to != null ? { to: +o.to } : {}) }));
    cfg.keep_objects = { ...(cfg.keep_objects || {}) };
    if (objs.length) cfg.keep_objects[take] = objs; else delete cfg.keep_objects[take];
    if (!Object.keys(cfg.keep_objects).length) delete cfg.keep_objects;
    writeJson(ef, cfg);
    return b.build ? pub(runJob(id, ['--preview'])) : { ok: true };
  }
  return { error: 'op: state | frame | mask | save' };
};
