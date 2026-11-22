// play test: start screen, the whole tutorial with real swipes, real-time play, a bot week (win), a no-hands week (lose)
//   cd public && python -m http.server 5311   ;   node scripts/naomi-games/pause/tools/t1-play.js [width height]
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, '..', 'shots'); fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:5311/naomi-games/pause/';
const wait = (p, ms) => p.waitForTimeout(ms);
const st = (p) => p.evaluate(() => PAUSE.state);
async function swipeCard(p, pred) {
  const s = await st(p); const c = s.cards.find(pred); if (!c) return false;
  const y = c.y, x0 = c.x - c.w / 2 - 30, x1 = c.x + c.w / 2 + 30;
  await p.mouse.move(x0, y + 10); await p.mouse.down(); await p.mouse.move(x1, y - 10, { steps: 4 }); await p.mouse.up();
  return true;
}
(async () => {
  const [W, H] = [Number(process.argv[2]) || 390, Number(process.argv[3]) || 844];
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('t-ignore', '1'); } catch (e) {} });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/t\.js|404|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.goto(URL); await wait(p, 1800);
  await p.screenshot({ path: `${OUT}/start.png` });
  await p.click('#playBtn', { force: true }); await wait(p, 600);
  for (let i = 0; i < 3; i++) { await p.screenshot({ path: `${OUT}/tut${i + 1}.png` }); await p.keyboard.press('Space'); await wait(p, 400); }
  // 4 cut the status message
  await wait(p, 900); await p.screenshot({ path: `${OUT}/tut4.png` });
  await swipeCard(p, (c) => c.type === 'harm'); await wait(p, 300); await p.screenshot({ path: `${OUT}/tut4-cut.png` }); await wait(p, 1200);
  // 5 let the bond land
  let s = await st(p); console.log('step', s.tutStep, s.waiting);
  await wait(p, 1500); await p.screenshot({ path: `${OUT}/tut5.png` });
  for (let k = 0; k < 40 && (await st(p)).waiting === 'letBond'; k++) await wait(p, 200);
  // 6 gold - let it land
  await wait(p, 900); await p.screenshot({ path: `${OUT}/tut6.png` });
  for (let k = 0; k < 60 && (await st(p)).waiting === 'letGold'; k++) await wait(p, 200);
  await wait(p, 300); s = await st(p); console.log('step', s.tutStep, s.waiting);
  await p.screenshot({ path: `${OUT}/tut7.png` }); await p.keyboard.press('Space'); await wait(p, 900);
  await p.screenshot({ path: `${OUT}/tut8.png` });
  await swipeCard(p, (c) => c.type === 'breath'); await wait(p, 1500);
  await p.screenshot({ path: `${OUT}/tut9.png` }); await p.keyboard.press('Space'); await wait(p, 500);
  s = await st(p); console.log('after tutorial', s.mode, s.tutStep);
  // real-time play with a swiping bot for a few seconds
  for (let k = 0; k < 40; k++) {
    s = await st(p);
    const target = s.cards.find((c) => c.state === 'fly' && (c.type === 'harm' || c.type === 'nu') && c.y < H * .72);
    if (target) await swipeCard(p, (c) => c.id === target.id);
    await wait(p, 120);
    if (k === 12) await p.screenshot({ path: `${OUT}/play1.png` });
    if (k === 25) await p.screenshot({ path: `${OUT}/play2.png` });
  }
  await p.screenshot({ path: `${OUT}/play3.png` });
  // fast-forward a whole week with a reading bot (slices harm + nu + breath, leaves bond + gold)
  await p.evaluate(() => { PAUSE.manual = true; PAUSE.start(); });
  const res = await p.evaluate(() => {
    let shot = 0;
    for (let i = 0; i < 60 * 140 && PAUSE.G.mode === "play"; i++) {
      PAUSE.tick(1 / 60);
      for (const c of PAUSE.G.cards) if (c.state === 'fly' && (c.type === 'harm' || c.type === 'nu' || c.type === 'breath') && c.y < PAUSE.L.line + (PAUSE.L.stripT - PAUSE.L.line) * .45) PAUSE.slice(c.id);
    }
    return PAUSE.state;
  });
  console.log('bot week:', JSON.stringify({ mode: res.mode, won: res.won, score: res.score, strikes: res.strikes, paused: res.paused }));
  await p.evaluate(() => { PAUSE.manual = false; }); await wait(p, 1200);
  await p.screenshot({ path: `${OUT}/over-win.png` });
  // a week with no hands -> he resigns
  await p.evaluate(() => { PAUSE.manual = true; PAUSE.start(); for (let i = 0; i < 60 * 80 && PAUSE.G.mode === 'play'; i++) PAUSE.tick(1 / 60); });
  const lose = await st(p); console.log('no hands:', lose.mode, 'won', lose.won, 'strikes', lose.strikes, 't', lose.t.toFixed(1));
  await p.evaluate(() => { PAUSE.manual = false; }); await wait(p, 2000);
  await p.screenshot({ path: `${OUT}/over-lose.png` });
  console.log(errs.length ? 'ERRORS ' + errs.join(' / ') : 'no errors');
  await b.close();
})();
