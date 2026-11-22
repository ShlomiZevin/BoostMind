// Phone check of /dr-naomi/: serve public/ locally, open at 390 and 360 (his Chrome, iPhone UA, scrollbars visible),
// full-page shots + sideways-scroll check (lists anything wider than the screen).
//   node scripts/releases/naomi/shots.mjs <outdir> [--top <file>]   (--top: a 390-wide shot of the home's top only)
import http from 'http';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire('C:/workspace/BoostMind/zoomcut/render/package.json');
const puppeteer = require('puppeteer-core');
const ROOT = 'C:/workspace/BoostMind/public';
const out = process.argv[2] || 'C:/tmp/naomi-shots';
const topAt = process.argv.indexOf('--top') > 0 ? process.argv[process.argv.indexOf('--top') + 1] : null;
fs.mkdirSync(out, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(path.normalize(ROOT)) || !fs.existsSync(f)) { r.writeHead(404); return r.end('nf'); }
  r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(0);
const port = srv.address().port;
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', ignoreDefaultArgs: ['--hide-scrollbars'] });
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
for (const w of topAt ? [390] : [390, 360]) {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.setUserAgent(UA);
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('ck-seen', '1'); } catch (e) {} });
  await page.setViewport({ width: w, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(`http://localhost:${port}/dr-naomi/`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  if (topAt) { await page.addStyleTag({ content: 'html{scrollbar-width:none}::-webkit-scrollbar{display:none}' }); await page.screenshot({ path: topAt }); console.log('top', topAt); await page.close(); break; }
  const wide = await page.evaluate(() => {
    const W = document.documentElement.clientWidth, bad = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect(); if (!r.width) continue;
      if (r.right > W + 1 || r.left < -1) { if (el.closest('.revs') || el.closest('.drawer')) continue; bad.push(`${el.tagName}.${el.className} ${Math.round(r.left)}..${Math.round(r.right)}`); }
    }
    return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 15) };
  });
  console.log(w, JSON.stringify(wide), errs.filter((e) => !/t\.js|site-signin|net::|404/.test(e)).slice(0, 5));
  // a full-page shot: the sticky header / bottom bar would land mid-page
  await page.addStyleTag({ content: '.top{position:relative!important}.sticky{display:none!important}' });
  // open everything collapsible so the shot reads every word
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
  // shoot screen by screen (a fullPage shot of a long mobile page tiles wrongly), then stitch
  const H = await page.evaluate(() => document.documentElement.scrollHeight), VH = 844, segs = [];
  for (let y = 0, i = 0; y < H; y += VH, i++) {
    await page.evaluate((y) => scrollTo(0, y), y); await new Promise((r) => setTimeout(r, 120));
    const real = await page.evaluate(() => scrollY);
    const seg = path.join(out, `seg-${w}-${String(i).padStart(2, '0')}.png`);
    await page.screenshot({ path: seg }); segs.push({ seg, top: real });
  }
  const sharp = createRequire('C:/workspace/BoostMind/techietech-api/package.json')('sharp');
  const file = path.join(out, `dr-naomi-${w}.png`);
  await sharp({ create: { width: w * 2, height: H * 2, channels: 3, background: '#fff' }, limitInputPixels: false })
    .composite(segs.map((s) => ({ input: s.seg, top: s.top * 2, left: 0 }))).png().toFile(file);
  console.log('shot', file, 'height', H, 'segments', segs.length);
  await page.close();
}
await browser.close(); srv.close();
