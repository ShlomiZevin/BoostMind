// Audio layers checked frame by frame (render/ui/vt-test.html + render/src/layers/AudioTrack.tsx): plays across
// item starts / ends and logs, on every animation frame, each item that should sound: is its copy playing, at the
// right place in its source, at its gain?   node tools/audio_test.mjs [project=_gl] [spots=12]
// "silent" = an item past its fade-in that is paused or at gain ~0; "off" = its sound > 0.1 s from where it should be.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { default: puppeteer } = await import(pathToFileURL(path.join(HERE, '..', 'render', 'node_modules', 'puppeteer-core', 'lib', 'esm', 'puppeteer', 'puppeteer-core.js')).href);
const chrome = path.join(HERE, '..', 'render', 'node_modules', '.remotion', 'chrome-headless-shell', 'win64', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const [id = '_gl', nspots = '12'] = process.argv.slice(2);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await puppeteer.launch({ executablePath: chrome, args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
await p.setViewport({ width: 600, height: 1000 });
p.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 300)));
await p.goto(`http://localhost:4747/vt-test.html?id=${encodeURIComponent(id)}`, { waitUntil: 'networkidle2' });
await wait(4000);
const spots = await p.evaluate((n) => {
  const pr = window.__vt.project, out = [];
  for (const l of pr.layers.filter((x) => x.kind === 'audio')) for (const it of l.items) out.push(Math.round(it.from));
  out.sort((a, b) => a - b);
  const step = Math.max(1, Math.floor(out.length / n));
  return out.filter((_, i) => i % step === 0).slice(0, n);
}, +nspots);
await p.evaluate(() => {
  window.__atDebug = {}; window.__alog = [];
  const tick = () => {
    const f = window.__vt.frame(), pr = window.__vt.project, fps = pr.canvas.fps;
    const row = { f, items: 0, silent: 0, off: 0, why: [] };
    for (const l of pr.layers.filter((x) => x.kind === 'audio' && !x.hidden && !x.muted)) {
      for (const d of window.__atDebug[l.id] || []) {
        const it = l.items.find((x) => x.id === d.item);
        if (!it || (f - it.from) / fps < 0.1 || (it.from + it.dur - f) / fps < 0.2) continue;  // (the edges: fades)
        row.items++;
        if (!d.playing || d.gain < 0.05) { row.silent++; row.why.push(`${l.id}/${d.item} playing=${d.playing} gain=${d.gain} ready=${d.ready}`); }
        else if (Math.abs(d.at - d.want) > 0.1) { row.off++; row.why.push(`${l.id}/${d.item} at ${d.at} want ${d.want}`); }
      }
    }
    window.__alog.push(row);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
let items = 0, silent = 0, off = 0;
for (const s of spots) {
  await p.evaluate((f) => { window.__vt.pause(); window.__vt.seek(Math.max(0, f - 30)); }, s);
  await wait(600);
  const n0 = await p.evaluate(() => window.__alog.length);
  await p.evaluate(() => window.__vt.play());
  await wait(3500);
  await p.evaluate(() => window.__vt.pause());
  const rows = (await p.evaluate((n0) => window.__alog.slice(n0), n0)).slice(8);  // (the first frames: play just started)
  const si = rows.reduce((a, r) => a + r.silent, 0), of = rows.reduce((a, r) => a + r.off, 0), it = rows.reduce((a, r) => a + r.items, 0);
  items += it; silent += si; off += of;
  console.log(`around frame ${s}: ${it} item-frames heard · silent ${si} · off ${of}${rows.find((r) => r.why.length) ? '  e.g. ' + rows.find((r) => r.why.length).why[0] : ''}`);
}
console.log(`TOTAL ${spots.length} spots: ${items} item-frames · silent ${silent} · off by > 0.1 s ${off}`);
await b.close();
