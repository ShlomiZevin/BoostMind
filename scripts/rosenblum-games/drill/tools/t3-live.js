// the LIVE game inside the verse: Rosenblum's page lists it, #/play/<id> opens it, a level plays -> shots/live-*.png
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })).newPage();
  await p.goto('https://shlomiverse.com/c/rosenblum'); await p.waitForTimeout(5000);
  const onPage = await p.evaluate(() => document.body.innerText.includes('הקטר המאסף'));
  await p.screenshot({ path: __dirname + '/../shots/live-page.png' });
  await p.goto('https://shlomiverse.com/#/play/rosenblum-games-drill'); await p.waitForTimeout(6000);
  await p.screenshot({ path: __dirname + '/../shots/live-play.png' });
  const fr = p.frames().find((f) => f.url().includes('rosenblum-games/drill'));
  let st = null;
  if (fr) { st = await fr.evaluate(() => { DRILL.start(1); DRILL.tick(30); return DRILL.state; }).catch((e) => 'err ' + e.message); await p.waitForTimeout(500); await p.screenshot({ path: __dirname + '/../shots/live-game.png' }); }
  const solo = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await solo.goto('https://shlomiverse.com/rosenblum-games/drill/?solo=1'); await solo.waitForTimeout(3000);
  const ok = await solo.evaluate(() => { DRILL.start(0); DRILL.tick(120); return DRILL.state; });
  console.log('on page:', onPage, '| frame:', !!fr, JSON.stringify(st), '| solo L1:', ok.saved + '/' + ok.quota);
  await b.close();
})();
