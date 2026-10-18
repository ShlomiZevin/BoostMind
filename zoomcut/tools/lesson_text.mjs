// Render the lesson template's text layers as transparent 1080x1920 PNGs (title, plaque, captions).
//   node tools/lesson_text.mjs <spec.json>
// spec: { fontsDir, items: [{ out, kind: "title"|"plaque"|"caption", text | lines }] }
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from '../render/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const fonts = path.resolve(spec.fontsDir).replace(/\\/g, '/');
const chrome = new URL('../render/node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe', import.meta.url).pathname.slice(1);

// every font in fonts/fonts.json, under the editor's names (zc-<id>) — text on video looks the same everywhere
const fontList = JSON.parse(fs.readFileSync(path.join(spec.fontsDir, 'fonts.json'), 'utf8'));
const faces = fontList.filter((f) => f.file).map((f) => `@font-face { font-family: "zc-${f.id}"; src: url('file:///${fonts}/${f.file}'); font-weight: ${f.weight}; }`).join(String.fromCharCode(10));
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Stam; src: url('file:///${fonts}/stamashkenazclm-webfont.ttf'); }
@font-face { font-family: Assistant; src: url('file:///${fonts}/Assistant.ttf'); font-weight: 800; }
${faces}
/* Stam sets letters tight and the thick outline fuses neighbours ("זו" read as one letter): a little air */
#stage .caption, #stage .title span { letter-spacing: 0.045em; }
html, body { margin: 0; width: 1080px; height: 1920px; background: transparent; overflow: hidden; }
#stage { position: absolute; inset: 0; direction: rtl; }
.title { position: absolute; top: 150px; left: 50px; right: 50px; text-align: center; }
.title span { display: inline; background: #0d0d0d; color: #FFD60A; font: 64px/1.32 Stam; padding: 6px 22px;
  box-decoration-break: clone; -webkit-box-decoration-break: clone; border-radius: 10px; }
.plaque { position: absolute; text-align: center; color: #1f1103; font-family: Stam; line-height: 1.12; letter-spacing: 0.03em;
  text-shadow: 0 2px 0 rgba(255,236,170,0.65), 0 -1px 0 rgba(60,35,5,0.5); }  /* engraved: dark letters, light lower edge */
.caption { position: absolute; left: 50px; right: 50px; text-align: center; font: 84px/1.18 Stam; color: #FFD60A;
  -webkit-text-stroke: 14px #000; paint-order: stroke fill; text-shadow: 0 6px 14px rgba(0,0,0,0.55); }
</style></head><body><div id="stage"></div></body></html>`;
const page_file = path.join(path.dirname(path.resolve(process.argv[2])), '_text.html');
fs.writeFileSync(page_file, html);

const b = await puppeteer.launch({ executablePath: chrome, args: ['--allow-file-access-from-files'] });
const p = await b.newPage();
await p.setViewport({ width: 1080, height: 1920 });
await p.evaluate(() => { document.body.style.width = 'auto'; document.documentElement.style.width = 'auto'; });
await p.goto('file:///' + page_file.replace(/\\/g, '/'));
await p.evaluate(async (ids) => { await document.fonts.load('64px Stam'); for (const id of ids) await document.fonts.load(`46px "zc-${id}"`); }, fontList.filter((f) => f.file).map((f) => f.id));
await p.evaluate(() => document.fonts.ready);
for (const it of spec.items) {
  await p.evaluate((it) => {
    const s = document.getElementById('stage');
    s.innerHTML = '';
    const d = document.createElement('div');
    if (it.kind === 'title') {
      d.className = 'title';
      if (it.y != null) d.style.top = `${it.y}px`;
      const sp = document.createElement('span');
      sp.textContent = it.text;
      d.appendChild(sp);
    } else if (it.kind === 'overlay') {
      // the same box as ZoomCall's ovBoxStyle: light / dark / gold, box opacity, size
      const op = it.opacity ?? 1, size = it.size || 46, gold = it.theme === 'gold', light = it.theme === 'light' || !it.theme;
      Object.assign(d.style, { position: 'absolute', top: `${it.y ?? 270}px`, left: '60px', right: '60px', display: 'flex', justifyContent: 'center' });
      const b = document.createElement('div');
      Object.assign(b.style, {
        background: light ? `rgba(255,255,255,${op})` : `rgba(0,0,0,${op})`, color: gold ? '#FFD60A' : it.theme === 'dark' ? '#fff' : '#000',
        fontSize: `${size}px`, lineHeight: '1.25', padding: '12px 24px', borderRadius: '14px', textAlign: 'center', maxWidth: '940px',
        fontFamily: it.font && it.font !== 'system' ? `"zc-${it.font}", "Segoe UI", sans-serif` : '"Segoe UI", Arial, sans-serif',
        fontWeight: ['system', 'arimo', 'assistant'].includes(it.font || 'system') ? '800' : '400',
        letterSpacing: gold ? '0.045em' : '', textShadow: op < 0.6 ? (light ? '0 1px 4px rgba(255,255,255,0.7)' : '0 2px 6px rgba(0,0,0,0.8)') : '',
        whiteSpace: 'pre-line',  // the line breaks you typed stay
      });
      if (it.style === 'ticker') {  // one line, as long as it needs to be - it scrolls across the frame
        Object.assign(d.style, { left: '0', right: 'auto', top: '0', display: 'block' });
        Object.assign(b.style, { whiteSpace: 'nowrap', maxWidth: 'none', background: 'transparent', padding: '0 40px', borderRadius: '0',
          fontFamily: `"zc-${it.font || 'assistant'}", "Segoe UI Emoji", "Segoe UI", sans-serif` });
        b.id = 'tick';
      }
      if (gold) { b.style.webkitTextStroke = `${Math.round(size * 0.17)}px #000`; b.style.paintOrder = 'stroke fill'; }
      b.textContent = it.text;
      d.appendChild(b);
    } else if (it.kind === 'plaque') {
      d.className = 'plaque';
      Object.assign(d.style, { left: `${it.x - it.w / 2}px`, width: `${it.w}px`, top: `${it.y}px` });
      if (it.h) Object.assign(d.style, { height: `${it.h}px`, display: 'flex', flexDirection: 'column', justifyContent: 'center' });  // centred in its box
      it.lines.forEach((t, i) => {
        const l = document.createElement('div');
        l.textContent = t;
        l.style.fontSize = `${i === 0 ? it.size : Math.round(it.size * 0.8)}px`;
        d.appendChild(l);
      });
    } else {
      d.className = 'caption';
      d.style.top = `${it.y}px`;
      const st = it.style || {};  // per series: {font, color, stroke, size, weight} - default is the yellow Stam
      if (st.font) d.style.fontFamily = `"zc-${st.font}", "Segoe UI", sans-serif`;
      if (st.size) d.style.fontSize = `${st.size}px`;
      if (st.weight) d.style.fontWeight = String(st.weight);
      if (st.color) d.style.color = st.color;
      if (st.stroke != null) d.style.webkitTextStroke = `${st.stroke}px #000`;
      if (st.font) d.style.letterSpacing = '0';
      d.textContent = it.text;
    }
    s.appendChild(d);
    if (it.kind === 'plaque') {  // every line fits the plate: shrink until it does
      for (const l of d.children) {
        l.style.whiteSpace = 'nowrap';
        let fs = parseFloat(l.style.fontSize);
        while (l.scrollWidth > Math.ceil(it.w) + 1 && fs > 12) { fs -= 1; l.style.fontSize = `${fs}px`; }
      }
    }
  }, it);
  if (it.kind === 'overlay' && it.style === 'ticker') {
    const el = await p.$('#tick');
    await el.screenshot({ path: it.out, omitBackground: true });  // just the strip
  } else {
    await p.screenshot({ path: it.out, omitBackground: true });
  }
}
await b.close();
console.log(`rendered ${spec.items.length} text layers`);
