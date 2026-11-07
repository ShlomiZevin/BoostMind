// the rare moments: the stress-eating bite, the 3% charger, a wrong item, full hands, the fake laugh freeze
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path'), OUT = path.join(__dirname, '..', 'shots');
const URL = process.argv[2] || 'http://localhost:5310/osnat-games/not-a-cog/?solo=1';
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const miss = []; p.on('response', (r) => r.status() >= 400 && miss.push(r.status() + ' ' + r.url()));
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1000);
  await p.evaluate(() => { localStorage.setItem('shlomiverse:not-a-cog:tut', '1'); }); await p.click('#playBtn', { force: true }); await p.waitForTimeout(500);
  const out = {};
  // snack: two seated, both nearly gone, Osnat idle
  out.snack = await p.evaluate(async () => {
    const N = NOTACOG; N.forceDay(5); await new Promise((r) => setTimeout(r, 200));
    N.spawn({ p: { id: 'c1', f: true }, want: ['dog'] }); N.spawn({ p: { id: 'c2', f: false }, want: ['charger'] });
    N.cands.forEach((c, i) => { c.desk = N.desks[i]; N.desks[i].c = c; c.x = c.desk.x; c.y = c.desk.y; c.st = 'want'; c.bat = 0.2; });
    N.osnat.snackT = 0; await new Promise((r) => setTimeout(r, 400));
    return { pose: N.osnat.pose, crunch: N.sndLog.some((n) => n.startsWith('crunch')) };
  });
  await p.screenshot({ path: `${OUT}/t4-snack.png` });
  // charger: drains twice as fast, and fills the battery when it comes
  out.charger = await p.evaluate(async () => {
    const N = NOTACOG, c = N.desks[1].c; N.desks.forEach((d) => d.c && (d.c.bat = 1)); const b0 = c.bat; await new Promise((r) => setTimeout(r, 1000)); const drain = b0 - c.bat;
    const c0 = N.desks[0].c; const b1 = c0.bat; await new Promise((r) => setTimeout(r, 0));
    c.bat = 0.5; N.osnat.hands = ['charger']; N.queueTask({ type: 'desk', desk: N.desks[1] }); await new Promise((r) => setTimeout(r, 2500));
    return { drainPerSec: +drain.toFixed(3), afterCharger: +c.bat.toFixed(2), state: c.st };
  });
  // wrong item + full hands
  out.wrong = await p.evaluate(async () => {
    const N = NOTACOG; N.osnat.hands = ['ring', 'matcha']; N.queueTask({ type: 'desk', desk: N.desks[0] }); N.queueTask({ type: 'pick', id: 'dog' });
    await new Promise((r) => setTimeout(r, 4000));
    return { handsNow: N.osnat.hands.slice(), expect: 'matcha,dog', pops: [...document.querySelectorAll('.pop')].map((e) => e.textContent) };
  });
  // the laugh freezes the batteries
  await p.evaluate(() => { NOTACOG.desks[0].c && (NOTACOG.desks[0].c.bat = 0.9); });
  await p.locator('#laughBtn').tap();
  out.laugh = await p.evaluate(async () => { const c = NOTACOG.desks[0].c; const b0 = c && c.bat; await new Promise((r) => setTimeout(r, 2000)); return { frozen: c ? Math.abs(c.bat - b0) < 0.001 : 'no cand', cool: NOTACOG.laughCool > 0 }; });
  await p.screenshot({ path: `${OUT}/t4-laugh.png` });
  await p.locator('#laughBtn').tap();   // on cooldown: nothing
  console.log(JSON.stringify(out, null, 1));
  console.log('missing files:', miss.join(' | ') || 'none'); console.log(errs.length ? 'ERRORS ' + errs.join(' / ') : 'no errors');
  await b.close();
})();
