// the live site: the games page + each game loads with no errors
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const u of ['', 'nisei-nissim/', 'ketoret/', 'gan-run/', 'shekel-tov/']) {
    const p = await (await b.newContext({ viewport: { width: 390, height: 690 } })).newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
    try { await p.goto('https://boostmind-b052c.web.app/hani-games/' + u + '?v=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 }); }
    catch (e) { errs.push('slow to load'); }
    await new Promise(r => setTimeout(r, 25000));
    const ready = u ? await p.evaluate(() => { const l = document.getElementById('loading'); return !l || getComputedStyle(l).display === 'none'; }) : true;
    const links = u ? '' : await p.evaluate(() => [...document.querySelectorAll('a')].map(a => a.getAttribute('href')).filter(h => /^[a-z-]+\/$/.test(h || '')).join(' '));
    console.log(u || 'hub', errs.length ? errs.join(' | ') : 'ok', ready ? '' : '(still loading)', links);
  }
  await b.close();
})();
