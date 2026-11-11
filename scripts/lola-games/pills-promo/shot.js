// story.html -> drill-story.jpg (1080x1920)
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const { pathToFileURL } = require('url');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto(pathToFileURL(__dirname + '/story.html').href); await p.waitForTimeout(1500);
  await p.screenshot({ path: __dirname + '/out/pills-story.jpg', type: 'jpeg', quality: 92 });
  await b.close();
})();
