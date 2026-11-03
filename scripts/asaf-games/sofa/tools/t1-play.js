// play test: the tutorial (real taps on Asaf, leaving the good news alone), then a real round played well, then
// played badly until it ends -> ../shots/.  python -m http.server 5302 (in BoostMind/public); node .../t1-play.js [BASE]
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path'), fs = require('fs');
const BASE = process.argv[2] || 'http://localhost:5302/asaf-games';
const OUT = path.join(__dirname, '..', 'shots'); fs.mkdirSync(OUT, { recursive: true });
const wait = (p, ms) => p.waitForTimeout(ms);
// tap every Asaf that is up (twice for the phone one), never the good news
async function bopAll(p) {
  const targets = await p.evaluate(() => SOFA.moles.filter((m) => m.kind !== 'good' && m.phase === 'up').map((m) => { const r = SOFA.moleRect(m); return { x: r.x + r.w / 2, y: r.y + r.h * 0.3, n: m.kind === 'phone' ? 2 : 1 }; }));
  for (const t of targets) for (let i = 0; i < t.n; i++) { await p.mouse.click(t.x, t.y); await wait(p, 40); }
  return targets.length;
}
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['wide', { width: 1280, height: 760 }]]) {
    const p = await (await b.newContext({ viewport: vp, deviceScaleFactor: 1 })).newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/t\.js|game-frame|404/.test(m.text())) errs.push(m.text()); });
    await p.goto(BASE + '/sofa/' + (BASE.startsWith('https') ? '?notrack=1' : '')); await wait(p, 1500);
    await p.screenshot({ path: `${OUT}/${name}-start.png` });
    await p.click('#playBtn', { force: true }); await wait(p, 700);
    for (let i = 0; i < 3; i++) { await p.screenshot({ path: `${OUT}/${name}-tut${i + 1}.png` }); await p.keyboard.press('Space'); await wait(p, 300); }
    // step 4: tap Asaf
    for (let i = 0; i < 40 && !(await bopAll(p)); i++) await wait(p, 150);
    await wait(p, 200); await p.screenshot({ path: `${OUT}/${name}-tut4-hit.png` });
    await p.keyboard.press('Space'); await wait(p, 300); await p.keyboard.press('Space'); await wait(p, 900);
    await p.screenshot({ path: `${OUT}/${name}-tut6-good.png` });
    await p.waitForFunction(() => !document.getElementById('tutNext').disabled, null, { timeout: 8000 }).catch(() => {});
    for (let i = 0; i < 3; i++) { await p.keyboard.press('Space'); await wait(p, 300); }
    const st = await p.evaluate(() => SOFA.state);
    // play well for 40 s
    const t0 = Date.now(); let shot = false;
    while (Date.now() - t0 < 40000 && (await p.evaluate(() => SOFA.state)) === 'play') { await bopAll(p); await wait(p, 120); if (!shot && Date.now() - t0 > 15000) { shot = true; await p.screenshot({ path: `${OUT}/${name}-play.png` }); } }
    const mid = await p.evaluate(() => ({ score: SOFA.score, hearts: SOFA.hearts, combo: SOFA.combo }));
    // then do nothing until he wins
    await p.waitForFunction(() => SOFA.state === 'over', null, { timeout: 30000 }).catch(() => {});
    await wait(p, 1800); await p.screenshot({ path: `${OUT}/${name}-over.png` });
    console.log(name, '| after tutorial:', st, '| after 40 s of good play:', JSON.stringify(mid), '| end:', await p.evaluate(() => SOFA.state), errs.length ? 'ERRORS ' + errs.join(' / ') : 'no errors');
  }
  await b.close();
})();
