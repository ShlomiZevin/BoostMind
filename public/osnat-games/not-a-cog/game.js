// אתה לא בורג – Diner Dash on Techy-Tech's interview floor. Osnat, Head of People, recruits Gen Z: each candidate
// sits right in front of her and TEXTS his demands (a dog, a ring light, oat matcha, a 4-day week...). She runs to the
// perk stations, brings them, and hands over the contract before the candidate's battery (patience) runs out and he
// ghosts her. Her fake laugh freezes everyone for a few seconds. Three ghosts in a day and the day is over.

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const KEY = { best: 'shlomiverse:not-a-cog:best', day: 'shlomiverse:not-a-cog:day', tut: 'shlomiverse:not-a-cog:tut', snd: 'shlomiverse:not-a-cog:snd' };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} },
};
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
// the same candidates and demands for everyone today
function seeded(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
let R = seeded('not-a-cog|' + today());
const rpick = (a) => a[Math.floor(R() * a.length)];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// ───────────────────────── the perks ─────────────────────────
// day = the day the station opens
const PERKS = [
  { id: 'matcha', label: 'מאצ׳ה', word: 'מאצ׳ה', day: 1, ask: 'מאצ׳ה. שיבולת שועל. לא נתון למשא ומתן.' },
  { id: 'dog', label: 'כלב', word: 'הכלב שלי', day: 1, ask: 'אפשר להביא את הכלב?' },
  { id: 'ring', label: 'רינג', word: 'רינג לייט', day: 1, ask: 'צריך תאורה ל-day in my life.' },
  { id: 'calendar', label: '4 ימים', word: '4 ימים', day: 2, ask: 'שבוע של ארבעה ימים. וברביעי מהבית.' },
  { id: 'title', label: 'תואר', word: 'Founder', day: 3, ask: 'התואר שלי: Founder.' },
  { id: 'headphones', label: 'אוזניות', word: 'בלי פגישות', day: 4, ask: 'בלי פגישות. אף פעם.' },
  { id: 'charger', label: 'מטען', word: 'יש לי 3%', day: 5, ask: 'יש לי 3%.' },
];
const perk = (id) => PERKS.find((p) => p.id === id);
const PEOPLE = [{ id: 'c1', f: true }, { id: 'c2', f: false }, { id: 'c3', f: true }, { id: 'c4', f: false }, { id: 'c5', f: true }, { id: 'c6', f: false }];

// ───────────────────────── art ─────────────────────────
const IMG = {};
const img = (k, src) => { const i = new Image(); i.src = src; IMG[k] = i; return i; };
['bg.jpg', 'desk.webp', 'chair.webp', 'rug.webp'].forEach((f) => img(f.split('.')[0], 'assets/' + f));
['idle', 'run', 'laugh', 'snack', 'sad'].forEach((p) => img('o-' + p, `assets/osnat-${p}.webp`));
PEOPLE.forEach((p) => { img(p.id + '-sit', `assets/${p.id}-sit.webp`); img(p.id + '-stand', `assets/${p.id}-stand.webp`); });
PERKS.forEach((p) => img('i-' + p.id, `assets/i-${p.id}.webp`));
img('i-contract', 'assets/i-contract.webp'); img('i-snack', 'assets/i-snack.webp');
const ok = (im) => im && im.complete && im.naturalWidth;

// ───────────────────────── lines ─────────────────────────
// the candidate never speaks out loud - only thoughts (the verse's Gen Z). Osnat speaks recruiting.
const LINES = {
  think: ['רגע... היא מדברת אליי פיזית?', 'אמאלה, היא מחכה לתגובה?', 'ליטרלי ראיון בתלת־ממד.', 'אני הדמות השנייה?', 'וואט? אנשים אמיתיים?', 'אשכרה בלי פילטר?', 'אני בשוק טוטאלי.'],
  hired: ['חתמתי. יאללה הביתה, כבר 15:00 👋', 'יום עבודה ראשון: בוצע. ביי.', 'אוקיי, סיימתי להיום.', 'זה היה אינטנסיבי. הביתה.', 'אני אעלה סטורי. מהבית.'],
  bored: ['😒 משתעמם...', '😮‍💨 נו...', '🚪 עוד רגע הולך'],
  seatM: ['עברתי על הלינקדאין שלך ומאוד ככה התרשמתי!', 'אני אסנת מטקי-טק. שב, שב, ככה.', 'נראה שאתה עושה דברים ממש חשובים.'],
  seatF: ['עברתי על הלינקדאין שלך ומאוד ככה התרשמתי!', 'אני אסנת מטקי-טק. שבי, שבי, ככה.', 'נראה שאת עושה דברים ממש חשובים.'],
  giveM: ['אתה לא בורג במערכת. אתה ככה... עמוד השדרה שלה.', 'זה לא "בסדר", זה אתגר אמיתי.', 'פה יש לך End to End Ownership.', 'אין פה היררכיה. רק Bias for Action.'],
  giveF: ['את לא בורג במערכת. את ככה... עמוד השדרה שלה.', 'זה לא "בסדר", זה אתגר אמיתי.', 'פה יש לך End to End Ownership.', 'אין פה היררכיה. רק Bias for Action.'],
  hire: ['ברוך הבא ל-A Team! חחח', 'מהמם! קיבלת את המייל שלי?', 'אנחנו כמו משפחה. ככה.', 'סטארטאפ בתוך סטארטאפ!'],
  ghost: ['קיבלת את המייל שלי? ...הלו?', 'הוא ככה... לא חזר אליי.', 'אני אשלח עוד מייל. ככה, עדין.', 'זה בסדר. זה... Context Switching.'],
  charger: 'אני לא בדיוק הדמות המוסמכת לפרט, אבל יש לנו מטען!',
  wrong: 'זה לא מה שביקשתי 😐',
  snack: 'אני משתדלת לא לגעת...',
  laugh: ['חחחחח מהמם!', 'חחח איזה כיף לנו!', 'הההה, ככה, מצחיק!'],
  day: ['הייוש, שלום לצוות הכי מהמם ביקום!', 'בוקר! היום מגייסים ככה, ברצינות.', 'עוד יום של Wellbeing וגיוס!'],
};
const lastLine = {};
function line(list, key) { let l = pick(list); if (list.length > 1 && l === lastLine[key]) l = list[(list.indexOf(l) + 1) % list.length]; lastLine[key] = l; return l; }

// ───────────────────────── effects ─────────────────────────
const fxEl = $('fx');
function popText(x, y, text, cls) { const p = document.createElement('div'); p.className = 'pop' + (cls ? ' ' + cls : ''); p.style.left = x + 'px'; p.style.top = y + 'px'; p.textContent = text; fxEl.appendChild(p); setTimeout(() => p.remove(), 900); }
function banner(html) { const b = document.createElement('div'); b.className = 'banner'; b.innerHTML = html; fxEl.appendChild(b); setTimeout(() => b.remove(), 1800); }
const sayEl = $('say'); let sayT = 0, hintTxt = '';
function say(text, dur = 2.4, loud = false) { $('sayTxt').innerHTML = text; sayEl.classList.remove('hint'); sayEl.classList.toggle('loud', loud); sayT = dur; }

// ───────────────────────── sound ─────────────────────────
const sndLog = [];
const SND = { ctx: null, raw: {}, buf: {}, on: store.get(KEY.snd) !== '0', last: {}, master: null };
const SFX = ['ping-1', 'ping-2', 'ping-3', 'pick-1', 'pick-2', 'give-1', 'give-2', 'give-3', 'hire-1', 'hire-2', 'laugh-1', 'laugh-2', 'laugh-3', 'ghost-1', 'ghost-2', 'crunch-1', 'crunch-2', 'bark', 'seat', 'day', 'lose', 'tick'];
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
  decodeMusic();
}
let music = null, musicBuf = null, musicRaw = null;
fetch('assets/music.mp3').then((r) => r.ok ? r.arrayBuffer() : null).then((b) => { musicRaw = b; decodeMusic(); }).catch(() => {});
function decodeMusic() { if (!SND.ctx || !musicRaw || musicBuf) return; const b = musicRaw; musicRaw = null; SND.ctx.decodeAudioData(b).then((x) => { musicBuf = x; if (state === 'play') musicOn(); }).catch(() => {}); }
function musicOn() { if (!SND.ctx || !musicBuf || music) return; const src = SND.ctx.createBufferSource(), g = SND.ctx.createGain(); src.buffer = musicBuf; src.loop = true; g.gain.value = 0.18; src.connect(g).connect(SND.master); src.start(); music = src; }
function musicOff() { if (music) { try { music.stop(); } catch (e) {} music = null; } }
function play(name, vol = 1) {
  if (!SND.ctx) return;
  const vars = SFX.filter((n) => n === name || n.startsWith(name + '-')).filter((n) => SND.buf[n]);
  if (!vars.length) return;
  let n = pick(vars);
  if (vars.length > 1 && n === SND.last[name]) n = vars[(vars.indexOf(n) + 1) % vars.length];
  SND.last[name] = n;
  sndLog.push(n); if (sndLog.length > 400) sndLog.shift();
  const src = SND.ctx.createBufferSource(), gn = SND.ctx.createGain();
  src.buffer = SND.buf[n]; src.playbackRate.value = 0.95 + Math.random() * 0.1; gn.gain.value = vol;
  src.connect(gn).connect(SND.master); src.start();
}
const SPK = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const MUTE = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
function sndIcons() { document.querySelectorAll('.sndBtn').forEach((b) => { b.innerHTML = SND.on ? SPK : MUTE; }); }
document.querySelectorAll('.sndBtn').forEach((b) => b.onclick = () => { audioUnlock(); SND.on = !SND.on; store.set(KEY.snd, SND.on ? '1' : '0'); if (SND.master) SND.master.gain.value = SND.on ? 1 : 0; sndIcons(); });
sndIcons();

// ───────────────────────── layout ─────────────────────────
const cv = $('cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
let P = { x0: 0, y0: 0, x1: 0, y1: 0 }, U = 1;   // the play area between the strip and the stations; U = size unit
const cssPx = (v) => { const d = document.createElement('div'); d.style.cssText = `position:fixed;top:${v};visibility:hidden`; document.body.appendChild(d); const t = d.getBoundingClientRect().top; d.remove(); return t; };
const desks = [0, 1, 2, 3].map((i) => ({ i, x: 0, y: 0, w: 0, h: 0, c: null }));
let lobby = [];   // where waiting candidates stand
const KIT = { top: 0, ch: 80 }, RUG = { x: 0, y: 0, w: 0 };   // + Techy-Tech's logo rug on the floor between the desk rows   // the kitchenette counter: its top edge and height
function layout() {
  DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  document.body.classList.toggle('turn', W > H * 1.15 && H < 520 && 'ontouchstart' in window);
  const top = cssPx('var(--safe-t)') + 106, barH = ($('bar').offsetHeight || 84);
  KIT.top = H - barH; KIT.ch = Math.min(W, 660) / 4.62;
  P = { x0: 0, y0: top, x1: W, y1: KIT.top - KIT.ch * 0.36 };   // the perks stand above the counter top
  const pw = Math.min(W, 620), ph = P.y1 - P.y0, ox = (W - pw) / 2;
  // the height a desk row needs: the candidate, his message and battery above the desk (226U), the desk below (58U);
  // the lower row ends above the fake-laugh button
  const laughH = ($('laughBtn').offsetHeight || 74) + 14;
  U = Math.min(pw * 0.44 / 170, (ph - laughH - 8) / 512, (ph - 8) / 668, 240 / 170);
  const band = Math.max(laughH, 156 * U), dw = 170 * U, rest = Math.max(0, ph - band - 8 - 512 * U);
  const cols = [ox + pw * 0.26, ox + pw * 0.72], r0 = P.y0 + 8 + 228 * U + rest * 0.25, rows = [r0, r0 + 226 * U + rest * 0.5];
  desks.forEach((d, i) => { d.w = dw; d.h = dw * 300 / 433; d.x = cols[i % 2]; d.y = rows[i >> 1]; });
  // the rug fits the gap between the front of the upper desks and the chairs of the lower row
  const gTop = rows[0] + desks[0].h * 0.5, gBot = rows[1] + desks[0].h * 0.05 - 118 * U;
  RUG.w = Math.min(pw * 0.5, Math.max(40, gBot - gTop + 14) * 700 / 279); RUG.x = ox + pw * 0.49; RUG.y = (gTop + gBot) / 2;
  const lx = ox + pw - 46 * U, ly = P.y1 - 6 * U;
  lobby = [0, 1, 2].map((k) => ({ x: lx - k * 66 * U, y: ly - (k % 2) * 10 * U }));
  $('laughBtn').style.bottom = (H - P.y1 + 8) + 'px';
  if (!osnat.task) { osnat.x = clamp(osnat.x || W / 2, 20, W - 20); osnat.y = clamp(osnat.y || P.y1 - 10, P.y0, P.y1); }
}
addEventListener('resize', layout); addEventListener('verseframe', layout);

// ───────────────────────── the stations bar ─────────────────────────
let open = [];   // stations open today
function buildBar(fresh) {
  const bar = $('bar'); bar.innerHTML = '';
  for (const p of PERKS) {
    if (!open.includes(p.id)) continue;
    const b = document.createElement('button');
    b.className = 'st' + (fresh && p.day === day && day > 1 ? ' new' : ''); b.dataset.id = p.id;
    b.innerHTML = `<img src="assets/i-${p.id}.webp" alt=""><span>${p.label}</span>`;
    b.onpointerdown = (e) => { e.preventDefault(); audioUnlock(); tapStation(p.id, b); };
    bar.appendChild(b);
  }
  requestAnimationFrame(layout);
}
function stationPos(id) {
  const b = document.querySelector(`.st[data-id="${id}"]`);
  if (!b) return { x: W / 2, y: KIT.top + KIT.ch * 0.3 };
  const r = b.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: KIT.top + KIT.ch * 0.3 };
}

// ───────────────────────── state ─────────────────────────
let state = 'menu', paused = false, tutorial = false;
let score = 0, day = 1, hires = 0, goal = 5, ghosts = 0, combo = 0, comboT = 0, bestCombo = 0, totalHires = 0;
let spawnT = 0, laughT = 0, laughCool = 0, dayT = 0, between = 0;
const LAUGH_FREEZE = 5, LAUGH_COOL = 22, SIT = 172;
const osnat = { x: 0, y: 0, task: null, queue: [], hands: [], pose: 'idle', poseT: 0, face: 1, snackT: 0 };
let cands = [];   // { p (person), f, sx, sy, x, y, desk, st: walk|lobby|seat|think|want|ready|leave|ghost, want:[], got:[], bat, t, thought }

const dayGoal = (d) => 4 + d;
const patience = (d) => d <= 5 ? 29 - d * 2.3 : Math.max(12, 17.5 - (d - 5) * 0.7);
const spawnGap = (d) => d <= 5 ? 7 - d * 0.6 : Math.max(2.4, 4 - (d - 5) * 0.2);
function demandCount(d) { const r = R(); if (d <= 2) return r < 0.55 ? 1 : 2; if (d === 3) return r < 0.25 ? 1 : 2; if (d <= 6) return r < 0.5 ? 2 : 3; return r < 0.3 ? 2 : 3; }

function startDay(n) {
  day = n; hires = 0; ghosts = 0; goal = dayGoal(n); combo = 0; comboT = 0;
  open = PERKS.filter((p) => p.day <= n).map((p) => p.id);
  cands = []; desks.forEach((d) => d.c = null);
  osnat.queue = []; osnat.task = null; osnat.hands = []; osnat.pose = 'idle';
  osnat.x = W / 2; osnat.y = P.y1 - 10 * U;
  spawnT = 0.6; laughT = 0; laughCool = 0; between = 0;
  buildBar(true); hud();
  banner(`יום ${n}<small>לגייס ${goal}</small>`); play('day', .6);
  setTimeout(() => state === 'play' && say(line(LINES.day, 'day')), 900);
}
function startGame() {
  state = 'play'; tutorial = false; paused = false;
  R = seeded('not-a-cog|' + today());
  score = 0; totalHires = 0; bestCombo = 0;
  show(null); showHUD(true); layout(); startDay(1); musicOn();
  window.track && window.track('game_start', 'not-a-cog');
}

// a new candidate walks in through the door with today's demands
let lastPerson = null;
function spawn(force) {
  const waiting = cands.filter((c) => c.st === 'walk' || c.st === 'lobby').length;
  if (waiting >= lobby.length) return false;
  const pool = PEOPLE.filter((p) => p !== lastPerson);
  const p = force && force.p ? force.p : rpick(pool); lastPerson = p;
  let want;
  if (force && force.want) want = force.want;
  else {
    const n = Math.min(demandCount(day), open.length), avail = open.slice();
    want = [];
    // the newest station shows up early on its own day
    const fresh = PERKS.find((q) => q.day === day && day > 1);
    if (fresh && R() < 0.5) { want.push(fresh.id); avail.splice(avail.indexOf(fresh.id), 1); }
    while (want.length < n) { const k = Math.floor(R() * avail.length); want.push(avail.splice(k, 1)[0]); }
  }
  const slot = lobby[waiting];
  cands.push({ p, f: p.f, x: W + 40, y: slot.y, sx: slot.x, sy: slot.y, desk: null, st: 'walk', want, got: [], bat: 1, t: 0, thought: '' });
  return true;
}

// ───────────────────────── input ─────────────────────────
function tapStation(id, btn) {
  if (state !== 'play' && state !== 'tut') return;
  if (paused) return;
  btn.classList.remove('tap'); void btn.offsetWidth; btn.classList.add('tap');
  queueTask({ type: 'pick', id });
}
function queueTask(t) {
  if (osnat.queue.length >= 4) { const s = t.type === 'pick' ? stationPos(t.id) : { x: t.desk.x, y: t.desk.y }; popText(s.x, s.y - 40, 'רגע, ככה, אחד-אחד', 'bad small'); return; }
  osnat.queue.push(t);
}
cv.addEventListener('pointerdown', (e) => {
  if ((state !== 'play' && state !== 'tut') || paused) return;
  audioUnlock();
  const x = e.clientX, y = e.clientY;
  // a waiting candidate: seat them at a free desk
  const waiting = cands.filter((c) => c.st === 'lobby' || c.st === 'walk');
  for (const c of waiting) {
    const h = 150 * U, w = 70 * U;
    if (Math.abs(x - c.x) < w / 2 + 14 && y > c.y - h - 10 && y < c.y + 14) { seat(c); return; }
  }
  for (const d of desks) {
    const top = d.y - SIT * U;
    if (Math.abs(x - d.x) < d.w / 2 + 6 && y > top && y < d.y + d.h / 2 + 8) {
      if (d.c && ['think', 'want', 'ready'].includes(d.c.st)) { queueTask({ type: 'desk', desk: d }); return; }
      if (!d.c && waiting.length) { seat(waiting[0], d); return; }
    }
  }
});
function seat(c, desk) {
  const d = desk || desks.find((q) => !q.c);
  if (!d) { popText(c.x, c.y - 150 * U, 'אין שולחן פנוי', 'bad small'); return; }
  d.c = c; c.desk = d; c.st = 'seat'; c.t = 0; c.fromX = c.x; c.fromY = c.y;
  play('seat', .6);
  restack();
}
function restack() {
  cands.filter((c) => c.st === 'walk' || c.st === 'lobby').forEach((c, i) => { c.sx = lobby[i].x; c.sy = lobby[i].y; if (c.st === 'lobby') c.st = 'walk'; });
}

// ───────────────────────── Osnat works her queue ─────────────────────────
function taskTarget(t) {
  if (t.type === 'pick') return stationPos(t.id);
  return { x: t.desk.x + t.desk.w * 0.36, y: t.desk.y + t.desk.h * 0.5 + 6 * U };
}
function osnatStep(dt) {
  if (osnat.poseT > 0) { osnat.poseT -= dt; if (osnat.poseT <= 0) osnat.pose = 'idle'; return; }
  if (!osnat.task && osnat.queue.length) osnat.task = osnat.queue.shift();
  const t = osnat.task;
  if (!t) { osnat.pose = 'idle'; snackCheck(dt); return; }
  const g = taskTarget(t), dx = g.x - osnat.x, dy = g.y - osnat.y, dist = Math.hypot(dx, dy), sp = 385 * U * (1 + (day - 1) * 0.03);
  if (dist > 4) {
    const k = Math.min(1, sp * dt / dist); osnat.x += dx * k; osnat.y += dy * k; osnat.pose = 'run';
    if (Math.abs(dx) > 3) osnat.face = dx > 0 ? 1 : -1;
    return;
  }
  osnat.task = null; doTask(t);
}
function doTask(t) {
  if (t.type === 'pick') {
    // hands full: the oldest goes back on its station, so a wrong pick never leaves her stuck
    if (osnat.hands.length >= 2) { const back = osnat.hands.shift(); popText(osnat.x, osnat.y - 170 * U, 'החזירה: ' + perk(back).label, 'small'); }
    osnat.hands.push(t.id); play('pick', .7);
    if (t.id === 'dog') play('bark', .5);
    return;
  }
  const c = t.desk.c;
  if (!c) return;
  if (c.st === 'ready') return hire(c);
  if (c.st !== 'want' && c.st !== 'think') return;
  const need = c.want.filter((w) => !c.got.includes(w));
  const give = osnat.hands.filter((h) => need.includes(h));
  if (!give.length) { popText(t.desk.x, t.desk.y - t.desk.h / 2 - 120 * U, LINES.wrong, 'bad small'); return; }
  for (const g of give) {
    c.got.push(g); osnat.hands.splice(osnat.hands.indexOf(g), 1);
    c.bat = g === 'charger' ? 1 : Math.min(1, c.bat + 0.22);
    if (g === 'charger') say(LINES.charger);
  }
  play('give', .8);
  popText(t.desk.x, t.desk.y - t.desk.h / 2 - 120 * U, '+' + give.length * 20, 'good small'); score += give.length * 20;
  if (c.got.length >= c.want.length) { c.st = 'ready'; c.t = 0; play('ping', .5); }
  else if (Math.random() < 0.6) say(line(c.f ? LINES.giveF : LINES.giveM, 'give'));
  hud();
}
function hire(c) {
  const d = c.desk;
  comboT > 0 ? (combo = Math.min(5, combo + 1)) : (combo = 1); comboT = 6; bestCombo = Math.max(bestCombo, combo);
  const pts = Math.round((100 + c.bat * 100) * combo);
  score += pts; hires++; totalHires++;
  popText(d.x, d.y - d.h / 2 - 130 * U, `${c.f ? 'נקלטה' : 'נקלט'}! +${pts}` + (combo > 1 ? ` ×${combo}` : ''), 'good');
  play('hire', .7); play('laugh', .7);
  osnat.pose = 'laugh'; osnat.poseT = 0.7;
  say(line(LINES.hire, 'hire')); thought(c, line(LINES.hired, 'hired'), 1.6);
  c.st = 'leave'; c.t = 0; d.c = null;
  hud();
  if (tutorial) { tutFlag('hire'); return; }
  if (hires >= goal) dayDone();
}
function dayDone() {
  between = 2.6; const bonus = 150 * day; score += bonus;
  banner(`יום ${day} הושלם!<small>+${bonus} בונוס</small>`); play('hire', .8);
  cands.forEach((c) => { if (c.st !== 'leave') { c.st = 'leave'; c.t = 0; if (c.desk) c.desk.c = null; } });
  osnat.queue = []; osnat.task = null; osnat.hands = [];
  hud();
}
// stress eating: two candidates nearly gone and nothing to do - she takes a bite
function snackCheck(dt) {
  osnat.snackT -= dt;
  if (osnat.snackT > 0 || tutorial) return;
  if (cands.filter((c) => ['want', 'think', 'ready'].includes(c.st) && c.bat < 0.3).length >= 2) {
    osnat.pose = 'snack'; osnat.poseT = 1.1; osnat.snackT = 14; play('crunch', .7); say(LINES.snack, 1.8);
  }
}
function thought(c, text, t = 2) { c.thought = text; c.thoughtT = t; }

// ───────────────────────── every frame ─────────────────────────
function step(dt) {
  if (state === 'play') {
    if (between > 0) { between -= dt; candsStep(dt, true); if (between <= 0 && state === 'play') startDay(day + 1); return; }
    spawnT -= dt;
    if (spawnT <= 0) { if (spawn()) play('ping', .35); spawnT = spawnGap(day) * (0.8 + R() * 0.4); }
    if (comboT > 0) comboT -= dt;
    if (laughT > 0) laughT -= dt;
    if (laughCool > 0) laughCool -= dt;
  }
  osnatStep(dt);
  candsStep(dt, false);
}
function candsStep(dt, frozen) {
  const P_SEC = patience(day), still = frozen || laughT > 0 || tutorial;
  for (const c of cands) {
    c.t += dt;
    if (c.thoughtT > 0) { c.thoughtT -= dt; if (c.thoughtT <= 0) c.thought = ''; }
    if (c.st === 'walk') {
      const dx = c.sx - c.x, dy = c.sy - c.y, dist = Math.hypot(dx, dy), k = Math.min(1, 220 * U * dt / Math.max(1, dist));
      c.x += dx * k; c.y += dy * k; if (dist < 2) c.st = 'lobby';
    }
    if (c.st === 'walk' || c.st === 'lobby') { if (!still) c.bat -= dt / (P_SEC * 1.3); }
    if (c.st === 'seat') {
      const d = c.desk, k = Math.min(1, c.t / 0.45);
      c.x = c.fromX + (d.x - c.fromX) * k; c.y = c.fromY + (d.y - c.fromY) * k;
      if (k >= 1) { c.st = 'think'; c.t = 0; thought(c, line(LINES.think, 'think'), 1.8); say(line(c.f ? LINES.seatF : LINES.seatM, 'seat')); if (tutorial) tutFlag('seat'); }
    }
    if (c.st === 'think' && c.t > 1.8) { c.st = 'want'; c.t = 0; play('ping', .6); if (c.want.includes('charger')) play('tick', .5); }
    if (c.st === 'want' || c.st === 'ready') {
      const drain = c.want.includes('charger') && !c.got.includes('charger') ? 2 : 1;
      if (!still) c.bat -= dt * drain / P_SEC * (c.st === 'ready' ? 0.6 : 1);
    }
    if (!c.bored && c.bat < 0.25 && ['lobby', 'want', 'ready'].includes(c.st)) { c.bored = true; const hy = c.desk ? c.desk.y - SIT * U * 0.35 : c.y - 90 * U; popText(c.x, hy, line(LINES.bored, 'bored'), 'bad small'); }
    if (c.bat >= 0.25) c.bored = false;
    if (['walk', 'lobby', 'think', 'want', 'ready'].includes(c.st) && c.bat <= 0) ghost(c);
    if (c.st === 'leave') { c.x += 260 * U * dt; c.y = Math.min(P.y1 - 4, c.y + 120 * U * dt); }
  }
  cands = cands.filter((c) => !(c.st === 'leave' && c.x > W + 80) && !(c.st === 'ghost' && c.t > 1.1));
  if (cands.some((c) => c.st === 'lobby' || c.st === 'walk')) { const w = cands.filter((c) => c.st === 'walk' || c.st === 'lobby'); w.forEach((c, i) => { c.sx = lobby[i].x; c.sy = lobby[i].y; }); }
}
function ghost(c) {
  const wasLobby = c.st === 'walk' || c.st === 'lobby';
  c.st = 'ghost'; c.t = 0; if (c.desk) c.desk.c = null;
  ghosts++; combo = 0; play('ghost', .8);
  popText(c.x, c.y - 140 * U, '👻 גוסטינג', 'bad');
  say(line(LINES.ghost, 'ghost'), 2.4, true);
  $('ghosts').classList.remove('hit'); void $('ghosts').offsetWidth; $('ghosts').classList.add('hit');
  if (wasLobby) restack();
  hud();
  if (ghosts >= 3) setTimeout(gameOver, 900), state = 'ending';
}
$('laughBtn').onpointerdown = (e) => {
  e.preventDefault(); audioUnlock();
  if ((state !== 'play' && state !== 'tut') || paused || laughCool > 0) return;
  laughT = LAUGH_FREEZE; laughCool = LAUGH_COOL; play('laugh', .9);
  osnat.pose = 'laugh'; osnat.poseT = 0.9; say(line(LINES.laugh, 'laugh'), 1.8);
  if (tutorial) { laughCool = 0; tutFlag('laugh'); }
};

// ───────────────────────── drawing ─────────────────────────
function drawImg(im, x, y, h, flip = false, alpha = 1) {   // bottom-centre anchor
  if (!ok(im)) return;
  const w = h * im.naturalWidth / im.naturalHeight;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawBg() {
  const im = IMG.bg;
  ctx.fillStyle = '#e9eef3'; ctx.fillRect(0, 0, W, H);
  if (!ok(im)) return;
  const s = Math.max(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * s, h = im.naturalHeight * s;
  ctx.drawImage(im, W - w, (H - h) * 0.4, w, h);   // anchored right: the door stays in view
}
function drawBattery(x, y, b, s) {   // a clock that runs down: the time until he gets up and leaves
  const r = 12 * s, v = clamp(b, 0, 1), col = v > 0.5 ? '#22c55e' : v > 0.25 ? '#facc15' : '#ef4444';
  const low = v < 0.25 && Math.floor(performance.now() / 250) % 2;
  ctx.save();
  ctx.fillStyle = '#1b2a4a'; ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, 7); ctx.fill();
  ctx.fillRect(x - 3 * s, y - r - 6 * s, 6 * s, 4 * s);   // the stopwatch button
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r - 1.5, -Math.PI / 2, -Math.PI / 2 + v * Math.PI * 2); ctx.closePath(); ctx.fill();
  if (low) { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, r + 6, 0, 7); ctx.stroke(); }
  ctx.restore();
}
const DONE = 'סיימתי את הראיון!';
function drawWant(c, x, headY, col) {
  const s = U, ic = 46 * s, gap = 6 * s, pad = 8 * s, fs = Math.round(10.5 * s + 1);
  const ready = c.st === 'ready', think = c.st === 'think';
  ctx.save();
  ctx.font = `900 ${fs}px Rubik, sans-serif`; ctx.direction = 'rtl';
  const slots = ready || think ? [] : c.want.map((id) => Math.max(ic, ctx.measureText(perk(id).word).width + 4 * s));
  let bw, bh = ic + pad * 2 + 13 * s;
  if (ready) { ctx.font = `900 ${fs + 1}px Rubik, sans-serif`; bw = Math.max(ic, ctx.measureText(DONE).width) + pad * 2; bh = ic + pad * 2 + 13 * s; }
  else if (think) { ctx.font = `700 ${Math.round(11.5 * s + 1)}px Rubik, sans-serif`; bw = Math.min(col.w - 30 * s, ctx.measureText(c.thought || '...').width + pad * 2.4); bh = 30 * s; }
  else bw = slots.reduce((a, b) => a + b, 0) + gap * (slots.length - 1) + pad * 2;
  // inside its own column, the battery beside it
  const bx = clamp(x - bw / 2, col.x0 + 4, col.x1 - bw - 26 * s), by = headY - bh - 12 * s;
  ctx.fillStyle = ready ? '#fff7d1' : think ? '#f4f0ff' : '#fff'; ctx.strokeStyle = ready ? '#f59e0b' : think ? '#b9a7e6' : '#1b2a4a33'; ctx.lineWidth = 2;
  ctx.shadowColor = '#0003'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
  rr(bx, by, bw, bh, 12 * s); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.stroke();
  const tx = clamp(x, bx + 14 * s, bx + bw - 14 * s);
  ctx.beginPath(); ctx.moveTo(tx - 7 * s, by + bh); ctx.lineTo(tx, by + bh + 8 * s); ctx.lineTo(tx + 7 * s, by + bh); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (think) {
    // he does not answer - he thinks (the verse's Gen Z)
    ctx.fillStyle = '#4c3d7a'; ctx.fillText(c.thought || '...', bx + bw / 2, by + bh / 2 + 1, bw - pad * 2);
  } else if (ready) {
    const k = 1 + Math.sin(performance.now() / 160) * 0.06;
    ctx.font = `${Math.round(ic * 0.82 * k)}px serif`; ctx.fillText('🙋', bx + bw / 2, by + pad + ic / 2);
    ctx.textBaseline = 'top'; ctx.fillStyle = '#b45309'; ctx.font = `900 ${fs + 1}px Rubik, sans-serif`; ctx.fillText(DONE, bx + bw / 2, by + pad + ic + 1 * s);
  } else {
    ctx.textBaseline = 'top';
    let sx = bx + bw - pad;   // right to left, the way he reads
    c.want.forEach((id, i) => {
      const sw = slots[i], ix = sx - sw / 2, got = c.got.includes(id), im = IMG['i-' + id];
      if (ok(im)) { const r = Math.min(ic / im.naturalWidth, ic / im.naturalHeight), w = im.naturalWidth * r, h = im.naturalHeight * r; ctx.globalAlpha = got ? 0.3 : 1; ctx.drawImage(im, ix - w / 2, by + pad + (ic - h) / 2, w, h); ctx.globalAlpha = 1; }
      ctx.fillStyle = got ? '#16a34a' : '#1b2a4a'; ctx.fillText(got ? '✓' : perk(id).word, ix, by + pad + ic + 1 * s);
      sx -= sw + gap;
    });
  }
  ctx.restore();
  if (!think) drawBattery(bx + bw + 13 * s, by + bh / 2, c.bat, s);
  else drawBattery(bx + bw + 13 * s, by + bh / 2, c.bat, s * 0.8);
}
function drawThought(c, x, y) {
  if (!c.thought) return;
  ctx.save(); ctx.font = `700 ${Math.round(12 * U + 2)}px Rubik, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
  const w = Math.min(ctx.measureText(c.thought).width + 18, W - 16), h = 22 * U + 6;
  const bx = clamp(x - w / 2, 8, W - w - 8);
  ctx.globalAlpha = clamp(c.thoughtT * 2, 0, 0.95);
  ctx.fillStyle = '#f4f0ff'; ctx.strokeStyle = '#b9a7e6'; ctx.lineWidth = 1.5; rr(bx, y - h, w, h, h / 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#4c3d7a'; ctx.fillText(c.thought, bx + w / 2, y - h / 2 + 1);
  ctx.restore();
}
function drawOsnat() {
  const h = 158 * U, im = IMG['o-' + osnat.pose] || IMG['o-idle'];
  ctx.save(); ctx.fillStyle = '#0002'; ctx.beginPath(); ctx.ellipse(osnat.x, osnat.y, 30 * U, 8 * U, 0, 0, 7); ctx.fill(); ctx.restore();
  const bob = osnat.pose === 'run' ? Math.abs(Math.sin(performance.now() / 90)) * 3 * U : 0;
  drawImg(im, osnat.x, osnat.y - bob, h, osnat.face < 0 && osnat.pose === 'run');
  // what she carries, over her head (the contract when she goes to sign)
  const t = osnat.task, signing = t && t.type === 'desk' && t.desk.c && t.desk.c.st === 'ready';
  if (signing) drawImg(IMG['i-contract'], osnat.x + 36 * U, osnat.y - h * 0.45, 40 * U);
  osnat.hands.forEach((id, i) => {
    const ic = 32 * U, x = osnat.x + (i - (osnat.hands.length - 1) / 2) * (ic + 4), y = osnat.y - h - 4 * U;
    ctx.save(); ctx.fillStyle = '#fffffff0'; ctx.strokeStyle = '#ff8fb1'; ctx.lineWidth = 2; rr(x - ic / 2 - 3, y - ic - 3, ic + 6, ic + 6, 9); ctx.fill(); ctx.stroke(); ctx.restore();
    drawImg(IMG['i-' + id], x, y, ic * 0.92);
  });
}
function drawQueue() {
  const all = (osnat.task ? [osnat.task] : []).concat(osnat.queue);
  all.forEach((t, i) => {
    const g = taskTarget(t), y = t.type === 'pick' ? P.y1 - 8 * U : g.y - 4 * U;
    ctx.save(); ctx.fillStyle = i === 0 ? '#ff6f9f' : '#ff8fb1bb'; ctx.beginPath(); ctx.arc(g.x, y, 10 * U + 2, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(11 * U + 3)}px Rubik`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(i + 1, g.x, y + 1); ctx.restore();
  });
}
function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawBg();
  if (state === 'menu') return;
  if (ok(IMG.rug)) { const h = RUG.w * IMG.rug.naturalHeight / IMG.rug.naturalWidth; ctx.drawImage(IMG.rug, RUG.x - RUG.w / 2, RUG.y - h / 2, RUG.w, h); }
  // everything with feet, back to front
  const items = [];
  desks.forEach((d) => items.push({ y: d.y + d.h * 0.5, f: () => drawDesk(d) }));
  cands.forEach((c) => { if (!c.desk || c.st === 'leave' || c.st === 'ghost') items.push({ y: c.y, f: () => drawStanding(c) }); });
  items.push({ y: osnat.y, f: drawOsnat });
  items.sort((a, b) => a.y - b.y).forEach((it) => it.f());
  drawQueue();
  // bubbles on top of everyone
  desks.forEach((d) => { const c = d.c; if (c && ['think', 'want', 'ready'].includes(c.st)) { const head = d.y + d.h * 0.3 - SIT * U, half = d.i % 2 ? { x0: W / 2, x1: W } : { x0: 0, x1: W / 2 }; half.w = half.x1 - half.x0; drawWant(c, d.x, head, half); } });
  cands.forEach((c) => {
    if (c.st === 'walk' || c.st === 'lobby') drawBattery(c.x + 26 * U, c.y - 150 * U, c.bat, U * 0.8);
    if (!c.desk || c.st === 'leave' || c.st === 'ghost') drawThought(c, c.x, c.y - 150 * U - 10);
  });
  if (laughT > 0) { ctx.save(); ctx.fillStyle = `rgba(255,143,177,${0.12 + Math.sin(performance.now() / 150) * 0.05})`; ctx.fillRect(0, P.y0, W, P.y1 - P.y0); ctx.restore(); }
}
function drawDesk(d) {
  const c = d.c;
  if (c && (c.st === 'seat')) { /* sliding in - drawn standing until seated */ drawStanding(c); }
  else if (c && ['think', 'want', 'ready'].includes(c.st)) {
    const wob = c.bat < 0.25 ? Math.sin(performance.now() / 60) * 1.5 : 0;
    drawImg(IMG[c.p.id + '-sit'], d.x + wob, d.y + d.h * 0.3, SIT * U);
  } else drawImg(IMG.chair, d.x, d.y + d.h * 0.05, 118 * U);
  drawImg(IMG.desk, d.x, d.y + d.h / 2, d.h);
  if (c && c.st === 'ready' && !(osnat.task && osnat.task.desk === d) && !osnat.queue.some((t) => t.desk === d)) {
    // a finger tapping the desk: tap here to sign
    const k = Math.abs(Math.sin(performance.now() / 220));
    ctx.save(); ctx.font = `${Math.round(34 * U)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText('👆', d.x - d.w * 0.18, d.y + d.h * 0.05 + k * 8 * U); ctx.restore();
  }
  if (c && c.st === 'ready') { ctx.save(); ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3; ctx.globalAlpha = 0.5 + Math.sin(performance.now() / 160) * 0.3; rr(d.x - d.w / 2 - 4, d.y - d.h / 2 - 4, d.w + 8, d.h + 8, 14); ctx.stroke(); ctx.restore(); }
}
function drawStanding(c) {
  const h = 150 * U, alpha = c.st === 'ghost' ? clamp(1 - c.t, 0, 1) : 1;
  const y = c.st === 'ghost' ? c.y - c.t * 40 * U : c.y;
  ctx.save(); ctx.globalAlpha = alpha * 0.25; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 24 * U, 6 * U, 0, 0, 7); ctx.fill(); ctx.restore();
  drawImg(IMG[c.p.id + '-stand'], c.x, y, h, c.st === 'leave', alpha);
  if (c.st === 'ghost') { ctx.save(); ctx.globalAlpha = alpha; ctx.font = `${Math.round(40 * U)}px serif`; ctx.textAlign = 'center'; ctx.fillText('👻', c.x, y - h * 0.5); ctx.restore(); }
}

// ───────────────────────── HUD + screens ─────────────────────────
function hud() {
  $('scoreTxt').textContent = score;
  $('dayTxt').textContent = day;
  $('hiresTxt').textContent = `${hires}/${goal}`;
  [...$('ghosts').children].forEach((g, i) => g.classList.toggle('on', i < ghosts));
}
function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id)); }
function showHUD(on) { ['hud', 'strip', 'bar', 'laughBtn'].forEach((k) => $(k).classList.toggle('on', on)); }
function bestNum() { return +(store.get(KEY.best) || 0); }
function showBest() {
  const b = bestNum(), d = (store.get(KEY.day) || '').split('|');
  const td = d[0] === today() ? +d[1] : 0;
  $('bestStart').innerHTML = b ? `השיא שלכם: <b>${b}</b>` + (td ? ` · היום: <b>${td}</b>` : '') : 'כמה גן זי אסנת תגייס?';
  $('bestOver').innerHTML = b ? `השיא שלכם: <b>${b}</b>` : '';
}
function gameOver() {
  state = 'over'; musicOff(); play('lose', .6);
  window.track && window.track('game_over', 'not-a-cog');
  window.VerseFrame && VerseFrame.score && score > 0 && VerseFrame.score(score);
  const b = bestNum(), rec = score > b;
  if (rec) store.set(KEY.best, score);
  const d = (store.get(KEY.day) || '').split('|');
  if (d[0] !== today() || score > +d[1]) store.set(KEY.day, `${today()}|${score}`);
  fxEl.innerHTML = ''; showHUD(false);
  $('overScore').innerHTML = `${score}<small>נקודות · יום ${day} · ${totalHires} גויסו` + (bestCombo > 1 ? ` · רצף ×${bestCombo}` : '') + '</small>';
  $('overLine').textContent = day >= 4 ? '״כל מה שעושים פה זה או לאכול או לעבוד. ואני עשיתי את שניהם.״' : totalHires >= 5 ? '״זה לא "בסדר", זה אתגר אמיתי. מחר עוד מייל.״' : '״קיבלתם את המייל שלי? ...מישהו?״';
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
$('quitBtn').onclick = () => { musicOff(); paused = false; SND.ctx && SND.ctx.resume(); state = 'menu'; tut.end(true); showHUD(false); fxEl.innerHTML = ''; showBest(); show('start'); };
addEventListener('pagehide', () => { if (SND.ctx) SND.ctx.suspend(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (state === 'play') pause(true); else if (SND.ctx) SND.ctx.suspend(); } });
document.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => SND.ctx && SND.ctx.suspend()));

// ───────────────────────── tutorial ─────────────────────────
const tutCard = $('tutCard'), tutHole = $('tutHole');
let tutWait = null;
function tutFlag(id) { if (tutWait && tutWait.id === id) tutWait.done = true; }
const tc = () => cands[0];
const spotEl = (sel) => () => { const e = typeof sel === 'string' ? document.querySelector(sel) : sel; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 }; };
const spotOsnat = () => ({ x: osnat.x - 50 * U, y: osnat.y - 170 * U, w: 100 * U, h: 180 * U });
const spotLobby = () => { const c = tc(); return c ? { x: c.x - 50 * U, y: c.y - 165 * U, w: 100 * U, h: 175 * U } : null; };
const spotDesk = () => { const d = desks[0], y = Math.max(P.y0 - 2, d.y - SIT * U - 100 * U); return { x: d.x - d.w / 2 - 30 * U, y, w: d.w + 60 * U, h: d.y + d.h / 2 + 8 * U - y }; };
const STEPS = [
  { text: 'זאת <b>אסנת</b>, Head of People בטקי-טק. היום היא מגייסת <b>גן זי</b>.', spot: spotOsnat },
  { text: '<b>המטרה:</b> לגייס מספיק מועמדים ביום – המונה פה. כל גיוס = נקודות, מהר = יותר.', spot: spotEl('#hiresBox') },
  { text: 'מועמד שהסבלנות שלו נגמרת עושה לאסנת <b>גוסטינג 👻</b>. שלושה גוסטים ביום – ונגמר.', spot: spotEl('#ghosts') },
  { text: 'נסו עכשיו: מועמד חדש בכניסה. <b>הקישו עליו</b> כדי להושיב אותו בשולחן.', try: 'seat', spot: spotLobby },
  { text: 'הוא לא מדבר – הוא <b>שולח הודעה</b> עם הדרישות. תקראו מה הוא רוצה.', spot: spotDesk },
  { text: 'נסו עכשיו: למטה זה <b>המטבחון</b>. <b>הקישו על מה שביקש</b> – אסנת תרוץ להביא – ואז <b>על השולחן שלו</b>.', try: 'give' },
  { text: 'ה<b>שעון</b> ליד ההודעה = כמה זמן נשאר <b>עד שהוא קם והולך</b>. כל דבר שמביאים נותן לו עוד זמן.', spot: spotDesk },
  { text: 'נסו עכשיו: קיבל הכול – <b>סיים את הראיון</b> 🙋 ומחכה לאסנת. <b>הקישו על השולחן</b>: היא באה לסגור איתו, הוא מגויס... והולך הביתה מוקדם. גן זי.', try: 'hire', spot: spotDesk },
  { text: '<b>צחוק מזויף</b>: כולם קופאים ל-5 שניות. אחריו צריך לחכות קצת. נסו!', try: 'laugh', spot: spotEl('#laughBtn') },
  { text: 'אפשר לתכנן קדימה: עד <b>4 פעולות בתור</b> (המספרים הוורודים), ואסנת סוחבת <b>2 דברים</b>. מוכנים? אנחנו קוראים לזה A Team.', last: true },
];
const tut = {
  on: false, i: 0,
  begin() {
    show(null); showHUD(true); state = 'tut'; tutorial = true; this.on = true; this.i = 0;
    score = 0; day = 1; hires = 0; goal = 1; ghosts = 0;
    layout();
    open = ['matcha', 'dog', 'ring']; cands = []; desks.forEach((d) => d.c = null);
    osnat.queue = []; osnat.task = null; osnat.hands = []; osnat.pose = 'idle'; osnat.x = W / 2; osnat.y = P.y1 - 10 * U;
    buildBar(false); hud();
    tutCard.classList.add('on'); this.enter();
  },
  enter() {
    const s = STEPS[this.i];
    tutWait = s.try ? { id: s.try, done: false } : null;
    if (s.try === 'seat' && !cands.length) { day = 1; spawn({ p: PEOPLE[1], want: ['matcha'] }); }
    $('tutText').innerHTML = s.text;
    $('tutCount').textContent = `${this.i + 1} / ${STEPS.length}`;
    $('tutBar').firstElementChild.style.width = ((this.i + 1) / STEPS.length * 100) + '%';
    $('tutNext').innerHTML = (s.last ? 'שחקו!' : 'הבא') + ' <span class="keyhint">(רווח)</span>';
  },
  next() {
    if (tutWait && !tutWait.done) return;
    if (STEPS[this.i].try === 'seat' && tc() && tc().st !== 'want') return;   // wait until the message is in
    play('pick', .4);
    if (++this.i >= STEPS.length) return this.end();
    this.enter();
  },
  end(quiet) {
    this.on = false; tutWait = null; tutCard.classList.remove('on'); $('tutDim').classList.remove('on');
    store.set(KEY.tut, '1'); tutorial = false; laughT = 0; laughCool = 0;
    if (!quiet) startGame();
  },
  frame() {
    if (!this.on) return;
    const s = STEPS[this.i];
    // "give" is done when everything he asked for is on his desk
    if (tutWait && tutWait.id === 'give' && !tutWait.done) { const c = desks.map((d) => d.c).find(Boolean); if (c && c.st === 'ready') tutWait.done = true; }
    const sp = s.spot && s.spot();
    const dim = sp && !(tutWait && !tutWait.done && s.try !== 'seat' && s.try !== 'laugh' && s.try !== 'hire');
    $('tutDim').classList.toggle('on', !!dim);
    if (dim) Object.assign(tutHole.style, { left: sp.x + 'px', top: sp.y + 'px', width: sp.w + 'px', height: sp.h + 'px' });
    // the hole lets taps through only where it is - the dim layer has no pointer events, so the game below gets the tap
    const up = sp ? sp.y + sp.h / 2 > H * 0.5 : s.try === 'give' ? false : true, side = W >= 900;
    tutCard.style.left = side ? '20px' : ''; tutCard.style.right = side ? 'auto' : ''; tutCard.style.width = side ? '340px' : '';
    tutCard.style.top = side ? `${P.y0}px` : up ? `calc(var(--safe-t) + 56px)` : 'auto';
    tutCard.style.bottom = side || up ? 'auto' : `${$('bar').offsetHeight + 96}px`;
    if (tutWait && tutWait.done && !tutWait.shown) { tutWait.shown = true; $('tutText').innerHTML = s.text + ' <span class="ok">יופי!</span>'; }
    const waitMsg = s.try === 'seat' && tc() && tc().st !== 'want' && tutWait.done;
    $('tutNext').disabled = !!(tutWait && !tutWait.done) || waitMsg;
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

// ───────────────────────── what to do now (the strip, when Osnat is quiet) ─────────────────────────
function hint() {
  if (sayT > 0 || (state !== 'play' && state !== 'tut')) return;
  let t;
  const waiting = cands.some((c) => c.st === 'lobby' || c.st === 'walk'), free = desks.some((d) => !d.c);
  const ready = desks.some((d) => d.c && d.c.st === 'ready'), want = desks.some((d) => d.c && d.c.st === 'want');
  if (ready) t = 'מועמד סיים את הראיון! <em>הקישו</em> על השולחן – אסנת תבוא לסגור איתו';
  else if (waiting && free) t = '<em>הקישו</em> על מועמד בכניסה – להושיב';
  else if (want && osnat.hands.length) t = '<em>הקישו</em> על השולחן – למסור';
  else if (want) t = '<em>הקישו</em> על מה שביקש במטבחון למטה';
  else t = 'מחכים למועמד הבא...';
  if (t !== hintTxt || !sayEl.classList.contains('hint')) { hintTxt = t; $('sayTxt').innerHTML = t; sayEl.classList.add('hint'); sayEl.classList.remove('loud'); }
}

// ───────────────────────── loop ─────────────────────────
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (!paused && (state === 'play' || state === 'tut' || state === 'ending')) step(dt);
  if (sayT > 0) sayT -= dt;
  hint();
  const lb = $('laughBtn'); lb.classList.toggle('cool', laughCool > 0); lb.lastElementChild.style.height = (laughCool > 0 ? laughCool / LAUGH_COOL * 100 : 0) + '%';
  draw(); tut.frame();
  requestAnimationFrame(frame);
}
layout(); hud(); showBest(); requestAnimationFrame(frame);

// for the tests
window.NOTACOG = {
  get state() { return state; }, get score() { return score; }, get day() { return day; }, get hires() { return hires; }, get goal() { return goal; },
  get ghosts() { return ghosts; }, get cands() { return cands; }, get tut() { return tut.on; }, get tutStep() { return tut.i; }, get laughCool() { return laughCool; },
  desks, osnat, stationPos, startGame, spawn, seat, queueTask, get P() { return P; }, get U() { return U; },
  sndLog,
  tick(dt) { step(dt); },
  forceDay(n) { R = seeded('not-a-cog|' + today()); startDay(n); },
  endNow() { ghosts = 3; gameOver(); },
  set freeze(v) { laughT = v ? 1e9 : 0; },
};
