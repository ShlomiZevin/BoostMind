// every phone size (upright + a landscape) and the verse frame: start screen, the tutorial card, play with a talk,
// the end screen - no overflow, the main buttons on screen, the board the biggest thing. node t2-phones.js [url]
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(process.env.USERPROFILE, 'plaxzy-creator/node_modules/playwright-core'));
const URL = process.argv[2] || 'http://localhost:8771/night-guy-games/garden/?solo=1&notrack=1';
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (m) => { console.log('FAIL', m); process.exitCode = 1; };
const SIZES = [[320, 568], [360, 640], [390, 844], [412, 915], [844, 390], [1280, 800]];
(async () => {
  const br = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  for (const [w, h] of SIZES) {
    const touch = w < 900;
    const pg = await br.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch });
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.goto(URL); await sleep(1200);
    const tag = `${w}x${h}`;
    await pg.screenshot({ path: path.join(OUT, `p-${tag}-1start.png`) });
    if (w > h && touch) { console.log(tag, 'landscape - turn screen:', await pg.evaluate(() => document.body.classList.contains('turn'))); await pg.close(); continue; }
    const vis = await pg.evaluate(() => ['playBtn', 'howBtn'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; }));
    if (vis.includes(false)) fail(tag + ' start buttons off screen ' + vis);
    await pg.click('#howBtn', { force: true }); await sleep(500);
    await pg.screenshot({ path: path.join(OUT, `p-${tag}-2tut.png`) });
    const card = await pg.evaluate(() => { const r = document.getElementById('tutCard').getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; });
    if (!card) fail(tag + ' tutorial card off screen');
    await pg.click('#tutSkip', { force: true }); await sleep(3800);
    await pg.evaluate(() => { const s = window.GARDEN; s.clearForTest(); const p = s.player; s.girlForTest(p.c - 1, p.r - 3, 'dog'); });
    await sleep(400);
    await pg.screenshot({ path: path.join(OUT, `p-${tag}-3play.png`) });
    const m = await pg.evaluate(() => {
      const s = window.GARDEN, B = s.B, hud = document.getElementById('hud').getBoundingClientRect(), st = document.getElementById('strip').getBoundingClientRect();
      return { board: B.w * B.h / (innerWidth * innerHeight), boardTop: B.y, boardBottom: B.y + B.h, hudBottom: hud.bottom, hudRight: hud.right, hudLeft: hud.left, stripTop: st.top, stripBottom: st.bottom, W: innerWidth, H: innerHeight, sw: document.documentElement.scrollWidth };
    });
    console.log(tag, JSON.stringify({ board: m.board.toFixed(2), rows: await pg.evaluate(() => window.GARDEN.ROWS) }));
    if (m.hudBottom > m.boardTop + 2) fail(tag + ' HUD over the board');
    if (m.stripTop < m.boardBottom - 2) fail(tag + ' strip over the board');
    if (m.stripBottom > m.H || m.hudLeft < 0 || m.hudRight > m.W || m.sw > m.W) fail(tag + ' overflow');
    if (w < 900 && m.board < 0.7) fail(tag + ' board only ' + m.board.toFixed(2) + ' of the screen');
    if (errs.length) fail(tag + ' errors ' + errs.join(' | '));
    await pg.close();
  }
  // inside the verse frame: a short iframe (the frame on a small phone)
  const pg = await br.newPage({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await pg.setContent(`<body style="margin:0;background:#000"><iframe src="${URL}" style="border:0;width:320px;height:380px;margin-top:90px"></iframe></body>`);
  await sleep(1800);
  await pg.screenshot({ path: path.join(OUT, `p-frame-380.png`) });
  const fr = pg.frames()[1];
  const ok = await fr.evaluate(() => { const r = document.getElementById('playBtn').getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; });
  if (!ok) fail('frame 380: play button cut');
  console.log(process.exitCode ? 'DONE with failures' : 'ALL OK');
  await br.close();
})();
