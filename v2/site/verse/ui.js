// The pieces every new screen is built from (one of each - see verse.css): icons, the sheet, the card, the toast,
// avatars, time. No emoji anywhere.
const s = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${extra}>${d}</svg>`;
export const I = {
  // the logo's planet without its word (the full logo can't be read at like-button size): a back ring, the planet, the
  // ring's front arc over it. Strokes follow the text colour, so off = dim, on = orange (verse.css)
  planet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" class="pl"><g transform="rotate(-16 12 12)"><path d="M1.5 12.6A10.5 4.3 0 0 1 22.5 12.6" stroke-width="2.4"/><circle cx="12" cy="12" r="7.6" fill="var(--pl-fill, #141218)" stroke-width="2"/><path d="M1.5 12.6A10.5 4.3 0 0 0 22.5 12.6" stroke-width="2.8"/></g></svg>`,
  sticker: s('<path d="M20 12.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6.5"/><path d="M20 12.5 12.5 20c0-4.1 3.4-7.5 7.5-7.5z"/>'),
  comment: s('<path d="M20.5 12a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1.1-4.3A8.5 8.5 0 1 1 20.5 12z"/>'),
  save: s('<path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.2-6.5 4.2v-16a1 1 0 0 1 1-1z"/>'),
  saved: s('<path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.2-6.5 4.2v-16a1 1 0 0 1 1-1z" fill="currentColor"/>'),
  share: s('<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1"/>'),
  bell: s('<path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>'),
  user: s('<circle cx="12" cy="8" r="4"/><path d="M4 20.5c.9-4 4.1-6.5 8-6.5s7.1 2.5 8 6.5"/>'),
  person: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4.2"/><path d="M3.5 21c.8-4.4 4.2-7 8.5-7s7.7 2.6 8.5 7z"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="3.8" height="14" rx="1"/><rect x="13.7" y="5" width="3.8" height="14" rx="1"/></svg>',
  x: s('<path d="M6 6l12 12M18 6 6 18"/>', ' stroke-width="2"'),
  back: s('<path d="m9 6 6 6-6 6"/>', ' stroke-width="2.2"'),
  next: s('<path d="m15 6-6 6 6 6"/>', ' stroke-width="2.2"'),
  check: s('<path d="m5 12.5 4.5 4.5L19 7.5"/>', ' stroke-width="2.6"'),
  moon: s('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>'),
  bug: s('<path d="M8.5 8.5a3.5 3.5 0 0 1 7 0"/><rect x="7" y="8.5" width="10" height="11" rx="5"/><path d="M12 12v7.5M4 13h3M17 13h3M5 8l2.5 2M19 8l-2.5 2M5 19l2.5-2M19 19l-2.5-2"/>'),
  minus: s('<path d="M5 12h14"/>', ' stroke-width="2.2"'),
  plus: s('<path d="M12 5v14M5 12h14"/>', ' stroke-width="2.2"'),
  send: s('<path d="M5 12h14M13 6l6 6-6 6"/>', ' stroke-width="2.4"'),
  heartless: '',
  sound: s('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  install: s('<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 7.5v7M9 11.5l3 3 3-3"/>'),
  out: s('<path d="M14 4.5h4.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H14"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15"/>'),
  edit: s('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  copy: s('<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>'),
  download: s('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>'),
  people: s('<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 19.5c.7-3.4 3.3-5.5 6.5-5.5s5.8 2.1 6.5 5.5"/><path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.3c2 .7 3.5 2.6 4 5.2"/>'),
  safariShare: s('<path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M8 10.5H6.5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H16"/>'),
  addSquare: s('<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M12 8.5v7M8.5 12h7"/>'),
  camera: s('<path d="M4 8.5a1.5 1.5 0 0 1 1.5-1.5h2.2l1.6-2.2h5.4l1.6 2.2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.8" r="3.4"/>'),
  dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>',
  google: '<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2A9.8 9.8 0 0 0 3.6 17l-1.4 4.8 4.9-1.3A9.8 9.8 0 1 0 12 2.2zm0 17.8a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.2.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11 11 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.5 2.5 0 0 0 1.7-1.2 2 2 0 0 0 .1-1.2c0-.2-.2-.2-.4-.3z"/></svg>',
};

// the like / stamp: the real logo, grey until it's theirs, lit up orange when it is (verse.css .lk)
export const LIKE = '<img class="lk" src="/verse/logo-160.png" alt="" draggable="false">';
export const $ = (q, el = document) => el.querySelector(q);
export const $$ = (q, el = document) => [...el.querySelectorAll(q)];
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const track = (e, x) => window.track && window.track(e, x);
// his wordmark: שלומי in white, וורס in orange - text only (the planet is only the home-screen icon)
export const wordmark = (tag) => `<span class="vx-wordmark"><span>שלומי<b>וורס</b></span>${tag ? `<small>${tag}</small>` : ''}</span>`;

// the wiki's own data (W, C, V, S live in the page's classic script)
export const wiki = () => ({ W, C: C, V: V, S: S });
export const charColor = (id) => (C[id] && C[id].color) || '#ff6a1f';
// the wiki's images are relative to /wiki/
export const abs = (p) => (!p ? '' : /^(https?:|\/)/.test(p) ? p : '/wiki/' + p);

// a face: a character's portrait, a fan's Google photo or their initial, or the planet for the Shlomiverse itself
export function av({ char, fan, planet, ring, cls = '' } = {}) {
  if (planet) return `<span class="vx-av planet ${cls}">${I.planet}</span>`;
  if (char) {
    const c = C[char];
    const img = c && c.img ? `<img src="${abs(c.img)}" alt="${esc(c.name)}" loading="lazy">` : `<span style="color:${charColor(char)}">${esc((c?.name || '?')[0])}</span>`;
    return `<span class="vx-av ${ring ? 'ring' : ''} ${cls}" style="--c:${charColor(char)}">${img}</span>`;
  }
  if (fan && fan.photo) return `<span class="vx-av ${cls}"><img src="${esc(fan.photo)}" alt="" referrerpolicy="no-referrer" loading="lazy"></span>`;
  const n = (fan && fan.nick) || '?';
  const hue = [...n].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360;
  return `<span class="vx-av ${cls}" style="background:hsl(${hue} 35% 30%)">${esc(n.trim()[0] || '?')}</span>`;
}

export function ago(t) {
  const ms = t?.toMillis ? t.toMillis() : typeof t === 'number' ? t : Date.now();
  const m = Math.max(0, (Date.now() - ms) / 60000);
  if (m < 1) return 'עכשיו';
  if (m < 60) return `לפני ${Math.round(m)} דק'`;
  const h = m / 60;
  if (h < 24) return h < 1.5 ? 'לפני שעה' : h < 2.5 ? 'לפני שעתיים' : `לפני ${Math.round(h)} שעות`;
  const d = h / 24;
  if (d < 7) return ['יום א\'', 'יום ב\'', 'יום ג\'', 'יום ד\'', 'יום ה\'', 'יום ו\'', 'שבת'][new Date(ms).getDay()];
  return new Date(ms).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}
export const mmss = (s) => { s = Math.max(0, Math.floor(s || 0)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

// ---- the sheet, the card, the toast: one of each, used everywhere ----
function layer(el, back, onClose) {
  document.body.append(back, el);
  requestAnimationFrame(() => { back.classList.add('open'); el.classList.add('open'); });
  let closed = false;
  const close = (why) => {
    if (closed) return;
    closed = true;
    back.classList.remove('open'); el.classList.remove('open');
    setTimeout(() => { el.remove(); back.remove(); }, 320);
    document.removeEventListener('keydown', esc_);
    if (onClose) onClose(why);
  };
  const esc_ = (e) => { if (e.key === 'Escape') close('esc'); };
  document.addEventListener('keydown', esc_);
  back.onclick = () => close('back');
  el.addEventListener('click', (e) => { if (e.target.closest('[data-vx-close]')) close('x'); });
  return { el, close };
}
export function sheet(html, { cls = '', onClose } = {}) {
  const back = Object.assign(document.createElement('div'), { className: 'vx-back' });
  const el = Object.assign(document.createElement('div'), { className: `vx-sheet ${cls}` });
  el.innerHTML = `<div class="grab"></div>${html}`;
  // drag the handle down to close
  let y0 = null;
  el.querySelector('.grab').addEventListener('pointerdown', (e) => { y0 = e.clientY; });
  addEventListener('pointerup', (e) => { if (y0 !== null && e.clientY - y0 > 60) h.close('drag'); y0 = null; });
  const h = layer(el, back, onClose);
  return h;
}
// the card in the middle lies on the blurred screen behind it (mockup C); `x: false` = no close button, only its own link
export function card(html, { cls = '', onClose, x = true } = {}) {
  const back = Object.assign(document.createElement('div'), { className: 'vx-back blur' });
  const el = Object.assign(document.createElement('div'), { className: `vx-card ${cls}` });
  el.innerHTML = `${x ? `<button class="vx-x" data-vx-close aria-label="סגירה">${I.x}</button>` : ''}${html}`;
  document.body.classList.add('vx-carded');
  return layer(el, back, (why) => { document.body.classList.remove('vx-carded'); if (onClose) onClose(why); });
}
let toastEl, toastTimer;
export function toast(text, ms = 2400) {
  if (!toastEl) { toastEl = Object.assign(document.createElement('div'), { className: 'vx-toast' }); document.body.append(toastEl); }
  toastEl.textContent = text;
  toastEl.classList.add('open');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('open'), ms);
}

// a character's short stamp line (the like on stickers): its shortest real catchphrase
export function stampText(char) {
  const c = C[char];
  const q = (c?.quotes || []).map((x) => x.replace(/^[״"]|[״".!?]+$/g, '').trim()).filter((x) => x && x.length <= 22).sort((a, b) => a.length - b.length);
  return q[0] || c?.name || 'שלומיוורס';
}
// the sticker's default text: a catchphrase that fits on a sticker
export function catchphrase(char) {
  const c = C[char];
  const q = (c?.quotes || []).map((x) => x.replace(/^[״"]|[״"]$/g, '').replace(/[.]+$/, '').trim()).filter((x) => x && x.length <= 34);
  return q[0] || '';
}

export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isAndroid = () => /Android/.test(navigator.userAgent);
export const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
// TikTok / Instagram / Facebook in-app browsers: Google refuses to sign in there
export const inApp = () => /musical_ly|bytedance|BytedanceWebview|TikTok|Instagram|FBAN|FBAV|FB_IAB|Line\//i.test(navigator.userAgent);
