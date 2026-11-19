// screenshots of the room under the tower for a few rotations. node shotroom.js
const path = require('path');
const { chromium } = require(path.join(process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await pg.addInitScript(() => { try { localStorage.setItem('shlomiverse:sixty-one:tut', '1'); } catch (e) {} });
  await pg.goto('http://localhost:8781/demokratovich-games/sixty-one/?solo=1&notrack=1');
  await pg.waitForFunction(() => window.SIXTYONE && SIXTYONE.rabbi && SIXTYONE.room, null, { timeout: 90000 });
  await pg.evaluate(() => SIXTYONE.startGame()); await new Promise((r) => setTimeout(r, 1200));
  for (const r of (process.argv[2] || '0.785').split(',')) {
    await pg.evaluate((r) => SIXTYONE.roomRot(+r), r); await new Promise((r) => setTimeout(r, 700));
    await pg.screenshot({ path: path.join(__dirname, 'shots', `room-${r}.png`) });
  }
  for (let i = 0; i < 8; i++) await pg.evaluate(() => SIXTYONE.bot(0.05));
  await new Promise((r) => setTimeout(r, 1500)); await pg.screenshot({ path: path.join(__dirname, 'shots', 'room-play.png') });
  await br.close();
})();
