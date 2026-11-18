// פסיכופת גינה – Paper.io in a city park at night. He walks; off his own ground he leaves a glowing trail, and back on
// it the loop closes and everything inside becomes his. Strangers stroll the park, each with a clue (a phone, a protein
// shaker, a dog, a laptop) = the story he tells her. Near one, he starts his innocent small talk; every line is one step
// darker. Close a loop around her before the story reaches its reveal = she is stuck in the conversation (big points).
// Too slow = the reveal slips out, she screams, runs and calls the police. Police cars cut his trail; so does his own
// body; and the restraining-order circle around "her" house is off limits. Nights = levels: take X% of the park.
'use strict';
const $ = (id) => document.getElementById(id);
const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const SLUG = 'garden';
const KEY = { best: `shlomiverse:${SLUG}:best`, day: `shlomiverse:${SLUG}:day`, tut: `shlomiverse:${SLUG}:tut`, snd: `shlomiverse:${SLUG}:snd` };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} },
};
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
function rng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function pickNo(list, key) { const last = pickNo[key]; let l = pick(list); if (list.length > 1 && l === last) l = list[(list.indexOf(l) + 1) % list.length]; pickNo[key] = l; return l; }

// ───────────────────────── his stories (from his real videos) ─────────────────────────
// 4 lines each: the innocent question -> details -> the hint -> THE REVEAL
const STORIES = {
  phone: ['סליחה, אפשר לשאול אותך משהו? את אוהבת ששולחים לך רילסים?',
    'גם אני שולח לחברה שלי. חתולים, תינוקות, AI. הרבה AI.',
    'והיא לא אוהבת. צועקת, בוכה. אז קניתי לה מסך גדול, במיוחד בשבילה.',
    'אני לא מכריח אותה! היא יכולה לעצום עיניים. אני רק קשרתי אותה לכי—'],
  shake: ['סליחה, אפשר שאלה? את לוקחת תוספי תזונה? גם אני. זה חשוב, זה חשוב.',
    'במיוחד קריאטין. זה עושה אותך חזק. ממש חזק.',
    'היא רוצה שאני אתן לה גם. אני לא נותן. לא נותן.',
    'בזכות הקריאטין אני סוף סוף מצליח להשתלט על חברה שלי. למקום! למקום!'],
  dog: ['תגידי, איך עושים שהם ידעו שאני האדון שלהם?',
    'יש לי בבית מקרה קשה. קשה מאוד. לא עושים מה שאומרים להם.',
    'נובחים, שורטים, נושכים. ואוכלים מהזבל. מה עושים?',
    'כלב? לא, אין לי כלב. אני שואל בשביל לדעת מה לעשות עם חברה שלי.'],
  laptop: ['תגידי, את יודעת שה-AI תכף לוקח לכולם את העבודה? את לא מפחדת?',
    'גם אני לא מפחד. כי אני לא עובד. חברה שלי עושה את כל ההכנסות.',
    'אנחנו רבים על זה מלא. זה מגיע לטונים גבוהים. היא צורחת עליי.',
    '״תעזוב אותי! תוריד אותי! מה, תלית אותי?״ – ככה היא צורחת.'],
};
const UNLOCK = ['phone', 'shake', 'dog', 'laptop'];            // night 1: 2 stories, then one more each night
const LINES = {
  police: ['אני שואל בשביל לדעת!', 'סליחה, אפשר לשאול אותך משהו, שוטר?', 'זה לא מה שזה נראה!'],
  zone: ['צו הרחקה זה לא גירושין!', 'רק באתי לראות אם היא בסדר!'],
  self: ['נתקעתי בשובל של עצמי...', 'רגע, מי עבר פה? אה, אני.'],
  idle: ['איזה לילה יפה לשאלות.', 'מישהי פה אוהבת רילסים?', 'יש לי בבית מקרה קשה.', 'אני שואל בשביל לדעת.'],
  drop: ['לאן את הולכת? עוד לא סיפרתי לך...', 'רגע! עוד לא הגעתי לחלק הטוב!'],
  near: ['זה הבית שלה. יש שם איזה צו... סתם בירוקרטיה.', 'שלום מותק! סתם, אני לא פה.'],
  other: ['סליחה, אפשר לשאול אותך משהו? ...לאן את רצה?', 'רגע, רק שאלה קטנה!'],
};

// ───────────────────────── art ─────────────────────────
const IMG = {};
const img = (k, src) => { const i = new Image(); i.src = src; IMG[k] = i; return i; };
img('map', 'assets/map.jpg');
for (const p of ['walk', 'talk', 'caught']) img('guy-' + p, `assets/guy-${p}.webp`);
for (const k of UNLOCK) for (const v of ['walk', 'run']) img(`girl-${k}-${v}`, `assets/girl-${k}-${v}.webp`);
for (const f of ['polite', 'unsure', 'horror']) img('face-' + f, `assets/face-${f}.webp`);
img('police', 'assets/police.webp');
const ok = (im) => im && im.complete && im.naturalWidth;
const HOUSE = { u: 0.885, v: 0.15 };            // the house's door in map.jpg (0..1)

// ───────────────────────── sound ─────────────────────────
const SND = { ctx: null, raw: {}, buf: {}, on: store.get(KEY.snd) !== '0', last: {}, master: null, loops: {} };
const SFX = ['claim-1', 'claim-2', 'claim-3', 'talk-1', 'talk-2', 'talk-3', 'gasp-1', 'gasp-2', 'gasp-3', 'scream-1', 'scream-2',
  'reveal-1', 'reveal-2', 'capture-1', 'capture-2', 'siren', 'caught-1', 'caught-2', 'warn', 'night', 'over', 'tick', 'go', 'start', 'park', 'trail', 'music'];
const load = (n) => fetch(`assets/sfx/${n}.mp3`).then((r) => r.ok ? r.arrayBuffer() : null).then((b) => { if (b) { SND.raw[n] = b; decode(n); } }).catch(() => {});
for (const n of SFX) load(n);
function decode(n) {
  if (!SND.ctx || !SND.raw[n] || SND.buf[n]) return;
  const b = SND.raw[n]; SND.raw[n] = null;
  SND.ctx.decodeAudioData(b).then((x) => { SND.buf[n] = x; if (wantLoops[n]) loop(n, wantLoops[n]); }).catch(() => {});
}
function audioUnlock() {
  // iPhone: a suspended / interrupted context only wakes inside a tap - wake it on every tap
  if (SND.ctx) {
    if (SND.ctx.state !== 'running' && !paused) {
      SND.ctx.resume().catch(() => {});
      try { const s = SND.ctx.createBufferSource(); s.buffer = SND.ctx.createBuffer(1, 1, 22050); s.connect(SND.ctx.destination); s.start(); } catch (e) {}
    }
    return;
  }
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
  src.buffer = SND.buf[n]; src.playbackRate.value = 0.96 + Math.random() * 0.08; gn.gain.value = vol;
  src.connect(gn).connect(SND.master); src.start();
}
const wantLoops = {};
function loop(n, vol) {           // vol 0 = off
  wantLoops[n] = vol;
  const L = SND.loops[n];
  if (!vol) { if (L) { try { L.src.stop(); } catch (e) {} delete SND.loops[n]; } return; }
  if (L) { L.g.gain.value = vol; return; }
  if (!SND.ctx || !SND.buf[n]) return;
  const g = SND.ctx.createGain(); g.gain.value = vol; g.connect(SND.master);
  const src = SND.ctx.createBufferSource(); src.buffer = SND.buf[n]; src.loop = true; src.connect(g); src.start();
  SND.loops[n] = { src, g };
}
function loopsOff() { for (const n of Object.keys(wantLoops)) loop(n, 0); }
const SPK = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const MUTE = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
function sndIcons() { document.querySelectorAll('.sndBtn').forEach((b) => { b.innerHTML = SND.on ? SPK : MUTE; }); }
document.querySelectorAll('.sndBtn').forEach((b) => b.onclick = () => { audioUnlock(); SND.on = !SND.on; store.set(KEY.snd, SND.on ? '1' : '0'); if (SND.master) SND.master.gain.value = SND.on ? 1 : 0; sndIcons(); });
sndIcons();

// ───────────────────────── the words ─────────────────────────
const sayEl = $('say');
let sayT = 0;
function say(text, dur = 3, cls = '') { sayEl.textContent = text; sayEl.className = cls; sayEl.style.opacity = 1; sayT = dur; }
function pips(n) { document.querySelectorAll('#pips i').forEach((p, i) => p.classList.toggle('on', i < n)); }
let bubble = null;                                   // a short line beside his head
function guySays(text, dur = 1.8) { bubble = { text, t: dur }; }
const fxEl = $('fx');
function popText(x, y, text, cls) { const p = document.createElement('div'); p.className = 'pop' + (cls ? ' ' + cls : ''); p.style.top = clamp(y, B.y + 30, H - 120) + 'px'; p.textContent = text; fxEl.appendChild(p); const w = p.offsetWidth; p.style.left = clamp(x, w / 2 + 6, W - w / 2 - 6) + 'px'; setTimeout(() => p.remove(), 1000); }
function flash(blue) { const f = document.createElement('div'); f.className = 'flash' + (blue ? ' blue' : ''); fxEl.appendChild(f); setTimeout(() => f.remove(), 450); }
function banner(text, cls) { const b = document.createElement('div'); b.className = 'banner' + (cls ? ' ' + cls : ''); b.innerHTML = text; fxEl.appendChild(b); setTimeout(() => b.remove(), 1400); }

// ───────────────────────── layout: the park fills the screen ─────────────────────────
const COLS = 18;
let ROWS = 32;
const cv = $('cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, B = { x: 0, y: 0, t: 20, w: 0, h: 0 };
const cssPx = (v) => { const d = document.createElement('div'); d.style.cssText = `position:fixed;top:${v};visibility:hidden`; document.body.appendChild(d); const t = d.getBoundingClientRect().top; d.remove(); return t; };
function gap() { const top = cssPx('var(--safe-t)') + 50, bottom = H - 72 - cssPx('var(--safe-b)'); return { top, h: bottom - top }; }
function fitRows() { W = innerWidth; H = innerHeight; const t = Math.min((W - 8) / COLS, 30); return clamp(Math.floor(gap().h / t), 20, 40); }
function layout() {
  DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  document.body.classList.toggle('turn', W > H * 1.15 && H < 520 && 'ontouchstart' in window);
  const G = gap(), t = Math.floor(Math.min((W - 8) / COLS, G.h / ROWS) * 10) / 10;
  B = { t, w: t * COLS, h: t * ROWS, x: Math.round((W - t * COLS) / 2), y: Math.round(G.top + Math.max(0, (G.h - t * ROWS) / 2)) };
  terrDirty = true;
}
addEventListener('resize', layout); addEventListener('verseframe', layout);
const px = (c) => B.x + (c + 0.5) * B.t, py = (r) => B.y + (r + 0.5) * B.t;
// the map is drawn "cover" over the board - where a point of the picture lands, in tiles
function mapRect() { const im = IMG.map, ar = ok(im) ? im.naturalWidth / im.naturalHeight : 2 / 3, bar = COLS / ROWS; return bar < ar ? { w: ROWS * ar, h: ROWS, x: (COLS - ROWS * ar) / 2, y: 0 } : { w: COLS, h: COLS / ar, x: 0, y: (ROWS - COLS / ar) / 2 }; }

// ───────────────────────── the park grid ─────────────────────────
let owner = new Uint8Array(0), zone = new Uint8Array(0), zoneC = { c: 0, r: 0, R: 3.2 }, zoneCount = 0;
let trail = [], trailSet = new Set(), trailFrom = null;
const idx = (c, r) => r * COLS + c;
const inside = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS;
function buildPark() {
  owner = new Uint8Array(COLS * ROWS); zone = new Uint8Array(COLS * ROWS); zoneCount = 0;
  const m = mapRect();
  zoneC = { c: clamp(m.x + HOUSE.u * m.w, 2.5, COLS - 2.5), r: clamp(m.y + HOUSE.v * m.h, 2.5, ROWS - 2.5), R: 3.2 };
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (Math.hypot(c + 0.5 - zoneC.c, r + 0.5 - zoneC.r) < zoneC.R) { zone[idx(c, r)] = 1; zoneCount++; }
  trail = []; trailSet = new Set(); trailFrom = null; terrDirty = true;
}
const START = () => ({ c: Math.floor(COLS / 2), r: ROWS - 7 });
function homeBlock() {
  const s = START();
  for (let r = s.r - 2; r <= s.r + 2; r++) for (let c = s.c - 2; c <= s.c + 2; c++) if (inside(c, r)) owner[idx(c, r)] = 1;
  terrDirty = true;
}
function ownedCount() { let n = 0; for (let i = 0; i < owner.length; i++) n += owner[i]; return n; }
const pctNow = () => Math.floor(ownedCount() / (COLS * ROWS - zoneCount) * 100);

// close the loop: the trail becomes his, and so does every cell the outside can't reach
function claim() {
  for (const t of trail) owner[idx(t.c, t.r)] = 1;
  const out = new Uint8Array(COLS * ROWS), q = [];
  const seed = (c, r) => { const i = idx(c, r); if (!owner[i] && !out[i]) { out[i] = 1; q.push(i); } };
  for (let c = 0; c < COLS; c++) { seed(c, 0); seed(c, ROWS - 1); }
  for (let r = 0; r < ROWS; r++) { seed(0, r); seed(COLS - 1, r); }
  for (let i = 0; i < zone.length; i++) if (zone[i] && !owner[i] && !out[i]) { out[i] = 1; q.push(i); }   // her house is never his
  while (q.length) {
    const i = q.pop(), c = i % COLS, r = (i / COLS) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = c + dx, nr = r + dy; if (inside(nc, nr)) seed(nc, nr); }
  }
  let gained = trail.length;
  for (let i = 0; i < owner.length; i++) if (!owner[i] && !out[i]) { owner[i] = 1; gained++; }
  const n = trail.length; trail = []; trailSet = new Set(); trailFrom = null; terrDirty = true;
  if (!tutorial) { score += gained; nightStat.tiles += gained; }
  play('claim', .7); loop('trail', 0);
  popText(px(player.c), py(player.r) - B.t * 2.4, `+${gained}`, '');
  if (tutWait && tutWait.id === 'claim' && n) tutWait.done = true;
  // anyone standing on his ground now is trapped in the conversation
  for (const g of girls) if ((g.state === 'walk' || g.state === 'talk') && owner[idx(Math.round(g.x), Math.round(g.y))]) trapped(g);
  hud();
  checkNight();
}

// ───────────────────────── state ─────────────────────────
let state = 'menu', paused = false, tutorial = false;
let score = 0, lives = 3, night = 1, T = 0, freeze = 0, invuln = 0, count = 0, runs = 0;
let player = null, dir = { x: 0, y: -1 }, queue = [];
let girls = [], police = [], talk = null, R = Math.random, girlNext = 0, idleT = 6, warned = 0;
let nightStat = { tiles: 0, talks: 0 };
const GOALS = [30, 40, 48, 55, 60, 65, 70];
const goal = () => GOALS[Math.min(night - 1, GOALS.length - 1)];
const SPEED = 5.2;                                            // tiles per second
const stepDur = () => tutorial ? 4.2 : Math.max(1.8, 3.0 - 0.2 * (night - 1));
const maxGirls = () => Math.min(6, 2 + night);
const kinds = () => UNLOCK.slice(0, Math.min(4, night + 1));

function resetPlayer() {
  const s = START();
  player = { c: s.c, r: s.r, pc: s.c, pr: s.r, prog: 1, face: 1, idle: true };
  dir = { x: 0, y: -1 }; queue = []; trail = []; trailSet = new Set(); trailFrom = null; loop('trail', 0);
}
const ppos = () => ({ x: lerp(player.pc, player.c, clamp(player.prog, 0, 1)), y: lerp(player.pr, player.r, clamp(player.prog, 0, 1)) });
const onOwn = () => owner[idx(player.c, player.r)] === 1;

function startNight(first) {
  state = 'count'; count = 3.2; freeze = 0; invuln = 0; talk = null; pips(0);
  setRows(); buildPark(); homeBlock(); resetPlayer();
  R = rng(`${SLUG}|${today()}|${night}`);
  girls = []; police = []; girlNext = 0.5;
  for (let i = 0; i < night; i++) addPolice(false);
  nightStat = { tiles: 0, talks: 0 };
  showHUD(true); show(null); hud(); fxEl.innerHTML = '';
  say(night === 1 ? 'לילה בגינה. בואו נראה מי מסתובבת פה...' : `לילה ${night}. ${kinds().length > night ? '' : ''}עוד שאלות קטנות.`, 3);
  loop('music', 0.28); loop('park', 0.35);
  if (first) { window.track && window.track('game_start', SLUG); play('start', .7); }
}
function setRows() { ROWS = fitRows(); layout(); }
function startGame() {
  tutorial = false; score = 0; lives = 3; night = 1; T = 0; runs++;
  startNight(true);
}

// ───────────────────────── strangers ─────────────────────────
function freeCell(test, tries = 300) {
  for (let k = 0; k < tries; k++) { const c = Math.floor(R() * COLS), r = Math.floor(R() * ROWS); if (test(c, r)) return { c, r }; }
  return null;
}
const walkable = (c, r) => inside(c, r) && !owner[idx(c, r)] && !zone[idx(c, r)];
function addGirl(at, kind, spd) {
  const pp = ppos();
  const p = at || freeCell((c, r) => walkable(c, r) && (c === 0 || r === 0 || c === COLS - 1 || r === ROWS - 1) && Math.hypot(c - pp.x, r - pp.y) > 6)
    || freeCell((c, r) => walkable(c, r) && Math.hypot(c - pp.x, r - pp.y) > 6);
  if (!p) return null;
  const g = { kind: kind || pick(kinds(), R), x: p.c, y: p.r, c: p.c, r: p.r, tc: p.c, tr: p.r, spd: spd || (1.1 + R() * 0.4), state: 'walk', t: 0, cool: 0, flip: false, goal: null, k: 0 };
  girls.push(g); return g;
}
function girlGoal(g) { g.goal = freeCell((c, r) => walkable(c, r) && Math.hypot(c - g.c, r - g.r) > 4) || { c: g.c, r: g.r }; }
function girlStep(g, dt) {
  if (g.state === 'stuck') { g.t -= dt; if (g.t <= 0) { g.state = 'flee'; play('scream', .55); } return; }
  const fleeing = g.state === 'flee';
  const spd = fleeing ? 4.2 : g.state === 'talk' ? g.spd * 0.55 : g.spd;
  // move from (c,r) toward the next tile (tc,tr)
  const dx = g.tc - g.x, dy = g.tr - g.y, d = Math.hypot(dx, dy);
  if (d > 0.001) { const m = Math.min(d, spd * dt); g.x += dx / d * m; g.y += dy / d * m; if (Math.abs(dx) > 0.01) g.flip = dx < 0; return; }
  g.c = g.tc; g.r = g.tr;
  if (fleeing) {                                          // straight to the nearest edge, then gone
    if (!g.out) g.out = [[g.c + 1, -1, 0], [COLS - g.c, 1, 0], [g.r + 1, 0, -1], [ROWS - g.r, 0, 1]].sort((a, b) => a[0] - b[0])[0];
    g.tc = g.c + g.out[1]; g.tr = g.r + g.out[2];
    if (!inside(g.c, g.r)) g.gone = true;
    return;
  }
  if (!g.goal || (g.goal.c === g.c && g.goal.r === g.r) || R() < 0.04) girlGoal(g);
  const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([ox, oy]) => ({ c: g.c + ox, r: g.r + oy }))
    .filter((p) => walkable(p.c, p.r)).sort((a, b) => Math.hypot(a.c - g.goal.c, a.r - g.goal.r) - Math.hypot(b.c - g.goal.c, b.r - g.goal.r));
  if (!opts.length) return;                               // boxed in by his ground: she waits (and gets trapped by the next loop)
  const n = opts[0];
  if (n.c === g.c && n.r === g.r) return;
  g.tc = n.c; g.tr = n.r;
}

// ───────────────────────── the small talk ─────────────────────────
function startTalk(g) {
  g.state = 'talk';
  talk = { g, step: 0, t: 0 };
  say(STORIES[g.kind][0], 99); pips(1);
  play('talk', .8); guySays('סליחה!', 1.2);
  if (tutWait && tutWait.id === 'talk') tutWait.done = true;
}
function talkStep(dt) {
  if (!talk) {
    if (state !== 'play' && !(tutorial && tutTalkOK())) return;
    const pp = ppos();
    let best = null, bd = 3.4;
    for (const g of girls) if (g.state === 'walk' && g.cool <= 0) { const d = Math.hypot(g.x - pp.x, g.y - pp.y); if (d < bd) { bd = d; best = g; } }
    if (best) startTalk(best);
    return;
  }
  const g = talk.g, pp = ppos();
  if (g.state !== 'talk') { talk = null; pips(0); return; }
  if (Math.hypot(g.x - pp.x, g.y - pp.y) > 7.5) {           // he walked off - she goes on her way
    g.state = 'walk'; g.cool = 8; talk = null; pips(0); say(pickNo(LINES.drop, 'drop'), 2.4); return;
  }
  talk.t += dt;
  if (talk.t < stepDur()) return;
  talk.t = 0; talk.step++;
  if (talk.step < 3) {
    say(STORIES[g.kind][talk.step], 99); pips(talk.step + 1);
    play('talk', .8); if (talk.step === 2) setTimeout(() => play('gasp', .6), 400);
    return;
  }
  // the reveal slipped out before he closed the loop: she screams, runs and calls the police
  say(STORIES[g.kind][3], 3.4, 'loud'); pips(4);
  play('reveal', .7); setTimeout(() => play('scream', .7), 350);
  g.state = 'flee'; talk = null;
  popText(px(g.x), py(g.y) - B.t * 2.4, tutorial ? 'היא ברחה!' : 'התקשרה למשטרה!', 'bad');
  if (tutorial) { setTimeout(() => { if (tutorial && tutWait && tutWait.id === 'capture' && !tutWait.done) tutGirl(); }, 1600); return; }
  addPolice(true);
}
// she is inside his ground: stuck in the conversation till the end
function trapped(g) {
  const was = talk && talk.g === g, left = was ? 3 - talk.step : 0;
  const pts = 150 + left * 80;
  g.state = 'stuck'; g.t = 2.4;
  if (was) { say(STORIES[g.kind][3], 3.6, 'reveal'); pips(4); talk = null; }
  else say(pickNo(LINES.other, 'oth'), 2.4);
  play('capture', .8); setTimeout(() => play('reveal', .55), 500); setTimeout(() => play('gasp', .7), 900);
  if (!tutorial) { score += pts; nightStat.talks++; }
  popText(px(g.x), py(g.y) - B.t * 2.6, `+${pts}`, 'gold'); setTimeout(() => popText(px(g.x), py(g.y) - B.t * 1.6, was && left ? 'נתקעה איתו!' : 'שיחה!', ''), 250);
  if (tutWait && tutWait.id === 'capture') tutWait.done = true;
  hud();
}

// ───────────────────────── police ─────────────────────────
const DIR4 = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
function addPolice(called) {
  if (police.length >= 2 + night + 1) return;
  const pp = ppos();
  const p = freeCell((c, r) => (c === 0 || c === COLS - 1 || r === 0 || r === ROWS - 1) && Math.hypot(c - pp.x, r - pp.y) > 9) || { c: 0, r: 0 };
  const d = p.c === 0 ? DIR4[0] : p.c === COLS - 1 ? DIR4[1] : p.r === 0 ? DIR4[2] : DIR4[3];
  police.push({ x: p.c, y: p.r, c: p.c, r: p.r, tc: p.c + d.x, tr: p.r + d.y, d, chase: called ? 6 : 0, ang: Math.atan2(d.y, d.x) });
  if (called) { play('siren', .25); flash(true); }
}
function policeStep(o, dt) {
  const spd = (tutorial ? 2.0 : 2.3 + 0.18 * (night - 1)) * (o.chase > 0 ? 1.25 : 1);
  if (o.chase > 0) o.chase -= dt;
  const dx = o.tc - o.x, dy = o.tr - o.y, d = Math.hypot(dx, dy);
  if (d > 0.001) { const m = Math.min(d, spd * dt); o.x += dx / d * m; o.y += dy / d * m; }
  else {
    o.c = o.tc; o.r = o.tr;
    let opts = DIR4.filter((q) => inside(o.c + q.x, o.r + q.y) && !(q.x === -o.d.x && q.y === -o.d.y));
    if (!opts.length) opts = DIR4.filter((q) => inside(o.c + q.x, o.r + q.y));
    const ahead = opts.find((q) => q.x === o.d.x && q.y === o.d.y);
    let nd;
    if (o.chase > 0) {                                     // called in: heads for him / his trail
      const tgt = trail.length ? trail[Math.floor(trail.length / 2)] : ppos();
      nd = opts.slice().sort((a, b) => Math.hypot(o.c + a.x - (tgt.c ?? tgt.x), o.r + a.y - (tgt.r ?? tgt.y)) - Math.hypot(o.c + b.x - (tgt.c ?? tgt.x), o.r + b.y - (tgt.r ?? tgt.y)))[0];
    } else nd = ahead && R() > 0.18 ? ahead : pick(opts, R);
    o.d = nd; o.tc = o.c + nd.x; o.tr = o.r + nd.y;
  }
  const want = Math.atan2(o.d.y, o.d.x); let da = want - o.ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; o.ang += da * Math.min(1, dt * 10);
  // a police car on his trail, or on him outside his ground = caught
  if (invuln > 0 || state !== 'play' && !tutorial) return;
  const cc = Math.round(o.x), cr = Math.round(o.y), pp = ppos();
  if (trailSet.has(idx(cc, cr)) || (!onOwn() && trail.length && Math.hypot(o.x - pp.x, o.y - pp.y) < 0.8)) caught('police');
}

// ───────────────────────── input: floating joystick + keys ─────────────────────────
const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const joy = { on: false, ox: 0, oy: 0, x: 0, y: 0, d: null };
function want(d) {
  if (!d) return;
  if (player && player.idle && live()) { player.idle = false; dir = d; queue = []; if (d.x) player.face = d.x; return; }
  const last = queue.length ? queue[queue.length - 1] : dir;
  if (d.x === last.x && d.y === last.y) return;
  if (queue.length < 2) queue.push(d);
}
const live = () => !paused && (state === 'play' || state === 'tut');
cv.addEventListener('pointerdown', (e) => {
  audioUnlock();
  if (!live()) return;
  joy.on = true; joy.ox = joy.x = e.clientX; joy.oy = joy.y = e.clientY; joy.d = null;
  try { cv.setPointerCapture(e.pointerId); } catch (err) {}
});
cv.addEventListener('pointermove', (e) => {
  if (!joy.on) return;
  joy.x = e.clientX; joy.y = e.clientY;
  let dx = joy.x - joy.ox, dy = joy.y - joy.oy; const dist = Math.hypot(dx, dy), RR = 46;
  if (dist > RR) { joy.ox = joy.x - dx / dist * RR; joy.oy = joy.y - dy / dist * RR; dx = joy.x - joy.ox; dy = joy.y - joy.oy; }
  if (dist < 14) return;
  const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIRS.right : DIRS.left) : (dy > 0 ? DIRS.down : DIRS.up);
  if (d !== joy.d) { joy.d = d; want(d); }
});
const joyEnd = () => { joy.on = false; joy.d = null; };
cv.addEventListener('pointerup', joyEnd); cv.addEventListener('pointercancel', joyEnd);
document.addEventListener('pointerdown', audioUnlock, true);
addEventListener('keydown', (e) => {
  const k = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' }[e.key];
  if (k && live()) { e.preventDefault(); audioUnlock(); want(DIRS[k]); }
});

// ───────────────────────── his walk ─────────────────────────
function pTick() {
  while (queue.length) {
    const d = queue.shift();
    if (trail.length && d.x === -dir.x && d.y === -dir.y) continue;   // never straight back over his own trail
    dir = d; if (d.x) player.face = d.x; break;
  }
  const nc = player.c + dir.x, nr = player.r + dir.y;
  if (!inside(nc, nr)) { player.prog = 1; return false; }             // the park's edge: he waits for a turn
  const wasOwn = onOwn();
  player.pc = player.c; player.pr = player.r; player.c = nc; player.r = nr;
  const i = idx(nc, nr);
  if (zone[i]) { caught('zone'); return true; }
  if (owner[i]) { if (trail.length) claim(); return true; }
  if (trailSet.has(i)) { caught('self'); return true; }
  if (wasOwn) { trailFrom = { c: player.pc, r: player.pr }; loop('trail', 0.22); }
  trail.push({ c: nc, r: nr }); trailSet.add(i);
  if (tutWait && tutWait.id === 'leave' && trail.length >= 2) tutWait.done = true;
  return true;
}
function caught(why) {
  if (invuln > 0 || freeze > 0) return;
  const pp = ppos();
  if (tutorial) {
    play('caught', .5); popText(px(pp.x), py(pp.y) - B.t * 2, 'אופס! עוד פעם', 'bad');
    trail = []; trailSet = new Set(); trailFrom = null; loop('trail', 0); toHome(); invuln = 1.2; return;
  }
  lives--; freeze = 1.3; invuln = 1.3 + 1.6; loop('trail', 0);
  play('caught', .8); if (why !== 'self') play('siren', .22);
  flash(); say(pickNo(LINES[why], why), 2.6, 'loud');
  popText(px(pp.x), py(pp.y) - B.t * 2.6, why === 'zone' ? 'צו הרחקה!' : why === 'self' ? 'השובל שלך!' : 'נתפסת!', 'bad');
  if (talk) { talk.g.state = 'walk'; talk.g.cool = 6; talk = null; pips(0); }
  caughtWhy = why;
  hud();
}
let caughtWhy = '';
function toHome() {            // back to the nearest cell of his ground
  const pp = ppos(); let best = null, bd = 1e9;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (owner[idx(c, r)]) { const d = Math.hypot(c - pp.x, r - pp.y); if (d < bd) { bd = d; best = { c, r }; } }
  best = best || START();
  player.c = player.pc = best.c; player.r = player.pr = best.r; player.prog = 1; queue = []; player.idle = true;
}
function afterCaught() {
  trail = []; trailSet = new Set(); trailFrom = null;
  if (lives <= 0) return gameOver();
  toHome();
}

// ───────────────────────── nights ─────────────────────────
function checkNight() {
  if (tutorial || state !== 'play') return;
  if (pctNow() < goal()) return;
  state = 'nightdone'; loop('trail', 0); play('night', .8); banner('הגינה שלו!');
  const did = `השתלטתם על ${pctNow()}% · ${nightStat.talks} שיחות`;
  if (lives < 3) lives++;
  night++;
  setTimeout(() => {
    fxEl.innerHTML = ''; joyEnd();
    $('nightDid').textContent = did; $('nightBig').textContent = `לילה ${night}`;
    const nk = UNLOCK[night] && night <= 3 ? ' · סיפור חדש!' : '';
    $('nightGoal').textContent = `יעד: ${goal()}% מהגינה${nk}`;
    show('night');
  }, 1500);
}
$('nightBtn').onclick = () => { audioUnlock(); startNight(false); };

// ───────────────────────── the frame ─────────────────────────
function step(dt) {
  T += dt;
  if (state === 'count') {
    const before = Math.ceil(count); count -= dt; const now = Math.ceil(count);
    if (now !== before && now >= 1 && now <= 3) { banner(String(now), 'count'); play('tick', .6); }
    if (count <= 0) { state = 'play'; banner('יאללה!'); play('go', .7); say('גררו אצבע לכיוון כדי ללכת', 4); }
    return;
  }
  if (state !== 'play' && state !== 'tut') return;
  if (freeze > 0) { freeze -= dt; if (freeze <= 0) afterCaught(); return; }
  if (invuln > 0) invuln -= dt;
  // he walks
  if (tutMove() && !player.idle) {
    player.prog += dt * SPEED;
    let guard = 0;
    while (player.prog >= 1 && guard++ < 3) { player.prog -= 1; if (!pTick()) break; if (freeze > 0 || state !== 'play' && state !== 'tut') break; }
  }
  for (const g of girls) { girlStep(g, dt); if (g.cool > 0) g.cool -= dt; }
  girls = girls.filter((g) => !g.gone);
  talkStep(dt);
  for (const o of police) policeStep(o, dt);
  if (!tutorial && state === 'play') {
    if (girls.filter((g) => g.state !== 'flee').length < maxGirls() && (girlNext -= dt) <= 0) { addGirl(); girlNext = 2.2; }
    // near her house: a warning once in a while
    const pp = ppos(), dz = Math.hypot(pp.x + 0.5 - zoneC.c, pp.y + 0.5 - zoneC.r) - zoneC.R;
    if (dz < 2 && (warned -= dt) <= 0) { warned = 6; play('warn', .5); guySays(pickNo(LINES.near, 'near'), 2.2); }
    if (!talk && !bubble && (idleT -= dt) <= 0) { idleT = 8 + Math.random() * 5; guySays(pickNo(LINES.idle, 'idle'), 2); }
  }
  if (bubble && (bubble.t -= dt) <= 0) bubble = null;
}

// ───────────────────────── drawing ─────────────────────────
let terr = document.createElement('canvas'), terrDirty = true;
function drawTerritory() {
  if (terrDirty) {
    terr.width = COLS; terr.height = ROWS; const tc = terr.getContext('2d');
    const im = tc.createImageData(COLS, ROWS);
    for (let i = 0; i < owner.length; i++) if (owner[i]) { im.data[i * 4] = 124; im.data[i * 4 + 1] = 58; im.data[i * 4 + 2] = 237; im.data[i * 4 + 3] = 255; }
    tc.putImageData(im, 0, 0); terrDirty = false;
  }
  ctx.save(); ctx.globalAlpha = 0.5; ctx.imageSmoothingEnabled = false; ctx.drawImage(terr, B.x, B.y, B.w, B.h); ctx.restore();
  // the bright edge of his ground
  ctx.save(); ctx.strokeStyle = '#c4b5fd'; ctx.lineWidth = Math.max(2, B.t * 0.14); ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 8; ctx.beginPath();
  const t = B.t;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (!owner[idx(c, r)]) continue;
    const x = B.x + c * t, y = B.y + r * t;
    if (r === 0 || !owner[idx(c, r - 1)]) { ctx.moveTo(x, y); ctx.lineTo(x + t, y); }
    if (r === ROWS - 1 || !owner[idx(c, r + 1)]) { ctx.moveTo(x, y + t); ctx.lineTo(x + t, y + t); }
    if (c === 0 || !owner[idx(c - 1, r)]) { ctx.moveTo(x, y); ctx.lineTo(x, y + t); }
    if (c === COLS - 1 || !owner[idx(c + 1, r)]) { ctx.moveTo(x + t, y); ctx.lineTo(x + t, y + t); }
  }
  ctx.stroke(); ctx.restore();
}
function drawZone(now) {
  const cx = B.x + zoneC.c * B.t, cy = B.y + zoneC.r * B.t, rr = zoneC.R * B.t;
  ctx.save(); ctx.fillStyle = '#ef444422'; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
  ctx.setLineDash([B.t * 0.5, B.t * 0.35]); ctx.lineDashOffset = -now * 12; ctx.strokeStyle = '#ef4444'; ctx.lineWidth = Math.max(2.5, B.t * 0.16); ctx.stroke(); ctx.restore();
}
function drawTrail(now) {
  if (!trail.length || !trailFrom) return;
  const pp = ppos();
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = () => { ctx.beginPath(); ctx.moveTo(px(trailFrom.c), py(trailFrom.r)); for (const t of trail) ctx.lineTo(px(t.c), py(t.r)); ctx.lineTo(px(pp.x), py(pp.y)); };
  path(); ctx.strokeStyle = '#a855f766'; ctx.lineWidth = B.t * 0.75; ctx.shadowColor = '#d8b4fe'; ctx.shadowBlur = 14; ctx.stroke();
  path(); ctx.shadowBlur = 0; ctx.strokeStyle = '#f5f3ff'; ctx.lineWidth = B.t * 0.22 + Math.sin(now * 8) * 1; ctx.stroke();
  ctx.restore();
}
function sprite(im, cx, bottom, h, flip, alpha = 1, sq = 1) {
  if (!ok(im)) return;
  const w = h * im.naturalWidth / im.naturalHeight;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, bottom); ctx.scale(flip ? -1 / sq : 1 / sq, sq);
  ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
}
function shadow(cx, cy, w) { ctx.save(); ctx.fillStyle = '#0006'; ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, w / 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
function drawBubble(text, hx, hy, alpha) {
  const fs = clamp(Math.round(B.t * 0.62), 12, 15), pad = fs * 0.5, maxW = Math.min(W * 0.55, fs * 11);
  ctx.save(); ctx.font = `700 ${fs}px Rubik, system-ui, sans-serif`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const words = text.split(' '), rows = []; let row = '';
  for (const w of words) { const t = row ? row + ' ' + w : w; if (ctx.measureText(t).width > maxW && row) { rows.push(row); row = w; } else row = t; }
  rows.push(row);
  const bw = Math.max(...rows.map((t) => ctx.measureText(t).width)) + pad * 2, bh = rows.length * fs * 1.25 + pad * 1.2;
  const right = hx < W / 2;
  let bx = right ? hx + B.t * 0.6 : hx - B.t * 0.6 - bw, by = hy - bh;
  bx = clamp(bx, 6, W - bw - 6); by = clamp(by, B.y + 2, H - bh - 80);
  ctx.globalAlpha = alpha; ctx.fillStyle = '#fffffff2'; ctx.strokeStyle = '#140d2477'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, Math.min(14, bh / 2)); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#140d24'; rows.forEach((t, i) => ctx.fillText(t, bx + bw / 2, by + pad * 0.6 + fs * 1.25 * (i + 0.5)));
  ctx.restore();
}
function draw(now) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#0d0818'; ctx.fillRect(0, 0, W, H);
  if (state === 'menu' || !player) return;
  const t = B.t;
  ctx.save(); ctx.beginPath(); ctx.roundRect(B.x, B.y, B.w, B.h, 10); ctx.clip();
  if (ok(IMG.map)) { const m = mapRect(); ctx.drawImage(IMG.map, B.x + m.x * t, B.y + m.y * t, m.w * t, m.h * t); }
  ctx.fillStyle = '#0d081822'; ctx.fillRect(B.x, B.y, B.w, B.h);
  drawZone(now); drawTerritory(); drawTrail(now);
  // everyone, back to front
  const items = [];
  for (const g of girls) items.push({ y: g.y, f: () => {
    const cx = px(g.x), by = py(g.y) + t * 0.45, run = g.state === 'flee' || g.state === 'stuck';
    const bob = g.state === 'stuck' ? Math.sin(now * 40) * t * 0.05 : 0;
    shadow(cx, by, t * 1.1);
    sprite(IMG[`girl-${g.kind}-${run ? 'run' : 'walk'}`], cx + bob, by - (run ? 0 : Math.abs(Math.sin(now * 7 + g.c)) * t * 0.08), t * 2.75, g.flip, g.state === 'flee' && !inside(Math.round(g.x), Math.round(g.y)) ? 0.5 : 1);
    // her face over her head: how the talk is going
    let f = null;
    if (g.state === 'talk') f = talk && talk.g === g && talk.step >= 2 ? 'unsure' : 'polite';
    else if (g.state === 'stuck' || g.state === 'flee') f = 'horror';
    else if (g.cool > 0) f = 'unsure';
    if (f) { const s = t * 1.9, pulse = 1 + (g.state === 'talk' ? Math.sin(now * 6) * 0.05 : 0); const im = IMG['face-' + f]; if (ok(im)) ctx.drawImage(im, cx - s * pulse / 2, by - t * 2.75 - s * pulse - t * 0.1, s * pulse, s * pulse); }
  } });
  for (const o of police) items.push({ y: o.y, f: () => {
    const im = IMG.police; if (!ok(im)) return; const L = t * 2.0, w = L * im.naturalWidth / im.naturalHeight;
    ctx.save(); ctx.translate(px(o.x), py(o.y)); ctx.rotate(o.ang + Math.PI / 2);
    ctx.fillStyle = '#0005'; ctx.beginPath(); ctx.ellipse(t * 0.1, t * 0.15, w * 0.55, L * 0.52, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(im, -w / 2, -L / 2, w, L);
    if (Math.floor(now * 6) % 2) { ctx.fillStyle = o.chase > 0 ? '#ef444466' : '#3b82f644'; ctx.beginPath(); ctx.arc(0, 0, L * 0.7, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  } });
  const pp = ppos();
  items.push({ y: pp.y + 0.01, f: () => {
    const cx = px(pp.x), by = py(pp.y) + t * 0.45;
    const blink = invuln > 0 && freeze <= 0 && Math.floor(now * 10) % 2;
    shadow(cx, by, t * 1.2);
    if (freeze > 0) { sprite(IMG['guy-caught'], cx + Math.sin(now * 50) * 2, by, t * 2.8, false); return; }
    const im = talk ? IMG['guy-talk'] : IMG['guy-walk'];
    const sq = 1 + Math.sin(now * 14) * 0.04;
    sprite(im, cx, by, t * 2.8, player.face < 0, blink ? 0.4 : 1, sq);
  } });
  items.sort((a, b) => a.y - b.y).forEach((it) => it.f());
  ctx.restore();
  if (bubble) drawBubble(bubble.text, px(pp.x), py(pp.y) - t * 2.6, clamp(bubble.t * 3, 0, 1));
  if (joy.on) {
    ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.fillStyle = '#140d2466';
    ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 46, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 0.85; ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(joy.x, joy.y, 18, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
}

// ───────────────────────── HUD + screens ─────────────────────────
function hud() {
  const p = player ? pctNow() : 0, g = tutorial ? 30 : goal();
  $('pctBar').style.width = Math.min(100, p / g * 100) + '%';
  $('pctGoal').style.display = 'none';
  $('pctTxt').innerHTML = `<span dir="ltr">${p}% / ${g}%</span>`;
  $('scoreBox').textContent = score;
  $('livesBox').textContent = '❤'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, 3 - lives));
  $('nightBox').textContent = `לילה ${night}`;
}
function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id)); }
function showHUD(on) { $('hud').classList.toggle('on', on); $('strip').classList.toggle('on', on); }
function bestNum() { return +(store.get(KEY.best) || 0); }
function showBest() {
  const b = bestNum(), d = (store.get(KEY.day) || '').split('|');
  const td = d[0] === today() ? +d[1] : 0;
  $('bestStart').innerHTML = b ? `השיא שלכם: <b>${b}</b>` + (td ? ` · היום: <b>${td}</b>` : '') : 'כמה מהגינה יהיה שלו הלילה?';
  $('bestOver').innerHTML = b ? `השיא שלכם: <b>${b}</b>` : '';
}
function gameOver() {
  state = 'over';
  window.track && window.track('game_over', SLUG); window.VerseFrame && VerseFrame.score(score);
  const b = bestNum(), rec = score > b;
  if (rec) store.set(KEY.best, score);
  const d = (store.get(KEY.day) || '').split('|');
  if (d[0] !== today() || score > +d[1]) store.set(KEY.day, `${today()}|${score}`);
  play('over', .7); loopsOff();
  setTimeout(() => {
    fxEl.innerHTML = ''; showHUD(false); joyEnd();
    $('overH').textContent = caughtWhy === 'zone' ? 'צו הרחקה!' : caughtWhy === 'self' ? 'נתקעת בשובל של עצמך!' : 'נתפסת!';
    $('overScore').innerHTML = `${score}<small>נקודות · הגעתם ללילה ${night}</small>`;
    $('overLine').textContent = night >= 4 ? '״כל הגינה מכירה אותי. אני שואל בשביל לדעת.״' : night >= 2 ? '״היה לילה טוב. יש לי עוד המון שאלות קטנות.״' : '״אבל רק שאלתי שאלה קטנה!״';
    $('overRec').innerHTML = rec && score ? '<span class="newrec">שיא חדש!</span>' : '';
    showBest(); show('over');
  }, 900);
}
$('playBtn').onclick = () => { audioUnlock(); if (!store.get(KEY.tut)) tut.begin(); else startGame(); };
$('howBtn').onclick = () => { audioUnlock(); tut.begin(); };
$('againBtn').onclick = () => { audioUnlock(); startGame(); };
function pause(on) {
  if (state !== 'play' && state !== 'tut' && state !== 'count') return;
  paused = on; show(on ? 'paused' : null); joyEnd();
  if (SND.ctx) on ? SND.ctx.suspend() : SND.ctx.resume();
}
$('pauseBtn').onclick = () => pause(true);
$('resumeBtn').onclick = () => { audioUnlock(); pause(false); };
$('quitBtn').onclick = () => { paused = false; SND.ctx && SND.ctx.resume(); state = 'menu'; loopsOff(); tut.end(true); showHUD(false); showBest(); show('start'); };
document.getElementById('menuBtn').onclick = () => $('quitBtn').click();
addEventListener('pagehide', () => { if (SND.ctx) SND.ctx.suspend(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (state === 'play' || state === 'tut' || state === 'count') pause(true); else if (SND.ctx) SND.ctx.suspend(); } });
document.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => SND.ctx && SND.ctx.suspend()));

// ───────────────────────── tutorial ─────────────────────────
const tutCard = $('tutCard'), tutHole = $('tutHole');
let tutWait = null;
const spotBoard = () => ({ x: B.x - 4, y: B.y - 4, w: B.w + 8, h: B.h + 8 });
const spotEl = (id) => () => { const r = $(id).getBoundingClientRect(); return { x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 }; };
const spotAt = (f, wT = 4, hT = 5) => () => { const p = f(); return p && { x: px(p.x) - wT * B.t / 2, y: py(p.y) - hT * B.t * 0.75, w: wT * B.t, h: hT * B.t }; };
const STEPS = [
  { text: 'זה <b>פסיכופת גינה</b>. בלילה הוא מסתובב בגינה – ויש לו שאלה קטנה לכל מי שעוברת.', spot: spotAt(() => ppos(), 10, 6) },
  { text: '<b>המטרה:</b> להשתלט על הגינה. השטח הסגול – שלו. כמה צריך הלילה – כתוב למעלה.', spot: spotEl('pctBox') },
  { text: '<b>הליכה:</b> אצבע בכל מקום וגוררים לכיוון (במחשב: החצים). מחוץ לשטח נשאר <b>שובל</b>. נסו – <b>צאו מהשטח!</b>', try: 'leave', move: true },
  { text: 'עכשיו <b>חזרו לשטח הסגול</b> – הלולאה נסגרת, וכל מה שבפנים שלו!', try: 'claim', move: true },
  { text: 'זרה בגינה. <b>מה שהיא מחזיקה</b> = על מה הוא ידבר איתה (כאן: רילסים). כשמתקרבים – הוא מתחיל לדבר.', setup: 'girl', spot: spotAt(() => girls[0], 4, 5) },
  { text: 'כל משפט שלו <b>מחריד יותר</b> – תסתכלו על הפנים שלה ועל הנקודות למטה. <b>סגרו עליה לולאה לפני סוף הסיפור!</b>', try: 'capture', move: true, setup: 'girl2' },
  { text: '<b>ניידת משטרה.</b> נגעה בשובל שלכם – נתפסתם. בתוך השטח הסגול אתם מוגנים. מי שבורחת – מזמינה עוד ניידת.', setup: 'police', spot: spotAt(() => police[0], 4, 4) },
  { text: '<b>הבית עם העיגול האדום – צו הרחקה.</b> נכנסתם – נתפסתם. וגם לחצות את השובל של עצמכם = נתפסתם.', spot: () => ({ x: B.x + (zoneC.c - zoneC.R - 0.5) * B.t, y: B.y + (zoneC.r - zoneC.R - 0.5) * B.t, w: (zoneC.R * 2 + 1) * B.t, h: (zoneC.R * 2 + 1) * B.t }) },
  { text: 'יש לכם <b>3 חיים</b>. כל לילה – עוד ניידות, עוד זרות, וסיפור חדש. מוכנים? לילה טוב...', spot: spotEl('livesBox'), last: true },
];
function tutGirl() {           // a stranger with a phone, slowly crossing above his ground
  girls = girls.filter((g) => g.state !== 'flee' || !g.gone);
  girls = [];
  const s = START();
  const g = addGirl({ c: s.c - 5, r: s.r - 6 }, 'phone', 0.55);
  if (g) g.goal = { c: s.c + 5, r: s.r - 6 };
}
function tutTalkOK() { const s = STEPS[tut.i]; return s && s.try === 'capture'; }
function tutMove() { if (!tutorial) return state === 'play'; const s = STEPS[tut.i]; return !!(s && s.move) && !(tutWait && tutWait.done); }
const tut = {
  on: false, i: 0,
  begin() {
    show(null); showHUD(true); state = 'tut'; tutorial = true; this.on = true; this.i = 0; score = 0; lives = 3; night = 1; T = 0; talk = null; pips(0);
    setRows(); buildPark(); homeBlock(); resetPlayer(); R = rng('tutorial'); girls = []; police = []; freeze = 0; invuln = 0; hud();
    loop('music', 0.22); loop('park', 0.3);
    tutCard.classList.add('on'); this.enter();
  },
  enter() {
    const s = STEPS[this.i];
    tutWait = s.try ? { id: s.try, done: false } : null;
    if (s.setup === 'girl') { tutGirl(); }
    if (s.setup === 'girl2') { toHome(); if (!girls.length || girls[0].state === 'flee') tutGirl(); }
    if (s.setup === 'police') { girls = []; talk = null; pips(0); police = []; R = rng('tutorial-police'); addPolice(false); }
    if (s.last) { police = []; }
    if (this.i === 0) guySays('סליחה, אפשר לשאול אותך משהו?', 3);
    $('tutText').innerHTML = s.text;
    $('tutCount').textContent = `${this.i + 1} / ${STEPS.length}`;
    $('tutBar').firstElementChild.style.width = ((this.i + 1) / STEPS.length * 100) + '%';
    $('tutNext').innerHTML = (s.last ? 'שחקו!' : 'הבא') + ' <span class="keyhint">(רווח)</span>';
    hud();
  },
  next() {
    if (tutWait && !tutWait.done) return;
    play('tick', .4);
    if (++this.i >= STEPS.length) return this.end();
    this.enter();
  },
  end(quiet) {
    this.on = false; tutWait = null; tutCard.classList.remove('on'); $('tutDim').classList.remove('on');
    store.set(KEY.tut, '1'); tutorial = false; girls = []; police = []; talk = null; pips(0);
    if (!quiet) startGame();
  },
  frame() {
    if (!this.on) return;
    const s = STEPS[this.i], sp = s.spot && s.spot();
    const dim = sp && !(tutWait && !tutWait.done);
    $('tutDim').classList.toggle('on', !!dim);
    if (dim) Object.assign(tutHole.style, { left: sp.x + 'px', top: sp.y + 'px', width: sp.w + 'px', height: sp.h + 'px' });
    // the card at the top (his ground starts at the bottom); during "try it" it stays out of the way at the top too
    tutCard.style.top = `calc(var(--safe-t) + 52px)`; tutCard.style.bottom = 'auto';
    if (tutWait && tutWait.done && !tutWait.shown) { tutWait.shown = true; $('tutText').innerHTML = s.text + ' <span class="ok">יופי!</span>'; play('capture', .4); }
    $('tutNext').disabled = !!(tutWait && !tutWait.done);
  },
};
$('tutNext').onclick = () => tut.next();
$('tutSkip').onclick = () => tut.end();
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && paused) return pause(false);
  if (e.key === 'Escape' && (state === 'play' || state === 'count')) return pause(true);
  if (!tut.on || paused) return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tut.next(); }
  if (e.key === 'Escape') tut.end();
});

// ───────────────────────── loop ─────────────────────────
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (!paused) step(dt);
  if (sayT > 0 && sayT < 90) { sayT -= dt; if (sayT <= 0) sayEl.style.opacity = 0.35; }
  draw(now / 1000); tut.frame();
  if (state === 'play' || state === 'tut') hudLite();
  requestAnimationFrame(frame);
}
let hudN = 0;
function hudLite() { if (++hudN % 10 === 0) hud(); }
layout(); hud(); showBest(); requestAnimationFrame(frame);

// for the tests
window.GARDEN = {
  get state() { return state; }, get score() { return score; }, get lives() { return lives; }, get night() { return night; },
  get pct() { return pctNow(); }, get goal() { return goal(); }, get player() { return player && { ...player, own: onOwn() }; }, get dir() { return dir; },
  get girls() { return girls; }, get police() { return police; }, get talk() { return talk && { kind: talk.g.kind, step: talk.step }; }, get trail() { return trail.length; },
  get tut() { return tut.on; }, get tutStep() { return tut.i; }, get tutTry() { return (STEPS[tut.i] || {}).try; }, get tutDone() { return !!(tutWait && tutWait.done); },
  get zone() { return zoneC; }, get start() { return START(); }, get B() { return B; }, COLS, get ROWS() { return ROWS; }, want, DIRS, startGame,
  tick(dt, n = 1) { for (let i = 0; i < n; i++) step(dt); },
  owned(c, r) { return owner[idx(c, r)]; }, zoneAt(c, r) { return zone[idx(c, r)]; },
  holdForTest() { player.idle = true; player.prog = 1; },
  clearForTest() { police = []; girls = []; talk = null; },
  girlForTest(c, r, kind = 'phone', spd = 0.0001) { const g = addGirl({ c, r }, kind, spd); if (g) g.goal = { c, r }; return !!g; },
  policeForTest(c, r) { police.push({ x: c, y: r, c, r, tc: c, tr: r, d: { x: 1, y: 0 }, chase: 0, ang: 0 }); },
};
