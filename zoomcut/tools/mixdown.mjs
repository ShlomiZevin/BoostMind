// The export's sound, made by the editor's own audio code: render/ui/sound.ts runs here in headless Chrome
// (the same Web Audio engine the editor plays through), so the file sounds exactly like the editor.
//
//   node tools/mixdown.mjs job.json
//   job.json: { "stems": {voice, voice_dn, fx, music}, "seconds": 92.4, "voice": <episode.json voice>,
//               "music": <episode.json music>, "out": "mix.wav" }
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import puppeteer from '../render/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const require = createRequire(new URL('../render/package.json', import.meta.url));
const esbuild = require('esbuild');
const chrome = new URL('../render/node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe', import.meta.url).pathname.slice(1);
const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

// sound.ts as a plain script (window.Sound)
const code = esbuild.buildSync({
  entryPoints: [new URL('../render/ui/sound.ts', import.meta.url).pathname.slice(1)], bundle: true, write: false,
  format: 'iife', globalName: 'Sound', target: 'chrome120',
}).outputFiles[0].text;

// the stems go to the page over a little local server; the finished mix comes back the same way
let result = null;
const srv = http.createServer((q, r) => {
  if (q.method === 'POST') {
    const parts = [];
    q.on('data', (c) => parts.push(c));
    q.on('end', () => { result = Buffer.concat(parts); r.end('ok'); });
    return;
  }
  if (q.url === '/') { r.setHeader('content-type', 'text/html'); return r.end(`<!doctype html><script>${code}</script>`); }
  const f = job.stems[q.url.slice(1)];
  if (!f || !fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
  r.setHeader('content-type', 'audio/wav');
  fs.createReadStream(f).pipe(r);
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${srv.address().port}`;

const browser = await puppeteer.launch({ executablePath: chrome, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage();
  page.on('console', (m) => console.log('  page:', m.text()));
  await page.goto(base + '/');
  const info = await page.evaluate(async (job, base) => {
    const S = window.Sound;
    const dec = async (k) => {
      const r = await fetch(`${base}/${k}`);
      return r.ok ? new OfflineAudioContext(1, 1, 48000).decodeAudioData(await r.arrayBuffer()) : null;
    };
    const [voice, voice_dn, fx, music] = await Promise.all(['voice', 'voice_dn', 'fx', 'music'].map(dec));
    const { master, out } = await S.finalMix({ voice, voice_dn, fx, music }, Math.round(job.seconds * 48000),
      S.voiceSettings(job.voice), S.musicVolume(job.music));
    const x = out.getChannelData(0), pcm = new Int16Array(x.length);
    for (let i = 0; i < x.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767)));
    await fetch(`${base}/out`, { method: 'POST', body: pcm.buffer });
    const m = S.loudness(x);
    return { master, lufs: m.lufs, peak: m.peak };
  }, job, base);

  // 16-bit mono 48 kHz WAV
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + result.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(48000, 24);
  h.writeUInt32LE(96000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(result.length, 40);
  fs.mkdirSync(path.dirname(job.out), { recursive: true });
  fs.writeFileSync(job.out, Buffer.concat([h, result]));
  console.log(`mix: master ${(20 * Math.log10(info.master)).toFixed(1)} dB -> ${info.lufs.toFixed(1)} LUFS, peak ${(20 * Math.log10(info.peak)).toFixed(1)} dB`);
} finally {
  await browser.close();
  srv.close();
}
