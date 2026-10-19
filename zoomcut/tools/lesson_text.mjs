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
    } else if (it.kind === 'overlay' && it.style === 'image') {
      // a story's picture in a framed box (the same look as the editor's)
      const im = document.createElement('img');
      im.src = 'file:///' + it.image_abs;
      Object.assign(im.style, { position: 'absolute', left: `${it.x ?? 60}px`, top: `${it.y ?? 380}px`, width: `${it.w ?? 960}px`, height: `${it.h ?? 540}px`,
        objectFit: 'cover', boxSizing: 'border-box' },
        it.plain ? { objectFit: 'contain' } : it.behind ? { borderRadius: '4px', filter: 'blur(1.2px) brightness(0.93) saturate(1.05)' }
          : { border: '6px solid #fff', borderRadius: '14px', boxShadow: '0 12px 34px rgba(0,0,0,0.55)' });
      d.appendChild(im);
      if (it.tag) {
        const tg = document.createElement('div');
        tg.textContent = it.tag;
        Object.assign(tg.style, { position: 'absolute', left: `${(it.x ?? 60) + 12}px`, top: `${(it.y ?? 380) + 12}px`, background: 'rgba(0,0,0,0.6)',
          color: '#fff', font: '700 22px "zc-assistant", "Segoe UI", sans-serif', padding: '3px 10px', borderRadius: '6px', direction: 'rtl' });
        d.appendChild(tg);
      }
    } else if (it.kind === 'overlay' && it.style === 'thought') {
      // a comic thought bubble: a soft white cloud, the thought inside, small circles trailing down toward the head
      const w = it.w || 760, size = it.size || 46, right = it.tail === 'right';
      Object.assign(d.style, { position: 'absolute', top: `${it.y ?? 260}px`, left: `${it.x ?? (1080 - w) / 2}px`, width: `${w}px` });
      const b = document.createElement('div');
      Object.assign(b.style, { background: '#ffffff', borderRadius: '999px', padding: `${Math.round(size * 0.8)}px ${Math.round(size * 1.3)}px`, textAlign: 'center',
        direction: 'rtl', color: '#1a1a1a', fontFamily: '"zc-assistant", "Segoe UI", sans-serif', fontWeight: '700', fontSize: `${size}px`, lineHeight: '1.25',
        boxShadow: '0 10px 30px rgba(0,0,0,0.30)' });
      b.textContent = it.text;
      d.appendChild(b);
      [[34, 30, 26], [22, 70, 18], [14, 100, 12]].forEach(([s, dy, x]) => {
        const c = document.createElement('div');
        Object.assign(c.style, { position: 'absolute', width: `${s}px`, height: `${s}px`, borderRadius: '50%', background: '#ffffff', top: `calc(100% + ${dy - s}px)`,
          [right ? 'right' : 'left']: `${x}%`, boxShadow: '0 4px 12px rgba(0,0,0,0.25)' });
        d.appendChild(c);
      });
    } else if (it.kind === 'overlay' && it.style === 'question') {
      // a follower's question as Instagram's question sticker: a dark bar with the small prompt, a white body
      const w = it.w || 860, size = it.size || 44;
      Object.assign(d.style, { position: 'absolute', top: `${it.y ?? 300}px`, left: `${it.x ?? (1080 - w) / 2}px`, width: `${w}px`,
        borderRadius: `${Math.round(size * 0.5)}px`, overflow: 'hidden', textAlign: 'center', direction: 'rtl',
        boxShadow: '0 6px 18px rgba(0,0,0,0.18)', fontFamily: '"Segoe UI", "zc-assistant", "Segoe UI Emoji", sans-serif' });
      const lb = document.createElement('div'), q = document.createElement('div');
      const ls = it.label_size || Math.round(size * 0.85);
      Object.assign(lb.style, { background: it.accent || '#262626', color: '#ffffff', fontWeight: '600', fontSize: `${ls}px`,
        padding: `${Math.round(ls * 0.62)}px ${Math.round(ls * 0.7)}px` });
      Object.assign(q.style, { background: '#ffffff', color: '#262626', fontWeight: '500', fontSize: `${size}px`, lineHeight: '1.32',
        padding: `${Math.round(size * 0.85)}px ${Math.round(size * 1.0)}px ${Math.round(size * 0.95)}px` });
      lb.textContent = it.label || 'שאלו אותי שאלה';
      q.textContent = it.text;
      if (it.variant === 'tiktok') {
        // TikTok's reply-to-comment sticker: a white bubble, the asker's round avatar and name, the comment in black
        Object.assign(d.style, { background: '#ffffff', borderRadius: `${Math.round(size * 0.6)}px`, overflow: 'visible', textAlign: 'right',
          padding: `${Math.round(size * 0.55)}px ${Math.round(size * 0.7)}px ${Math.round(size * 0.65)}px`, boxShadow: '0 6px 18px rgba(0,0,0,0.18)' });
        const hd = document.createElement('div'), av = document.createElement('div'), nm = document.createElement('div'), q2 = document.createElement('div');
        Object.assign(hd.style, { display: 'flex', alignItems: 'center', gap: `${Math.round(size * 0.35)}px`, marginBottom: `${Math.round(size * 0.35)}px` });
        Object.assign(av.style, { width: `${Math.round(size * 1.5)}px`, height: `${Math.round(size * 1.5)}px`, borderRadius: '50%', flex: 'none', background: it.avatar_color || '#c58b6b',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: `${Math.round(size * 0.75)}px` });
        Object.assign(nm.style, { color: '#8a8b91', fontWeight: '500', fontSize: `${Math.round(size * 0.72)}px` });
        Object.assign(q2.style, { color: '#161823', fontWeight: '600', fontSize: `${size}px`, lineHeight: '1.32' });
        av.textContent = (it.user || 'ש').replace('@', '').slice(0, 1).toUpperCase();
        nm.textContent = `השבה לתגובה של ${it.user || '@user'}`;
        q2.textContent = it.text;
        hd.append(av, nm);
        d.append(hd, q2);
      } else {
        d.append(lb, q);
      }
    } else if (it.kind === 'overlay' && it.style === 'band') {
      // a news lower third: a red tag (before "|") and a deep-blue band (after it), across the frame
      const [tag, ...rest] = String(it.text).split('|');
      const size = it.size || 46, hgt = Math.round(size * 1.9);
      Object.assign(d.style, { position: 'absolute', top: `${it.y ?? 1450}px`, left: '0', right: '0', height: `${hgt}px`, display: 'flex',
        direction: 'rtl', fontFamily: '"zc-assistant", "Segoe UI", sans-serif', fontWeight: '800', fontSize: `${size}px`, color: '#fff',
        borderTop: '4px solid #ffffff' });
      const t1 = document.createElement('div'), t2 = document.createElement('div');
      Object.assign(t1.style, { background: '#d0121b', padding: `0 ${Math.round(size * 0.6)}px`, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' });
      Object.assign(t2.style, { background: `rgba(10,38,92,${it.opacity ?? 0.94})`, flex: '1', padding: `0 ${Math.round(size * 0.55)}px`, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden' });
      t1.textContent = rest.length ? tag.trim() : '';
      t2.textContent = (rest.length ? rest.join('|') : tag).trim();
      if (!rest.length) t1.style.display = 'none';
      d.append(t1, t2);
    } else if (it.kind === 'overlay') {
      // the same box as ZoomCall's ovBoxStyle: light / dark / gold, box opacity, size
      const op = it.opacity ?? 1, size = it.size || 46, gold = it.theme === 'gold', light = it.theme === 'light' || !it.theme;
      Object.assign(d.style, { position: 'absolute', top: `${it.y ?? 270}px`, left: '60px', right: '60px', display: 'flex', justifyContent: 'center' });
      const b = document.createElement('div');
      Object.assign(b.style, {
        background: light ? `rgba(255,255,255,${op})` : `rgba(0,0,0,${op})`, color: gold ? '#FFD60A' : it.theme === 'dark' ? '#fff' : '#000',
        fontSize: `${size}px`, lineHeight: '1.25', padding: `${it.padY ?? 12}px ${it.padX ?? 24}px`, borderRadius: '14px', textAlign: 'center', maxWidth: '940px',
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
  if (it.kind === 'overlay' && it.style === 'image') {  // the picture loaded before the shot
    await p.waitForFunction(() => { const i = document.querySelector('#stage img'); return i && i.complete && i.naturalWidth > 0; }, { timeout: 15000 });
  }
  if (it.kind === 'overlay' && it.style === 'ticker') {
    const el = await p.$('#tick');
    await el.screenshot({ path: it.out, omitBackground: true });  // just the strip
  } else {
    await p.screenshot({ path: it.out, omitBackground: true });
  }
}
await b.close();
console.log(`rendered ${spec.items.length} text layers`);
