// The export's moving stickers: each drawn frame by frame in headless Chrome with the editor's own motion
// (render/ui/sticker_anim.js), then made into a transparent clip that the compose step lays over the video.
//   node tools/sticker_frames.mjs <spec.json>
// spec: { fps, items: [{ out (.mov), o (the overlay, with image_abs) }] }  - a clip covers the whole frame (y0 0)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from '../render/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const chrome = new URL('../render/node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe', import.meta.url).pathname.slice(1);
const anim = fs.readFileSync(new URL('../render/ui/sticker_anim.js', import.meta.url), 'utf8').replace(/^export /gm, '');
const fps = spec.fps || 30;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
html, body { margin: 0; background: transparent; width: 1080px; height: 1920px; overflow: hidden; }
img { position: absolute; left: 0; top: 0; transform-origin: 50% 50%; }
</style></head><body><div id="root"></div><script>${anim}
window.setup = async (o) => {
  window.O = o;
  const root = document.getElementById('root'); root.innerHTML = '';
  const n = o.motion === 'rain' ? (o.count || 22) : 1;
  for (let i = 0; i < n; i++) { const im = document.createElement('img'); im.src = 'file:///' + o.image_abs; root.appendChild(im); }
  await Promise.all([...root.children].map((im) => im.decode().catch(() => {})));
};
window.at = (t) => {
  const ims = [...document.getElementById('root').children];
  if (O.motion === 'rain') {
    const r = rainBills(O, t);
    ims.forEach((im, i) => { const p = r[i]; if (!p) { im.style.opacity = 0; return; }
      Object.assign(im.style, { left: p.x + 'px', top: p.y + 'px', width: p.w + 'px', opacity: p.opacity, transform: p.transform }); });
  } else {
    const s = stickerPop(O, t);
    Object.assign(ims[0].style, { left: (O.x ?? 540) + 'px', top: (O.y ?? 700) + 'px', width: (O.w || 520) + 'px', opacity: s.opacity, transform: s.transform });
  }
};
</script></body></html>`;
const page_file = path.join(path.dirname(path.resolve(process.argv[2])), '_sticker.html');
fs.writeFileSync(page_file, html);

const b = await puppeteer.launch({ executablePath: chrome, args: ['--allow-file-access-from-files'] });
const p = await b.newPage();
await p.setViewport({ width: 1080, height: 1920 });
await p.goto('file:///' + page_file.replace(/\\/g, '/'));
for (const it of spec.items) {
  await p.evaluate(async (o) => window.setup(o), it.o);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zc-sticker-'));
  const n = Math.max(1, Math.ceil((it.o.end - it.o.start) * fps));
  for (let f = 0; f < n; f++) {
    await p.evaluate((t) => window.at(t), it.o.start + f / fps);
    await p.screenshot({ path: path.join(dir, `${String(f).padStart(5, '0')}.png`), omitBackground: true });
  }
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(fps), '-i', path.join(dir, '%05d.png'), '-c:v', 'qtrle', '-pix_fmt', 'argb', it.out]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`sticker ${n} frames -> ${path.basename(it.out)}`);
}
await b.close();
