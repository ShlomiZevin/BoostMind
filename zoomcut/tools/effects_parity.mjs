// Editor vs export for film effects: one picture through the effect layers at a few frames - drawn by the editor
// (render/ui/effect-test.html: CSS) and by the export (pipeline/film_fx.py: OpenCV) - and the difference measured.
//   node tools/effects_parity.mjs <picture.png 1080x1920>      (grain left out: it is random by nature)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(HERE, '..');
const { default: puppeteer } = await import(pathToFileURL(path.join(ROOT, 'render', 'node_modules', 'puppeteer-core', 'lib', 'esm', 'puppeteer', 'puppeteer-core.js')).href);
const chrome = path.join(ROOT, 'render', 'node_modules', '.remotion', 'chrome-headless-shell', 'win64', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const pic = path.resolve(process.argv[2]);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fxpar-'));
const fps = 30, n = 60;
const project = { canvas: { w: 1080, h: 1920, fps }, layers: [
  { id: 'fx.grade', kind: 'effect', props: { filter: 'grade', amount: 0.6, center: [0.5, 0.36] }, items: [{ id: 'a', from: 0, dur: 60, fade_in: 0.5 }] },
  { id: 'fx.vig', kind: 'effect', props: { filter: 'vignette', amount: 0.5 }, items: [{ id: 'a', from: 0, dur: 60, fade_in: 0 }] },
  { id: 'fx.zoom', kind: 'effect', props: { filter: 'zoom', amount: 0.6 }, items: [{ id: 'a', from: 0, dur: 40 }] },
  { id: 'fx.drift', kind: 'effect', props: { filter: 'drift', amount: 0.5 }, items: [{ id: 'a', from: 0, dur: 60, fade_in: 0 }] },
  { id: 'fx.dark', kind: 'effect', props: { filter: 'dark', amount: 0.3 }, items: [{ id: 'a', from: 20, dur: 40, fade_in: 0.3 }] },
  { id: 'fx.hits', kind: 'effect', props: { filter: 'hits' }, items: [{ id: 'h', from: 30, dur: 10, kick: 0.06, shake: 0.4, flash: 0.5 }] },
] };
const frames = [5, 15, 31, 45];

// the export: the picture as a still video -> film_fx.apply_chunk -> the frames
const still = path.join(tmp, 'still.mp4'), out = path.join(tmp, 'fx.mp4');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-loop', '1', '-i', pic, '-t', String(n / fps), '-r', String(fps), '-vf', 'scale=1080:1920,format=yuv420p', '-c:v', 'libx264', '-crf', '8', still]);
const py = path.join(ROOT, '.venv', 'Scripts', 'python.exe');
fs.writeFileSync(path.join(tmp, 'p.json'), JSON.stringify(project));
execFileSync(py, ['-c', `
import json, sys
from pipeline import film_fx
class E:
    def work(self, *p):
        import os; d = os.path.join(r'${tmp}', *p[:-1]); os.makedirs(d, exist_ok=True); return os.path.join(r'${tmp}', *p)
p = json.load(open(r'${path.join(tmp, 'p.json')}'))
film_fx.apply_chunk(E(), p, r'${still}', r'${out}', 0, ${n}, 0, 1080, 1920, crf='8')
`], { cwd: ROOT, stdio: 'inherit' });
for (const f of frames) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', out, '-vf', `select=eq(n\\,${f})`, '-frames:v', '1', path.join(tmp, `exp${f}.png`)]);

// the editor
const b = await puppeteer.launch({ executablePath: chrome });
const p = await b.newPage();
await p.setViewport({ width: 1080, height: 1920 });
await p.goto('http://localhost:4747/effect-test.html', { waitUntil: 'networkidle2' });
const data = 'data:image/png;base64,' + fs.readFileSync(pic).toString('base64');
for (const f of frames) {
  await p.evaluate((d, pr, f) => window.__set(d, pr, f), data, project, f);
  await new Promise((r) => setTimeout(r, 400));
  await p.screenshot({ path: path.join(tmp, `ed${f}.png`) });
}
await b.close();

// the difference (mean absolute, 0-255) on a 270x480 copy of each
for (const f of frames) {
  const raw = (file) => execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'scale=270:480', '-f', 'rawvideo', '-pix_fmt', 'gray', '-']);
  const A = raw(path.join(tmp, `exp${f}.png`)), B = raw(path.join(tmp, `ed${f}.png`)), O = raw(pic);
  let d = 0, d0 = 0;
  for (let i = 0; i < A.length; i++) { d += Math.abs(A[i] - B[i]); d0 += Math.abs(O[i] - B[i]); }
  console.log(`frame ${f}: editor vs export ${(d / A.length).toFixed(2)} · editor vs no effect ${(d0 / A.length).toFixed(2)}`);
}
console.log('frames in', tmp);
