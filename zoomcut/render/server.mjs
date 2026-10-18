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
  // the lesson template (one speaker, takes in order) has its own pipeline
  const lesson = readJson(path.join(EPS, id, 'episode.json'), {}).type === 'lesson';
  const cmd = lesson ? ['lesson.py', `episodes/${id}`, ...args.filter((a) => a === '--preview')] : ['zoomcut.py', 'build', `episodes/${id}`, ...args];
  const p = (job.proc = spawn(PY, cmd, { cwd: ROOT, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }));
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
  const episode = readJson(path.join(d, 'episode.json'));
  if (episode?.type === 'lesson') {
    const out = path.join(d, 'out', `${q.params.id}.mp4`);
    const prev = w('public/preview.mp4');
    const layer = (f) => (fs.existsSync(w('public/' + f)) ? { url: `/media/${q.params.id}/${f}`, v: fs.statSync(w('public/' + f)).mtimeMs } : null);
    const stem = (k) => layer(`${k}.wav`) || layer(`${k}.m4a`);  // the export's own wav files (older previews: m4a)
    return res.json({
      layers: { person: layer('person.webm'), person_raw: layer('person_raw.webm'), scene: layer('scene.png'), plaque: layer('plaque.png'),
        voice: stem('voice'), voice_dn: stem('voice_dn'), fx: stem('fx'), music: stem('music') },
      preview: fs.existsSync(prev) ? `/media/${q.params.id}/preview.mp4` : null,
      previewVersion: fs.existsSync(prev) ? fs.statSync(prev).mtimeMs : null,
      episode, lesson: { captions: fs.existsSync(path.join(d, 'captions.txt')) ? fs.readFileSync(path.join(d, 'captions.txt'), 'utf8') : '', edit: readJson(w('edit.json')) },
      state: null, edit: null, footage: null, corrections: { lines: {} },
      output: fs.existsSync(out) ? `/media/${q.params.id}/out` : null,
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
    output: fs.existsSync(path.join(d, 'out', `${q.params.id}.mp4`)) ? `/media/${q.params.id}/out` : null,
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
  if (b.speed) cfg.speed = Math.min(1.3, Math.max(1, Number(b.speed)));
  writeJson(path.join(d, 'episode.json'), cfg);
  res.json(pub(runJob(q.params.id, ['--preview'])));
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
  if ('music_gain' in b && cfg.music) cfg.music.gain = Math.max(0, Math.min(1, Number(b.music_gain) || 0));
  if (b.music_sound && cfg.music) cfg.music.sound = String(b.music_sound);  // the track chosen in the editor
  if ('captions_style' in b) cfg.captions_style = b.captions_style || null;
  writeJson(path.join(d, 'episode.json'), cfg);
  res.json({ ok: true });
});

// background music choices: every track in the folder of the episode's current music (live switch in the editor)
app.get('/api/ep/:id/music', (q, res) => {
  const d = epDir(q.params.id);
  const cfg = readJson(path.join(d, 'episode.json'));
  if (!cfg.music?.sound) return res.json([]);
  const dir = path.dirname(path.resolve(d, cfg.music.sound));
  const rel = path.relative(d, dir).split(path.sep).join('/');
  res.json(fs.readdirSync(dir).filter((f) => /\.(mp3|wav|m4a|ogg)$/i.test(f) && !/\.(mp3|m4a|ogg|wav)\.[^.]+$/i.test(f)).sort().map((f) => ({
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
  cfg.speed = Math.min(1.3, Math.max(1, Number(q.body?.speed) || 1));
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
app.get('/api/ep/:id/script', (q, res) => {
  const f = path.join(epDir(q.params.id), 'script.txt');
  if (!fs.existsSync(f)) return res.status(404).end();
  res.type('text/plain; charset=utf-8').send(fs.readFileSync(f, 'utf8'));
});
// a line edited in the Reader: the whole text comes back (only that line changed in it)
app.put('/api/scripts/:id', (q, res) => {
  const f = path.join(SCRIPTS, path.basename(q.params.id) + '.txt');
  if (!fs.existsSync(f)) return res.status(404).end();
  fs.writeFileSync(f, String(q.body?.text ?? ''), 'utf8');
  res.json({ ok: true });
});
app.put('/api/ep/:id/script', (q, res) => {
  const f = path.join(epDir(q.params.id), 'script.txt');
  if (!fs.existsSync(f)) return res.status(404).end();
  fs.copyFileSync(f, f + '.bak');  // the version before this edit, just in case
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
