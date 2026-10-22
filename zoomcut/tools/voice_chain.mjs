// A voice layer's export sound through the editor's own voice chain (render/ui/sound.ts buildVoice / applyVoice,
// in headless Chrome - the same Web Audio engine the editor plays it through), so the export sounds like the editor.
//
//   node tools/voice_chain.mjs job.json
//   job.json: { "rate": 48000, "tracks": [ { "in": "a.f32", "out": "a.voice.f32", "voice": {...props.voice} } ] }
//   .f32 = raw little-endian float32 mono samples (no clipping on the way: the chain's make-up can go over 1).
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
  entryPoints: [new URL('../render/ui/sound.ts', import.meta.url).pathname.slice(1)], bundle: true, write: false,
  format: 'iife', globalName: 'Sound', target: 'chrome120',
}).outputFiles[0].text;

const srv = http.createServer((q, r) => {
  const k = +q.url.slice(1).split('?')[0];
  if (q.method === 'POST') {
    const parts = [];
    q.on('data', (c) => parts.push(c));
    q.on('end', () => { fs.writeFileSync(job.tracks[k].out, Buffer.concat(parts)); r.end('ok'); });
    return;
  }
  if (q.url === '/') { r.setHeader('content-type', 'text/html'); return r.end(`<!doctype html><script>${code}</script>`); }
  const t = job.tracks[k];
  if (!t || !fs.existsSync(t.in)) { r.statusCode = 404; return r.end(); }
  fs.createReadStream(t.in).pipe(r);
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${srv.address().port}`;

const browser = await puppeteer.launch({ executablePath: chrome });
try {
  const page = await browser.newPage();
  page.on('console', (m) => console.log('  page:', m.text()));
  await page.goto(base + '/');
  for (let k = 0; k < job.tracks.length; k++) {
    const peak = await page.evaluate(async (k, voice, rate, base) => {
      const S = window.Sound;
      const x = new Float32Array(await (await fetch(`${base}/${k}`)).arrayBuffer());
      const ctx = new OfflineAudioContext(1, Math.max(1, x.length), rate);
      const buf = ctx.createBuffer(1, Math.max(1, x.length), rate);
      buf.copyToChannel(x, 0);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const n = S.buildVoice(ctx, src, ctx.destination);
      S.applyVoice(ctx, n, { ...voice, bypass: false }, false);  // (bypass is the editor's hold-to-compare, never exported)
      src.start(0);
      const y = (await ctx.startRendering()).getChannelData(0);
      let pk = 0;
      for (let i = 0; i < y.length; i++) pk = Math.max(pk, Math.abs(y[i]));
      await fetch(`${base}/${k}`, { method: 'POST', body: y.buffer });
      return pk;
    }, k, job.tracks[k].voice || {}, rate, base);
    console.log(`  · voice chain ${job.tracks[k].voice?.preset || 'custom'} -> ${job.tracks[k].out} (peak ${peak.toFixed(2)})`);
  }
} finally {
  await browser.close();
  srv.close();
}
