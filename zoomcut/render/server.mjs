// zoomcut review screen — http://localhost:4747
// Serves the UI (vite middleware), the episode media (with Range, so the preview can seek),
// and a small API that rewrites corrections.json / episode.json and re-runs the planner.
import express from 'express';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer as createVite } from 'vite';
import react from '@vitejs/plugin-react';
import { sendEmail, sendTelegram, sizedCopy } from './share.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const EPS = path.join(ROOT, 'episodes');
const PY = path.join(ROOT, '.venv', 'Scripts', 'python.exe');
const PORT = Number(process.env.PORT || 4747);

const app = express();
app.use(express.json({ limit: '2mb' }));
// the editor's videos and sounds load from this same server under its other name (127.0.0.1 <-> localhost): a browser
// opens at most 6 connections per host, the media streams held all of them and the saves (POST) waited forever.
// Another host = its own 6. The sounds go through Web Audio, so the media answers carry CORS.
app.use('/media', (_q, res, next) => { res.set('Access-Control-Allow-Origin', '*'); next(); });
const mediaHost = (q) => {
  const h = String(q.headers.host || '');
  return h.startsWith('localhost') ? `http://${h.replace(/^localhost/, '127.0.0.1')}`
    : h.startsWith('127.0.0.1') ? `http://${h.replace(/^127\.0\.0\.1/, 'localhost')}` : '';  // (another device: as it is)
};

const epDir = (id) => {
  const d = path.join(EPS, path.basename(id));
  if (!fs.existsSync(path.join(d, 'episode.json'))) throw Object.assign(new Error('no such episode'), { status: 404 });
  return d;
};
const readJson = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2), 'utf8');

// one job per episode at a time; the UI polls its log. A job runs detached from this server (tools/jobwrap.mjs):
// its log and exit code live in episodes/<id>/work/job.log + job.json, so a page refresh or a server restart never
// loses it - the server attaches to it again on start, and sends the export where it was asked to when it finishes.
const jobs = {};
// the export is older than the project's latest change (settings, subtitles, the edit) - the editor asks before sending it
const exportStale = (id) => {
  const out = path.join(EPS, id, 'out', `${id}.mp4`);
  if (!fs.existsSync(out)) return false;
  const t = fs.statSync(out).mtimeMs;
  return ['episode.json', 'captions.txt', 'work/edit.json'].some((f) => { try { return fs.statSync(path.join(EPS, id, f)).mtimeMs > t + 2000; } catch { return false; } });
};
// an export file the editor offers (Open MP4 / Email / Telegram): there, and not one being written or a failed one
const exportDone = (id) => {
  if (!fs.existsSync(path.join(EPS, id, 'out', `${id}.mp4`))) return false;
  const s = readJson(path.join(EPS, id, 'work', 'job.json'), null);
  return !(s && s.kind === 'export' && (s.running || s.code !== 0));
};
const pub = (j) => j && { running: j.running, kind: j.kind, log: j.log, code: j.code, send: j.send || [] };
const jobFiles = (id) => { const w = path.join(EPS, id, 'work'); fs.mkdirSync(w, { recursive: true }); return { log: path.join(w, 'job.log'), state: path.join(w, 'job.json') }; };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
function runJob(id, args, _onSuccess, send = []) {
  const prev = jobs[id];
  if (prev?.running) return prev;
  const kind = args.includes('--preview') ? 'preview' : 'export';
  // the lesson template (one speaker, takes in order) has its own pipeline
  const lesson = readJson(path.join(EPS, id, 'episode.json'), {}).type === 'lesson';
  const cmd = lesson ? ['lesson.py', `episodes/${id}`, ...args.filter((a) => a === '--preview')] : ['zoomcut.py', 'build', `episodes/${id}`, ...args];
  const f = jobFiles(id);
  fs.writeFileSync(f.log, '');
  writeJson(f.state, { kind, send, sent: false, running: true, code: null, started: Date.now() });
  const out = fs.openSync(f.log, 'a');
  const p = spawn(process.execPath, [path.join(ROOT, 'tools', 'jobwrap.mjs'), f.state, PY, ...cmd],
    { cwd: ROOT, env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, detached: true, stdio: ['ignore', out, out], windowsHide: true });
  p.unref();
  fs.closeSync(out);
  const st = readJson(f.state, {});
  writeJson(f.state, { ...st, pid: p.pid });
  return attach(id);
}
// follow a job from its files (a new one, or one still running from before a restart)
function attach(id) {
  const f = jobFiles(id);
  const st = readJson(f.state, {});
  const job = (jobs[id] = { running: !!st.running, kind: st.kind, log: [], code: st.code ?? null, send: st.send || [], pid: st.pid, started: st.started });
  let pos = 0;
  const take = (b) => {
    for (const line of b.toString('utf8').split(/\r?\n|\r/)) {
      if (!line.trim()) continue;
      if (/^Rendered \d+\/\d+/.test(line) && job.log.length && /^Rendered/.test(job.log.at(-1))) job.log[job.log.length - 1] = line;
      else job.log.push(line);
    }
    if (job.log.length > 400) job.log.splice(0, job.log.length - 400);
  };
  const tick = () => {
    try { const b = fs.readFileSync(f.log); if (b.length > pos) { take(b.subarray(pos)); pos = b.length; } } catch {}
    const s = readJson(f.state, {});
    if (s.running && s.pid && !alive(s.pid)) Object.assign(s, { running: false, code: s.code ?? -1, ended: Date.now() }), writeJson(f.state, s);
    if (s.running) return;
    clearInterval(iv);
    job.running = false; job.code = s.code; job.ended = s.ended;
    finishSends(id);
  };
  const iv = setInterval(tick, 500);
  tick();
  return job;
}
// an export that ended well: send it where it was asked to (once)
async function finishSends(id) {
  const f = jobFiles(id), s = readJson(f.state, {});
  if (s.kind !== 'export' || s.code !== 0 || s.sent || !(s.send || []).length) return;
  writeJson(f.state, { ...s, sent: true });
  for (const ch of s.send) {
    const sh = startShare(id, ch);
    while (sh.running) await new Promise((r) => setTimeout(r, 500));
  }
}
// on start: jobs still running from before (or finished while the server was down) are picked up again
setTimeout(() => {
  for (const id of fs.readdirSync(EPS)) {
    const s = readJson(path.join(EPS, id, 'work', 'job.json'), null);
    if (!s) continue;
    if (s.running || (s.kind === 'export' && s.code === 0 && !s.sent && Date.now() - (s.ended || 0) < 3 * 3600e3)) attach(id);
  }
}, 500);

// the projects, newest first (by when the folder was made); "done" ones are marked
app.get('/api/episodes', (_q, res) => {
  const list = fs.readdirSync(EPS).filter((d) => !d.startsWith('_') && fs.existsSync(path.join(EPS, d, 'episode.json')));  // (_name: a test, not in the list)
  res.json(list.map((id) => {
    const cfg = readJson(path.join(EPS, id, 'episode.json'), {});
    return { id, title: cfg.title || id, done: !!cfg.done, created: fs.statSync(path.join(EPS, id)).birthtimeMs,
      template: cfg.type === 'lesson' ? 'Solo' : 'Zoom', test: id.endsWith('-test') };
  }).sort((a, b) => b.created - a.created));
});

// mark a project done / not done (the dropdown shows it differently)
app.post('/api/ep/:id/done', (q, res) => {
  const d = epDir(q.params.id);
  const cfg = readJson(path.join(d, 'episode.json'));
  cfg.done = !!q.body?.done;
  writeJson(path.join(d, 'episode.json'), cfg);
  res.json({ ok: true, done: cfg.done });
});

// every take whole (work/public/takes): {take: {cut, plain, raw}} - the editor plays the cut over these, so a piece's
// edge dragged shows the new part at once; null until they are made (an older project: /takes makes them)
const takeLayers = (id, layer) => {
  const dir = path.join(EPS, id, 'work', 'public', 'takes');
  if (!fs.existsSync(dir)) return null;
  const out = {};
  for (const f of fs.readdirSync(dir)) {
    const m = /^(.+?)(\.raw\.webm|\.plain\.mp4|\.webm)$/.exec(f);
    if (!m) continue;
    (out[m[1]] = out[m[1]] || {})[m[2] === '.webm' ? 'cut' : m[2] === '.raw.webm' ? 'raw' : 'plain'] = layer('takes/' + f);
  }
  return Object.keys(out).length ? out : null;
};
const making = {};  // projects whose take videos are being made now (once per project)
app.post('/api/ep/:id/takes', (q, res) => {
  const id = q.params.id;
  if (making[id]) return making[id].then((r) => res.json(r));
  making[id] = new Promise((done) => {
    const p = spawn(PY, ['lesson.py', `episodes/${id}`, '--takes'], { cwd: ROOT, env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, windowsHide: true });
    let err = '';
    p.stderr.on('data', (b) => (err += b));
    p.on('close', (code) => { delete making[id]; done(code ? { error: err.slice(-400) } : { ok: true }); });
  });
  making[id].then((r) => res.json(r));
});

app.get('/api/ep/:id', (q, res) => {
  const d = epDir(q.params.id);
  const w = (f) => path.join(d, 'work', f);
  const dialogue = w('public/dialogue.wav');
  const episode = readJson(path.join(d, 'episode.json'));
  if (episode?.type === 'lesson') {
    const out = path.join(d, 'out', `${q.params.id}.mp4`);
    const prev = w('public/preview.mp4');
    const layer = (f) => (fs.existsSync(w('public/' + f)) ? { url: `${mediaHost(q)}/media/${q.params.id}/${f}`, v: fs.statSync(w('public/' + f)).mtimeMs } : null);
    const stem = (k) => layer(`${k}.wav`) || layer(`${k}.m4a`);  // the export's own wav files (older previews: m4a)
    return res.json({
      layers: { person: layer('person.webm'), person_raw: layer('person_raw.webm'), plain: layer('plain.mp4'), scene: layer('scene.png'), plaque: layer('plaque.png'),
        voice: stem('voice'), voice_dn: stem('voice_dn'), fx: stem('fx'), music: stem('music'), intro: layer('intro.mp4'), takes: takeLayers(q.params.id, layer) },
      preview: fs.existsSync(prev) ? `/media/${q.params.id}/preview.mp4` : null,
      previewVersion: fs.existsSync(prev) ? fs.statSync(prev).mtimeMs : null,
      episode, lesson: { captions: fs.existsSync(path.join(d, 'captions.txt')) ? fs.readFileSync(path.join(d, 'captions.txt'), 'utf8') : '', edit: readJson(w('edit.json')) },
      state: null, edit: null, footage: null, corrections: { lines: {} },
      output: exportDone(q.params.id) ? `/media/${q.params.id}/out` : null, outputStale: exportStale(q.params.id),
      outputVersion: fs.existsSync(out) ? fs.statSync(out).mtimeMs : null,
      job: pub(jobs[q.params.id]),
    });
  }
  res.json({
    episode: readJson(path.join(d, 'episode.json')),
    corrections: readJson(path.join(d, 'corrections.json'), { lines: {} }),
    state: readJson(w('state.json')),
    edit: readJson(w('edit.json')),
    footage: readJson(w('footage.json')),
    audioVersion: fs.existsSync(dialogue) ? fs.statSync(dialogue).mtimeMs : null,
    output: exportDone(q.params.id) ? `/media/${q.params.id}/out` : null, outputStale: exportStale(q.params.id),
    job: pub(jobs[q.params.id]),
  });
});

// lesson template: save subtitles / title / plaque and rebuild — {captions?, title?, plaque?}
app.post('/api/ep/:id/lesson', (q, res) => {
  const d = epDir(q.params.id);
  const b = q.body || {};
  if (typeof b.captions === 'string') fs.writeFileSync(path.join(d, 'captions.txt'), b.captions, 'utf8');
  const cfg = readJson(path.join(d, 'episode.json'));
  if (typeof b.title === 'string') cfg.title = b.title;
  if (Array.isArray(b.plaque)) cfg.plaque = b.plaque;
  if (b.speed) cfg.speed = Math.min(2, Math.max(0.5, +Number(b.speed).toFixed(3)));  // a preset or his exact number
  writeJson(path.join(d, 'episode.json'), cfg);
  res.json(pub(runJob(q.params.id, ['--preview'])));
});

// the cut tool: split a piece at a moment of its take, or remove a piece - the rest closes up; rebuild
app.post('/api/ep/:id/cutop', (q, res) => {
  const d = epDir(q.params.id);
  const cfg = readJson(path.join(d, 'episode.json'));
  const { op, take, t, a, b } = q.body || {};
  cfg.cut = cfg.cut || {};
  if (op === 'split' && Number.isFinite(+t)) (cfg.cut.splits = cfg.cut.splits || {})[take] = [...((cfg.cut.splits || {})[take] || []), +(+t).toFixed(3)];
  else if (op === 'remove' && Number.isFinite(+a) && Number.isFinite(+b)) (cfg.cut.removes = cfg.cut.removes || {})[take] = [...((cfg.cut.removes || {})[take] || []), [+(+a).toFixed(3), +(+b).toFixed(3)]];
  else if ((op === 'start' || op === 'end') && Number.isFinite(+t)) cfg.cut[`video_${op}`] = { take, t: +(+t).toFixed(3) };
  else if (op === 'clear-ends') { delete cfg.cut.video_start; delete cfg.cut.video_end; }
  else if (op === 'restore') { if (cfg.cut.removes) delete cfg.cut.removes[take]; if (cfg.cut.splits) delete cfg.cut.splits[take]; }
  else return res.status(400).json({ error: 'op' });
  writeJson(path.join(d, 'episode.json'), cfg);
  // the cut is only a list of parts of the takes: with the takes' full videos in the editor, it changes at once
  if (takeLayers(q.params.id, () => 1)) return replanNow(q.params.id, res);
  // (an older project without them: End here / Reset shorten the built edit in place, the rest rebuilds)
  const ef = path.join(d, 'work', 'edit.json'), full = path.join(d, 'work', 'edit.full.json');
  if (op === 'end' && fs.existsSync(ef)) {
    const e = readJson(ef);
    if (!fs.existsSync(full)) fs.copyFileSync(ef, full);
    const src = readJson(full);
    const it = (src.items || []).find((x) => x.kind === 'clip' && x.take === take && x.a <= +t && +t <= x.a + (x.an ?? x.n) / 30 + 0.02);
    if (it) {
      const endF = Math.round(it.out + (+t - it.a) * 30);
      Object.assign(e, src, { total: endF,
        items: src.items.filter((x) => x.out < endF).map((x) => (x.out + x.n > endF ? { ...x, n: endF - x.out } : x)),
        captions: (src.captions || []).filter((c) => c.from < endF).map((c) => ({ ...c, to: Math.min(c.to, endF) })) });
      writeJson(ef, e);
      return res.json({ ok: true, live: true });
    }
  }
  if (op === 'clear-ends' && fs.existsSync(full) && !cfg.cut.video_start) {
    fs.copyFileSync(full, ef);
    fs.rmSync(full);
    return res.json({ ok: true, live: true });
  }
  res.json(pub(runJob(q.params.id, ['--preview'])));
});
// the cut, subtitles and sound again, no picture work (about a second): the answer comes when it is done
const replanNow = (id, res) => {
  const p = spawn(PY, ['lesson.py', `episodes/${id}`, '--replan'], { cwd: ROOT, env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, windowsHide: true });
  let err = '';
  p.stderr.on('data', (b) => (err += b));
  p.on('close', (code) => res.json(code ? { error: err.slice(-400) } : { ok: true, live: true }));
};

// lesson: a cut piece's edge dragged on the timeline - more (or less) of the original take before / after it
app.post('/api/ep/:id/trim', (q, res) => {
  const d = epDir(q.params.id);
  const cfg = readJson(path.join(d, 'episode.json'));
  const { take, from, to } = q.body || {};
  if (!take || !Number.isFinite(+from) || !Number.isFinite(+to)) return res.status(400).json({ error: 'take, from, to' });
  cfg.cut = cfg.cut || {};
  cfg.cut.edges = cfg.cut.edges || {};
  const list = (cfg.cut.edges[take] = cfg.cut.edges[take] || []);
  const moved = list.find((e) => Math.abs(e[1] - from) < 0.04);  // an edge dragged before: it moves again
  if (moved) moved[1] = +(+to).toFixed(3);
  else list.push([+(+from).toFixed(3), +(+to).toFixed(3)]);
  writeJson(path.join(d, 'episode.json'), cfg);
  if (!takeLayers(q.params.id, () => 1)) return res.json(pub(runJob(q.params.id, ['--preview'])));  // (no take videos yet: the old way)
  replanNow(q.params.id, res);
});

// the editor's tool buttons: change a project setting, rebuild the layers when the picture or sound depends on it
const CONFIG_KEYS = ['cutout', 'keep', 'denoise', 'cut', 'background', 'sounds', 'eye_contact', 'captions_style', 'voice', 'fx'];
app.post('/api/ep/:id/config', (q, res) => {
  const d = epDir(q.params.id);
  const cfg = readJson(path.join(d, 'episode.json'));
  const patch = q.body?.patch || {};
  for (const k of Object.keys(patch)) {
    if (!CONFIG_KEYS.includes(k)) continue;
    if (patch[k] === null) delete cfg[k]; else cfg[k] = patch[k];
  }
  writeJson(path.join(d, 'episode.json'), cfg);
  res.json(q.body?.rebuild ? pub(runJob(q.params.id, ['--preview'])) : { ok: true });
});

// "New video": the folders in Downloads that hold footage, and a project made from a template (optionally with an
// earlier project's settings - same series: set, music, voice, subtitle style)
const DOWNLOADS = path.join(process.env.USERPROFILE || 'C:/Users/shazbak', 'Downloads');
const VIDEO = /\.(mp4|mov|m4v)$/i;
app.get('/api/downloads', (_q, res) => {
  const out = [];
  for (const f of fs.readdirSync(DOWNLOADS)) {
    const p = path.join(DOWNLOADS, f);
    try {
      if (!fs.statSync(p).isDirectory()) continue;
      const vids = fs.readdirSync(p).filter((x) => VIDEO.test(x));
      if (vids.length) out.push({ name: f, path: p.split(path.sep).join('/'), videos: vids.length, files: vids.slice(0, 8), mtime: fs.statSync(p).mtimeMs });
    } catch {}
  }
  res.json(out.sort((a, b) => b.mtime - a.mtime));
});
app.post('/api/new', (q, res) => {
  const { name, template, folder, from } = q.body || {};
  const id = String(name || '').trim().toLowerCase().replace(/[^a-z0-9א-ת-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!id || fs.existsSync(path.join(EPS, id))) return res.status(400).json({ error: id ? 'A project with this name exists' : 'Give it a name' });
  if (!folder || !fs.existsSync(folder)) return res.status(400).json({ error: 'Pick the footage folder' });
  const dst = path.join(EPS, id);
  const py = path.join(ROOT, '.venv', 'Scripts', 'python.exe');
  try {
    if (template === 'zoom') {
      execFileSync(py, ['zoomcut.py', 'new', `episodes/${id}`], { cwd: ROOT });
      const cfg = readJson(path.join(dst, 'episode.json'));
      cfg.input_dir = folder; cfg.title = name;
      writeJson(path.join(dst, 'episode.json'), cfg);
    } else if (from) {
      execFileSync(py, ['lesson.py', 'new', `episodes/${id}`, '--from', from, '--input', folder, '--takes', '*.[mM][pPoO][4vV]'], { cwd: ROOT });
      const cfg = readJson(path.join(dst, 'episode.json'));
      cfg.title = name; delete cfg.done; delete cfg.placeholder; delete cfg._todo;
      for (const k of ['sounds', 'sounds_pending', 'keep']) delete cfg[k];          // those belong to the earlier video's takes
      cfg.overlays = (cfg.overlays || []).filter((o) => o.style === 'ticker');         // a series ticker stays; that video's texts do not
      if (cfg.cut) for (const k of ['edges', 'keep_pauses', 'lead_in', 'end_at']) delete cfg.cut[k];
      writeJson(path.join(dst, 'episode.json'), cfg);
    } else {
      fs.mkdirSync(dst, { recursive: true });
      writeJson(path.join(dst, 'episode.json'), { type: 'lesson', title: name, input_dir: folder, takes: '*.[mM][pPoO][4vV]',
        background: '../_assets/tadar/studio.jpg', plaque: [], matte_engine: 'hybrid', matte_cut: 70, person: { scale: 1, x: 0, y: 0 },
        captions_y: 1330, captions_style: { font: 'assistant', weight: 800, size: 64, color: '#ffffff', stroke: 10 }, voice: 'natural',
        cut: { merge: 0.6, pad_in: 0.08, pad_out: 0.35, join: 0.08 }, overlays: [] });
      const vids = fs.readdirSync(folder).filter((x) => VIDEO.test(x)).sort();
      fs.writeFileSync(path.join(dst, 'captions.txt'), '# Subtitles, one block per take (in order). Timing is aligned to the audio automatically.\n'
        + vids.map((v) => `== ${v.replace(/\.[^.]+$/, '')}\n\n`).join(''));
    }
  } catch (e) { return res.status(500).json({ error: String(e.stderr || e.message).slice(-400) }); }
  res.json({ ok: true, id });
});

// a project's own media (its logos, pictures): episode.json "media" lists them; a file added in the editor is saved
// in episodes/<id>/media/ (raw body, name in ?name=)
app.post('/api/ep/:id/media', express.raw({ type: '*/*', limit: '60mb' }), (q, res) => {
  const d = epDir(q.params.id);
  const name = path.basename(String(q.query.name || 'file')).replace(/[^\w.\-א-ת ]+/g, '_');
  if (!/\.(png|jpe?g|webp|gif|mp3|wav|m4a|mp4|mov)$/i.test(name)) return res.status(400).json({ error: 'A picture, sound or video file' });
  fs.mkdirSync(path.join(d, 'media'), { recursive: true });
  fs.writeFileSync(path.join(d, 'media', name), q.body);
  let rel = `media/${name}`;
  if (/\.(jpe?g|png|webp)$/i.test(name) && q.query.cutout !== '0') {  // a logo on a white / cream sheet: cut it out
    const out = path.join(d, 'media', name.replace(/\.[^.]+$/, '') + '.cut.png');
    try {
      execFileSync(path.join(ROOT, '.venv', 'Scripts', 'python.exe'), [path.join(ROOT, 'tools', 'cutout_logo.py'), path.join(d, 'media', name), out], { cwd: ROOT });
      rel = `media/${path.basename(out)}`;
    } catch {}
  }
  const cfg = readJson(path.join(d, 'episode.json'));
  cfg.media = [...new Set([...(cfg.media || []), rel])];
  writeJson(path.join(d, 'episode.json'), cfg);
  res.json({ ok: true, media: cfg.media });
});
app.post('/api/ep/:id/media/remove', (q, res) => {
  const d = epDir(q.params.id);
  const cfg = readJson(path.join(d, 'episode.json'));
  cfg.media = (cfg.media || []).filter((m) => m !== q.body?.path);  // off the project's list (the file stays)
  writeJson(path.join(d, 'episode.json'), cfg);
  res.json({ ok: true, media: cfg.media });
});

// sounds moved / removed in the editor: saved, then only the sound layers are made again (seconds) - no job, no picture work
app.post('/api/ep/:id/sounds', (q, res) => {
  const d = epDir(q.params.id);
  const cfg = readJson(path.join(d, 'episode.json'));
  cfg.sounds = Array.isArray(q.body?.sounds) ? q.body.sounds : [];
  if (Array.isArray(q.body?.overlays)) cfg.overlays = q.body.overlays;  // (thought bubbles tied to a sound follow its index)
  if (Number.isInteger(q.body?.sound_lanes)) cfg.sound_lanes = Math.max(0, q.body.sound_lanes);  // the sound layers (an empty one stays)
  writeJson(path.join(d, 'episode.json'), cfg);
  const p = spawn(PY, ['lesson.py', `episodes/${q.params.id}`, '--stems'], { cwd: ROOT, env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, windowsHide: true });
  let err = '';
  p.stderr.on('data', (b) => (err += b));
  p.on('close', (code) => res.json(code ? { error: err.slice(-400) } : { ok: true, sounds: readJson(path.join(d, 'work', 'edit.json'), {}).sounds || [] }));
});
// the music bed moved / its ends dragged / taken off on its lane: saved, then only the sound layers are made again
app.post('/api/ep/:id/music-time', (q, res) => {
  const d = epDir(q.params.id);
  const cfg = readJson(path.join(d, 'episode.json'));
  if (!cfg.music) return res.json({ error: 'no music in this project' });
  const b = q.body || {};
  if ('start' in b) cfg.music.start = Math.max(0, +(+b.start || 0).toFixed(2));
  if ('end' in b) cfg.music.end = b.end == null ? null : +(+b.end).toFixed(2);
  if ('off' in b) { if (b.off) cfg.music.off = true; else delete cfg.music.off; }
  if ('lift' in b) { const l = +(b.lift?.db ?? b.lift) || 0; if (l) cfg.music.lift = { db: Math.max(0, Math.min(18, l)), fade: Math.max(0.1, Math.min(4, +(b.lift?.fade ?? 1.2))) }; else delete cfg.music.lift; }  // up at the end card
  if ('duck' in b) cfg.music.duck = Math.max(-18, Math.min(0, Math.round((+b.duck || 0) * 2) / 2));  // dB under his voice
  if ('fade_out' in b) cfg.music.fade_out = Math.max(0, Math.min(6, +(+b.fade_out || 0).toFixed(2)));  // how the music ends
  if (b.sound) { cfg.music.sound = String(b.sound); delete cfg.music.off; }  // a track picked: its bed is made (ducked) now
  writeJson(path.join(d, 'episode.json'), cfg);
  const p = spawn(PY, ['lesson.py', `episodes/${q.params.id}`, '--stems'], { cwd: ROOT, env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, windowsHide: true });
  let err = '';
  p.stderr.on('data', (x) => (err += x));
  p.on('close', (code) => res.json(code ? { error: err.slice(-400) } : { ok: true, music: cfg.music }));
});
// the plain copy of his footage, made now if a project was built before it existed (from its cut person layer)
app.post('/api/ep/:id/plain', (q, res) => {
  const w = path.join(epDir(q.params.id), 'work');
  const out = path.join(w, 'public', 'plain.mp4');
  if (fs.existsSync(out)) return res.json({ ok: true });
  const src = fs.readdirSync(w).filter((f) => /^person\..+\.mp4$/.test(f)).map((f) => path.join(w, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  if (!src) return res.json({ error: 'not built yet' });
  const p = spawn('ffmpeg', ['-y', '-v', 'error', '-i', src, '-vf', 'scale=540:960', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-an', out], { windowsHide: true });
  p.on('close', (code) => res.json(code ? { error: 'ffmpeg' } : { ok: true }));
});

// the library: every set picture and sound effect made so far (episodes/_assets), for any project
const ASSETS = path.join(EPS, '_assets');
let libCache = null;
// every sound in the library, read fresh each time: a sound made a minute ago must be there (the old list was read
// once at start). Not the processed copies (x.mp3.phone.wav) and not the music folders.
const DERIVED = /\.(mp3|m4a|ogg|wav)\..+$/i;
function librarySounds() {
  const out = [];
  const walk = (dir, depth) => {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) { if (depth < 2) walk(p, depth + 1); continue; }
      if (DERIVED.test(f) || !/\.(mp3|wav|m4a|ogg)$/i.test(f)) continue;
      const rel = path.relative(ASSETS, p).split(path.sep).join('/');
      if (/music\//.test(rel)) continue;
      out.push({ name: f.replace(/\.[^.]+$/, ''), folder: rel.split('/')[0], rel, sound: `../_assets/${rel}`, url: `/api/asset?p=${encodeURIComponent(rel)}` });
    }
  };
  walk(ASSETS, 0);
  return out;
}
// the sound picker: this project's sounds first - its series' folder, every folder its sounds / music / intro already
// come from, and its own files (media/) - and the whole library one tab away
app.get('/api/ep/:id/sound-lib', (q, res) => {
  const d = epDir(q.params.id);
  const cfg = readJson(path.join(d, 'episode.json'));
  const all = librarySounds();
  const used = [...(cfg.sounds || []).map((s) => s.sound), cfg.music?.sound, cfg.intro_sound?.sound].filter(Boolean)
    .map((s) => path.resolve(d, s)).filter((p) => p.startsWith(ASSETS))
    .map((p) => path.relative(ASSETS, path.dirname(p)).split(path.sep).join('/'));
  const folders = new Set([cfg.series, ...used].filter(Boolean));
  const project = all.filter((e) => folders.has(path.posix.dirname(e.rel)));
  const md = path.join(d, 'media');
  if (fs.existsSync(md)) for (const f of fs.readdirSync(md)) {
    if (DERIVED.test(f) || !/\.(mp3|wav|m4a|ogg)$/i.test(f)) continue;
    project.push({ name: f.replace(/\.[^.]+$/, ''), folder: 'media', sound: `media/${f}`, url: `/api/ep/${q.params.id}/file?p=${encodeURIComponent(`media/${f}`)}` });
  }
  res.json({ project, all });
});
app.get('/api/library', (_q, res) => {
  if (libCache) libCache.effects = librarySounds();
  if (!libCache) {
    const sets = [], effects = [];
    const walk = (dir, depth) => {
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f), rel = path.relative(ASSETS, p).split(path.sep).join('/');
        if (fs.statSync(p).isDirectory()) { if (depth < 2) walk(p, depth + 1); continue; }
        if (/\.(mp3|m4a|ogg|wav)\.[^.]+$/i.test(f) || /^his_|_cut\.|_SOURCE|netanyahu/i.test(f)) continue;
        const folder = rel.split('/')[0];
        if (/\.(jpe?g|png)$/i.test(f)) {
          let v = false;
          try { const o = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', p]).toString().trim().split(','); v = +o[1] > +o[0]; } catch {}
          if (v) sets.push({ name: f.replace(/\.[^.]+$/, ''), folder, rel });  // a set = an upright picture (9:16)
        } else if (/\.(mp3|wav|m4a)$/i.test(f) && !/music\//.test(rel)) effects.push({ name: f.replace(/\.[^.]+$/, ''), folder, rel });
      }
    };
    walk(ASSETS, 0);
    libCache = { sets, effects: librarySounds() };
  }
  res.json(libCache);
});
app.get('/api/asset', (q, res) => {
  const f = path.resolve(ASSETS, String(q.query.p || ''));
  if (!f.startsWith(ASSETS) || !fs.existsSync(f)) return res.status(404).end();
  res.sendFile(f);
});

// lesson layout (background zoom/position, his size/position): saved only - the editor shows it live, Export uses it
app.post('/api/ep/:id/layout', (q, res) => {
  const d = epDir(q.params.id);
  const cfg = readJson(path.join(d, 'episode.json'));
  if (q.body?.bg) cfg.bg = q.body.bg;
  if (q.body?.person) cfg.person = q.body.person;
  if (q.body?.captions_y != null) cfg.captions_y = q.body.captions_y;
  writeJson(path.join(d, 'episode.json'), cfg);
  res.json({ ok: true });
});

// lesson enhancements (Enhance card): podcast voice, eye contact, music volume, subtitle style - saved; Re-analyze applies them
app.post('/api/ep/:id/options', (q, res) => {
  const d = epDir(q.params.id);
  const cfg = readJson(path.join(d, 'episode.json'));
  const b = q.body || {};
  if ('voice' in b) cfg.voice = b.voice || null;
  if ('eye_contact' in b) cfg.eye_contact = b.eye_contact || null;
  if ('eye_on' in b && cfg.eye_contact) cfg.eye_contact.on = !!b.eye_on;  // live switch: both versions exist
  if ('music_gain' in b && cfg.music) cfg.music.gain = Math.max(0, Math.min(2, Number(b.music_gain) || 0));
  if (b.music_sound && cfg.music) { cfg.music.sound = String(b.music_sound); delete cfg.music.off; }  // the track chosen in the editor (puts music back on)
  if ('captions_style' in b) cfg.captions_style = b.captions_style || null;
  if ('look' in b) cfg.look = b.look || null;  // the live look (smooth / warmth / brightness / saturation)
  writeJson(path.join(d, 'episode.json'), cfg);
  res.json({ ok: true });
});

// the voice's pitch (semitones, the Voice card's Pitch slider): saved, then only the sound layers are made again
app.post('/api/ep/:id/voice-pitch', (q, res) => {
  const d = epDir(q.params.id);
  const cfg = readJson(path.join(d, 'episode.json'));
  const st = Math.max(-6, Math.min(6, Math.round((Number(q.body?.pitch) || 0) * 4) / 4));
  cfg.voice = { ...(typeof cfg.voice === 'object' && cfg.voice ? cfg.voice : { preset: cfg.voice || 'natural' }), pitch: st };
  writeJson(path.join(d, 'episode.json'), cfg);
  const p = spawn(PY, ['lesson.py', `episodes/${q.params.id}`, '--stems'], { cwd: ROOT, env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, windowsHide: true });
  let err = '';
  p.stderr.on('data', (x) => (err += x));
  p.on('close', (code) => res.json(code ? { error: err.slice(-400) } : { ok: true, pitch: st }));
});

// background music choices: every track in the folder of the episode's current music (live switch in the editor)
app.get('/api/ep/:id/music', (q, res) => {
  const d = epDir(q.params.id);
  const cfg = readJson(path.join(d, 'episode.json'));
  if (!cfg.music?.sound) return res.json([]);
  const dir = path.dirname(path.resolve(d, cfg.music.sound));
  const rel = path.relative(d, dir).split(path.sep).join('/');
  const effect = /^(sfx_|beep|pop|whoosh|join|phone|ring|wife|intro)/i;  // one-shot effects are not music beds
  res.json(fs.readdirSync(dir).filter((f) => /\.(mp3|wav|m4a|ogg)$/i.test(f) && !/\.(mp3|m4a|ogg|wav)\.[^.]+$/i.test(f) && !effect.test(f)).sort().map((f) => ({
    name: f.replace(/\.[^.]+$/, ''), sound: `${rel}/${f}`, url: `/api/ep/${q.params.id}/music/${encodeURIComponent(f)}`,
    on: path.resolve(d, cfg.music.sound) === path.join(dir, f),
  })));
});
app.get('/api/ep/:id/music/:file', (q, res) => {
  const d = epDir(q.params.id);
  const cfg = readJson(path.join(d, 'episode.json'));
  const f = path.join(path.dirname(path.resolve(d, cfg.music?.sound || '.')), path.basename(q.params.file));
  if (!fs.existsSync(f)) return res.status(404).end();
  res.sendFile(f);
});

// lesson speed: saved only — the editor plays the preview at this speed live, Export burns it in
app.post('/api/ep/:id/speed', (q, res) => {
  const d = epDir(q.params.id);
  const cfg = readJson(path.join(d, 'episode.json'));
  cfg.speed = Math.min(2, Math.max(0.5, +(Number(q.body?.speed) || 1).toFixed(3)));  // a preset or his exact number
  writeJson(path.join(d, 'episode.json'), cfg);
  res.json({ speed: cfg.speed });
});

// one line's fix: {n, fix: {...} | null}
app.post('/api/ep/:id/line', (q, res) => {
  const d = epDir(q.params.id);
  const p = path.join(d, 'corrections.json');
  const c = readJson(p, { lines: {} });
  c.lines = c.lines || {};
  const { n, fix } = q.body;
  if (!fix || !Object.keys(fix).length) delete c.lines[String(n)];
  else c.lines[String(n)] = fix;
  writeJson(p, c);
  res.json(pub(runJob(q.params.id, ['--preview'])));
});

// footage assignment: {files: {"rel": {"char": "...", "kind": "lines|listen"}}}
app.post('/api/ep/:id/files', (q, res) => {
  const d = epDir(q.params.id);
  const p = path.join(d, 'episode.json');
  const e = readJson(p);
  e.files = { ...(e.files || {}), ...q.body.files };
  writeJson(p, e);
  res.json(pub(runJob(q.params.id, ['--preview'])));
});

// episode-level settings from the screen: {overlays: [...], subtitles: bool, title: str}
app.post('/api/ep/:id/settings', (q, res) => {
  const p = path.join(epDir(q.params.id), 'episode.json');
  const e = readJson(p);
  for (const k of ['overlays', 'subtitles', 'title']) if (k in q.body) e[k] = q.body[k];
  writeJson(p, e);
  res.json(pub(runJob(q.params.id, ['--preview'])));
});

// share the exported MP4: {channel: 'email' | 'telegram', to?}
const shares = {};
function startShare(id, channel, to) {
  const d = epDir(id);
  const master = path.join(d, 'out', `${id}.mp4`);
  const key = `${id}:${channel}`;
  if (shares[key]?.running) return shares[key];
  const job = (shares[key] = { running: true, channel, log: [], ok: null, error: null });
  const log = (m, replace) => { if (replace && job.log.length && job.log.at(-1).startsWith(m.split(' ·')[0])) job.log[job.log.length - 1] = m; else job.log.push(m); };
  const title = readJson(path.join(d, 'episode.json'), {}).title || id;
  (async () => {
    const file = await sizedCopy(master, channel, log);
    if (channel === 'email') log(`Sending ${Math.round(fs.statSync(file).size / 1048576)} MB by email…`);
    if (channel === 'email') {
      const who = await sendEmail({ file, to, subject: `🎬 ${title} — ready for TikTok`,
        text: `${title}

Exported by Sketch Studio. Full-quality master: ${master}` });
      log(`✓ Sent to ${who}`);
    } else {
      await sendTelegram({ file, caption: `🎬 ${title}`, log });
      log('✓ Sent to your Telegram');
    }
    job.ok = true;
  })().catch((e) => { job.ok = false; job.error = e.message; log('failed: ' + e.message); })
    .finally(() => { job.running = false; job.ended = Date.now(); });  // (ended: the editor shows the latest send)
  return job;
}
app.post('/api/ep/:id/share', (q, res) => {
  const id = q.params.id;
  if (!fs.existsSync(path.join(epDir(id), 'out', `${id}.mp4`))) return res.status(400).json({ error: 'Export the video first' });
  res.json(startShare(id, q.body.channel, q.body.to));
});
app.get('/api/ep/:id/share/:channel', (q, res) => res.json(shares[`${q.params.id}:${q.params.channel}`] || null));

// text on video changes instantly: patch episode.json and the current edit — no rebuild needed
app.post('/api/ep/:id/overlays', (q, res) => {
  const d = epDir(q.params.id);
  const e = readJson(path.join(d, 'episode.json'));
  e.overlays = q.body.overlays || [];
  writeJson(path.join(d, 'episode.json'), e);
  const editPath = path.join(d, 'work', 'edit.json');
  const edit = readJson(editPath);
  if (edit?.fps) { // a Zoom edit; a lesson draws its text from episode.json
    const fps = edit.fps, total = edit.durationInFrames;
    edit.overlays = e.overlays.filter((o) => (o.text || '').trim()).map((o) => {
      const from = Math.round((o.start || 0) * fps);
      const end = o.end ? Math.min(total, Math.round(o.end * fps)) : total;
      return { text: o.text, style: o.style || 'pov', from, dur: Math.max(1, end - from), font: o.font || 'system',
        theme: o.theme || 'light', opacity: o.opacity ?? 1, y: o.y ?? null, size: o.size ?? null };
    });
    writeJson(editPath, edit);
  }
  res.json({ ok: true });
});
app.use('/fonts', express.static(path.join(ROOT, 'fonts')));
// Karaoke Booth lives in the BoostMind site; served here too so both tools sit behind one menu on the PC
app.use('/karaoke', express.static('C:/workspace/BoostMind/public/karaoke'));
// Script Reader: read the whole script while filming, with the character you're playing lit up
app.use('/reader', express.static(path.join(HERE, 'reader')));
app.use('/studio', express.static(path.join(HERE, 'studio')));  // the shared top bar + the shell
app.get(['/', '/index.html'], (_q, res) => res.sendFile(path.join(HERE, 'studio', 'index.html')));  // Sketch Studio: rail + tools
// saved scripts for the Reader (prompter texts, pasted dialogues): zoomcut/scripts/<id>.txt, first line "# name"
const SCRIPTS = path.join(ROOT, 'scripts');
const scriptId = (name) => name.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-').slice(0, 60) || 'script';
app.get('/api/scripts', (_q, res) => {
  if (!fs.existsSync(SCRIPTS)) return res.json([]);
  res.json(fs.readdirSync(SCRIPTS).filter((f) => f.endsWith('.txt')).map((f) => {
    const first = fs.readFileSync(path.join(SCRIPTS, f), 'utf8').split(/\r?\n/)[0];
    return { id: f.slice(0, -4), name: first.startsWith('# ') ? first.slice(2) : f.slice(0, -4) };
  }));
});
app.get('/api/scripts/:id', (q, res) => {
  const f = path.join(SCRIPTS, path.basename(q.params.id) + '.txt');
  if (!fs.existsSync(f)) return res.status(404).end();
  res.type('text/plain; charset=utf-8').send(fs.readFileSync(f, 'utf8'));
});
app.post('/api/scripts', (q, res) => {
  const name = String(q.body?.name || '').trim(), id = scriptId(name);
  fs.mkdirSync(SCRIPTS, { recursive: true });
  fs.writeFileSync(path.join(SCRIPTS, id + '.txt'), `# ${name}\n${String(q.body?.text || '')}`, 'utf8');
  res.json({ id });
});
// a project's script: the one it links to ("script": "<id>" -> scripts/<id>.txt) or its own script.txt
function scriptFile(id) {
  const d = epDir(id);
  const cfg = readJson(path.join(d, 'episode.json'), {});
  return cfg.script ? path.join(ROOT, 'scripts', `${cfg.script}.txt`) : path.join(d, 'script.txt');
}
app.get('/api/ep/:id/script', (q, res) => {
  const f = scriptFile(q.params.id);
  if (!fs.existsSync(f)) return res.status(404).end();
  res.type('text/plain; charset=utf-8').send(fs.readFileSync(f, 'utf8'));
});
// a file the episode points at (e.g. a story's picture "../_assets/news/x.jpg"), for the editor - only under episodes/
app.get('/api/ep/:id/file', (q, res) => {
  const f = path.resolve(epDir(q.params.id), String(q.query.p || ''));
  if (!f.startsWith(path.resolve(ROOT, 'episodes')) || !fs.existsSync(f)) return res.status(404).end();
  res.sendFile(f);
});
// a line edited in the Reader: the whole text comes back (only that line changed in it)
app.put('/api/scripts/:id', (q, res) => {
  const f = path.join(SCRIPTS, path.basename(q.params.id) + '.txt');
  if (!fs.existsSync(f)) return res.status(404).end();
  fs.writeFileSync(f, String(q.body?.text ?? ''), 'utf8');
  res.json({ ok: true });
});
app.put('/api/ep/:id/script', (q, res) => {
  const f = scriptFile(q.params.id);  // (a project without one gets its own script.txt)
  if (fs.existsSync(f)) fs.copyFileSync(f, f + '.bak');  // the version before this edit, just in case
  fs.writeFileSync(f, String(q.body?.text ?? ''), 'utf8');
  res.json({ ok: true });
});
// a character's look (framing / colour): patch episode.json and the current edit — no rebuild
app.post('/api/ep/:id/character', (q, res) => {
  const d = epDir(q.params.id);
  const { id, look, frame } = q.body;
  const e = readJson(path.join(d, 'episode.json'));
  const c = (e.characters || []).find((x) => x.id === id);
  if (!c) return res.status(404).json({ error: 'no such character' });
  c.look = look; c.frame = frame;
  writeJson(path.join(d, 'episode.json'), e);
  const editPath = path.join(d, 'work', 'edit.json');
  const edit = readJson(editPath);
  const pp = edit?.participants?.find((x) => x.id === id);
  if (pp) { pp.look = look; pp.frame = frame; writeJson(editPath, edit); }
  res.json({ ok: true });
});

app.get('/api/fonts', (_q, res) => res.json(readJson(path.join(ROOT, 'fonts', 'fonts.json'), [])));

app.post('/api/ep/:id/analyze', (q, res) => res.json(pub(runJob(epDir(q.params.id) && q.params.id, ['--preview']))));
// Export; with {send: ['email', 'telegram']} the finished video goes out by itself, one channel after the other
app.post('/api/ep/:id/export', (q, res) => {
  const id = epDir(q.params.id) && q.params.id;
  const send = (q.body && q.body.send) || [];
  const job = runJob(id, ['--concurrency', '16'], null, send);  // sent by the server when it ends well, even after a restart
  res.json(pub(job));
});
app.get('/api/ep/:id/job', (q, res) => res.json(pub(jobs[q.params.id]) || null));
// Stop button: kill the run and everything it started (ffmpeg, renderer)
app.post('/api/ep/:id/cancel', (q, res) => {
  const job = jobs[q.params.id];
  if (job?.running && (job.pid || job.proc)) {
    job.log.push('■ stopped by you');
    spawn('taskkill', ['/PID', String(job.pid || job.proc.pid), '/T', '/F']);
  }
  res.json(pub(job));
});

// media: clips/backgrounds-composited proxies + preview dialogue, and the finished mp4
app.get('/media/:id/out', (q, res) => res.sendFile(path.join(epDir(q.params.id), 'out', `${q.params.id}.mp4`)));
app.get('/media/:id/*', (q, res) => {
  const base = path.join(epDir(q.params.id), 'work', 'public');
  const f = path.resolve(base, q.params[0]);
  if (!f.startsWith(base) || !fs.existsSync(f)) return res.status(404).end();
  res.sendFile(f, { cacheControl: false }); // sendFile honours Range, so the preview can seek
});

app.use((err, _q, res, _n) => res.status(err.status || 500).json({ error: err.message }));

const vite = await createVite({
  root: path.join(HERE, 'ui'),
  plugins: [react()],
  server: { middlewareMode: true },
  appType: 'spa',
  logLevel: 'warn',
});
app.use(vite.middlewares);
app.listen(PORT, () => console.log(`zoomcut review screen → http://localhost:${PORT}`));
