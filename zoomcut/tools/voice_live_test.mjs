// Is the editor's live voice the export's voice? Plays one voice clip in the bench (render/ui/vt-test.html), records
// what AudioTrack sends out for that layer, and compares it with the export's track for the same stretch
// (work/layers/voice/<layer>.*.f32, pipeline/voice_chain.py) and with the prepared voice before the chain.
//   node tools/voice_live_test.mjs <project> <layer> <item>     (run the export mix once first)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { default: puppeteer } = await import(pathToFileURL(path.join(HERE, '..', 'render', 'node_modules', 'puppeteer-core', 'lib', 'esm', 'puppeteer', 'puppeteer-core.js')).href);
const chrome = path.join(HERE, '..', 'render', 'node_modules', '.remotion', 'chrome-headless-shell', 'win64', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const [id, lid, iid] = process.argv.slice(2);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// level (dB RMS) and brightness (share of energy above ~2 kHz) of samples at rate sr
function stats(x, sr) {
  const a = Math.exp(-2 * Math.PI * 2000 / sr);
  let e = 0, h = 0, lp = 0;
  for (const v of x) { lp = a * lp + (1 - a) * v; const hp = v - lp; e += v * v; h += hp * hp; }
  return { db: +(10 * Math.log10(e / x.length + 1e-12)).toFixed(2), hf: +(h / (e + 1e-12)).toFixed(4), n: x.length };
}

const b = await puppeteer.launch({ executablePath: chrome, args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 300)));
await p.evaluateOnNewDocument((lid) => {
  window.__rec = { sr: 0, chunks: [] };
  window.__atTap = (ctx, id, node) => {
    if (id !== lid) return;
    const sp = ctx.createScriptProcessor(2048, 1, 1), z = ctx.createGain();
    z.gain.value = 0; node.connect(sp); sp.connect(z); z.connect(ctx.destination);
    window.__rec.sr = ctx.sampleRate;
    sp.onaudioprocess = (e) => window.__rec.chunks.push({ f: window.__vt?.frame?.() ?? -1, x: Array.from(e.inputBuffer.getChannelData(0)) });
  };
}, lid);
await p.goto(`http://localhost:4747/vt-test.html?id=${encodeURIComponent(id)}`, { waitUntil: 'networkidle2' });
await wait(4000);
const info = await p.evaluate(async (lid, iid) => {
  const pr = window.__vt.project, l = pr.layers.find((x) => x.id === lid), it = l.items.find((x) => x.id === iid);
  return { from: it.from, dur: it.dur, in: it.in ?? 0, asset: it.asset, fps: pr.canvas.fps, volume: l.props?.volume ?? 1 };
}, lid, iid);
await p.evaluate((f) => { window.__vt.pause(); window.__vt.seek(f); }, Math.max(0, Math.round(info.from) - 20));
await wait(800);
await p.evaluate(() => window.__vt.play());
await wait(((info.dur + 40) / info.fps) * 1000 + 600);
await p.evaluate(() => window.__vt.pause());
const rec = await p.evaluate(() => window.__rec);
const lo = info.from + 8, hi = info.from + info.dur - 8;  // inside the clip (past its fades and the copy switch)
const live = rec.chunks.filter((c) => c.f >= lo && c.f + 2048 / rec.sr * info.fps <= hi).flatMap((c) => c.x);
const { gainDb } = await (await fetch(`http://localhost:4747/api/p/${id}`)).json();
const g = Math.pow(10, gainDb / 20) * info.volume;
const vdir = path.join(HERE, '..', 'episodes', id, 'work', 'layers', 'voice');
const f32 = fs.readdirSync(vdir).filter((f) => f.startsWith(lid + '.') && f.endsWith('.f32') && !f.includes('.in.')).map((f) => path.join(vdir, f)).sort((a, c) => fs.statSync(c).mtimeMs - fs.statSync(a).mtimeMs)[0];
const all = new Float32Array(fs.readFileSync(f32).buffer.slice(0));
const seg = (x, s0, s1) => Array.from(x.subarray(Math.round(s0), Math.round(s1)));
const exp = seg(all, lo / info.fps * 48000, hi / info.fps * 48000).map((v) => v * g);
// the voice before the chain: the prepared source the editor plays (already at the shared gain)
const src = await p.evaluate(async (u) => {
  const ab = await (await fetch(u)).arrayBuffer();
  const buf = await new OfflineAudioContext(1, 1, 48000).decodeAudioData(ab);
  return Array.from(buf.getChannelData(0));
}, (await (await fetch(`http://localhost:4747/api/p/${id}`)).json()).urls[`${lid}|${info.asset}`]);
const s0 = (info.in + (lo - info.from) / info.fps) * 48000, s1 = (info.in + (hi - info.from) / info.fps) * 48000;
const raw = src.slice(Math.round(s0), Math.round(s1)).map((v) => v * info.volume);
const L = stats(live, rec.sr), E = stats(exp, 48000), R = stats(raw, 48000);
console.log(`live   : ${L.db} dB, high share ${L.hf}  (${(L.n / rec.sr).toFixed(2)} s at ${rec.sr} Hz)`);
console.log(`export : ${E.db} dB, high share ${E.hf}  (${(E.n / 48000).toFixed(2)} s)`);
console.log(`no chain: ${R.db} dB, high share ${R.hf}`);
console.log(`live vs export: ${(L.db - E.db).toFixed(2)} dB, high share x${(L.hf / E.hf).toFixed(3)}   ·   chain vs none: ${(E.db - R.db).toFixed(2)} dB, x${(E.hf / R.hf).toFixed(3)}`);
await b.close();
