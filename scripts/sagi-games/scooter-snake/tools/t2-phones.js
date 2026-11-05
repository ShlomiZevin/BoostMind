// phone sizes by touch: start screen, tutorial card, the board and HUD in play - nothing overflows, the board, HUD and
// buttons are fully on screen, the board does not sit under the HUD. node t2-phones.js [url]
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
const URL = process.argv[2] || 'http://localhost:8765/sagi-games/scooter-snake/?solo=1&notrack=1';
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SIZES = [[320, 568], [360, 640], [390, 844], [412, 915], [844, 390], [1280, 800]];
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  let bad = 0;
  for (const [w, h] of SIZES) {
    const phone = w < 900;
    const pg = await br.newPage({ viewport: { width: w, height: h }, hasTouch: phone, isMobile: phone, deviceScaleFactor: 1 });
    await pg.goto(URL); await sleep(900);
    const tag = `${w}x${h}`;
    const inView = (sel) => pg.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1; });
    const turned = await pg.evaluate(() => document.body.classList.contains('turn'));
    await pg.screenshot({ path: path.join(OUT, `p-${tag}-start.png`) });
    if (turned) { console.log(tag, 'asks to turn the phone (ok)'); await pg.close(); continue; }
    for (const s of ['#playBtn', '#howBtn', '#start .hero']) if (!(await inView(s))) { console.log(tag, 'START: off screen', s); bad++; }
    await pg.tap ? null : null;
    await pg.click('#howBtn', { force: true }); await sleep(500);
    await pg.screenshot({ path: path.join(OUT, `p-${tag}-tut.png`) });
    for (const s of ['#tutNext', '#tutCard']) if (!(await inView(s))) { console.log(tag, 'TUT: off screen', s); bad++; }
    await pg.keyboard.press('Escape'); await sleep(700);
    const g = await pg.evaluate(() => { const B = window.SNAKE.B, s = window.SNAKE; const hud = document.getElementById('hud').getBoundingClientRect(); return { x: B.x, y: B.y, w: B.t * s.COLS, h: B.t * s.ROWS, t: B.t, hudB: hud.bottom, W: innerWidth, H: innerHeight }; });
    await sleep(600); await pg.screenshot({ path: path.join(OUT, `p-${tag}-play.png`) });
    const okBoard = g.x >= 0 && g.y + g.h <= g.H - 30 && g.x + g.w <= g.W && g.y - g.t * 0.8 >= g.hudB - 4;
    console.log(tag, 'tile', g.t, okBoard ? 'board ok' : 'BOARD BAD ' + JSON.stringify(g));
    if (!okBoard) bad++;
    for (const s of ['#pauseBtn', '#scoreBox']) if (!(await inView(s))) { console.log(tag, 'PLAY: off screen', s); bad++; }
    const over = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1);
    if (over) { console.log(tag, 'page overflows'); bad++; }
    await pg.close();
  }
  await br.close(); console.log(bad ? `DONE: ${bad} problems` : 'ALL OK');
  process.exitCode = bad ? 1 : 0;
})();
