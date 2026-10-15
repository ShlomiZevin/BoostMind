// zoomcut review screen — http://localhost:4747
// Serves the UI (vite middleware), the episode media (with Range, so the preview can seek),
// and a small API that rewrites corrections.json / episode.json and re-runs the planner.
import express from 'express';
import fs from 'node:fs';
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

const epDir = (id) => {
  const d = path.join(EPS, path.basename(id));
  if (!fs.existsSync(path.join(d, 'episode.json'))) throw Object.assign(new Error('no such episode'), { status: 404 });
  return d;
};
const readJson = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2), 'utf8');

// one job per episode at a time; the UI polls its log
const jobs = {};
const pub = (j) => j && { running: j.running, kind: j.kind, log: j.log, code: j.code, send: j.send || [] };
function runJob(id, args, onSuccess) {
  const prev = jobs[id];
  if (prev?.running) return prev;
  const job = { running: true, kind: args.includes('--preview') ? 'preview' : 'export', log: [], code: null, started: Date.now() };
  jobs[id] = job;
  const p = (job.proc = spawn(PY, ['zoomcut.py', 'build', `episodes/${id}`, ...args], { cwd: ROOT, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }));
  const take = (b) => {
    for (const line of b.toString('utf8').split(/\r?\n|\r/)) {
      if (!line.trim()) continue;
      if (/^Rendered \d+\/\d+/.test(line) && job.log.length && /^Rendered/.test(job.log.at(-1))) job.log[job.log.length - 1] = line;
      else job.log.push(line);
    }
    if (job.log.length > 400) job.log.splice(0, job.log.length - 400);
  };
  p.stdout.on('data', take);
  p.stderr.on('data', take);
  p.on('close', (code) => { job.running = false; job.code = code; job.ended = Date.now(); if (!code && onSuccess) onSuccess(); });
  return job;
}

app.get('/api/episodes', (_q, res) => {
  const list = fs.readdirSync(EPS).filter((d) => fs.existsSync(path.join(EPS, d, 'episode.json')));
  res.json(list.map((id) => ({ id, title: readJson(path.join(EPS, id, 'episode.json'), {}).title || id })));
});

app.get('/api/ep/:id', (q, res) => {
  const d = epDir(q.params.id);
  const w = (f) => path.join(d, 'work', f);
  const dialogue = w('public/dialogue.wav');
  res.json({
    episode: readJson(path.join(d, 'episode.json')),
    corrections: readJson(path.join(d, 'corrections.json'), { lines: {} }),
    state: readJson(w('state.json')),
    edit: readJson(w('edit.json')),
    footage: readJson(w('footage.json')),
    audioVersion: fs.existsSync(dialogue) ? fs.statSync(dialogue).mtimeMs : null,
    output: fs.existsSync(path.join(d, 'out', `${q.params.id}.mp4`)) ? `/media/${q.params.id}/out` : null,
    job: pub(jobs[q.params.id]),
  });
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
    .finally(() => { job.running = false; });
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
  if (edit) {
    const fps = edit.fps, total = edit.durationInFrames;
    edit.overlays = e.overlays.filter((o) => (o.text || '').trim()).map((o) => {
      const from = Math.round((o.start || 0) * fps);
      const end = o.end ? Math.min(total, Math.round(o.end * fps)) : total;
      return { text: o.text, style: o.style || 'pov', from, dur: Math.max(1, end - from), font: o.font || 'system',
        theme: o.theme || 'light', opacity: o.opacity ?? 1, y: o.y ?? null };
    });
    writeJson(editPath, edit);
  }
  res.json({ ok: true });
});
app.use('/fonts', express.static(path.join(ROOT, 'fonts')));
// Karaoke Booth lives in the BoostMind site; served here too so both tools sit behind one menu on the PC
app.use('/karaoke', express.static('C:/workspace/BoostMind/public/karaoke'));
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
  const job = runJob(id, ['--concurrency', '16'], async () => {
    for (const ch of send) {
      const s = startShare(id, ch);
      while (s.running) await new Promise((r) => setTimeout(r, 500));
    }
  });
  job.send = send;
  res.json(pub(job));
});
app.get('/api/ep/:id/job', (q, res) => res.json(pub(jobs[q.params.id])));
// Stop button: kill the run and everything it started (ffmpeg, renderer)
app.post('/api/ep/:id/cancel', (q, res) => {
  const job = jobs[q.params.id];
  if (job?.running && job.proc) {
    job.log.push('■ stopped by you');
    spawn('taskkill', ['/PID', String(job.proc.pid), '/T', '/F']);
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
