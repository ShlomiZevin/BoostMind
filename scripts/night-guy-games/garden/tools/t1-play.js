// play it as a phone player: the tutorial (try steps with real drags), loops that claim ground, a girl trapped in a
// loop, a reveal that calls the police, getting caught 3 times, the end screen. node t1-play.js [url]
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
const URL = process.argv[2] || 'http://localhost:8771/night-guy-games/garden/?solo=1&notrack=1';
const OUT = process.env.SHOTS || path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (m) => { console.log('FAIL', m); process.exitCode = 1; };
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
  const pg = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text())); pg.on('response', (r) => r.status() >= 400 && errs.push(r.status() + ' ' + r.url()));
  await pg.goto(URL); await sleep(1500);
  await pg.screenshot({ path: path.join(OUT, '01-start.png') });
  const S = (expr) => pg.evaluate(`(() => { const s = window.GARDEN; return ${expr}; })()`);
  const drag = async (dx, dy) => { const x = 195, y = 600; await pg.mouse.move(x, y); await pg.mouse.down(); await pg.mouse.move(x + dx / 2, y + dy / 2, { steps: 3 }); await pg.mouse.move(x + dx, y + dy, { steps: 3 }); await pg.mouse.up(); };
  const key = (k) => pg.keyboard.press(k);

  // walk through corner cells exactly (fast-forwarded in the page): turn when he stands on a corner
  const walk = (corners, maxSec = 20) => pg.evaluate(([corners, maxSec]) => {
    const s = window.GARDEN; let k = 0;
    const dirTo = (a, b) => b.c > a.c ? s.DIRS.right : b.c < a.c ? s.DIRS.left : b.r > a.r ? s.DIRS.down : s.DIRS.up;
    let p = s.player; s.want(dirTo(p, corners[0]));
    for (let f = 0; f < maxSec * 60 && k < corners.length; f++) {
      s.tick(1 / 60); p = s.player;
      if (p.c === corners[k].c && p.r === corners[k].r) { k++; if (k < corners.length) s.want(dirTo(p, corners[k])); }
    }
    for (let f = 0; f < 30; f++) s.tick(1 / 60);
    return k;
  }, [corners, maxSec]);
  await pg.click('#playBtn', { force: true }); await sleep(700);
  if (!(await S('s.tut'))) fail('tutorial did not start');
  for (let i = 0; i < 14 && (await S('s.tut')); i++) {
    const step = await S('s.tutStep'), tr = await S('s.tutTry');
    await pg.screenshot({ path: path.join(OUT, `02-tut-${step + 1}.png`) });
    if (tr === 'leave') { await drag(0, -70); }
    if (tr === 'claim') { await key('ArrowLeft'); await sleep(230); await key('ArrowDown'); }
    if (tr === 'capture') {
      await pg.evaluate(() => { const s = window.GARDEN; s.girls[0].spd = 0.0001; });
      const G = await S('{c: Math.round(s.girls[0].x), r: Math.round(s.girls[0].y)}'), P = await S('s.player');
      console.log('girl', G, 'player', P.c, P.r);
      // from his ground's top-left corner: up past her, left past her, down, right back into his ground
      const st = await S('s.start'), top = st.r - 2, left = st.c - 2;
      await walk([{ c: P.c, r: top }, { c: left, r: top }, { c: left, r: G.r - 2 }, { c: G.c - 2, r: G.r - 2 }, { c: G.c - 2, r: top + 1 }, { c: left, r: top + 1 }]);
    }
    for (let k = 0; k < 60 && (await pg.$eval('#tutNext', (b) => b.disabled)); k++) await sleep(150);
    if (await pg.$eval('#tutNext', (b) => b.disabled)) { fail('try step ' + (step + 1) + ' (' + tr + ') never finished'); await pg.screenshot({ path: path.join(OUT, `02-tut-${step + 1}-STUCK.png`) }); break; }
    if (tr) await pg.screenshot({ path: path.join(OUT, `02-tut-${step + 1}-done.png`) });
    await key('Space'); await sleep(450);
  }
  if (await S('s.tut')) fail('tutorial did not end');
  await sleep(5200);
  if ((await S('s.state')) !== 'play') fail('game did not start after the tutorial: ' + (await S('s.state')));
  await S('s.clearForTest()');
  // a loop: up 5, right 4, down home
  const p0 = await S('s.pct');
  { const P = await S('s.player'); console.log('before', JSON.stringify(P), await S('s.state'), await S('s.start')); const kk = await walk([{ c: P.c, r: P.r - 6 }, { c: P.c + 4, r: P.r - 6 }, { c: P.c + 4, r: P.r - 1 }, { c: P.c + 2, r: P.r - 1 }]); console.log('corners', kk, JSON.stringify(await S('s.player')), await S('s.state'), await S('s.lives')); }
  const p1 = await S('s.pct'); console.log('pct', p0, '->', p1, 'score', await S('s.score'));
  if (!(p1 > p0)) fail('a loop did not claim ground');
  await pg.screenshot({ path: path.join(OUT, '03-claimed.png') });
  // a girl next to his ground: he talks, then the reveal calls the police (stand still on his ground)
  await S('s.holdForTest()'); await sleep(300); await S('s.holdForTest()');
  const P = await S('s.player');
  await S(`s.girlForTest(${P.c}, ${Math.max(1, P.r - 3)}, 'shake')`);
  for (let k = 0; k < 20 && !(await S('s.talk')); k++) await sleep(100);
  console.log('talk', await S('s.talk'));
  if (!(await S('s.talk'))) fail('he did not start talking to a girl nearby');
  await pg.screenshot({ path: path.join(OUT, '04-talk.png') });
  const pol0 = await S('s.police.length');
  await S('s.tick(0.05, 260)');
  await pg.screenshot({ path: path.join(OUT, '05-reveal.png') });
  console.log('police', pol0, '->', await S('s.police.length'));
  if (!((await S('s.police.length')) > pol0)) fail('the reveal did not call the police');
  // caught 3 times: walk into the restraining-order circle
  for (let n = 0; n < 3 && (await S('s.state')) === 'play'; n++) {
    const z = await S('s.zone'); const pl = await S('s.player');
    await pg.evaluate(([c, r]) => { const s = window.GARDEN; s.clearForTest(); }, [0, 0]);
    // a path around the obstacles to the nearest cell of her circle, walked with real turns
    const route = await pg.evaluate(() => {
      const s = window.GARDEN, p = s.player, key = (c, r) => c + ',' + r, prev = new Map([[key(p.c, p.r), null]]), q = [[p.c, p.r]]; let end = null;
      while (q.length) { const [c, r] = q.shift(); if (s.zoneAt(c, r)) { end = [c, r]; break; }
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nc = c + dx, nr = r + dy; if (s.blockAt(nc, nr) || prev.has(key(nc, nr))) continue; prev.set(key(nc, nr), [c, r]); q.push([nc, nr]); } }
      const cells = []; for (let k = end; k; k = prev.get(key(k[0], k[1]))) cells.unshift({ c: k[0], r: k[1] });
      const corners = []; for (let i = 1; i < cells.length; i++) { const nx = cells[i + 1]; if (!nx || (nx.c - cells[i].c) !== (cells[i].c - cells[i - 1].c) || (nx.r - cells[i].r) !== (cells[i].r - cells[i - 1].r)) corners.push(cells[i]); }
      return corners;
    });
    await walk(route, 15);
    if (n === 0) await pg.screenshot({ path: path.join(OUT, '06-caught.png') });
    await sleep(3200);
  }
  await sleep(1500);
  if ((await S('s.state')) !== 'over') fail('no game over after 3 catches: ' + (await S('s.state')) + ' lives ' + (await S('s.lives')));
  await pg.screenshot({ path: path.join(OUT, '07-over.png') });
  if (await S("s.state") === 'over') await pg.click('#menuBtn', { force: true }); await sleep(400);
  await pg.screenshot({ path: path.join(OUT, '08-menu.png') });
  if (errs.length) fail('errors: ' + errs.join(' | '));
  console.log(process.exitCode ? 'DONE with failures' : 'ALL OK');
  await br.close();
})();
