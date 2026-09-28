// Builds the gov tender response kit: docs/gov-kit/out/*.md -> public/boostart/gov/**/index.html
// Usage: node docs/gov-kit/build.js   (then run pdf.sh to print the PDFs)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'public', 'boostart', 'gov');
const SRC = path.join(__dirname, 'out');

const DATE = 'ספטמבר 2026';
const VERSION = 'גרסה 1.0';
const KICKER = 'ערכת מענה · תיחורי Agentic AI ו-SDD · מערך הדיגיטל הלאומי';

const DOCS = [
  { key: 'methodology', slug: 'methodology', pdf: 'Boostart-Agentic-SDD-Methodology.pdf', toc: true },
  { key: 'migration', slug: 'cloud-migration', pdf: 'Boostart-Cloud-Migration-Approach.pdf', toc: true },
  { key: 'olim', slug: 'olim-laanan', pdf: 'Boostart-Olim-Laanan-Approach.pdf', toc: true },
  { key: 'team', slug: 'team', pdf: 'Boostart-Team-and-Experience.pdf', toc: false },
  { key: 'partner', slug: 'partner', pdf: 'Boostart-Framework-Partnership.pdf', toc: false },
];

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = s => esc(s.trim()).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

// Minimal parser for the restricted markdown terra was asked to produce.
function parse(md) {
  const lines = md.replace(/\r/g, '').split('\n');
  let title = '', subtitle = '';
  const blocks = [];
  let i = 0;
  const flushable = [];
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) { i++; continue; }
    if (line.startsWith('# ')) { title = line.slice(2).trim(); i++; continue; }
    if (line.startsWith('>> ')) { subtitle = line.slice(3).trim(); i++; continue; }
    if (line.startsWith('## ')) { blocks.push({ t: 'h2', text: line.slice(3).trim() }); i++; continue; }
    if (line.startsWith('### ')) { blocks.push({ t: 'h3', text: line.slice(4).trim() }); i++; continue; }
    if (line.startsWith('::: callout')) {
      const body = []; i++;
      while (i < lines.length && lines[i].trim() !== ':::') { if (lines[i].trim()) body.push(lines[i].trim()); i++; }
      i++; blocks.push({ t: 'callout', lines: body }); continue;
    }
    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const r = lines[i].trim();
        if (!/^\|[\s:|-]+\|$/.test(r)) rows.push(r.replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
        i++;
      }
      blocks.push({ t: 'table', head: rows[0], rows: rows.slice(1) }); continue;
    }
    if (line.startsWith('- ') || line.startsWith('+ ') || /^\d+\.\s/.test(line)) {
      const kind = line.startsWith('- ') ? 'ul' : line.startsWith('+ ') ? 'grid' : 'ol';
      const items = [];
      while (i < lines.length) {
        const l = lines[i].trim();
        const ok = kind === 'ul' ? l.startsWith('- ') : kind === 'grid' ? l.startsWith('+ ') : /^\d+\.\s/.test(l);
        if (!ok) break;
        items.push(l.replace(/^(- |\+ |\d+\.\s)/, ''));
        i++;
      }
      blocks.push({ t: kind, items }); continue;
    }
    // paragraph: consecutive non-empty plain lines, kept as line breaks
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#|>>|\||- |\+ |:::|\d+\.\s)/.test(lines[i].trim())) {
      para.push(lines[i].trim()); i++;
    }
    blocks.push({ t: 'p', lines: para });
  }
  return { title, subtitle, blocks };
}

function render(blocks) {
  let h2n = 0;
  const toc = [];
  const html = blocks.map(b => {
    switch (b.t) {
      case 'h2': { h2n++; const id = 's' + h2n; toc.push({ id, text: b.text }); return `<h2 id="${id}">${inline(b.text)}</h2>`; }
      case 'h3': return `<h3>${inline(b.text)}</h3>`;
      case 'p': {
        const t = b.lines.map(inline).join('<br>');
        const chain = b.lines.length === 1 && /→/.test(b.lines[0]);
        return chain ? `<p class="chain">${t}</p>` : `<p>${t}</p>`;
      }
      case 'callout': return `<div class="callout"><p>${b.lines.map(inline).join('<br>')}</p></div>`;
      case 'ul': return `<ul class="bul">${b.items.map(x => `<li>${inline(x)}</li>`).join('')}</ul>`;
      case 'ol': return `<ol class="num">${b.items.map(x => `<li>${inline(x)}</li>`).join('')}</ol>`;
      case 'grid': return `<ul class="incl">${b.items.map(x => {
        const [k, ...v] = x.split(' | ');
        return v.length ? `<li><b>${inline(k)}</b><span>${inline(v.join(' | '))}</span></li>` : `<li>${inline(x)}</li>`;
      }).join('')}</ul>`;
      case 'table': {
        const cols = b.head.length;
        const cls = cols >= 5 ? 'tbl wide' : 'tbl';
        return `<div class="tbl-wrap"><table class="${cls}"><thead><tr>${b.head.map(h => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${
          b.rows.map(r => `<tr>${b.head.map((h, j) => `<td data-l="${esc(h)}">${inline(r[j] || '')}</td>`).join('')}</tr>`).join('')
        }</tbody></table></div>`;
      }
    }
  }).join('\n');
  return { html, toc };
}

const CSS = `
:root{
  --bg:#EEF0F3; --paper:#FFFFFF; --tint:#F5F7FA; --tint-2:#EAF0F8;
  --line:rgba(20,22,26,.10); --line-2:rgba(20,22,26,.18);
  --text:#14161A; --text-2:#353A44; --muted:#6A707C;
  --accent:#3F6FB0; --chip:#FFFFFF; --maxw:860px;
}
:root[data-theme="dark"]{
  --bg:#0B0C0E; --paper:#131519; --tint:#1A1D22; --tint-2:#1C2430;
  --line:rgba(255,255,255,.09); --line-2:rgba(255,255,255,.17);
  --text:#EEF0F3; --text-2:#BCC2CC; --muted:#8A919C;
  --accent:#7AA7E0; --chip:#F4F6F9;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:'Heebo',system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.75;-webkit-font-smoothing:antialiased;padding:0 16px 64px;transition:background .18s,color .18s}
a{color:inherit}

.bar{position:sticky;top:0;z-index:20;max-width:var(--maxw);margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;background:var(--bg)}
.bar a.back{font-size:14px;color:var(--muted);text-decoration:none}
.bar a.back:hover{color:var(--text)}
.actions{display:flex;gap:8px;align-items:center}
.btn{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 14px;border-radius:8px;font:600 14px 'Heebo',sans-serif;text-decoration:none;cursor:pointer;border:1px solid var(--line-2);background:var(--paper);color:var(--text);transition:border-color .15s,color .15s,background .15s}
.btn:hover{border-color:var(--accent);color:var(--accent)}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.primary:hover{background:var(--text);border-color:var(--text);color:var(--paper)}
.btn svg{width:16px;height:16px}
.icon{width:36px;padding:0;justify-content:center}

.doc{max-width:var(--maxw);margin:0 auto;background:var(--paper);border:1px solid var(--line);border-radius:4px;padding:52px 64px 48px}
.head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding-bottom:20px;border-bottom:1px solid var(--line-2)}
.logo-chip{background:var(--chip);border-radius:4px;padding:6px 8px;display:inline-flex}
.logo-chip img{display:block;height:26px;width:auto}
.from{text-align:end;font-size:13px;line-height:1.55;color:var(--muted)}
.from b{display:block;color:var(--text);font-size:14.5px;font-weight:600}
.meta{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 24px;font-size:13px;color:var(--muted);padding-top:16px}
.kicker{font-size:12.5px;font-weight:600;letter-spacing:.06em;color:var(--accent);margin:34px 0 8px}
h1{font-size:30px;font-weight:700;letter-spacing:-.02em;line-height:1.3;margin-top:30px}
.sub{font-size:17px;color:var(--text-2);margin:10px 0 0;padding-bottom:26px;border-bottom:1px solid var(--line)}

.toc{margin:26px 0 6px;padding:18px 20px;background:var(--tint);border:1px solid var(--line);border-radius:4px}
.toc b{display:block;font-size:13px;font-weight:700;color:var(--muted);letter-spacing:.04em;margin-bottom:8px}
.toc ol{list-style:none;columns:2;column-gap:28px}
.toc li{break-inside:avoid;font-size:14px;line-height:1.5;padding:4px 0}
.toc a{color:var(--text-2);text-decoration:none}
.toc a:hover{color:var(--accent)}

h2{font-size:19px;font-weight:700;color:var(--text);letter-spacing:-.01em;margin:44px 0 16px;padding-bottom:9px;border-bottom:1px solid var(--line-2);scroll-margin-top:70px}
h3{font-size:16px;font-weight:700;color:var(--text);margin:26px 0 10px}
p{color:var(--text-2);margin-bottom:14px}
strong{color:var(--text);font-weight:600}
p.chain{font-size:15px;font-weight:600;color:var(--text);background:var(--tint-2);border:1px solid var(--line);border-radius:4px;padding:12px 16px;text-align:center}
p.chain strong{font-weight:600}

ul.bul,ol.num{margin:2px 0 18px;padding-inline-start:22px}
ul.bul li,ol.num li{color:var(--text-2);margin-bottom:6px;padding-inline-start:4px}
ul.bul li::marker{color:var(--accent)}
ol.num li::marker{color:var(--accent);font-weight:600}

.incl{list-style:none;display:grid;grid-template-columns:repeat(2,1fr);gap:0 28px;margin:2px 0 20px}
.incl li{position:relative;padding:8px 16px 8px 0;font-size:15px;color:var(--text-2);line-height:1.5;border-bottom:1px solid var(--line)}
.incl li::before{content:"";position:absolute;inset-inline-start:0;top:16px;width:5px;height:5px;border-radius:50%;background:var(--accent)}
.incl li b{display:block;color:var(--text);font-weight:600}
.incl li span{font-size:14px;color:var(--muted)}

.tbl-wrap{margin:6px 0 22px;overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:start;padding:10px 12px;border:1px solid var(--line-2);vertical-align:top;line-height:1.55}
thead th{background:var(--tint);font-weight:700;font-size:13px;color:var(--text);white-space:nowrap}
tbody td{color:var(--text-2)}
tbody td:first-child{font-weight:600;color:var(--text)}
table.wide{font-size:13.5px}

.callout{background:var(--tint);border:1px solid var(--line);border-inline-start:3px solid var(--accent);border-radius:4px;padding:14px 18px;margin:6px 0 18px}
.callout p{margin:0;color:var(--text-2)}

.sign{margin-top:44px;padding-top:22px;border-top:1px solid var(--line-2);font-size:14px;color:var(--muted);line-height:1.7;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
.sign b{display:block;color:var(--text);font-size:15.5px;font-weight:600}
.sign a{color:var(--text-2);text-decoration:none;border-bottom:1px solid var(--line-2)}
.sign a:hover{color:var(--accent)}

/* hub */
.docs{list-style:none;margin:10px 0 8px}
.docs li{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:18px 0;border-bottom:1px solid var(--line)}
.docs li:last-child{border-bottom:none}
.docs .n{font-size:12.5px;font-weight:700;color:var(--accent);letter-spacing:.06em}
.docs h3{margin:2px 0 4px;font-size:17px}
.docs h3 a{text-decoration:none}
.docs h3 a:hover{color:var(--accent)}
.docs p{margin:0;font-size:15px}
.docs .row-actions{display:flex;gap:8px;flex-shrink:0;padding-top:18px}

@media(max-width:720px){
  body{padding:0 12px 40px}
  .doc{padding:26px 18px 30px}
  h1{font-size:23px}
  .sub{font-size:15.5px}
  h2{font-size:17px;margin-top:34px}
  .head{flex-direction:column;gap:12px}
  .from{text-align:start}
  .toc ol{columns:1}
  .incl{grid-template-columns:1fr;gap:0}
  .btn .lbl-long{display:none}
  .docs li{flex-direction:column;gap:8px}
  .docs .row-actions{padding-top:0}
  thead{display:none}
  table,tbody,tr,td{display:block;width:100%}
  tr{border:1px solid var(--line-2);border-radius:4px;margin-bottom:10px;overflow:hidden}
  td{border:none;border-bottom:1px solid var(--line);padding:9px 12px}
  td:last-child{border-bottom:none}
  td::before{content:attr(data-l);display:block;font-size:11.5px;font-weight:700;color:var(--muted);letter-spacing:.04em;margin-bottom:1px}
  .tbl-wrap{overflow:visible}
}

@media print{
  @page{size:A4;margin:14mm 13mm 16mm}
  body{background:#fff;color:#000;padding:0;font-size:10pt;line-height:1.55}
  .bar{display:none}
  .doc{max-width:none;border:none;border-radius:0;padding:0;background:#fff}
  .kicker{color:#3F6FB0;margin-top:18pt}
  h1{font-size:20pt}
  .sub{font-size:11.5pt;color:#333}
  h2{font-size:13pt;color:#000;border-bottom:1px solid #999;margin:18pt 0 8pt;page-break-after:avoid;break-after:avoid}
  h3{font-size:11pt;page-break-after:avoid;break-after:avoid}
  p,li,td{color:#222}
  .meta,.from,.sign{color:#555}
  .toc{background:#f6f7f9;border:1px solid #ccc;page-break-inside:avoid}
  .toc a{color:#222}
  table{font-size:8.8pt}
  thead{display:table-header-group}
  tr{page-break-inside:avoid;break-inside:avoid}
  th,td{border:1px solid #999;padding:5pt 6pt}
  thead th{background:#eef1f5;color:#000}
  .tbl-wrap{overflow:visible}
  .incl li{border-bottom:1px solid #e3e3e3;page-break-inside:avoid}
  .incl li::before,ul.bul li::marker{background:#3F6FB0}
  .callout,p.chain{background:#f4f6f9;border:1px solid #bbb;page-break-inside:avoid}
  .callout{border-inline-start:3px solid #3F6FB0}
  .sign{page-break-inside:avoid;border-top:1px solid #999}
  .logo-chip{padding:0}
  a{text-decoration:none;color:#000}
}
`;

const ICON_DL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';

function page({ title, desc, body, back, pdf, logo, to }) {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="icon" href="${logo}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<div class="bar">
  ${back ? `<a class="back" href="${back}">→ ערכת המענה</a>` : `<span></span>`}
  <div class="actions">
    ${pdf ? `<a class="btn primary" href="${pdf}" download>${ICON_DL}<span>PDF</span><span class="lbl-long">&nbsp;להורדה</span></a>` : ''}
    <button class="btn icon" id="themeBtn" aria-label="החלפת מצב תצוגה">☾</button>
  </div>
</div>
<main class="doc">
  <div class="head">
    <div class="logo-chip"><img src="${logo}" alt="Boostart"></div>
    <div class="from"><b>שלומי זוין</b>Boostart · CTO as a Service<br>shlomi@boostart.io · 054-5567213</div>
  </div>
  <div class="meta"><div>${to ? '<b>לכבוד:</b> ' + esc(to) : esc(KICKER)}</div><div>${to ? DATE : DATE + ' · ' + VERSION}</div></div>
${body}
  <div class="sign">
    <div><b>שלומי זוין</b>Boostart · CTO as a Service</div>
    <div><a href="mailto:shlomi@boostart.io">shlomi@boostart.io</a> · <a href="tel:+972545567213">054-5567213</a></div>
  </div>
</main>
<script>
(function(){
  var root=document.documentElement,btn=document.getElementById('themeBtn'),K='boostart-gov-theme';
  function set(t){root.setAttribute('data-theme',t);btn.textContent=t==='dark'?'☀':'☾';try{localStorage.setItem(K,t)}catch(e){}}
  var s=null;try{s=localStorage.getItem(K)}catch(e){}
  set(s||'light');
  btn.addEventListener('click',function(){set(root.getAttribute('data-theme')==='dark'?'light':'dark')});
})();
</script>
</body>
</html>
`;
}

function buildDoc(d) {
  const standalone = !!d.to;
  const md = fs.readFileSync(path.join(SRC, d.key + '.md'), 'utf8');
  const { title, subtitle, blocks } = parse(md);
  const { html, toc } = render(blocks);
  // drop section numbers from the TOC text? keep them — evaluators cite by number
  const tocHtml = d.toc && toc.length > 4
    ? `<nav class="toc"><b>תוכן העניינים</b><ol>${toc.map(t => `<li><a href="#${t.id}">${inline(t.text)}</a></li>`).join('')}</ol></nav>`
    : '';
  const body = `  <h1>${inline(title)}</h1>\n  <p class="sub">${inline(subtitle)}</p>\n${tocHtml}\n${html}`;
  const dir = path.join(OUT, d.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page({ title: `${title} · Boostart`, desc: subtitle, body, back: standalone ? null : '../', pdf: d.pdf, logo: '../../boostart-logo.png', to: d.to }));
  d.title = title;
  console.log('built', d.slug);
}

function buildHub() {
  const txt = fs.readFileSync(path.join(SRC, 'hub.md'), 'utf8').replace(/\r/g, '');
  const get = k => { const m = txt.match(new RegExp('^' + k + ':\\s*(.+)$', 'm')); return m ? m[1].trim() : ''; };
  const items = DOCS.map((d, i) => `
    <li>
      <div>
        <div class="n">${String(i + 1).padStart(2, '0')}</div>
        <h3><a href="${d.slug}/">${inline(d.title)}</a></h3>
        <p>${inline(get('DOC ' + d.key))}</p>
      </div>
      <div class="row-actions">
        <a class="btn" href="${d.slug}/">לקריאה</a>
        <a class="btn" href="${d.slug}/${d.pdf}" download>${ICON_DL}PDF</a>
      </div>
    </li>`).join('');
  const body = `  <h1>${inline(get('TITLE'))}</h1>
  <p class="sub">${inline(get('SUBTITLE'))}</p>
  <div style="padding-top:22px"><p>${inline(get('INTRO'))}</p></div>
  <h2>המסמכים</h2>
  <ul class="docs">${items}</ul>
  <div class="callout"><p>${inline(get('NOTE'))}</p></div>`;
  fs.writeFileSync(path.join(OUT, 'index.html'), page({ title: `${get('TITLE')} · Boostart`, desc: get('SUBTITLE'), body, back: null, pdf: 'Boostart-Gov-Response-Kit.pdf', logo: '../boostart-logo.png' }));
  console.log('built hub');
}

DOCS.forEach(buildDoc);
buildDoc({ key: 'fit', slug: 'fit', pdf: 'Shlomi-Zevin-Tender-Fit.pdf', toc: false, to: 'יפעה ורדיגר' });
if (fs.existsSync(path.join(SRC, 'hub.md'))) buildHub();
fs.writeFileSync(path.join(__dirname, 'build', 'docs.json'), JSON.stringify(DOCS.map(d => ({ slug: d.slug, pdf: d.pdf })), null, 1));
