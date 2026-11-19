const path = require('path');
const { chromium } = require(path.join(process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
(async () => { const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader'] });
  const pg = await br.newPage(); pg.on('response', (r) => { if (r.status() >= 400) console.log(r.status(), r.url()); });
  await pg.goto('http://localhost:8781/demokratovich-games/sixty-one/?solo=1&notrack=1'); await new Promise((r) => setTimeout(r, 4000)); await br.close(); })();
