import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)); const Z = path.resolve(HERE, '../../../../..');
const { default: puppeteer } = await import(pathToFileURL(path.join(Z, 'render/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js')).href);
const chrome = path.join(Z, 'render/node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe');
const b = await puppeteer.launch({ executablePath: chrome }); const p = await b.newPage(); await p.setViewport({ width: 1080, height: 1920 });
for (const n of process.argv.slice(2)) {
  await p.goto(pathToFileURL(path.join(HERE, n + '.html')).href, { waitUntil: 'networkidle0' }); await p.evaluate(() => document.fonts.ready);
  const over = await p.evaluate(() => { const c = document.querySelector('.chat'); return c.getBoundingClientRect().bottom > 1800; });
  if (over) console.log(n, 'OVERFLOWS the bar');
  await p.screenshot({ path: path.join(HERE, `wa-${n}.jpg`), type: 'jpeg', quality: 92 });
}
await b.close();
