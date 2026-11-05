// שמעת על הקורקינט שלי? – Snake in the Techy-Tech open space. Sagi, the scooter guy, is in love with his electric
// scooter and can only talk about it. Ride into a colleague and they get the lecture - and have to ride behind him.
// The line of bored listeners is the snake's tail. Desks, plants, the walls and your own line end the ride; so does
// Ofer (his VP) on his walk down the middle aisle. An Enterprise client shows up for a few seconds and is worth 5.
'use strict';
const $ = (id) => document.getElementById(id);
const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const SLUG = 'scooter-snake';
const KEY = { best: `shlomiverse:${SLUG}:best`, day: `shlomiverse:${SLUG}:day`, tut: `shlomiverse:${SLUG}:tut`, snd: `shlomiverse:${SLUG}:snd` };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} },
};
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
// the same office for everyone each day
function rng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ───────────────────────── the office ─────────────────────────
// 9 columns always; the rows fit the phone (13-20) so the office fills the screen - set when a ride starts
const COLS = 9;
let ROWS = 17, OFR = 8, START = { c: 4, r: 14 };   // OFR = Ofer's aisle (kept clear of furniture)
function setRows(n) { ROWS = n; OFR = Math.floor(n / 2); START = { c: 4, r: n - 3 }; }
const inClear = (c, r) => (c >= 2 && c <= 6 && r >= START.r - 3) || (c >= 3 && c <= 5 && r >= START.r - 8);   // the start + a lane ahead stay empty   // the start zone stays empty
const PROPS = ['plant', 'coffee', 'water', 'boxes', 'foos', 'plant'];
let grid = [], props = [];
function buildOffice(seed) {
  const R = rng(seed);
  grid = new Array(COLS * ROWS).fill(0); props = [];
  const free = (c, r, w) => {
    if (r < 0 || r >= ROWS || c < 0 || c + w > COLS || r === OFR) return false;
    for (let x = c; x < c + w; x++) if (inClear(x, r)) return false;
    for (let y = r - 1; y <= r + 1; y++) for (let x = c - 1; x <= c + w; x++) {
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
      if (grid[y * COLS + x]) return false;
    }
    return true;
  };
  const place = (kind, w) => {
    for (let k = 0; k < 300; k++) {
      const c = Math.floor(R() * (COLS - w + 1)), r = Math.floor(R() * ROWS);
      if (!free(c, r, w)) continue;
      for (let x = c; x < c + w; x++) grid[r * COLS + x] = 1;
      if (!roomy()) { for (let x = c; x < c + w; x++) grid[r * COLS + x] = 0; continue; }
      props.push({ kind, c, r, w }); return;
    }
  };
  // a snake can't turn back: a free tile with one way in is a trap, and so is the corridor that leads only to it.
  // Peel such tiles away again and again - if anything peels, or the floor falls apart, the piece doesn't go there.
  const roomy = () => {
    const open = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && !grid[r * COLS + c];
    const live = new Set(); for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (open(c, r)) live.add(r * COLS + c);
    const deg = (i) => { const c = i % COLS, r = (i / COLS) | 0; return [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => live.has((r + dy) * COLS + c + dx) && open(c + dx, r + dy)).length; };
    for (let again = true; again;) { again = false; for (const i of [...live]) if (deg(i) <= 1) { return false; } }
    const first = live.values().next().value, seen = new Set([first]), q = [first];
    while (q.length) { const i = q.pop(), c = i % COLS, r = (i / COLS) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (r + dy) * COLS + c + dx; if (open(c + dx, r + dy) && !seen.has(j)) { seen.add(j); q.push(j); } } }
    return seen.size === live.size;
  };
  for (let i = 0, n = Math.round(ROWS * 0.29); i < n; i++) place('desk', 2);
  for (const p of PROPS) place(p, 1);
}
const solid = (c, r) => c < 0 || r < 0 || c >= COLS || r >= ROWS || grid[r * COLS + c] === 1;

// ───────────────────────── art ─────────────────────────
const IMG = {};
const img = (k, src) => { const i = new Image(); i.src = src; IMG[k] = i; return i; };
img('floor', 'assets/floor.jpg');
img('sagi-crash', 'assets/sagi-crash.webp');
// every rider faces where they go: f = toward us (down), b = away (up), s = to the right (flipped for left)
for (const id of ['sagi', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'client']) for (const v of ['f', 'b', 's']) img(`${id}-${v}`, `assets/${id}-${v}.webp`);
for (let i = 1; i <= 6; i++) img(`c${i}-wait`, `assets/c${i}-wait.webp`);
for (const p of ['ofer-1', 'ofer-2', 'client-wave']) img(p, `assets/${p}.webp`);
for (const u of ['marker', 'talk', 'bell', 'alert']) img('ui-' + u, `assets/ui-${u}.webp`);
img('grip', 'assets/grip.jpg'); img('sagi-s2', 'assets/sagi-s2.webp'); img('sagi-b2', 'assets/sagi-b2.webp'); img('rear-s', 'assets/rear-s.webp'); img('rear-b', 'assets/rear-b.webp');
for (const p of ['desk', 'plant', 'coffee', 'water', 'boxes', 'foos']) img('p-' + p, `assets/p-${p}.webp`);
const ok = (im) => im && im.complete && im.naturalWidth;

// ───────────────────────── Sagi's words ─────────────────────────
const sayEl = $('say');
let sayT = 0;
function say(text, dur = 1.8, loud = false) { sayEl.textContent = text; sayEl.classList.add('on'); sayEl.classList.toggle('loud', loud); sayT = dur; }
const LINES = {
  catch: ['שמעת על הקורקינט שלי?', '45 קמ״ש, אחי. ארבעים וחמש!', 'בלם דיסק כפול. כפול!', 'סוללה ל-60 קילומטר!', 'תרגיש את הבולמים!', 'מתקפל בשנייה. רוצה לראות?',
    'אני מטעין אותו ליד השולחן.', 'יש לו אפליקציה. עם מצב ספורט!', 'נתתי לו שם. ברק.', 'צמיגים של 10 אינץ׳. בלי פנצ׳רים!', 'הגעתי היום ב-12 דקות!', 'יש לו פנס LED מאחורה. כמו אוטו!',
    'AI? לא דואג. נעשה משלוחים על הקורקינט!', 'בוא, תעמוד עליו רגע. לא, עדיף שלא.'],
  idle: ['ועוד דבר אחד על הקורקינט...', 'אמרתי שהוא מתקפל?', 'רגע, לא סיפרתי לכם על הצמיגים!', 'אתם יודעים כמה הוא שוקל? 14 קילו!'],
  client: ['לקוח Enterprise! שמעת על הקורקינט שלי?', 'ההטמעה מעולה. עכשיו – הקורקינט!', 'בוא, אלווה אותך. על הקורקינט!'],
  wall: ['הקורקינט! הוא בסדר?!', 'אאוץ׳. תבדקו את הבלמים!', 'מי שם פה שולחן?!'],
  self: ['נתקעתי בקהל המעריצים שלי!', 'רגע, מי זה מאחוריי?'],
  ofer: ['שגיא. לחדר ישיבות. עכשיו.', 'שגיא, הקורקינט – בחניה.'],
  bell: ['דינג דינג!', 'פנו דרך – קורקינט!', 'שמעתם? זה הפעמון שלו!', 'דינג! סתם, בשביל הכיף.'],
};
// the colleagues (c1..c6 in assets) - real Techy-Tech people, each sighs in their own way
const PEOPLE = [null,
  { name: 'יותם', g: 'm', lines: ['רק רגע... אוקיי, שלוש שעות.', 'יש לקורקינט הזה API?'] },
  { name: 'חני', g: 'f', lines: ['רגע, אני באמצע ברכה...', 'אפשר לשלוח לי את זה במייל?'] },
  { name: 'אסנת', g: 'f', lines: ['אני לא בדיוק הדמות המוסמכת לזה.', 'זה לא מופיע בהטבות.'] },
  { name: 'יניב', g: 'm', lines: ['אני לא יכול לעמוד יותר מעשר דקות!', 'הגב שלי...'] },
  { name: 'צביקה', g: 'm', lines: ['בזמני הלכנו ברגל.', 'קורקינט חשמלי. עוד AI.'] },
  { name: 'עידו', g: 'm', lines: ['טוב, אני רק אביא את המקלדת שלי.', 'מה? יש לי אוזניות.'] },
];
function pickNo(list, key) { const last = pickNo[key]; let l = pick(list); if (list.length > 1 && l === last) l = list[(list.indexOf(l) + 1) % list.length]; pickNo[key] = l; return l; }
let bubble = null;                 // { text, t } - his line beside his head
function sagiSays(text, dur = 1.6) { bubble = { text, t: Math.min(dur, 1.8) }; }

// ───────────────────────── effects ─────────────────────────
const fxEl = $('fx');
function popText(x, y, text, cls) { x = clamp(x, Math.min(W / 2, 120), Math.max(W / 2, W - 120)); const p = document.createElement('div'); p.className = 'pop' + (cls ? ' ' + cls : ''); p.style.left = x + 'px'; p.style.top = y + 'px'; p.textContent = text; fxEl.appendChild(p); setTimeout(() => p.remove(), cls === 'talk' ? 1600 : 900); }
function flash() { const f = document.createElement('div'); f.className = 'flash'; fxEl.appendChild(f); setTimeout(() => f.remove(), 400); }
function banner(text) { const b = document.createElement('div'); b.className = 'banner'; b.innerHTML = text; fxEl.appendChild(b); setTimeout(() => b.remove(), 1600); }

// ───────────────────────── sound ─────────────────────────
const SND = { ctx: null, raw: {}, buf: {}, on: store.get(KEY.snd) !== '0', last: {}, master: null, hum: null, humGain: null, music: null, musicGain: null };
const SFX = ['bell-1', 'bell-2', 'bell-3', 'catch-1', 'catch-2', 'catch-3', 'sigh-1', 'sigh-2', 'sigh-3', 'sigh-4', 'crash-1', 'crash-2', 'client', 'ofer', 'start', 'over', 'hum'];
const MUSIC = ['music-a', 'music-b'];
const load = (n, url) => fetch(url).then((r) => r.ok ? r.arrayBuffer() : null).then((b) => { if (b) { SND.raw[n] = b; decode(n); } }).catch(() => {});
for (const n of SFX) load(n, `assets/sfx/${n}.mp3`);
for (const n of MUSIC) load(n, `assets/${n}.mp3`);
function decode(n) {
  if (!SND.ctx || !SND.raw[n] || SND.buf[n]) return;
  const b = SND.raw[n]; SND.raw[n] = null;
  SND.ctx.decodeAudioData(b).then((x) => { SND.buf[n] = x; if (n === wantMusic) musicOn(n); }).catch(() => {});
}
function audioUnlock() {
  if (SND.ctx) { if (SND.ctx.state === 'suspended' && !paused) SND.ctx.resume(); return; }
  try { SND.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  SND.master = SND.ctx.createGain(); SND.master.gain.value = SND.on ? 1 : 0; SND.master.connect(SND.ctx.destination);
  for (const n of [...SFX, ...MUSIC]) decode(n);
}
// a name plays one of its variants (bell → bell-1..3), never the same one twice in a row
function play(name, vol = 1) {
  if (!SND.ctx) return;
  const GROUP = { sighm: ['sigh-1', 'sigh-3'], sighf: ['sigh-2', 'sigh-4'] };   // a man sighs like a man, a woman like a woman
  const vars = (GROUP[name] || SFX.filter((n) => n === name || n.startsWith(name + '-'))).filter((n) => SND.buf[n]);
  if (!vars.length) return;
  let n = pick(vars);
  if (vars.length > 1 && n === SND.last[name]) n = vars[(vars.indexOf(n) + 1) % vars.length];
  SND.last[name] = n;
  const src = SND.ctx.createBufferSource(), gn = SND.ctx.createGain();
  src.buffer = SND.buf[n]; src.playbackRate.value = 0.95 + Math.random() * 0.1; gn.gain.value = vol;
  src.connect(gn).connect(SND.master); src.start();
}
function humOn(on) {
  if (!SND.ctx) return;
  if (on && !SND.hum && SND.buf.hum) {
    SND.humGain = SND.ctx.createGain(); SND.humGain.gain.value = 0.12; SND.humGain.connect(SND.master);
    SND.hum = SND.ctx.createBufferSource(); SND.hum.buffer = SND.buf.hum; SND.hum.loop = true; SND.hum.connect(SND.humGain); SND.hum.start();
  } else if (!on && SND.hum) { try { SND.hum.stop(); } catch (e) {} SND.hum = null; }
}
let wantMusic = null;
function musicOn(n) {
  wantMusic = n;
  if (SND.music && SND.music.name === n) return;
  if (SND.music) { try { SND.music.src.stop(); } catch (e) {} SND.music = null; }
  if (!n || !SND.ctx || !SND.buf[n]) return;
  const g = SND.ctx.createGain(); g.gain.value = 0.3; g.connect(SND.master);
  const src = SND.ctx.createBufferSource(); src.buffer = SND.buf[n]; src.loop = true; src.connect(g); src.start();
  SND.music = { name: n, src };
}
const SPK = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const MUTE = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
function sndIcons() { document.querySelectorAll('.sndBtn').forEach((b) => { b.innerHTML = SND.on ? SPK : MUTE; }); }
document.querySelectorAll('.sndBtn').forEach((b) => b.onclick = () => { audioUnlock(); SND.on = !SND.on; store.set(KEY.snd, SND.on ? '1' : '0'); if (SND.master) SND.master.gain.value = SND.on ? 1 : 0; sndIcons(); });
sndIcons();

// ───────────────────────── layout ─────────────────────────
const cv = $('cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, B = { x: 0, y: 0, t: 30, th: 30 };
const cssPx = (v) => { const d = document.createElement('div'); d.style.cssText = `position:fixed;top:${v};visibility:hidden`; document.body.appendChild(d); const t = d.getBoundingClientRect().top; d.remove(); return t; };
function layout() {
  DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  document.body.classList.toggle('turn', W > H * 1.15 && H < 520 && 'ontouchstart' in window);
  // the HUD above, the verb chip below (the speech strip floats over the board's top); the top row's people stand
  // ~0.6 tile above the board, so that much room is kept
  const G = gap();
  const t = Math.floor(Math.min((W - 12) / COLS, G.h / (ROWS + 0.6)));
  const th = Math.min(t * 1.18, (G.h - t * 0.6) / ROWS);           // stretch the rows (a little) to fill the height
  B = { t, th, x: Math.round((W - t * COLS) / 2), y: Math.round(G.top + t * 0.6 + Math.max(0, (G.h - t * 0.6 - th * ROWS) / 2)) };
}
function gap() { const top = cssPx('var(--safe-t)') + 52, bottom = H - 40 - cssPx('env(safe-area-inset-bottom,0px)'); return { top, h: bottom - top }; }
// how many rows fill this screen when the board takes the whole width
function fitRows() { W = innerWidth; H = innerHeight; const t = (W - 12) / COLS; return clamp(Math.floor(gap().h / t - 0.6), 13, 20); }
addEventListener('resize', layout); addEventListener('verseframe', layout);
const tx = (c) => B.x + c * B.t, ty = (r) => B.y + r * B.th;

// ───────────────────────── state ─────────────────────────
let state = 'menu', paused = false, tutorial = false, moving = false;
let score = 0, T = 0, prog = 0, dir = { x: 0, y: -1 }, queue = [], crash = null, runs = 0;
let snake = [];          // head first: Sagi { c, r, pc, pr, dx, dy, face } moves on the grid; the riders { kind, x, y, c, r, dx, dy, face }
let trail = [];          // where Sagi has been (tile units, newest first) - the riders stand along it, SP apart
const SP = 0.62;         // how far apart the riders stand on the long scooter, in tiles
let food = null;         // { c, r, kind 1..6, t }
let client = null;       // { c, r, life, max }
let ofer = null;         // { c, r, pc, d, t, step, on }
let grace = 0, clientNext = 0, idleT = 0, foodR = Math.random, nextKind = 1, lastTurnT = 0;
const speed = () => Math.min(6.2, 2.9 + (snake.length - 1) * 0.08);

function resetSnake() {
  snake = [{ c: START.c, r: START.r, pc: START.c, pr: START.r + 1, face: 1, dx: 0, dy: -1, kind: 'sagi' }];
  trail = [{ x: START.c, y: START.r + 1 }, { x: START.c, y: START.r + 6 }];
  dir = { x: 0, y: -1 }; queue = []; prog = 0; crash = null;
}
const blockedAhead = () => { const h = snake[0], nc = h.c + dir.x, nr = h.r + dir.y; return solid(nc, nr) || onSnake(nc, nr, 2, 0.5) || (ofer && ofer.on && ofer.c === nc && ofer.r === nr); };
const headPos = () => { const h = snake[0], k = moving ? clamp(prog, 0, 1) : 1; return { x: lerp(h.pc, h.c, k), y: lerp(h.pr, h.r, k) }; };
const segPos = (s, i) => i === 0 ? headPos() : { x: s.x, y: s.y };
const onSnake = (c, r, from = 0, near = 0.7) => snake.some((s, i) => { if (i < from) return false; const p = segPos(s, i); return Math.hypot(p.x - c, p.y - r) < near; });
// the riders stand along Sagi's trail, SP apart; each faces the way the trail goes where they stand
function placeRiders() {
  const hp = headPos();
  if (!trail.length || Math.hypot(trail[0].x - hp.x, trail[0].y - hp.y) > 0.04) trail.unshift(hp); else trail[0] = hp;
  let seg = 0, acc = 0;
  for (let i = 1; i < snake.length; i++) {
    const want = i * SP, s = snake[i];
    while (seg < trail.length - 1) {
      const a = trail[seg], b = trail[seg + 1], L = Math.hypot(b.x - a.x, b.y - a.y);
      if (acc + L >= want) { const u = L ? (want - acc) / L : 0; s.x = lerp(a.x, b.x, u); s.y = lerp(a.y, b.y, u);
        const dx = a.x - b.x, dy = a.y - b.y; if (Math.abs(dx) > Math.abs(dy)) { s.dx = Math.sign(dx); s.dy = 0; s.face = s.dx; } else if (dy) { s.dx = 0; s.dy = Math.sign(dy); } break; }
      acc += L; seg++;
    }
    if (seg >= trail.length - 1) { const e = trail[trail.length - 1]; s.x = e.x; s.y = e.y; }
    s.c = Math.round(s.x); s.r = Math.round(s.y);
  }
  // keep only the trail the line needs
  let need = (snake.length + 1) * SP + 1, d = 0;
  for (let j = 1; j < trail.length; j++) { d += Math.hypot(trail[j].x - trail[j - 1].x, trail[j].y - trail[j - 1].y); if (d > need) { trail.length = j + 1; break; } }
}
function freeTile(avoidRow) {
  const h = snake[0];
  for (let k = 0; k < 400; k++) {
    const c = Math.floor(foodR() * COLS), r = Math.floor(foodR() * ROWS);
    if (solid(c, r) || onSnake(c, r) || (avoidRow && r === OFR)) continue;
    if (Math.abs(c - h.c) + Math.abs(r - h.r) < 3) continue;
    if (food && food.c === c && food.r === r) continue;
    if (client && client.c === c && client.r === r) continue;
    if (ofer && ofer.on && ofer.r === r && ofer.c === c) continue;
    return { c, r };
  }
  return null;
}
function spawnFood(at) {
  const p = at || freeTile(true); if (!p) return;
  food = { ...p, kind: nextKind, t: 0 }; nextKind = nextKind % 6 + 1;
}
function startGame() {
  tutorial = false; state = 'play'; moving = true; score = 0; T = 0; runs++;
  setRows(fitRows()); layout(); buildOffice(`${SLUG}|${today()}|${ROWS}`); foodR = rng(`${SLUG}|${today()}|food`); nextKind = 1;
  resetSnake(); food = null; client = null; ofer = null; clientNext = 14; idleT = 5; bubble = null;
  spawnFood();
  showHUD(true); show(null); hud(); play('start', .7); banner('יאללה, רוכבים!');
  musicOn(runs % 2 ? 'music-b' : 'music-a'); humOn(true);
  sagiSays('בוקר טוב! שמעתם על הקורקינט שלי?', 2.4);
  window.track && window.track('game_start', SLUG);
}

// ───────────────────────── input: a floating joystick + keys ─────────────────────────
const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const joy = { on: false, ox: 0, oy: 0, x: 0, y: 0, d: null };
function want(d) {
  if (!d) return;
  const last = queue.length ? queue[queue.length - 1] : dir;
  if (d.x === last.x && d.y === last.y) return;
  if (d.x === -last.x && d.y === -last.y) return;           // never straight back into your own line
  if (queue.length < 2) queue.push(d);
}
cv.addEventListener('pointerdown', (e) => {
  audioUnlock();
  if (paused || (state !== 'play' && state !== 'tut')) return;
  joy.on = true; joy.ox = joy.x = e.clientX; joy.oy = joy.y = e.clientY; joy.d = null;
  try { cv.setPointerCapture(e.pointerId); } catch (err) {}
});
cv.addEventListener('pointermove', (e) => {
  if (!joy.on) return;
  joy.x = e.clientX; joy.y = e.clientY;
  let dx = joy.x - joy.ox, dy = joy.y - joy.oy; const dist = Math.hypot(dx, dy), R = 46;
  if (dist > R) { joy.ox = joy.x - dx / dist * R; joy.oy = joy.y - dy / dist * R; dx = joy.x - joy.ox; dy = joy.y - joy.oy; }   // the ring follows the thumb
  if (dist < 16) return;
  const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIRS.right : DIRS.left) : (dy > 0 ? DIRS.down : DIRS.up);
  if (d !== joy.d) { joy.d = d; want(d); }
});
const joyEnd = () => { joy.on = false; joy.d = null; };
cv.addEventListener('pointerup', joyEnd); cv.addEventListener('pointercancel', joyEnd);
addEventListener('keydown', (e) => {
  const k = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' }[e.key];
  if (k && (state === 'play' || state === 'tut') && !paused) { e.preventDefault(); audioUnlock(); want(DIRS[k]); }
});

// ───────────────────────── the ride ─────────────────────────
function tick() {
  const turned = queue.length > 0;
  if (turned) { dir = queue.shift(); lastTurnT = T; if (tutWait && tutWait.id === 'turn') tutWait.done = true; }
  const h = snake[0], nc = h.c + dir.x, nr = h.r + dir.y;
  const eats = food && food.c === nc && food.r === nr, meets = client && client.c === nc && client.r === nr;
  const grow = eats || meets;
  if (solid(nc, nr)) return die('wall');
  if (onSnake(nc, nr, 2, 0.5)) return die('self');
  if (ofer && ofer.on && ofer.c === nc && ofer.r === nr) return die('ofer');
  const hd = snake[0]; hd.pc = hd.c; hd.pr = hd.r; hd.c = nc; hd.r = nr; hd.dx = dir.x; hd.dy = dir.y; if (dir.x) hd.face = dir.x;
  const tail = snake[snake.length - 1], old = { x: tail.x ?? hd.pc, y: tail.y ?? hd.pr, face: tail.face, dx: tail.dx, dy: tail.dy };
  if (grow) {
    const kind = eats ? food.kind : 'client';
    snake.push({ x: old.x, y: old.y, c: Math.round(old.x), r: Math.round(old.y), face: old.face, dx: old.dx, dy: old.dy, kind, join: 0 });
    const x = tx(nc + 0.5), y = ty(nr) - B.t * 0.6;
    if (eats) {
      if (!tutorial) score += 1;
      const who = PEOPLE[food.kind];
      play('catch', .7); setTimeout(() => play(who.g === 'f' ? 'sighf' : 'sighm', .85), 260);
      sagiSays(pickNo(LINES.catch, 'c'), 2.2); say(`${who.name}: ${pickNo(who.lines, 'p' + food.kind)}`, 2.4);
      food = null;
      if (tutWait && tutWait.id === 'catch') tutWait.done = true;
      if (!tutorial) spawnFood();
    } else {
      if (!tutorial) score += 5;
      play('client', .8); play('bell', .5);
      sagiSays(pickNo(LINES.client, 'cl'), 2.4); popText(x, y - B.t * 0.5, '+5 לקוח Enterprise!', 'gold');
      client = null; clientNext = 18;
    }
    hud();
  }
}
function die(why) {
  if (tutorial) {                                            // the tutorial never ends a ride: back to the start
    play('crash', .5); popText(tx(snake[0].c + 0.5), ty(snake[0].r), 'אופס! עוד פעם', 'bad');
    resetSnake(); if (tutWait && tutWait.id === 'catch') spawnFood({ c: START.c, r: START.r - 4 });
    return;
  }
  moving = false; crash = { why, t: 0 }; humOn(false);
  play('crash', .9); flash();
  if (why === 'ofer') { play('ofer', .9); say(pickNo(LINES.ofer, 'o'), 3, true); }
  else say(pickNo(why === 'self' ? LINES.self : LINES.wall, why), 3, true);
  gameOver(why);
}
function oferStep() {
  const nc = ofer.c + ofer.d;
  if (nc < 0 || nc >= COLS || onSnake(nc, ofer.r, 1)) { ofer.d *= -1; return; }   // he turns around at a wall or at your line
  ofer.pc = ofer.c; ofer.c = nc; ofer.t = 0;
  const h = headPos();
  if (!tutorial && Math.hypot(h.x - ofer.c, h.y - ofer.r) < 0.6) die('ofer');
}
function step(dt) {
  T += dt;
  if (food) food.t += dt;
  for (const s of snake) if (s.join !== undefined && s.join < 1) s.join = Math.min(1, s.join + dt * 4);
  if (moving && !crash) {
    prog += dt * speed();
    while (prog >= 1 && moving) {
      if (!queue.length && blockedAhead() && (grace += dt) < 0.24) { prog = 1; break; }
      grace = 0; prog -= 1; tick();
    }
  }
  placeRiders();
  if (crash) crash.t += dt;
  // Ofer comes out of his meeting once Sagi has 3 listeners
  if (!tutorial && state === 'play' && !ofer && score >= 3) {
    ofer = { c: 0, r: OFR, pc: -1, d: 1, t: 0, step: 0.75, on: true };
    play('ofer', .6); say('עופר יצא מהישיבה! לא להיתקל בו.', 2.6, true);
  }
  if (ofer && ofer.on && !crash) { ofer.t += dt; if (ofer.t >= ofer.step) oferStep(); }
  // the client
  if (!tutorial && state === 'play' && score >= 4 && !crash) {
    if (client) { client.life -= dt; if (client.life <= 0) { popText(tx(client.c + 0.5), ty(client.r), 'הלקוח הלך...', 'bad'); client = null; clientNext = 16; } }
    else if ((clientNext -= dt) <= 0) { const p = freeTile(true); if (p) { client = { ...p, life: 7, max: 7 }; play('client', .35); say('לקוח Enterprise הגיע! רק לכמה שניות.', 2.2); } }
  }
  if (!tutorial && state === 'play' && !crash && (idleT -= dt) <= 0) { idleT = 7 + Math.random() * 4; if (!bubble) sagiSays(pickNo(LINES.idle, 'i'), 2); }
  if (bubble && (bubble.t -= dt) <= 0) bubble = null;
  if (SND.humGain) SND.humGain.gain.value = 0.08 + speed() * 0.012;
}

// ───────────────────────── drawing ─────────────────────────
function sprite(im, cx, bottom, h, flip, alpha = 1) {
  if (!ok(im)) return;
  const w = h * im.naturalWidth / im.naturalHeight;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, bottom); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
}
function shadow(cx, cy, w) { ctx.save(); ctx.fillStyle = '#13294b33'; ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, w / 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
function ring(cx, cy, R, left) {
  ctx.save(); ctx.lineWidth = Math.max(3, R * 0.28); ctx.strokeStyle = '#ffffffcc'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = left < 0.35 ? '#ef4444' : '#facc15'; ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); ctx.stroke(); ctx.restore();
}
// the long scooter: painted grip tape on top, the black body with its red trim showing on the near side, and the
// painted rear wheel + tail light at the end (side view when the tail goes sideways, end-on when it goes up or down)
let gripPat = null, gripFor = 0;
const DECK = 0.25;                                   // his deck's top, above his tile's bottom (in tiles) - the long deck matches it
function drawDeck(pts, tail, t) {
  const n = pts.length, last = pts[n - 1];
  const bx = tail.dx || 0, by = tail.dy || 0;
  const end = { x: last.x - bx * t * 0.36, y: last.y - by * t * 0.36 };
  pts = [...pts, end];
  // split the line into straight runs: sideways (thin, like his deck from the side) or up/down (wide, seen from above)
  const runs = []; let cur = null;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]; if (Math.hypot(b.x - a.x, b.y - a.y) < 0.5) continue;
    const side = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
    if (!cur || cur.side !== side) { cur = { side, p: [a] }; runs.push(cur); }
    cur.p.push(b);
  }
  if (ok(IMG.grip) && gripFor !== t) { gripPat = ctx.createPattern(IMG.grip, 'repeat'); const k = t * 0.9 / 256; gripPat.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0])); gripFor = t; }
  const topY = -DECK * t, th = t * 0.11;              // the deck's top above the floor line, its side's height
  const width = (r) => r.side ? t * 0.07 : t * 0.3;
  const stroke = (style, wAdd, dy, wMul = 1) => { for (const r of runs) { ctx.strokeStyle = style; ctx.lineWidth = width(r) * wMul + wAdd; ctx.beginPath();
    const cy = topY + width(r) / 2; r.p.forEach((q, i) => i ? ctx.lineTo(q.x, q.y + cy + dy) : ctx.moveTo(q.x, q.y + cy + dy)); ctx.stroke(); } };
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  stroke('#13294b40', t * 0.06, th + t * 0.05);   // shadow
  stroke('#0c0c0f', 0, th);                        // the side
  stroke('#e53935', 0, th * 0.55);                 // red trim
  stroke('#1a1a1f', 0, th * 0.25);
  stroke('#3a3a44', 0, 0);                         // the top's rim
  stroke(gripPat || '#222228', 0, 0, 0.8);         // grip tape
  ctx.restore();
  // the rear end
  if (bx) {
    const im = IMG['rear-s']; if (!ok(im)) return;
    const h = t * 0.48, w = h * im.naturalWidth / im.naturalHeight;
    ctx.save(); ctx.translate(end.x, last.y); if (bx < 0) ctx.scale(-1, 1);
    ctx.drawImage(im, -w * 0.3, -h, w, h); ctx.restore();
  } else {
    const im = IMG['rear-b']; if (!ok(im)) return;
    const h = t * 0.5, w = h * im.naturalWidth / im.naturalHeight;
    ctx.save(); ctx.translate(end.x, end.y + topY); if (by > 0) ctx.scale(1, -1);
    ctx.drawImage(im, -w / 2, -h * 0.2, w, h); ctx.restore();
  }
}
function drawBubble(text, hx, hy) {
  const fs = clamp(Math.round(B.t * 0.38), 12, 15), pad = fs * 0.5, maxW = Math.min(W * 0.5, fs * 10);
  ctx.save(); ctx.font = `700 ${fs}px Rubik, system-ui, sans-serif`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const words = text.split(' '), rows = []; let row = '';
  for (const w of words) { const t = row ? row + ' ' + w : w; if (ctx.measureText(t).width > maxW && row) { rows.push(row); row = w; } else row = t; }
  rows.push(row);
  const bw = Math.max(...rows.map((t) => ctx.measureText(t).width)) + pad * 2, bh = rows.length * fs * 1.25 + pad * 1.2;
  const right = hx < W / 2;
  let bx = right ? hx + B.t * 0.5 : hx - B.t * 0.5 - bw, by = hy - bh - B.t * 0.2;
  bx = clamp(bx, 6, W - bw - 6); by = clamp(by, B.y - B.t * 1.2, H - bh - 50);
  ctx.globalAlpha = clamp(bubble ? bubble.t * 3 : 1, 0, 1);
  ctx.fillStyle = '#fffffff2'; ctx.strokeStyle = '#13294b77'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, Math.min(14, bh / 2)); ctx.fill(); ctx.stroke();
  const tx0 = clamp(hx, bx + 12, bx + bw - 12), ty0 = by + bh;
  ctx.beginPath(); ctx.moveTo(tx0 - 7, ty0 - 2); ctx.lineTo(tx0, ty0 + 10); ctx.lineTo(tx0 + 7, ty0 - 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#13294b';
  rows.forEach((t, i) => ctx.fillText(t, bx + bw / 2, by + pad * 0.6 + fs * 1.25 * (i + 0.5)));
  ctx.restore();
}
function draw(now) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#13294b'; ctx.fillRect(0, 0, W, H);
  if (state === 'menu') return;
  const t = B.t, bw = t * COLS, bh = B.th * ROWS;
  // the office walls and floor
  ctx.save(); ctx.fillStyle = '#d9e3ef'; ctx.beginPath(); ctx.roundRect(B.x - 6, B.y - 6, bw + 12, bh + 12, 12); ctx.fill();
  ctx.beginPath(); ctx.rect(B.x, B.y, bw, bh); ctx.clip();
  if (ok(IMG.floor)) ctx.drawImage(IMG.floor, B.x, B.y, bw, bh); else { ctx.fillStyle = '#e8e4dc'; ctx.fillRect(B.x, B.y, bw, bh); }
  ctx.strokeStyle = '#13294b10'; ctx.lineWidth = 1; ctx.beginPath();
  for (let c = 1; c < COLS; c++) { ctx.moveTo(tx(c), B.y); ctx.lineTo(tx(c), B.y + bh); }
  for (let r = 1; r < ROWS; r++) { ctx.moveTo(B.x, ty(r)); ctx.lineTo(B.x + bw, ty(r)); }
  ctx.stroke();
  // Ofer's aisle - a carpet runner
  ctx.fillStyle = (ofer && ofer.on) || (tutorial && STEPS[tut.i].setup === 'ofer') ? '#b91c1c22' : '#13294b0d'; ctx.fillRect(B.x, ty(OFR), bw, B.th);
  ctx.restore();

  // everything that stands on the floor, back to front
  const items = [];
  for (const p of props) items.push({ y: p.r + 1, f: () => {
    const im = IMG['p-' + p.kind]; if (!ok(im)) return;
    // the piece stays inside its own tiles (a little lift for depth), with its shadow on the floor where it blocks
    ctx.save(); ctx.fillStyle = '#13294b2e'; ctx.beginPath(); ctx.roundRect(tx(p.c) + 2, ty(p.r) + 2, p.w * t - 4, B.th - 4, t * 0.18); ctx.fill(); ctx.restore();
    const ar = im.naturalHeight / im.naturalWidth;
    let ww = p.w * t * 0.96, h = ww * ar; if (h > B.th * 1.15) { h = B.th * 1.15; ww = h / ar; }
    ctx.drawImage(im, tx(p.c) + (p.w * t - ww) / 2, ty(p.r + 1) - h - B.th * 0.02, ww, h);
  } });
  const ch = t * 1.7;
  // the one under the marker is the next to hear about the scooter: a painted floor marker + a talk icon over the head
  const marker = (cx, by, w, pulse) => { const im = IMG['ui-marker']; if (!ok(im)) return; const ww = w * (1 + pulse), hh = ww * im.naturalHeight / im.naturalWidth; ctx.drawImage(im, cx - ww / 2, by - hh * 0.62, ww, hh); };
  const icon = (name, cx, top, sz, t0) => { const im = IMG['ui-' + name]; if (!ok(im)) return; const h = sz, w = h * im.naturalWidth / im.naturalHeight, y = top - h - Math.abs(Math.sin(t0 * 3)) * sz * 0.18; ctx.drawImage(im, cx - w / 2, y, w, h); };
  if (food) items.push({ y: food.r + 0.95, f: () => {
    const cx = tx(food.c + 0.5), by = ty(food.r + 1) - t * 0.06;
    marker(cx, by, t * 1.25, Math.sin(food.t * 5) * 0.05);
    sprite(IMG[`c${food.kind}-wait`], cx, by, ch * 0.95, false);
    icon('talk', cx + t * 0.15, by - ch * 0.95, t * 0.6, food.t);
  } });
  if (client) items.push({ y: client.r + 0.95, f: () => {
    const cx = tx(client.c + 0.5), by = ty(client.r + 1) - t * 0.06;
    marker(cx, by, t * 1.5, Math.sin(T * 7) * 0.07);
    sprite(IMG['client-wave'], cx, by, ch, false);
    ring(cx + t * 0.55, by - ch * 0.9, t * 0.22, client.life / client.max);
  } });
  if (ofer && (ofer.on || tutorial)) items.push({ y: ofer.r + 0.97, f: () => {
    const k = clamp(ofer.t / 0.25, 0, 1), c = ofer.pc < 0 ? ofer.c : lerp(ofer.pc, ofer.c, k);
    const cx = tx(c + 0.5), by = ty(ofer.r + 1) - t * 0.05;
    shadow(cx, by, t * 0.8);
    sprite(IMG[(Math.floor(now * 4) % 2) ? 'ofer-1' : 'ofer-2'], cx, by, ch * 1.02, ofer.d < 0);
    icon('alert', cx, by - ch * 1.0, t * 0.5, now);
  } });
  const k = moving ? clamp(prog, 0, 1) : 1;
  // the floor line under each one (screen px): Sagi's tile bottom; his deck's top is DECK above it
  const foot = (p) => ({ x: tx(p.x + 0.5), y: ty(p.y + 1) });
  const pos = snake.map((sg, i) => foot(segPos(sg, i)));
  // Sagi's scooter grows: the deck goes back along his trail from his heel to the last listener, a rear wheel at its end
  if (snake.length > 1 && !crash) {
    const L = (snake.length - 1) * SP, path = [];
    let d = 0; path.push(foot(trail[0]));
    for (let j = 1; j < trail.length; j++) {
      const a = trail[j - 1], b = trail[j], l = Math.hypot(b.x - a.x, b.y - a.y);
      if (d + l >= L) { const u = l ? (L - d) / l : 0; path.push(foot({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) })); break; }
      d += l; path.push(foot(b));
    }
    drawDeck(path, snake[snake.length - 1], t);
  }
  const view = (s) => s.dy < 0 ? ['b', false] : s.dy > 0 ? ['f', false] : ['s', s.face < 0];
  snake.forEach((s, i) => {
    const p = pos[i];
    items.push({ y: (p.y - B.y) / t - 0.1 + (i === 0 ? 0.01 : 0), f: () => {
      const cx = p.x, by = i === 0 ? p.y : p.y - t * 0.22, bounce = Math.abs(Math.sin(now * 10 + i * 0.7)) * t * 0.03;
      const [v, flip] = view(s);
      if (i === 0) {
        if (crash) { shadow(cx, by, t * 1.1); sprite(IMG['sagi-crash'], cx + Math.sin(crash.t * 50) * Math.max(0, 1 - crash.t * 2) * 4, by, ch * 1.05, s.face < 0); return; }
        shadow(cx, by, t * 0.9);
        sprite(IMG['sagi-' + v + (snake.length > 1 && v !== 'f' ? '2' : '')], cx, by - bounce, ch * (v === 's' ? 1.2 : 1.24), flip);
      } else {
        const id = s.kind === 'client' ? 'client' : 'c' + s.kind;
        sprite(IMG[`${id}-${v}`], cx, by - bounce, ch * 1.06 * (0.6 + 0.4 * (s.join ?? 1)), flip, crash ? 0.85 : 1);
      }
    } });
  });
  items.sort((a, b) => a.y - b.y).forEach((it) => it.f());

  if (bubble && snake[0]) {
    const hp = headPos();
    drawBubble(bubble.text, tx(hp.x + 0.5), ty(hp.y + 1) - ch * 1.05);
  }
  // the joystick under the thumb
  if (joy.on) {
    ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.fillStyle = '#13294b55';
    ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 46, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 0.85; ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(joy.x, joy.y, 18, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
}

// ───────────────────────── HUD + screens ─────────────────────────
function hud() { $('scoreTxt').textContent = score; $('speedTxt').textContent = Math.max(1, Math.round((speed() - 3.3) / 0.39) + 1); }
function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id)); }
function showHUD(on) { $('bellBtn').classList.toggle('on', on); $('hud').classList.toggle('on', on); $('strip').classList.toggle('on', on); $('chip').classList.toggle('on', on); }
function bestNum() { return +(store.get(KEY.best) || 0); }
function showBest() {
  const b = bestNum(), d = (store.get(KEY.day) || '').split('|');
  const td = d[0] === today() ? +d[1] : 0;
  $('bestStart').innerHTML = b ? `השיא שלכם: <b>${b}</b> מאזינים` + (td ? ` · היום: <b>${td}</b>` : '') : 'כמה אנשים ישמעו היום על הקורקינט?';
  $('bestOver').innerHTML = b ? `השיא שלכם: <b>${b}</b>` : '';
}
function gameOver(why) {
  state = 'over';
  window.track && window.track('game_over', SLUG); window.VerseFrame && VerseFrame.score(score);   // the verse's daily records
  const b = bestNum(), rec = score > b;
  if (rec) store.set(KEY.best, score);
  const d = (store.get(KEY.day) || '').split('|');
  if (d[0] !== today() || score > +d[1]) store.set(KEY.day, `${today()}|${score}`);
  setTimeout(() => {
    play('over', .6); musicOn(null);
    fxEl.innerHTML = ''; showHUD(false); joyEnd();
    $('overImg').src = why === 'ofer' ? 'assets/ofer-1.webp' : 'assets/sagi-crash.webp';
    $('overH').textContent = why === 'ofer' ? 'עופר תפס אותך!' : why === 'self' ? 'נתקעת בשורה של עצמך!' : 'נפלת מהקורקינט!';
    $('overScore').innerHTML = `${score}<small>מאזינים שמעו על הקורקינט</small>`;
    $('overLine').textContent = score >= 40 ? '״כל טקי-טק יודעת על הקורקינט. מחר – בוסטון!״' : score >= 15 ? '״יופי של קהל. אבל עוד לא סיפרתי להם על הצמיגים...״' : '״רק כמה אנשים? אבל לא סיפרתי להם כלום עדיין!״';
    $('overRec').innerHTML = rec && score ? '<span class="newrec">שיא חדש!</span>' : '';
    showBest(); show('over'); state = 'over';
  }, 1600);
}
$('playBtn').onclick = () => { audioUnlock(); if (!store.get(KEY.tut)) tut.begin(); else startGame(); };
$('howBtn').onclick = () => { audioUnlock(); tut.begin(); };
$('againBtn').onclick = () => { audioUnlock(); startGame(); };
function pause(on) {
  if (state !== 'play' && state !== 'tut') return;
  paused = on; show(on ? 'paused' : null); joyEnd();
  if (SND.ctx) on ? SND.ctx.suspend() : SND.ctx.resume();
}
// the bell - it does nothing, it's just fun
function ringBell() {
  if (paused || (state !== 'play' && state !== 'tut') || crash) return;
  audioUnlock(); play('bell', 2.2);
  const b = $('bellBtn'); b.classList.remove('ring'); void b.offsetWidth; b.classList.add('ring');
  sagiSays(pickNo(LINES.bell, 'b'), 1.4);
  if (tutWait && tutWait.id === 'ring') tutWait.done = true;
}
$('bellBtn').onclick = ringBell;
$('pauseBtn').onclick = () => pause(true);
$('resumeBtn').onclick = () => pause(false);
$('quitBtn').onclick = () => { paused = false; SND.ctx && SND.ctx.resume(); state = 'menu'; moving = false; humOn(false); musicOn(null); tut.end(true); showHUD(false); showBest(); show('start'); };
addEventListener('pagehide', () => { if (SND.ctx) SND.ctx.suspend(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (state === 'play' || state === 'tut') pause(true); else if (SND.ctx) SND.ctx.suspend(); } });
document.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => SND.ctx && SND.ctx.suspend()));

// ───────────────────────── tutorial ─────────────────────────
const tutCard = $('tutCard'), tutHole = $('tutHole');
let tutWait = null;
const spotBoard = () => ({ x: B.x - 4, y: B.y - 4, w: B.t * COLS + 8, h: B.th * ROWS + 8 });
const spotEl = (id) => () => { const r = $(id).getBoundingClientRect(); return { x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 }; };
const spotTile = (o, rows = 2) => () => o() && { x: tx(o().c) - B.t * 0.4, y: ty(o().r + 1 - rows), w: B.t * 1.8, h: B.t * rows + 6 };
const STEPS = [
  { text: 'זה <b>שגיא</b> מטקי-טק. הוא מאוהב בקורקינט שלו – ומדבר רק עליו.', spot: spotBoard, show: 'sagi' },
  { text: '<b>המטרה:</b> לרכוב אל כל מי שבמשרד. מי שנתפס שומע על הקורקינט – ונגרר אחריכם בשורה.', spot: spotEl('scoreBox') },
  { text: '<b>היגוי:</b> שימו אצבע בכל מקום וגררו לכיוון (במחשב: החצים). נסו עכשיו – <b>פנו!</b>', try: 'turn', move: true },
  { text: '🔔 <b>הפעמון</b> של הקורקינט – הוא לא עושה כלום, סתם בשביל הכיף! נסו – <b>צלצלו!</b>', try: 'ring', spot: spotEl('bellBtn') },
  { text: 'נסו: עובד מחכה מולכם – <b>רכבו אליו ותפסו אותו!</b>', try: 'catch', move: true, setup: 'catch' },
  { text: '<b>זהירות:</b> שולחן, עציץ, קיר או השורה של עצמכם = נפילה. וככל שהשורה מתארכת – הקורקינט מהיר יותר.', spot: spotBoard },
  { text: '<b>לקוח Enterprise</b> מופיע רק לכמה שניות – שווה 5 מאזינים. הטבעת = כמה זמן נשאר לו.', setup: 'client', spot: spotTile(() => client) },
  { text: '<b>עופר</b>, הסמנכ״ל, מסתובב במעבר האדום. נתקלתם בו – נגמר. חכו שיעבור.', setup: 'ofer', spot: () => ({ x: B.x - 4, y: ty(OFR) - B.t * 0.9, w: B.t * COLS + 8, h: B.t * 1.9 + 4 }) },
  { text: 'מוכנים? כל טקי-טק צריכה לשמוע על הקורקינט.', spot: spotEl('scoreBox'), last: true },
];
const tut = {
  on: false, i: 0,
  begin() {
    show(null); showHUD(true); state = 'tut'; tutorial = true; this.on = true; this.i = 0; score = 0; T = 0;
    setRows(fitRows()); layout(); buildOffice('tutorial|' + ROWS); foodR = rng('tutorial|food'); nextKind = 2;
    resetSnake(); food = null; client = null; ofer = null; bubble = null; hud();
    musicOn('music-a');
    tutCard.classList.add('on'); this.enter();
  },
  enter() {
    const s = STEPS[this.i];
    tutWait = s.try ? { id: s.try, done: false } : null;
    moving = !!s.move; humOn(moving);
    if (s.move) resetSnake();
    if (s.setup === 'catch') spawnFood({ c: START.c, r: START.r - 4 });
    if (s.setup === 'client') { food = null; client = { c: 7, r: START.r - 1, life: 5, max: 7 }; }
    if (s.setup === 'ofer') { client = null; ofer = { c: 3, r: OFR, pc: 3, d: 1, t: 0, step: 0.55, on: true }; }
    if (s.last) ofer = null;
    if (s.show === 'sagi') sagiSays('שמעת על הקורקינט שלי?', 3);
    $('tutText').innerHTML = s.text;
    $('tutCount').textContent = `${this.i + 1} / ${STEPS.length}`;
    $('tutBar').firstElementChild.style.width = ((this.i + 1) / STEPS.length * 100) + '%';
    $('tutNext').innerHTML = (s.last ? 'שחקו!' : 'הבא') + ' <span class="keyhint">(רווח)</span>';
  },
  next() {
    if (tutWait && !tutWait.done) return;
    play('catch', .3);
    if (++this.i >= STEPS.length) return this.end();
    this.enter();
  },
  end(quiet) {
    this.on = false; tutWait = null; tutCard.classList.remove('on'); $('tutDim').classList.remove('on');
    store.set(KEY.tut, '1'); tutorial = false; food = null; client = null; ofer = null; moving = false; humOn(false);
    if (!quiet) startGame();
  },
  frame() {
    if (!this.on) return;
    const s = STEPS[this.i], sp = s.spot && s.spot();
    const dim = sp && (!(tutWait && !tutWait.done) || s.try === 'ring');
    $('tutDim').classList.toggle('on', !!dim);
    if (dim) Object.assign(tutHole.style, { left: sp.x + 'px', top: sp.y + 'px', width: sp.w + 'px', height: sp.h + 'px' });
    // the card sits where it does not cover the action: at the top while riding (Sagi starts at the bottom), else at the bottom
    if (s.move || s.setup === 'client' || s.show === 'sagi' || s.try === 'ring') { tutCard.style.top = `calc(var(--safe-t) + 54px)`; tutCard.style.bottom = 'auto'; }
    else { tutCard.style.top = 'auto'; tutCard.style.bottom = `calc(env(safe-area-inset-bottom,0px) + 10px)`; }
    if (tutWait && tutWait.done && !tutWait.shown) { tutWait.shown = true; moving = false; humOn(false); $('tutText').innerHTML = s.text + ' <span class="ok">יופי!</span>'; }
    $('tutNext').disabled = !!(tutWait && !tutWait.done);
  },
};
$('tutNext').onclick = () => tut.next();
$('tutSkip').onclick = () => tut.end();
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && paused) return pause(false);
  if (e.key === 'Escape' && state === 'play' && !crash) return pause(true);
  if ((e.key === 'b' || e.key === 'B') && !paused) ringBell();
  if (!tut.on || paused) return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tut.next(); }
  if (e.key === 'Escape') tut.end();
});

// ───────────────────────── the verb chip ─────────────────────────
let chipTxt = '';
function chip() {
  let t = '';
  if (state === 'play' || state === 'tut') {
    if (crash) t = '';
    else if (client && T < 30) t = '<em>מהר!</em> הלקוח מחכה';
    else if (moving && (tutorial || T < 10)) t = '<em>החליקו</em> לצדדים כדי לשנות כיוון';   // gone after the first 10 seconds
  }
  if (t !== chipTxt) { chipTxt = t; $('chip').innerHTML = t; $('chip').style.visibility = t ? 'visible' : 'hidden'; }
}

// ───────────────────────── loop ─────────────────────────
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (!paused && (state === 'play' || state === 'tut' || (state === 'over' && crash))) step(dt);
  if (sayT > 0) { sayT -= dt; if (sayT <= 0) sayEl.classList.remove('on'); }
  draw(now / 1000); chip(); tut.frame();
  requestAnimationFrame(frame);
}
layout(); hud(); showBest(); requestAnimationFrame(frame);

// for the tests
window.SNAKE = {
  get state() { return state; }, get score() { return score; }, get snake() { return snake; }, get food() { return food; }, get client() { return client; },
  get ofer() { return ofer; }, get tut() { return tut.on; }, get tutStep() { return tut.i; }, get tutTry() { return (STEPS[tut.i] || {}).try; }, get moving() { return moving; }, set moving(v) { moving = v; }, setLineForTest(cells, n) {   // cells: the trail's corners, head first (tile coords); n riders
    moving = false; const [c, r] = cells[0], [c2, r2] = cells[1];
    snake = [{ c, r, pc: c2, pr: r2, dx: Math.sign(c - c2), dy: Math.sign(r - r2), face: c < c2 ? -1 : 1, kind: 'sagi' }];
    for (let i = 1; i <= n; i++) snake.push({ kind: i > 6 ? 'client' : i, join: 1, x: c, y: r, face: 1, dx: 0, dy: 0 });
    trail = cells.map(([x, y]) => ({ x, y })); placeRiders();
  }, get dir() { return dir; },
  get B() { return B; }, get props() { return props; }, solid, want, DIRS, startGame, COLS, get ROWS() { return ROWS; }, officeForTest(seed, rows) { setRows(rows); buildOffice(seed); return { grid: grid.slice(), props: props.length, OFR, START }; }, get OFR() { return OFR; },
  setSpeedForTest(v) { window.__spd = v; },
};
