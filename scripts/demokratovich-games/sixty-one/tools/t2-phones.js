// every phone size + landscape + desktop + the verse frame (html.in-verse): start, tutorial card, play, end - nothing off
// screen, buttons >= 44px, no overflow. node t2-phones.js [url]
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
const URL = process.argv[2] || 'http://localhost:8781/demokratovich-games/sixty-one/?solo=1&notrack=1';
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (m) => { console.log('FAIL', m); process.exitCode = 1; };
const SIZES = [[320, 568], [360, 640], [390, 844], [412, 915], [844, 390], [1280, 800], [320, 380, 'verse']];
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [w, h, verse] of SIZES) {
    const touch = w < 900;
    const pg = await br.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch }); pg.setDefaultTimeout(120000);
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    
    await pg.goto(URL); if (verse) await pg.evaluate(() => document.documentElement.classList.add('in-verse')); await pg.waitForFunction(() => window.SIXTYONE && SIXTYONE.rabbi, null, { timeout: 60000 }).catch(() => fail('no rabbi'));
    await sleep(600);
    const tag = `${w}x${h}${verse ? '-verse' : ''}`;
    await pg.screenshot({ path: path.join(OUT, `p-${tag}-1start.png`) });
    if (w > h && touch) { const t = await pg.evaluate(() => document.body.classList.contains('turn')); console.log(tag, 'turn screen', t); if (!t) fail(tag + ' no turn screen'); await pg.close(); continue; }
    const chk = await pg.evaluate(() => [...document.querySelectorAll('#start .sign, #start .rec')].map((el) => { const r = el.getBoundingClientRect(); return { c: el.className, ok: r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1, h: Math.round(r.height) }; }));
    for (const c of chk) { if (!c.ok) fail(`${tag} off screen: ${c.c}`); if (c.h < 44 && !/rec/.test(c.c)) fail(`${tag} small button ${c.c} ${c.h}`); }
    await pg.click('#howBtn', { force: true }); await sleep(500);
    for (let i = 0; i < 14; i++) {
      const s = await pg.evaluate(() => ({ on: SIXTYONE.tut, tr: SIXTYONE.tutTry, step: SIXTYONE.tutStep }));
      if (!s.on) break;
      const card = await pg.evaluate(() => { const r = document.getElementById('tutCard').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1; });
      if (!card) fail(`${tag} tutorial card off screen at step ${s.step}`);
      if ([0, 3, 6].includes(s.step)) await pg.screenshot({ path: path.join(OUT, `p-${tag}-2tut${s.step}.png`) });
      if (s.tr) { if (s.tr === 'veto') await pg.evaluate(() => SIXTYONE.veto()); else await pg.evaluate(() => SIXTYONE.bot(0.3)); await sleep(700); }
      await pg.click('#tutNext', { force: true }); await sleep(250);
    }
    await sleep(800);
    for (let n = 0; n < 12; n++) { await pg.evaluate(() => SIXTYONE.bot(0.08)); await sleep(60); }
    await sleep(500);
    await pg.screenshot({ path: path.join(OUT, `p-${tag}-3play.png`) });
    const m = await pg.evaluate(() => { const hud = document.getElementById('hud').getBoundingClientRect(); return { hudR: hud.right, hudL: hud.left, sw: document.documentElement.scrollWidth, W: innerWidth }; });
    if (m.hudL < 0 || m.hudR > m.W || m.sw > m.W) fail(tag + ' overflow');
    await pg.evaluate(() => SIXTYONE.missDrop()); await sleep(2600);
    await pg.screenshot({ path: path.join(OUT, `p-${tag}-4over.png`) });
    const ov = await pg.evaluate(() => [...document.querySelectorAll('#over .sign')].map((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1; }));
    if (ov.includes(false)) fail(tag + ' end screen buttons off screen ' + ov);
    if (errs.length) fail(tag + ' errors ' + errs.join(' | '));
    console.log(tag, 'ok');
    await pg.close();
  }
  await br.close();
})();
