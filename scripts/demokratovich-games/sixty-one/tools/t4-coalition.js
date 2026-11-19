// the coalition rules with bots: score spread, stunts, walkouts; plus screenshots of the moments. node t4-coalition.js
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('shlomiverse:sixty-one:tut', '1'); } catch (e) {} });
  await pg.goto('http://localhost:8781/demokratovich-games/sixty-one/?solo=1&notrack=1');
  await pg.waitForFunction(() => window.SIXTYONE && SIXTYONE.ready, null, { timeout: 90000 });
  // the queue of the day
  console.log('queue', await pg.evaluate(() => { SIXTYONE.startGame(); return SIXTYONE.queue.map((e) => e.p.name + e.seats).join(' '); }));
  // balance: timing-error bots, two strategies
  for (const [name, err] of [['slow', 0.085], ['normal', 0.055], ['sharp', 0.035]]) for (const strat of [{}, { noArab: true }]) {
    const res = [];
    for (let g = 0; g < 5; g++) res.push(await pg.evaluate(([err, strat]) => {
      const S = window.SIXTYONE; S.startGame();
      for (let n = 0; n < 200 && S.state === 'play'; n++) {
        const sp = Math.min(5.2, 2.1 + S.drops * 0.07) * (S.poll.on ? 1.35 : 1);
        const gg = (Math.random() + Math.random() + Math.random() - 1.5) * 2;
        S.bot(Math.max(0.02, Math.abs(gg) * err * sp), strat);
      }
      for (let i = 0; i < 300 && S.state !== 'over'; i++) S.tick(1 / 30);
      return S.seats + (S.state === 'over' ? '' : '?');
    }, [err, strat]));
    console.log(name, strat.noArab ? 'no-arabs' : 'arabs  ', res.join(' '));
  }
  // a real-time game for screenshots
  await pg.evaluate(() => SIXTYONE.startGame()); await sleep(1500);
  let shot = 0;
  for (let n = 0; n < 40; n++) {
    const c = await pg.evaluate(() => SIXTYONE.cur && SIXTYONE.cur.bloc);
    if (await pg.evaluate(() => SIXTYONE.state) !== 'play') break;
    if (c && c !== 'us' && shot < 6) { await sleep(500); await pg.screenshot({ path: path.join(OUT, `t4-${c}-${n}.png`) }); shot++; }
    await pg.evaluate(() => SIXTYONE.bot(0.06)); await sleep(500);
    if (n === 12) await pg.screenshot({ path: path.join(OUT, `t4-mid.png`) });
  }
  await sleep(2500); await pg.screenshot({ path: path.join(OUT, `t4-over.png`) });
  console.log('errors', errs.join(' | ') || 'none');
  await br.close();
})();
