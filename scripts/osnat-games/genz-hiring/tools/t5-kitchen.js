// his notes (8 Nov): Osnat takes perks from the kitchenette counter (behind it, not at the door), the ready
// contract says "to sign" with a finger on the desk, the clock = time until he leaves, a signed hire goes home
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path'), OUT = path.join(__dirname, '..', 'shots');
const URL = process.argv[2] || 'http://localhost:5310/osnat-games/not-a-cog/?solo=1';
const SIZES = [[390, 844], [320, 568], [412, 915], [768, 1024], [1280, 800]];
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  let bad = 0;
  for (const [w, h] of SIZES) {
    const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: w < 900, deviceScaleFactor: w === 390 ? 2 : 1 });
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(800);
    await p.evaluate(() => localStorage.setItem('shlomiverse:not-a-cog:tut', '1'));
    await p.click('#playBtn', { force: true }); await p.waitForTimeout(400);
    const r = await p.evaluate(async () => {
      const N = NOTACOG, wait = (ms) => new Promise((r) => setTimeout(r, ms)); N.freeze = true;
      N.forceDay(5); await wait(300);
      N.cands.length = 0; N.desks.forEach((d) => d.c = null);
      N.spawn({ p: { id: 'c1', f: true }, want: ['dog', 'matcha'] }); N.spawn({ p: { id: 'c2', f: false }, want: ['ring'] }); N.spawn({ p: { id: 'c4', f: false }, want: ['title'] });
      const [a, c, e] = N.cands;
      [a, c].forEach((x, i) => { x.desk = N.desks[i]; N.desks[i].c = x; x.x = x.desk.x; x.y = x.desk.y; x.st = 'want'; });
      a.bat = 0.8; c.bat = 0.2; c.got = ['ring']; c.st = 'ready'; e.x = e.sx; e.y = e.sy; e.st = 'lobby'; e.bat = 0.6;
      N.freeze = false;
      // tap the matcha on the counter: she must end up behind the counter, under its top edge
      const st = document.querySelector('.st[data-id="matcha"]').getBoundingClientRect();
      document.querySelector('.st[data-id="matcha"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      for (let i = 0; i < 40 && N.osnat.task; i++) await wait(100);
      while (N.osnat.task || N.osnat.queue.length) await wait(50);
      N.freeze = true;
      const bar = document.getElementById('bar').getBoundingClientRect();
      const ox = document.body.getBoundingClientRect().left;
      return { atX: Math.abs(N.osnat.x + ox - (st.left + st.width / 2)) < 6, behindCounter: N.osnat.y > bar.top && N.osnat.y < bar.top + bar.height * 0.6, hands: N.osnat.hands.slice(),
        lobbyAboveItems: N.cands[2].y < st.top + 4, laughAboveItems: document.getElementById('laughBtn').getBoundingClientRect().bottom <= st.top + 2 };
    });
    await p.screenshot({ path: `${OUT}/t5-${w}.png` });
    // sign: tap the ready desk, she brings the contract, he goes home
    const s = await p.evaluate(async () => {
      const N = NOTACOG, wait = (ms) => new Promise((r) => setTimeout(r, ms)); N.freeze = false;
      const c = N.desks[1].c; N.queueTask({ type: 'desk', desk: N.desks[1] });
      for (let i = 0; i < 60 && c.st !== 'leave'; i++) await wait(100);
      return { st: c.st, thought: c.thought };
    });
    const ok = r.atX && r.behindCounter && r.hands.includes('matcha') && r.lobbyAboveItems && r.laughAboveItems && s.st === 'leave' && !errs.length;
    if (!ok) bad++;
    console.log(`${w}x${h}`, ok ? 'OK' : 'FAIL', JSON.stringify(r), JSON.stringify(s), errs.join(' | '));
    await p.close();
  }
  await b.close();
  console.log(bad ? `${bad} sizes failed` : 'all sizes pass');
  process.exit(bad ? 1 : 0);
})();
