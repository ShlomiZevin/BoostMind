// play test: the tutorial (a real swipe), then a bot that walks to the nearest context and away from the chasers
// until the game ends -> ../shots/.  serve the game folder, then: node tools/t1-play.js [URL of the game folder]
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path'), fs = require('fs');
const URL = process.argv[2] || 'http://localhost:5302/yotam-games/pacman/';
const OUT = path.join(__dirname, '..', 'shots'); fs.mkdirSync(OUT, { recursive: true });
const wait = (p, ms) => p.waitForTimeout(ms);
// the bot's brain runs in the page: BFS from Yotam to the nearest dot, tiles next to a chasing colleague are walls
const BOT = `(() => {
  const y = PAC.yotam; if (PAC.state !== 'play') return null;
  const bad = new Set(); for (const c of PAC.CHASERS) if (c.mode === 'chase' || c.mode === 'leave') { const p = PAC.pos(c); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) bad.add(Math.round(p.x + dx) + ',' + Math.round(p.y + dy)); }
  const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const start = [y.tx + (y.dir && y.t > .5 ? D[y.dir][0] : 0), y.ty + (y.dir && y.t > .5 ? D[y.dir][1] : 0)];
  const seen = new Map([[start + '', null]]), q = [start];
  const goal = (x, yy) => window.__dots.has(x + ',' + yy);
  while (q.length) { const [x, yy] = q.shift(); if (goal(x, yy) && (x + ',' + yy) !== start + '') { let k = x + ',' + yy, f = seen.get(k); while (f && f.prev !== start + '') { k = f.prev; f = seen.get(k); } return f ? f.d : null; }
    for (const d in D) { const nx = x + D[d][0], ny = yy + D[d][1], k = nx + ',' + ny; if (!PAC.open(nx, ny) || seen.has(k) || bad.has(k)) continue; seen.set(k, { prev: x + ',' + yy, d }); q.push([nx, ny]); } }
  return null; })()`;
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['wide', { width: 1280, height: 760 }]]) {
    const p = await (await b.newContext({ viewport: vp, deviceScaleFactor: 1 })).newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/t\.js|game-frame|404/.test(m.text())) errs.push(m.text()); });
    await p.goto(URL + (URL.includes('?') ? '&' : '?') + 'solo=1' + (URL.startsWith('https') ? '&notrack=1' : '')); await wait(p, 1500);
    await p.screenshot({ path: `${OUT}/${name}-start.png` });
    await p.click('#playBtn', { force: true }); await wait(p, 700);
    for (let i = 0; i < 3; i++) { await p.screenshot({ path: `${OUT}/${name}-tut${i + 1}.png` }); await p.keyboard.press('Space'); await wait(p, 300); }
    // step 4: a real swipe left
    const c = await p.evaluate(() => ({ x: PAC.px(PAC.pos(PAC.yotam).x), y: PAC.py(PAC.pos(PAC.yotam).y) }));
    await p.mouse.move(c.x, c.y + 80); await p.mouse.down(); await p.mouse.move(c.x - 60, c.y + 80, { steps: 6 }); await p.mouse.up(); await wait(p, 900);
    await p.screenshot({ path: `${OUT}/${name}-tut4.png` });
    for (let i = 0; i < 5; i++) { await p.keyboard.press('Space'); await wait(p, 300); if (i === 0) await p.screenshot({ path: `${OUT}/${name}-tut5-rooms.png` }); if (i === 2) await p.screenshot({ path: `${OUT}/${name}-tut7-hani.png` }); }
    const st = await p.evaluate(() => PAC.state);
    // the bot plays
    const t0 = Date.now(); let sawLift = false, shot = 0, maxLevel = 1, dotsStart = await p.evaluate(() => PAC.dots), sawHani = 0, sawPower = false;
    while (Date.now() - t0 < 120000) {
      if ((await p.evaluate(() => PAC.state)) !== 'play') break;
      const dir = await p.evaluate(`(() => { window.__dots = PAC.dotSet; return ${BOT}; })()`).catch((e) => { errs.push('bot: ' + e.message); return null; });
      if (dir) await p.keyboard.press({ up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[dir]);
      await wait(p, 60);
      const info = await p.evaluate(() => ({ l: PAC.level, h: PAC.haniCount, pw: PAC.power > 0 }));
      maxLevel = Math.max(maxLevel, info.l); sawHani = Math.max(sawHani, info.h); sawPower = sawPower || info.pw;
      if (!shot && Date.now() - t0 > 8000) { shot = 1; await p.screenshot({ path: `${OUT}/${name}-play.png` }); }
      if (shot === 1 && info.pw) { shot = 2; await p.screenshot({ path: `${OUT}/${name}-power.png` }); }
      if (!sawLift && await p.evaluate(() => !!PAC.lift)) { sawLift = true; await wait(p, 3000); await p.screenshot({ path: `${OUT}/${name}-lift.png` }); }
    }
    await wait(p, 2500); await p.screenshot({ path: `${OUT}/${name}-over.png` });
    const end = await p.evaluate(() => ({ state: PAC.state, score: PAC.score, level: PAC.level, dotsLeft: PAC.dots }));
    // 'עוד ספרינט' must start a fresh game that moves
    let again = 'skipped';
    if (end.state === 'over') { await p.click('#againBtn'); await wait(p, 2200); await p.keyboard.press('ArrowLeft'); await wait(p, 1200);
      again = await p.evaluate(() => PAC.state === 'play' && PAC.lives === 3 && PAC.score > 0 ? 'restarts and moves' : 'STUCK ' + PAC.state + ' score ' + PAC.score); }
    console.log(name, '| after tutorial:', st, '| dots at start', dotsStart, '| max floor', maxLevel, '| hani count seen', sawHani, '| coffee', sawPower, '| end', JSON.stringify(end), '| again:', again, '| elevator:', sawLift, errs.length ? 'ERRORS ' + errs.join(' / ') : 'no errors');
  }
  await b.close();
})();
