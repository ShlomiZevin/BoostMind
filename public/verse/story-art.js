// A story's picture and its text boxes, drawn the same way everywhere: the viewer (stories.js), /backstage/ (the gallery
// and the designer) and the sessions' preview (scripts/stories/preview.mjs). His rules (2026-11-04):
// - the story is designed on a 9:16 stage that always fits the screen whole - never wider than it, so no side of the
//   picture (and none of its words) is lost; the space around it is the same picture, blurred, in its own colours;
// - its words are boxes laid out on the stage (style, font, size, colour, place), never one block over everything;
// - nothing sits on anything else: the stage lives between the name bar and the button (--top / --bot on .sa, set by
//   the viewer), never under them, on any screen; on the stage, boxes never cover the picture's own words or faces;
// - a visitor can always see the story without its words (the viewer's button / holding a finger on it).
// A box: { t: words (\n = new line), x, y: its centre in % of the stage, w: its widest in % of the stage's width,
//   s: letter size in % of the stage's width, st: style (STYLES), f: font (FONTS), c: text colour, bg: box / outline
//   colour ('char' = the character's colour), al: right | center | left, r: turn in degrees, wt: weight, tail: bubble's
//   tail (br | bl | tr | tl | none) }. A story without `boxes` (from before 2026-11-04) shows its `text` as one box.
export const STYLES = {
  box: { label: 'קופסה', c: '#111111', bg: '#ffffff' },
  glass: { label: 'זכוכית כהה', c: '#ffffff', bg: 'rgba(12,12,16,.6)' },
  line: { label: 'מרקר על השורות', c: '#111111', bg: '#ffffff' },
  outline: { label: 'קו מתאר', c: '#ffffff', bg: '#111111' },
  shadow: { label: 'טקסט עם צל', c: '#ffffff' },
  bubble: { label: 'בועת דיבור', c: '#111111', bg: '#ffffff' },
  note: { label: 'פתק', c: '#3a2a14', bg: '#fff4c9', f: 'amatic', r: -2, wt: 700 },
  tag: { label: 'תגית', c: '#ffffff', bg: 'char' },
};
// [the CSS family, the Google Fonts family to load] - every one of them has Hebrew
export const FONTS = {
  heebo: ["'Heebo'", 'Heebo:wght@400;700;800;900', 'היבו - רגיל'],
  rubik: ["'Rubik'", 'Rubik:wght@400;700;900', 'רוביק - עגול'],
  secular: ["'Secular One'", 'Secular+One', 'סקולר - כותרת'],
  suez: ["'Suez One'", 'Suez+One', 'סואץ - כותרת עם סריפים'],
  frank: ["'Frank Ruhl Libre'", 'Frank+Ruhl+Libre:wght@400;700;900', 'פרנק רוהל - ספר / פסוק'],
  amatic: ["'Amatic SC'", 'Amatic+SC:wght@400;700', 'אמטיק - כתב יד'],
  karantina: ["'Karantina'", 'Karantina:wght@400;700', 'קרנטינה - צר / פוסטר'],
  varela: ["'Varela Round'", 'Varela+Round', 'ורלה - עגול ורך'],
};
export const COLORS = ['#ffffff', '#111111', '#ff6a1f', '#ffd23f', '#22c55e', '#3b82f6', '#e11d48', '#a855f7', '#fff4c9', 'char'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const col = (v, d) => (v === 'char' ? 'var(--c,#ff6a1f)' : /^#[0-9a-f]{3,8}$/i.test(v || '') ? v : /^rgba?\([\d.,\s%]+\)$/.test(v || '') ? v : d === 'char' ? 'var(--c,#ff6a1f)' : d);

// a box with every default filled in (the same numbers the server keeps)
export function normBox(b = {}) {
  const st = STYLES[b.st] ? b.st : 'box', S = STYLES[st];
  return { t: String(b.t || ''), x: num(b.x, 50, 0, 100), y: num(b.y, 50, 0, 100), w: num(b.w, 80, 10, 100), s: num(b.s, 6, 2, 22), st,
    f: FONTS[b.f] ? b.f : S.f || 'heebo', c: b.c || S.c, bg: b.bg || S.bg || '', al: ['right', 'center', 'left'].includes(b.al) ? b.al : 'center',
    r: num(b.r, S.r || 0, -30, 30), wt: [400, 700, 800, 900].includes(Number(b.wt)) ? Number(b.wt) : S.wt || 800, tail: ['br', 'bl', 'tr', 'tl', 'none'].includes(b.tail) ? b.tail : 'br' };
}
// the boxes a story shows: its own, or its old one-line text as one box at the bottom
export function boxesOf(x) {
  if (Array.isArray(x.boxes)) return x.boxes.map(normBox);
  if (!x.text) return [];
  return [normBox(x.media ? { t: x.text, y: 76, w: 88, s: 5.4, st: 'glass', al: 'right' } : { t: x.text, y: 50, w: 86, s: 7, st: 'shadow' })];
}
// how long a story stays on screen: by the words a visitor reads
export const readMs = (x) => Math.min(16000, 3500 + boxesOf(x).reduce((n, b) => n + b.t.length, 0) * 42);

function boxHtml(b, i) {
  const vars = [`left:${b.x}%`, `top:${b.y}%`, `width:${b.w}%`, `--s:${b.s}`, `--f:${FONTS[b.f][0]}`, `--tc:${col(b.c, '#fff')}`,
    `--bg:${col(b.bg, 'transparent')}`, `--al:${b.al}`, `--r:${b.r}deg`, `--wt:${b.wt}`].join(';');
  return `<div class="sa-b sa-${b.st}${b.st === 'bubble' ? ' sa-t-' + b.tail : ''}" data-box="${i}" style="${vars}"><span class="sa-in">${esc(b.t)}</span></div>`;
}

// the story's art: the blurred fill, the stage with the picture / clip (or the character's colour), the boxes
export function stageHtml(x, o = {}) {
  const m = x.media, url = m ? esc(m.url) : '';
  const fill = m?.kind === 'image' ? `<img class="sa-fill" src="${url}" alt=""${o.lazy ? ' loading="lazy"' : ''}>` : '<div class="sa-fill sa-tint"></div>';
  const media = m?.kind === 'video' ? `<video class="sa-media" src="${url}" playsinline${o.autoplay ? ' autoplay' : ''}${o.muted ? ' muted' : ''}${o.loop ? ' loop' : ''}${o.controls ? ' controls' : ''} preload="metadata"></video>`
    : m?.kind === 'image' ? `<img class="sa-media" src="${url}" alt=""${o.lazy ? ' loading="lazy"' : ''}>` : '<div class="sa-media sa-tint"></div>';
  const boxes = boxesOf(x);
  loadFonts(boxes);
  return `<div class="sa"${o.color ? ` style="--c:${esc(o.color)}"` : ''}>${fill}<div class="sa-area"><div class="sa-stage">${media}<div class="sa-boxes">${boxes.map(boxHtml).join('')}</div></div></div></div>`;
}

// the fonts the boxes use, once per page
const loaded = new Set(['heebo']);
export function loadFonts(boxes) {
  if (typeof document === 'undefined') return;
  const need = [...new Set(boxes.map((b) => b.f))].filter((f) => !loaded.has(f) && FONTS[f]);
  if (!need.length) return;
  need.forEach((f) => loaded.add(f));
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?' + need.map((f) => 'family=' + FONTS[f][1]).join('&') + '&display=swap';
  document.head.append(l);
}
export const allFontsReady = () => (typeof document !== 'undefined' && document.fonts ? document.fonts.ready : Promise.resolve());

// the look, in one place (injected once)
const CSS = `
.sa{position:absolute;inset:0;overflow:hidden;background:#0b0b0e;direction:rtl}
.sa-area{position:absolute;inset-inline:0;top:var(--top,0px);bottom:var(--bot,0px);container-type:size}
.sa-fill{position:absolute;inset:-10%;width:120%;height:120%;object-fit:cover;filter:blur(32px) saturate(1.25) brightness(.6)}
.sa-tint{background:radial-gradient(circle at 30% 20%,color-mix(in srgb,var(--c,#ff6a1f) 55%,#000),#0b0b0e 75%)}
.sa-stage{position:absolute;left:50%;top:50%;translate:-50% -50%;width:min(100cqw,56.25cqh);aspect-ratio:9/16;container-type:inline-size;overflow:hidden}
.sa-media{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.sa-boxes{position:absolute;inset:0;transition:opacity .2s;pointer-events:none}
.sa-b{position:absolute;translate:-50% -50%;rotate:var(--r,0deg);font-family:var(--f),'Heebo',sans-serif;font-size:calc(var(--s,6)*1cqw);font-weight:var(--wt,800);line-height:1.3;color:var(--tc);text-align:var(--al,center);white-space:pre-wrap;overflow-wrap:break-word}
.sa-in{display:inline-block;max-width:100%;position:relative;text-align:var(--al,center)}
.sa-box .sa-in{background:var(--bg);padding:.36em .62em;border-radius:.42em;box-shadow:0 .25em .9em rgba(0,0,0,.28)}
.sa-glass .sa-in{background:var(--bg);padding:.42em .7em;border-radius:.5em;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.sa-line .sa-in{display:inline;background:var(--bg);padding:.06em .34em;border-radius:.22em;line-height:1.55;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.sa-outline{--o:var(--bg);text-shadow:.07em 0 var(--o),-.07em 0 var(--o),0 .07em var(--o),0 -.07em var(--o),.05em .05em var(--o),-.05em .05em var(--o),.05em -.05em var(--o),-.05em -.05em var(--o),0 .14em .3em rgba(0,0,0,.45)}
.sa-shadow{text-shadow:0 .06em .45em rgba(0,0,0,.85),0 0 .12em rgba(0,0,0,.7)}
.sa-bubble .sa-in{background:var(--bg);padding:.5em .78em;border-radius:1.05em;box-shadow:0 .25em .9em rgba(0,0,0,.28)}
.sa-bubble .sa-in::after{content:'';position:absolute;width:.95em;height:.85em;background:var(--bg)}
.sa-t-br .sa-in::after{bottom:-.7em;right:1.1em;clip-path:polygon(0 0,100% 0,100% 100%)}
.sa-t-bl .sa-in::after{bottom:-.7em;left:1.1em;clip-path:polygon(0 0,100% 0,0 100%)}
.sa-t-tr .sa-in::after{top:-.7em;right:1.1em;clip-path:polygon(100% 0,100% 100%,0 100%)}
.sa-t-tl .sa-in::after{top:-.7em;left:1.1em;clip-path:polygon(0 0,100% 100%,0 100%)}
.sa-t-none .sa-in::after{display:none}
.sa-note .sa-in{background:var(--bg);padding:.4em .75em .5em;border-radius:.12em;box-shadow:0 .3em .9em rgba(0,0,0,.3);line-height:1.15}
.sa-tag .sa-in{background:var(--bg);padding:.22em .8em;border-radius:99px;line-height:1.25}
`;
if (typeof document !== 'undefined' && !document.getElementById('sa-css')) {
  const s = document.createElement('style');
  s.id = 'sa-css';
  s.textContent = CSS;
  document.head.append(s);
}
