// Render book-3d.html (800x800 CSS) to a transparent PNG at x2 = 1600x1600.
//   node render3d.mjs book-3d.html book-3d.png [scale]
import { createRequire } from 'module';
import path from 'path';
import { pathToFileURL } from 'url';
const require = createRequire('C:/workspace/BoostMind/zoomcut/render/package.json');
const puppeteer = require('puppeteer-core');
const [html, out, scale = '2'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 800, deviceScaleFactor: Number(scale) });
await page.goto(pathToFileURL(path.resolve(html)).href, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out, omitBackground: true });
await browser.close();
console.log('OK', out);
