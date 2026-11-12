// the funny poster for the trailer post / story (1080x1920): the game title, the call grid of the Techy-Tech team, the big
// "תזמינו חבר.", and Yaniv's tile alone below it, angry, with the red stamp "רק לא את יניב." - all the game's own art.
const { chromium } = require(process.env.HOME + '/plaxzy-creator/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const A = 'C:/workspace/BoostMind-meetings/public/techytech-games/meetings/assets/';
const img = (f) => `data:image/${f.endsWith('.png') ? 'png' : f.endsWith('.jpg') ? 'jpeg' : 'webp'};base64,` + fs.readFileSync(A + f).toString('base64');
function logo(html, { size, g, c, d, rot = 0 }) {
  const lay = (st) => `<span style="position:absolute;left:0;right:0;top:0;${st}">${html}</span>`;
  return `<div style="text-align:center;transform:rotate(${rot}deg)"><div style="position:relative;display:inline-block;font:900 ${size}px/1.08 Rubik;white-space:nowrap">
    ${lay(`-webkit-text-stroke:${size * 0.26}px #fff;color:#fff;filter:drop-shadow(0 ${size * 0.09}px 0 ${d}) drop-shadow(0 18px 30px rgba(0,0,0,.55))`)}
    ${lay(`-webkit-text-stroke:${size * 0.14}px ${c};color:${c}`)}
    <span style="position:relative;background:${g};-webkit-background-clip:text;background-clip:text;color:transparent">${html}</span></div></div>`;
}
const GREEN = { g: 'linear-gradient(180deg,#f4ffe0 0%,#b9f55a 48%,#5fd43a 52%,#a6ee61 100%)', c: '#0f7a3a', d: '#064020' };
const tile = (f, name, extra = '') => `<div style="position:relative;border-radius:26px;overflow:hidden;border:6px solid #fff;box-shadow:0 12px 26px rgba(0,0,0,.45);${extra}">
  <img src="${img(f)}" style="display:block;width:100%;aspect-ratio:1;object-fit:cover">
  ${name ? `<div style="position:absolute;right:10px;bottom:10px;background:rgba(10,14,30,.75);color:#fff;font:800 30px Rubik;padding:4px 14px;border-radius:12px">${name}</div>` : ""}</div>`;
const team = [['amir.webp', 'אמיר'], ['ofer.webp', 'עופר'], ['ronit.webp', 'רונית'], ['gilad.webp', 'גלעד'], ['daniel.webp', 'דניאל'], ['itay.webp', 'איתי']];
const html = `<html dir="rtl"><head><link href="https://fonts.googleapis.com/css2?family=Rubik:wght@800;900&display=swap" rel="stylesheet">
<style>html,body{margin:0;width:1080px;height:1920px;overflow:hidden;font-family:Rubik;background:#141018}
.bg{position:absolute;left:0;top:0;width:1080px;height:1920px;background:url(${img("hero.jpg")}) center/cover;filter:blur(26px) brightness(.38)}</style></head><body>
<div class="bg"></div>
<img src="${img('title.png')}" style="position:absolute;left:190px;top:70px;width:700px;filter:drop-shadow(0 14px 24px rgba(0,0,0,.5))">
<div style="position:absolute;left:90px;right:90px;top:520px;display:grid;grid-template-columns:repeat(3,1fr);gap:22px">${team.map(([f, n]) => tile(f, n)).join('')}</div>
<div style="position:absolute;left:0;right:0;top:1150px">${logo('תזמינו חבר.', { size: 150, rot: -3, ...GREEN })}</div>
<div style="position:absolute;left:330px;top:1390px;width:420px">${tile('yaniv.webp', '', 'filter:grayscale(.35)')}
  <div style="position:absolute;left:-60px;right:-60px;top:270px;display:flex;justify-content:center"><div style="transform:rotate(-9deg);font:900 74px/1 Rubik;color:#e0202f;
    border:10px solid #e0202f;border-radius:22px;padding:16px 34px;background:rgba(255,245,245,.94);box-shadow:0 14px 34px rgba(0,0,0,.5);white-space:nowrap">רק לא את יניב.</div></div></div>
<div style="position:absolute;left:0;right:0;bottom:46px;text-align:center;font:800 40px Rubik;color:#fdf6ef;text-shadow:0 4px 12px rgba(0,0,0,.7)">4 משחקי פגישות · אונליין מול חבר · <span style="color:#fc7211">שלומיוורס</span></div>
</body></html>`;
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.setContent(html); await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => Promise.all([...document.images].map((i) => i.complete || new Promise((r) => { i.onload = i.onerror = r; }))));
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(__dirname, 'poster', 'meetings-poster.jpg'), type: 'jpeg', quality: 92 });
  await b.close();
})();
