// whack: wait for a Haredi to pop up, tap him, screenshot Zvi's swing -> shots/w-<vp>-<n>.png
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path'), OUT = path.join(__dirname, '..', 'shots');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader'] });
  for (const [name, vp] of [['phone', { width: 390, height: 760 }], ['wide', { width: 1280, height: 760 }]]) {
    const p = await (await b.newContext({ viewport: vp })).newPage(), errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:5301/yosef/?notrack=1'); await p.waitForTimeout(1500);
    await p.click('#goBtn'); await p.waitForTimeout(400); for (let i = 0; i < 5; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(150); }
    await p.evaluate(() => window.__game.open(1)); await p.waitForTimeout(400); await p.click('#gMsg .big');
    const box = await p.locator('#gc').boundingBox();
    for (let n = 0; n < 2; n++) {
      let t = null; for (let k = 0; k < 40 && !t; k++) { await p.waitForTimeout(60); t = await p.evaluate(() => { const s = window.__game.G.slots.find((q) => q.who && !q.who.hit && q.who.u > .9); return s && { x: s.x, y: s.y, w: s.w }; }); }
      const W = await p.evaluate(() => document.getElementById('gc').width), sc = box.width / (box.width > box.height ? 600 : 400);
      await p.mouse.click(box.x + t.x * sc, box.y + (t.y - t.w * .7) * sc * (box.width > box.height ? box.height / 400 / sc : 1));
      await p.waitForTimeout(170); await p.screenshot({ path: `${OUT}/w-${name}-${n}.png` }); await p.waitForTimeout(500);
    }
    console.log(name, errs.length ? errs.join(' | ') : 'no errors');
  }
  await b.close();
})();
