// every inside screen at two phone sizes: the tutorial card, pause, the night card, game over; the record badge
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
const URL = process.argv[2] || 'http://localhost:8771/night-guy-games/garden/?solo=1&notrack=1';
const OUT = process.env.SHOTS || path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (m) => { console.log('FAIL', m); process.exitCode = 1; };
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  for (const [w, h] of [[320, 568], [390, 844]]) {
    const pg = await br.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await pg.addInitScript(() => { localStorage.setItem('shlomiverse:garden:best', '1353'); localStorage.setItem('shlomiverse:garden:day', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }) + '|1353'); });
    await pg.goto(URL); await sleep(1300);
    const shot = async (n) => { await pg.screenshot({ path: path.join(OUT, `s-${w}-${n}.png`) }); };
    const onScreen = async (sel) => pg.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent).every((e) => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; }), sel);
    await shot('1start');
    const rec = await pg.evaluate(() => { const s = document.querySelector('.rec span'); return s.scrollWidth <= s.clientWidth + 1 && s.scrollHeight <= s.clientHeight + 1; });
    if (!rec) fail(w + ' record words overflow the badge');
    await pg.click('#howBtn', { force: true }); await sleep(600); await shot('2tut');
    if (!(await onScreen('#tutCard'))) fail(w + ' tutorial card off screen');
    await pg.click('#tutSkip', { force: true }); await sleep(5200);
    await pg.click('#pauseBtn', { force: true }); await sleep(400); await shot('3pause');
    if (!(await onScreen('#paused .panel'))) fail(w + ' pause panel off screen');
    await pg.click('#resumeBtn', { force: true }); await sleep(300);
    // the night card: fake a won night
    await pg.evaluate(() => { document.getElementById('nightDid').textContent = 'השתלטתם על 31% · 2 שיחות'; document.getElementById('nightBig').textContent = 'לילה 2'; document.getElementById('nightGoal').innerHTML = 'גן השעשועים<br>יעד: 40% מהגינה<br><small style="color:#15803d">סיפור חדש!</small>'; document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === 'night')); });
    await sleep(300); await shot('4night');
    if (!(await onScreen('#night .panel'))) fail(w + ' night panel off screen');
    // game over: 3 catches
    await pg.evaluate(() => document.querySelectorAll('.screen').forEach((s) => s.classList.remove('on')));
    for (let i = 0; i < 3; i++) { await pg.evaluate(() => { const s = window.GARDEN; s.clearForTest(); }); await pg.evaluate(() => { const s = window.GARDEN, z = s.zone; }); }
    await pg.evaluate(() => { const s = window.GARDEN; for (let k = 0; k < 3; k++) { s.policeForTest(s.player.c, s.player.r - 1); } });
    await pg.evaluate(() => { const s = window.GARDEN; s.want(s.DIRS.up); for (let i = 0; i < 3; i++) { s.tick(1 / 60, 20); } });
    // simpler: walk into her circle three times via the hook path is long - force game over through lives
    await pg.evaluate(() => { const s = window.GARDEN; let n = 0; while (s.state === 'play' && n++ < 20000) { s.want([s.DIRS.up, s.DIRS.left, s.DIRS.right][n % 3]); s.tick(1 / 30); } });
    await sleep(2000); await shot('5over');
    if ((await pg.evaluate(() => window.GARDEN.state)) === 'over' && !(await onScreen('#over .panel'))) fail(w + ' over panel off screen');
    await pg.close();
  }
  console.log(process.exitCode ? 'DONE with failures' : 'ALL OK');
  await br.close();
})();
