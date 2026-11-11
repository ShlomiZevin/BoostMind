// The chain plan (Backstage → תוכניות, id chat-chain): body.html -> index.html in the template's look. Re-publish after his notes:
//   node scripts/plans/chat-chain/build.cjs && OWNER_KEY=... node scripts/plans/plan.mjs publish scripts/plans/chat-chain --id chat-chain --title-file scripts/plans/chat-chain/title.txt --summary-file scripts/plans/chat-chain/summary.txt
const fs = require('fs'), path = require('path');
const tpl = fs.readFileSync('C:/workspace/BoostMind/scripts/plans/template/index.html', 'utf8');
const style = tpl.match(/<style>[\s\S]*<\/style>/)[0];
const body = fs.readFileSync(path.join(__dirname, 'body.html'), 'utf8');
const extra = `
  .s1 { --c: #4f8cff; } .s2 { --c: #a07cff; } .s3 { --c: #ffc53d; } .s4 { --c: #39d39a; }
  .num { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 9px; background: var(--c, var(--acc)); color: #0b0b0e; font-weight: 900; font-size: .95rem; flex: none; }
  .one { text-align: center; } .load { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-bottom: 8px; }
  .load span { font-size: .8rem; padding: 3px 9px; border-radius: 8px; background: rgba(255,106,31,.14); color: #ffb48a; }
  .onebox { margin: 6px auto 10px; width: 150px; padding: 14px; border-radius: 14px; border: 2px solid #ff6b6b; font-weight: 900; box-shadow: 0 0 0 6px rgba(255,107,107,.12); }
  .mini { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: center; margin: 10px 0; }
  .mini .m { padding: 8px 12px; border-radius: 12px; border: 2px solid var(--c); font-weight: 800; font-size: .95rem; } .mini .m.opt { border-style: dashed; } .mini i { color: var(--dim); font-style: normal; }
  .chain { position: relative; max-width: 620px; margin: 18px auto 0; padding-inline-start: 0; }
  .chain .in { text-align: center; background: var(--card2); border: 1px solid var(--line); border-radius: 14px; padding: 10px 14px; }
  .chain .in b { display: block; } .chain .in small { color: var(--dim); }
  .chain .outp { border-color: rgba(57,211,154,.6); }
  .dn { text-align: center; color: var(--dim); font-size: 1.2rem; line-height: 1.6; }
  .node { background: var(--card); border: 1px solid var(--line); border-inline-start: 5px solid var(--c); border-radius: 16px; padding: 12px 14px; }
  .node.opt { border-style: dashed; border-inline-start-style: solid; } .node.talk { box-shadow: 0 0 0 3px rgba(57,211,154,.18); }
  .nh { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; } .nh b { font-size: 1.15rem; }
  .node p { margin: 8px 0; color: rgba(255,255,255,.86); }
  .meta { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-size: .86rem; color: var(--dim); }
  .meta .k { font-weight: 800; color: #fff; } .meta .out { padding: 1px 8px; border-radius: 7px; background: var(--card2); border: 1px solid var(--line); color: #fff; font-weight: 700; } .meta .out.t { border-color: rgba(57,211,154,.6); }
  .dots { display: inline-flex; gap: 3px; } .dots i { width: 14px; height: 9px; border-radius: 3px; background: rgba(255,255,255,.12); } .dots i.on { background: var(--c); } .dots i.half { background: linear-gradient(90deg, rgba(255,255,255,.12) 50%, var(--c) 50%); }
  .brainbar { margin-top: 16px; text-align: center; padding: 12px; border-radius: 14px; border: 2px dashed rgba(255,106,31,.6); background: rgba(255,106,31,.07); }
  .brainbar b { display: block; color: #ffb48a; } .brainbar small { color: var(--dim); }
  .tblwrap { overflow-x: auto; } td b { white-space: normal; } .matrix td small { display: block; color: var(--dim); font-size: .78rem; } .matrix td.y { color: #8ee6a6; font-weight: 700; }
  .matrix th:nth-child(2) { color: #7ea9ff; } .matrix th:nth-child(3) { color: #c3a9ff; } .matrix th:nth-child(4) { color: #ffd66b; } .matrix th:nth-child(5) { color: #6fe3b6; }
  .addon { background: var(--card); border: 1px solid var(--line); border-inline-start: 5px solid var(--c); border-radius: 16px; padding: 4px 16px 14px; margin: 14px 0; }
  .addon h3 { display: flex; align-items: center; gap: 8px; margin: 14px 0 8px; }
  .outbox { margin-top: 10px; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; } .outbox .oh { background: var(--card2); padding: 6px 12px; font-weight: 800; font-size: .88rem; color: var(--c); }
  .outbox table { margin: 0; } .outbox td:first-child { width: 120px; font-weight: 700; color: #fff; } .outbox td { font-size: .92rem; }
  .turn { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 12px 14px; margin: 12px 0; }
  .msg { display: inline-block; background: #2a2a33; border-radius: 14px 14px 4px 14px; padding: 8px 14px; font-weight: 700; }
  .ran { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 6px; } .ran .r { font-size: .8rem; font-weight: 800; padding: 2px 10px; border-radius: 8px; border: 1px solid var(--line); color: rgba(255,255,255,.3); }
  .ran .r.on { border-color: var(--c); color: #fff; background: color-mix(in srgb, var(--c) 18%, transparent); }
  .notes p { margin: 4px 0; font-size: .92rem; color: rgba(255,255,255,.82); }
  .ans { margin-top: 8px; padding: 8px 12px; border-radius: 12px; border-inline-start: 3px solid #39d39a; background: rgba(57,211,154,.07); font-size: .95rem; }
  .shot.wide { flex: 0 1 380px; } .shot.wide img { aspect-ratio: auto; object-fit: contain; }
  @media (max-width: 700px) { .outbox td:first-child { width: 92px; } .matrix { font-size: .82rem; } .matrix th, .matrix td { padding: 7px 5px; } .addon { padding: 2px 12px 12px; } }`;
const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>המוח המצחיק · שלומיוורס</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800;900&display=swap" rel="stylesheet">
${style.replace('</style>', extra + '\n</style>')}
</head>
<body>
<div class="wrap">
${body}
</div>
<div class="zoom" id="zoom"><img alt=""></div>
<script>
  const z = document.getElementById('zoom');
  document.querySelectorAll('.shot img').forEach((im) => im.onclick = () => { z.querySelector('img').src = im.src; z.classList.add('on'); });
  z.onclick = () => z.classList.remove('on');
  document.querySelectorAll('h1, h2, h3, h4, .step b').forEach((h) => { h.innerHTML = h.innerHTML.replace(/שלומיוורס/g, '<span class="b">שלומי<i>וורס</i></span>'); });
</script>
</body>
</html>`;
fs.writeFileSync(path.join(__dirname, 'index.html'), html, 'utf8');
console.log('ok', Math.round(html.length / 1024) + 'KB');
