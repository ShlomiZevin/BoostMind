// balance: bots of 3 skills (how far off they drop), 6 games each, fast-forwarded. node t3-balance.js
const path = require('path');
const { chromium } = require(path.join(process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await br.newPage({ viewport: { width: 390, height: 844 } });
  await pg.addInitScript(() => { try { localStorage.setItem('shlomiverse:sixty-one:tut', '1'); } catch (e) {} });
  await pg.goto('http://localhost:8781/demokratovich-games/sixty-one/?solo=1&notrack=1'); await new Promise((r) => setTimeout(r, 1500));
  for (const [name, err] of [['slow', 0.085], ['normal', 0.055], ['sharp', 0.035]]) {
    const res = [];
    for (let g = 0; g < 6; g++) {
      res.push(await pg.evaluate((err) => {
        const S = window.SIXTYONE; S.startGame();
        for (let n = 0; n < 200 && S.state === 'play'; n++) {
          // a human-ish error: drop when within a random window, slower under the poll
          const sp = Math.min(7, 2.7 + S.drops * 0.1) * (S.poll.on ? 1.45 : 1);
          const g = (Math.random() + Math.random() + Math.random() - 1.5) * 2;      // ~ gaussian
          const e = Math.abs(g) * err * sp;                                          // timing error (s) x speed
          S.botDrop(Math.max(0.02, e));
        }
        return S.seats;
      }, err));
    }
    console.log(name, res.join(' '), 'avg', Math.round(res.reduce((a, b) => a + b) / res.length));
  }
  await br.close();
})();
