// the trailer's words as transparent 1080x1920 PNGs (Chrome lays out the Hebrew), in the GAME LOGO's own look (his note:
// "texts are too simple and ugly"): Rubik 900, a glossy gradient fill, a thick coloured outline, a white outer outline and a
// solid 3D edge under it; the gameplay labels = an incoming notification of that call app (its real icon); the last joke =
// a red stamp; Yaniv's words = clean subtitles.
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const path = require('path');
const A = 'C:/workspace/BoostMind-meetings/public/techytech-games/meetings/assets/';
const img = (f) => 'data:image/png;base64,' + require('fs').readFileSync(A + f).toString('base64');
// a word art line set like the game's title: fill gradient g, outline c, 3D edge d
function logo(html, { size, top, g, c, d, rot = 0 }) {
  const lay = (st) => `<span style="position:absolute;left:0;right:0;top:0;${st}">${html}</span>`;
  return `<div style="position:absolute;left:0;right:0;top:${top}px;text-align:center;transform:rotate(${rot}deg)">
  <div style="position:relative;display:inline-block;font:900 ${size}px/1.08 Rubik;white-space:nowrap">
    ${lay(`-webkit-text-stroke:${size * 0.26}px #fff;color:#fff;filter:drop-shadow(0 ${size * 0.09}px 0 ${d}) drop-shadow(0 18px 30px rgba(0,0,0,.55))`)}
    ${lay(`-webkit-text-stroke:${size * 0.14}px ${c};color:${c}`)}
    <span style="position:relative;background:${g};-webkit-background-clip:text;background-clip:text;color:transparent">${html}</span>
  </div></div>`;
}
const BLUE = { g: 'linear-gradient(180deg,#ffffff 0%,#e3f0ff 48%,#a9cfff 52%,#d8ebff 100%)', c: '#1f4fd8', d: '#0d2a80' };
const GOLD = { g: 'linear-gradient(180deg,#fff7b0 0%,#ffd23f 48%,#ffa51f 52%,#ffcf4a 100%)', c: '#7a2fd0', d: '#3d1170' };
const GREEN = { g: 'linear-gradient(180deg,#f4ffe0 0%,#b9f55a 48%,#5fd43a 52%,#a6ee61 100%)', c: '#0f7a3a', d: '#064020' };
// an incoming call-app notification: the app's icon, its name in its colour, the line
const toast = (icon, name, col, line, top = '') => `<div style="position:absolute;left:0;right:0;top:70px;display:flex;justify-content:center">
  <div style="display:flex;align-items:center;gap:26px;background:rgba(255,255,255,.96);border-radius:46px;padding:22px 40px 22px 30px;
    box-shadow:0 18px 50px rgba(0,0,0,.45),inset 0 -6px 0 rgba(0,0,0,.08);border:4px solid ${col}">
    <img src="${img(icon)}" style="width:146px;height:146px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.3))">
    <div style="text-align:right">${top ? `<div style="font:800 40px/1.1 Rubik;color:#6b6b80;margin-bottom:4px">${top}</div>` : ''}<div style="font:900 68px/1.05 Rubik;color:${col}">${name}</div>
      <div style="font:800 60px/1.15 Rubik;color:#1b1b2e;margin-top:6px">${line}</div></div></div></div>`;
const sub = (t) => `<div style="position:absolute;left:40px;right:40px;top:1560px;text-align:center;font:900 76px/1.2 Rubik;color:#fff;
  -webkit-text-stroke:10px #000;paint-order:stroke fill;text-shadow:0 8px 18px rgba(0,0,0,.8)">${t}</div>`;
const T = {
  present: logo('טקי-טק מציגה', { size: 90, top: 560, ...BLUE }) + logo('משחק אונליין', { size: 150, top: 720, rot: -3, ...GOLD }) + logo('חדש', { size: 150, top: 900, rot: -3, ...GOLD }) +
    `<div style="position:absolute;left:0;right:0;top:1170px;display:flex;justify-content:center;gap:34px">${['zoomba','meetly','teamz','callio'].map((a) => `<img src="${img('app-' + a + '.png')}" style="width:170px;height:170px;filter:drop-shadow(0 12px 18px rgba(0,0,0,.5))">`).join('')}</div>`,
  alone: logo('בטקי-טק יש דבר אחד', { size: 96, top: 760, ...BLUE }) + logo('שלא נגמר.', { size: 150, top: 900, ...BLUE }),
  online: logo('פגישות', { size: 200, top: 520, rot: -4, ...GOLD }) + logo('בזום.', { size: 240, top: 750, rot: -4, ...GOLD }),
  four: logo('אז הפכנו אותן', { size: 96, top: 1150, ...BLUE }) + logo('ל־4 משחקים.', { size: 130, top: 1290, ...BLUE }),
  l0: toast('app-zoomba.png', 'Zoomba', '#2f6bff', 'ממזגים עד החלטה.', 'משחק 1 מתוך 4'),
  l1: toast('app-meetly.png', 'Meetly', '#16a34a', 'מי הרים יד?', 'משחק 2 מתוך 4'),
  l2: toast('app-teamz.png', 'Teamz', '#7c3aed', 'מיישרים קו עם כולם.', 'משחק 3 מתוך 4'),
  l3: toast('app-callio.png', 'Callio', '#f05a28', 'זיכרון מול חבר.', 'משחק 4 מתוך 4'),
  l4: toast('app-meetly.png', 'משחקים מול חבר', '#fc7211', 'מזמינים עם קוד.'),
  team: logo('תזמינו את', { size: 90, top: 1260, ...BLUE }) + logo('כל הצוות לשיחה.', { size: 112, top: 1390, ...BLUE }),
  invite: logo('תזמינו חבר.', { size: 160, top: 1250, rot: -3, ...GREEN }),
  noyaniv: `<div style="position:absolute;left:0;right:0;top:1560px;display:flex;justify-content:center"><div style="transform:rotate(-7deg);
    font:900 78px/1 Rubik;color:#e0202f;border:10px solid #e0202f;border-radius:22px;padding:18px 40px;background:rgba(255,245,245,.92);
    box-shadow:0 14px 34px rgba(0,0,0,.45);letter-spacing:1px">רק לא את יניב.</div></div>`,
  ysub: sub('למה אתה מעלה אותי לשיחה?'),
};
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  for (const [k, h] of Object.entries(T)) {
    await p.setContent(`<html dir="rtl"><head><link href="https://fonts.googleapis.com/css2?family=Rubik:wght@800;900&display=swap" rel="stylesheet"><style>html,body{margin:0;background:transparent}</style></head><body>${h}</body></html>`);
    await p.evaluate(() => document.fonts.ready); await p.evaluate(() => Promise.all([...document.images].map((i) => i.complete || new Promise((r) => { i.onload = i.onerror = r; }))));
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(__dirname, 't', k + '.png'), omitBackground: true });
  }
  await b.close();
})();
