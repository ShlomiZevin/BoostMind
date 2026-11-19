const path = require('path');
const { chromium } = require(path.join(process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await pg.route('**/*.glb', async (r) => { await new Promise((x) => setTimeout(x, 6000)); r.continue(); });   // slow models: see the bar
  await pg.goto('http://localhost:8781/demokratovich-games/sixty-one/?solo=1&notrack=1'); await new Promise((x) => setTimeout(x, 3500));
  await pg.screenshot({ path: path.join(__dirname, 'shots', 'loading.png') });
  await br.close();
})();
