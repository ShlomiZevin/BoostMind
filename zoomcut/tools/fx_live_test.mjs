// Live vs export for the sound effects (render/ui/soundfx.ts through layergraph.ts): a real voice played live through
// the editor's graph and recorded, and the same graph rendered offline (as tools/audio_layers.mjs does for the export).
//   node tools/fx_live_test.mjs <audio url> [seconds]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { default: puppeteer } = await import(pathToFileURL(path.join(HERE, '..', 'render', 'node_modules', 'puppeteer-core', 'lib', 'esm', 'puppeteer', 'puppeteer-core.js')).href);
const chrome = path.join(HERE, '..', 'render', 'node_modules', '.remotion', 'chrome-headless-shell', 'win64', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const [url, secs = '4'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: chrome, args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 300)));
await p.goto('http://localhost:4747/fx-test.html', { waitUntil: 'networkidle2' });
const band = (x, sr, lo, hi) => {  // energy share in a band (two one-pole filters)
  const a1 = Math.exp(-2 * Math.PI * lo / sr), a2 = Math.exp(-2 * Math.PI * hi / sr);
  let l1 = 0, l2 = 0, e = 0, t = 0;
  for (const v of x) { l1 = a1 * l1 + (1 - a1) * v; l2 = a2 * l2 + (1 - a2) * v; const bp = l2 - l1; e += bp * bp; t += v * v; }
  return e / (t + 1e-12);
};
const db = (x) => 10 * Math.log10(x.reduce((a, v) => a + v * v, 0) / Math.max(1, x.length) + 1e-12);
const cases = [
  ['none', {}, {}], ['phone', { fx: { filter: 'phone' } }, {}], ['thought', { fx: { filter: 'thought' } }, {}],
  ['pitch +3', { fx: { pitch: 3 } }, {}], ['pitch -3', { fx: { pitch: -3 } }, {}], ['soften', { soften: true }, {}],
  ['tape x1.25', { rate: 1.25 }, {}], ['news voice', {}, { voice: { preset: 'news', lowcut: 95, warmth: 2, box: -3, presence: 3.5, deess: 0.45, comp: 0.75 } }],
  ['clarity +6', {}, { presence: 6 }],
];
for (const [name, it, props] of cases) {
  const r = await p.evaluate((u, it, props, s) => window.__fx(u, it, props, s), url, { in: 12, ...it }, props, +secs);
  const skip = Math.round(0.3 * r.sr);  // (the live start: the player's own first moments)
  const L = r.live.slice(skip, r.live.length - skip), E = r.exp.slice(skip, skip + L.length);
  console.log(`${name.padEnd(12)} live ${db(L).toFixed(1)} dB / export ${db(E).toFixed(1)} dB  ·  0.3-3 kHz share live ${band(L, r.sr, 300, 3000).toFixed(3)} / export ${band(E, r.sr, 300, 3000).toFixed(3)}`);
}
await b.close();
