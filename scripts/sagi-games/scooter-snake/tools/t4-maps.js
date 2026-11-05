// every daily office, every row count: no trap tiles (a free tile with <2 free neighbours), one connected floor,
// the start lane free, and enough furniture. node t4-maps.js [url]
const path = require('path');
const { chromium } = require(path.join(process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
const URL = process.argv[2] || 'http://localhost:8766/sagi-games/scooter-snake/?solo=1&notrack=1';
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const pg = await br.newPage(); await pg.goto(URL); await new Promise((r) => setTimeout(r, 800));
  const res = await pg.evaluate(() => {
    const S = window.SNAKE, C = S.COLS, bad = []; let n = 0, minProps = 99;
    for (let d = 0; d < 60; d++) for (let rows = 13; rows <= 20; rows++) {
      const day = new Date(Date.UTC(2026, 10, 1 + d)).toISOString().slice(0, 10);
      const o = S.officeForTest(`scooter-snake|${day}|${rows}`, rows); n++; minProps = Math.min(minProps, o.props);
      const open = (c, r) => c >= 0 && r >= 0 && c < C && r < rows && !o.grid[r * C + c];
      let free = 0, first = -1;
      for (let r = 0; r < rows; r++) for (let c = 0; c < C; c++) if (open(c, r)) {
        free++; if (first < 0) first = r * C + c;
        const deg = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([x, y]) => open(c + x, r + y)).length;
        if (deg < 2) bad.push(`${day} rows ${rows}: trap at ${c},${r}`);
      }
      const seen = new Set([first]), q = [first];
      while (q.length) { const i = q.pop(), c = i % C, r = (i / C) | 0; for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (r + y) * C + c + x; if (open(c + x, r + y) && !seen.has(j)) { seen.add(j); q.push(j); } } }
      if (seen.size !== free) bad.push(`${day} rows ${rows}: floor in pieces`);
      for (let r = o.START.r - 6; r <= o.START.r; r++) if (!open(o.START.c, r)) bad.push(`${day} rows ${rows}: start lane blocked at row ${r}`);
    }
    return { n, minProps, bad: bad.slice(0, 10), badCount: bad.length };
  });
  console.log(`${res.n} offices, fewest pieces ${res.minProps}, problems ${res.badCount}`); res.bad.forEach((b) => console.log(' ', b));
  await br.close(); process.exitCode = res.badCount ? 1 : 0;
})();
