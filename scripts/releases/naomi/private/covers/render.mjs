// Render a cover HTML (800x1200 CSS px) to an image with headless Chrome (exact Hebrew).
//   node render.mjs cover-A.html out.png [scale]     scale 2 = 1600x2400 (the full-size cover)
import { createRequire } from 'module';
import path from 'path';
import { pathToFileURL } from 'url';
const require = createRequire('C:/workspace/BoostMind/zoomcut/render/package.json');
const puppeteer = require('puppeteer-core');
const [html, out, scale = '1'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 1200, deviceScaleFactor: Number(scale) });
await page.goto(pathToFileURL(path.resolve(html)).href, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out, type: out.endsWith('.jpg') ? 'jpeg' : 'png', ...(out.endsWith('.jpg') ? { quality: 92 } : {}) });
await browser.close();
console.log('OK', out);
