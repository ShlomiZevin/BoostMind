// the trailer title's layers: title.html -> media/title-main.png (metallic), title-mask.png (white, same box - where the
// light sweep runs), title-sub.png; comp_sd.py animates them (hook json "title_style": "hollywood")
import { createRequire } from 'node:module';
const require = createRequire('C:/workspace/BoostMind/zoomcut/render/package.json');
const puppeteer = require('puppeteer-core');
const DIR = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const OUT = DIR + '../media/';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const p = await b.newPage();
await p.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
await p.goto('file:///' + DIR + 'title.html', { waitUntil: 'networkidle0' });
await p.evaluate(() => document.fonts.ready); await new Promise((r) => setTimeout(r, 600));
for (const [id, name] of [['t1', 'title-main'], ['m1', 'title-mask'], ['t2', 'title-sub']]) await (await p.$('#' + id)).screenshot({ path: `${OUT}${name}.png`, omitBackground: true });
await b.close(); console.log('ok'); process.exit(0);
