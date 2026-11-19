// plays it: start screen, the tutorial (every step, real taps), a game with a sharp bot up past 61, a miss, the end screen.
// node t1-play.js [url] [w] [h]
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
const URL = process.argv[2] || 'http://localhost:8781/demokratovich-games/sixty-one/?solo=1&notrack=1';
const w = +process.argv[3] || 390, h = +process.argv[4] || 844;
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (m) => { console.log('FAIL', m); process.exitCode = 1; };
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const pg = await br.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }); await pg.addInitScript(() => { try { localStorage.setItem('t-ignore', '1'); } catch (e) {} });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto(URL);
  await pg.waitForFunction(() => window.SIXTYONE && window.SIXTYONE.rabbi && SIXTYONE.ready, null, { timeout: 90000 }).catch(() => fail('rabbi never loaded'));
  await sleep(800);
  await pg.screenshot({ path: path.join(OUT, `t1-1start.png`) });
  console.log('clips', await pg.evaluate(() => window.SIXTYONE.clips.join(',')));
  await pg.click('#playBtn', { force: true }); await sleep(600);
  // tutorial
  for (let i = 0; i < 12; i++) {
    const s = await pg.evaluate(() => ({ on: SIXTYONE.tut, step: SIXTYONE.tutStep, tr: SIXTYONE.tutTry }));
    if (!s.on) break;
    await pg.screenshot({ path: path.join(OUT, `t1-2tut-${s.step}.png`) });
    if (s.tr) {
      if (s.tr === 'veto') { const b = await pg.locator('#vetoBtn').boundingBox(); await pg.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); }
      else if (s.tr === 'any') await pg.evaluate(() => SIXTYONE.bot(0.1));
      else await pg.touchscreen.tap(w * 0.3, h * 0.5);
      await sleep(900);
      if (!(await pg.evaluate(() => SIXTYONE.tutDone))) fail('try step not done ' + s.step);
      await pg.screenshot({ path: path.join(OUT, `t1-2tut-${s.step}-done.png`) });
    }
    await pg.click('#tutNext', { force: true }); await sleep(500);
  }
  if (await pg.evaluate(() => SIXTYONE.state) !== 'play') fail('not playing after tutorial: ' + await pg.evaluate(() => SIXTYONE.state));
  await sleep(1200);
  await pg.screenshot({ path: path.join(OUT, `t1-3play-start.png`) });
  // a sharp bot: drop when nearly aligned; mostly perfect, sometimes a bit off
  let shots = 0;
  for (let n = 0; n < 80; n++) {
    if (await pg.evaluate(() => SIXTYONE.state) !== 'play') break;
    await pg.evaluate((w) => SIXTYONE.bot(w), n % 5 === 4 ? 0.3 : 0.06); await sleep(400);
    const st = await pg.evaluate(() => ({ seats: SIXTYONE.seats, drops: SIXTYONE.drops, poll: SIXTYONE.poll.on }));
    if (st.drops === 6 || (st.poll && shots < 2) || (st.seats >= 61 && shots < 3)) { shots++; await sleep(700); await pg.screenshot({ path: path.join(OUT, `t1-4play-${st.drops}.png`) }); }
    if (st.seats >= 66) break;
  }
  console.log('after bot', JSON.stringify(await pg.evaluate(() => ({ seats: SIXTYONE.seats, drops: SIXTYONE.drops, tower: SIXTYONE.tower.length }))));
  await pg.screenshot({ path: path.join(OUT, `t1-5high.png`) });
  // a miss on purpose
  await pg.evaluate(() => SIXTYONE.missDrop()); await sleep(1000);
  await pg.screenshot({ path: path.join(OUT, `t1-6miss.png`) });
  await sleep(1500);
  console.log('state', await pg.evaluate(() => SIXTYONE.state));
  await pg.screenshot({ path: path.join(OUT, `t1-7over.png`) });
  if (errs.length) fail('errors ' + errs.join(' | '));
  await br.close();
})();
