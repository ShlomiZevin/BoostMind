// his note (8 Nov): the counter buttons must not be too close on a phone, and the picture itself is the button.
// every size x every day's number of perks: the gap between round buttons >= 10px, a tap on the picture hits it
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path'), OUT = path.join(__dirname, '..', 'shots');
const URL = process.argv[2] || 'http://localhost:5310/osnat-games/not-a-cog/?solo=1';
const SIZES = [[320, 568], [360, 640], [390, 844], [412, 915], [768, 1024], [1280, 800]];
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  let bad = 0;
  for (const [w, h] of SIZES) {
    const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: w < 900 });
    await p.goto(URL); await p.waitForTimeout(700);
    await p.evaluate(() => localStorage.setItem('shlomiverse:not-a-cog:tut', '1'));
    await p.click('#playBtn', { force: true }); await p.waitForTimeout(400);
    const rows = [];
    for (const day of [1, 2, 3, 4, 5]) {
      await p.evaluate((d) => NOTACOG.forceDay(d), day); await p.waitForTimeout(250);
      const r = await p.evaluate(() => {
        const bar = document.getElementById('bar');
        const cs = [...document.querySelectorAll('.st')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, d: r.width, id: e.dataset.id, out: r.left < 0 || r.right > innerWidth || r.bottom > innerHeight }; });
        let gap = 1e9; for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) gap = Math.min(gap, Math.hypot(cs[i].x - cs[j].x, cs[i].y - cs[j].y) - (cs[i].d + cs[j].d) / 2);
        // the picture's middle and the button's rim are both the button
        const miss = cs.filter((c) => { const e = document.elementFromPoint(c.x, c.y); return !e || !e.closest('.st') || e.closest('.st').dataset.id !== c.id; }).map((c) => c.id);
        const out = cs.filter((c) => c.out).map((c) => c.id); if (out.length) miss.push('off-screen:' + out);
        return { n: cs.length, two: new Set(cs.map((c) => Math.round(c.y))).size > 1, gap: Math.round(gap), size: Math.round(cs[0].d), miss };
      });
      rows.push(r); if (r.gap < 10 || r.miss.length || r.size < 40) bad++;
      if (day === 5) await p.screenshot({ path: `${OUT}/t6-${w}.png` });
    }
    console.log(`${w}x${h}`, rows.map((r) => `${r.n}${r.two ? '(2 rows)' : ''} gap ${r.gap} size ${r.size}${r.miss.length ? ' MISS ' + r.miss : ''}`).join(' | '));
    await p.close();
  }
  await b.close();
  console.log(bad ? `${bad} problems` : 'all buttons spaced and tappable');
  process.exit(bad ? 1 : 0);
})();
