// t4: placed pills cover exactly their cells (standing + lying 2/3-cell pills) - screenshot to check by eye
const path = require('path');
const { chromium } = require(path.join(process.env.HOME || process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
const BASE = process.argv[2] || 'http://localhost:8765/lola-games/pills/?solo=1&notrack=1';
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 430, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await p.goto(BASE); await p.evaluate(() => localStorage.setItem('shlomiverse:pills:tut-box', '1')); await p.reload(); await p.waitForTimeout(700);
  await p.click('.mode[data-mode=box]'); await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const B = PILLS.box; B.grid.forEach((row) => row.fill(0)); B.pills = {};
    [['metformin', 5, 4, 'v', 2], ['metformin', 6, 4, 'v', 2], ['omeprazole', 2, 1, 'v', 2], ['omega3', 0, 0, 'h', 2], ['calcium', 4, 1, 'v', 3], ['calcium', 0, 7, 'h', 3], ['warfarin', 3, 3, 'h', 1], ['atorvastatin', 2, 5, 'h', 1]]
      .forEach(([med, x, y, dir, len]) => B.put({ med, x, y, dir, len, born: 0 }));
    return { cell: B.cell, stage: document.querySelector('#stage').getBoundingClientRect().height, strip: document.querySelector('#strip').getBoundingClientRect().height };
  });
  await p.waitForTimeout(500); await p.screenshot({ path: path.join(__dirname, '..', 'shots', 'footprint.png') });
  console.log(JSON.stringify(r)); await b.close();
})();
