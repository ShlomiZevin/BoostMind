// Shoot an HTML page to an image with his Chrome (headless).
//   node shoot.mjs <page.html[?query]> <out.jpg|png> <width> <height> [scale] [transparent]
import { createRequire } from 'module';
import path from 'path';
import { pathToFileURL } from 'url';
const require = createRequire('C:/workspace/BoostMind/zoomcut/render/package.json');
const puppeteer = require('puppeteer-core');
const [page0, out, w, h, scale = '1', transparent] = process.argv.slice(2);
const [file, q] = page0.split('?');
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: +w, height: +h, deviceScaleFactor: +scale });
await page.goto(pathToFileURL(path.resolve(file)).href + (q ? '?' + q : ''), { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
const jpg = out.endsWith('.jpg');
await page.screenshot({ path: out, type: jpg ? 'jpeg' : 'png', ...(jpg ? { quality: 90 } : { omitBackground: !!transparent }) });
await browser.close();
console.log('OK', out);
