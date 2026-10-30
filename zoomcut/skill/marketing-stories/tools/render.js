// render promo/video.html frame by frame -> out/yosef-promo.mp4 (1080x1920, 30 fps, silent - the song goes on in Instagram)
//   node promo/render.js [--page teaser.html --out yosef-teaser-silent.mp4] [--fps 30] [--still 5.2]   (--still: one frame at that second -> out/still.png)
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const FF = 'C:/Users/shazb/AppData/Roaming/Python/Python312/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const PAGE = arg('page', 'video.html'), OUTF = arg('out', 'yosef-promo.mp4'), FPS = +arg('fps', 30), STILL = arg('still'), OUT = path.join(__dirname, 'out'), FR = path.join(OUT, '_render-tmp');
(async () => {
  fs.mkdirSync(FR, { recursive: true });
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await (await b.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })).newPage();
  await p.goto('http://localhost:5301/yosef/promo/' + PAGE); await p.waitForLoadState('networkidle'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
  if (STILL) { await p.evaluate((t) => at(t), +STILL); await p.screenshot({ path: path.join(OUT, `still-${STILL}.png`) }); await b.close(); return; }
  const total = await p.evaluate(() => TOTAL), n = Math.round(total * FPS);
  for (let i = 0; i < n; i++) {
    await p.evaluate((t) => at(t), i / FPS);
    await p.screenshot({ path: path.join(FR, `f${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 92 });
    if (i % 150 === 0) console.log('frame', i, '/', n);
  }
  await b.close();
  execFileSync(FF, ['-y', '-framerate', String(FPS), '-i', path.join(FR, 'f%04d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', ...(process.argv.includes('--draft') ? ['-vf', 'scale=540:960', '-crf', '26'] : ['-crf', '18']), '-movflags', '+faststart', path.join(OUT, OUTF)], { stdio: 'ignore' });
  fs.rmSync(FR, { recursive: true, force: true });
  console.log('video', path.join(OUT, OUTF), (fs.statSync(path.join(OUT, OUTF)).size / 1e6).toFixed(1) + ' MB');
})();
