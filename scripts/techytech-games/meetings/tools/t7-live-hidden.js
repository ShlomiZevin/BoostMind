// live (released 12 Nov 2026): the hub shows Callio + the three "אונליין" pills to everyone, no ?online=1 needed
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  for (const q of ['']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' });
    const p = await ctx.newPage(); await p.goto('https://shlomiverse.com/play/techytech-games-meetings' + q); await p.waitForTimeout(7000);
    const fr = p.frames().find((f) => f.url().includes('/techytech-games/meetings/'));
    console.log(q || '(plain)', fr ? JSON.stringify(await fr.evaluate(() => ({ callio: !document.getElementById('appCallio').hidden, onl: [...document.querySelectorAll('[data-onl]')].filter((e) => !e.hidden).length }))) : 'gate (signed out, no frame)');
    await ctx.close();
  }
  await b.close();
})();
