// play the game as a phone player: the tutorial (every step, the "try" steps with real drags), then a round steered by a
// small bot with real touch drags, then a crash on purpose and the end screen. node t1-play.js [url]
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
const URL = process.argv[2] || 'http://localhost:8765/sagi-games/scooter-snake/?solo=1&notrack=1';
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (m) => { console.log('FAIL', m); process.exitCode = 1; };

(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
  const pg = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text())); pg.on('response', (r) => r.status() >= 400 && errs.push(r.status() + ' ' + r.url()));
  await pg.goto(URL); await sleep(1200);
  await pg.screenshot({ path: path.join(OUT, '01-start.png') });
  const S = (expr) => pg.evaluate(`(() => { const s = window.SNAKE; return ${expr}; })()`);
  // a drag on the canvas in one direction (pointer events, like a thumb)
  const drag = async (dx, dy) => { const x = 195, y = 640; await pg.mouse.move(x, y); await pg.mouse.down(); await pg.mouse.move(x + dx / 2, y + dy / 2, { steps: 3 }); await pg.mouse.move(x + dx, y + dy, { steps: 3 }); await pg.mouse.up(); };
  await pg.click('#playBtn', { force: true }); await sleep(600);
  if (!(await S('s.tut'))) fail('tutorial did not start');
  for (let i = 0; i < 12 && (await S('s.tut')); i++) {
    const step = await S('s.tutStep');
    await pg.screenshot({ path: path.join(OUT, `02-tut-${step + 1}.png`) });
    if (await pg.$eval('#tutNext', (b) => b.disabled)) {
      if (step === 2) { await sleep(300); await drag(-70, 0); }          // turn
      for (let k = 0; k < 40 && (await pg.$eval('#tutNext', (b) => b.disabled)); k++) await sleep(150);   // catch: ride straight into the colleague
      if (await pg.$eval('#tutNext', (b) => b.disabled)) { fail('try step ' + (step + 1) + ' never finished'); break; }
      await pg.screenshot({ path: path.join(OUT, `02-tut-${step + 1}-done.png`) });
    }
    await pg.keyboard.press('Space'); await sleep(450);
  }
  if (await S('s.tut')) fail('tutorial did not end');
  if ((await S('s.state')) !== 'play') fail('game did not start after the tutorial');
  // the bot: BFS from the head to the target (colleague / client), avoiding furniture, the line and Ofer's tile
  const botMove = () => pg.evaluate(() => {
    const s = window.SNAKE, sn = s.snake, h = sn[0], tgt = s.client || s.food; if (!tgt) return null;
    const block = new Set(sn.slice(0, -1).map((p) => p.c + ',' + p.r)); if (s.ofer && s.ofer.on) { block.add(s.ofer.c + ',' + s.ofer.r); block.add((s.ofer.c + s.ofer.d) + ',' + s.ofer.r); }
    const q = [[h.c, h.r]], prev = new Map([[h.c + ',' + h.r, null]]);
    while (q.length) { const [c, r] = q.shift(); if (c === tgt.c && r === tgt.r) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (c + dx) + ',' + (r + dy); if (prev.has(k) || s.solid(c + dx, r + dy) || block.has(k)) continue; prev.set(k, [c, r]); q.push([c + dx, r + dy]); } }
    let k = tgt.c + ',' + tgt.r; if (!prev.has(k)) return null;
    let cur = [tgt.c, tgt.r]; while (prev.get(k) && prev.get(k).join(',') !== h.c + ',' + h.r) { cur = prev.get(k); k = cur.join(','); }
    return [cur[0] - h.c, cur[1] - h.r];
  });
  let lastD = '', t0 = Date.now(), shot = 0;
  while (Date.now() - t0 < 40000 && (await S('s.state')) === 'play') {
    const d = await botMove();
    if (d && d.join() !== lastD) { lastD = d.join(); await drag(d[0] * 60, d[1] * 60); }
    await sleep(60);
    if (Date.now() - t0 > 8000 * (shot + 1) && shot < 4) { shot++; await pg.screenshot({ path: path.join(OUT, `03-play-${shot}.png`) }); }
  }
  const score = await S('s.score'); console.log('score after the bot round:', score, 'length', await S('s.snake.length'), 'ofer', !!(await S('s.ofer')));
  if (score < 3) fail('bot caught too few: ' + score);
  // crash on purpose: drive into the wall
  if ((await S('s.state')) === 'play') { const h = await S('s.snake[0]'); await drag(h.c < 5 ? -60 : 60, 0); }
  for (let k = 0; k < 60 && (await S('s.state')) === 'play'; k++) await sleep(200);
  await sleep(300); await pg.screenshot({ path: path.join(OUT, '04-crash.png') });
  await sleep(2000); await pg.screenshot({ path: path.join(OUT, '05-over.png') });
  if (!(await pg.$eval('#over', (e) => e.classList.contains('on')))) fail('end screen not shown');
  const best = await pg.evaluate(() => localStorage.getItem('shlomiverse:scooter-snake:best'));
  console.log('best saved:', best);
  if (errs.length) fail('page errors: ' + errs.join(' | '));
  await br.close(); console.log(process.exitCode ? 'DONE with failures' : 'ALL OK');
})();
