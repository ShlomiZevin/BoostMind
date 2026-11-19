const path = require('path');
const { chromium } = require(path.join(process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  pg.on('console', (m) => console.log('console', m.text())); pg.on('requestfailed', r => console.log('fail', r.url())); pg.on('response', r => { if (r.status() >= 400) console.log(r.status(), r.url()); });
  await pg.goto('http://localhost:8781/demokratovich-games/sixty-one/?solo=1&notrack=1&rdbg=1'); await new Promise(r=>setTimeout(r,1500)); await pg.evaluate(()=>document.getElementById('start').classList.remove('on')); await new Promise(r=>setTimeout(r,300)); await pg.screenshot({path:'shots/rdbg.png'});
  await pg.waitForFunction(() => window.SIXTYONE && window.SIXTYONE.rabbi, null, { timeout: 60000 });
  console.log(JSON.stringify(await pg.evaluate(() => ({RB:SIXTYONE.RB, d:SIXTYONE.dbg}))));
  await br.close();
})();
