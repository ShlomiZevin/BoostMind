// Dr. Naomi-Tzipora release - the posters (1080x1920 JPG). node scripts/releases/naomi/promo/posters.js [only]
// Art + copy live in scripts/releases/naomi/private/promo/ (her face, the unreleased script's lines - never in git):
//   art/podcast.png (her as a podcast guest), art/site.png + art/site-mask.png (the "newborn" phone), art/book.png,
//   art/org.png (her leading a managers' workshop), copy.json (all Hebrew, Terra-picked). Output -> private/promo/out/.
// -instagram = nothing in the top 250 px, the bottom quarter (1440-1920) empty for his link sticker.
// -verse     = the clean picture only; the words go on as story boxes (verse-*.json next to it).
// Her logo: picked up from zoomcut/episodes/_assets/naomi/logo/ when it exists. The real site's screenshot: private/promo/site-shot.png.
const puppeteer = require('C:/workspace/BoostMind/zoomcut/render/node_modules/puppeteer-core');
const fs = require('fs'), path = require('path');
const ROOT = 'C:/workspace/BoostMind', PRIV = ROOT + '/scripts/releases/naomi/private/promo', OUT = PRIV + '/out';
const C = JSON.parse(fs.readFileSync(PRIV + '/copy.json', 'utf8'));
const uri = (f) => fs.existsSync(f) ? `data:image/${f.endsWith('.png') ? 'png' : 'jpeg'};base64,` + fs.readFileSync(f).toString('base64') : null;
const art = (f) => uri(PRIV + '/art/' + f);
const LOGO_DIR = ROOT + '/zoomcut/episodes/_assets/naomi/logo/';
const mark = uri(LOGO_DIR + 'mark.png'), logo = uri(LOGO_DIR + 'logo.png'), logoWhite = uri(LOGO_DIR + 'logo-white.png');
const shot = uri(PRIV + '/site-shot.png');
const BUR = '#6b1024', BUR2 = '#8a1a33', CREAM = '#fbf3ea', ORANGE = '#e0702f';

const head = `<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800;900&family=Secular+One&family=Frank+Ruhl+Libre:wght@500;700;900&display=block" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:1080px;height:1920px;overflow:hidden;background:${CREAM};font-family:Heebo}
.abs{position:absolute}.c{position:absolute;left:0;right:0;display:flex;justify-content:center}
.rtl{direction:rtl}
.pill{display:inline-block;border-radius:999px;font:800 40px/1 Heebo;padding:18px 46px}
.mark{display:inline;background:${BUR};color:#fff;font:900 78px/1.32 Heebo;padding:2px 26px;-webkit-box-decoration-break:clone;box-decoration-break:clone;border-radius:14px}
</style></head><body>`;
const foot = `</body></html>`;

// the name band - the same look as her lower third in the video (orange band, white strip under it)
const band = (top) => `<div class="c rtl" style="top:${top}px;flex-direction:column;align-items:center">
  <div style="background:${ORANGE};color:#fff;font:800 47px/1 Heebo;padding:20px 30px 22px;white-space:nowrap;box-shadow:0 14px 30px rgba(60,20,10,.28)">${C.name}</div>
  <div style="background:#fff;color:${ORANGE};font:800 34px/1 Heebo;padding:12px 26px 14px;white-space:nowrap">${C.titles}</div></div>`;

// ---------- 1. the video ----------
function videoIG() {
  const bg = art('podcast.png'), V = C.video;
  return head + `
  <div class="abs" style="left:-60px;top:-60px;width:1200px;height:2040px;background:url(${bg}) center/cover;filter:blur(28px) brightness(1.04)"></div>
  <div class="abs" style="left:0;top:300px;width:1080px;height:1620px;background:url(${bg}) center/cover;-webkit-mask-image:linear-gradient(transparent 0,#000 140px)"></div>
  <div class="abs" style="left:0;top:0;width:1080px;height:470px;background:linear-gradient(${CREAM} 60%,${CREAM}00)"></div>
  <div class="abs rtl" style="right:56px;top:262px;max-width:640px">
    <div style="background:#fff;border-radius:30px 30px 6px 30px;padding:18px 28px 14px;box-shadow:0 12px 34px rgba(80,40,30,.22)">
      <div style="font:700 26px/1 Heebo;color:${ORANGE};margin-bottom:10px">${V.bubbleFrom}</div>
      <div style="display:flex;align-items:flex-end;gap:20px"><span style="font:600 44px/1.15 Heebo;color:#1d1416;white-space:nowrap">${V.bubble}</span>
      <span style="font:500 22px/1 Heebo;color:#8d8285;direction:ltr">${V.bubbleTime} ✓✓</span></div></div></div>
  <div class="c rtl" style="top:440px;text-align:center"><div style="width:1000px"><span class="mark">${V.h1}</span><br><span class="mark" style="background:${ORANGE}">${V.h2}</span></div></div>
  ${band(1150)}
  <div class="abs rtl" style="top:1318px;right:112px"><span class="pill" style="background:${BUR};color:#fff;box-shadow:0 12px 30px rgba(60,10,20,.35)">${C.now}</span></div>
  ` + foot;
}
function videoVerse() {   // the clean picture: the photo full-bleed, no words
  return head + `<div class="abs" style="left:-100px;top:0;width:1280px;height:1920px;background:url(${art('podcast.png')}) center/cover"></div>` + foot;
}

// ---------- 2. the site launch ----------
function screen() {      // the phone's screen: the real site's screenshot once it exists, else a stand-in of its hero
  if (shot) return `<div style="position:absolute;inset:0;background:#fff url(${shot}) top center/100% auto"></div>`;
  return `<div class="rtl" style="position:absolute;left:0;top:0;width:390px;transform:scale(${461 / 390});transform-origin:0 0;background:${CREAM};font-family:Heebo;height:720px">
    <div style="height:64px;background:${BUR};display:flex;align-items:center;justify-content:space-between;padding:22px 18px 0">
      <span style="color:#fff;font:700 15px/1 Heebo">ד״ר נעמי־ציפורה</span>
      ${logoWhite ? `<img src="${logoWhite}" style="height:30px">` : `<span style="color:#f3c9b8;font:400 15px/1 'Frank Ruhl Libre'">המחוג שבלב</span>`}</div>
    <div style="height:250px;background:url(${uri(ROOT + '/zoomcut/characters/naomi-tzipora/portrait-author.jpg')}) center 30%/cover"></div>
    <div style="padding:16px 20px 0">
      <div style="font:800 19px/1.25 Heebo;color:#2a1418">${C.name}</div>
      <div style="font:400 12.5px/1.45 Heebo;color:#5d4a4d;margin-top:6px">פסיכיאטרית, פסיכותרפיסטית אינטגרטיבית, מאמנת NLP, CBT, TMI ו־EMDR, ודולה מוסמכת של רגשות.</div>
      <div style="font:400 34px/1.08 'Secular One';color:${BUR};margin-top:14px">לכל רגש<br>יש תאריך לידה</div>
      <div style="margin-top:16px;background:${BUR};color:#fff;border-radius:999px;text-align:center;font:700 16px/1 Heebo;padding:15px 0">לקביעת מפגש רגשי ראשון</div>
      <div style="margin-top:10px;border:1.5px solid ${BUR};color:${BUR};border-radius:999px;text-align:center;font:700 15px/1 Heebo;padding:12px 0">להכיר את המחוג הפנימי</div>
    </div></div>`;
}
function siteArt() {     // the newborn phone with the site on its screen + her photo like on a birth announcement
  return `<div class="abs" style="left:-100px;top:0;width:1280px;height:1920px;background:url(${art('site.png')}) center/cover"></div>
  <div class="abs" style="left:-100px;top:0;width:1280px;height:1920px;-webkit-mask-image:url(${art('site-mask.png')});-webkit-mask-size:100% 100%">
    <div style="position:absolute;left:${321 * 1.25}px;top:${464 * 1.25}px;width:461px;height:787px;overflow:hidden">${screen()}
      <div style="position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,0) 35%,rgba(255,255,255,.14) 48%,rgba(255,255,255,0) 60%)"></div></div></div>`;
}
function siteIG() {
  const S = C.site;
  return head + siteArt() + `
  <div class="c rtl" style="top:262px;flex-direction:column;align-items:center;text-align:center">
    <span class="pill" style="background:${BUR};color:#fff;font-size:32px;padding:13px 36px">${S.tag}</span>
    <div style="font:900 104px/1.05 'Frank Ruhl Libre';color:${BUR};margin-top:16px;white-space:nowrap">${S.h}</div>
    <div style="font:500 38px/1.2 Heebo;color:#4a2a2f;margin-top:14px;white-space:nowrap">${S.sub}</div>
    <div style="font:700 34px/1 Heebo;color:${BUR2};margin-top:14px;direction:ltr;letter-spacing:.5px">${C.url}</div>
  </div>
  ` + foot;
}
function siteVerse() { return head + siteArt() + foot; }

// ---------- 3. the book ----------
function bookIG() {
  const B = C.book;
  return head + `
  <div class="abs" style="left:-100px;top:0;width:1280px;height:1920px;background:url(${art('book.png')}) center/cover"></div>
  <div class="abs" style="left:0;top:0;width:1080px;height:640px;background:linear-gradient(rgba(90,20,30,.28),rgba(90,20,30,0))"></div>
  <div class="c rtl" style="top:262px;flex-direction:column;align-items:center;text-align:center">
    <span class="pill" style="background:#fff;color:${BUR};font-size:32px;padding:13px 36px;box-shadow:0 8px 24px rgba(80,20,20,.25)">${B.tag}</span>
    <div style="font:900 92px/1.05 'Frank Ruhl Libre';color:#fff;margin-top:18px;white-space:nowrap;text-shadow:0 6px 30px rgba(90,20,20,.55)">${B.h}</div>
  </div>
  <img class="abs" src="${art('book-3d-noflip.png')}" style="left:40px;top:372px;width:1020px;height:1020px">
  <div class="abs rtl" style="left:70px;top:540px;width:214px;height:214px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#f6d58d,#c9932f 70%,#a8741f);box-shadow:0 10px 26px rgba(60,30,0,.4),inset 0 0 0 6px rgba(255,255,255,.35);display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(-10deg);color:#5a2a06;text-align:center">
    <div style="font:700 30px/1.05 Heebo">${B.seal1}</div><div style="font:900 34px/1.05 Heebo">${B.seal2}</div><div style="font:900 44px/1.05 'Frank Ruhl Libre'">${B.seal3}</div></div>
  <div class="c rtl" style="top:1284px;flex-direction:column;align-items:center;text-align:center">
    <div style="background:${BUR};color:#fff;font:800 42px/1 Heebo;padding:18px 40px;border-radius:16px;white-space:nowrap;box-shadow:0 12px 30px rgba(60,10,20,.35)">${B.cta1}</div>
    <div style="font:600 33px/1.2 Heebo;color:#fff;margin-top:14px;white-space:nowrap;text-shadow:0 3px 14px rgba(60,20,10,.85)">${B.cta2}</div>
  </div>` + foot;
}

// ---------- 4. the organisations program ----------
function orgIG() {
  const O = C.org, bg = art('org.png');
  const card = (t, s) => `<div style="background:rgba(255,255,255,.93);border-right:10px solid ${BUR};border-radius:18px;padding:22px 26px;box-shadow:0 10px 28px rgba(40,20,30,.18)">
    <div style="font:800 40px/1.1 Heebo;color:${BUR}">${t}</div><div style="font:500 30px/1.2 Heebo;color:#3a2a2d;margin-top:6px">${s}</div></div>`;
  return head + `
  <div class="abs" style="left:-60px;top:-60px;width:1200px;height:2040px;background:url(${bg}) center/cover;filter:blur(30px) brightness(1.08)"></div>
  <div class="abs" style="left:0;top:300px;width:1080px;height:1620px;background:url(${bg}) center/cover;-webkit-mask-image:linear-gradient(transparent 0,#000 160px)"></div>
  <div class="abs" style="left:0;top:0;width:1080px;height:560px;background:linear-gradient(#fbf7f3 55%,rgba(251,247,243,0))"></div>
  <div class="c rtl" style="top:262px;flex-direction:column;align-items:center;text-align:center">
    <span class="pill" style="background:${BUR};color:#fff;font-size:30px;padding:12px 34px">${O.tag}</span>
    <div style="font:400 98px/1.05 'Secular One';color:${BUR};margin-top:14px;white-space:nowrap">${O.h}</div>
    <div style="font:500 36px/1.2 Heebo;color:#3a2a2d;margin-top:8px;white-space:nowrap">${O.sub}</div>
  </div>
  <div class="abs rtl" style="left:44px;top:600px;width:520px;display:flex;flex-direction:column;gap:18px">
    ${card(O.t1, O.t1s)}${card(O.t2, O.t2s)}
    <div style="display:flex;gap:12px;flex-wrap:wrap">${O.facts.split(' · ').map((f) => `<span style="font:700 27px/1 Heebo;color:#fff;background:rgba(70,14,30,.86);border-radius:12px;padding:13px 18px">${f}</span>`).join('')}</div>
  </div>
  <div class="c rtl" style="top:1262px"><div style="width:980px;background:rgba(255,255,255,.95);border-radius:22px;padding:22px 32px;box-shadow:0 12px 30px rgba(40,20,30,.22);display:flex;align-items:center;gap:26px">
    ${mark ? `<img src="${mark}" style="height:118px;flex:none">` : ''}
    <div><div style="font:700 28px/1 Heebo;color:${ORANGE}">${O.qk}</div>
    <div style="font:700 40px/1.2 'Frank Ruhl Libre';color:#21161a;margin-top:8px">${O.q}</div>
    <div style="font:500 24px/1 Heebo;color:#6d5d60;margin-top:8px">${O.qs}</div></div></div></div>
  ` + foot;
}

const JOBS = { 'naomi-video-instagram': videoIG, 'naomi-video-verse': videoVerse, 'naomi-site-instagram': siteIG, 'naomi-site-verse': siteVerse, 'naomi-book-instagram': bookIG, 'naomi-org-instagram': orgIG };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const only = process.argv[2];
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
  const p = await b.newPage(); await p.setViewport({ width: 1080, height: 1920 });
  for (const [name, fn] of Object.entries(JOBS)) {
    if (only && !name.includes(only)) continue;
    await p.setContent(fn(), { waitUntil: 'load', timeout: 120000 }); await p.evaluate(() => document.fonts.ready); await new Promise((r) => setTimeout(r, 300));
    await p.screenshot({ path: path.join(OUT, name + '.jpg'), type: 'jpeg', quality: 93 });
    console.log('OK', name);
  }
  await b.close();
  console.log('logo:', logo ? 'yes' : 'not yet', '| site screenshot:', shot ? 'yes' : 'stand-in');
})();
