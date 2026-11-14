// hold the real button straight through a door: the next corridor must open with its card and no "caught"
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const OUT = __dirname + '/../shots/', BASE = process.env.BASE || 'http://localhost:5302/hani-games';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { localStorage.setItem('t-ignore', '1'); localStorage.setItem('hani-games:shabbat-door:tut', '1'); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/shabbat-door/?solo=1'); await sleep(1200);
  await p.click('#playBtn', { force: true }); await sleep(400);
  await p.screenshot({ path: OUT + 'c-card1.png' });
  const wb = await p.locator('#walkBtn').boundingBox();
  await p.mouse.move(wb.x + wb.width / 2, wb.y + wb.height / 2);
  let down = false, shot2 = false;
  for (let t = 0; t < 600; t++) {
    const s = await p.evaluate(() => ({ g: SHABBAT_DOOR.green, left: SHABBAT_DOOR.timeLeft, z: SHABBAT_DOOR.z, si: SHABBAT_DOOR.si, intro: SHABBAT_DOOR.intro, m: SHABBAT_DOOR.mistakes, card: document.getElementById('lvl').classList.contains('on') }));
    if (s.si === 1 && s.card && !shot2) { shot2 = true; await sleep(700); await p.screenshot({ path: OUT + 'c-card2.png' }); console.log('card 2 shown, mistakes so far', s.m); }
    if (s.si === 2) { console.log('reached corridor 3, mistakes', s.m); break; }
    // keep the finger DOWN through the door (the old bug); otherwise walk on green only
    const go = (s.g && (s.left > 0.45 || s.z > 0.85)) || s.z > 1.0;
    if (go && !down) { await p.mouse.down(); down = true; } else if (!go && down && s.z <= 1.0) { await p.mouse.up(); down = false; }
    await sleep(60);
  }
  if (down) await p.mouse.up();
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
