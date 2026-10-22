// The export's sound, layer by layer, through the EDITOR's own graph (render/ui/layergraph.ts: each clip's gain and
// fades, its fx - filter / pitch / soften / room - the layer's fx, clarity and voice chain), rendered offline in
// headless Chrome - the same Web Audio engine the editor plays through. pipeline/audio_render.py writes the job and
// sums the tracks (volumes, the one loudness gain).
//
//   node tools/audio_layers.mjs job.json
//   job: { rate, fps, n, layers: [ { id, out, props, items: [{asset, from, dur, in, rate, gain, fade_in, fade_out, fx, soften}],
//          sources: {asset: f32 path}, levels: {asset: gain} } ] }      (.f32 = raw little-endian float32 mono)
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import puppeteer from '../render/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const require = createRequire(new URL('../render/package.json', import.meta.url));
const esbuild = require('esbuild');
const chrome = new URL('../render/node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe', import.meta.url).pathname.slice(1);
const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const rate = job.rate || 48000;

const code = esbuild.buildSync({
  entryPoints: [new URL('../render/ui/layergraph.ts', import.meta.url).pathname.slice(1)], bundle: true, write: false,
  format: 'iife', globalName: 'LG', target: 'chrome120',
}).outputFiles[0].text;

const files = {};  // url key -> path
const srv = http.createServer((q, r) => {
  const k = decodeURIComponent(q.url.slice(1));
  if (q.method === 'POST') {
    const parts = [];
    q.on('data', (c) => parts.push(c));
    q.on('end', () => { fs.writeFileSync(files[k], Buffer.concat(parts)); r.end('ok'); });
    return;
  }
  if (q.url === '/') { r.setHeader('content-type', 'text/html'); return r.end(`<!doctype html><script>${code}</script>`); }
  if (!files[k] || !fs.existsSync(files[k])) { r.statusCode = 404; return r.end(); }
  fs.createReadStream(files[k]).pipe(r);
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${srv.address().port}`;

const browser = await puppeteer.launch({ executablePath: chrome });
try {
  const page = await browser.newPage();
  page.on('console', (m) => console.log('  page:', m.text()));
  page.on('pageerror', (e) => console.log('  page error:', String(e).slice(0, 300)));
  await page.goto(base + '/');
  for (const [li, L] of job.layers.entries()) {
    const srcKeys = {};
    for (const [aid, path] of Object.entries(L.sources)) { const k = `s${li}_${Object.keys(srcKeys).length}`; files[k] = path; srcKeys[aid] = k; }
    const outKey = `o${li}`;
    files[outKey] = L.out;
    const peak = await page.evaluate(async (L, srcKeys, outKey, n, fps, rate, base) => {
      const ctx = new OfflineAudioContext(1, Math.max(1, n), rate);
      await LG.loadFx(ctx);
      const bufs = {};
      for (const [aid, k] of Object.entries(srcKeys)) {
        const x = new Float32Array(await (await fetch(`${base}/${k}`)).arrayBuffer());
        const b = ctx.createBuffer(1, Math.max(1, x.length), rate); b.copyToChannel(x, 0); bufs[aid] = b;
      }
      const lay = LG.buildLayer(ctx, ctx.destination);
      LG.applyLayer(lay, L.props || {}, false);
      for (const it of L.items) {
        const r = it.rate == null ? 1 : +it.rate;
        if (r <= 1e-6 || !bufs[it.asset]) continue;  // (a held frame: no sound)
        const T = it.dur / fps, t0 = it.from / fps;
        if (t0 >= n / rate) continue;
        const src = ctx.createBufferSource(); src.buffer = bufs[it.asset]; src.playbackRate.value = r;
        const c = LG.buildClip(ctx, lay, src);
        LG.applyClip(c, it, false);
        // the clip's gain over its time, exactly as the editor ramps it (layergraph.clipGainAt) x its source's level
        const lv = L.levels?.[it.asset] ?? 1;
        const N = Math.max(2, Math.ceil(T / 0.004) + 1), curve = new Float32Array(N);
        for (let k = 0; k < N; k++) curve[k] = LG.clipGainAt(it, (k / (N - 1)) * T, fps) * lv;
        c.gain.gain.setValueCurveAtTime(curve, t0, T);
        src.start(t0, it.in ?? 0, T * r);
      }
      const y = (await ctx.startRendering()).getChannelData(0);
      let pk = 0;
      for (let i = 0; i < y.length; i++) pk = Math.max(pk, Math.abs(y[i]));
      await fetch(`${base}/${outKey}`, { method: 'POST', body: y.buffer });
      return pk;
    }, L, srcKeys, outKey, job.n, job.fps, rate, base);
    console.log(`  · sound layer ${L.id}: ${L.items.length} clips (peak ${peak.toFixed(2)})`);
  }
} finally {
  await browser.close();
  srv.close();
}
