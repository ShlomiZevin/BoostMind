// Hold one REAL Syncs meeting (costs ~$0.35, 6 a day) and record it at 2x. The access link comes from env SYNCS_URL only
// (private - never in a file).  SYNCS_URL=... node meet.js <name> <lines.json>
// lines.json = ["the topic (my first line)", "next time I get the floor", ...]  - all participants are invited.
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const fs = require('fs'), path = require('path'), cast = require('./cast.js');
const [name, linesFile] = process.argv.slice(2), lines = JSON.parse(fs.readFileSync(linesFile, 'utf8'));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto(process.env.SYNCS_URL, { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForSelector('#mt-go', { timeout: 30000 });
  const stop = await cast.start(p, path.join(__dirname, 'rec', name));
  await p.waitForTimeout(1200);
  for (const box of await p.$$('input[type=checkbox]:not(:checked)')) { await box.click({ force: true }).catch(() => {}); await p.waitForTimeout(350); }
  await p.waitForTimeout(800); await p.click('#mt-go');
  await p.waitForSelector('#mt-in', { timeout: 30000 });
  const idle = await p.$eval('#mt-in', (e) => e.placeholder);
  let i = 0; const t0 = Date.now();
  const say = async (t) => { await p.click('#mt-in'); await p.keyboard.type(t, { delay: 55 }); await p.waitForTimeout(500); await p.keyboard.press('Enter'); await p.waitForTimeout(1500); };
  while (Date.now() - t0 < 540000) {
    await p.waitForTimeout(700);
    const st = await p.evaluate(() => ({ ph: document.querySelector('#mt-in')?.placeholder, recap: !!document.querySelector('#mt-recap:not(.wait)') }));
    if (st.recap) break;
    if (st.ph && st.ph !== idle) { await p.waitForTimeout(900); await say(i < lines.length ? lines[i++] : 'מסכים.'); }
  }
  await p.waitForTimeout(2500);
  for (let k = 0; k < 14; k++) {   // read the wrap-up slowly
    await p.evaluate(() => { const l = document.querySelector('#mt-log') || document.scrollingElement; l.scrollBy({ top: 120, behavior: 'smooth' }); });
    await p.waitForTimeout(450);
  }
  await p.waitForTimeout(1500);
  fs.writeFileSync(path.join(__dirname, 'rec', name + '.txt'), await p.evaluate(() => document.body.innerText));
  console.log(await stop(), 'lines used', i, 'secs', Math.round((Date.now() - t0) / 1000));
  await b.close();
})();
