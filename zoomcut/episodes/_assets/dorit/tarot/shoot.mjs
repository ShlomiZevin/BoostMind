// Shoot HTML pages to PNG / JPG one after another in one browser: node shoot.mjs <jobs.json>
// each job {html, out, w, h, jpg?} - a PNG keeps the transparency (omitBackground)
import fs from 'node:fs';
import puppeteer from 'file:///C:/workspace/BoostMind/zoomcut/render/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--allow-file-access-from-files'] });
const p = await b.newPage();
for (const j of jobs) {
  await p.setViewport({ width: j.w, height: j.h, deviceScaleFactor: j.scale || 1 });
  await p.goto('file:///' + j.html.split(String.fromCharCode(92)).join('/'), { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 300));
  const jpg = /\.jpe?g$/i.test(j.out);
  await p.screenshot({ path: j.out, type: jpg ? 'jpeg' : 'png', quality: jpg ? 90 : undefined, omitBackground: !jpg, fullPage: false });
  console.log('OK', j.out);
}
await b.close();
