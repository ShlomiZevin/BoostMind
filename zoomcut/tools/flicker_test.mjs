// Cuts checked frame by frame (render/ui/vt-test.html + render/src/layers/VideoTrack.tsx): plays across a project's
// cuts and logs, on every animation frame, each video layer's copy on screen and whether its video is ready.
//   node tools/flicker_test.mjs [project=_gl] [cuts=12]
// A "blank" frame = a layer has an item at that frame but no copy is lit; "not ready" = the lit copy is seeking or
// has no frame decoded (readyState < 2). Both should be 0 while playing.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { default: puppeteer } = await import(pathToFileURL(path.join(HERE, '..', 'render', 'node_modules', 'puppeteer-core', 'lib', 'esm', 'puppeteer', 'puppeteer-core.js')).href);
const chrome = path.join(HERE, '..', 'render', 'node_modules', '.remotion', 'chrome-headless-shell', 'win64', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const [id = '_gl', ncuts = '12'] = process.argv.slice(2);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await puppeteer.launch({ executablePath: chrome, args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
await p.setViewport({ width: 600, height: 1000 });
p.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 300)));
await p.goto(`http://localhost:4747/vt-test.html?id=${encodeURIComponent(id)}`, { waitUntil: 'networkidle2' });
for (let i = 0; i < 240; i++) {  // every copy playing from memory
  await wait(500);
  const s = await p.evaluate(() => { const v = [...document.querySelectorAll('video')]; return { n: v.length, mem: v.filter((x) => x.src.startsWith('blob:')).length }; });
  if (s.n && s.n === s.mem) { console.log(`${s.n} copies, all in memory after ${(i + 1) / 2} s`); break; }
}
// the cuts: every place where a layer's item ends and its next one starts in a different copy
const cuts = await p.evaluate((n) => {
  const pr = window.__vt.project, out = [];
  for (const l of pr.layers.filter((x) => x.kind === 'video')) {
    const its = [...l.items].sort((a, b) => a.from - b.from);
    for (let i = 1; i < its.length; i++) if (its[i].asset !== its[i - 1].asset || Math.abs(its[i].in - (its[i - 1].in + its[i - 1].dur / pr.canvas.fps)) > 0.05) out.push(its[i].from);
  }
  out.sort((a, b) => a - b);
  const step = Math.max(1, Math.floor(out.length / n));
  return out.filter((_, i) => i % step === 0).slice(0, n);
}, +ncuts);
await p.evaluate(() => {
  window.__log = []; window.__vtDebug = {};
  const tick = () => {
    const f = window.__vt.frame(), pr = window.__vt.project;
    const row = { f, blank: 0, notReady: 0, double: 0 };
    for (const l of pr.layers.filter((x) => x.kind === 'video' && !x.hidden)) {
      const has = l.items.some((it) => !it.hidden && f >= it.from && f < it.from + it.dur);
      const lit = [...document.querySelectorAll(`[data-layer="${l.id}"]`)].filter((bx) => +bx.style.opacity > 0);
      if (has && !lit.length) { row.blank++; const it = l.items.find((it) => !it.hidden && f >= it.from && f < it.from + it.dur); const prev = l.items.some((x) => !x.hidden && x.from + x.dur === it.from); row.why = `boxes ${[...document.querySelectorAll(`[data-layer="${l.id}"]`)].map((bx) => bx.dataset.copy.split(':')[1] + '=' + JSON.stringify(bx.style.opacity)).join(' ')} | player f${window.__vtDebug[l.id]?.f} shown ${window.__vtDebug[l.id]?.shown} | ${l.id} f${f} item ${it.id} starts ${it.from} (${f - it.from} in) ${prev ? 'after a cut' : 'layer appears'}`; }
      const n = l.items.filter((it) => !it.hidden && f >= it.from && f < it.from + it.dur).length;  // (overlapping items = a dissolve: both lit)
      if (lit.length > n) row.double++;
      for (const bx of lit) { const v = bx.querySelector('video'); if (!v || v.seeking || v.readyState < 2) row.notReady++; }
    }
    row.trace = pr.layers.filter((x) => x.kind === 'video').map((l) => `${l.id.split('.')[0]}:${[...document.querySelectorAll(`[data-layer="${l.id}"]`)].map((bx) => bx.style.opacity || '-').join(',')}/dbg${window.__vtDebug[l.id]?.f ?? ''}`).join(' ');
    window.__log.push(row);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
let blank = 0, notReady = 0, double = 0, frames = 0;
for (const c of cuts) {
  await p.evaluate((f) => { window.__vt.pause(); window.__vt.seek(Math.max(0, f - 45)); }, c);
  await wait(700);
  const n0 = await p.evaluate(() => window.__log.length);
  await p.evaluate(() => window.__vt.play());
  await wait(3000);
  await p.evaluate(() => window.__vt.pause());
  const rows = await p.evaluate((n0) => window.__log.slice(n0), n0);
  const bl = rows.filter((r) => r.blank).length, nr = rows.filter((r) => r.notReady).length, db = rows.filter((r) => r.double).length;
  for (const [k, r] of rows.entries()) if (r.why) { console.log('   blank:', r.why); for (const x of rows.slice(Math.max(0, k - 2), k + 3)) console.log('     f' + x.f, x.trace); }
  blank += bl; notReady += nr; double += db; frames += rows.length;
  console.log(`cut at frame ${c}: ${rows.length} frames played · blank ${bl} · not ready ${nr} · more copies lit than items ${db}`);
}
console.log(`TOTAL ${cuts.length} cuts, ${frames} frames: blank ${blank}, not ready ${notReady}, more copies lit than items ${double}`);
await b.close();
