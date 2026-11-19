const path = require('path');
const { chromium } = require(path.join(process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const r of ['0', '3.1416', '-1.5708']) {
    const pg = await br.newPage({ viewport: { width: 390, height: 844 } });
    await pg.addInitScript(() => { try { localStorage.setItem('shlomiverse:sixty-one:tut', '1'); } catch (e) {} });
    await pg.goto('http://localhost:8781/demokratovich-games/sixty-one/?solo=1&notrack=1&rot=' + r);
    await pg.waitForFunction(() => window.SIXTYONE && SIXTYONE.room, null, { timeout: 90000 });
    await pg.evaluate(() => SIXTYONE.startGame()); for (let i = 0; i < 4; i++) await pg.evaluate(() => SIXTYONE.bot(0.05));
    await new Promise((x) => setTimeout(x, 1500)); await pg.screenshot({ path: path.join(__dirname, 'shots', `rot-${r}.png`) }); await pg.close();
  }
  await br.close();
})();
