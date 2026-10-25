// Renders scripts/wiki/fb-cover.html to the Facebook cover: 1640x624 (Facebook's size) and a 2x copy for sharpness.
//   node scripts/wiki/fb-cover.mjs  ->  scripts/wiki/work/fb-cover.png, fb-cover@2x.png
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/workspace/BoostMind/zoomcut/render/package.json');
const puppeteer = require('puppeteer-core');
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
for (const [scale, name] of [[1, 'fb-cover.png'], [2, 'fb-cover@2x.png']]) {
  const p = await b.newPage();
  await p.setViewport({ width: 1640, height: 624, deviceScaleFactor: scale });
  await p.goto('file:///' + path.join(here, 'fb-cover.html').split(path.sep).join('/'), { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(here, 'work', name) });
  console.log('wrote', name);
}
await b.close();
