// A chat story poster (1080x1920): a real conversation with a resident, drawn as chat bubbles - the clean poster he
// posts himself. The chat-story skill (zoomcut/skill/chat-story) says how a conversation is picked and cleaned first.
//   node scripts/stories/chat-poster.cjs spec.json out.jpg
// spec: { "name": "חנה פרידמן", "first": "חנה", "portrait": "public/techietech/team/hani.jpg", "color": "#1f3a5f",
//         "date": "16.11.2026", "msgs": [ { "who": "v", "t": "..." }, { "who": "c", "t": "..." } ] }
// v = the visitor (never a name), c = the resident. The bubbles' letters shrink by themselves until everything fits.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const puppeteer = require(path.join(ROOT, 'zoomcut/render/node_modules/puppeteer-core'));
const img = (p) => { const f = path.isAbsolute(p) ? p : path.join(ROOT, p); return `data:image/${/\.png$/i.test(f) ? 'png' : 'jpeg'};base64,` + fs.readFileSync(f).toString('base64'); };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
// opts (used by chat-video.cjs): part = '2/5' shown beside the date
function buildHtml(spec, opts = {}) {
const face = img(spec.portrait), logo = img('public/verse/logo-512.png'), visitor = img('scripts/stories/art/visitor.jpg');
// the verse's own look (v2/site/verse/verse.css + the app chat in shell.css): orange #ff6a1f for the visitor and the
// rings, dark glass bubbles for the resident, Heebo, the planet logo; no emoji
const bubbles = spec.msgs.map((m) => m.who === 'c'
  ? `<div class="row c"><img class="av" src="${face}"><div class="b">${esc(m.t)}</div></div>`
  : `<div class="row v"><div class="b">${esc(m.t)}</div><img class="av me" src="${visitor}"></div>`).join('');
const html = `<html dir="rtl"><head><link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;font-family:Heebo}
body{color:#fff;background:
  radial-gradient(760px 760px at 108% -6%,rgba(255,106,31,.42),rgba(255,106,31,.10) 45%,transparent 70%),
  radial-gradient(900px 520px at 50% 112%,rgba(255,106,31,.34),transparent 70%),
  radial-gradient(1400px 900px at 50% 50%,#141418,#0b0b0e 75%)}
.ring{position:absolute;width:1500px;height:420px;left:-210px;top:-150px;border-radius:50%;border:3px solid rgba(255,138,61,.22);transform:rotate(-14deg)}
.head{position:absolute;top:130px;right:64px;left:64px;display:flex;align-items:center;gap:30px}
.head .face{width:156px;height:156px;border-radius:50%;object-fit:cover;object-position:50% 18%;border:6px solid #ff6a1f;box-shadow:0 0 34px rgba(255,106,31,.55);box-sizing:border-box}
.head .n{font:900 64px/1.05 Heebo}
.head .d{display:inline-flex;align-items:center;gap:12px;margin-top:14px;height:50px;padding:0 22px;border-radius:999px;background:rgba(255,255,255,.09);border:1.5px solid rgba(255,255,255,.14);font:700 28px/1 Heebo;color:rgba(255,255,255,.86)}
.head .d i{width:12px;height:12px;border-radius:50%;background:#ff6a1f;box-shadow:0 0 10px #ff6a1f}
.head .logo{width:190px;margin-inline-start:auto}
#chat{position:absolute;top:350px;bottom:380px;right:50px;left:50px;display:flex;flex-direction:column;justify-content:center;gap:var(--g)}
.row{display:flex;align-items:flex-start;gap:18px}
.row.v{justify-content:flex-end;align-items:center}
.b{font-size:var(--fs);line-height:1.42;padding:.5em .78em;border-radius:.62em;max-width:84%;box-shadow:0 18px 50px rgba(0,0,0,.45)}
.c .b{background:#1f1f24;border:1.5px solid rgba(255,255,255,.14);font-weight:500}
.v .b{background:#ff6a1f;font-weight:600;box-shadow:0 0 0 1px rgba(255,106,31,.22),0 10px 26px -8px rgba(255,106,31,.5)}
.av{width:66px;height:66px;border-radius:50%;object-fit:cover;object-position:50% 18%;flex:none;border:3.5px solid #ff6a1f;box-shadow:0 0 14px rgba(255,106,31,.4);box-sizing:border-box}
.av.me{object-position:50% 50%;border:2px solid rgba(255,138,61,.55);box-shadow:none}   /* the anonymous visitor: someone from our world peeking in through the portal (his pick, 2026-11-18) */
.foot{position:absolute;bottom:150px;right:0;left:0;display:flex;flex-direction:column;align-items:center;gap:18px}
.foot .btn{display:inline-flex;align-items:center;height:104px;padding:0 56px;border-radius:999px;background:#ff6a1f;font:800 46px/1 Heebo;box-shadow:0 0 0 1px rgba(255,106,31,.22),0 14px 40px -10px rgba(255,106,31,.6)}
.foot .u{font:700 34px/1 Heebo;letter-spacing:1px;direction:ltr;color:rgba(255,255,255,.75)}
.foot .u b{color:#ff8a3d}
</style></head><body><div class="ring"></div>
<div class="head"><img class="face" src="${face}"><div><div class="n">${esc(spec.name)}</div><div class="d"><i></i>שיחה מהשלומיוורס · ${esc(spec.date)}${opts.part ? ' · ' + esc(opts.part) : ''}</div></div><img class="logo" src="${logo}"></div>
<div id="chat">${bubbles}</div>
<div class="foot"><div class="btn">דברו עם ${esc(spec.first || spec.name)} בשלומיוורס</div><div class="u">shlomi<b>verse</b>.com</div></div>
</body></html>`;
return html;
}
const chrome = () => ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((f) => fs.existsSync(f)) || process.env.CHROME_PATH;
module.exports = { buildHtml, chrome, puppeteer };
if (require.main === module) (async () => {
  const [specFile, out] = process.argv.slice(2);
  if (!specFile || !out) { console.error('usage: chat-poster.cjs spec.json out.jpg'); process.exit(1); }
  const spec = JSON.parse(fs.readFileSync(specFile, 'utf8')), html = buildHtml(spec);
  const b = await puppeteer.launch({ executablePath: chrome() });
  const p = await b.newPage(); await p.setViewport({ width: 1080, height: 1920 });
  await p.setContent(html, { waitUntil: 'networkidle0' }); await p.evaluate(() => document.fonts.ready);
  const fs_ = await p.evaluate(() => {   // the biggest letters that still fit the chat area
    const c = document.getElementById('chat');
    for (let s = 46; s >= 26; s -= 1) { c.style.setProperty('--fs', s + 'px'); c.style.setProperty('--g', Math.round(s * 0.7) + 'px'); if (c.scrollHeight <= c.clientHeight) return s; }
    return 26;
  });
  await p.screenshot({ path: out, type: 'jpeg', quality: 93 });
  await b.close();
  console.log(out, 'letters', fs_ + 'px', fs_ < 30 ? '(small - shorten the answers)' : '');
})();
