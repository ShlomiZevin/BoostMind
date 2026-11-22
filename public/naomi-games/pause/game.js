// השהיית תגובה - Dr. Naomi-Tzipora's managers' app (Fruit Ninja, our version).
// Swipe the manager's harmful messages before they reach the new employee; let the bonding ones land; never swipe his
// golden message. His inner needle is the health bar: 3 times red = resignation. A round = one work week in 75 s.
'use strict';
const SLUG = 'pause';
const $ = (id) => document.getElementById(id);
const KEYS = { best: `shlomiverse:${SLUG}:best`, day: `shlomiverse:${SLUG}:day`, tut: `shlomiverse:${SLUG}:tut`, snd: `shlomiverse:${SLUG}:snd` };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - Math.pow(1 - t, 3);

// ---------- the day's seed: the same week for everyone each Israeli day ----------
function israelDay() {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); }
}
function hash(s) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let R = rng(hash(SLUG + '|' + israelDay()));
const pick = (arr, r = R) => arr[Math.floor(r() * arr.length)];

// ---------- the words ----------
const HARM = ['מה הסטטוס עם המשימה?', 'נו?', '??', 'יש עדכון?', 'מה קורה עם זה?', 'דחוף!!', 'הלקוח מחכה', 'רק מזכירה', 'איפה אנחנו עם זה?', 'אפשר עדכון עד הצהריים?', 'ראית את ההודעה שלי?', 'צריך את זה אתמול', 'למה זה עוד לא אצלי?', 'אני מחכה...'];
const STATUS = new Set(['מה הסטטוס עם המשימה?', 'יש עדכון?', 'מה קורה עם זה?', 'איפה אנחנו עם זה?', 'אפשר עדכון עד הצהריים?', 'למה זה עוד לא אצלי?']);
const SNEAKY = ['מה שלומך עם המשימה?', 'בלי לחץ, אבל מתי?', 'רק בודקת שהכול בסדר עם הדדליין', 'אני כאן בשבילך. מה הסטטוס?', 'קח את הזמן, עד חמש'];
const BOND = ['איך עולה לך היום?', 'אני כאן בשבילך', 'קח את הזמן', 'גאה בך', 'מה אתה צריך ממני?', 'איך אתה מרגיש עם זה?', 'אתה לא לבד', 'ספר לי מה עובר עליך', 'בוקר טוב, איך ישנת?', 'מותר לא לדעת'];
const GOLD = 'אני לא יודע איך להתחיל את המשימה.';
// what each message does to him - a thought bubble when it lands: the reason to swipe / not to swipe
const REACT_HARM = ['פותח צ׳אט ג׳י־פי־טי לפרש את ההודעה', 'מנסח מכתב התפטרות', 'בטוח שמפטרים אותו', 'מתחיל לנסח תלונה למשאבי אנוש', 'נכנס למצב הישרדותי', 'שומע ״נו״ שלא נכתב'];
const REACT_BOND = ['מרגיש שרואים אותו', 'נושם סוף סוף', 'ההתקשרות מתחזקת', 'כמעט פותח את המשימה', 'מרגיש בטוח'];
const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳'];
const DAY_SUB = ['אדומה – מחליקים. ורודה – נותנים לה להגיע.', 'הלקוח התחיל לשאול', 'ה״נו״ שלא כתבתם מתחיל להופיע', 'יותר הודעות, יותר מהר', 'יום חמישי. הלקוח מחכה.'];
const STRIKES = ['התקף חרדה', 'תלונה למשאבי אנוש', 'מכתב התפטרות'];
const STRIKE_SAY = ['הוא נכנס להתקף חרדה.', 'הוא הגיש תלונה למשאבי אנוש על התעמרות.', 'הוא התפטר.'];
const SAY = {
  start: ['מה עולה אצלך ברגע הזה?', 'בכל פעם שעולה הדחף לשלוח – קודם כול לעצור.'],
  streak: ['תראו, מה שאנחנו רואים כאן... זה ויסות.', 'המממ... זה מרגש. וזה גם אמיץ.', 'אתם מכילים את חוסר הוודאות שלכם. יפה.', 'עוד עצירה. המחוג שלו נרגע.', 'זו בדיוק עצירה לפני תגובה.'],
  hit: ['הוא מרגיש את ה״נו״ שלא כתבתם.', 'זה הלחץ שלכם. למה שהוא יווסת לכם אותו?', 'ילד מרגיש הכול.', 'עובד בלי התקשרות בטוחה חווה את זה כמתקפה.'],
  cutBond: ['את זה דווקא היה צריך לשלוח. זו התקשרות.', 'רגע. זו הייתה הודעה של בונדינג.'],
  bond: ['זה סקין טו סקין רגשי.', 'ככה נבנית התקשרות ראשונית.', 'הנה, המחוג שלו מתכוונן.'],
  nu: ['ה״נו״ שלא כתבתם – הוא עדיין שם.'],
  gold: ['רגע! הוא מנסה לבטא קושי. לא לגעת!'],
  goldIn: ['הוא כתב לכם מיוזמתו. זו הצלחה אדירה.'],
  cutGold: ['הוא ניסה לבטא קושי – ונחסם.'],
  breath: ['לעצור. לזהות מה עולה.'],
  rush: ['הלקוח מחכה. ודווקא עכשיו – לעצור.'],
};
const dayParams = [
  { gap: 1.1, rise: 2.6, burst: .12, bond: .33 },
  { gap: .9, rise: 2.4, burst: .24, bond: .35 },
  { gap: .78, rise: 2.2, burst: .32, sneaky: .15, bond: .36 },
  { gap: .68, rise: 2.05, burst: .4, sneaky: .3, bond: .38 },
  { gap: .58, rise: 1.9, burst: .48, sneaky: .35, bond: .38 },
];
const DAY_LEN = 15, WEEK = DAY_LEN * 5;

// ---------- pictures ----------
const IMG = {};
const IMG_LIST = ['bg.jpg', 'msg-cut.webp', 'msg-keep.webp', 'msg-gold.webp', 'breath.webp', 'gauge.webp', 'needle.webp',
  'emp-calm.webp', 'emp-worried.webp', 'emp-panic.webp', 'emp-relieved.webp', 'face/naomi-coach.webp', 'face/naomi-heart.webp', 'face/naomi-concern.webp'];
function loadImages() {
  return Promise.all(IMG_LIST.map((f) => new Promise((res) => {
    const im = new Image(); im.onload = () => { IMG[f.split('.')[0]] = im; res(); }; im.onerror = res; im.src = 'assets/' + f;
  })));
}

// ---------- sound (files may be missing - then silent) ----------
const SND = { ctx: null, buf: {}, on: store.get(KEYS.snd) !== '0', last: {}, music: null, master: null };
const SFX = { buzz: 3, whoosh: 4, pop: 3, warm: 2, hit: 2, heart: 1, strike: 3, golden: 1, breath: 1, tick: 1, rush: 1, win: 1, lose: 1, tap: 2, music: 1, amb: 1 };
function sndInit() {
  if (SND.ctx) return;
  try { SND.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  SND.master = SND.ctx.createGain(); SND.master.gain.value = SND.on ? 1 : 0; SND.master.connect(SND.ctx.destination);
  for (const [n, k] of Object.entries(SFX)) for (let i = 1; i <= k; i++) {
    const name = k === 1 && n !== 'strike' ? n : n + i;
    fetch(`assets/sfx/${name}.mp3`).then((r) => r.ok ? r.arrayBuffer() : null).then((ab) => ab && SND.ctx.decodeAudioData(ab))
      .then((b) => { if (b) { (SND.buf[n] = SND.buf[n] || []).push({ name, b }); if (n === 'music') musicStart(); if (n === 'amb') ambStart(); } }).catch(() => {});
  }
}
function sndWake() {
  sndInit(); const c = SND.ctx; if (!c) return;
  if (c.state !== 'running') { c.resume && c.resume().catch(() => {}); try { const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0); } catch (e) {} }
}
function play(n, vol = 1, rate = 1, which) {
  const list = SND.buf[n]; if (!SND.ctx || !list || !list.length || !SND.on) return;
  let cands = which ? list.filter((x) => x.name === which) : list;
  if (cands.length > 1) cands = cands.filter((x) => x.name !== SND.last[n]);
  const it = cands[Math.floor(Math.random() * cands.length)] || list[0]; SND.last[n] = it.name;
  const s = SND.ctx.createBufferSource(), g = SND.ctx.createGain(); s.buffer = it.b; s.playbackRate.value = rate * (G.slow > 0 ? .8 : 1); g.gain.value = vol;
  s.connect(g); g.connect(SND.master); s.start();
}
function musicStart() {
  if (!SND.buf.music || SND.music || !SND.ctx) return;
  const s = SND.ctx.createBufferSource(), g = SND.ctx.createGain(); s.buffer = SND.buf.music[0].b; s.loop = true; g.gain.value = .32;
  s.connect(g); g.connect(SND.master); s.start(); SND.music = { s, g };
}
function ambStart() {   // a quiet room tone under everything
  if (!SND.buf.amb || SND.amb || !SND.ctx) return;
  const s = SND.ctx.createBufferSource(), g = SND.ctx.createGain(); s.buffer = SND.buf.amb[0].b; s.loop = true; g.gain.value = .35;
  s.connect(g); g.connect(SND.master); s.start(); SND.amb = { s, g };
}
function setSound(on) {
  SND.on = on; store.set(KEYS.snd, on ? 1 : 0); if (SND.master) SND.master.gain.value = on ? 1 : 0;
  document.querySelectorAll('.sndBtn').forEach((b) => b.classList.toggle('off', !on));
}
// her voice lines: assets/vo/<key>-<i>.mp3 (made later with ElevenLabs) - played with the strip's words when present
const VO = {};
function voLoad() {
  for (const [k, arr] of Object.entries(SAY)) arr.forEach((_, i) => {
    fetch(`assets/vo/${k}-${i}.mp3`).then((r) => r.ok ? r.arrayBuffer() : null).then((ab) => ab && SND.ctx && SND.ctx.decodeAudioData(ab)).then((b) => { if (b) VO[k + '-' + i] = b; }).catch(() => {});
  });
}
let voNow = null;
function voPlay(key) {
  const b = VO[key]; if (!b || !SND.ctx || !SND.on) return;
  try { voNow && voNow.stop(); } catch (e) {}
  const s = SND.ctx.createBufferSource(), g = SND.ctx.createGain(); s.buffer = b; g.gain.value = 1; s.connect(g); g.connect(SND.master); s.start(); voNow = s;
  if (SND.music) SND.music.g.gain.setTargetAtTime(.12, SND.ctx.currentTime, .1), setTimeout(() => SND.music && SND.music.g.gain.setTargetAtTime(.32, SND.ctx.currentTime, .3), b.duration * 1000);
}

// ---------- layout ----------
const cv = $('cv'), ctx = cv.getContext('2d');
const L = {};
function cssPx(v) { const p = document.createElement('div'); p.style.cssText = `position:fixed;visibility:hidden;height:${v}`; document.body.appendChild(p); const h = p.getBoundingClientRect().height; p.remove(); return h; }
function layout() {
  const W = innerWidth, H = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  L.W = W; L.H = H; L.dpr = dpr;
  L.colW = W <= 560 ? W : Math.min(520, Math.max(H * .62, 360)); document.body.classList.toggle('narrow', L.colW < 380); L.colX = (W - L.colW) / 2;
  L.top = cssPx('var(--safe-t)'); L.bot = cssPx('var(--safe-b)');
  L.hudB = L.top + 52;
  const short = H < 600; document.body.classList.toggle('short', short);
  L.bandH = short ? clamp(H * .17, 62, 100) : clamp(H * .17, 96, 168); L.bandT = L.hudB + 4; L.line = L.bandT + L.bandH;
  L.stripT = H - L.bot - 6 - (short ? 46 : 58);
  L.fs = clamp(L.colW * .052, 16, 21);
  // employee bust (left), gauge (right)
  const eh = L.bandH - 6; L.emp = { h: eh, x: L.colX + 10, y: L.line - eh };
  L.gw = Math.min(clamp(L.colW * .4, 120, 190), (L.bandH - 30) * 422 / 218); L.gh = L.gw * 218 / 422;
  L.gx = L.colX + L.colW - L.gw - 12; L.gy = L.line - L.gh - 10;
  L.face = { x: L.colX + 10 + eh * .34, y: L.line - eh * .62 };
  document.documentElement.style.setProperty('--colw', L.colW + 'px');
  // turn the phone: by the PHONE's orientation (inside the verse the frame itself can be wider than tall)
  const so = screen.orientation && screen.orientation.type, land = so ? so.startsWith('landscape') : screen.width > screen.height;
  document.body.classList.toggle('turn', W > H && land && Math.min(screen.width, screen.height) < 500 && matchMedia('(hover:none)').matches);
  if (document.body.classList.contains('turn') && G.mode === 'play') pauseGame();
  cardCache.clear();
}
addEventListener('resize', layout); addEventListener('verseframe', layout);

// ---------- cards: painted pieces scaled whole (the spikes / cloud never stretch), the words in code inside each face ----------
// red spiky + pause badge = swipe it; pink cloud + heart = let it land; gold + star = his message. Same colours all week.
const cardCache = new Map();
const CARD = {   // painted piece, its empty face (fractions of the picture), text colour
  red: { img: 'msg-cut', face: [.15, .26, .71, .76], color: '#fff', stroke: '#8a0a1c', tag: 'להשהות!', tagBg: '#7a0a1c', tagFg: '#fff' },
  warm: { img: 'msg-keep', face: [.09, .2, .7, .8], color: '#7a1f3d', stroke: null, tag: 'לתת להגיע', tagBg: '#fff', tagFg: '#c0306b' },
  gold: { img: 'msg-gold', face: [.09, .16, .7, .84], color: '#5a1430', stroke: null, tag: 'לא לגעת', tagBg: '#5a1430', tagFg: '#ffd36b' },
};
CARD.nu = Object.assign({}, CARD.red, { alpha: .72, tag: null });
function cardSprite(kind, text) {
  const key = kind + '|' + text + '|' + L.colW; if (cardCache.has(key)) return cardCache.get(key);
  const spec = CARD[kind], img = IMG[spec.img], dpr = L.dpr, ar = img ? img.height / img.width : .5;
  const [fx0, fy0, fx1, fy1] = spec.face, fw = fx1 - fx0, fh = fy1 - fy0;
  const m = document.createElement('canvas').getContext('2d');
  const fontAt = (f) => `900 ${f}px Rubik, system-ui, sans-serif`;
  let fs = L.fs * (kind === 'nu' ? 1.1 : 1); m.font = fontAt(fs);
  const minW = L.colW * (kind === 'nu' ? .3 : .44), maxW = L.colW * .8;
  let lines = [text], tw = m.measureText(text).width;
  let w = clamp(tw / fw + fs * .8, minW, maxW);
  if (tw > w * fw * .94) {   // too long for one line: two lines, then shrink until it fits
    const ws = text.split(' '); let best = null;
    for (let i = 1; i < ws.length; i++) { const p = ws.slice(0, i).join(' '), q = ws.slice(i).join(' '), ww = Math.max(m.measureText(p).width, m.measureText(q).width); if (!best || ww < best.ww) best = { p, q, ww }; }
    if (best) { lines = [best.p, best.q]; tw = best.ww; w = clamp(tw / fw + fs * .8, minW, maxW); }
  }
  let h = w * ar;
  const tagH = spec.tag ? Math.round(L.fs * 1.15) : 0;   // the instruction tag rides on the card's top edge
  while ((tw > w * fw * .94 || lines.length * fs * 1.18 > h * fh) && fs > 11) { fs -= .5; m.font = fontAt(fs); tw = Math.max(...lines.map((l) => m.measureText(l).width)); }
  const top = tagH * .55, H2 = h + top;
  const c = document.createElement('canvas'); c.width = Math.ceil(w * dpr); c.height = Math.ceil(H2 * dpr);
  const g = c.getContext('2d'); g.scale(dpr, dpr); g.translate(0, top);
  if (spec.alpha) g.globalAlpha = spec.alpha;
  if (img) g.drawImage(img, 0, 0, w, h);
  g.globalAlpha = 1;
  g.font = fontAt(fs); g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const cx = w * (fx0 + fx1) / 2, cy = h * (fy0 + fy1) / 2, lh = fs * 1.15;
  lines.forEach((ln, i) => {
    const y = cy + (i - (lines.length - 1) / 2) * lh + 1;
    if (spec.stroke) { g.lineJoin = 'round'; g.lineWidth = Math.max(3, fs * .2); g.strokeStyle = spec.stroke; g.strokeText(ln, cx, y); }
    g.fillStyle = spec.color; g.fillText(ln, cx, y);
  });
  if (spec.tag) {   // the rule on the piece itself
    const tf = tagH * .62; g.font = `900 ${tf}px Rubik, system-ui, sans-serif`;
    const tw2 = g.measureText(spec.tag).width + tf * 1.4, tx = w * .5 - tw2 / 2, ty = -top;
    g.fillStyle = spec.tagBg; g.strokeStyle = spec.tagFg; g.lineWidth = 2;
    g.beginPath(); if (g.roundRect) g.roundRect(tx, ty, tw2, tagH, tagH / 2); else g.rect(tx, ty, tw2, tagH); g.fill(); g.stroke();
    g.fillStyle = spec.tagFg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(spec.tag, w * .5, ty + tagH / 2 + 1);
  }
  const out = { c, w, h: H2 }; cardCache.set(key, out); return out;
}

// ---------- state ----------
const G = {
  mode: 'menu', t: 0, day: 0, score: 0, needle: 0, strikes: 0, streak: 0, best: 0, paused: 0, longest: 0, anx: 0, hr: 0,
  goldIn: 0, goldCut: 0, slow: 0, spawnT: 0, hold: 0, cards: [], bits: [], pops: [], trail: [], banner: null, flash: 0, shake: 0,
  face: 'calm', faceT: 0, glow: 0, sched: [], tut: null, over: false, won: false, rushSaid: false, heartT: 0, sayT: 0,
};
let nextId = 1;
function mkCard(type, text, opts = {}) {
  const P = dayParams[G.day] || dayParams[0];
  const white = false;
  const kind = type === 'harm' ? 'red' : type === 'bond' ? 'warm' : type === 'gold' ? 'gold' : type === 'nu' ? 'nu' : 'breath';
  const spr = type === 'breath' ? null : cardSprite(kind, text);
  const w = spr ? spr.w : L.fs * 3.6, h = spr ? spr.h : L.fs * 3.6;
  const minX = L.colX + w / 2 + 6, maxX = L.colX + L.colW - w / 2 - 6;
  const x = opts.x != null ? opts.x : lerp(minX, maxX, R());
  const c = { id: nextId++, type, text, kind, spr, w, h, x, y: 0, vx: (R() - .5) * 40, vy: 0, g: 0, rot: (R() - .5) * .16, vr: (R() - .5) * .25, age: 0, state: 'fly', hover: opts.hover, sneaky: !!opts.sneaky, white };
  if (type === 'gold') { c.y = L.line + 6; c.vy = 26; c.g = 14; c.vx = 0; c.vr = 0; }
  else {
    const y0 = opts.y0 != null ? opts.y0 : L.H + h / 2 + 10, apex = L.line - (opts.apexUp != null ? opts.apexUp : 18 + R() * 40), ta = (opts.rise || P.rise) * (.9 + R() * .2);
    const D = y0 - apex; c.y = y0; c.g = 2 * D / (ta * ta); c.vy = -2 * D / ta;
  }
  if (opts.hover) { c.hy = opts.hover; c.y = L.H + h; c.vy = 0; c.g = 0; c.vx = 0; }
  G.cards.push(c); play('buzz', .45); return c;
}

// ---------- the week's schedule (seeded) ----------
function planWeek() {
  G.sched = [{ t: .5, type: 'introHarm' }, { t: 3.2, type: 'introBond' }];
  for (let d = 0; d < 5; d++) {
    if (d >= 1) G.sched.push({ t: d * DAY_LEN + 3 + R() * 8, type: 'breath' });
    if (d === 1 || d === 3 || d === 4) G.sched.push({ t: d * DAY_LEN + 4 + R() * 7, type: 'gold' });
  }
  G.sched.sort((a, b) => a.t - b.t);
}
function spawnOne() {
  const P = dayParams[G.day];
  if (R() < P.bond) { mkCard('bond', pick(BOND)); return; }
  if (P.sneaky && R() < P.sneaky) { mkCard('harm', pick(SNEAKY), { sneaky: true }); return; }
  mkCard('harm', pick(HARM));
}

// ---------- the round ----------
function startGame() {
  R = rng(hash(SLUG + '|' + israelDay()));
  Object.assign(G, { mode: 'play', t: 0, day: 0, score: 0, needle: 0, strikes: 0, streak: 0, paused: 0, longest: 0, anx: 0, hr: 0, goldIn: 0, goldCut: 0, slow: 0, spawnT: .7, hold: 0,
    cards: [], bits: [], pops: [], trail: [], flash: 0, shake: 0, face: 'calm', faceT: 0, glow: 0, over: false, won: false, rushSaid: false, tut: null, sayT: 0, react: null, demo: null });
  planWeek(); showScreen(null); $('hud').classList.add('on'); $('strip').classList.add('on');
  updHud(); dayBanner(0); say(pick(SAY.start), 'start');
  window.track && window.track('game_start', SLUG);
}
function dayBanner(d) { G.banner = { big: 'יום ' + DAYS[d], sub: DAY_SUB[d], t: 0, dur: 1.7 }; play('tick', .6); }
let sayKey = '';
function say(text, key, loud) {
  const el = $('say'); el.textContent = text; el.classList.toggle('loud', !!loud); G.sayT = 2.6;
  if (key) { const arr = SAY[key]; const i = arr ? arr.indexOf(text) : -1; if (i >= 0) voPlay(key + '-' + i); }
}
function sayMaybe(key, loud) { if (G.sayT > 0 && !loud) return; say(pick(SAY[key]), key, loud); }
function pop(x, y, text, color = '#fff', size = 1) { G.pops.push({ x, y, text, color, size, t: 0 }); }
function setFace(f, hold = 1.2) { G.face = f; G.faceT = hold; }
function react(text, bad) { G.react = { text, bad, t: 0 }; pop(L.gx + L.gw / 2, L.gy + L.gh * .7, bad ? '+לחץ' : '−לחץ', bad ? '#ff6b7f' : '#7dffb5', .85); }
function addScore(n, x, y) { G.score += n; if (x != null) pop(x, y - 20, '+' + n, '#ffd36b', .9); updHud(); }
function mult() { return Math.min(5, 1 + Math.floor(G.streak / 4)); }
function breakStreak() { G.streak = 0; updHud(); }

function onSliced(c, ang) {
  c.state = 'cut';
  splitCard(c, ang);
  const tut = G.tut;
  if (G.demo) G.demo = null;
  if (c.type === 'harm' || c.type === 'nu') {
    G.streak++; G.longest = Math.max(G.longest, G.streak); G.paused++;
    if (!tut) addScore((c.type === 'nu' ? 5 : 10) * mult(), c.x, c.y);
    pop(c.x, c.y + 10, 'הושהה', '#fff', 1.15); burst(c.x, c.y, c.kind === 'red' ? '#ff5a6e' : '#ffe1d6', 22);
    play('pop', .8, 1 + Math.min(G.streak, 12) * .025);
    if (G.streak > 0 && G.streak % 6 === 0) sayMaybe('streak');
    if (mult() > 1 && G.streak % 4 === 0) { pop(L.colX + L.colW / 2, L.line + 60, 'השהיה רצופה x' + mult(), '#ffd36b', 1.3); bumpCombo(); }
    if (c.type === 'harm' && STATUS.has(c.text) && G.day >= 2 && !tut) {
      setTimeout(() => { if (G.mode === 'play' && !G.over) { const n = mkCard('nu', 'נו', { x: clamp(c.x + (R() - .5) * 60, L.colX + 40, L.colX + L.colW - 40), y0: c.y + 30, apexUp: 10, rise: 1.5 }); n.vy *= .8; if (R() < .25) sayMaybe('nu'); } }, 260);
    }
  } else if (c.type === 'bond') {
    burst(c.x, c.y, '#ffd9a8', 14); play('hit', .6);
    if (!tut) { G.needle = Math.min(1, G.needle + .2); breakStreak(); pop(c.x, c.y, 'פגעת בהתקשרות', '#ff8a9a', 1); sayMaybe('cutBond', true); G.flash = .25; checkStrike(); }
  } else if (c.type === 'gold') {
    burst(c.x, c.y, '#ffd36b', 20); play('hit', .7);
    if (!tut) { G.goldCut++; G.needle = Math.min(1, G.needle + .3); breakStreak(); pop(c.x, c.y, 'הוא ניסה לבטא קושי', '#ff8a9a', 1); say(pick(SAY.cutGold), 'cutGold', true); G.flash = .3; checkStrike(); }
  } else if (c.type === 'breath') {
    burst(c.x, c.y, '#8ff0c4', 26); play('breath', .8); G.slow = 4; pop(c.x, c.y, 'נשימה', '#c9ffe6', 1.2); say(SAY.breath[0], 'breath');
  }
  if (tut) tut.onEvent('cut', c);
}
function onLanded(c) {
  const tut = G.tut;
  if (c.type === 'harm' || c.type === 'nu') {
    play('hit', .8); G.shake = .35; G.flash = .35; setFace('worried', 1); react(pick(REACT_HARM, Math.random), true);
    if (!tut) { G.needle = Math.min(1, G.needle + (c.type === 'nu' ? .15 : .3)); breakStreak(); sayMaybe('hit'); checkStrike(); }
  } else if (c.type === 'bond') {
    play('warm', .7); G.glow = 1; setFace('relieved', 1.1); burst(L.face.x, L.face.y, '#ffd9a8', 12); react(pick(REACT_BOND, Math.random), false);
    if (!tut) { G.needle = Math.max(0, G.needle - .15); addScore(20, L.face.x + 40, L.face.y); sayMaybe('bond'); }
  } else if (c.type === 'gold') {
    play('golden', .9); G.glow = 1.4; setFace('relieved', 2); burst(c.x, c.y, '#ffd36b', 40);
    if (!tut) { G.goldIn++; G.needle = Math.max(0, G.needle - .4); addScore(200, c.x, c.y - 30); pop(c.x, c.y - 70, 'הבעת קושי!', '#ffd36b', 1.5); say(SAY.goldIn[0], 'goldIn'); }
  }
  if (tut) tut.onEvent('land', c);
}
function checkStrike() {
  if (G.needle < 1 || G.over) return;
  const k = G.strikes; G.strikes++; if (k === 0) G.anx++; if (k === 1) G.hr++;
  play('strike', .9, 1, 'strike' + (k + 1)); G.shake = .7; G.flash = .7; setFace('panic', 1.8);
  G.banner = { big: STRIKES[k], sub: '', t: 0, dur: 1.6, bad: true }; say(STRIKE_SAY[k], null, true);
  updHud();
  if (G.strikes >= 3) { endGame(false); return; }
  G.needle = .4; G.hold = 1.5;
  for (const c of G.cards) if (c.state === 'fly' && (c.type === 'harm' || c.type === 'nu')) { c.state = 'fade'; c.ft = 0; }
}
function endGame(won) {
  if (G.over) return; G.over = true; G.won = won; G.mode = 'ending';
  setTimeout(showOver, won ? 600 : 1500);
  if (won) { play('win', .9); burst(L.colX + L.colW / 2, L.H * .45, '#ffd36b', 60); }
  else play('lose', .8);
}

// ---------- effects ----------
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 280; G.bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: .5 + Math.random() * .5, t: 0, r: 2 + Math.random() * 4, color, star: Math.random() < .3 }); }
}
function splitCard(c, ang) {
  if (!c.spr && c.type !== 'breath') return;
  const nx = -Math.sin(ang), ny = Math.cos(ang);   // normal to the cut
  for (const side of [-1, 1]) G.bits.push({ half: true, side, ang, src: c, x: c.x, y: c.y, vx: c.vx + nx * side * 140, vy: c.vy * .3 + ny * side * 140 - 80, rot: c.rot, vr: side * (1.5 + Math.random()), t: 0, life: .7 });
}
function bumpCombo() { const b = $('comboBox'); b.classList.add('bump'); setTimeout(() => b.classList.remove('bump'), 180); }

// ---------- input: the swipe ----------
const ptr = { down: false, x: 0, y: 0, t: 0, strokeCuts: 0, id: null };
function cardHit(c, x0, y0, x1, y1) {
  // segment vs the card's rotated box (Liang-Barsky in the card's frame)
  const cs = Math.cos(-c.rot), sn = Math.sin(-c.rot);
  const tx = (x, y) => [(x - c.x) * cs - (y - c.y) * sn, (x - c.x) * sn + (y - c.y) * cs];
  const [ax, ay] = tx(x0, y0), [bx, by] = tx(x1, y1);
  const hw = c.w / 2 + 6, hh = (c.type === 'breath' ? c.h / 2 : c.h * .34) + 8;
  let t0 = 0, t1 = 1; const dx = bx - ax, dy = by - ay;
  for (const [p, q] of [[-dx, ax + hw], [dx, hw - ax], [-dy, ay + hh], [dy, hh - ay]]) {
    if (p === 0) { if (q < 0) return false; } else { const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } }
  }
  return true;
}
function onDown(e) {
  sndWake(); if (G.mode !== 'play' && G.mode !== 'tut') return;
  ptr.down = true; ptr.id = e.pointerId; ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = performance.now(); ptr.strokeCuts = 0;
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  G.trail = [{ x: ptr.x, y: ptr.y, t: ptr.t }];
}
function onMove(e) {
  if (!ptr.down || e.pointerId !== ptr.id) return;
  const now = performance.now(), x = e.clientX, y = e.clientY, dx = x - ptr.x, dy = y - ptr.y, d = Math.hypot(dx, dy), dt = Math.max(1, now - ptr.t);
  if (d < 3) return;
  G.trail.push({ x, y, t: now }); if (G.trail.length > 24) G.trail.shift();
  if (d / dt > .3 && !G.tutFrozen) {
    if (d > 26 && Math.random() < .5) play('whoosh', .35);
    const ang = Math.atan2(dy, dx);
    for (const c of G.cards) if (c.state === 'fly' && cardHit(c, ptr.x, ptr.y, x, y)) { onSliced(c, ang); ptr.strokeCuts++; }
  }
  ptr.x = x; ptr.y = y; ptr.t = now;
}
function onUp(e) {
  if (e.pointerId !== ptr.id) return;
  ptr.down = false;
  if (ptr.strokeCuts >= 3 && G.mode === 'play' && !G.tut) { const n = ptr.strokeCuts; addScore(n * 10, ptr.x, ptr.y); pop(ptr.x, ptr.y - 50, 'קומבו ' + n + '!', '#ffb3c1', 1.3); bumpCombo(); }
  ptr.strokeCuts = 0;
}
cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove);
cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp);
document.addEventListener('pointerdown', sndWake, true);

// ---------- update ----------
function update(dtReal) {
  const dt = dtReal * (G.slow > 0 ? .45 : 1);
  if (G.slow > 0) G.slow -= dtReal;
  if (G.sayT > 0) G.sayT -= dtReal;
  if (G.banner) { G.banner.t += dtReal; if (G.banner.t > G.banner.dur) G.banner = null; }
  G.flash = Math.max(0, G.flash - dtReal * 1.6); G.shake = Math.max(0, G.shake - dtReal); G.glow = Math.max(0, G.glow - dtReal * 1.2);
  if (G.faceT > 0) { G.faceT -= dtReal; if (G.faceT <= 0) G.face = ''; }
  if (G.react) { G.react.t += dtReal; if (G.react.t > 1.9) G.react = null; }
  if (G.demo) G.demo.t += dtReal;
  const playing = G.mode === 'play' && !G.over;
  if (playing) {
    G.t += dt;
    const d = Math.min(4, Math.floor(G.t / DAY_LEN));
    if (d !== G.day) { G.day = d; dayBanner(d); updHud(); }
    if (G.t >= WEEK) { endGame(true); }
    G.needle = Math.max(0, G.needle - .03 * dt);
    if (G.hold > 0) G.hold -= dt;
    else {
      while (G.sched.length && G.sched[0].t <= G.t) { const s = G.sched.shift();
        if (s.type === 'introHarm') { G.demo = { id: mkCard('harm', 'מה הסטטוס עם המשימה?', { x: L.colX + L.colW / 2, rise: 3.2 }).id, t: 0 }; continue; }
        if (s.type === 'introBond') { mkCard('bond', 'איך עולה לך היום?', { x: L.colX + L.colW / 2, rise: 3.2 }); continue; }
        if (s.type === 'gold') { mkCard('gold', GOLD, { x: L.colX + L.colW * (.3 + R() * .4) }); say(SAY.gold[0], 'gold'); } else mkCard('breath', ''); }
      const rush = G.day === 4 && G.t > WEEK - 4.5;
      if (rush && !G.rushSaid) { G.rushSaid = true; G.banner = { big: 'הלקוח מחכה!', sub: '', t: 0, dur: 1.3, bad: true }; play('rush', .7); say(SAY.rush[0], 'rush'); }
      if (G.t < 5.5) G.spawnT = Math.max(G.spawnT, .1);   // the opening shows the two kinds alone
      G.spawnT -= dt;
      const live = G.cards.filter((c) => c.state === 'fly').length;
      if (G.spawnT <= 0 && live < 8) {
        const P = dayParams[G.day];
        spawnOne(); if (R() < P.burst) { spawnOne(); if (R() < P.burst * .5) spawnOne(); }
        G.spawnT = (rush ? .42 : P.gap) * (.8 + R() * .4);
      }
    }
    // heartbeat when the needle is near red
    if (G.needle > .6) { G.heartT -= dtReal; if (G.heartT <= 0) { play('heart', .5 + G.needle * .4); G.heartT = 1.05 - G.needle * .45; } }
  }
  if (playing || G.mode === 'tut' || G.mode === 'ending') {
    for (const c of G.cards) {
      c.age += dt;
      if (c.state === 'fly') {
        if (c.hy != null) { c.y = lerp(c.y, c.hy + Math.sin(c.age * 2.4) * 5, Math.min(1, dt * 4)); c.rot = Math.sin(c.age * 1.6) * .04; }
        else {
          if (G.tutFrozen) continue;
          c.vy += c.g * dt; c.y += c.vy * dt; c.x += c.vx * dt; c.rot += c.vr * dt * .3;
          const minX = L.colX + c.w / 2 + 4, maxX = L.colX + L.colW - c.w / 2 - 4;
          if (c.x < minX) { c.x = minX; c.vx = Math.abs(c.vx); } if (c.x > maxX) { c.x = maxX; c.vx = -Math.abs(c.vx); }
          if (c.type === 'gold') { if (c.y > L.stripT - c.h * .3) { c.state = 'landed'; onLanded(c); } }
          else if (c.type === 'breath') { if (c.y < L.line + c.h * .2 || (c.vy > 0 && c.y > L.H + c.h)) { c.state = 'fade'; c.ft = 0; } }
          else if (c.y < L.line + 4) { c.state = 'deliver'; c.dt0 = 0; c.dx0 = c.x; c.dy0 = c.y; }
          else if (c.vy > 0 && c.y > L.H + c.h) c.state = 'gone';
        }
      } else if (c.state === 'deliver') {
        c.dt0 += dtReal / .22; if (c.dt0 >= 1) { c.state = 'gone'; onLanded(c); }
      } else if (c.state === 'fade') { c.ft += dtReal * 3; if (c.ft >= 1) c.state = 'gone'; }
    }
    G.cards = G.cards.filter((c) => c.state !== 'gone' && c.state !== 'cut' && c.state !== 'landed');
  }
  for (const b of G.bits) { b.t += dtReal; b.vy += (b.half ? 900 : 500) * dtReal; b.x += b.vx * dtReal; b.y += b.vy * dtReal; if (b.half) b.rot += b.vr * dtReal; }
  G.bits = G.bits.filter((b) => b.t < b.life);
  for (const p of G.pops) p.t += dtReal; G.pops = G.pops.filter((p) => p.t < 1.1);
  const now = performance.now(); G.trail = G.trail.filter((p) => now - p.t < 160);
  if (playing && G.mode === 'play') updHud(true);
  if (G.tut) G.tut.tick(dtReal);
}

// ---------- draw ----------
function drawCover(im, x, y, w, h) {
  if (!im) return; const s = Math.max(w / im.width, h / im.height), iw = im.width * s, ih = im.height * s;
  ctx.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}
function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
function drawCardAt(c, x, y, rot, scale = 1, alpha = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(scale, scale); ctx.globalAlpha = alpha;
  if (c.type === 'breath') {
    const im = IMG.breath, r = c.w; ctx.shadowColor = '#5fd3a0'; ctx.shadowBlur = 18;
    if (im) ctx.drawImage(im, -r / 2, -r / 2, r, r);
  } else {
    if (c.type === 'gold') { ctx.shadowColor = '#ffd36b'; ctx.shadowBlur = 26 + Math.sin(c.age * 6) * 8; }
    ctx.drawImage(c.spr.c, -c.w / 2, -c.h / 2, c.w, c.h);
  }
  ctx.restore();
}
function draw() {
  const { W, H } = L;
  ctx.save();
  if (G.shake > 0) ctx.translate((Math.random() - .5) * 14 * G.shake, (Math.random() - .5) * 14 * G.shake);
  ctx.fillStyle = '#3a0d20'; ctx.fillRect(-20, -20, W + 40, H + 40);
  ctx.save(); ctx.beginPath(); ctx.rect(L.colX, 0, L.colW, H); ctx.clip();
  drawCover(IMG.bg, L.colX, 0, L.colW, H);
  // a soft wash so the cards read
  const gr = ctx.createLinearGradient(0, L.line, 0, H); gr.addColorStop(0, '#fdf6f222'); gr.addColorStop(1, '#5a143044'); ctx.fillStyle = gr; ctx.fillRect(L.colX, L.line, L.colW, H - L.line);
  if (G.slow > 0) { ctx.fillStyle = `rgba(95,211,160,${.12 * Math.min(1, G.slow)})`; ctx.fillRect(L.colX, 0, L.colW, H); }
  ctx.restore();
  // the employee's chat header (glass)
  ctx.save();
  rrect(L.colX + 6, L.bandT, L.colW - 12, L.bandH, 20); ctx.fillStyle = '#fff7f3d0'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = G.needle > .7 ? `rgba(224,38,63,${.5 + Math.sin(performance.now() / 120) * .3})` : '#f0c9bd'; ctx.stroke();
  ctx.clip();
  if (G.glow > 0) { const rg = ctx.createRadialGradient(L.face.x, L.face.y, 4, L.face.x, L.face.y, L.bandH); rg.addColorStop(0, `rgba(255,211,107,${.6 * Math.min(1, G.glow)})`); rg.addColorStop(1, 'rgba(255,211,107,0)'); ctx.fillStyle = rg; ctx.fillRect(L.colX, L.bandT, L.colW, L.bandH); }
  const fk = G.face || (G.needle > .7 ? 'panic' : G.needle > .38 ? 'worried' : 'calm');
  const em = IMG['emp-' + fk] || IMG['emp-calm'];
  if (em) { const h = L.emp.h * 1.12, w = h * em.width / em.height; ctx.drawImage(em, L.emp.x, L.line - h + 6, w, h); L.empW = w; }
  ctx.restore();
  // his label
  ctx.save(); ctx.font = `700 ${clamp(L.colW * .03, 10, 13)}px Rubik, sans-serif`; ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.fillStyle = '#7a5560';
  const lx = L.emp.x + (L.empW || L.emp.h * .7) + 4 + clamp(L.colW * .24, 70, 110);
  if (!G.react) { ctx.fillText('העובד החדש · 24', lx, L.bandT + 18); ctx.fillText('שבוע 3 בחברה', lx, L.bandT + 34); }
  ctx.restore();
  if (G.react) {   // his thought: what that message just did to him
    const r = G.react, a = r.t < .15 ? r.t / .15 : r.t > 1.6 ? Math.max(0, (1.9 - r.t) / .3) : 1;
    const bx0 = L.emp.x + (L.empW || L.emp.h * .7) - 6, bx1 = L.gx - 6, bw = Math.max(80, bx1 - bx0), fs = clamp(L.colW * .036, 11, 15);
    ctx.save(); ctx.globalAlpha = a; ctx.font = `900 ${fs}px Rubik, sans-serif`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const words = r.text.split(' '), lines = []; let cur = '';
    for (const wd of words) { const t2 = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t2).width > bw - 16 && cur) { lines.push(cur); cur = wd; } else cur = t2; }
    lines.push(cur);
    const bh = lines.length * fs * 1.25 + 14, by = L.bandT + 8;
    ctx.fillStyle = r.bad ? '#fff0f2' : '#effff6'; ctx.strokeStyle = r.bad ? '#e0263f' : '#1f9d62'; ctx.lineWidth = 2.5;
    rrect(bx0, by, bw, bh, 14); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(bx0 + 4, by + bh + 6, 4, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = r.bad ? '#b3123b' : '#137a4a'; lines.forEach((ln, i) => ctx.fillText(ln, bx0 + bw / 2, by + 7 + fs * .62 + i * fs * 1.25));
    ctx.restore();
  }
  // the gauge
  if (IMG.gauge) {
    ctx.save(); ctx.font = `900 ${clamp(L.colW * .034, 11, 14)}px Rubik, sans-serif`; ctx.textAlign = 'center'; ctx.direction = 'rtl'; ctx.fillStyle = '#7a1f3d';
    ctx.fillText('המחוג הפנימי', L.gx + L.gw / 2, L.gy - 4);
    ctx.drawImage(IMG.gauge, L.gx, L.gy, L.gw, L.gh);
    const cx = L.gx + L.gw / 2, cy = L.gy + L.gh * .9, wob = G.needle > .7 ? Math.sin(performance.now() / 50) * .04 : 0;
    G.needleShown = G.needleShown == null ? G.needle : lerp(G.needleShown, G.needle, .12);
    const a = (-Math.PI / 2) + (G.needleShown - .5) * Math.PI * .96 + wob + Math.PI / 2 - Math.PI / 2;
    if (IMG.needle) { const nh = L.gh * .92, nw = nh * IMG.needle.width / IMG.needle.height; ctx.translate(cx, cy); ctx.rotate(a + Math.PI / 2); ctx.drawImage(IMG.needle, -nw / 2, -nh * .87, nw, nh); }
    ctx.restore();
  }
  // cards
  for (const c of G.cards) {
    if (c.state === 'deliver') { const t = ease(c.dt0); drawCardAt(c, lerp(c.dx0, L.face.x, t), lerp(c.dy0, L.face.y, t), c.rot * (1 - t), 1 - t * .7, 1 - t * .6); }
    else if (c.state === 'fade') drawCardAt(c, c.x, c.y - c.ft * 20, c.rot, 1 - c.ft * .2, 1 - c.ft);
    else drawCardAt(c, c.x, c.y, c.rot, c.type === 'breath' ? 1 + Math.sin(c.age * 4) * .04 : c.type === 'harm' ? 1 + Math.sin(c.age * 14) * .025 : 1);
  }
  // halves + sparks
  for (const b of G.bits) {
    const a = 1 - b.t / b.life;
    if (b.half) {
      const c = b.src; ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
      ctx.beginPath(); const L2 = 2000, ca = Math.cos(b.ang - b.rot), sa = Math.sin(b.ang - b.rot), nx = -sa * b.side, ny = ca * b.side;
      ctx.moveTo(-ca * L2, -sa * L2); ctx.lineTo(ca * L2, sa * L2); ctx.lineTo(ca * L2 + nx * L2, sa * L2 + ny * L2); ctx.lineTo(-ca * L2 + nx * L2, -sa * L2 + ny * L2); ctx.closePath(); ctx.clip();
      if (c.type === 'breath') { if (IMG.breath) ctx.drawImage(IMG.breath, -c.w / 2, -c.w / 2, c.w, c.w); } else ctx.drawImage(c.spr.c, -c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    } else {
      ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = b.color;
      if (b.star) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.t * 6); ctx.fillRect(-b.r, -b.r * .3, b.r * 2, b.r * .6); ctx.fillRect(-b.r * .3, -b.r, b.r * .6, b.r * 2); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(b.x, b.y, b.r * a + .5, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  }
  // the opening demo: a finger swiping across the first red message until the player swipes one
  if (G.demo && G.mode === 'play') {
    const c = G.cards.find((k) => k.id === G.demo.id && k.state === 'fly');
    if (!c) G.demo = null;
    else if (c.y < L.stripT - 20) {
      const x0 = Math.max(L.colX + 18, c.x - c.w * .6), x1 = Math.min(L.colX + L.colW - 18, c.x + c.w * .6), p = (G.demo.t % 1.3) / 1.3, x = lerp(x0, x1, ease(Math.min(1, p * 1.4))), y = c.y + 6 - p * 10;
      ctx.save(); ctx.globalAlpha = p < .85 ? 1 : (1 - p) / .15;
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, c.y + 6); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.shadowColor = '#000a'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.fill();
      ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.font = `900 ${L.fs * 1.05}px Rubik, sans-serif`; ctx.direction = 'rtl'; ctx.textAlign = 'center';
      ctx.lineWidth = 5; ctx.strokeStyle = '#5a1430'; ctx.strokeText('החליקו על האדומה', c.x, c.y + c.h / 2 + 26); ctx.fillStyle = '#fff'; ctx.fillText('החליקו על האדומה', c.x, c.y + c.h / 2 + 26);
      ctx.restore();
    }
  }
  // the swipe trail
  if (G.trail.length > 1) {
    const now = performance.now();
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [wd, col] of [[16, 'rgba(255,170,120,.35)'], [7, 'rgba(255,240,220,.95)']]) {
      for (let i = 1; i < G.trail.length; i++) {
        const p0 = G.trail[i - 1], p1 = G.trail[i], k = 1 - (now - p1.t) / 160;
        ctx.strokeStyle = col; ctx.lineWidth = wd * Math.max(.15, k) * (i / G.trail.length); ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      }
    }
    ctx.restore();
  }
  // pops
  ctx.save(); ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const p of G.pops) {
    const t = p.t / 1.1, s = p.t < .15 ? .6 + p.t / .15 * .5 : 1.1 - Math.min(.1, (p.t - .15));
    ctx.globalAlpha = t < .7 ? 1 : 1 - (t - .7) / .3;
    ctx.font = `900 ${L.fs * 1.25 * p.size * s}px Rubik, sans-serif`;
    ctx.lineWidth = 5; ctx.strokeStyle = '#5a1430'; ctx.strokeText(p.text, p.x, p.y - p.t * 50);
    ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y - p.t * 50);
  }
  ctx.restore();
  // banner
  if (G.banner) {
    const b = G.banner, t = b.t / b.dur, s = b.t < .2 ? .5 + b.t / .2 * .6 : b.t < .3 ? 1.1 - (b.t - .2) : 1;
    ctx.save(); ctx.globalAlpha = t > .8 ? 1 - (t - .8) / .2 : 1; ctx.translate(L.colX + L.colW / 2, L.line + (L.stripT - L.line) * .38); ctx.scale(s, s);
    ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${clamp(L.colW * .13, 34, 60)}px Rubik, sans-serif`;
    ctx.lineWidth = 8; ctx.strokeStyle = b.bad ? '#4a0a1f' : '#5a1430'; ctx.strokeText(b.big, 0, 0); ctx.fillStyle = b.bad ? '#ff6b7f' : '#fff'; ctx.fillText(b.big, 0, 0);
    if (b.sub) { ctx.font = `900 ${clamp(L.colW * .05, 15, 21)}px Rubik, sans-serif`; ctx.lineWidth = 5; ctx.strokeText(b.sub, 0, clamp(L.colW * .1, 34, 50)); ctx.fillStyle = '#ffd36b'; ctx.fillText(b.sub, 0, clamp(L.colW * .1, 34, 50)); }
    ctx.restore();
  }
  ctx.restore();
  if (G.flash > 0) { ctx.fillStyle = `rgba(224,38,63,${G.flash * .35})`; ctx.fillRect(0, 0, W, H); }
}

// ---------- HUD ----------
let hudCache = '';
function updHud(light) {
  const m = mult(), key = [G.score, G.day, m, G.strikes].join('|'); if (light && key === hudCache) return; hudCache = key;
  $('scoreBox').textContent = G.score.toLocaleString('en-US');
  $('dayBox').textContent = 'יום ' + DAYS[G.day];
  const cb = $('comboBox'); cb.classList.toggle('on', m > 1); cb.querySelector('b').textContent = 'x' + m;
  document.querySelectorAll('#strikes i').forEach((el, i) => el.classList.toggle('on', i < G.strikes));
}

// ---------- screens ----------
function showScreen(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id)); }
function bestNum() { return Number(store.get(KEYS.best)) || 0; }
function showMenu() {
  G.mode = 'menu'; G.cards = []; G.bits = []; G.pops = []; G.banner = null; G.tut = null; endTutUI();
  $('hud').classList.remove('on'); $('strip').classList.remove('on'); showScreen('start');
  const b = bestNum(); requestAnimationFrame(fitRec); $('bestStart').innerHTML = b ? `השיא שלכם: <b>${b.toLocaleString('en-US')}</b>` : 'שבוע עבודה · 75 שניות';
}
// the record's words shrink until they fit the badge's empty face
function fitRec() { const el = $('bestStart'); el.style.fontSize = ''; let f = parseFloat(getComputedStyle(el).fontSize); while (el.scrollWidth > el.clientWidth && f > 9) { f -= .5; el.style.fontSize = f + 'px'; } }
addEventListener('resize', () => G.mode === 'menu' && fitRec());
function showOver() {
  G.mode = 'over'; G.cards = []; G.banner = null; G.trail = [];
  $('hud').classList.remove('on'); $('strip').classList.remove('on');
  const won = G.won, score = G.score, prev = bestNum(), isNew = score > prev;
  if (isNew) store.set(KEYS.best, score);
  const today = israelDay(), dv = (store.get(KEYS.day) || '').split('|'); if (dv[0] !== today || score > Number(dv[1] || 0)) store.set(KEYS.day, today + '|' + score);
  $('overH').textContent = won ? 'הצלחה אדירה!' : 'הוא התפטר';
  $('overH').className = 'plaque ' + (won ? 'win' : 'lose');
  $('rPaused').textContent = G.paused; $('rStreak').textContent = G.longest; $('rAnx').textContent = G.anx; $('rHR').textContent = G.hr;
  $('goldCard').hidden = !(won && G.goldIn > 0);
  const q = $('overQuote');
  if (won) {
    q.hidden = false;
    if (G.goldIn > 0) { $('overFace').src = 'assets/face/naomi-heart.webp'; $('overLine').textContent = 'המממ... זה מרגש. וזה גם אמיץ. לראשונה הוא מבטא קושי בלי להיכנס למצב הישרדותי.'; }
    else if (G.strikes === 0) { $('overFace').src = 'assets/face/naomi-heart.webp'; $('overLine').textContent = 'שבוע שלם בלי התקף חרדה ובלי תלונה. את המשימה הוא עוד לא התחיל – אבל זו הצלחה אדירה.'; }
    else { $('overFace').src = 'assets/face/naomi-coach.webp'; $('overLine').textContent = 'הוא עדיין פה. ועכשיו אנחנו עוברים לשלב הבא: איך מבקשים ממנו להתחיל לעבוד.'; }
  } else q.hidden = true;
  $('overScore').firstChild.nodeValue = score.toLocaleString('en-US');
  $('overRec').innerHTML = isNew && score > 0 ? '<span class="newrec">שיא חדש!</span>' : '';
  $('bestOver').innerHTML = `השיא שלכם: <b>${Math.max(prev, score).toLocaleString('en-US')}</b>`;
  showScreen('over'); fitPanels(); requestAnimationFrame(() => setTimeout(fitPanels, 60));
  window.track && window.track('game_over', SLUG);
  if (score > 0) window.VerseFrame && VerseFrame.score(score);
}
// a panel taller than the screen is scaled down to fit (small phones, the verse's short frame)
function fitPanels() {
  document.querySelectorAll('.screen.on .panel').forEach((pn) => {
    pn.style.transform = ''; const avail = innerHeight - L.top - L.bot - 40, h = pn.offsetHeight + 24;
    if (h > avail) pn.style.transform = `scale(${Math.max(.4, avail / h)})`;
  });
}
addEventListener('resize', () => setTimeout(fitPanels, 50));
function pauseGame() {
  if (G.mode !== 'play' || G.over) return; G.mode = 'paused'; showScreen('paused'); fitPanels(); if (SND.ctx) SND.ctx.suspend();
}
function resumeGame() { if (G.mode !== 'paused') return; G.mode = 'play'; showScreen(null); if (SND.ctx) SND.ctx.resume(); last = performance.now(); }

// ---------- the tutorial ----------
const TUT = [
  { text: 'אתם המנהלים. כל הודעה שאתם שולחים עפה אל <b>העובד החדש</b> – בן 24, שלושה שבועות בחברה.', spot: () => [L.colX + 6, L.bandT, L.colW * .55, L.bandH] },
  { text: 'המטרה: לעבור <b>שבוע עבודה שלם</b> – מיום א׳ עד יום ה׳ – בלי שהוא יתפטר.', spot: () => rectOf('dayBox') },
  { text: 'זה <b>המחוג הפנימי</b> שלו. הודעה לחוצה שמגיעה אליו – המחוג קופץ. 3 פעמים באדום = <b>מכתב התפטרות</b>.', spot: () => [L.gx - 8, L.gy - 22, L.gw + 16, L.gh + 30] },
  { text: 'הודעה <b>אדומה עם סימן עצירה</b> = לחץ. <b>החליקו</b> עליה לפני שהיא נשלחת.', try: 'cutHarm' },
  { text: 'הודעה <b>ורודה עם לב</b> = התקשרות. <b>לא נוגעים</b> – נותנים לה להגיע אליו.', try: 'letBond' },
  { text: 'ההודעה <b>הזהובה עם כוכב</b> היא שלו, והיא יורדת אליכם. לא נוגעים – תנו לה להגיע.', try: 'letGold' },
  { text: 'השהיות ברצף = <b>מכפיל</b>. כמה הודעות בהחלקה אחת = <b>קומבו</b>.', spot: () => rectOf('comboBox', 'scoreBox') },
  { text: '<b>בועת נשימה</b>: החליקו עליה – והזמן מאט לכמה שניות.', try: 'cutBreath' },
  { text: '<b>אדומה</b> – מחליקים. <b>ורודה וזהובה</b> – לא נוגעים. מוכנים? שבוע עבודה מתחיל.' },
];
function rectOf(...ids) {
  const rs = ids.map((id) => $(id).getBoundingClientRect());
  const x0 = Math.min(...rs.map((r) => r.left)), y0 = Math.min(...rs.map((r) => r.top)), x1 = Math.max(...rs.map((r) => r.right)), y1 = Math.max(...rs.map((r) => r.bottom));
  return [x0 - 6, y0 - 6, x1 - x0 + 12, y1 - y0 + 12];
}
function startTutorial(then) {
  R = rng(7);
  Object.assign(G, { mode: 'tut', t: 0, day: 0, score: 0, needle: .15, strikes: 0, streak: 0, cards: [], bits: [], pops: [], banner: null, over: false, slow: 0 });
  showScreen(null); $('hud').classList.add('on'); $('strip').classList.remove('on'); updHud();
  let i = -1, waiting = null, okT = 0, live = null;
  const card = $('tutCard'), text = $('tutText'), next = $('tutNext'), dim = $('tutDim'), hole = $('tutHole');
  const finish = () => { G.tut = null; endTutUI(); store.set(KEYS.tut, 1); then(); };
  function placeCard(spotRect) {
    card.classList.add('on');
    const ch = card.getBoundingClientRect().height, low = spotRect ? spotRect[1] + spotRect[3] / 2 > L.H * .5 : false;
    card.style.top = low ? `calc(var(--safe-t) + 60px)` : 'auto'; card.style.bottom = low ? 'auto' : `calc(var(--safe-b) + 10px)`;
    void ch;
  }
  function spawnFor(kind) {
    G.cards = [];
    const midY = L.line + (L.stripT - L.line) * .5;
    if (kind === 'cutHarm') live = mkCard('harm', 'מה הסטטוס עם המשימה?', { hover: midY, white: false, x: L.colX + L.colW / 2 });
    if (kind === 'letBond') live = mkCard('bond', 'איך עולה לך היום?', { white: false, rise: 3.4, x: L.colX + L.colW / 2 });
    if (kind === 'letGold') { live = mkCard('gold', GOLD, { x: L.colX + L.colW / 2 }); live.vy = 60; live.g = 30; }
    if (kind === 'cutBreath') live = mkCard('breath', '', { hover: midY, x: L.colX + L.colW / 2 });
  }
  function go(n) {
    i = n; okT = 0; G.cards = []; if (i >= TUT.length) return finish();
    const s = TUT[i]; text.innerHTML = s.text; waiting = s.try || null;
    $('tutCount').textContent = `${i + 1} / ${TUT.length}`; card.querySelector('#tutBar i').style.width = `${(i + 1) / TUT.length * 100}%`;
    next.disabled = !!waiting; next.innerHTML = i === TUT.length - 1 ? 'יוצאים לדרך <span class="keyhint">(רווח)</span>' : 'הבא <span class="keyhint">(רווח)</span>';
    let r = s.spot ? s.spot() : null;
    if (waiting) { spawnFor(waiting); r = null; }
    if (r) { dim.classList.add('on'); Object.assign(hole.style, { left: r[0] + 'px', top: r[1] + 'px', width: r[2] + 'px', height: r[3] + 'px' }); } else dim.classList.remove('on');
    G.tutFrozen = false; placeCard(r);
  }
  G.tut = {
    get step() { return i; }, get waiting() { return waiting; },
    next() { if (!waiting) { play('tap', .5); go(i + 1); } },
    skip() { finish(); },
    onEvent(ev, c) {
      if (!waiting || okT) return;
      const good = (waiting === 'cutHarm' && ev === 'cut' && c.type === 'harm') || (waiting === 'letBond' && ev === 'land' && c.type === 'bond') ||
        (waiting === 'letGold' && ev === 'land' && c.type === 'gold') || (waiting === 'cutBreath' && ev === 'cut' && c.type === 'breath');
      const bad = (waiting === 'letBond' && ev === 'cut') || (waiting === 'letGold' && ev === 'cut');
      if (good) { text.innerHTML = '<span class="ok">' + ({ cutHarm: 'יפה! זו השהיית תגובה.', letBond: 'יפה! סקין טו סקין רגשי – והמחוג נרגע.', letGold: 'יפה! הוא ביטא קושי. בונוס ענק.', cutBreath: 'יפה! לעצור. לזהות מה עולה.' })[waiting] + '</span>'; okT = .01; }
      if (bad) { text.innerHTML = '<b>לא להחליק על זו!</b> נסו שוב – תנו לה להגיע.'; setTimeout(() => G.tut && i >= 0 && TUT[i].try === waiting && spawnFor(waiting), 700); }
    },
    tick(dt) {
      if (okT) { okT += dt; if (okT > 1.1) { G.slow = 0; go(i + 1); } }
      else if (waiting && !G.cards.some((c) => c.state === 'fly' || c.state === 'deliver')) spawnFor(waiting);   // missed it - again
    },
  };
  $('tutSkip').onclick = () => G.tut && G.tut.skip(); next.onclick = () => G.tut && G.tut.next();
  go(0);
}
function endTutUI() { $('tutCard').classList.remove('on'); $('tutDim').classList.remove('on'); }

// ---------- buttons & keys ----------
function bindTap(el, fn) { el.addEventListener('click', (e) => { sndWake(); play('tap', .5); fn(e); }); }
function playFlow() { if (store.get(KEYS.tut)) startGame(); else startTutorial(startGame); }
bindTap($('playBtn'), playFlow);
bindTap($('howBtn'), () => startTutorial(startGame));
bindTap($('againBtn'), startGame);
bindTap($('menuBtn'), showMenu);
bindTap($('pauseBtn'), pauseGame);
bindTap($('resumeBtn'), resumeGame);
bindTap($('restartBtn'), startGame);
bindTap($('quitBtn'), showMenu);
document.querySelectorAll('.sndBtn').forEach((b) => bindTap(b, () => setSound(!SND.on)));
addEventListener('keydown', (e) => {
  if (G.tut) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); G.tut.next(); } else if (e.key === 'Escape') G.tut.skip(); return; }
  if (e.key === 'Escape' || e.key === 'p') { if (G.mode === 'play') pauseGame(); else if (G.mode === 'paused') resumeGame(); }
  if ((e.key === ' ' || e.key === 'Enter') && G.mode === 'over') startGame();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
addEventListener('pagehide', () => { if (SND.ctx) SND.ctx.suspend(); });

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (!PAUSE.manual && G.mode !== 'paused') update(dt);
  draw();
  requestAnimationFrame(frame);
}
// the test hook
const PAUSE = window.PAUSE = {
  manual: false, G, L,
  get state() { return { mode: G.mode, t: G.t, day: G.day, score: G.score, needle: G.needle, strikes: G.strikes, streak: G.streak, paused: G.paused, over: G.over, won: G.won, tutStep: G.tut ? G.tut.step : -1, waiting: G.tut ? G.tut.waiting : null, cards: G.cards.map((c) => ({ id: c.id, type: c.type, text: c.text, x: c.x, y: c.y, w: c.w, h: c.h, state: c.state, sneaky: c.sneaky })) }; },
  tick(dt, n = 1) { for (let i = 0; i < n; i++) update(dt); },
  slice(id) { const c = G.cards.find((k) => k.id === id); if (c && c.state === 'fly') onSliced(c, 0); },
  start: startGame, menu: showMenu,
};

// ---------- boot ----------
setSound(SND.on);
layout();
Promise.all([loadImages(), document.fonts ? document.fonts.load('900 20px Rubik').catch(() => {}) : 0]).then(() => {
  layout(); showMenu(); requestAnimationFrame(frame);
  document.addEventListener('pointerdown', function once() { sndInit(); voLoad(); document.removeEventListener('pointerdown', once, true); }, true);
});
