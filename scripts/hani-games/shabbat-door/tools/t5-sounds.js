// every sound the game asks for exists and decodes; logs which sounds fire during a real round
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const BASE = process.env.BASE || 'http://localhost:5302/hani-games';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { localStorage.setItem('t-ignore', '1'); localStorage.setItem('hani-games:shabbat-door:tut', '1'); });
  const p = await ctx.newPage(); const bad = []; p.on('response', (r) => { if (r.url().includes('/snd/') && r.status() >= 400) bad.push(r.url()); });
  await p.goto(BASE + '/shabbat-door/?solo=1'); await sleep(800);
  await p.click('#playBtn', { force: true }); await sleep(3000);
  // count what plays: wrap the AudioBufferSourceNode start
  await p.evaluate(() => { window.__played = {}; const st = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...a) { const n = this.buffer && this.buffer.duration.toFixed(2); window.__played[n] = (window.__played[n] || 0) + 1; return st.apply(this, a); }; });
  const res = await p.evaluate(() => { const G = SHABBAT_DOOR; let k = 0, hold = true; while (G.si < 2 && k++ < 60 * 120) { hold = k < 400 ? true : (G.green && G.timeLeft > 0.4); G.hold(hold); G.tick(1 / 60); } return { si: G.si, mistakes: G.mistakes }; });
  const dec = await p.evaluate(() => Object.keys(window.__played).length);
  console.log('round', res, 'distinct sounds played:', dec, 'missing files:', bad.length ? bad : 'none');
  await b.close();
})();
