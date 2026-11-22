// balance: bots of a few skills play the week fast-forwarded in the page (10 runs each, varied seeds)
//   reach = how high up the field the bot reacts (0 = only near the top, late), miss = chance to miss a swipe,
//   misread = chance to get a WHITE message wrong (cut a bond / let a sneaky harm through)
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const BOTS = { slow: { reach: .25, miss: .3, misread: .35, cutGold: .1, collateral: .5 }, normal: { reach: .45, miss: .15, misread: .2, cutGold: .04, collateral: .3 }, sharp: { reach: .65, miss: .05, misread: .06, cutGold: 0, collateral: .1 } };
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await p.goto('http://localhost:5311/naomi-games/pause/'); await p.waitForTimeout(1500);
  // doing nothing must lose inside day 1 (his rule)
  const idle = await p.evaluate(() => { PAUSE.manual = true; PAUSE.start(); for (let i = 0; i < 60 * 80 && PAUSE.G.mode === 'play'; i++) PAUSE.tick(1 / 60); return PAUSE.state; });
  console.log('no hands', idle.won ? 'WON - BUG' : `lost at ${idle.t.toFixed(1)} s (day ${idle.day + 1})`, idle.day > 0 ? '<- TOO EASY' : 'ok');
  for (const [name, bot] of Object.entries(BOTS)) {
    const runs = await p.evaluate((bot) => {
      const out = [];
      for (let run = 0; run < 10; run++) {
        PAUSE.manual = true; PAUSE.start();
        let seed = run * 9973 + 1; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        const seen = new Set();
        for (let i = 0; i < 60 * 140 && PAUSE.G.mode === 'play'; i++) {
          PAUSE.tick(1 / 60);
          const L = PAUSE.L, zone = L.line + (L.stripT - L.line) * (1 - bot.reach);
          for (const c of PAUSE.G.cards) {
            if (c.state !== 'fly' || seen.has(c.id)) continue;
            if (c.type === 'gold') { seen.add(c.id); if (r() < bot.cutGold) PAUSE.slice(c.id); continue; }
            if (c.y > zone) continue;
            seen.add(c.id);
            if (r() < bot.miss) continue;
            let harmful = c.type === 'harm' || c.type === 'nu' || c.type === 'breath';
            if (c.white && r() < bot.misread) harmful = !harmful;
            if (c.sneaky && r() < bot.misread) harmful = false;
            if (harmful) {
              PAUSE.slice(c.id);
              // a thumb's swipe also clips a pink / gold card flying close by
              for (const o of PAUSE.G.cards) if (o.state === 'fly' && (o.type === 'bond' || o.type === 'gold') && Math.hypot(o.x - c.x, o.y - c.y) < 110 && r() < bot.collateral) PAUSE.slice(o.id);
            }
          }
        }
        const s = PAUSE.state; out.push({ won: s.won, t: Math.round(s.t), day: s.day, score: s.score, strikes: s.strikes });
      }
      return out;
    }, bot);
    const wins = runs.filter((x) => x.won).length, avg = (k) => Math.round(runs.reduce((a, x) => a + x[k], 0) / runs.length);
    console.log(name.padEnd(7), 'wins', wins + '/10', '| avg score', avg('score'), '| avg strikes', (runs.reduce((a, x) => a + x.strikes, 0) / 10).toFixed(1), '| lost on day', runs.filter((x) => !x.won).map((x) => x.day + 1).join(',') || '-');
  }
  await b.close();
})();
