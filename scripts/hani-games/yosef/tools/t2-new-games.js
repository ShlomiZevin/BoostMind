// the three games added 30 Oct (whack p02, wind p05, run p07): open, play a little, screenshot -> shots/n-*.png
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path'), OUT = path.join(__dirname, '..', 'shots');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader'] });
  for (const [name, vp] of [['phone', { width: 390, height: 760 }], ['wide', { width: 1280, height: 760 }]]) {
    const p = await (await b.newContext({ viewport: vp })).newPage(), errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:5301/yosef/?notrack=1'); await p.waitForTimeout(1500);
    await p.click('#goBtn'); await p.waitForTimeout(400); for (let i = 0; i < 5; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(150); }
    for (const [i, k] of [[1, 'whack'], [4, 'wind'], [6, 'run'], [7, 'pay'], [9, 'gold']]) {
      await p.evaluate((n) => window.__game.open(n), i); await p.waitForTimeout(500);
      await p.click('#gMsg .big'); await p.waitForTimeout(2200);
      const box = await p.locator('#gc').boundingBox();
      if (k === 'run') for (let t = 0; t < 6; t++) { await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(450); }
      if (k === 'wind') { await p.mouse.move(box.x + box.width * .4, box.y + box.height * .5); await p.mouse.down(); await p.mouse.move(box.x + box.width * .3, box.y + box.height * .5, { steps: 5 }); await p.waitForTimeout(800); await p.mouse.up(); }
      if (k === 'whack') { const hit = await p.evaluate(() => { const G = window.__game.G; return null; }); await p.waitForTimeout(300); }
if (k === 'pay') { await p.mouse.click(box.x + box.width * .3, box.y + box.height * .6); await p.waitForTimeout(150); }
      await p.screenshot({ path: `${OUT}/n-${name}-${k}.png` });
      await p.click('#gClose'); await p.waitForTimeout(200);
    }
    console.log(name, errs.length ? errs.join(' | ') : 'no errors');
  }
  await b.close();
})();
