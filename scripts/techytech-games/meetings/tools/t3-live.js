// live check: open the game from its verse page as a phone, start a real Zoomba round, play a few moves
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' });
  await ctx.addInitScript(() => { try { localStorage.setItem('t-ignore', '1'); } catch (e) {} });  // tests never count in the stats (t.js notrack)
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('https://shlomiverse.com/play/techytech-games-meetings'); await p.waitForTimeout(6000);
  await p.screenshot({ path: __dirname + '/../shots/live-verse.png' });
  const fr = p.frames().find((f) => f.url().includes('/techytech-games/meetings/'));
  console.log('frame:', fr ? fr.url() : 'NONE');
  if (fr) {
    await fr.evaluate(() => localStorage.setItem('shlomiverse:meetings:tut-zoomba', '1'));
    await fr.click('.app[data-mode=zoomba]', { force: true }); await p.waitForTimeout(1200);
    for (const k of ['D', 'L', 'R', 'U', 'D', 'L']) { await fr.evaluate((k) => MEET.zb.move(k), k); await p.waitForTimeout(300); }
    console.log('state:', JSON.stringify(await fr.evaluate(() => ({ mode: MEET.G.mode, score: MEET.G.score, tiles: MEET.zb.tiles.length }))));
    await p.screenshot({ path: __dirname + '/../shots/live-play.png' });
  }
  console.log(errs.length ? 'ERR ' + errs.join(' | ') : 'no page errors'); await b.close();
})();
