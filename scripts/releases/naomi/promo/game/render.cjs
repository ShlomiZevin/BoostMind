// node render.cjs <in.html> <out.jpg> <path to puppeteer-core>  - 1080x1920 poster, words set in HTML
const puppeteer = require(process.argv[4]);
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1080, height: 1920 });
  await p.goto('file:///' + process.argv[2]);
  await p.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 400));
  await p.screenshot({ path: process.argv[3], type: 'jpeg', quality: 90 });
  await b.close();
})();
