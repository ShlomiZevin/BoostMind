// play it as a player: the whole tutorial with real drags, then a real round played by a bot (reads the ring through
// the test hook, drags to the vague answer) until a stage card, then mistakes on purpose until removed.
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const OUT = __dirname + '/../shots/';
const BASE = (process.env.BASE || 'http://localhost:5331') + '/techytech-games/not-the-question/?solo=1';
const SA = Math.PI * 2 / 12;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(1200);
  const st = () => p.evaluate(() => NTQ.state);
  // drag by dx pixels on the canvas (pointer events)
  async function drag(dx) { const y = 600; await p.mouse.move(195, y); await p.mouse.down(); const n = 8; for (let i = 1; i <= n; i++) await p.mouse.move(195 + dx * i / n, y); await p.mouse.up(); }
  // turn (by real drags) until Daniel is over slot k
  async function turnTo(k) {
    for (let tries = 0; tries < 8; tries++) {
      const s = await p.evaluate(() => ({ rot: NTQ.G.rot, w: document.getElementById('cv').clientWidth }));
      const want = -((k + 1) * SA); // centre of a 2-slice panel starting at k
      let d = want - s.rot; d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      if (Math.abs(d) < 0.12) return;
      const px = d / (Math.PI * 2 / (s.w * 1.15));
      await drag(Math.max(-300, Math.min(300, px)));
    }
  }

  // --- the tutorial (first play runs it by itself)
  await p.tap('#playB', { force: true }); await p.waitForTimeout(700);
  for (let i = 0; i < 12; i++) {
    const s = await st(); if (!s.tut) break;
    const txt = await p.textContent('#tt');
    await p.screenshot({ path: OUT + `t-step${s.step + 1}.png` });
    const tryStep = await p.evaluate(() => document.getElementById('tcard').classList.contains('try'));
    console.log('step', s.step + 1, tryStep ? '(try)' : '', txt.slice(0, 60));
    if (tryStep && s.step === 3) { await drag(160); await drag(-160); await p.waitForTimeout(1300); continue; }
    if (tryStep && s.step === 6) {
      const r = await p.evaluate(() => NTQ.ring(0)); const v = r.panels.find((x) => x.kind === 'vague');
      await turnTo(v.s0); await p.waitForTimeout(2200); continue;
    }
    await p.tap('#tnext', { force: true }); await p.waitForTimeout(500);
  }
  let s = await st(); console.log('after tutorial:', JSON.stringify(s));
  if (s.tut) console.log('FAIL tutorial did not finish');

  // --- a real round: the bot answers vague until the first stage card
  await p.waitForTimeout(600);
  let shots = 0;
  for (let n = 0; n < 60; n++) {
    s = await st();
    if (await p.isVisible('#card')) { await p.screenshot({ path: OUT + 'r-stage.png' }); console.log('stage card at', s.score, await p.textContent('#cL2')); await p.tap('#cGo', { force: true }); break; }
    const r = await p.evaluate(() => NTQ.ring()); if (!r) break;
    const v = r.panels.find((x) => x.kind === 'vague');
    await turnTo(v.s0); await p.waitForTimeout(900);
    if (shots < 2 && n % 4 === 2) { await p.screenshot({ path: OUT + `r-play${shots++}.png` }); }
  }
  s = await st(); console.log('after stage 1:', JSON.stringify(s));
  // --- now answer CLEARLY on purpose until removed
  for (let n = 0; n < 10 && !(await st()).over; n++) {
    const r = await p.evaluate(() => NTQ.ring()); const c = r.panels.find((x) => x.kind === 'clear');
    await turnTo(c.s0); await p.waitForTimeout(450);
    if (n === 0) await p.screenshot({ path: OUT + 'r-reject.png' });
    await p.waitForTimeout(1200);
  }
  await p.waitForTimeout(3800);
  s = await st(); console.log('end:', JSON.stringify(s), 'over screen:', await p.isVisible('#over'), await p.textContent('#oScore'));
  await p.screenshot({ path: OUT + 'r-over.png' });
  await p.tap('#againB', { force: true }); await p.waitForTimeout(800);
  console.log('again:', JSON.stringify(await st()), 'best key:', await p.evaluate(() => localStorage.getItem('shlomiverse:not-the-question:best')));
  console.log('errors:', errs.join(' | ') || 'none');
  await b.close();
})();
