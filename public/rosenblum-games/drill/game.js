// הקטר המאסף - Teacher Rosenblum's shelter drill, Lemmings-style (scripts/rosenblum-games/drill/idea.md).
// The class walks out two by two and goes wherever its feet lead; the player gives Rosenblum's orders
// as JOBS that serve everyone behind (Lemmings): עצור holds the column, הכוונה points everyone one way, גשר lays chairs
// over a hole, מדרגות builds desk-stairs to the floor below, פתח opens a locked door. Shahar - the קטר מאסף - last.
'use strict';
(() => {
const SLUG = 'drill';
const store = {
  get(k) { try { return localStorage.getItem('shlomiverse:' + SLUG + ':' + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('shlomiverse:' + SLUG + ':' + k, String(v)); } catch (e) {} },
};
const $ = (s) => document.querySelector(s);
// the building's height is fixed; its WIDTH follows the screen (more corridor, never stretched) - set by fitWorld()
let W = 300;
const H = 540;
const F = [120, 250, 380, 510];             // the floors' walking surface
// levels are written on a 360-wide plan; X() puts a plan x into this building
const X = (x) => 8 + (x - 8) * (W - 16) / 344;
const SLAB = 14, HEAD = 34, STEP = 6, KID = 46;
function fitWorld() {
  const st = $('#stage').getBoundingClientRect();
  W = Math.round(Math.max(270, Math.min(420, H * st.width / Math.max(1, st.height))));
}
const V = 24, V_SHAHAR = 29, V_REUT = 33;
const FALL_SAFE = 60;                       // a longer drop = to the nurse
const SPAWN_EVERY = 1.5;
const BASE = 1.6;                           // the world runs this much faster than the clock (his ask: faster by default)
const PAIRS = 14;                           // 14 pairs + Shahar = 29 students
const STUDENTS = PAIRS * 2 + 1;

// ---------- levels ----------
// slabs [floor, a, b] | ramps [floor, topX, dir, len] (stairs down to the next floor) | walls [floor, x]
// locked [floor, x] (a locked door - פתח) | zones [type, floor, x] wc / yard | reut {f, from, to, every, first}
// zones [type, floor, x, side]: side = 1 - the one toilets door the column walks past; a runner heads for it
// wet [floor, a, b]: a wet floor - whoever steps on it slips (to the nurse) unless a גשר of chairs covers it,
// or the class is turned away from it (הכוונה) when there is another way down
const LEVELS = [
  { name: 'שניים שניים', text: 'החצר מימין, וחור ברצפה למטה. שתי הוראות.', quota: 25, time: 150,
    orders: { guide: 1, bridge: 1 }, mischief: { every: 15 },
    slabs: [[0, 110, 352], [1, 8, 180], [1, 240, 262], [2, 90, 352], [3, 8, 352]], ramps: [[0, 110, -1, 92], [1, 262, 1, 90], [2, 90, -1, 80]],
    zones: [['yard', 0, 322], ['wc', 2, 110, 1]], start: [0, 200, 1], exit: [3, 250] },
  { name: 'רצפה רטובה', text: 'בקומה 2: קצה מימין ושלולית משמאל. מה קודם?', quota: 25, time: 160,
    orders: { guide: 1, bridge: 1 }, mischief: { every: 15 },
    slabs: [[0, 8, 180], [1, 90, 340], [2, 8, 260], [3, 8, 352]], ramps: [[0, 180, 1, 100], [1, 90, -1, 80], [2, 260, 1, 90]],
    wet: [[1, 150, 220]], zones: [['wc', 2, 24, 1]], start: [0, 40, 1], exit: [3, 180] },
  { name: 'בירידה אין שירותים', text: 'שירותים, חור, ושלולית ליד המקלט.', quota: 25, time: 160,
    orders: { guide: 1, bridge: 2 }, mischief: { every: 15 },
    slabs: [[0, 8, 120], [1, 90, 352], [2, 8, 150], [2, 210, 262], [3, 8, 352]], ramps: [[0, 120, 1, 100], [1, 90, -1, 80], [2, 262, 1, 90]],
    wet: [[3, 230, 300]], zones: [['wc', 1, 322]], start: [0, 40, 1], exit: [3, 180] },
  { name: 'מדרגות משולחנות', text: 'החצר פתוחה, ושתי קומות בלי מדרגות.', quota: 27, time: 160,
    orders: { guide: 1, stairs: 2 }, mischief: { every: 14 },
    slabs: [[0, 8, 160], [1, 140, 352], [2, 8, 220], [3, 8, 352]], ramps: [[0, 160, 1, 100]],
    zones: [['yard', 1, 340], ['wc', 1, 150, 1]], start: [0, 40, 1], exit: [3, 180] },
  { name: 'דלת נעולה', text: 'ארבע הוראות. תחשבו איפה הגשר הכי חשוב.', quota: 27, time: 170,
    orders: { open: 1, guide: 1, bridge: 1, stairs: 1 }, mischief: { every: 13 },
    slabs: [[0, 8, 200], [1, 60, 352], [2, 8, 250], [3, 8, 352]], ramps: [[0, 200, 1, 100], [1, 60, -1, 50]],
    locked: [[0, 150]], wet: [[1, 320, 345], [3, 230, 300]], zones: [['yard', 0, 20], ['wc', 2, 24, 1]], start: [0, 40, 1], exit: [3, 200] },
  { name: 'הכיתה של רעות', text: 'שלולית בקומה 2, והכיתה של רעות למטה.', quota: 25, time: 180,
    orders: { stop: 2, bridge: 1 }, mischief: { every: 14 },
    slabs: [[0, 8, 230], [1, 100, 352], [2, 8, 260], [3, 8, 352]], ramps: [[0, 230, 1, 100], [1, 100, -1, 90], [2, 260, 1, 90]],
    wet: [[1, 200, 260]], zones: [['wc', 1, 115, 1]], reut: { f: 3, from: 22, to: 340, every: 22, first: 34 }, start: [0, 56, 1], exit: [3, 260] },
  { name: 'זה לא תהלוכה', text: 'חצר, חור, קצה – ורעות למטה.', quota: 25, time: 200,
    orders: { guide: 1, bridge: 1, stairs: 1, stop: 2 }, mischief: { every: 13 },
    slabs: [[0, 110, 352], [1, 8, 180], [1, 240, 262], [2, 150, 352], [3, 8, 352]], ramps: [[0, 110, -1, 92], [1, 262, 1, 90]],
    zones: [['yard', 0, 322], ['wc', 2, 345, 1]], reut: { f: 3, from: 340, to: 22, every: 26, first: 40 }, start: [0, 200, 1], exit: [3, 70] },
  { name: 'מחליקים במסדרון', text: 'רצפה רטובה, חור, ורעות למטה.', quota: 25, time: 190,
    orders: { bridge: 2, stop: 2 }, mischief: { every: 13 },
    slabs: [[0, 100, 352], [1, 8, 200], [2, 140, 352], [3, 8, 352]], ramps: [[0, 100, -1, 90], [1, 262, 1, 90], [2, 140, -1, 100]],
    wet: [[0, 150, 220]], zones: [['wc', 2, 155, 1]], reut: { f: 3, from: 340, to: 22, every: 24, first: 26 }, start: [0, 300, -1], exit: [3, 130] },
  { name: 'סוגרים רווחים', text: 'דלת, קצה, שלולית – ורעות. והזמן קצר.', quota: 25, time: 170,
    orders: { open: 1, stairs: 1, bridge: 1, stop: 2 }, mischief: { every: 12 },
    slabs: [[0, 8, 240], [1, 100, 352], [2, 8, 260], [3, 8, 352]], ramps: [[0, 240, 1, 100], [2, 260, 1, 90]],
    locked: [[0, 160]], wet: [[2, 120, 180]], zones: [['yard', 0, 22], ['wc', 2, 24, 1]], reut: { f: 3, from: 22, to: 340, every: 26, first: 40 },
    start: [0, 60, 1], exit: [3, 290] },
  { name: 'מה השמחה הגדולה?', text: 'חור, שלולית, חור – ורעות.', quota: 25, time: 200,
    orders: { bridge: 2, stairs: 1, stop: 2 }, mischief: { every: 12 },
    slabs: [[0, 8, 150], [0, 210, 262], [1, 90, 352], [2, 8, 140], [2, 200, 262], [3, 8, 352]], ramps: [[0, 262, 1, 90], [1, 90, -1, 80], [2, 262, 1, 90]],
    wet: [[1, 150, 250]], zones: [['wc', 1, 100, 1]], reut: { f: 3, from: 340, to: 22, every: 26, first: 40 }, start: [0, 40, 1], exit: [3, 270] },
  { name: 'כולם ביחד', text: 'הכוונה, גשר, פתח, מדרגות ועצור – הכול בשלב אחד.', quota: 23, time: 210,
    orders: { guide: 1, bridge: 1, open: 1, stairs: 1, stop: 2 }, mischief: { every: 13 },
    slabs: [[0, 110, 352], [1, 8, 170], [1, 230, 262], [2, 150, 352], [3, 8, 352]], ramps: [[0, 110, -1, 92], [1, 262, 1, 90]],
    locked: [[2, 250]], zones: [['yard', 0, 322], ['wc', 1, 20, 1]], reut: { f: 3, from: 340, to: 22, every: 26, first: 40 },
    start: [0, 200, 1], exit: [3, 70] },
  { name: 'הצופר האחרון', text: 'הכול ביחד. רבותיי וגבירותיי – עיניים אליי.', quota: 25, time: 210,
    orders: { stop: 2, open: 1, bridge: 2 }, mischief: { every: 12 },
    slabs: [[0, 8, 236], [1, 120, 352], [2, 8, 190], [2, 250, 262], [3, 8, 352]], ramps: [[0, 236, 1, 100], [1, 120, -1, 100], [2, 262, 1, 90]],
    locked: [[0, 150]], wet: [[1, 200, 300]], zones: [['yard', 0, 22], ['wc', 1, 130, 1]], reut: { f: 3, from: 30, to: 340, every: 26, first: 30 },
    start: [0, 60, 1], exit: [3, 230] },
];

const TIPS = ["\"הכוונה!\" לזוג הראשון לפני החצר – כולם יסתובבו אל המדרגות. בקומה 2: \"גשר!\" לזוג הראשון לפני החור.", "בקומה 2 יש קצה מימין: \"הכוונה!\" לזוג הראשון שנוחת שם – כולם יפנו שמאלה. ואז \"גשר!\" לזוג הבא – לפני השלולית.", "\"הכוונה!\" לזוג הראשון בקומה 2 לפני השירותים. \"גשר!\" לחור בקומה 1. ו\"גשר!\" שני לשלולית ליד המקלט.", "\"הכוונה!\" לזוג הראשון שנוחת בקומה 2 – לפני החצר. \"מדרגות!\" לזוג הבא – לקצה משמאל. ובקומה 1: שוב \"מדרגות!\".", "\"פתח!\" לזוג הראשון. בקומה 2 – \"הכוונה!\" (לא גשר!) לפני השלולית. \"מדרגות!\" לקצה בקומה 1. ואת הגשר – לשלולית ליד המקלט.", "\"גשר!\" לזוג הראשון בקומה 2 – לפני השלולית. ולמטה: כשסימן ! מהבהב בדלת של רעות – \"עצור!\" בקומה 1, וכשהיא עוברת – לשחרר.", "\"הכוונה!\" לפני החצר, \"גשר!\" לחור בקומה 2, \"מדרגות!\" לקצה בקומה 1 – ו\"עצור!\" בקומה 1 כשרעות עוברת, ואז לשחרר.", "\"גשר!\" לזוג הראשון – לשלולית. \"גשר!\" לזוג הראשון בקומה 2 – לחור. ולמטה: \"עצור!\" בקומה 1 כשרעות עוברת.", "\"פתח!\" לזוג הראשון. \"מדרגות!\" לקצה בקומה 2. \"גשר!\" לשלולית בקומה 1. ו\"עצור!\" כשרעות עוברת – ואז לשחרר.", "\"גשר!\" לחור בקומה 3, \"גשר!\" לשלולית בקומה 2, \"מדרגות!\" לחור בקומה 1 – ו\"עצור!\" לפני החור כשרעות עוברת.", "לפי הסדר: \"הכוונה!\" לפני החצר, \"גשר!\" לחור בקומה 2, \"פתח!\" לדלת בקומה 1, \"מדרגות!\" לקצה שאחריה – ו\"עצור!\" כשרעות עוברת.", "\"פתח!\" לזוג הראשון, \"גשר!\" לשלולית בקומה 2, \"גשר!\" לחור בקומה 1, ו\"עצור!\" כשרעות עוברת."];
const ORDERS = ['stop', 'guide', 'bridge', 'stairs', 'open'];
const ORDER_NAME = { stop: 'עצור!', guide: 'הכוונה!', bridge: 'גשר!', stairs: 'מדרגות!', open: 'פתח!' };

// ---------- assets ----------
const IMG = {}, SPR = {};
const imgNames = ['pairA', 'pairB', 'pairC', 'shahar', 'omer', 'block', 'build', 'open', 'fall', 'cheer', 'turn', 'sad', 'reut', 'reutKids', 'rosen',
  'doorClass', 'doorWc', 'doorYard', 'doorShelter', 'doorLocked', 'stairs', 'cone', 'chair', 'ball', 'point', 'key', 'wetSign', 'puddle', 'btnStop', 'btnGuide', 'btnBridge', 'btnStairs', 'btnOpen', 'board', 'lockers', 'plant', 'exitSign'];
function loadImg(n, src) { return new Promise((r) => { const i = new Image(); i.onload = () => { IMG[n] = i; r(); }; i.onerror = () => r(); i.src = src; }); }
const ready = fetch('assets/sprites.json').then((r) => r.json()).then((m) => { Object.assign(SPR, m); return Promise.all([
  ...imgNames.map((n) => loadImg(n, 'assets/' + n + '.webp')),
  loadImg('wall', 'assets/wall2.jpg'), loadImg('shelter', 'assets/shelter2.jpg'), loadImg('concrete', 'assets/concrete.jpg'), loadImg('slab', 'assets/slab.jpg')]); });

// ---------- sound ----------
const SND = { music: 'music' };
const SFX = { siren: 1, steps: 1, chatter: 1, stop: 2, chair: 3, door: 2, turn: 2, lost: 3, saved: 3, fall: 1, tap: 1, win: 1, lose: 1, bonk: 1 };
const audio = { on: store.get('sound') !== '0', ctx: null, buf: {}, last: {}, loops: {}, log: [] };
function audioInit() {
  if (audio.ctx) return;
  try { audio.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  const files = ['music'];
  for (const [k, n] of Object.entries(SFX)) { if (n === 1) files.push(k); else for (let i = 1; i <= n; i++) files.push(k + i); }
  for (const f of files) {
    fetch(f === 'music' ? 'assets/music.mp3' : 'assets/sfx/' + f + '.mp3').then((r) => r.arrayBuffer())
      .then((b) => audio.ctx.decodeAudioData(b)).then((d) => { audio.buf[f] = d; if (f === 'music' && game.mode === 'play') loop('music', 0.35); }).catch(() => {});
  }
}
function play(name, vol = 1) {
  audio.log.push(name);
  if (!audio.on || !audio.ctx) return;
  const n = SFX[name] || 1;
  let file = name;
  if (n > 1) { let i; do { i = 1 + Math.floor(Math.random() * n); } while (i === audio.last[name] && n > 1); audio.last[name] = i; file = name + i; }
  const b = audio.buf[file]; if (!b) return;
  const s = audio.ctx.createBufferSource(), g = audio.ctx.createGain();
  s.buffer = b; g.gain.value = vol; s.connect(g).connect(audio.ctx.destination); s.start();
  return s;
}
function loop(name, vol) {
  if (!audio.on || !audio.ctx || audio.loops[name] || !audio.buf[name]) return;
  const s = audio.ctx.createBufferSource(), g = audio.ctx.createGain();
  s.buffer = audio.buf[name]; s.loop = true; g.gain.value = vol; s.connect(g).connect(audio.ctx.destination); s.start();
  audio.loops[name] = { s, g };
}
function unloop(name) { const l = audio.loops[name]; if (l) { try { l.s.stop(); } catch (e) {} delete audio.loops[name]; } }
function stopAll() { for (const k of Object.keys(audio.loops)) unloop(k); }
addEventListener('pagehide', () => { stopAll(); if (audio.ctx) audio.ctx.suspend(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (game.mode === 'play' && !game.paused) setPause(true); stopAll(); } });

// ---------- the world ----------
let L, mask, walkers, chairs, doors, reutCol, fx, game = { mode: 'menu', level: 0, paused: false, speed: 1, sel: 'stop' };
const solid = (x, y) => { x |= 0; y |= 0; if (x < 0 || x >= W) return 1; if (y < 0) return 0; if (y >= H) return 1; return mask[y * W + x]; };
function fill(x0, y0, x1, y1, v) {
  x0 = Math.max(0, Math.floor(x0)); x1 = Math.min(W, Math.ceil(x1)); y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(H, Math.ceil(y1));
  for (let y = y0; y < y1; y++) mask.fill(v, y * W + x0, y * W + x1);
}
const ceilY = (f) => f === 0 ? 0 : F[f - 1] + SLAB;
function rampY(r, x) { const u = (x - r.x0) / (r.x1 - r.x0); return r.y0 + u * (r.y1 - r.y0); }

function buildLevel(i) {
  const d = LEVELS[i];
  L = { ...d, i, ramps: [], zones: [], walls: [] };
  mask = new Uint8Array(W * H);
  fill(0, 0, 8, H, 1); fill(W - 8, 0, W, H, 1);              // outer walls
  fill(0, F[3], W, H, 1);                                     // ground
  L.slabs = d.slabs.map(([f, a, b]) => [f, X(a), X(b)]);
  for (const [f, a, b] of L.slabs) fill(a, F[f], b, F[f] + SLAB, 1);
  for (const [f, x, dir, len] of d.ramps) L.ramps.push({ f, x0: X(x), y0: F[f], x1: X(x + dir * len), y1: F[f + 1], d: dir });
  for (const [f, x] of d.walls || []) { fill(X(x) - 4, ceilY(f), X(x) + 4, F[f], 1); L.walls.push({ f, x: X(x) }); }
  doors = (d.locked || []).map(([f, x]) => ({ f, x: X(x), open: false, t: 0 }));
  L.lostLeft = STUDENTS - d.quota;
  L.wet = (d.wet || []).map(([f, a, b]) => ({ f, a: X(a), b: X(b), covered: false }));
  for (const dr of doors) fill(dr.x - 5, F[dr.f] - 52, dr.x + 5, F[dr.f], 1);
  for (const [t, f, x, side] of d.zones || []) L.zones.push({ t, f, x: X(x), side: !!side });
  L.cls = { f: d.start[0], x: X(d.start[1]) };
  L.ex = { f: d.exit[0], x: X(d.exit[1]) };
  if (d.reut) L.reut = { ...d.reut, from: X(d.reut.from), to: X(d.reut.to), every: d.reut.every * W / 300, first: d.reut.first * W / 300 };
  walkers = []; chairs = []; fx = [];
  reutCol = { members: [], next: L.reut ? L.reut.first : Infinity, warn: 0 };
  L.left = { stop: 0, guide: 0, bridge: 0, stairs: 0, open: 0, ...d.orders };
  L.k = W / 300; L.t = 0; L.timeLeft = d.time * L.k; L.spawned = 0; L.spawnT = 0.8; L.saved = 0; L.lostN = 0; L.savedOrder = [];
  L.over = false; L.lines = {}; L.counting = 0; L.mischT = d.mischief ? 9 + d.mischief.every * 0.4 : Infinity;
  L.decor = makeDecor(i);
}
function makeDecor(i) {
  // boards / lockers / plants on the back walls, away from doors and stairs, the same every time
  let s = 1234 + i * 977; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const out = [];
  for (let f = 0; f < 3; f++) {
    const busy = [L.cls.f === f ? L.cls.x : -99, ...L.zones.filter((z) => z.f === f).map((z) => z.x), ...doors.filter((d) => d.f === f).map((d) => d.x),
      ...(L.reut && L.reut.f === f ? [L.reut.from, L.reut.to] : [])];
    for (const r of L.ramps) if (r.f === f || r.f + 1 === f) for (let x = Math.min(r.x0, r.x1); x <= Math.max(r.x0, r.x1); x += 20) busy.push(x);
    for (let k = 0; k < 4; k++) {
      const x = 26 + rnd() * (W - 52), kind = ['board', 'lockers', 'plant', 'board'][Math.floor(rnd() * 4)];
      if (busy.some((b) => Math.abs(b - x) < 46) || out.some((o) => o.f === f && Math.abs(o.x - x) < 60)) continue;
      out.push({ f, x, kind });
    }
  }
  return out;
}

function spawn() {
  const k = L.spawned;
  const kind = k === PAIRS ? 'shahar' : k === 1 ? 'omer' : 'pair';
  const spr = kind === 'shahar' ? 'shahar' : kind === 'omer' ? 'omer' : ['pairA', 'pairB', 'pairC'][k % 3];
  walkers.push({ id: k, kind, spr, x: L.cls.x, y: F[L.cls.f], d: L.start[2], st: 'walk', ramp: null, armed: null, t: 0, out: 0,
    ph: Math.random() * 4, fy0: 0, flash: 0, turnT: 0, fade: 1 });
  L.spawned++;
  if (k === 0) play('steps', 0.5);
}
const nStudents = (w) => w.kind === 'shahar' ? 1 : 2;
const active = (w) => w.st === 'walk' || w.st === 'slip' || w.st === 'guide' || w.st === 'stairs' || w.st === 'fall' || w.st === 'block' || w.st === 'build' || w.st === 'open';

function lose(w, why) {
  if (!active(w)) return;
  w.st = why === 'reut' ? 'tag' : 'gone'; w.why = why; w.t = 0;
  L.lostN += nStudents(w);
  const words = { wc: 'לשירותים', yard: 'לחצר', nurse: 'לאחות', slip: 'החליק – לאחות', reut: 'עם רעות', cls: 'חזר לכיתה', time: '' };
  floatText(w.x, w.y - 40, words[why], '#ffd2c8');
  if (why === 'nurse') play('fall'); else play('lost', 0.9);
  if (w.kind === 'shahar' && why === 'cls') { say('עומר, איפה שחר?', 'angry', 2600); setTimeout(() => bubble('omer', 'בכיתה, המורה. אמרת לו לחזור אחורה.'), 1300); }
  else if (why === 'wc') sayOnce('wc', ['בירידה אין שירותים! מתאפקים עד לסיום התרגיל!', 'אמרתי: לא עוזבים ידיים, גם לא לשירותים!'], 'angry');
  else if (why === 'yard') sayOnce('yard', ['זה לא תהלוכה, זה תרגיל!', 'מה פתאום חצר?! מה פתאום כדור?!'], 'angry');
  else if (why === 'slip') sayOnce('slip', ['רצפה רטובה! לא רצים! גשר כיסאות – מהר!'], 'angry');
  else if (why === 'nurse') sayOnce('nurse', ['בצורה מסודרת ומאורגנת! לא קופצים!', 'במדרגות לא רצים, ובחורים לא קופצים!'], 'angry');
  else if (why === 'reut') sayOnce('reut', ['לא להיגרר אחרי כיתות אחרות!', 'לכל כיתה יש מחנך וקטר מאסף משלה!'], 'angry');
}
function save(w) {
  w.st = 'in'; w.t = 0;
  L.saved += nStudents(w); L.savedOrder.push(w.kind);
  play('saved', 0.8);
  const a = L.saved - nStudents(w) + 1;
  floatText(L.ex.x - 26, F[L.ex.f] - 52, nStudents(w) === 2 ? NUM[a] + ', ' + NUM[a + 1] : NUM[a], '#fff6c8');
  L.counting = 0.6;
  if (L.saved <= 2) sayOnce('in', ['להיכנס פנימה! עד הסוף! לא להיעצר לי בפתח!'], 'talk');
  if (w.kind === 'shahar') {
    if (walkers.some((o) => o !== w && active(o))) sayOnce('shaharEarly', ['שחר! אתה הקטר המאסף! אתה סוגר את הטור, לא פותח אותו!'], 'angry');
  }
}
const NUM = ['', 'אחד', 'שניים', 'שלושה', 'ארבעה', 'חמישה', 'שישה', 'שבעה', 'שמונה', 'תשעה', 'עשרה', 'אחד־עשר', 'שנים־עשר', 'שלושה־עשר',
  'ארבעה־עשר', 'חמישה־עשר', 'שישה־עשר', 'שבעה־עשר', 'שמונה־עשר', 'תשעה־עשר', 'עשרים', 'עשרים ואחד', 'עשרים ושניים', 'עשרים ושלושה',
  'עשרים וארבעה', 'עשרים וחמישה', 'עשרים ושישה', 'עשרים ושבע', 'עשרים ושמונה', 'עשרים ותשעה', 'שלושים'];

function step(dt) {
  if (L.over) return;
  L.t += dt; L.timeLeft -= dt;
  // the class comes out of the classroom, a pair at a time, Shahar last
  if (L.spawned <= PAIRS) { L.spawnT -= dt; if (L.spawnT <= 0) { spawn(); L.spawnT = SPAWN_EVERY; } }
  if (L.counting > 0) L.counting -= dt;
  // Reut's class
  if (L.reut) stepReut(dt);
  if (L.mischief) stepMischief(dt);
  for (const w of walkers) stepWalker(w, dt);
  // the column bunches up = an ant swarm
  if (L.t > 6 && !L.lines.ants) {
    const moving = walkers.filter((w) => w.st === 'walk' && !w.ramp);
    for (const w of moving) { if (moving.filter((o) => Math.abs(o.x - w.x) < 30 && Math.abs(o.y - w.y) < 6).length >= 5) { sayOnce('ants', ['אני רוצה לראות טור! לא נחיל של נמלים!'], 'angry'); break; } }
  }
  // Shahar overtaking the column
  const sh = walkers.find((w) => w.kind === 'shahar' && w.st === 'walk');
  if (sh && !L.lines.run) for (const o of walkers) if (o !== sh && o.st === 'walk' && o.d === sh.d && Math.abs(o.y - sh.y) < 4 && (sh.x - o.x) * sh.d > 0 && (sh.x - o.x) * sh.d < 6) { sayOnce('run', ['שחר! לאן אתה רץ?! אתה הקטר המאסף! תחזור למקומך!'], 'angry'); break; }
  // everyone else done -> the ones still blocking walk on by themselves
  const job = (w) => w.st === 'block' || w.st === 'guide';
  const reutOut = L.reut && (reutCol.members.length || reutCol.warn);
  if (L.spawned > PAIRS && !reutOut && !walkers.some((w) => active(w) && !job(w) && !w.waiting)) for (const w of walkers) if (job(w)) { if (w.gd) w.d = w.gd; w.st = 'walk'; w.t = 0; }
  if (L.lostN > L.lostLeft && !L.asked && !tut.on) { L.asked = true; setTimeout(() => { if (game.mode === 'play' && !L.over) { game.paused = true; stopAll(); $('#ask').hidden = false; } }, 700); }
  const live = walkers.some((w) => active(w)) || L.spawned <= PAIRS;
  if (!live || L.timeLeft <= 0) finish();
}

function stepWalker(w, dt) {
  w.t += dt; if (!w.waiting) w.ph += dt * 8; if (w.flash > 0) w.flash -= dt; if (w.turnT > 0) w.turnT -= dt; if (w.hop > 0) w.hop -= dt;
  if (w.st === 'gone' || w.st === 'in') { w.fade -= dt * 1.6; return; }
  if (w.st === 'tag') return;
  w.out += dt;
  const v = (w.kind === 'shahar' ? V_SHAHAR : V) * (w.mis && w.mis.go ? RUN : 1) * dt;
  if (w.st === 'block' || w.st === 'guide') return;
  if (w.st === 'slip') { w.x += w.d * V * 2.2 * dt * Math.max(0, 1 - w.t); if (w.t > 0.7) lose(w, 'slip'); return; }
  if (w.st === 'stairs') {
    const n = Math.min(6, Math.floor(w.t / 0.3));
    if (n > w.laid) { w.laid = n; play('chair', 0.7); }
    if (w.laid >= 6) { L.ramps.push(w.newRamp); w.st = 'walk'; w.t = 0; w.ramp = w.newRamp; w.x = w.newRamp.x0 + w.d * 0.5; w.y = rampY(w.newRamp, w.x); }
    return;
  }
  if (w.st === 'build') {
    if (w.wet) {   // chairs laid over a wet floor, one by one, until it is all covered
      const z = w.wet, need = Math.ceil((z.b - z.a) / 12) + 1, n = Math.min(need, Math.floor(w.t / 0.3));
      while (w.laid < n) { const cx = w.bx + w.d * (w.laid * 12 + 6); chairs.push({ x: cx, y: w.y, d: w.d, wet: true }); w.laid++; play('chair', 0.7); }
      if (w.laid >= need) { z.covered = true; w.wet = null; w.st = 'walk'; w.t = 0; }
      return;
    }
    // chairs, one by one, until the far side is reached (at most 10)
    const n = Math.min(10, Math.floor(w.t / 0.3));
    while (w.laid < n && !w.done) {
      const i = w.laid, a = w.bx + w.d * i * 12, b = a + w.d * 12;
      if (solid((a + b) / 2, w.y - 10)) { w.done = true; break; }
      fill(Math.min(a, b), w.y, Math.max(a, b), w.y + 4, 1);
      chairs.push({ x: (a + b) / 2, y: w.y, d: w.d }); w.laid++; play('chair', 0.7);
      if (i >= 1 && (solid(b - w.d * 2, w.y + 7) || L.ramps.some((r) => Math.abs(r.y0 - w.y) < 4 && w.d * (b - r.x0) >= -1 && w.d * (b - r.x0) < 14))) w.done = true;
    }
    if (w.done || w.laid >= 10) { w.st = 'walk'; w.t = 0; w.done = false; }
    return;
  }
  if (w.st === 'open') {
    if (w.t > 1.0) { const dr = w.door; dr.open = true; fill(dr.x - 5, F[dr.f] - 52, dr.x + 5, F[dr.f], 0); w.st = 'walk'; w.t = 0; }
    return;
  }
  if (w.st === 'fall') {
    const y0 = w.y; w.y += 120 * dt;
    for (const r of L.ramps) if ((w.x - r.x0) * (w.x - r.x1) <= 0) { const ry = rampY(r, w.x); if (y0 <= ry && w.y >= ry) { w.y = ry; if (ry - w.fy0 > FALL_SAFE) { lose(w, 'nurse'); return; } w.ramp = r; w.st = 'walk'; return; } }
    if (solid(w.x, w.y)) { while (solid(w.x, w.y - 1)) w.y--; if (w.y - w.fy0 > FALL_SAFE) lose(w, 'nurse'); else w.st = 'walk'; }
    if (w.y > H) lose(w, 'nurse');
    return;
  }
  // walking: blockers turn you, Reut's column takes you, doors swallow you
  // עצור (and a pair busy building / opening) = the column WAITS behind it in a tight queue; הכוונה turns them back
  w.waiting = false;
  if (!w.ramp && !(w.mis && w.mis.go)) for (const b of walkers) {
    if (b === w || b.ramp || Math.abs(b.y - w.y) >= 8 || !active(b)) continue;
    const dx = (b.x - w.x) * w.d;
    if (b.st === 'guide' && w.d !== b.gd) { if (dx > 0 && dx < 12) { turn(w); break; } continue; }
    const wall = b.st === 'block' || b.st === 'build' || b.st === 'open' || b.st === 'stairs' || (b.waiting && b.d === w.d);
    if (wall && dx > 0 && dx < (b.waiting ? 15 : 14)) { w.waiting = true; return; }
  }
  if (w.ramp) {
    const r = w.ramp; w.x += w.d * v; const u = (w.x - r.x0) / (r.x1 - r.x0);
    if (u <= 0) { w.ramp = null; w.y = r.y0; } else if (u >= 1) { w.ramp = null; w.y = r.y1; w.x = r.x1; } else w.y = rampY(r, w.x);
  } else {
    const nx = w.x + w.d * v, ahead = nx + w.d * 4;
    let wall = false;
    for (let y = w.y - STEP - 1; y > w.y - HEAD; y -= 2) if (solid(ahead, y)) { wall = true; break; }
    if (wall) {
      const dr = doors.find((d) => !d.open && d.f === floorOf(w) && Math.abs(d.x - ahead) < 8);
      if (dr && w.armed === 'open') { w.armed = null; w.st = 'open'; w.t = 0; w.door = dr; play('door'); return; }
      turn(w);
    } else {
      const wz = L.wet.find((z) => !z.covered && z.f === floorOf(w) && nx >= z.a && nx <= z.b);
      if (wz && !(w.x >= wz.a && w.x <= wz.b) && !w.ramp) {
        if (w.armed === 'bridge') { w.armed = null; w.st = 'build'; w.t = 0; w.laid = 0; w.wet = wz; w.bx = w.d > 0 ? wz.a - 4 : wz.b + 4; return; }
        w.x = nx; w.st = 'slip'; w.t = 0; play('fall', 0.7); return;
      }
      let g = null;
      for (let y = w.y - STEP; y <= w.y + 3; y++) if (solid(nx, y) && !solid(nx, y - 1)) { g = y; break; }
      const r = L.ramps.find((r) => r.d === w.d && Math.abs(r.x0 - nx) < 2 && Math.abs(r.y0 - w.y) < 4);
      if (r && (g === null || g > w.y)) { w.ramp = r; w.x = r.x0 + w.d * 0.5; w.y = rampY(r, w.x); }
      else if (g !== null) { w.x = nx; w.y = g; }
      else if (w.armed === 'bridge') { w.armed = null; w.st = 'build'; w.t = 0; w.laid = 0; w.bx = w.x - w.d * 3; return; }
      else if (w.armed === 'stairs' && floorOf(w) >= 0 && floorOf(w) < 3) {
        const f = floorOf(w); let len = 84; while (len > 34 && (w.x + w.d * len < 12 || w.x + w.d * len > W - 12)) len -= 4;
        if (len > 34) { w.armed = null; w.st = 'stairs'; w.t = 0; w.laid = 0; w.newRamp = { f, x0: w.x, y0: F[f], x1: w.x + w.d * len, y1: F[f + 1], d: w.d, built: true }; return; }
        w.x = nx; w.st = 'fall'; w.fy0 = w.y; return;
      }
      else { w.x = nx; w.st = 'fall'; w.fy0 = w.y; return; }
    }
  }
  // zones
  const f = floorOf(w);
  if (Math.abs(w.x - L.ex.x) < 8 && f === L.ex.f && !w.ramp) { save(w); return; }
  for (const z of L.zones) if (z.f === f && Math.abs(w.x - z.x) < 6 && !w.ramp && (!z.side || (w.mis && w.mis.go && w.mis.door === z))) { lose(w, z.t); return; }
}
const floorOf = (w) => { for (let f = 0; f < 4; f++) if (Math.abs(w.y - F[f]) < 6) return f; return -1; };
function turn(w) { w.d = -w.d; w.turnT = 0.25; if (Math.random() < 0.3) play('turn', 0.35); }
function calm(w) { w.mis = null; floatText(w.x, w.y - 44, 'מתאפק', '#cfe6d7'); }

// a toilets runner: a student far from the level's one toilets door suddenly runs for it, through the crowd. Tap him
// (any order selected - catching costs nothing) and he goes back into the column; miss him and he is gone.
const WARN = 0.8, RUN = 1.6;   // a runner starts far from the toilets and is catchable: ~3 seconds to tap him
function stepMischief(dt) {
  const wc = L.zones.find((z) => z.t === 'wc');
  L.mischT -= dt;
  if (L.mischT <= 0 && wc && wc.f !== L.ex.f) {   // never on the shelter floor: a runner there is already at the finish
    const can = walkers.filter((w) => w.st === 'walk' && !w.armed && !w.ramp && !w.mis && floorOf(w) === wc.f && Math.abs(w.x - wc.x) > Math.max(150, W * 0.45) && w.kind !== 'shahar');
    if (can.length) {
      const w = can[Math.floor(Math.random() * can.length)];
      w.mis = { t: 0, door: wc, d0: w.d, dist: Math.abs(w.x - wc.x) }; play('tap', 0.6);
      bubbleAt(w, w.kind === 'omer' ? 'המורה, הוא מחטט באף! אני רץ לשירותים!' : 'המורה, אני חייב לשירותים!');
      L.mischT = L.mischief.every * (0.75 + Math.random() * 0.5);
    } else L.mischT = 1.5;
  }
  for (const w of walkers) {
    if (!w.mis) continue;
    if (!active(w) || w.st !== 'walk') { w.mis = null; continue; }
    w.mis.t += dt;
    if (w.mis.t >= WARN && !w.mis.go) {
      w.mis.go = true; const want = Math.sign(w.mis.door.x - w.x) || w.d; if (want !== w.d) { w.d = want; w.turnT = 0.25; }
      sayOnce('wcRun', ['לאן?! בירידה אין שירותים! מתאפקים עד לסיום התרגיל!'], 'angry');
    }
  }
}
// a tap on a student with no order to give: he reacts (a hop and a line) - the class is alive under the finger
const POKE = ['המורה, זה לא אני!', 'אני בטור!', 'מה עשיתי?', 'אבל המורה!', 'שניים שניים, אני יודע', 'הוא התחיל!', 'אני לא מחטט באף!'];
function poke(w) {
  if (!active(w)) return;
  w.hop = 0.45; play('tap', 0.5);
  const line = w.kind === 'omer' ? ['אבל המורה, זה חשוב!', 'המורה, אפשר לשאול משהו?'][Math.floor(Math.random() * 2)]
    : w.kind === 'shahar' ? 'אני הקטר המאסף! אני סוגר!' : POKE[Math.floor(Math.random() * POKE.length)];
  for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].w === w) bubbles.splice(i, 1);
  bubbleAt(w, line);
  if (w.kind === 'omer' && Math.random() < 0.5) say('עומר, שאלות אחר כך. זכות הדיבור אצלי כרגע.', 'angry', 2200);
}
function catchRunner(w) {
  w.d = w.mis.d0; w.mis = null; w.flash = 0.6; play('stop', 0.7);
  floatText(w.x, w.y - 50, 'חזור לטור!', '#fff6c8');
  say(['בירידה אין שירותים. מתאפקים עד לסיום התרגיל.', 'גם אם בן הזוג צריך לשירותים – לא עוזבים ידיים!', w.kind === 'omer' ? 'עומר! תנהל את עצמך!' : 'חזור לטור. שניים שניים.'][Math.floor(Math.random() * 3)], 'angry', 2200);
}

function stepReut(dt) {
  const R = L.reut, c = reutCol;
  c.next -= dt;
  if (c.next < 5 * L.k && c.next > 0) { if (!c.warn) { bubble('reutDoor', 'הכיתה של רעות יורדת!'); say('רעות מגיעה! עצרו את הטור לפני המדרגות!', 'angry', 3200); } c.warn = 1; } else c.warn = 0;
  if (c.next <= 0 && !c.members.length) {
    const d = Math.sign(R.to - R.from);
    c.members = [{ x: R.from, spr: 'reut' }]; for (let k = 1; k <= 3; k++) c.members.push({ x: R.from - d * k * 32, spr: 'reutKids' });
    c.d = d; c.next = R.every; c.ph = 0;
    bubble('reut', ['אין לנו זמן מיותר היום.', 'שבו שבו שבו – לרדת!', 'אצלי בכיתה כבר שבעה-שמונה תרגילים קדימה.'][Math.floor(Math.random() * 3)]);
    if (!L.lines.reutHi) { L.lines.reutHi = 1; setTimeout(() => say('בוקר טוב, המורה רעות... מאוד מסודר הטור שלך.', 'talk', 2600), 1600); }
  }
  if (!c.members.length) return;
  c.ph += dt * 9;
  for (const m of c.members) m.x += c.d * V_REUT * dt;
  // contact = mixed into her class
  for (const w of walkers) if (active(w) && floorOf(w) === R.f) for (const m of c.members) if (Math.abs(m.x - w.x) < 14 && Math.abs(F[R.f] - w.y) < 8) {
    lose(w, 'reut'); w.tagIdx = c.members.length; c.members.push({ x: m.x - c.d * 32, spr: w.spr, w }); break; }
  for (const m of c.members) if (m.w) { m.w.x = m.x; m.w.y = F[R.f]; m.w.d = c.d; }
  const last = c.members[c.members.length - 1];
  if ((last.x - R.to) * c.d > 4) { for (const m of c.members) if (m.w) m.w.st = 'gone'; c.members = []; if (walkers.some((w) => w.st === 'block')) say('רעות עברה! שחררו את הטור – הקישו על מי שעוצר.', 'talk', 3200); }
}

// ---------- orders ----------
function give(w, o) {
  if (w.mis) { catchRunner(w); return true; }
  if (w.st === 'block' || w.st === 'guide') { w.st = 'walk'; w.t = 0; play('tap', 0.6); if (Math.random() < 0.5) say('מי נתן הוראה להתקדם?! ...טוב, אני נתתי. להתקדם!', 'talk', 2000); return true; }
  if (!o || L.left[o] <= 0) { poke(w); return false; }
  if (!active(w)) return false;
  if (w.st === 'fall') { hint('באמצע הנפילה? לא עכשיו'); return false; }
  if (w.st !== 'walk') { hint('הזוג הזה כבר עסוק'); return false; }
  if ((o === 'bridge' || o === 'open' || o === 'stairs') && w.armed) { hint('הזוג הזה כבר קיבל הוראה'); return false; }
  if ((o === 'stop' || o === 'guide') && w.ramp) { hint('לא עוצרים על המדרגות'); return false; }
  L.left[o]--; w.flash = 0.5; w.jobPop = 0.9;
  for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].w === w) bubbles.splice(i, 1);
  if (o === 'stop') { w.st = 'block'; w.t = 0; w.mis = null; play('stop'); }
  if (o === 'guide') { w.st = 'guide'; w.gd = -w.d; w.d = w.gd; w.t = 0; w.mis = null; play('stop', 0.7); }
  if (o === 'bridge' || o === 'open' || o === 'stairs') { w.armed = o; play('tap'); }
  renderOrders();
  return true;
}

// ---------- the end of a level ----------
function finish() {
  if (L.over) return;
  L.over = true;
  for (const w of walkers) if (active(w)) lose(w, 'time');
  unloop('steps');
  const win = L.saved >= L.quota;
  const perfect = win && L.savedOrder[L.savedOrder.length - 1] === 'shahar';
  const sc = win ? L.saved * 50 + Math.max(0, Math.round(L.timeLeft / BASE)) * 3 + (perfect ? 300 : 0) : 0;
  const day = today();
  let bests = {}; try { bests = JSON.parse(store.get('daybests') || '{}'); } catch (e) {}
  if (bests.day !== day) bests = { day };
  if (win) bests[L.i] = Math.max(bests[L.i] || 0, sc);
  store.set('daybests', JSON.stringify(bests));
  const total = Object.entries(bests).filter(([k]) => k !== 'day').reduce((a, [, v]) => a + v, 0);
  if (win) {
    const un = +(store.get('level') || 0); if (L.i + 1 > un) store.set('level', Math.min(LEVELS.length - 1, L.i + 1));
    const done = new Set(JSON.parse(store.get('done') || '[]')); done.add(L.i); store.set('done', JSON.stringify([...done]));
  }
  const best = +(store.get('best') || 0); if (total > best) store.set('best', total);
  store.set('day', day + '|' + total);
  window.track && window.track('game_over', 'drill');
  if (win && total > 0 && window.VerseFrame && VerseFrame.score) VerseFrame.score(total);
  setTimeout(() => showEnd(win, perfect, sc, total), win ? 900 : 600);
  play(win ? 'win' : 'lose', 0.8);
  if (!win) say('...עשרים ושמונה. רגע, יצאנו עשרים ותשעה!', 'shock', 4000);
}
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });

// ---------- words ----------
let sayT = 0;
function say(text, mood = 'talk', ms = 2600) {
  const el = $('#say'); el.textContent = text; el.classList.remove('quiet');
  for (const px of [14, 13, 12, 11, 10, 9]) { el.style.fontSize = px + 'px'; if (el.scrollHeight <= el.clientHeight + 1) break; }
  if (el.scrollHeight > el.clientHeight + 1) { el.textContent = text.split(/(?<=[!?.])\s/)[0]; el.style.fontSize = '11px'; }
  $('#head').src = 'assets/head' + { talk: 'Talk', angry: 'Angry', shock: 'Shock' }[mood] + '.webp';
  clearTimeout(sayT); sayT = setTimeout(() => { $('#head').src = 'assets/headTalk.webp'; }, ms);
}
function sayOnce(key, lines, mood) { if (L.lines[key]) return; L.lines[key] = 1; say(lines[Math.floor(Math.random() * lines.length)], mood, 2800); }
let hintT = 0;
function hint(text) { say(text, 'talk', 1800); }
const bubbles = [];
function bubble(who, text) { bubbles.push({ who, text, t: 0 }); }
function bubbleAt(w, text) { bubbles.push({ who: 'w', w, text, t: 0 }); }
function floatText(x, y, text, color) { if (text) fx.push({ x, y, text, color, t: 0 }); }

// ---------- drawing ----------
const cv = $('#cv'), ctx = cv.getContext('2d');
let view = { s: 1, ox: 0, oy: 0, dpr: 1 };
function resize() {
  const st = $('#stage').getBoundingClientRect();
  const s = Math.min(st.width / W, st.height / H);
  view.s = s; view.dpr = Math.min(3, devicePixelRatio || 1);
  const cw = W * s, ch = H * s;
  cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
  cv.style.left = (st.width - cw) / 2 + 'px'; cv.style.top = (st.height - ch) / 2 + 'px';
  cv.width = Math.round(cw * view.dpr); cv.height = Math.round(ch * view.dpr);
}
addEventListener('resize', () => { if (game.mode === 'play') resize(); });

function sprite(name, frame, x, y, h, flip, alpha = 1) {
  const im = IMG[name], m = SPR[name]; if (!im || !m) return;
  const k = h / m.h, w = m.w * k, fi = (m.n ? frame % m.n : 0);
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(im, fi * m.w, 0, m.w, m.h, -w / 2, -h, w, h);
  ctx.restore();
}
function prop(name, x, y, h, flip) {
  const im = IMG[name]; if (!im) return;
  const w = im.width * h / im.height;
  ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1); ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
}
let pats = {};
function pattern(name, scale) {
  const key = name + scale; if (pats[key]) return pats[key];
  const im = IMG[name]; if (!im) return '#ccc';
  const p = ctx.createPattern(im, 'repeat'); p.setTransform(new DOMMatrix().scale(scale)); return (pats[key] = p);
}

function draw() {
  ctx.setTransform(view.s * view.dpr, 0, 0, view.s * view.dpr, 0, 0);
  ctx.fillStyle = '#3a2f27'; ctx.fillRect(0, 0, W, H);   // the whole frame every time (the holes in the floors left trails)
  // back walls: the painted corridor strip (windows, lamp) per floor, the shelter strip at the bottom - never stretched
  for (let f = 0; f < 4; f++) {
    const y0 = ceilY(f), y1 = F[f], im = IMG[f === 3 ? 'shelter' : 'wall']; if (!im) continue;
    const h = y1 - y0, w = im.width * h / im.height;
    for (let x = -((f * 37) % w); x < W; x += w) ctx.drawImage(im, x, y0, w, h);
  }
  for (const d of L.decor) if (d.kind !== 'board') prop(d.kind, d.x, F[d.f], d.kind === 'lockers' ? 62 : 36);
  // floor names
  for (let f = 0; f < 4; f++) {
    const t = f === 3 ? 'מקלט' : 'קומה ' + (3 - f);
    ctx.font = '900 10px Rubik'; const tw = ctx.measureText(t).width + 12;
    ctx.fillStyle = '#1f2a2edd'; ctx.beginPath(); ctx.roundRect(W - 10 - tw, ceilY(f) + 4, tw, 16, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(t, W - 10 - tw / 2, ceilY(f) + 15.5);
  }
  // doors on the back walls
  prop('doorClass', L.cls.x, F[L.cls.f] + 1, 72);
  { const left = STUDENTS - Math.min(STUDENTS, L.spawned * 2 - (L.spawned > PAIRS ? 1 : 0));
    ctx.fillStyle = '#24343aee'; ctx.beginPath(); ctx.roundRect(L.cls.x - 27, F[L.cls.f] - 96, 54, 18, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '900 11px Rubik'; ctx.textAlign = 'center'; ctx.fillText('בכיתה ' + left, L.cls.x, F[L.cls.f] - 83); }
  for (const z of L.zones) prop(z.t === 'wc' ? 'doorWc' : 'doorYard', z.x, F[z.f] + 1, 70);
  prop('doorShelter', L.ex.x, F[L.ex.f] + 1, 78);
  prop('exitSign', L.ex.x, F[L.ex.f] - 84, 15);
  if (L.reut) {
    for (const x of [L.reut.from, L.reut.to]) prop('doorClass', x, F[L.reut.f] + 1, 70, x > W / 2);
    if (reutCol.warn && Math.floor(L.t * 4) % 2) { ctx.fillStyle = '#e2483d'; ctx.font = '900 26px Rubik'; ctx.textAlign = 'center'; ctx.fillText('!', L.reut.from + 18, F[L.reut.f] - 30); }
  }
  // stairs: a flight of steps along each ramp, drawn to its real slope (the painted sprite stretched on steep ones)
  for (const r of L.ramps) if (!r.built) flight(r, 9, '#a39683', '#5d564c', true);
  // slabs and walls
  for (const [f, a, b] of L.slabs) {
    const hh = f === 3 ? H - F[3] : SLAB;
    ctx.fillStyle = '#3b4247'; ctx.fillRect(a, F[f], b - a, hh);
    ctx.fillStyle = '#c9b48f'; ctx.fillRect(a, F[f], b - a, 4);
    ctx.fillStyle = '#00000033'; ctx.fillRect(a, F[f] + hh - 3, b - a, 3);
  }
  ctx.fillStyle = '#5b4a3b'; ctx.fillRect(0, 0, 8, H); ctx.fillRect(W - 8, 0, 8, H);
  ctx.fillStyle = '#6d5a48'; for (const wl of L.walls) ctx.fillRect(wl.x - 4, ceilY(wl.f), 8, F[wl.f] - ceilY(wl.f));
  // cones at every edge that drops a whole floor
  for (const [f, a, b] of L.slabs) for (const [x, side] of [[a, -1], [b, 1]]) {
    if (x <= 8 || x >= W - 8 || f === 3) continue;
    if (L.ramps.some((r) => r.f === f && Math.abs(r.x0 - x) < 3)) continue;
    if (L.slabs.some(([f2, a2, b2]) => f2 === f && (side > 0 ? Math.abs(a2 - x) < 2 : Math.abs(b2 - x) < 2))) continue;
    prop('cone', x - side * 7, F[f], 18);
  }
  for (const z of L.wet) {
    if (IMG.puddle) ctx.drawImage(IMG.puddle, z.a - 4, F[z.f] - 6, z.b - z.a + 8, 10);
    if (!z.covered) { prop('wetSign', z.a - 10, F[z.f], 26); prop('wetSign', z.b + 10, F[z.f], 26, true); }
  }
  for (const c of chairs) prop('chair', c.x, c.y + (c.wet ? 4 : 7), c.wet ? 14 : 17, c.d < 0);
  // desk-stairs: a wooden flight that grows step by step, chairs on it
  for (const r of [...L.ramps.filter((r) => r.built), ...walkers.filter((w) => w.st === 'stairs').map((w) => ({ ...w.newRamp, n: w.laid }))]) {
    const n = r.n === undefined ? 6 : r.n; if (!n) continue;
    flight(r, 6, '#b8834f', '#6e4a28', false, n);
    for (let i = 1; i < n; i += 2) { const u = (i + 0.5) / 6; prop('chair', r.x0 + (r.x1 - r.x0) * u, r.y0 + (r.y1 - r.y0) * u + 1, 14, r.d < 0); }
  }
  for (const d of doors) {
    const op = walkers.find((w) => w.st === 'open' && w.door === d), p = d.open ? 1 : op ? Math.min(1, op.t / 1.0) : 0;
    const im = IMG.doorLocked; if (!im) continue;
    const h = 58, fw = im.width * h / im.height, left = d.x - fw / 2;
    if (p > 0) { ctx.fillStyle = '#1d1712'; ctx.fillRect(left + 2, F[d.f] - h + 4, fw - 4, h - 4); }
    const k = 1 - 0.78 * (p < 0.25 ? 0 : (p - 0.25) / 0.75);   // the lock first, then the swing
    ctx.save(); ctx.translate(left, F[d.f] + 1); ctx.drawImage(im, 0, -h, fw * k, h); ctx.restore();
    if (op && p < 0.6) { const ki = IMG.btnOpen; if (ki) { const r = 9 + 3 * Math.sin(op.t * 20); ctx.drawImage(ki, d.x - r, F[d.f] - 34 - r, r * 2, r * 2); } }
  }
  // Rosenblum counting at the shelter door
  sprite('rosen', L.over && L.saved < L.quota ? 3 : L.counting > 0 ? (L.counting > 0.3 ? 1 : 0) : 0, L.ex.x - 36, F[L.ex.f], 52, false);
  // Reut's column
  for (const m of reutCol.members) if (!m.w) sprite(m.spr, Math.floor(reutCol.ph) + (m.x | 0), m.x, F[L.reut.f], m.spr === 'reut' ? KID + 3 : KID, reutCol.d < 0);
  // the class
  for (const w of walkers) drawWalker(w);
  // floating words
  ctx.textAlign = 'center';
  for (const t of fx) { ctx.globalAlpha = Math.max(0, 1 - t.t / 1.6); ctx.font = '900 11px Rubik'; ctx.lineWidth = 3; ctx.strokeStyle = '#000a'; ctx.strokeText(t.text, t.x, t.y - t.t * 12); ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y - t.t * 12); }
  ctx.globalAlpha = 1;
  for (const b of bubbles) drawBubble(b);
  for (const w of walkers) drawJob(w);
}
function flight(r, n, fill, edge, rail, upto = n) {
  const pts = [];
  for (let i = 0; i < upto; i++) {
    const xa = r.x0 + (r.x1 - r.x0) * i / n, xb = r.x0 + (r.x1 - r.x0) * (i + 1) / n, y = r.y0 + (r.y1 - r.y0) * (i + 1) / n;
    pts.push([xa, y], [xb, y]);
  }
  const k = upto / n, ex = r.x0 + (r.x1 - r.x0) * k, ey = r.y0 + (r.y1 - r.y0) * k;
  ctx.beginPath(); ctx.moveTo(r.x0, r.y0);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineTo(ex, ey + 22); ctx.lineTo(r.x0, r.y0 + 22); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.stroke();
  // a light edge on each tread, a shadow under the flight
  ctx.strokeStyle = '#ffffff66'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) { ctx.moveTo(pts[i][0], pts[i][1] + 1); ctx.lineTo(pts[i + 1][0], pts[i + 1][1] + 1); }
  ctx.stroke();
  ctx.strokeStyle = '#00000040'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(r.x0, r.y0 + 23); ctx.lineTo(ex, ey + 23); ctx.stroke();
  if (rail) {
    ctx.strokeStyle = '#59626a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(r.x0, r.y0 - 26); ctx.lineTo(r.x1, r.y1 - 26); ctx.stroke();
    ctx.lineWidth = 1.5; for (let i = 0; i <= 4; i++) { const u = i / 4, x = r.x0 + (r.x1 - r.x0) * u, y = r.y0 + (r.y1 - r.y0) * u; ctx.beginPath(); ctx.moveTo(x, y - 26); ctx.lineTo(x, y); ctx.stroke(); }
  }
}
function drawWalker(w) {
  if ((w.st === 'gone' || w.st === 'in') && w.fade <= 0) return;
  const flip = w.d < 0, H2 = KID, a = w.st === 'gone' || w.st === 'in' ? Math.max(0, w.fade) : 1;
  const single = w.kind === 'shahar';
  let name = w.spr, fr = Math.floor(w.ph);
  if (w.st === 'block') { name = single ? 'shahar' : 'block'; fr = single ? 0 : Math.floor(w.t * 2); }
  else if (w.st === 'guide') { name = single ? 'shahar' : 'point'; fr = single ? 0 : Math.floor(w.t * 1.5); }
  else if (w.st === 'stairs') { name = single ? 'shahar' : 'build'; fr = 0; }
  else if (w.st === 'build') { name = single ? 'shahar' : 'build'; fr = 0; }
  else if (w.st === 'open') { name = single ? 'shahar' : 'key'; fr = w.t > 0.5 ? 1 : 0; }
  else if (w.st === 'fall' || w.st === 'slip') { name = single ? 'shahar' : 'fall'; fr = 0; }
  else if (w.st === 'in') { name = single ? 'shahar' : 'cheer'; fr = 0; }
  else if (w.st === 'gone' && w.why !== 'nurse') { name = single ? 'shahar' : 'sad'; }
  else if (w.turnT > 0 && !single) { name = 'turn'; fr = 0; }
  if (w.flash > 0) { ctx.fillStyle = '#ffd77a88'; ctx.beginPath(); ctx.ellipse(w.x, w.y - 2, 15, 5, 0, 0, 7); ctx.fill(); }
  else { ctx.fillStyle = '#0003'; ctx.beginPath(); ctx.ellipse(w.x, w.y, 11, 3, 0, 0, 7); ctx.fill(); }
  const onChairs = L.wet.some((z) => z.covered && z.f === floorOf(w) && w.x >= z.a - 2 && w.x <= z.b + 2);
  const hop = (w.hop > 0 ? Math.sin((0.45 - w.hop) / 0.45 * Math.PI) * 9 : 0) + (onChairs ? 6 : 0);
  sprite(name, fr, w.x, w.y + 1 - hop, H2, flip, a);
  if (w.mis) {
    const left = w.mis.go ? Math.max(0, Math.abs(w.x - w.mis.door.x) / w.mis.dist) : 1;
    ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(w.x, w.y - KID - 10, 14, 0, 7); ctx.stroke();
    ctx.strokeStyle = left > 0.4 ? '#ffd23f' : '#e2483d'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(w.x, w.y - KID - 10, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); ctx.stroke();
    const p = 1 + 0.15 * Math.sin(w.mis.t * 14);
    ctx.strokeStyle = '#e2483d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(w.x, w.y - 1, 15 * p, 5 * p, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = '#e2483d'; ctx.beginPath(); ctx.arc(w.x, w.y - KID - 10, 10 * p, 0, 7); ctx.fill();
    ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('🚽', w.x, w.y - KID - 6);
  }
  if (false) { const bx = w.x + w.d * 14, by = w.y - 4 - Math.abs(Math.sin(w.t * 9)) * 10; prop('ball', bx, by + 4, 8); }
  if (w.kind === 'shahar' && active(w)) { ctx.fillStyle = '#ffd77a'; ctx.font = '900 9px Rubik'; ctx.textAlign = 'center'; ctx.fillText('שחר', w.x, w.y - KID - 3); }
}
// jobs are drawn above everything (even speech): the job's own button picture over the head; a pop when it is given
const JOB_IMG = { block: 'btnStop', guide: 'btnGuide', bridge: 'btnBridge', stairs: 'btnStairs', open: 'btnOpen', build: 'btnBridge' };
function drawJob(w) {
  if (!active(w)) return;
  const job = w.armed || (w.st === 'block' ? 'block' : w.st === 'guide' ? 'guide' : w.st === 'build' ? 'build' : w.st === 'stairs' ? 'stairs' : w.st === 'open' ? 'open' : null);
  if (!job) return;
  const im = IMG[JOB_IMG[job]]; if (!im) return;
  const pop = w.jobPop > 0 ? w.jobPop / 0.9 : 0, r = 11 + 9 * pop, cy = w.y - KID - 12 - 8 * pop;
  ctx.drawImage(im, w.x - r, cy - r, r * 2, r * 2);
  if (job === 'guide') { ctx.fillStyle = '#fff'; ctx.font = '900 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(w.gd < 0 ? '◀' : '▶', w.x + (w.gd < 0 ? -r - 6 : r + 6), cy + 4); }
  if (pop > 0) {
    const t = { block: 'עצור', guide: 'הכוונה', bridge: 'גשר', stairs: 'מדרגות', open: 'פתח', build: 'גשר' }[job];
    ctx.font = '900 12px Rubik'; const tw = ctx.measureText(t).width + 14;
    ctx.globalAlpha = Math.min(1, pop * 2); ctx.fillStyle = '#1a3149'; ctx.beginPath(); ctx.roundRect(w.x - tw / 2, cy - r - 20, tw, 18, 8); ctx.fill();
    ctx.fillStyle = '#ffd76a'; ctx.textAlign = 'center'; ctx.fillText(t, w.x, cy - r - 7); ctx.globalAlpha = 1;
  }
}
function drawBubble(b) {
  let x, y;
  if (b.who === 'w') { x = b.w.x; y = b.w.y - KID - 18; }
  else if (b.who === 'reutDoor') { x = L.reut.from; y = F[L.reut.f] - 70; }
  else if (b.who === 'reut') { const m = reutCol.members[0]; if (!m) { b.t = 99; return; } x = m.x; y = F[L.reut.f] - 44; }
  else { const o = walkers.find((w) => w.kind === 'omer' && active(w)) || { x: L.ex.x - 30, y: F[L.ex.f] }; x = o.x; y = o.y - 44; }
  ctx.font = '700 10px Rubik'; const tw = Math.min(170, ctx.measureText(b.text).width + 14);
  x = Math.max(tw / 2 + 10, Math.min(W - tw / 2 - 10, x));
  ctx.globalAlpha = Math.min(1, 3.2 - b.t);
  ctx.fillStyle = '#fffdf3'; ctx.beginPath(); ctx.roundRect(x - tw / 2, y - 20, tw, 18, 8); ctx.fill();
  ctx.fillStyle = '#1f2a2e'; ctx.textAlign = 'center'; ctx.fillText(b.text, x, y - 7.5, tw - 8);
  ctx.globalAlpha = 1;
}

// ---------- input ----------
cv.addEventListener('pointerdown', (e) => {
  if (game.mode !== 'play' || (game.paused && !tut.on) || L.over) return;
  audioInit();
  const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / view.s, y = (e.clientY - r.top) / view.s;
  const w = pick(x, y);
  if (tut.wait && !tut.wait('tap', w)) return;
  if (w) give(w, game.sel);
});
function pick(x, y) {
  let best = null, bd = 1e9;
  for (const w of walkers) {
    if (!active(w)) continue;
    const dx = Math.abs(w.x - x), dy = y - (w.y - KID / 2);
    if (dx > (w.mis ? 32 : 22) || Math.abs(dy) > 34) continue;
    const d = dx * dx + dy * dy * 0.5 + (w.st === 'block' || w.st === 'guide' ? 40 : 0) - (w.mis ? 400 : 0);
    if (d < bd) { bd = d; best = w; }
  }
  return best;
}
for (const b of document.querySelectorAll('.ord')) {
  b.dataset.id = b.dataset.o;
  b.addEventListener('click', () => { audioInit(); selectOrder(b.dataset.o); });
}
function selectOrder(o) {
  if (tut.wait && !tut.wait('order', o)) return;
  game.sel = o; play('tap', 0.5); renderOrders();
  if (L && L.left[o] <= 0) hint('נגמרו ההוראות "' + ORDER_NAME[o] + '" בשלב הזה');
}
function renderOrders() {
  for (const b of document.querySelectorAll('.ord')) {
    const o = b.dataset.o, n = L.left[o], has = (LEVELS[L.i].orders[o] || 0) > 0;
    b.querySelector('b').textContent = n; b.classList.toggle('sel', game.sel === o); b.classList.toggle('empty', n <= 0); b.classList.toggle('off', !has);
  }
}
addEventListener('keydown', (e) => {
  if (tut.on) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tutNext(true); } else if (e.key === 'Escape') tutEnd(); return; }
  if (game.mode !== 'play') return;
  const k = { 1: 'stop', 2: 'guide', 3: 'bridge', 4: 'stairs', 5: 'open' }[e.key]; if (k && L.left[k] !== undefined && (LEVELS[L.i].orders[k] || 0) > 0) selectOrder(k);
  if (e.key === 'p' || e.key === 'Escape') setPause(!game.paused);
  if (e.key === 'f') setFast();
});
$('#bPause').onclick = () => setPause(true);
$('#bFast').onclick = () => setFast();
$('#bRestart').onclick = () => { if (!tut.on) startLevel(L.i, true); };
$('#bRestart2').onclick = () => { setPause(false); startLevel(L.i, true); };
$('#bTip').onclick = () => { if (game.mode === 'play' && !tut.on && !L.over) showTip(true); };
$('#iTip').onclick = () => showTip(false);
$('#tipOk').onclick = () => { $('#tip').hidden = true; if (tipResume) { game.paused = false; loop('music', 0.3); } };
$('#bRestartTop').onclick = () => { if (!tut.on && game.mode === 'play') startLevel(L.i, true); };
$('#askRestart').onclick = () => { $('#ask').hidden = true; startLevel(L.i, true); };
$('#askGo').onclick = () => { $('#ask').hidden = true; game.paused = false; loop('music', 0.3); };
$('#bResume').onclick = () => setPause(false);
$('#bMenu').onclick = () => { setPause(false); menu(); };
let tipResume = false;
function showTip(inPlay) {
  const i = inPlay ? L.i : game.introLevel;
  $('#tipText').textContent = TIPS[i]; $('#tipLvl').textContent = 'שלב ' + (i + 1) + ' – ' + LEVELS[i].name;
  tipResume = inPlay && !game.paused; if (inPlay) { game.paused = true; stopAll(); }
  $('#tip').hidden = false;
}
const clock = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
function setPause(p) { game.paused = p; $('#pause').hidden = !p; if (p) stopAll(); else { loop('music', 0.35); } }
function setFast() { game.speed = { 1: 2, 2: 3, 3: 5 }[game.speed] || 1; showSpeed(); }
function showSpeed() { $('#bFast').classList.toggle('on', game.speed > 1); $('#bFast').dataset.x = game.speed > 1 ? '×' + game.speed : ''; }

// ---------- flow ----------
function menu() {
  game.mode = 'menu'; stopAll();
  $('#play').hidden = true; $('#end').hidden = true; $('#intro').hidden = true; $('#start').hidden = false;
  const un = +(store.get('level') || 0), done = new Set(JSON.parse(store.get('done') || '[]'));
  const box = $('#levels'); box.innerHTML = '';
  LEVELS.forEach((l, i) => { const b = document.createElement('button'); b.textContent = i + 1; b.disabled = i > un; if (done.has(i)) b.classList.add('done'); if (i === un) b.classList.add('now'); b.title = l.name; b.onclick = () => { audioInit(); intro(i); }; box.appendChild(b); });
  const d = (store.get('day') || '').split('|');
  $('#rec').textContent = d[0] === today() && +d[1] > 0 ? 'השיא שלכם היום: ' + d[1] + ' נקודות' : '';
  $('#bPlay').textContent = un > 0 ? 'שחקו – שלב ' + (un + 1) : 'שחקו';
}
$('#bPlay').onclick = () => { audioInit(); const un = +(store.get('level') || 0); if (!store.get('tut') && un === 0) startTutorial(); else intro(un); };
$('#bHow').onclick = () => { audioInit(); startTutorial(); };
function intro(i) {
  game.introLevel = i;
  $('#start').hidden = true; $('#end').hidden = true; $('#intro').hidden = false;
  const l = LEVELS[i];
  $('#iLvl').textContent = 'שלב ' + (i + 1) + ' מתוך ' + LEVELS.length;
  $('#iName').textContent = l.name;
  $('#iText').textContent = l.text;
  $('#iGoal').textContent = '🎯 להכניס ' + l.quota + ' מתוך ' + STUDENTS;
  const BTN = { stop: 'btnStop', guide: 'btnGuide', bridge: 'btnBridge', stairs: 'btnStairs', open: 'btnOpen' };
  $('#iJobs').innerHTML = ORDERS.filter((o) => l.orders[o]).map((o) => '<span><b>' + l.orders[o] + '</b><img src="assets/' + BTN[o] + '.webp" alt=""><i>' + ORDER_NAME[o].replace('!', '') + '</i></span>').join('');
  $('#bGo').onclick = () => startLevel(i);
}
function startLevel(i, restart) {
  game.level = i; game.mode = 'play'; game.paused = false;
  $('#start').hidden = true; $('#intro').hidden = true; $('#end').hidden = true; $('#pause').hidden = true; $('#ask').hidden = true; $('#play').hidden = false;
  fitWorld(); buildLevel(i); pats = {}; game.speed = 1; showSpeed();
  const firstOrder = ORDERS.find((o) => (LEVELS[i].orders[o] || 0) > 0); game.sel = firstOrder;
  resize(); renderOrders(); bubbles.length = 0;
  say(['הופ! הופ! הופ! כולם לקום! להזדרז!', 'שניים שניים! לסגור רווחים! לא לעזוב ידיים!', 'במדרגות לא רצים! יורדים בטורים, בצורה מסודרת ומאורגנת!'][i % 3], 'talk', 3000);
  stopAll(); const sr = play('siren', 0.1); if (sr) setTimeout(() => { try { sr.stop(); } catch (e) {} }, 2200); loop('music', 0.3);
  if (!restart) window.track && window.track('game_start', 'drill');
}
function showEnd(win, perfect, sc, total) {
  $('#end').hidden = false;
  const last = L.i === LEVELS.length - 1;
  $('#eLvl').textContent = 'שלב ' + (L.i + 1) + ' – ' + L.name;
  $('#eTitle').textContent = !win ? 'לא מספיק תלמידים' : perfect ? 'טור מושלם!' : 'עברתם!';
  $('#eHead').src = 'assets/head' + (win ? (last ? 'Shock' : 'Talk') : 'Angry') + '.webp';
  $('#eText').textContent = !win ? '"איך אני מראה את הפנים שלי מול המנהלת אסתר?"' : last ? '"כולם בפנים. אני רוצה פה שקט מוחלט... היי! מה פתאום הבאתם לכאן כדור?!"'
    : perfect ? '"שחר סוגר את הטור. ככה עושים תרגיל."' : '"נכנסנו. שחר, בפעם הבאה – אחרון. אתה הקטר המאסף."';
  if (win && last) play('bonk', 0.9);
  $('#eNums').innerHTML = '<span>נכנסו למרחב המוגן</span><b>' + L.saved + '/' + STUDENTS + '</b><span>צריך היה</span><b>' + L.quota + '</b>' +
    (win ? '<span>זמן שנשאר</span><b>' + clock(Math.max(0, Math.round(L.timeLeft / BASE))) + '</b>' + (perfect ? '<span>טור מושלם</span><b>+300</b>' : '') +
      '<span class="tot">ניקוד השלב</span><b class="tot">' + sc + '</b><span>השיא שלכם היום</span><b>' + total + '</b>' : '');
  $('#eNext').hidden = !win || last; $('#eNext').onclick = () => intro(L.i + 1);
  $('#eAgain').onclick = () => startLevel(L.i, true);
  $('#eMenu').onclick = menu;
  $('#eTip').hidden = win; $('#eTip').onclick = () => { game.introLevel = L.i; showTip(false); };
}

// ---------- tutorial ----------
const tut = { on: false, i: 0, wait: null };
const worldRect = (x, y, w, h) => { const r = cv.getBoundingClientRect(); return { left: r.left + x * view.s, top: r.top + y * view.s, width: w * view.s, height: h * view.s }; };
const elRect = (sel) => $(sel).getBoundingClientRect();
const STEPS = [
  { t: 'אתם המורה רוזנבלום. צופר: תרגיל ירידה למרחב מוגן.' },
  { t: '29 תלמידים יוצאים שניים שניים, ושחר אחרון. הם הולכים לבד.', spot: () => worldRect(L.cls.x - 34, F[0] - 100, 68, 104) },
  { t: 'המטרה: להכניס מספיק תלמידים למרחב המוגן.', spot: () => worldRect(L.ex.x - 64, F[3] - 86, 104, 90) },
  { t: 'כמה בפנים מתוך כמה שצריך, וכמה אבדו מתוך כמה שמותר.', spot: () => elRect('#stats') },
  { t: 'ההוראות: בוחרים הוראה, ואז מקישים על זוג.', spot: () => elRect('#orders') },
  { t: 'בחרו "הכוונה!".', verb: 'הקישו', spot: () => elRect('.ord[data-o=guide]'), wait: (k, v) => k === 'order' && v === 'guide' },
  { t: 'עכשיו הקישו על הזוג הראשון. הוא יסתובב ויפנה את כולם אחורה – הרחק מהחצר.', verb: 'הקישו על הזוג', run: () => { while (walkers.length < 1 || walkers[0].x < X(120)) step(1 / 60); },
    spot: () => { const w = walkers[0]; return worldRect(w.x - 28, w.y - KID - 6, 56, KID + 12); }, wait: (k, w) => k === 'tap' && w === walkers[0], after: () => give(walkers[0], 'guide') },
  { t: 'הקישו עליו שוב כדי לשחרר. בחינם.', verb: 'הקישו שוב', spot: () => { const w = walkers[0]; return worldRect(w.x - 28, w.y - KID - 6, 56, KID + 12); },
    wait: (k, w) => k === 'tap' && w === walkers[0], after: () => give(walkers[0], null) },
  { t: 'כל הוראה היא תפקיד שעוזר לכולם: עצור, הכוונה, גשר, מדרגות, פתח. כל אחת בשלב משלה.', spot: () => elRect('#orders') },
  { t: 'פתאום מישהו רץ לשירותים! הקישו עליו מהר – והוא חוזר לטור.' },
  { t: '⏩ מהר יותר: ×2, ×3, ×5. ⏸ עצירה, ↻ מההתחלה.', spot: () => elRect('#bFast') },
  { t: 'שחר אחרון = טור מושלם. יורדים!' },
];
function startTutorial() {
  startLevel(0, true); game.paused = true; tut.on = true; tut.i = 0;
  $('#tut').hidden = false; showStep();
}
function showStep() {
  const s = STEPS[tut.i]; if (s.run) s.run();
  draw();
  tut.wait = s.wait ? (k, v) => { if (!s.wait(k, v)) return false; tut.wait = null; if (s.after) s.after(); draw(); say('יפה!', 'talk', 1200); setTimeout(() => tutNext(false), 650); return false; } : null;
  const sp = $('#spot'), card = $('#tcard');
  const r = s.spot ? s.spot() : null;
  if (r) { sp.className = ''; Object.assign(sp.style, { left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' }); }
  else { sp.className = 'none'; sp.removeAttribute('style'); }
  // the card goes away from the spotlight
  const mid = r ? r.top + r.height / 2 : 0, low = !r || mid < innerHeight * 0.5;
  card.style.top = low ? '' : 'calc(var(--safe-t) + 12px)'; card.style.bottom = low ? 'calc(var(--barH) + var(--safe-b) + 14px)' : '';
  card.innerHTML = '<div class="n">' + (tut.i + 1) + ' / ' + STEPS.length + '</div><div>' + s.t + '</div>' + (s.verb ? '<div class="verb">' + s.verb + '</div>' : '') +
    '<div class="tb"><button class="skip" id="tSkip">דלגו</button>' + (s.wait ? '' : '<button class="big" id="tNext">' + (tut.i === STEPS.length - 1 ? 'יורדים!' : 'הבא') + '</button>') + '</div>';
  $('#tSkip').onclick = tutEnd; if ($('#tNext')) $('#tNext').onclick = () => tutNext(true);
  // a "try it" step lets the real thing through the overlay
  $('#tut').style.pointerEvents = 'none';
}
function tutNext(manual) {
  if (manual && STEPS[tut.i].wait) return;
  tut.i++; if (tut.i >= STEPS.length) return tutEnd();
  showStep();
}
function tutEnd() { tut.on = false; tut.wait = null; $('#tut').hidden = true; store.set('tut', 1); intro(0); }

// ---------- loop ----------
let lastT = 0, acc = 0;
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0); lastT = t;
  if (game.mode !== 'play') return;
  if (!game.paused && !tut.on) {
    acc += dt * BASE * game.speed;
    while (acc >= 1 / 60) { step(1 / 60); acc -= 1 / 60; }
  }
  for (const f of fx) f.t += dt; for (let i = fx.length - 1; i >= 0; i--) if (fx[i].t > 1.6) fx.splice(i, 1);
  if (walkers) for (const w of walkers) if (w.jobPop > 0) w.jobPop -= dt;   // real time, so the pop shows at any speed
  for (const b of bubbles) b.t += dt; for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].t > 3.2) bubbles.splice(i, 1);
  hud(); draw();
}
function hud() {
  const s = Math.max(0, Math.ceil(L.timeLeft / BASE));
  $('#tval').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  $('#timer').classList.toggle('low', s <= 20 && !L.over);
  $('#cval').textContent = L.saved + '/' + L.quota;
  $('#count').style.background = L.saved >= L.quota ? '#2fa457cc' : '';
  $('#lval').textContent = L.lostN + '/' + L.lostLeft;
  $('#lost').classList.toggle('over', L.lostN > L.lostLeft);

}

// test hook (tests and the promo bot read the game through it)
window.DRILL = {
  get state() { return { mode: game.mode, level: L ? L.i : -1, saved: L && L.saved, lost: L && L.lostN, quota: L && L.quota, timeLeft: L && L.timeLeft, over: L && L.over, left: L && { ...L.left }, sel: game.sel, tut: tut.on ? tut.i : -1, reut: !!(reutCol && (reutCol.members.length || reutCol.warn)) }; },
  get walkers() { return (walkers || []).map((w) => ({ id: w.id, kind: w.kind, x: w.x, y: w.y, d: w.d, st: w.st === 'in' ? 'saved' : w.st === 'gone' || w.st === 'tag' ? 'lost' : w.st, gd: w.gd, why: w.why, armed: w.armed, mis: w.mis ? (w.mis.go ? 'run' : 'warn') : null })); },
  start(i = 0) { store.set('tut', 1); tut.on = false; $('#tut').hidden = true; startLevel(i); },
  tick(dt) { const n = Math.round(dt * 60); for (let k = 0; k < n; k++) step(1 / 60); draw(); hud(); },
  order(o) { selectOrder(o); },
  tap(id) { const w = walkers.find((w) => w.id === id); return w ? give(w, game.sel) : false; },
  toScreen(x, y) { const r = cv.getBoundingClientRect(); return { x: r.left + x * view.s, y: r.top + y * view.s }; },
  levels: LEVELS, F, X, W, H, BASE,
  get sndLog() { return audio.log; },
};

ready.then(() => { menu(); requestAnimationFrame(frame); });
})();
