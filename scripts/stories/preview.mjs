// A story exactly as visitors will see it - BEFORE it is posted (zoomcut/skill/verse-story/SKILL.md). It draws the
// story with the site's own code (v2/site/verse/story-art.js + verse.css, the real name bar and button) on three
// screens, the bare picture with a % grid (to choose where the words go), and checks every box:
//   node scripts/stories/preview.mjs story.json [outDir]
// story.json is the same file scripts/story.mjs posts; for a story that is already up give "media": {"url", "kind"}
// instead of "file". "keepClear": [[x1, y1, x2, y2], ...] (in % of the stage) = where the picture has its own words,
// faces or anything that must stay seen - no box may touch them. Exit 1 = something is on something; fix it first.
// Writes <out>/<name>-phone.png (390x844), -short.png (375x667), -wide.png (desktop), -clean.png (the picture alone,
// with the grid and the keepClear areas) and prints the checks.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire('C:/workspace/BoostMind/zoomcut/render/package.json');
const puppeteer = require('puppeteer-core');
const SITE = 'C:/workspace/BoostMind/v2/site';
const [jsonPath, outArg] = process.argv.slice(2);
if (!jsonPath) { console.error('usage: node scripts/stories/preview.mjs story.json [outDir]'); process.exit(1); }
const story = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const out = outArg || path.join(path.dirname(jsonPath), 'preview');
fs.mkdirSync(out, { recursive: true });
const name = path.basename(jsonPath, '.json');

// the character's name, face and colour, from the live wiki
const W = await fetch('https://storage.googleapis.com/shlomiverse-media/wiki/data/wiki.json').then((r) => r.json()).catch(() => ({ characters: [] }));
const ch = story.char === 'verse' ? { name: 'שלומיוורס', img: 'https://shlomiverse.com/verse/icon-192.png', color: '#ff6a1f' } : (W.characters || []).find((c) => c.id === story.char) || { name: story.char };
const abs = (u) => (!u ? '' : /^https?:/.test(u) ? u : 'https://shlomiverse.com' + (u.startsWith('/') ? '' : '/') + u);
let media = story.media || null;
if (story.file) media = { url: '/__media/' + encodeURIComponent(path.basename(story.file)), kind: /\.(mp4|mov)$/i.test(story.file) ? 'video' : 'image' };

const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.svg': 'image/svg+xml' };
const page = (mode) => `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800;900&display=swap" rel="stylesheet"><link rel="stylesheet" href="/verse/verse.css">
<style>body{margin:0;background:#000;font-family:'Heebo',sans-serif}.grid{position:absolute;inset:0;pointer-events:none;z-index:9}
.grid i{position:absolute;background:rgba(255,255,255,.45)}.grid b{position:absolute;font:700 11px Heebo;color:#fff;background:rgba(0,0,0,.6);padding:0 3px;border-radius:3px}
.keep{position:absolute;border:2px dashed #ffd23f;background:rgba(255,210,63,.16);z-index:9}</style></head><body>
<div class="sv"><div class="sv-box" style="--c:${ch.color || '#ff6a1f'}">
  <div class="sv-bars"><span><i style="width:40%"></i></span></div>
  <div class="sv-head"><span class="vx-av ring"><img src="${abs(ch.img)}" alt=""></span><span><b></b><br><small>לפני 5 דק'</small></span>
    <span class="end"><button class="vx-pill" style="height:34px;padding:0 14px;border-radius:99px;background:rgba(255,255,255,.18);color:#fff;font-weight:700">לעקוב</button>
    <button class="vx-round" style="width:42px;height:42px"></button><button class="vx-round" style="width:42px;height:42px"></button></span></div>
  <div data-slot></div><div class="sv-shade"></div></div></div>
<script type="module">
import { stageHtml, boxesOf, allFontsReady } from '/verse/story-art.js';
const story = ${JSON.stringify({ ...story, media })}, mode = '${mode}';
document.querySelector('.sv-head b').textContent = ${JSON.stringify(ch.name || '')};
const slot = document.querySelector('[data-slot]');
slot.classList.toggle('with-cta', !!story.link && mode !== 'clean');
const link = story.link ? \`<a class="sv-cta">\${story.label || 'לפתוח'}</a>\` : '';
slot.innerHTML = stageHtml(mode === 'clean' ? { ...story, boxes: [] } : story) + (mode === 'clean' ? '' : link);
if (mode === 'clean') {
  document.querySelector('.sv-head').remove(); document.querySelector('.sv-bars').remove(); document.querySelector('.sv-shade').remove();
  const st = document.querySelector('.sa-stage'), g = document.createElement('div'); g.className = 'grid';
  for (let k = 10; k < 100; k += 10) g.insertAdjacentHTML('beforeend', \`<i style="left:\${k}%;top:0;bottom:0;width:1px"></i><i style="top:\${k}%;left:0;right:0;height:1px"></i><b style="left:\${k}%;top:2px">\${k}</b><b style="top:\${k}%;right:2px">\${k}</b>\`);
  for (const [x1, y1, x2, y2] of story.keepClear || []) g.insertAdjacentHTML('beforeend', \`<div class="keep" style="left:\${x1}%;top:\${y1}%;width:\${x2 - x1}%;height:\${y2 - y1}%"></div>\`);
  st.append(g);
}
const imgs = [...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }));
await Promise.all(imgs); await allFontsReady(); await new Promise((r) => setTimeout(r, 300));
// every box against the safe zones, the name bar, the button, the other boxes, the keepClear areas
const st = document.querySelector('.sa-stage').getBoundingClientRect();
const pc = (r) => ({ x1: (r.left - st.left) / st.width * 100, x2: (r.right - st.left) / st.width * 100, y1: (r.top - st.top) / st.height * 100, y2: (r.bottom - st.top) / st.height * 100 });
const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const head = document.querySelector('.sv-head')?.getBoundingClientRect(), cta = document.querySelector('.sv-cta')?.getBoundingClientRect();
const boxes = [...document.querySelectorAll('.sa-b .sa-in')].map((el) => el.getBoundingClientRect());
const src = boxesOf(story), problems = [];
boxes.forEach((r, i) => {
  const p = pc(r), t = src[i].t.slice(0, 24);
  if (p.x1 < -0.5 || p.x2 > 100.5 || p.y1 < -0.5 || p.y2 > 100.5) problems.push(\`box \${i + 1} (\${t}) goes off the picture\`);
  if (head && hit(r, head)) problems.push(\`box \${i + 1} (\${t}) is under the name bar on this screen\`);
  if (cta && hit(r, cta)) problems.push(\`box \${i + 1} (\${t}) is under the button on this screen\`);
  boxes.forEach((o, k) => { if (k > i && hit(r, o)) problems.push(\`box \${i + 1} and box \${k + 1} sit on each other\`); });
  for (const [x1, y1, x2, y2] of story.keepClear || []) if (p.x1 < x2 && x1 < p.x2 && p.y1 < y2 && y1 < p.y2) problems.push(\`box \${i + 1} (\${t}) covers a keepClear area [\${x1},\${y1},\${x2},\${y2}]\`);
  if (src[i].s < 3.6) problems.push(\`box \${i + 1} (\${t}) letters are too small to read on a phone (s \${src[i].s} - 3.6 at least)\`);
});
const chars = src.reduce((n, b) => n + b.t.length, 0), notes = [];
if (chars > 300) problems.push(\`\${chars} characters of words - too long for one story: split it into two stories\`);
else if (chars > 170) notes.push(\`\${chars} characters of words - long for a story (read in a few seconds); fine only when the words ARE the joke\`);
// a box's words broken into one word per line = too big for its width
document.querySelectorAll('.sa-b').forEach((el, i) => { const lh = parseFloat(getComputedStyle(el).lineHeight) || 1, lines = Math.round(el.querySelector('.sa-in').getBoundingClientRect().height / lh); const words = src[i].t.split(/\\s+/).length; if (words > 1 && lines >= words) problems.push(\`box \${i + 1} (\${src[i].t.slice(0, 24)}) breaks into a word per line - wider box or smaller letters\`); });
window.__report = { problems, notes, boxes: boxes.map(pc).map((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Math.round(v * 10) / 10]))) };
</script></body></html>`;

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/__page/')) { res.writeHead(200, { 'content-type': TYPES['.html'] }); return res.end(page(u.pathname.split('/')[2])); }
  const f = u.pathname.startsWith('/__media/') ? story.file : path.join(SITE, decodeURIComponent(u.pathname));
  if (!f || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = 'http://localhost:' + server.address().port;
const b = await puppeteer.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', headless: 'new' });
let bad = 0;
try {
  for (const [tag, vp, mode] of [['phone', { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'story'],
    ['short', { width: 375, height: 667, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'story'],
    ['wide', { width: 1280, height: 800, deviceScaleFactor: 1 }, 'story'],
    ['clean', { width: 540, height: 960, deviceScaleFactor: 2 }, 'clean']]) {
    const p = await b.newPage();
    p.on('pageerror', (e) => console.log('page error', e.message));
    await p.setViewport(vp);
    await p.goto(base + '/__page/' + mode, { waitUntil: 'networkidle0' });
    await p.waitForFunction(() => window.__report, { timeout: 20000 });
    const r = await p.evaluate(() => window.__report);
    await p.evaluate(() => document.querySelector('video')?.pause());
    const file = path.join(out, `${name}-${tag}.png`);
    await p.screenshot({ path: file });
    if (mode === 'story') {
      console.log(`${tag}: ${file}`);
      if (tag === 'phone') r.boxes.forEach((x, i) => console.log(`  box ${i + 1}: x ${x.x1}-${x.x2}%, y ${x.y1}-${x.y2}%`));
      r.problems.forEach((m) => { console.log('  PROBLEM ' + m); bad++; });
      if (tag === 'phone') r.notes.forEach((m) => console.log('  note: ' + m));
    } else console.log(`clean (the picture, a 10% grid${story.keepClear ? ', keepClear' : ''}): ${file}`);
    await p.close();
  }
} finally { await b.close(); server.close(); }
console.log(bad ? `${bad} problem(s) - fix them before posting` : 'no box sits on anything - now LOOK at the pictures');
process.exit(bad ? 1 : 0);
