// balance: bots of three skills (react time between actions) play fast-forward in the page -> how far each gets
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const URL = process.argv[2] || 'http://localhost:5310/osnat-games/not-a-cog/?solo=1';
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(URL); await p.waitForTimeout(1000);
  for (const [name, react, laugh] of [['slow', 1.4, false], ['normal', 0.8, true], ['sharp', 0.45, true]]) {
    const r = await p.evaluate(([react, laugh]) => {
      const N = NOTACOG; try { localStorage.setItem('shlomiverse:not-a-cog:tut', '1'); } catch (e) {}
      N.startGame(); let t = 0, next = 0; const log = [];
      while (t < 900 && (N.state === 'play')) {
        N.tick(1 / 30); t += 1 / 30;
        if (t < next) continue; next = t + react;
        const o = N.osnat; if (o.queue.length + (o.task ? 1 : 0) > 1) continue;
        const lob = N.cands.filter((c) => c.st === 'lobby' && !c.fetch), free = N.desks.filter((d) => !d.c && !d.res);
        const seated = N.desks.filter((d) => d.c && (d.c.st === 'want' || d.c.st === 'ready')).sort((a, b) => a.c.bat - b.c.bat);
        if (laugh && N.laughCool <= 0 && seated.filter((d) => d.c.bat < 0.25).length >= 2) document.getElementById('laughBtn').dispatchEvent(new PointerEvent('pointerdown'));
        const ready = seated.find((d) => d.c.st === 'ready');
        if (ready) { N.queueTask({ type: 'desk', desk: ready }); continue; }
        const want = seated.find((d) => d.c.st === 'want');
        if (want) {
          const need = want.c.want.filter((w) => !want.c.got.includes(w));
          const carry = o.hands.concat(o.queue.filter((q) => q.type === 'pick').map((q) => q.id)).concat(o.task && o.task.type === 'pick' ? [o.task.id] : []);
          const missing = need.filter((n) => !carry.includes(n));
          if (missing.length && carry.length < 2) { N.queueTask({ type: 'pick', id: missing[0] }); continue; }
          if (need.some((n) => carry.includes(n))) { N.queueTask({ type: 'desk', desk: want }); continue; }
          if (carry.length >= 2 && !o.task) { o.hands.length = 0; }   // a stuck bot drops what nobody wants (a player would deliver elsewhere)
        }
        if (lob.length && free.length) { N.seat(lob[0]); continue; }
      }
      return { t: Math.round(t), day: N.day, hires: N.hires, goal: N.goal, score: N.score, ghosts: N.ghosts, state: N.state };
    }, [react, laugh]);
    console.log(name.padEnd(7), JSON.stringify(r));
  }
  await b.close();
})();
