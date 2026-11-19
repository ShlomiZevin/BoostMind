const path = require('path');
const { chromium } = require(path.join(process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await br.newPage({ viewport: { width: 390, height: 844 } });
  await pg.addInitScript(() => { try { localStorage.setItem('shlomiverse:sixty-one:tut', '1'); } catch (e) {} });
  await pg.goto('http://localhost:8781/demokratovich-games/sixty-one/?solo=1&notrack=1');
  await pg.waitForFunction(() => window.SIXTYONE && SIXTYONE.rabbi, null, { timeout: 60000 });
  console.log(await pg.evaluate(() => {
    const S = window.SIXTYONE; S.startGame(); const log = [];
    for (let n = 0; n < 60 && S.state === 'play'; n++) {
      const c = S.cur; const nm = c ? c.name + c.seats + '/' + c.bloc : '-';
      S.bot(0.03); for (let i = 0; i < 60; i++) S.tick(1 / 60);
      log.push(`${nm} -> ${S.seats} (tower ${S.tower.length}) ${S.state}`);
    }
    return log.join('\n');
  }));
  await br.close();
})();
