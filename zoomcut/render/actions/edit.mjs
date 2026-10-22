// An item of a builder's layer was dragged in the editor: {layer, item, side: 'l' | 'r' | 'm', frames}.
// The editor has ALREADY shown the change (live, linked items together); this tells the builder that made the layers,
// in the background, so its next version agrees - the editor never needs to know which builder that is.
//   a grid of people (zoomcut.py): the item's script line gets its fix (take start / end / timing) and re-plans
//   one camera (lesson.py): the cut's edge in the take moves (cut.edges, /trim) and re-cuts in seconds
// {hand: true} = nothing for the builder to do with it: the editor saves its own live edit as his (user: true).
import fs from 'node:fs';
import path from 'node:path';

const readJson = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };

export default async function edit({ id, dir, body, runJob, pub, jobs, PORT }) {
  const project = readJson(path.join(dir, 'project.json'));
  if (!project) return { error: 'no project.json' };
  const fps = project.canvas.fps;
  const layer = project.layers.find((l) => l.id === body.layer);
  const it = layer?.items?.find((i) => i.id === body.item);
  if (!it) return { error: 'no such item' };
  const d = Number(body.frames) || 0, side = body.side, sec = d / fps;
  if (!d) return { ok: true };

  if (project.builder?.kind === 'zoom') {
    const n = it.ref?.line;
    const ln = (project.script || []).find((x) => x.n === n);
    if (n == null || !ln || ln.in == null) return { ok: true, hand: true };  // not a script line: the editor keeps its own edit (saved, his)
    const fx = { ...(ln.fix || {}) };
    let fix;
    if (side === 'm') fix = { ...fx, shift: +((fx.shift || 0) + sec).toFixed(3) };
    else {
      const base = { ...fx, clip: fx.clip ?? ln.clip, in: fx.in ?? ln.in };
      if (side === 'l') fix = ln.interrupted ? { ...base, in: Math.max(0, +(base.in + sec).toFixed(3)), out: undefined, cut: fx.cut ?? ln.cut }
        : { ...base, in: Math.max(0, +(base.in + sec).toFixed(3)), out: fx.out ?? ln.out };
      else if (ln.interrupted) fix = { ...base, out: undefined, cut: +((fx.cut ?? ln.cut) + sec).toFixed(3) };
      else fix = { ...base, out: +((fx.out ?? ln.out) + sec).toFixed(3) };
    }
    const p = path.join(dir, 'corrections.json'), c = readJson(p, { lines: {} }) || { lines: {} };
    c.lines = c.lines || {};
    const keep = c.lines[String(n)]?.caption;
    c.lines[String(n)] = Object.fromEntries(Object.entries({ ...fix, ...(keep ? { caption: keep } : {}) }).filter(([, v]) => v !== undefined && v !== null && v !== ''));
    fs.writeFileSync(p, JSON.stringify(c, null, 2));
    if (jobs[id]?.running) { jobs[id].again = true; return pub(jobs[id]); }  // (a line fixed while it re-plans: once more after)
    return pub(runJob(id, ['--preview']));
  }

  if (project.builder?.kind === 'solo') {  // the cut's edge in the take (lesson.py cut.edges): picture, voice, subtitles follow
    if (side === 'm' || !it.ref?.take || it.rate === 0) return { ok: true, hand: true };
    const voice = project.layers.find((x) => x.id === 'voice')?.items?.find((x) => x.ref?.take === it.ref.take && x.ref?.a === it.ref.a) || it;
    const rate = voice.rate || 1;
    const was = side === 'l' ? voice.in ?? 0 : (voice.in ?? 0) + (voice.dur / fps) * rate;
    const now = Math.max(0, was + sec * rate);
    const r = await fetch(`http://127.0.0.1:${PORT}/api/ep/${encodeURIComponent(id)}/trim`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ take: it.ref.take, from: +was.toFixed(3), to: +now.toFixed(3) }) });
    return r.json();
  }
  return { ok: true, hand: true };
}
