// Render the naomi-tips design components (design.html) to transparent PNGs at 2x.
//   node render-design.cjs <jobs.json> <outdir>
const fs = require('fs');
const path = require('path');
const puppeteer = require('C:/workspace/BoostMind/zoomcut/render/node_modules/puppeteer-core');
const HERE = __dirname.replace(/\\/g, '/');
const PUB = 'C:/workspace/BoostMind/public/dr-naomi';
const REP = {
  LOGO: 'file:///C:/workspace/BoostMind/scripts/releases/naomi/promo/hr/final/logo-dr-naomi.png',
  PH_AUTHOR: `file:///${PUB}/img/naomi-author.jpg`, PH_ALT: `file:///${PUB}/img/naomi-alt.jpg`, PH_MAIN: `file:///${PUB}/img/naomi.jpg`,
  BOOK: `file:///${HERE}/book-3d.png`,
};
(async () => {
  const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const out = process.argv[3];
  let html = fs.readFileSync(path.join(HERE, 'design.html'), 'utf8');
  for (const [k, v] of Object.entries(REP)) html = html.split(k).join(v);
  const tmp = path.join(HERE, 'design.built.html');
  fs.writeFileSync(tmp, html);
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1200, height: 2600, deviceScaleFactor: 2 });
  for (const j of jobs) {
    const qs = new URLSearchParams({ c: j.c, ...(j.p || {}) }).toString();
    await p.goto('file:///' + tmp.replace(/\\/g, '/') + '#' + qs, { waitUntil: 'networkidle0' });
    await p.reload({ waitUntil: 'networkidle0' });
    await p.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 250));
    const el = await p.$(`#${j.c} > div`);
    const bb = await el.boundingBox();
    const pad = j.pad ?? 30;
    await p.screenshot({ path: path.join(out, j.out), omitBackground: true,
      clip: { x: Math.max(0, bb.x - pad), y: Math.max(0, bb.y - pad), width: bb.width + 2 * pad, height: bb.height + 2 * pad } });
    console.log(j.out, Math.round(bb.width + 2 * pad), 'x', Math.round(bb.height + 2 * pad));
  }
  await b.close();
})();
