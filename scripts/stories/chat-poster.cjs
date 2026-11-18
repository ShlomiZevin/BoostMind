// A chat story poster (1080x1920): a real conversation with a resident, drawn as chat bubbles - the clean poster he
// posts himself. The chat-story skill (zoomcut/skill/chat-story) says how a conversation is picked and cleaned first.
//   node scripts/stories/chat-poster.cjs spec.json out.jpg
// spec: { "name": "חנה פרידמן", "first": "חנה", "portrait": "public/techietech/team/hani.jpg", "color": "#1f3a5f",
//         "date": "16.11.2026", "msgs": [ { "who": "v", "t": "..." }, { "who": "c", "t": "..." } ] }
// v = the visitor (never a name), c = the resident. The bubbles' letters shrink by themselves until everything fits.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const puppeteer = require(path.join(ROOT, 'zoomcut/render/node_modules/puppeteer-core'));
const [specFile, out] = process.argv.slice(2);
if (!specFile || !out) { console.error('usage: chat-poster.cjs spec.json out.jpg'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
const img = (p) => { const f = path.isAbsolute(p) ? p : path.join(ROOT, p); return `data:image/${/\.png$/i.test(f) ? 'png' : 'jpeg'};base64,` + fs.readFileSync(f).toString('base64'); };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
const face = img(spec.portrait), logo = img('public/verse/logo-512.png'), col = spec.color || '#1f3a5f';
const bubbles = spec.msgs.map((m) => m.who === 'c'
  ? `<div class="row c"><img class="av" src="${face}"><div class="b">${esc(m.t)}</div></div>`
  : `<div class="row v"><div class="b">${esc(m.t)}</div></div>`).join('');
const html = `<html dir="rtl"><head><link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800;900&display=swap" rel="stylesheet">
<style>
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;font-family:Heebo}
body{background:radial-gradient(900px 700px at 50% 108%,rgba(255,120,30,.28),transparent 70%),radial-gradient(800px 600px at 50% -10%,${col}aa,transparent 70%),#0c0c13;color:#fff}
.head{position:absolute;top:130px;right:70px;left:70px;display:flex;align-items:center;gap:30px}
.head img{width:150px;height:150px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 6px ${col},0 0 0 11px rgba(255,255,255,.85)}
.head .n{font:900 62px/1.05 Heebo}
.head .d{font:500 32px/1.3 Heebo;color:#c9c9d6;margin-top:8px}
#chat{position:absolute;top:330px;bottom:450px;right:50px;left:50px;display:flex;flex-direction:column;justify-content:center;gap:var(--g)}
.row{display:flex;align-items:flex-end;gap:16px}
.row.v{justify-content:flex-end}
.b{font-size:var(--fs);line-height:1.38;padding:.55em .8em;border-radius:1.05em;max-width:86%;box-shadow:0 8px 22px rgba(0,0,0,.35)}
.c .b{background:${col};color:#fff;border-bottom-right-radius:.25em;font-weight:500}
.v .b{background:#ecebf2;color:#15151f;border-bottom-left-radius:.25em;font-weight:500}
.av{width:62px;height:62px;border-radius:50%;object-fit:cover;flex:none;box-shadow:0 0 0 3px ${col}}
.foot{position:absolute;bottom:140px;right:0;left:0;display:flex;flex-direction:column;align-items:center}
.foot img{width:190px}
.foot .t{font:800 46px/1.2 Heebo;margin-top:6px}
.foot .u{font:500 32px/1.3 Heebo;color:#ffb073;letter-spacing:1px;direction:ltr}
</style></head><body>
<div class="head"><img src="${face}"><div><div class="n">${esc(spec.name)}</div><div class="d">שיחה מהשלומיוורס · ${esc(spec.date)}</div></div></div>
<div id="chat">${bubbles}</div>
<div class="foot"><img src="${logo}"><div class="t">דברו עם ${esc(spec.first || spec.name)} בשלומיוורס</div><div class="u">shlomiverse.com</div></div>
</body></html>`;
(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((f) => fs.existsSync(f)) || process.env.CHROME_PATH;
  const b = await puppeteer.launch({ executablePath: exe });
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
