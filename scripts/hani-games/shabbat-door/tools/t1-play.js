// plays the tutorial with real presses (each "try" step waits for the real action), then whole runs with bots
// (fast-forwarded through the test hook), then checks the other visitors never overlap or jump. Screenshots in ../shots
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const OUT = __dirname + '/../shots/', BASE = process.env.BASE || 'http://localhost:5302/hani-games';
const BOT = (G, st, gap, margin, gmax) => {
  const pace = 0.065 / Math.max(gap, 0.12);
  let go = margin < 0 ? true : (G.green && G.timeLeft > margin);
  if (margin >= 0 && G.z < G.doorZ - 0.08 && G.z > G.doorZ - 0.22 && (G.pastZ - G.z) / pace > G.timeLeft - 0.25) go = false;
  let g = gap; if (G.gasa > gmax) g = Math.max(gap, 0.4);
  if (go && G.simT - st.last >= g) { st.last = G.simT; G.tap(); }
  G.tick(1 / 60);
};
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
  const wb = await p.locator('#walkBtn').boundingBox();
  await p.mouse.move(wb.x + wb.width / 2, wb.y + wb.height / 2);
  let isDown = false;
  for (let guard = 0; guard < 40; guard++) {
    const st = await p.evaluate(() => ({ i: SHABBAT_DOOR.tut.i, on: SHABBAT_DOOR.tut.on, wait: document.getElementById('tutNext').disabled }));
    if (!st.on) break;
    await p.screenshot({ path: OUT + `t-tut${st.i + 1}.png` });
    if (st.wait) {   // a "try" step: walk on green (short of פסיעה גסה), stand on red
      for (let t = 0; t < 600; t++) {
        const s = await p.evaluate(() => ({ g: SHABBAT_DOOR.green, left: SHABBAT_DOOR.timeLeft, z: SHABBAT_DOOR.z, gasa: SHABBAT_DOOR.gasa, i: SHABBAT_DOOR.tut.i, done: !document.getElementById('tutNext').disabled }));
        if (s.done) break;
        let go = s.g && s.left > 0.45 && s.gasa < 0.5;
        if (go) { await p.mouse.down(); await p.mouse.up(); }
        await sleep(330);
      }
      if (isDown) { await p.mouse.up(); isDown = false; }
      console.log('try step', st.i + 1, 'done');
    }
    await p.keyboard.press('Enter'); await sleep(350);
  }
  await sleep(600);
  console.log('game', await p.evaluate(() => ({ st: SHABBAT_DOOR.state, cardWaits: SHABBAT_DOOR.introWait, clock: SHABBAT_DOOR.clock })));
  await p.screenshot({ path: OUT + 't-card.png' });
  await sleep(1300); await p.click('#lvlGo', { force: true }); await sleep(1500);
  await p.screenshot({ path: OUT + 't-count.png' });
  await sleep(2200); await p.screenshot({ path: OUT + 't-play1.png' });
  // bots: tap rhythm (gap s), stop margin before red, ring limit. runner taps far too fast; sloppy taps on red too
  for (const [bot, gap, margin, gmax] of [['careful', 0.34, 0.5, 0.6], ['sharp', 0.24, 0.3, 0.55], ['slow', 0.45, 1.0, 0.5], ['hurry', 0.22, 0.3, 9], ['runner', 0.14, 0.3, 9], ['sloppy', 0.3, -1, 0.6]]) {
    await p.evaluate(() => SHABBAT_DOOR.startGame());
    const r = await p.evaluate(([bot, gap, margin, gmax, BOTS]) => {
      const BOT = eval(BOTS); const G = SHABBAT_DOOR; let n = 0; const st = { last: -9 };
      while (G.state === 'play' && n < 60 * 400) { n++; if (G.introWait) G.cardGo(); BOT(G, st, gap, margin, gmax); }
      return { bot, failed: G.failed, time: Math.round(G.clock), doors: G.si, mistakes: G.mistakes };
    }, [bot, gap, margin, gmax, BOT.toString()]);
    console.log(JSON.stringify(r));
  }
  // the visitors: across whole runs, two on the same side never overlap, nobody jumps sideways, everyone moves on green
  const ppl = await p.evaluate((BOTS) => {
    const BOT = eval(BOTS); const G = SHABBAT_DOOR; let overlaps = 0, maxJump = 0, frames = 0, movedOnGreen = 0, caught = 0, stuck = 0, closedOk = 0, openOnRed = 0;
    for (let run = 0; run < 3; run++) {
      G.startGame(); const last = new Map(); let n = 0; const st = { last: -9 };
      while (G.state === 'play' && n++ < 60 * 300) {
        if (G.introWait) G.cardGo();
        BOT(G, st, 0.3, 0.5, 0.6); frames++;
        if (!G.green && G.doorOpen < 0.01) closedOk++; if (!G.green && G.redFor > 0.6 && G.doorOpen > 0.01) openOnRed++;
        const live = G.people.filter((q) => !q.done && q.out <= 0 && q.back <= 0);
        for (const a of live) for (const c of live) if (a !== c && a.lane === c.lane && Math.abs(a.z - c.z) < 0.08) overlaps++;
        for (const q of G.people) {
          const prev = last.get(q); if (prev !== undefined && q.out <= 0 && q.back <= 0 && !q.done) maxJump = Math.max(maxJump, Math.abs(q.z - prev));
          if (prev !== undefined && q.z > prev && G.green) movedOnGreen++;
          if (q.out > 1.08) caught++;
          last.set(q, q.z);
        }
      }
    }
    return { frames, overlaps, maxJump: +maxJump.toFixed(3), movedOnGreen, caught, openOnRed };
  }, BOT.toString());
  console.log('visitors', JSON.stringify(ppl));
  await sleep(2800); await p.screenshot({ path: OUT + 't-over.png' });
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
