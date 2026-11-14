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
  const S = () => p.evaluate(() => ({ st: SHABBAT_DOOR.state, z: +SHABBAT_DOOR.z.toFixed(2), green: SHABBAT_DOOR.green, i: SHABBAT_DOOR.tut.i, oops: SHABBAT_DOOR.oops }));
  for (let k = 0; k < 6; k++) { await p.screenshot({ path: OUT + `t-tut${k + 1}.png` }); await p.keyboard.press('Enter'); await sleep(350); }
  const wb = await p.locator('#walkBtn').boundingBox();
  const down = () => p.mouse.move(wb.x + wb.width / 2, wb.y + wb.height / 2).then(() => p.mouse.down());
  // try steps: walk on green, stand on red - with real presses
  for (const step of ['walk', 'freeze', 'pass']) {
    await p.screenshot({ path: OUT + `t-try-${step}.png` });
    let isDown = false;
    for (let t = 0; t < 500; t++) {
      const s = await p.evaluate(() => ({ g: SHABBAT_DOOR.green, left: SHABBAT_DOOR.timeLeft, z: SHABBAT_DOOR.z, done: !document.getElementById('tutNext').disabled }));
      if (s.done) break;
      let go = s.g && s.left > 0.45;
      if (step === 'walk' && s.z > 0.2) go = false;
      if (go && !isDown) { await down(); isDown = true; } else if (!go && isDown) { await p.mouse.up(); isDown = false; }
      if (step === 'freeze' && t === 25) await p.screenshot({ path: OUT + 't-red.png' });
      await sleep(80);
    }
    if (isDown) await p.mouse.up();
    console.log('tut', step, await S());
    await p.keyboard.press('Enter'); await sleep(300);
  }
  await p.screenshot({ path: OUT + 't-tut-last.png' });
  await p.keyboard.press('Enter'); await sleep(1500);
  console.log('game', await S());
  await p.screenshot({ path: OUT + 't-play1.png' });
  for (let t = 0; t < 40; t++) { await sleep(100); if (await p.evaluate(() => !SHABBAT_DOOR.green && SHABBAT_DOOR.redFor > 0.5)) break; }
  await p.screenshot({ path: OUT + 't-play-red.png' });
  // bots, fast-forwarded: careful (stops early), sharp (stops late), sloppy (always holds), slow (very careful)
  for (const [bot, margin] of [['careful', 0.5], ['sharp', 0.1], ['slow', 1.2], ['sloppy', -1]]) {
    await p.evaluate(() => SHABBAT_DOOR.startGame());
    const r = await p.evaluate(([bot, margin]) => {
      const G = SHABBAT_DOOR; let n = 0;
      while (G.state === 'play' && n < 60 * 400) { n++; const go = margin < 0 ? true : (G.green && G.timeLeft > margin); G.hold(go); G.tick(1 / 60); }
      return { bot, failed: G.failed, time: Math.round(G.clock), doors: G.si, mistakes: G.mistakes };
    }, [bot, margin]);
    console.log(JSON.stringify(r));
    await sleep(300);
  }
  await sleep(2800); await p.screenshot({ path: OUT + 't-over.png' });
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
