// plays the tutorial with real presses, then whole runs with bots (fast-forwarded through the test hook), screenshots in ../shots
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const OUT = __dirname + '/../shots/', BASE = process.env.BASE || 'http://localhost:5302/hani-games';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => localStorage.setItem('t-ignore', '1'));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.goto(BASE + '/shabbat-door/?solo=1'); await sleep(1500);
  await p.screenshot({ path: OUT + 't-start.png' });
  await p.click('#playBtn', { force: true }); await sleep(600);
  const S = () => p.evaluate(() => ({ st: SHABBAT_DOOR.state, z: +SHABBAT_DOOR.z.toFixed(2), open: SHABBAT_DOOR.open, i: SHABBAT_DOOR.tut.i, oops: SHABBAT_DOOR.oops }));
  for (let k = 0; k < 5; k++) { await p.screenshot({ path: OUT + `t-tut${k + 1}.png` }); await p.keyboard.press('Enter'); await sleep(350); }
  // step 6: walk a little with the real button and stop
  await p.screenshot({ path: OUT + 't-tut6.png' });
  const wb = await p.locator('#walkBtn').boundingBox();
  await p.mouse.move(wb.x + wb.width / 2, wb.y + wb.height / 2); await p.mouse.down(); await sleep(1300); await p.mouse.up(); await sleep(400);
  console.log('after walk', await S());
  await p.keyboard.press('Enter'); await sleep(300);
  // step 7: hurry
  await p.screenshot({ path: OUT + 't-tut7.png' });
  const fb = await p.locator('#fastBtn').boundingBox();
  await p.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2); await p.mouse.down(); await sleep(250); await p.mouse.up(); await sleep(300);
  console.log('after fast', await S());
  await p.keyboard.press('Enter'); await sleep(300);
  // step 8: wait for green and pass (real presses)
  await p.screenshot({ path: OUT + 't-tut8.png' });
  for (let t = 0; t < 400; t++) {
    const s = await p.evaluate(() => ({ z: SHABBAT_DOOR.z, open: SHABBAT_DOOR.open, left: SHABBAT_DOOR.timeLeft, i: SHABBAT_DOOR.tut.i, done: !document.getElementById('tutNext').disabled }));
    if (s.done) break;
    const go = s.z < 0.7 || (s.open && s.left > 1.6);
    if (go) await p.mouse.move(wb.x + wb.width / 2, wb.y + wb.height / 2), await p.mouse.down(); else await p.mouse.up();
    if (t === 30) await p.screenshot({ path: OUT + 't-tut8-wait.png' });
    await sleep(100);
  }
  await p.mouse.up();
  console.log('tut pass', await S());
  await p.keyboard.press('Enter'); await sleep(300); await p.screenshot({ path: OUT + 't-tut9.png' });
  await p.keyboard.press('Enter'); await sleep(800);
  console.log('game', await S());
  await p.screenshot({ path: OUT + 't-play1.png' });
  // bots: a careful one, a sloppy one that just holds walk
  for (const bot of ['careful', 'sloppy', 'careful-fast']) {
    await p.evaluate(() => SHABBAT_DOOR.startGame());
    const r = await p.evaluate((bot) => {
      const G = SHABBAT_DOOR; let n = 0, shots = 0;
      while (G.state === 'play' && n < 60 * 60 * 6) {
        n++;
        let go, fast = false;
        if (bot === 'sloppy') go = true;
        else {
          const before = G.z < G.matZ - 0.04;
          const need = (G.pastZ - Math.max(G.z, G.matZ)) / 0.2 + 0.25;
          go = before ? true : false;
          if (G.z >= G.matZ - 0.04 && G.open && G.timeLeft > need) go = true;
          if (G.z >= G.matZ - 0.04 && G.open && bot === 'careful-fast' && G.timeLeft > need * 0.5 && G.fastLeft > 0.6) { go = true; fast = true; }
          if (G.z >= G.matZ && G.z < G.pastZ && G.open) go = true;
          if (before && G.z > G.matZ - 0.08 && !G.open) go = false;
        }
        G.hold(go); G.fast(fast); G.tick(1 / 60);
      }
      return { bot, state: G.state, time: Math.round(G.clock), mistakes: G.mistakes, rolls: G.rolls, frames: n };
    }, bot);
    console.log(r);
    await sleep(300);
  }
  await sleep(2800); await p.screenshot({ path: OUT + 't-over.png' });
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
