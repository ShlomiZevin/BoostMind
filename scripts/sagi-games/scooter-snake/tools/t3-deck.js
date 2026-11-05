// close-up of the long scooter in fixed shapes (straight both ways, corners, up, down): node t3-deck.js [url]
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
const URL = process.argv[2] || 'http://localhost:8766/sagi-games/scooter-snake/?solo=1&notrack=1';
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHAPES = {   // the trail's corners, head first
  right: [[7, 11], [1, 11]], left: [[1, 11], [8, 11]],
  lshape: [[6, 13], [6, 11], [0, 11]], up: [[4, 8], [4, 14]], down: [[4, 13], [4, 7]],
  zig: [[7, 13], [7, 12], [4, 12], [4, 10], [8, 10]],
};
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const pg = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await pg.goto(URL); await sleep(1000);
  await pg.evaluate(() => localStorage.setItem('shlomiverse:scooter-snake:tut', '1'));
  await pg.click('#playBtn', { force: true }); await sleep(3000);   // let the start bubble go
  for (const [name, cells] of Object.entries(SHAPES)) {
    await pg.evaluate((cells) => window.SNAKE.setLineForTest(cells, 6), cells);
    await sleep(200);
    const B = await pg.evaluate(() => window.SNAKE.B);
    await pg.screenshot({ path: path.join(OUT, `deck-${name}.png`), clip: { x: B.x, y: B.y + B.t * 5.5, width: B.t * 9, height: B.t * 9 } });
  }
  await br.close(); console.log('ok');
})();
