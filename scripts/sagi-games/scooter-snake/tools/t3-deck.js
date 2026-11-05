// close-up of the long scooter in fixed shapes (a straight line, corners, the tail going up / down): node t3-deck.js [url]
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
const URL = process.argv[2] || 'http://localhost:8766/sagi-games/scooter-snake/?solo=1&notrack=1';
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// each shape: list of [c, r] head first; dx/dy = the way each one is going (toward the one before it)
const SHAPES = {
  right: [[6, 11], [5, 11], [4, 11], [3, 11], [2, 11]],
  lshape: [[6, 13], [6, 12], [6, 11], [5, 11], [4, 11], [3, 11]],
  up: [[4, 9], [4, 10], [4, 11], [4, 12], [4, 13]],
  down: [[4, 13], [4, 12], [4, 11], [4, 10], [4, 9]],
  left: [[2, 11], [3, 11], [4, 11], [5, 11], [6, 11]],
};
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const pg = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await pg.goto(URL); await sleep(1200);
  await pg.evaluate(() => { localStorage.setItem('shlomiverse:scooter-snake:tut', '1'); });
  await pg.click('#playBtn', { force: true }); await sleep(800);
  for (const [name, cells] of Object.entries(SHAPES)) {
    await pg.evaluate((cells) => {
      const S = window.SNAKE; S.moving = false;
      const kinds = ['sagi', 1, 2, 3, 4, 5, 6];
      S.snakeForTest = cells.map(([c, r], i) => {
        const prev = i ? cells[i - 1] : null, next = cells[i + 1];
        let dx, dy;
        if (prev) { dx = prev[0] - c; dy = prev[1] - r; } else { dx = c - next[0]; dy = r - next[1]; }
        return { c, r, pc: c, pr: r, dx, dy, face: dx < 0 ? -1 : 1, kind: kinds[i], join: 1 };
      });
      // the corner points use pc/pr of the one in front: set them to where it came from
      const sn = window.SNAKE.snake; for (let i = 0; i < sn.length - 1; i++) { sn[i].pc = sn[i + 1].c; sn[i].pr = sn[i + 1].r; sn[i].c = sn[i].c; }
    }, cells);
    await sleep(250);
    const B = await pg.evaluate(() => window.SNAKE.B);
    await pg.screenshot({ path: path.join(OUT, `deck-${name}.png`), clip: { x: B.x, y: B.y + B.t * 6, width: B.t * 9, height: B.t * 9 } });
  }
  await br.close(); console.log('ok');
})();
