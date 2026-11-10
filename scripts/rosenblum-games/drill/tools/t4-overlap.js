// every level: things drawn on the same floor that sit on top of each other (doors, locked doors, desk piles, the
// shelter with Rosenblum, the classroom with its counter) - at the narrowest building (W=270, the worst case)
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await (await b.newContext({ viewport: { width: 320, height: 568 } })).newPage();
  await p.goto('http://localhost:8731/rosenblum-games/drill/?solo=1'); await p.waitForTimeout(800);
  const out = await p.evaluate(() => {
    const k = (270 - 16) / 344, X = (x) => 8 + (x - 8) * k, res = [];
    const side = (l) => { const near = l.reut ? [l.reut.from, l.reut.to].sort((a, b) => Math.abs(a - l.exit[1]) - Math.abs(b - l.exit[1]))[0] : null; return near !== null && Math.abs(near - l.exit[1]) < 90 && near < l.exit[1] ? 1 : -1; };
    DRILL.levels.forEach((l, i) => {
      const items = [['class', l.start[0], l.start[1], 50], ['shelter', l.exit[0], l.exit[1], 50], ['rosen', l.exit[0], l.exit[1] + (side(l) * 44), 30]];
      for (const [t, f, x] of l.zones || []) items.push([t, f, x, 46]);
      for (const [f, x] of l.locked || []) items.push(['locked', f, x, 40]);
      for (const [f, x] of l.barricade || []) items.push(['desks', f, x, 44]);
      if (l.reut) for (const x of [l.reut.from, l.reut.to]) items.push(['reutDoor', l.reut.f, x, 46]);
      for (let a = 0; a < items.length; a++) for (let c = a + 1; c < items.length; c++) {
        const A = items[a], B = items[c]; if (A[1] !== B[1] || (A[0] === 'shelter' && B[0] === 'rosen')) continue;
        const gap = Math.abs(X(A[2]) - X(B[2])), need = (A[3] + B[3]) / 2;
        if (gap < need) res.push('L' + (i + 1) + ' floor ' + A[1] + ': ' + A[0] + '@' + A[2] + ' / ' + B[0] + '@' + B[2] + ' (' + gap.toFixed(0) + ' < ' + need + ')');
      }
    });
    return res.join('\n') || 'no overlaps';
  });
  console.log(out); await b.close();
})();
