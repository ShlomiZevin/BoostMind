// The personal greeting's frame AS APPROVED (his ask 2026-11-19 after the first cards came out too plain) (plan greeting-ideas, option 3 "cards" - img/frame-3.jpg): the big planet logo, the glowing planet
// horizon at the bottom, the orange rounded frame; during the take: the logo in the corner, the horizon along the bottom with the
// name card (two lines) sitting on it, the frame around; the end card "זו היתה ברכה אישית מתושב/ת שלומיוורס · כדי לבקש ברכה כזו:"
// + a glowing address. 1080x1920 PNG -> zoomcut/episodes/_assets/greetings/<slug>/ (open.png, name.png = transparent overlay, end.png)
const fs = require('fs'), path = require('path');
const puppeteer = require('c:/workspace/BoostMind/zoomcut/render/node_modules/puppeteer-core');
const ROOT = 'c:/workspace/BoostMind';
const LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'public/verse/logo-512.png')).toString('base64');
// the greetings to draw: every _assets/greetings/<slug>/greeting.json with a "card" part (private - real people's names never
// go into this public repo):  "card": { forWho: "לדנה", event, date: "1.1.2027", from: "חנה פרידמן", she: true, techy: true }
//   node scripts/greetings/cards.cjs [slug]      (no slug = all of them)
const GDIR = path.join(ROOT, 'zoomcut/episodes/_assets/greetings');
const G = fs.readdirSync(GDIR).filter((s) => !process.argv[2] || s === process.argv[2])
  .map((s) => { try { const j = JSON.parse(fs.readFileSync(path.join(GDIR, s, 'greeting.json'), 'utf8')); return j.card ? { slug: s, ...j.card } : null; } catch { return null; } })
  .filter(Boolean);
// a fixed star field (same on every card)
let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
const STARS = Array.from({ length: 140 }, () => `${Math.round(rnd() * 1080)}px ${Math.round(rnd() * 1500)}px 0 ${rnd() < .15 ? 1.6 : .8}px rgba(255,${200 + Math.round(rnd() * 55)},${170 + Math.round(rnd() * 80)},${(.25 + rnd() * .6).toFixed(2)})`).join(',');
const TT = (px, op = .85) => `<span class="tt" style="font-size:${px}px;opacity:${op}"><span class="m">&lt;/&gt;</span><b>Techy-Tech</b></span>`;
const CSS = `<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"><style>
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;font-family:Heebo;color:#fff}
.space{position:absolute;inset:0;background:radial-gradient(1000px 900px at 50% 30%,rgba(255,106,31,.20),transparent 70%),radial-gradient(1500px 1200px at 50% 45%,#1d130f,#0a0807 80%)}
.stars{position:absolute;left:0;top:0;width:1px;height:1px;border-radius:50%;box-shadow:${STARS}}
.frame{position:absolute;inset:16px;border-radius:56px;border:2.5px solid rgba(255,150,80,.75);box-shadow:0 0 22px rgba(255,120,40,.55),inset 0 0 26px rgba(255,120,40,.28);pointer-events:none}
.planet{position:absolute;left:50%;width:2900px;height:2900px;margin-left:-1450px;border-radius:50%;
  background:radial-gradient(circle at 50% 8%,#6b2e14 0,#3a180b 9%,#1a0b06 22%,#0b0604 40%);
  border-top:5px solid #ffb27a;box-shadow:0 -6px 40px 10px rgba(255,120,40,.85),0 0 110px 30px rgba(255,100,20,.45),inset 0 14px 26px rgba(255,200,130,.95),inset 0 60px 110px rgba(255,120,40,.45)}
.planet::after{content:'';position:absolute;inset:0;border-radius:50%;background:repeating-radial-gradient(circle at 46% 3%,rgba(255,140,70,.06) 0 6px,transparent 6px 22px);mix-blend-mode:screen;opacity:0}
.c{position:absolute;left:0;right:0;display:flex;flex-direction:column;align-items:center;text-align:center}
.logo{display:block;filter:drop-shadow(0 0 28px rgba(255,110,30,.65))}
.rule{width:620px;height:3px;background:linear-gradient(90deg,transparent,#ffb070,transparent);box-shadow:0 0 12px rgba(255,140,60,.7)}
.for{font:900 168px/1.05 Heebo;text-shadow:0 0 30px rgba(255,150,80,.35)}
.ev{font:800 104px/1.1 Heebo;background:linear-gradient(180deg,#ffd9b3,#ffa25c);-webkit-background-clip:text;color:transparent}
.dt{font:600 92px/1 Heebo;color:#fff3e6;direction:ltr}
.tt{display:inline-flex;align-items:center;gap:.4em;direction:ltr;color:#fff}.tt .m{color:#7fb2f5;font-weight:800;letter-spacing:-.08em}.tt b{font-weight:800}
.e1{font:800 84px/1.25 Heebo}.e1 em{font-style:normal;background:linear-gradient(180deg,#ffc58f,#ff7a2a);-webkit-background-clip:text;color:transparent}
.e2{font:600 66px/1 Heebo;color:#fff3e6}
.url{display:inline-flex;align-items:center;height:132px;padding:0 64px;border-radius:999px;border:3px solid #ff9a50;background:rgba(20,10,6,.72);box-shadow:0 0 34px rgba(255,120,40,.7),inset 0 0 18px rgba(255,140,60,.35);font:700 72px/1 Heebo;direction:ltr}
.streak{position:absolute;left:-200px;top:330px;width:1600px;height:3px;transform:rotate(-24deg);background:linear-gradient(90deg,transparent,rgba(255,170,100,.9) 55%,transparent);box-shadow:0 0 18px rgba(255,130,50,.8)}
.corner{position:absolute;top:70px;right:62px;width:250px;filter:drop-shadow(0 0 18px rgba(255,110,30,.7))}
.ttcorner{position:absolute;top:118px;left:76px}
.pill{position:absolute;left:50%;bottom:132px;transform:translateX(-50%);min-width:470px;padding:26px 56px 30px;border-radius:44px 44px 30px 30px;background:linear-gradient(180deg,rgba(40,24,18,.86),rgba(14,9,7,.92));border:2.5px solid rgba(255,160,90,.8);box-shadow:0 0 30px rgba(255,120,40,.55);text-align:center}
.pill .n{font:800 66px/1.15 Heebo;color:#fff}.pill .t{font:800 64px/1.15 Heebo;color:#ffb074}
</style>`;
const open = (g) => `<div class="space"><div class="stars"></div></div><div class="planet" style="top:1440px"></div>
  <div class="c" style="top:120px"><img class="logo" src="${LOGO}" style="width:640px"></div>
  <div class="c" style="top:760px"><div class="rule"></div><div class="for" style="margin:40px 0 34px">${g.forWho}</div><div class="rule"></div>
    <div class="ev" style="margin-top:44px">${g.event}</div><div class="dt" style="margin-top:30px">${g.date}</div></div>
  ${g.techy ? `<div class="c" style="top:1735px">${TT(46, .9)}</div>` : ''}<div class="frame"></div>`;
const end = (g) => `<div class="space"><div class="stars"></div></div><div class="streak"></div><div class="planet" style="top:1380px"></div>
  <div class="c" style="top:610px"><div class="e1">זו היתה ברכה אישית<br>${g.she ? 'מתושבת' : 'מתושב'} <em>שלומיוורס</em></div><div class="rule" style="margin:56px 0 60px"></div>
    <div class="e2">כדי לבקש ברכה כזו:</div><div class="url" style="margin-top:44px">shlomiverse.com</div></div>
  ${g.techy ? `<div class="c" style="top:1735px">${TT(46, .9)}</div>` : ''}<div class="frame"></div>`;
// during the take: transparent except the frame, the corner logo, the horizon along the bottom and the name card on it
const name = (g) => `<div class="planet" style="top:1770px"></div><img class="corner" src="${LOGO}">${g.techy ? `<div class="ttcorner">${TT(40, .9)}</div>` : ''}
  <div class="pill"><div class="n">${g.from}</div><div class="t">${g.forWho}</div></div><div class="frame"></div>`;
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage(); await p.setViewport({ width: 1080, height: 1920 });
  for (const g of G) {
    const dir = path.join(ROOT, 'zoomcut/episodes/_assets/greetings', g.slug); fs.mkdirSync(dir, { recursive: true });
    for (const [k, f, clear] of [['open', open, false], ['name', name, true], ['end', end, false]]) {
      await p.setContent(`<html dir="rtl"><head>${CSS}</head><body style="background:${clear ? 'transparent' : '#0a0807'}">${f(g)}</body></html>`, { waitUntil: 'load', timeout: 90000 });
      await p.evaluate(() => document.fonts.ready);
      await p.screenshot({ path: path.join(dir, `${k}.png`), omitBackground: clear });
    }
    console.log('made', g.slug);
  }
  await b.close();
})();
