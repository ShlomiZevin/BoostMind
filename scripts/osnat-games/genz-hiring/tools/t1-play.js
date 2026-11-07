// plays the tutorial with real taps, then a real game with a tapping bot (as a phone, by touch) -> ../shots/
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path'), OUT = path.join(__dirname, '..', 'shots');
const URL = process.argv[2] || 'http://localhost:5310/osnat-games/not-a-cog/?solo=1';
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(URL); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/t1-start.png` });
  const G = (f) => p.evaluate(f);
  const tapXY = (x, y) => p.touchscreen.tap(x, y);
  await p.click('#playBtn', { force: true }); await p.waitForTimeout(600);
  // the tutorial
  for (let i = 0; i < 12 && await G(() => NOTACOG.tut); i++) {
    const s = await G(() => NOTACOG.tutStep);
    await p.screenshot({ path: `${OUT}/t1-tut${s + 1}.png` });
    if (s === 3) { const c = await G(() => { const c = NOTACOG.cands[0]; return { x: c.x, y: c.y - 60 * NOTACOG.U }; }); await tapXY(c.x, c.y); await p.waitForTimeout(2600); }
    if (s === 5) { await p.locator('.st[data-id="matcha"]').tap(); await p.waitForTimeout(200); const d = await G(() => { const d = NOTACOG.desks[0]; return { x: d.x, y: d.y }; }); await tapXY(d.x, d.y); await p.waitForTimeout(3500); }
    if (s === 7) { const d = await G(() => { const d = NOTACOG.desks[0]; return { x: d.x, y: d.y }; }); await tapXY(d.x, d.y); await p.waitForTimeout(2500); }
    if (s === 8) { await p.locator('#laughBtn').tap(); await p.waitForTimeout(500); }
    const dis = await p.$eval('#tutNext', (e) => e.disabled);
    if (dis) { console.log('STUCK at step', s + 1); break; }
    await p.click('#tutNext', { force: true }); await p.waitForTimeout(400);
  }
  console.log('after tutorial:', await G(() => NOTACOG.state));
  // the bot: seat, read, fetch, deliver, hire - with taps
  const t0 = Date.now(); let shot = 0;
  while (Date.now() - t0 < 75000 && await G(() => NOTACOG.state) === 'play') {
    const s = await G(() => ({ q: NOTACOG.osnat.queue.length + (NOTACOG.osnat.task ? 1 : 0), hands: NOTACOG.osnat.hands.slice(), U: NOTACOG.U,
      lobby: NOTACOG.cands.filter((c) => c.st === 'lobby').map((c) => ({ x: c.x, y: c.y })),
      free: NOTACOG.desks.some((d) => !d.c),
      desks: NOTACOG.desks.map((d) => ({ x: d.x, y: d.y, st: d.c && d.c.st, need: d.c ? d.c.want.filter((w) => !d.c.got.includes(w)) : [] })) }));
    if (s.q === 0) {
      if (s.lobby.length && s.free) await tapXY(s.lobby[0].x, s.lobby[0].y - 60 * s.U);
      else {
        const r = s.desks.find((d) => d.st === 'ready');
        const w = s.desks.find((d) => d.st === 'want');
        if (r) await tapXY(r.x, r.y);
        else if (w) {
          const has = s.hands.filter((h) => w.need.includes(h));
          if (has.length) await tapXY(w.x, w.y);
          else { for (const n of w.need.slice(0, 2)) await p.locator(`.st[data-id="${n}"]`).tap(); }
        }
      }
    }
    if (++shot % 40 === 0) await p.screenshot({ path: `${OUT}/t1-play${shot / 40}.png` });
    await p.waitForTimeout(250);
  }
  console.log('bot:', await G(() => ({ state: NOTACOG.state, day: NOTACOG.day, hires: NOTACOG.hires, score: NOTACOG.score, ghosts: NOTACOG.ghosts })));
  await p.screenshot({ path: `${OUT}/t1-end.png` });
  // lose on purpose: stop playing until 3 ghosts
  if (await G(() => NOTACOG.state) === 'play') { await p.waitForTimeout(60000); }
  console.log('after idling:', await G(() => ({ state: NOTACOG.state, ghosts: NOTACOG.ghosts })));
  await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/t1-over.png` });
  const log = await G(() => NOTACOG.sndLog.slice());
  const heard = [...new Set(log)].sort();
  const repeats = log.filter((n, i) => i && /-\d$/.test(n) && n === log[i - 1]);
  console.log('sounds heard (' + heard.length + '):', heard.join(' '));
  const must = ['ping', 'pick', 'give', 'hire', 'laugh', 'ghost', 'seat', 'day', 'lose'].filter((k) => !heard.some((h) => h === k || h.startsWith(k + '-')));
  console.log(must.length ? 'SOUNDS NEVER PLAYED: ' + must.join(' ') : 'every main sound played', '| same variant twice in a row:', repeats.length);
  console.log(errs.length ? 'ERRORS: ' + errs.join(' / ') : 'no errors');
  await b.close();
})();
