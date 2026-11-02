// the 2nd trailer's feature cards: cards.html -> media/cards/card-1..7.png (see-through), cards-sheet.png to look at
import { createRequire } from 'node:module';
const require = createRequire('C:/workspace/BoostMind/zoomcut/render/package.json');
const puppeteer = require('puppeteer-core');
const DIR = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const OUT = process.argv[2] || DIR + '../media/cards/';   // the cards comp_sd.py --features reads
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--allow-file-access-from-files'] });
const p = await b.newPage();
await p.setViewport({ width: 1000, height: 1000, deviceScaleFactor: 1 });
await p.goto('file:///' + DIR + 'cards.html', { waitUntil: 'networkidle0' });
await p.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 800));
const fs = await import('node:fs'); fs.mkdirSync(OUT, { recursive: true });
for (let i = 1; i <= 7; i++) {
  const el = await p.$('#c' + i);
  await el.screenshot({ path: `${OUT}card-${i}.png`, omitBackground: true });
}
await p.evaluate(() => (document.body.style.background = '#05030a'));
await p.screenshot({ path: DIR + 'cards-sheet.png', fullPage: true });
await b.close(); console.log('ok', OUT); process.exit(0);
