// The export's animated thoughts: each thought rendered frame by frame in headless Chrome with the editor's own
// motion (render/ui/thought_anim.js), then made into a transparent clip that the compose step lays over the video.
//   node tools/thought_frames.mjs <spec.json>
// spec: { fontsDir, fps, items: [{ out (.mov), text, y, size, start, end }] }  - each item's clip covers y0..y0+h (written back)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from '../render/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const fonts = path.resolve(spec.fontsDir).replace(/\\/g, '/');
const chrome = new URL('../render/node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe', import.meta.url).pathname.slice(1);
const anim = fs.readFileSync(new URL('../render/ui/thought_anim.js', import.meta.url), 'utf8').replace(/^export /gm, '');
const fps = spec.fps || 30;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "zc-assistant"; src: url("file:///${fonts}/Assistant.ttf"); }
html, body { margin: 0; background: transparent; width: 1080px; height: 1920px; overflow: hidden; }
#box { position: absolute; left: 60px; right: 60px; display: flex; flex-wrap: wrap; justify-content: center; align-items: baseline;
  gap: 4px 20px; direction: rtl; font-family: "zc-assistant", "Segoe UI", sans-serif; }
#box span { display: inline-block; white-space: nowrap; }
</style></head><body><div id="box"></div><script>${anim}
window.setup = (it) => {
  const box = document.getElementById('box');
  box.style.top = it.y + 'px';
  Object.assign(box.style, { color: THOUGHT_STYLE.color, fontWeight: THOUGHT_STYLE.fontWeight, lineHeight: THOUGHT_STYLE.lineHeight, textShadow: THOUGHT_STYLE.textShadow });
  window.W = thoughtWords(it.text, it.size || 70);
  box.innerHTML = '';
  for (const w of W) { const s = document.createElement('span'); s.textContent = w.w; s.style.fontSize = w.size + 'px'; s.style.marginTop = w.dy + 'px'; box.appendChild(s); }
  window.IT = it;
};
window.at = (t) => {
  const box = document.getElementById('box');
  box.style.transform = lineDrift(t, IT.start, IT.text, IT.motion);
  [...box.children].forEach((s, i) => { const st = wordState(i, W.length, t, IT.start, IT.end, IT.motion);
    s.style.opacity = st.opacity; s.style.filter = st.filter; s.style.transform = 'rotate(' + W[i].rot.toFixed(2) + 'deg) ' + st.transform; });
};
</script></body></html>`;
const page_file = path.join(path.dirname(path.resolve(process.argv[2])), '_thought.html');
fs.writeFileSync(page_file, html);

const b = await puppeteer.launch({ executablePath: chrome, args: ['--allow-file-access-from-files'] });
const p = await b.newPage();
await p.setViewport({ width: 1080, height: 1920 });
await p.goto('file:///' + page_file.replace(/\\/g, '/'));
await p.evaluate(async () => { await document.fonts.load('70px "zc-assistant"'); await document.fonts.ready; });
for (const it of spec.items) {
  await p.evaluate((it) => window.setup(it), it);
  const y0 = Math.max(0, Math.round(it.y - 220)), h = Math.min(1920 - y0, 900) & ~1;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zc-thought-'));
  const n = Math.max(1, Math.ceil((it.end - it.start) * fps));
  for (let f = 0; f < n; f++) {
    await p.evaluate((t) => window.at(t), it.start + f / fps);
    await p.screenshot({ path: path.join(dir, `${String(f).padStart(5, '0')}.png`), omitBackground: true, clip: { x: 0, y: y0, width: 1080, height: h } });
  }
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(fps), '-i', path.join(dir, '%05d.png'), '-c:v', 'qtrle', '-pix_fmt', 'argb', it.out]);
  fs.rmSync(dir, { recursive: true, force: true });
  it.y0 = y0;
  console.log(`thought ${n} frames -> ${path.basename(it.out)}`);
}
fs.writeFileSync(process.argv[2], JSON.stringify(spec));
await b.close();
