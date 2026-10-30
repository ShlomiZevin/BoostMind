// analytics check without sending anything: window.track is replaced by a recorder.
// expect: game_start on "פותחים את הספר", game_over after winning the last page's game, nothing else from the game
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await (await b.newContext({ viewport: { width: 390, height: 760 } })).newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:5301/yosef/?notrack=1'); await p.waitForTimeout(1200);
  await p.evaluate(() => { window.__log = []; window.track = (e, x) => window.__log.push(e + ':' + x); });
  await p.click('#goBtn'); await p.waitForTimeout(300); for (let i = 0; i < 5; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(120); }
  await p.evaluate(() => window.__game.open(0)); await p.waitForTimeout(300); await p.click('#gMsg .big');
  await p.evaluate(() => window.__game.win()); await p.waitForTimeout(1000); await p.click('#gMsg .big'); await p.waitForTimeout(300);
  const mid = await p.evaluate(() => window.__log.slice());
  await p.evaluate(() => window.__game.showPage(9)); await p.waitForTimeout(500);
  await p.evaluate(() => window.__game.open(9)); await p.waitForTimeout(300); await p.click('#gMsg .big');
  await p.evaluate(() => window.__game.win()); await p.waitForTimeout(1000);
  console.log('after page 1 win:', mid.join(', '), '| after last page win:', (await p.evaluate(() => window.__log)).join(', '), '|', errs.length ? errs.join(' ') : 'no errors');
  await b.close();
})();
