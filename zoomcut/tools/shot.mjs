// Screenshot the review screen (dev check). node tools/shot.mjs [episode] [out.png] [clickLine]
import puppeteer from '../render/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const [ep = 'agentic-sync-test', out = 'shot.png', click] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: new URL('../render/node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe', import.meta.url).pathname.slice(1), args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
await p.setViewport({ width: 1500, height: 950 });
const errs = [];
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
p.on('pageerror', (e) => errs.push(String(e)));
await p.evaluateOnNewDocument((e) => localStorage.setItem('zc-ep', e), ep);
await p.goto('http://localhost:4747/' + (process.env.PAGE || ''), { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 2500));
if (click) {
  const rows = await p.$$(process.env.ROWSEL || '.ln');
  if (rows[+click]) await rows[+click].click();
  await new Promise((r) => setTimeout(r, 2500));
}
await p.screenshot({ path: out });
console.log(errs.length ? 'errors:\n' + errs.join('\n') : 'no console errors');
await b.close();
