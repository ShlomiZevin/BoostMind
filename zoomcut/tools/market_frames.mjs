// The export's market panels: each panel drawn frame by frame in headless Chrome with the editor's own drawing
// (render/ui/market_anim.js), then made into a transparent clip that the compose step lays over the video.
//   node tools/market_frames.mjs <spec.json>
// spec: { fontsDir, fps, items: [{ out (.mov), o (the overlay) }] }  - each item's clip covers y0..y0+h (written back)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from '../render/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const fonts = path.resolve(spec.fontsDir).replace(/\\/g, '/');
const chrome = new URL('../render/node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe', import.meta.url).pathname.slice(1);
const anim = fs.readFileSync(new URL('../render/ui/market_anim.js', import.meta.url), 'utf8').replace(/^export /gm, '');
const fps = spec.fps || 30;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "zc-assistant"; src: url("file:///${fonts}/Assistant.ttf"); font-weight: 100 900; }
html, body { margin: 0; background: transparent; width: 1080px; height: 1920px; overflow: hidden; }
canvas { position: absolute; left: 0; top: 0; }
</style></head><body><canvas id="c" width="1080" height="1920"></canvas><script>${anim}
const ctx = document.getElementById('c').getContext('2d');
window.at = (o, t) => { ctx.clearRect(0, 0, 1080, 1920); drawMarket(ctx, o, t); };
window.box = (o) => marketBox(o);
</script></body></html>`;
const page_file = path.join(path.dirname(path.resolve(process.argv[2])), '_market.html');
fs.writeFileSync(page_file, html);

const b = await puppeteer.launch({ executablePath: chrome, args: ['--allow-file-access-from-files'] });
const p = await b.newPage();
await p.setViewport({ width: 1080, height: 1920 });
await p.goto('file:///' + page_file.replace(/\\/g, '/'));
await p.evaluate(async () => { for (const w of [500, 600, 700, 800]) await document.fonts.load(`${w} 40px "zc-assistant"`); await document.fonts.ready; });
for (const it of spec.items) {
  const bx = await p.evaluate((o) => window.box(o), it.o);
  const y0 = Math.max(0, Math.round(bx.y - 30)) & ~1, h = Math.min(1920 - y0, Math.round(bx.h + 60)) & ~1;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zc-market-'));
  const n = Math.max(1, Math.ceil((it.o.end - it.o.start) * fps));
  for (let f = 0; f < n; f++) {
    await p.evaluate((o, t) => window.at(o, t), it.o, it.o.start + f / fps);
    await p.screenshot({ path: path.join(dir, `${String(f).padStart(5, '0')}.png`), omitBackground: true, clip: { x: 0, y: y0, width: 1080, height: h } });
  }
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(fps), '-i', path.join(dir, '%05d.png'), '-c:v', 'qtrle', '-pix_fmt', 'argb', it.out]);
  fs.rmSync(dir, { recursive: true, force: true });
  it.y0 = y0;
  console.log(`market ${n} frames -> ${path.basename(it.out)}`);
}
fs.writeFileSync(process.argv[2], JSON.stringify(spec));
await b.close();
