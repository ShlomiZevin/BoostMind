// A greeting's link preview (what WhatsApp / Facebook / X show when /greeting/<id> is shared) - his pick 2026-11-19: round-1 option 3
// (the general space look that fits any occasion, not a love theme) with the OCCASION getting the most room: "למאיה" + "שנתיים ביחד"
// big, the resident's picture + name ("ברכה אישית"), a play mark, the Shlomiverse only a small signature.
// 1200x630 JPEG. Used by greet.cjs (add, og <id>); served by techietech-api/page.js as /greeting/<id>/og.jpg.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'public/verse/logo-512.png')).toString('base64');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let seed = 11; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
const STARS = Array.from({ length: 110 }, () => `${Math.round(rnd() * 1200)}px ${Math.round(rnd() * 630)}px 0 ${rnd() < .15 ? 1.4 : .7}px rgba(255,${200 + Math.round(rnd() * 55)},${170 + Math.round(rnd() * 80)},${(.25 + rnd() * .6).toFixed(2)})`).join(',');

function html(g, face, base) {
  const forWho = 'ל' + String(g.forWho || '');   // the record keeps the bare name ("ליאור" -> "לליאור")
  return `<html dir="rtl"><head><link href="https://fonts.googleapis.com/css2?family=Heebo:wght@500;700;800;900&display=swap" rel="stylesheet"><style>
html,body{margin:0;width:1200px;height:630px;overflow:hidden;font-family:Heebo;color:#fff;background:#0a0807}
.space{position:absolute;inset:0;background:radial-gradient(700px 520px at 30% 45%,rgba(255,106,31,.28),transparent 70%),radial-gradient(1300px 900px at 50% 40%,#1e130e,#0a0807 80%)}
.stars{position:absolute;left:0;top:0;width:1px;height:1px;border-radius:50%;box-shadow:${STARS}}
.planet{position:absolute;left:-300px;top:520px;width:1800px;height:1800px;border-radius:50%;background:radial-gradient(circle at 50% 6%,#6b2e14 0,#3a180b 9%,#1a0b06 22%,#0b0604 40%);
  border-top:4px solid #ffb27a;box-shadow:0 -5px 34px 8px rgba(255,120,40,.85),0 0 90px 24px rgba(255,100,20,.4),inset 0 12px 22px rgba(255,200,130,.9)}
.frame{position:absolute;inset:10px;border-radius:34px;border:2px solid rgba(255,150,80,.75);box-shadow:0 0 18px rgba(255,120,40,.5),inset 0 0 20px rgba(255,120,40,.25)}
.face{position:absolute;left:71px;top:40px;width:330px;height:350px;border-radius:30px;overflow:hidden;border:3px solid #ff9a50;box-shadow:0 0 34px rgba(255,120,40,.55)}
.face img{width:100%;height:100%;object-fit:cover;object-position:50% 16%}
.who{position:absolute;left:86px;top:340px;width:300px;padding:11px 16px 13px;border-radius:22px;background:linear-gradient(180deg,rgba(40,24,18,.92),rgba(14,9,7,.95));border:2px solid rgba(255,160,90,.8);text-align:center;box-shadow:0 0 22px rgba(255,120,40,.45)}
.who b{display:block;font:800 32px/1.1 Heebo}.who small{display:block;margin-top:3px;font:700 22px/1 Heebo;color:#ffb074}
/* "לצפייה בברכה" always shows, under the resident (his note 2026-11-19) */
.watch{position:absolute;left:86px;top:452px;width:300px;height:66px;display:flex;align-items:center;justify-content:center;gap:14px;border-radius:999px;background:linear-gradient(180deg,#ff8a3d,#ff6a1f);box-shadow:0 0 26px rgba(255,106,31,.7);font:800 30px/1 Heebo;color:#fff}
.watch i{width:40px;height:40px;border-radius:50%;background:#fff;display:grid;place-items:center}.watch i::before{content:'';margin-left:4px;border-style:solid;border-width:9px 0 9px 15px;border-color:transparent transparent transparent #ff6a1f}
.txt{position:absolute;right:56px;top:52px;width:650px;text-align:right}
.got{font:700 34px/1 Heebo;color:rgba(255,255,255,.82);letter-spacing:.5px}
.for{font:900 var(--f,150px)/1.02 Heebo;margin-top:22px;white-space:nowrap;text-shadow:0 0 30px rgba(255,150,80,.35)}
.ev{font:800 var(--e,86px)/1.1 Heebo;margin-top:10px;white-space:nowrap;background:linear-gradient(180deg,#ffd9b3,#ff8f3d);-webkit-background-clip:text;color:transparent}
.play{display:inline-flex;align-items:center;gap:14px;margin-top:30px;height:74px;padding:0 30px 0 22px;border-radius:999px;background:rgba(255,106,31,.16);border:2px solid rgba(255,154,80,.85);font:800 32px/1 Heebo}
.play i{width:46px;height:46px;border-radius:50%;background:#ff6a1f;display:grid;place-items:center;box-shadow:0 0 18px rgba(255,106,31,.7)}
.play i::before{content:'';margin-left:5px;border-style:solid;border-width:11px 0 11px 18px;border-color:transparent transparent transparent #fff}
.logo{position:absolute;right:46px;bottom:34px;width:150px;filter:drop-shadow(0 0 14px rgba(255,110,30,.6))}
/* base = the card that carries the sender's own words (drawn later by the server, page.js drawCard, into the empty band):
   same size, same look - a branded header line, the play mark moves onto the picture, the words get the band under a thin rule */
.base .got{display:flex;align-items:center;justify-content:flex-start;gap:14px}.base .got img{width:92px;filter:drop-shadow(0 0 10px rgba(255,110,30,.6))}
.base .for{margin-top:14px}.base .rule{margin-top:26px;height:2px;background:linear-gradient(270deg,#ffb070,rgba(255,176,112,0));box-shadow:0 0 10px rgba(255,140,60,.6)}
</style></head><body><div class="space"><div class="stars"></div></div><div class="planet"></div>
<div class="face"><img src="${face}"></div><div class="who"><b>${esc(g.charName)}</b><small>ברכה אישית</small></div><div class="watch"><i></i>לצפייה בברכה</div>
${base ? `<div class="txt base"><div class="got"><img src="${LOGO}">קיבלת ברכה מהשלומיוורס</div><div class="for" id="for">${esc(forWho)}</div>${g.event ? `<div class="ev" id="ev">${esc(g.event)}</div>` : ''}<div class="rule"></div></div>`
  : `<div class="txt"><div class="got">קיבלת ברכה מהשלומיוורס</div><div class="for" id="for">${esc(forWho)}</div>${g.event ? `<div class="ev" id="ev">${esc(g.event)}</div>` : ''}
</div><img class="logo" src="${LOGO}">`}<div class="frame"></div></body></html>`;
}

// draws the card to outFile; face = the resident's picture (URL or local path)
async function render(g, outFile, { base = false } = {}) {
  const puppeteer = require(path.join(ROOT, 'zoomcut/render/node_modules/puppeteer-core'));
  let face = g.charImg || '';
  if (face && !/^https?:/.test(face)) face = 'data:image/jpeg;base64,' + fs.readFileSync(face).toString('base64');
  else if (face) { const r = await fetch(face); face = 'data:image/jpeg;base64,' + Buffer.from(await r.arrayBuffer()).toString('base64'); }
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((f) => fs.existsSync(f)) || process.env.CHROME_PATH;
  const b = await puppeteer.launch({ executablePath: exe });
  try {
    const p = await b.newPage(); await p.setViewport({ width: 1200, height: 630 });
    await p.setContent(html(g, face, base), { waitUntil: 'load', timeout: 90000 }); await p.evaluate(() => document.fonts.ready);
    await p.evaluate(() => {   // the occasion as big as fits its width
      const fit = (id, v, max, min) => { const el = document.getElementById(id); if (!el) return; for (let s = max; s >= min; s -= 2) { el.style.setProperty(v, s + 'px'); if (el.scrollWidth <= 650) break; } };
      fit('for', '--f', 150, 70); fit('ev', '--e', 86, 44);
    });
    if (base) await p.evaluate(() => { const f = document.getElementById('for'), e = document.getElementById('ev'); f.style.setProperty('--f', Math.min(parseInt(getComputedStyle(f).fontSize), 118) + 'px'); if (e) e.style.setProperty('--e', Math.min(parseInt(getComputedStyle(e).fontSize), 64) + 'px'); });
    await p.screenshot({ path: outFile, type: 'jpeg', quality: 90 });
  } finally { await b.close(); }
}
module.exports = { render };
