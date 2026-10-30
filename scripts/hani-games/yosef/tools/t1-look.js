// look test: start, tutorial, every page, every game's start screen + a second in -> shots/
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, '..', 'shots'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  for (const [name, vp] of [['phone', { width: 390, height: 760 }], ['wide', { width: 1280, height: 760 }]]) {
    const p = await (await b.newContext({ viewport: vp, deviceScaleFactor: 1 })).newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto('http://localhost:5301/yosef/?notrack=1'); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/${name}-start.png` });
    await p.click('#goBtn'); await p.waitForTimeout(600);
    await p.screenshot({ path: `${OUT}/${name}-tut1.png` });
    for (let i = 0; i < 5; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(250); }
    await p.screenshot({ path: `${OUT}/${name}-p01.png` });
    await p.click('#nextBtn'); await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/${name}-p02.png` });
    const story = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'story.json'), 'utf8')), GI = story.pages.map((q, k) => q.game && q.game !== 'end' ? k : -1).filter((k) => k >= 0);
    if (name === 'phone') for (const i of GI) {
      await p.evaluate((k) => window.__game.open(k), i); await p.waitForTimeout(400);
      await p.screenshot({ path: `${OUT}/g${i + 1}-how.png` });
      await p.click('#gMsg .big'); await p.waitForTimeout(1600);
      await p.mouse.click(200, 400);
      await p.screenshot({ path: `${OUT}/g${i + 1}-play.png` });
      await p.click('#gClose');
    }
    console.log(name, errs.length ? errs.join(' | ') : 'no errors');
  }
  await b.close();
})();
