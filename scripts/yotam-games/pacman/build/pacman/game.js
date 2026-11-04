// פקי-טק – Pac-Man on Techy-Tech's floor. Yotam collects "context" through the open space; Erez (a ticket),
// Osnat (HR, "a minute?") and Yaniv (his back) chase him with requests. Coffee = Yotam starts explaining, and they
// run from him; one he catches gets a lecture and walks back to their desk. And Hani: every time he bumps into her he
// says "חני" and she cringes. The fourth time is a talk with HR - a life gone (from "חני – יותם בחדר הישיבות").
'use strict';
const $ = (id) => document.getElementById(id);
const rnd = (a, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const KEY = { best: 'shlomiverse:pacman:best', day: 'shlomiverse:pacman:day', tut: 'shlomiverse:pacman:tut', snd: 'shlomiverse:pacman:snd' };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} },
};
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

// ───────────────────────── the floor ─────────────────────────
// # desk  . context  o coffee  - the kitchen door (chasers only)  G the kitchen  P Yotam
const MAZE = [
  '#############',
  '#...........#',
  '#o##.###.##o#',
  '#...........#',
  '#.##.#.#.##.#',
  '#....#.#....#',
  '###.##.##.###',
  '#...#...#...#',
  '#.#.#...#.#.#',
  '#.#...-...#.#',
  '#.###GGG###.#',
  '#...#####...#',
  '#.#.......#.#',
  '#.#..#.#..#.#',
  '#.#.......#.#',
  '#o..#.P.#..o#',
  '###.#.#.#.###',
  '#.....#.....#',
  '#.###.#.###.#',
  '#...#...#...#',
  '#.#.#.#.#.#.#',
  '#...........#',
  '#############',
];
const COLS = 13, ROWS = 23;
const cell = (x, y) => (MAZE[y] && MAZE[y][x]) || '#';
const open = (x, y, ghost) => { const c = cell(x, y); return c !== '#' && (ghost || (c !== '-' && c !== 'G')); };
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const DOOR_OUT = { x: 6, y: 8 };
let dots = new Set(), powers = new Set();
function fillDots() {
  dots = new Set(); powers = new Set();
  MAZE.forEach((r, y) => [...r].forEach((c, x) => { if (c === '.') dots.add(x + ',' + y); if (c === 'o') powers.add(x + ',' + y); }));
}

// ───────────────────────── art ─────────────────────────
const IMG = {};
const img = (k, src) => { const i = new Image(); i.src = src; i.onload = () => { if (k === 'desk' || k === 'carpet' || PROPS.includes(k)) bakeMaze(); }; IMG[k] = i; return i; };
const PROPS = ['monitor', 'plant', 'papers', 'laptop'];
for (const k of ['carry-laptop', 'yotam-open', 'yotam-closed', 'yotam-explain', 'yotam-sad', 'erez', 'erez-bored', 'osnat', 'osnat-bored', 'yaniv', 'yaniv-bored', 'hani', 'hani-cringe', 'coffee']) img(k, `assets/${k}.webp`);
for (const k of PROPS) img(k, `assets/${k}.webp`);
img('desk', 'assets/desk.jpg'); img('elevator', 'assets/elevator.jpg'); img('carpet', 'assets/carpet.jpg');
const ok = (im) => im && im.complete && im.naturalWidth;
const WITH_LAPTOP = true;   // Yotam carries his laptop (his ask, 4 Nov - false = without it)

// ───────────────────────── lines ─────────────────────────
const LINES = {
  explain: ['זה בעצם deadlock.', 'חסר לך קונטקסט.', 'תן לי להסביר את זה עם מספיק קונטקסט.', 'זה לא bug, זה edge case.', 'שנייה, אני אצייר לך את ה-flow.', 'זה bottleneck קלאסי.'],
  erez: ['יש לך רגע? פתחתי לך ticket.', 'יותם! הדדליין זז למחר.', 'רק שאלה קטנה על ה-pipeline.'],
  osnat: ['יותם, יש לך דקה? משהו קטן.', 'רק רציתי לבדוק שאתה מרגיש שייך!', 'יש לנו סקר שביעות רצון!'],
  yaniv: ['לאט! יש לי אישור מאורתופד.', 'יותם, כואב לי הגב. תסביר מהר.', 'שנתיים פיזיותרפיה, רק מחמיר.'],
  caught: ['זה בסדר. זה בסדר.', 'אוקיי. זה... edge case.', 'לא תכננתי את ה-flow הזה.'],
  hani: ['חני!', 'חני, רגע!', 'אה, חני!', 'חני – שאלה!'],
  haniBack: ['...חנה.', 'חנה.', 'ביקשתי. חנה.', 'אין לי שום קפידא. חנה.'],
  hr: 'משאבי אנוש ביקשו לדבר איתך. ״ישיבה אחת. ארבע פעמים חני.״',
  sorry: ['זה בסדר. זה בסדר.', 'חנה. נכון. מעדכן cache.', 'אוקיי, חנה. רשמתי.'],
  // between floors, in the elevator with Ido: [Yotam, Ido]
  lift: [
    ['עידו, המעלית עוצרת בכל קומה. זה polling. צריך webhooks.', '...רציתי רק קפה.'],
    ['אם כולם לוחצים פעמיים על הכפתור – זה race condition.', 'אני לחצתי פעם אחת.'],
    ['זאת לא שיחת חולין, עידו. זה handshake.', 'אה. היי.'],
    ['חני ביקשה חנה. אני מעדכן את ה-cache.', 'תעדכן מהר.'],
    ['עוד קומה – עוד קונטקסט. זה בסדר, זה בסדר.', 'זאת הקומה שלי. ביי.'],
    ['אתה יודע שהאוזניות שלך הן בעצם rate limiter?', 'כן. בגלל זה הן עליי.'],
  ],
};
function pickNo(list, key) { const last = pickNo[key]; let l = pick(list); if (list.length > 1 && l === last) l = list[(list.indexOf(l) + 1) % list.length]; pickNo[key] = l; return l; }
const bubbles = [];   // { who (entity), text, t }
function bubble(who, text, t = 1.6) { for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].who === who) bubbles.splice(i, 1); bubbles.push({ who, text, t }); }

// ───────────────────────── effects ─────────────────────────
const fxEl = $('fx');
function popText(x, y, text, cls) { const p = document.createElement('div'); p.className = 'pop' + (cls ? ' ' + cls : ''); p.style.left = x + 'px'; p.style.top = y + 'px'; p.textContent = text; fxEl.appendChild(p); setTimeout(() => p.remove(), 900); }
function flash() { const f = document.createElement('div'); f.className = 'flash'; fxEl.appendChild(f); setTimeout(() => f.remove(), 400); }
function banner(text) { const b = document.createElement('div'); b.className = 'banner'; b.innerHTML = text; fxEl.appendChild(b); setTimeout(() => b.remove(), 1600); }
const sayEl = $('say'); let sayT = 0;
function say(text, dur = 2.2, loud = false) { sayEl.textContent = text; sayEl.classList.add('on'); sayEl.classList.toggle('loud', loud); sayT = dur; }

// ───────────────────────── sound ─────────────────────────
const SND = { ctx: null, raw: {}, buf: {}, on: store.get(KEY.snd) !== '0', last: {}, master: null };
const SFX = ['chomp-1', 'chomp-2', 'chomp-3', 'power', 'explain-1', 'explain-2', 'caught', 'hani-1', 'hani-2', 'hr', 'clear', 'start', 'back'];
for (const n of SFX) fetch(`assets/sfx/${n}.mp3`).then((r) => r.ok ? r.arrayBuffer() : null).then((b) => { if (b) { SND.raw[n] = b; decode(n); } }).catch(() => {});
function decode(n) {
  if (!SND.ctx || !SND.raw[n] || SND.buf[n]) return;
  const b = SND.raw[n]; SND.raw[n] = null;
  SND.ctx.decodeAudioData(b).then((x) => { SND.buf[n] = x; }).catch(() => {});
}
function audioUnlock() {
  if (SND.ctx) { if (SND.ctx.state === 'suspended' && !paused) SND.ctx.resume(); return; }
  try { SND.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  SND.master = SND.ctx.createGain(); SND.master.gain.value = SND.on ? 1 : 0; SND.master.connect(SND.ctx.destination);
  for (const n of SFX) decode(n);
}
function play(name, vol = 1) {
  if (!SND.ctx) return;
  const vars = SFX.filter((n) => n === name || n.startsWith(name + '-')).filter((n) => SND.buf[n]);
  if (!vars.length) return;
  let n = pick(vars);
  if (vars.length > 1 && n === SND.last[name]) n = vars[(vars.indexOf(n) + 1) % vars.length];
  SND.last[name] = n;
  const src = SND.ctx.createBufferSource(), gn = SND.ctx.createGain();
  src.buffer = SND.buf[n]; src.playbackRate.value = rnd(.95, 1.05); gn.gain.value = vol;
  src.connect(gn).connect(SND.master); src.start();
}
const SPK = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const MUTE = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
function sndIcons() { document.querySelectorAll('.sndBtn').forEach((b) => { b.innerHTML = SND.on ? SPK : MUTE; }); }
document.querySelectorAll('.sndBtn').forEach((b) => b.onclick = () => { audioUnlock(); SND.on = !SND.on; store.set(KEY.snd, SND.on ? '1' : '0'); if (SND.master) SND.master.gain.value = SND.on ? 1 : 0; sndIcons(); });
sndIcons();

// ───────────────────────── layout ─────────────────────────
const cv = $('cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, L = { t: 20, x0: 0, y0: 0 };
const cssPx = (v) => { const d = document.createElement('div'); d.style.cssText = `position:fixed;top:${v};visibility:hidden`; document.body.appendChild(d); const t = d.getBoundingClientRect().top; d.remove(); return t; };
let mazeCv = null;
function layout() {
  DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  document.body.classList.toggle('turn', W > H * 1.15 && H < 520 && 'ontouchstart' in window);
  const top = cssPx('var(--safe-t)') + 60, bottom = H - 58 - cssPx('env(safe-area-inset-bottom,0px)');
  const t = Math.floor(Math.min((W - 8) / COLS, (bottom - top) / ROWS, 40));
  L = { t, x0: Math.round((W - t * COLS) / 2), y0: Math.round(top + Math.max(0, (bottom - top - t * ROWS) * 0.3)), top, bottom };
  bakeMaze();
}
addEventListener('resize', layout); addEventListener('verseframe', layout);
const px = (x) => L.x0 + (x + 0.5) * L.t, py = (y) => L.y0 + (y + 0.5) * L.t;

// the floor is painted once: carpet, then desks with what is on them
function bakeMaze() {
  if (!L.t) return;
  const t = L.t, c = document.createElement('canvas'); c.width = COLS * t * DPR; c.height = ROWS * t * DPR;
  const g = c.getContext('2d'); g.scale(DPR, DPR);
  if (ok(IMG.carpet)) { const s = Math.max(t * 5, 120); for (let y = 0; y < ROWS * t; y += s) for (let x = 0; x < COLS * t; x += s) g.drawImage(IMG.carpet, x, y, s, s); }
  else { g.fillStyle = '#263247'; g.fillRect(0, 0, COLS * t, ROWS * t); }
  g.fillStyle = '#0006'; g.fillRect(0, 0, COLS * t, ROWS * t);
  const wall = (x, y) => cell(x, y) === '#';
  const edge = (x, y) => x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
  const pat = ok(IMG.desk) ? g.createPattern(IMG.desk, 'repeat') : '#c8a273';
  let seed = 7; const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (!wall(x, y)) continue;
    const ins = t * 0.1;
    const l = wall(x - 1, y) ? 0 : ins, rr = wall(x + 1, y) ? 0 : ins, tp = wall(x, y - 1) ? 0 : ins, bt = wall(x, y + 1) ? 0 : ins;
    g.fillStyle = edge(x, y) ? '#7fa6c9' : pat;
    g.fillRect(x * t + l, y * t + tp, t - l - rr, t - tp - bt);
  }
  // a dark rim where desks meet the corridor
  g.strokeStyle = '#0b1530'; g.lineWidth = Math.max(1.5, t * 0.07);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (!wall(x, y)) continue; const ins = t * 0.1;
    g.beginPath();
    if (!wall(x, y - 1)) { g.moveTo(x * t, y * t + ins); g.lineTo(x * t + t, y * t + ins); }
    if (!wall(x, y + 1)) { g.moveTo(x * t, y * t + t - ins); g.lineTo(x * t + t, y * t + t - ins); }
    if (!wall(x - 1, y)) { g.moveTo(x * t + ins, y * t); g.lineTo(x * t + ins, y * t + t); }
    if (!wall(x + 1, y)) { g.moveTo(x * t + t - ins, y * t); g.lineTo(x * t + t - ins, y * t + t); }
    g.stroke();
  }
  // what sits on the desks
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) {
    if (!wall(x, y)) { continue; }
    const v = r(), k = v < 0.34 ? 'monitor' : v < 0.48 ? 'plant' : v < 0.62 ? 'papers' : v < 0.72 ? 'laptop' : null;
    if (!k || !ok(IMG[k])) continue;
    const s = t * (k === 'plant' ? 0.85 : 0.8), im = IMG[k], ar = im.naturalHeight / im.naturalWidth;
    g.save(); g.translate(x * t + t / 2, y * t + t / 2); g.rotate(Math.floor(r() * 4) * Math.PI / 2);
    g.drawImage(im, -s / 2, -s * ar / 2, s, s * ar); g.restore();
  }
  // the kitchen (the chasers' home) and its door
  g.fillStyle = '#1e3a6b'; g.fillRect(5 * t + 2, 10 * t + 2, 3 * t - 4, t - 4);
  g.fillStyle = '#f472b6'; g.fillRect(6 * t + 2, 9 * t + t * 0.42, t - 4, t * 0.16);
  mazeCv = c;
}

// ───────────────────────── the people ─────────────────────────
// an entity walks tile to tile: (tx, ty) the tile it left, dir, t = how far to the next tile (0..1)
const yotam = { id: 'yotam', tx: 6, ty: 15, dir: null, want: null, t: 0, speed: 5.2 };
const CHASERS = [
  { id: 'erez', home: { x: 6, y: 10 }, release: 0, corner: { x: 11, y: 1 }, speed: 4.6 },
  { id: 'osnat', home: { x: 5, y: 10 }, release: 3, corner: { x: 1, y: 1 }, speed: 4.5 },
  { id: 'yaniv', home: { x: 7, y: 10 }, release: 7, corner: { x: 1, y: 21 }, speed: 3.6 },   // his back: always the slowest
];
const hani = { id: 'hani', tx: 11, ty: 21, dir: 'left', t: 0, speed: 3.2, cringe: 0 };
let state = 'menu', paused = false, tutorial = false, freeze = 0;
let score = 0, lives = 3, level = 1, haniCount = 0, power = 0, chain = 0, modeT = 0, deathT = 0, clearT = 0;
const pos = (e) => { const d = e.dir ? DIRS[e.dir] : [0, 0]; return { x: e.tx + d[0] * e.t, y: e.ty + d[1] * e.t }; };

function resetActors() {
  Object.assign(yotam, { tx: 6, ty: 15, dir: null, want: null, t: 0, stun: 0 });
  for (const c of CHASERS) Object.assign(c, { tx: c.home.x, ty: c.home.y, dir: null, t: 0, mode: 'house', wait: c.release, back: false });
  Object.assign(hani, { tx: 11, ty: 21, dir: 'left', t: 0, cringe: 0 });
  power = 0; chain = 0; modeT = 0; bubbles.length = 0;
}
function startGame() {
  tutorial = false; state = 'play'; score = 0; lives = 3; level = 1; haniCount = 0; deathT = 0; clearT = 0; lift = null; yotam.sad = false;
  fillDots(); resetActors(); freeze = 1.6;
  showHUD(true); show(null); hud(); play('start', .6); banner('קומה 1');
  window.track && window.track('game_start', 'pacman');
}
const spd = (base) => base * (1 + (level - 1) * 0.06);
// scatter / chase like the arcade: 6 s to the corners, 20 s after him, 5 s corners, then after him for good
const chaseNow = () => !(modeT < 6 || (modeT > 26 && modeT < 31));

// ───────────────────────── input: swipe / arrows ─────────────────────────
let sw = null;
cv.addEventListener('pointerdown', (e) => { audioUnlock(); if (lift && lift.t > 0.8) { leaveLift(); return; } sw = { x: e.clientX, y: e.clientY }; });
cv.addEventListener('pointermove', (e) => {
  if (!sw) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  if (Math.hypot(dx, dy) < 18) return;
  steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  sw = { x: e.clientX, y: e.clientY };
});
addEventListener('pointerup', () => { sw = null; });
// a tap (no swipe) = go toward the tap
cv.addEventListener('click', (e) => {
  if (state !== 'play' && state !== 'tut') return;
  const p = pos(yotam), dx = e.clientX - px(p.x), dy = e.clientY - py(p.y);
  if (Math.hypot(dx, dy) < L.t * 0.6) return;
  steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});
const KEYDIR = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
addEventListener('keydown', (e) => { if (KEYDIR[e.key] && (state === 'play' || state === 'tut')) { e.preventDefault(); audioUnlock(); steer(KEYDIR[e.key]); } });
function steer(d) {
  if (paused) return;
  yotam.want = d;
  if (yotam.dir && d === OPP[yotam.dir]) { const v = DIRS[yotam.dir]; yotam.tx += v[0]; yotam.ty += v[1]; yotam.t = 1 - yotam.t; yotam.dir = d; }
  if (tutWait && tutWait.id === 'move') tutWait.moved = true;
}

// ───────────────────────── walking ─────────────────────────
function walk(e, dt, ghost, choose) {
  let move = e.speedNow * dt;
  while (move > 0) {
    if (!e.dir || e.t === 0) {                      // standing on a tile: pick where to go
      const d = choose(e); if (!d) return; e.dir = d;
    }
    const step = Math.min(move, 1 - e.t); e.t += step; move -= step;
    if (e.t >= 1) { const v = DIRS[e.dir]; e.tx += v[0]; e.ty += v[1]; e.t = 0; arrive(e); }
  }
}
function yotamChoose(e) {
  if (e.want && open(e.tx + DIRS[e.want][0], e.ty + DIRS[e.want][1])) return e.want;
  if (e.dir && open(e.tx + DIRS[e.dir][0], e.ty + DIRS[e.dir][1])) return e.dir;
  e.dir = null; return null;
}
// a chaser at a crossing takes the open way (never straight back) that brings it closest to its target
function chaserChoose(c) {
  const opts = Object.keys(DIRS).filter((d) => open(c.tx + DIRS[d][0], c.ty + DIRS[d][1], c.mode === 'eyes' || c.mode === 'leave') && d !== OPP[c.dir]);
  const all = opts.length ? opts : Object.keys(DIRS).filter((d) => open(c.tx + DIRS[d][0], c.ty + DIRS[d][1], true));
  if (c.mode === 'scared') return pick(all);
  const tg = target(c);
  let best = null, bd = 1e9;
  for (const d of all) { const nx = c.tx + DIRS[d][0], ny = c.ty + DIRS[d][1], dd = (nx - tg.x) ** 2 + (ny - tg.y) ** 2; if (dd < bd) { bd = dd; best = d; } }
  return best;
}
function target(c) {
  if (c.mode === 'eyes') return DOOR_OUT;
  if (c.mode === 'leave') return DOOR_OUT;
  if (!chaseNow()) return c.corner;
  const yp = { x: yotam.tx, y: yotam.ty }, v = yotam.dir ? DIRS[yotam.dir] : [0, 0];
  if (c.id === 'osnat') return { x: yp.x + v[0] * 4, y: yp.y + v[1] * 4 };          // she gets ahead of him
  if (c.id === 'yaniv' && (c.tx - yp.x) ** 2 + (c.ty - yp.y) ** 2 < 25) return c.corner;   // close by, his back gives in
  return yp;
}
function haniChoose(h) {
  const opts = Object.keys(DIRS).filter((d) => open(h.tx + DIRS[d][0], h.ty + DIRS[d][1]) && d !== OPP[h.dir]);
  return opts.length ? pick(opts) : OPP[h.dir];
}
function arrive(e) {
  if (e === yotam) {
    const k = e.tx + ',' + e.ty;
    if (dots.has(k)) { dots.delete(k); if (!tutorial) score += 10; play('chomp', .25); }
    if (powers.has(k)) { powers.delete(k); if (!tutorial) score += 50; startPower(); }
    if (!dots.size && !powers.size && state === 'play') levelClear();
    hud();
  } else if (e.mode === 'eyes' && e.tx === DOOR_OUT.x && e.ty === DOOR_OUT.y) {
    e.mode = 'house'; e.tx = e.home.x; e.ty = e.home.y; e.dir = null; e.t = 0; e.wait = 1.2; play('back', .4);
  } else if (e.mode === 'leave' && e.tx === DOOR_OUT.x && e.ty === DOOR_OUT.y) e.mode = 'chase';
}
function startPower() {
  power = Math.max(3.5, 7 - (level - 1) * 0.6); chain = 0; play('power', .6);
  bubble(yotam, 'רגע, אני אסביר.', 1.4);
  for (const c of CHASERS) if (c.mode === 'chase') { c.mode = 'scared'; if (c.dir && c.t > 0) { const v = DIRS[c.dir]; c.tx += v[0]; c.ty += v[1]; c.t = 1 - c.t; } c.dir = c.dir ? OPP[c.dir] : null; }
  if (tutWait && tutWait.id === 'coffee') tutWait.done = true;
}

// ───────────────────────── every frame ─────────────────────────
function step(dt) {
  for (const b of bubbles) b.t -= dt;
  for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].t <= 0) bubbles.splice(i, 1);
  if (lift) { lift.t += dt; if (lift.t >= 5.2) leaveLift(); return; }
  if (deathT > 0) { deathT -= dt; if (deathT <= 0) afterDeath(); return; }
  if (clearT > 0) { clearT -= dt; if (clearT <= 0) nextLevel(); return; }
  if (freeze > 0) { freeze -= dt; return; }
  const still = tutorial && tut.calm();
  modeT += dt;
  if (power > 0) { power -= dt; if (power <= 0) for (const c of CHASERS) if (c.mode === 'scared') c.mode = 'chase'; }
  if (yotam.stun > 0) yotam.stun -= dt;
  else { yotam.speedNow = spd(yotam.speed); walk(yotam, dt, false, yotamChoose); }
  if (!still) {
    for (const c of CHASERS) {
      if (c.mode === 'house') { c.wait -= dt; if (c.wait <= 0) { c.mode = 'leave'; c.dir = null; c.t = 0; } else continue; }
      c.speedNow = c.mode === 'eyes' ? 10 : c.mode === 'scared' ? spd(c.speed) * 0.55 : spd(c.speed);
      walk(c, dt, true, chaserChoose);
    }
    if (hani.cringe > 0) hani.cringe -= dt;
    else { hani.speedNow = spd(hani.speed); walk(hani, dt, false, haniChoose); }
  }
  collide();
}
function near(a, b, r = 0.62) { const p = pos(a), q = pos(b); return Math.abs(p.x - q.x) < r && Math.abs(p.y - q.y) < r; }
function collide() {
  for (const c of CHASERS) {
    if (c.mode === 'house' || c.mode === 'eyes' || !near(yotam, c)) continue;
    if (c.mode === 'scared') {
      chain++; const pts = 200 * 2 ** Math.min(3, chain - 1); if (!tutorial) score += pts;
      c.mode = 'eyes'; play('explain', .7); freeze = 0.35;
      bubble(yotam, pickNo(LINES.explain, 'ex'), 1.8);
      const p = pos(c); popText(px(p.x), py(p.y) - L.t, `⁦+${pts}⁩`);
      hud();
    } else if (c.mode === 'chase' || c.mode === 'leave') {
      if (tutorial) { bubble(c, pickNo(LINES[c.id], c.id), 1.6); bounce(c); continue; }
      bubble(c, pickNo(LINES[c.id], c.id), 2);
      return die(pickNo(LINES.caught, 'cg'));
    }
  }
  if (hani.cringe <= 0 && near(yotam, hani, 0.7)) {
    haniCount++; hani.cringe = 2.6; play('hani', .7);
    bubble(yotam, pickNo(LINES.hani, 'hn'), 1.2); bubble(hani, pickNo(LINES.haniBack, 'hb'), 2.2);
    yotam.stun = 1.5; yotam.dir = null; yotam.t = 0; yotam.want = null;   // she stops him for a word about her name
    setTimeout(() => { if (state === 'play' || state === 'tut') bubble(yotam, pickNo(LINES.sorry, 'so'), 1.2); }, 900);
    $('haniBox').classList.remove('hit'); void $('haniBox').offsetWidth; $('haniBox').classList.add('hit');
    if (tutWait && tutWait.id === 'hani') tutWait.done = true;
    if (haniCount >= 4) {
      haniCount = 0;
      if (!tutorial) { hud(); play('hr', .7); say(LINES.hr, 3, true); return die('זה בסדר. זה בסדר.', true); }
    }
    hud();
  }
}
function bounce(c) { c.mode = 'house'; c.tx = c.home.x; c.ty = c.home.y; c.dir = null; c.t = 0; c.wait = 1.5; }
function die(line, hr) {
  lives--; hud(); play('caught', .7); flash(); deathT = 1.8; yotam.sad = true;
  bubble(yotam, line, 1.8);
  if (lives <= 0) { deathT = 99; setTimeout(gameOver, hr ? 2200 : 1600); }
}
function afterDeath() { yotam.sad = false; resetActors(); freeze = 1.2; }
function levelClear() { clearT = 1.4; play('clear', .7); banner('הקומה נקייה!'); bubble(yotam, 'עכשיו יש לי מספיק קונטקסט.', 1.4); }
let lift = null;   // { t, lines } - Yotam and Ido in the elevator, going up a floor
function nextLevel() { lift = { t: 0, lines: LINES.lift[(level - 1) % LINES.lift.length] }; play('start', .5); }
function leaveLift() { lift = null; level++; fillDots(); resetActors(); freeze = 1.2; banner('קומה ' + level); hud(); }

// ───────────────────────── drawing ─────────────────────────
function drawHead(key, e, scale = 1.32, alpha = 1, wobble = 0) {
  const im = IMG[key]; if (!ok(im)) return;
  const p = pos(e), s = L.t * scale, ar = im.naturalHeight / im.naturalWidth;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(px(p.x), py(p.y)); if (wobble) ctx.rotate(wobble);
  ctx.shadowColor = '#0009'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
  ctx.drawImage(im, -s / 2, -s * ar / 2 - L.t * 0.08, s, s * ar); ctx.restore();
}
let placed = [];
function drawBubble(b) {
  const p = pos(b.who), fs = clamp(Math.round(L.t * 0.48), 12, 17), pad = fs * 0.5, maxW = Math.min(W * 0.5, fs * 10);
  ctx.save(); ctx.font = `700 ${fs}px Rubik, system-ui, sans-serif`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const rows = []; let row = '';
  for (const w of b.text.split(' ')) { const t = row ? row + ' ' + w : w; if (ctx.measureText(t).width > maxW && row) { rows.push(row); row = w; } else row = t; }
  rows.push(row);
  const bw = Math.max(...rows.map((t) => ctx.measureText(t).width)) + pad * 2, bh = rows.length * fs * 1.22 + pad * 1.3;
  const hx = px(p.x), hy = py(p.y) - L.t * 0.7;
  let bx = clamp(hx - bw / 2, 4, W - bw - 4), by = clamp(hy - bh - 6, L.top - 50, H - bh - 60), below = false;
  const hit = (x, y) => placed.some((r) => x < r.x + r.w + 4 && x + bw + 4 > r.x && y < r.y + r.h + 4 && y + bh + 4 > r.y);
  if (hit(bx, by)) { below = true; by = clamp(py(p.y) + L.t * 0.8, L.top - 50, H - bh - 60); }   // the second one goes under the head
  if (hit(bx, by)) bx = clamp(bx + bw * 0.6, 4, W - bw - 4);
  placed.push({ x: bx, y: by, w: bw, h: bh });
  ctx.globalAlpha = Math.min(1, b.t * 4);
  ctx.fillStyle = b.who === hani ? '#fdf2f8f2' : '#f5f9fff2'; ctx.strokeStyle = b.who === hani ? '#f472b6' : '#1e3a6b88'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, Math.min(14, bh / 2)); ctx.fill(); ctx.stroke();
  const tx = clamp(hx, bx + 12, bx + bw - 12);
  if (below) { ctx.beginPath(); ctx.moveTo(tx - 6, by + 1); ctx.lineTo(tx, by - 8); ctx.lineTo(tx + 6, by + 1); ctx.closePath(); ctx.fill(); }
  else { ctx.beginPath(); ctx.moveTo(tx - 6, by + bh - 1); ctx.lineTo(tx, by + bh + 8); ctx.lineTo(tx + 6, by + bh - 1); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = '#0f1d3a';
  rows.forEach((t, i) => ctx.fillText(t, bx + bw / 2, by + pad * 0.65 + fs * 1.22 * (i + 0.5)));
  ctx.restore();
}
function drawLift(now) {
  const im = IMG.elevator; ctx.fillStyle = '#0f1d3a'; ctx.fillRect(0, 0, W, H);
  if (!ok(im)) return;
  const h = Math.min(H - 120, (W - 20) * 1.5), w = h / 1.5, x = (W - w) / 2, y = Math.max(L.top - 10, (H - h) / 2);
  const t = lift.t, slide = t < 0.5 ? (0.5 - t) * 2 : 0;
  ctx.save(); ctx.globalAlpha = 1 - slide; ctx.drawImage(im, x, y + slide * 40, w, h); ctx.restore();
  // the floor number above the doors counts up
  const fl = t < 2.4 ? level : level + 1;
  ctx.save(); ctx.fillStyle = '#ef4444'; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 12; ctx.font = `900 ${Math.round(w * 0.065)}px Rubik`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText((t < 2.4 ? '\u25B2 ' : '') + fl, x + w * 0.5, y + h * 0.055); ctx.restore();
  const say2 = (text, ax, ay, ido, show) => {
    if (!show) return; const fs = Math.max(13, Math.round(w * 0.042)), pad = fs * 0.5, maxW = w * 0.55;
    ctx.save(); ctx.font = `700 ${fs}px Rubik, system-ui, sans-serif`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const rows = []; let row = ''; for (const wd of text.split(' ')) { const tt = row ? row + ' ' + wd : wd; if (ctx.measureText(tt).width > maxW && row) { rows.push(row); row = wd; } else row = tt; } rows.push(row);
    const bw = Math.max(...rows.map((r) => ctx.measureText(r).width)) + pad * 2, bh = rows.length * fs * 1.22 + pad * 1.3;
    const bx = clamp(x + w * ax - bw / 2, 6, W - bw - 6), by = y + h * ay - bh;
    ctx.fillStyle = '#f5f9fff5'; ctx.strokeStyle = ido ? '#64748b' : '#1e3a6b88'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#0f1d3a'; rows.forEach((r, i) => ctx.fillText(r, bx + bw / 2, by + pad * 0.65 + fs * 1.22 * (i + 0.5))); ctx.restore();
  };
  say2(lift.lines[0], 0.3, 0.3, false, t > 0.5);
  say2(lift.lines[1], 0.7, 0.66, true, t > 2.6);
  ctx.save(); ctx.fillStyle = '#cfe0ff'; ctx.font = '700 14px Rubik'; ctx.textAlign = 'center'; ctx.fillText('הקישו כדי להמשיך', W / 2, Math.min(H - 70, y + h + 22)); ctx.restore();
}
function draw(now) {
  if (lift) { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); return drawLift(now); }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#0f1d3a'; ctx.fillRect(0, 0, W, H);
  if (mazeCv) ctx.drawImage(mazeCv, L.x0, L.y0, COLS * L.t, ROWS * L.t);
  const t = L.t;
  // context tokens + coffee
  ctx.save(); ctx.fillStyle = '#7dd3fc'; ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 8;
  for (const k of dots) { const [x, y] = k.split(',').map(Number); ctx.beginPath(); ctx.arc(px(x), py(y), Math.max(2.5, t * 0.12), 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  for (const k of powers) {
    const [x, y] = k.split(',').map(Number), s = t * (1.25 + Math.sin(now * 6) * 0.08), im = IMG.coffee;
    ctx.save(); ctx.strokeStyle = '#facc15'; ctx.globalAlpha = 0.5 + Math.sin(now * 6) * 0.3; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(px(x), py(y), t * 0.62, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    if (ok(im)) { const h = s * im.naturalHeight / im.naturalWidth; ctx.save(); ctx.shadowColor = '#facc15'; ctx.shadowBlur = 16; ctx.drawImage(im, px(x) - s / 2, py(y) - h / 2, s, h); ctx.restore(); }
  }
  if (state === 'play' || state === 'tut' || state === 'over') {
    // Hani, the chasers, then Yotam on top
    drawHead(hani.cringe > 0 ? 'hani-cringe' : 'hani', hani, 1.3, 1, hani.cringe > 0 ? Math.sin(now * 30) * 0.06 : 0);
    for (const c of CHASERS) {
      if (c.mode === 'eyes') { drawHead(c.id + '-bored', c, 0.9, 0.45); continue; }
      const blink = c.mode === 'scared' && power < 1.6 && Math.floor(now * 6) % 2;
      if (c.mode === 'scared') {                                   // "buffering": a cyan bubble with a spinner
        const p = pos(c), cx = px(p.x), cy = py(p.y), R = t * 0.78;
        ctx.save(); ctx.fillStyle = blink ? '#ffffff30' : '#22d3ee40'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = blink ? '#fff' : '#22d3ee'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        const a = now * 7; ctx.beginPath(); ctx.arc(cx, cy, R, a, a + Math.PI * 1.3); ctx.stroke(); ctx.restore();
      }
      drawHead(c.mode === 'scared' && !blink ? c.id + '-bored' : c.id, c, 1.32, c.mode === 'house' ? 0.85 : 1);
      if (c.mode === 'scared') { const p = pos(c); ctx.save(); ctx.fillStyle = '#0f1d3acc'; ctx.beginPath(); ctx.roundRect(px(p.x) - t * 0.6, py(p.y) + t * 0.42, t * 1.2, t * 0.36, 6); ctx.fill(); ctx.fillStyle = '#67e8f9'; ctx.font = `800 ${Math.max(9, Math.round(t * 0.26))}px Rubik`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('buffering...', px(p.x), py(p.y) + t * 0.6); ctx.restore(); }
    }
    const chew = yotam.dir && Math.floor(now * 8) % 2;
    if (power > 0) { const p = pos(yotam); ctx.save(); ctx.fillStyle = '#22d3ee'; ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 24; ctx.globalAlpha = 0.35 + Math.sin(now * 10) * 0.15; ctx.beginPath(); ctx.arc(px(p.x), py(p.y), t * 0.85, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    drawHead(yotam.sad || yotam.stun > 0 ? 'yotam-sad' : power > 0 ? 'yotam-explain' : chew ? 'yotam-closed' : 'yotam-open', yotam, 1.45);
    if (WITH_LAPTOP && ok(IMG['carry-laptop'])) { const p = pos(yotam), im = IMG['carry-laptop'], s = t * 0.72, ar = im.naturalHeight / im.naturalWidth, flip = yotam.dir === 'left' ? -1 : 1; ctx.save(); ctx.translate(px(p.x) + flip * t * 0.5, py(p.y) + t * 0.38); ctx.scale(flip, 1); ctx.rotate(-0.25); ctx.drawImage(im, -s / 2, -s * ar / 2, s, s * ar); ctx.restore(); }
    if (power > 0) {                                                 // the explain bar runs out over the floor
      const full = Math.max(3.5, 7 - (level - 1) * 0.6), w = COLS * t * 0.6, x = L.x0 + (COLS * t - w) / 2, y = L.y0 - 14;
      ctx.save(); ctx.fillStyle = '#0f1d3a'; ctx.fillRect(x - 2, y - 2, w + 4, 10); ctx.fillStyle = '#22d3ee'; ctx.fillRect(x + w * (1 - power / full), y, w * power / full, 6); ctx.restore();
    }
    placed = []; for (const b of bubbles) drawBubble(b);
  }
}

// ───────────────────────── HUD + screens ─────────────────────────
function hud() {
  $('scoreTxt').textContent = score;
  $('floorTxt').textContent = state === 'play' && level > 1 ? `קומה ${level}` : '';
  const lv = $('lives'); if (lv.childElementCount !== Math.max(0, lives)) lv.innerHTML = '<img src="assets/yotam-closed.webp" alt="">'.repeat(Math.max(0, lives));
  [...$('haniBox').children].forEach((d, i) => d.classList.toggle('on', i < haniCount));
}
function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id)); }
function showHUD(on) { $('hud').classList.toggle('on', on); $('strip').classList.toggle('on', on); $('chip').classList.toggle('on', on); }
function bestNum() { return +(store.get(KEY.best) || 0); }
function showBest() {
  const b = bestNum(), d = (store.get(KEY.day) || '').split('|');
  const td = d[0] === today() ? +d[1] : 0;
  $('bestStart').innerHTML = b ? `השיא שלכם: <b>${b}</b>` + (td ? ` · היום: <b>${td}</b>` : '') : 'כמה קומות יותם יעבור?';
  $('bestOver').innerHTML = b ? `השיא שלכם: <b>${b}</b>` : '';
}
function gameOver() {
  state = 'over';
  window.track && window.track('game_over', 'pacman');
  window.VerseFrame && VerseFrame.score && VerseFrame.score(score);
  const b = bestNum(), rec = score > b;
  if (rec) store.set(KEY.best, score);
  const d = (store.get(KEY.day) || '').split('|');
  if (d[0] !== today() || score > +d[1]) store.set(KEY.day, `${today()}|${score}`);
  fxEl.innerHTML = ''; showHUD(false);
  $('overScore').innerHTML = `${score}<small>נקודות · קומה ${level}</small>`;
  $('overLine').textContent = level >= 3 ? '״אני ה-System Architect של החיים עצמם. רק שאף אחד לא פתח לי ticket.״' : score >= 1500 ? '״היה לי כמעט מספיק קונטקסט. כמעט.״' : '״זה בסדר. זה בסדר.״';
  $('overRec').innerHTML = rec && score ? '<span class="newrec">שיא חדש!</span>' : '';
  showBest(); show('over');
}
$('playBtn').onclick = () => { audioUnlock(); if (!store.get(KEY.tut)) tut.begin(); else startGame(); };
$('howBtn').onclick = () => { audioUnlock(); tut.begin(); };
$('againBtn').onclick = () => { audioUnlock(); startGame(); };
function pause(on) {
  if (state !== 'play' && state !== 'tut') return;
  paused = on; show(on ? 'paused' : null);
  if (SND.ctx) on ? SND.ctx.suspend() : SND.ctx.resume();
}
$('pauseBtn').onclick = () => pause(true);
$('resumeBtn').onclick = () => pause(false);
$('quitBtn').onclick = () => { paused = false; SND.ctx && SND.ctx.resume(); state = 'menu'; tut.end(true); showHUD(false); showBest(); show('start'); };
addEventListener('pagehide', () => { if (SND.ctx) SND.ctx.suspend(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (state === 'play') pause(true); else if (SND.ctx) SND.ctx.suspend(); } });
document.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => SND.ctx && SND.ctx.suspend()));

// ───────────────────────── tutorial ─────────────────────────
const tutCard = $('tutCard'), tutHole = $('tutHole');
let tutWait = null;
const spotMaze = () => ({ x: L.x0 - 4, y: L.y0 - 4, w: COLS * L.t + 8, h: ROWS * L.t + 8 });
const spotAt = (e, r = 1.6) => () => { const p = pos(e); return { x: px(p.x) - L.t * r, y: py(p.y) - L.t * r, w: L.t * r * 2, h: L.t * r * 2 }; };
const spotEl = (id) => () => { const r = $(id).getBoundingClientRect(); return { x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 }; };
const STEPS = [
  { text: 'זה <b>יותם</b>, ה-System Architect של טקי-טק. הוא אוסף <b>קונטקסט</b> – הנקודות הכחולות.', spot: spotAt(yotam) },
  { text: '<b>המטרה:</b> לאסוף את כל הקונטקסט בקומה – ואז עולים קומה. כל נקודה = ניקוד.', spot: spotEl('scoreBox') },
  { text: '<b>ארז</b>, <b>אסנת</b> ו<b>יניב</b> רודפים אחריו עם בקשות. תפסו אותו? נפסל יותם אחד מהשלושה.', spot: spotEl('lives') },
  { text: 'נסו עכשיו: <b>החליקו</b> על המסך לכיוון (או הקישו לצד שאליו הוא ילך, או חצים).', try: 'move' },
  { text: '<b>קפה</b> בפינות = יותם נכנס ל<b>מצב הסבר</b> (זוהר כחול). כולם ב-<b>buffering</b> ובורחים – מי שהוא תופס שומע הרצאה וחוזר לשולחן. נקודות כפולות!', spot: () => ({ x: px(1) - L.t, y: py(2) - L.t, w: L.t * 2, h: L.t * 2 }) },
  { text: 'ו<b>חני</b>... כל פעם שיותם נתקל בה הוא אומר <b>״חני״</b> – היא מתכווצת ועוצרת אותו לשנייה וחצי. כאן סופרים.', spot: spotEl('haniBox') },
  { text: 'בפעם הרביעית – <b>שיחה עם משאבי אנוש</b>, ויותם אחד נפסל. אז עוקפים אותה. מוכנים? זה בסדר, זה בסדר.', spot: spotAt(hani), last: true },
];
const tut = {
  on: false, i: 0,
  calm() { return !(tutWait && tutWait.id === 'move'); },   // the others wait while you read
  begin() {
    show(null); showHUD(true); state = 'tut'; tutorial = true; this.on = true; this.i = 0;
    score = 0; lives = 3; level = 1; haniCount = 0; fillDots(); resetActors(); hud();
    tutCard.classList.add('on'); this.enter();
  },
  enter() {
    const s = STEPS[this.i];
    tutWait = s.try ? { id: s.try, done: false, moved: false, from: { x: yotam.tx, y: yotam.ty } } : null;
    $('tutText').innerHTML = s.text;
    $('tutCount').textContent = `${this.i + 1} / ${STEPS.length}`;
    $('tutBar').firstElementChild.style.width = ((this.i + 1) / STEPS.length * 100) + '%';
    $('tutNext').innerHTML = (s.last ? 'שחקו!' : 'הבא') + ' <span class="keyhint">(רווח)</span>';
  },
  next() {
    if (tutWait && !tutWait.done) return;
    play('chomp', .4);
    if (++this.i >= STEPS.length) return this.end();
    this.enter();
  },
  end(quiet) {
    this.on = false; tutWait = null; tutCard.classList.remove('on'); $('tutDim').classList.remove('on');
    store.set(KEY.tut, '1'); tutorial = false;
    if (!quiet) startGame();
  },
  frame() {
    if (!this.on) return;
    if (tutWait && tutWait.id === 'move' && !tutWait.done && tutWait.moved && Math.abs(yotam.tx - tutWait.from.x) + Math.abs(yotam.ty - tutWait.from.y) >= 2) tutWait.done = true;
    const s = STEPS[this.i], sp = s.spot && s.spot();
    const dim = sp && !(tutWait && !tutWait.done);
    $('tutDim').classList.toggle('on', !!dim);
    if (dim) Object.assign(tutHole.style, { left: sp.x + 'px', top: sp.y + 'px', width: sp.w + 'px', height: sp.h + 'px' });
    // the card waits away from what it points at
    const up = sp && sp.y + sp.h / 2 > H * 0.55, side = W >= 900;
    tutCard.style.left = side ? '20px' : ''; tutCard.style.right = side ? 'auto' : ''; tutCard.style.width = side ? '340px' : '';
    tutCard.style.top = side ? `${L.top + 10}px` : up ? `calc(var(--safe-t) + 60px)` : 'auto';
    tutCard.style.bottom = side || up ? 'auto' : `calc(env(safe-area-inset-bottom,0px) + 64px)`;
    if (tutWait && tutWait.done && !tutWait.shown) { tutWait.shown = true; $('tutText').innerHTML = s.text + ' <span class="ok">יופי!</span>'; }
    $('tutNext').disabled = !!(tutWait && !tutWait.done);
  },
};
$('tutNext').onclick = () => tut.next();
$('tutSkip').onclick = () => tut.end();
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && paused) return pause(false);
  if (!tut.on || paused) return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tut.next(); }
  if (e.key === 'Escape') tut.end();
});

// ───────────────────────── the verb chip ─────────────────────────
let chipTxt = '';
function chip() {
  let t = '';
  if (state === 'play' || state === 'tut') {
    if (power > 0) t = 'עכשיו <em>תפסו</em> אותם – הוא מסביר!';
    else if (!yotam.dir) t = '<em>החליקו</em> לכיוון';
    else t = 'אספו <em>קונטקסט</em> · עקפו את חני';
  }
  if (t !== chipTxt) { chipTxt = t; $('chip').innerHTML = t; }
}

// ───────────────────────── loop ─────────────────────────
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (!paused && (state === 'play' || state === 'tut')) step(dt);
  if (sayT > 0) { sayT -= dt; if (sayT <= 0) sayEl.classList.remove('on'); }
  draw(now / 1000); chip(); tut.frame();
  requestAnimationFrame(frame);
}
fillDots(); resetActors(); layout(); hud(); showBest(); requestAnimationFrame(frame);

// for the tests
window.PAC = { get state() { return state; }, get score() { return score; }, get lives() { return lives; }, get level() { return level; }, get haniCount() { return haniCount; }, get lift() { return lift; }, clearFloor() { dots.clear(); powers.clear(); levelClear(); }, meetHani() { Object.assign(hani, { tx: yotam.tx, ty: yotam.ty, t: 0, cringe: 0 }); }, get power() { return power; }, get dots() { return dots.size + powers.size; }, get dotSet() { return new Set([...dots, ...powers]); }, yotam, hani, CHASERS, pos, steer, startGame, open, get tut() { return tut.on; }, get L() { return L; }, px, py };
