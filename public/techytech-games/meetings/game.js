// אז אנחנו מסונכרנים - Techy-Tech's management stuck in video calls. One game, three invented call apps:
//   zoomba = 2048 of meetings (check-in + check-in = sync ... up to "a decision"); Daniel blocks, Itay drops in
//   meetly = Where's-Waldo in a huge call grid (Daniel with his hand up, Itay leaving, who talks on mute...)
//   teamz  = Flow-Free: connect every pair of stakeholders, no crossing, every cell filled
'use strict';
const SLUG = 'meetings';
const $ = (s) => document.querySelector(s);
const store = {
  get(k) { try { return localStorage.getItem('shlomiverse:' + SLUG + ':' + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('shlomiverse:' + SLUG + ':' + k, String(v)); } catch (e) {} },
};
const DAY = (() => { const d = new Date(Date.now() + 2 * 3600e3); return d.toISOString().slice(0, 10); })();
function rng(seed) { let h = 1779033703 ^ seed.length; for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
function shuffle(r, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const img = (n) => 'assets/' + n + '.webp';
// an online versus match of this app (online.js sets window.VS while one runs): the same seed on both phones
const vsOn = (mode) => !!(window.VS && VS.active === mode && G.mode === mode);

// ---------- people ----------
const NAME = { amir: 'אמיר', ofer: 'עופר', ronit: 'רונית', gilad: 'גלעד', itay: 'איתי', yaniv: 'יניב', daniel: 'דניאל', yotam: 'יותם', osnat: 'אסנת', tzvika: 'צביקה', vova: 'וובה', erez: 'ארז', ido: 'עידו', lior: 'ליאור', rami: 'רמי', yoav: 'יואב' };
const L = {
  amir: ['אז אנחנו מסונכרנים.', 'מצוין.', 'בדיוק.', 'בואו נתרומם רגע למעוף הציפור, לרמת הוויז׳ן.', 'זה GOES WITHOUT SAYING.', 'בואו נייצר פה התקדמות שלא מייצרת מחויבות, אבל כן מייצרת מומנטום.', 'אנחנו לא רוצים לפתח פתרון. אנחנו רוצים לפתח יכולת.'],
  amirKick: ['דניאל, אתה יכול לרדת מהשיחה.', 'נתת לנו הרבה חומר למחשבה.', 'דניאל, תהיה שחקן קבוצתי.'],
  ofer: ['חד משמעית.', 'וזה גם חלק מה-Roadmap שלנו ל-Q4.', 'מסכים. בגלל זה אנחנו עושים את הדיון עכשיו.'],
  ronit: ['רגע, מי בכלל אישר את זה?', 'לא. אנחנו לא מסונכרנים.', 'מבחינתי עוד לא התקיים דיון על עצם הצורך.', 'מי בכלל הגדיר את הדרישות?', 'אני מבקשת שלא תתקדמו.'],
  gilad: ['מה הביזנס?', 'אתה שוב רץ.', 'איפה החדשנות פה?', 'בואו ניקח את זה פנימה.'],
  itay: ['חבר׳ה, חבר׳ה, אני רוצה רגע להגיד משהו.', 'אני חייב לחתוך עוד עשרים דקות.', 'אני באתי משמונה־מאתיים.', 'יש לי בק־טו־בק עד עשר בלילה.', 'אנחנו סתם מסבכים שלא לצורך.'],
  itayLeave: ['טוב, טוב, אני חייב לזוז, יש לי שיחה עם גלעד.', 'הזמן שלנו שווה כסף. אני זז.'],
  daniel: ['אז קודם כול—', 'כן, אבל—', 'אני חושב ש—', 'רגע, רק רציתי…', 'אבל מה בדיוק—'],
  yaniv: ['אני לא משתף מסך! יש לי אישור מאורתופד!', 'למה העלית אותי לשיחה? מה אני קשור?'],
};

// ---------- speaker strip ----------
let sayT = 0, lastLine = '', verbText = '', verbFace = 'amir';
function say(who, text, ms = 2600, face) {
  if (Array.isArray(text)) { let t; do t = pick(Math.random, text); while (t === lastLine && text.length > 1); text = t; }
  lastLine = text;
  $('#sFace').src = img(face || who); $('#sFace').classList.add('talk');
  const s = $('#sText'); s.className = ''; s.innerHTML = '<b></b><span></span>';
  s.querySelector('b').textContent = NAME[who] || ''; s.querySelector('span').textContent = text;
  G.talking = true; clearTimeout(sayT);
  sayT = setTimeout(() => { G.talking = false; $('#sFace').classList.remove('talk'); showVerb(); }, ms);
}
function verb(t, face) { verbText = t || ''; if (face) verbFace = face; if (!G.talking) showVerb(); }
function showVerb() { const s = $('#sText'); s.className = 'verb'; s.textContent = verbText; $('#sFace').src = img(verbFace); }
function flash(t) { const f = $('#flash'); f.textContent = t; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
$('#flash').addEventListener('animationend', () => $('#flash').classList.remove('on'));

// ---------- sound ----------
const SND = { join: 2, leave: 1, slide: 3, merge: 4, big: 2, removed: 2, itay: 1, tap: 2, wrong: 2, found: 3, line: 3, connect: 2, level: 2, over: 1 };
const audio = { ctx: null, buf: {}, last: {}, on: store.get('sound') !== '0', music: null, mGain: null };
function audioWake() {
  const c = audio.ctx; if (!c) return audioInit();
  if (c.state === 'running') return;
  try { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) {}
  const p = c.resume(); const check = () => setTimeout(() => { if (audio.ctx === c && c.state !== 'running') audioRebuild(); }, 400);
  p && p.then ? p.then(check, check) : check();
}
function audioRebuild() { const old = audio.ctx; audio.ctx = null; audio.buf = {}; audio.music = null; audio.mGain = null; try { old && old.close(); } catch (e) {} audioInit(); }
function audioInit() {
  if (audio.ctx) { if (audio.ctx.state !== 'running') audioWake(); return; }
  try { audio.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  const get = (f) => fetch('assets/sfx/' + f + '.mp3').then((r) => r.arrayBuffer()).then((b) => audio.ctx.decodeAudioData(b));
  for (const [n, k] of Object.entries(SND)) for (let i = 1; i <= k; i++) get(n + '-' + i).then((d) => { (audio.buf[n] = audio.buf[n] || []).push(d); }).catch(() => {});
  get('music-loop').then((d) => { audio.buf.music = d; musicStart(); }).catch(() => {});
}
for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) addEventListener(ev, () => audioWake(), { capture: true, passive: true });
function musicStart() {
  if (!audio.ctx || !audio.buf.music || audio.music) return;
  audio.mGain = audio.ctx.createGain(); audio.mGain.gain.value = 0; audio.mGain.connect(audio.ctx.destination);
  audio.music = audio.ctx.createBufferSource(); audio.music.buffer = audio.buf.music; audio.music.loop = true; audio.music.connect(audio.mGain); audio.music.start();
  musicLevel();
}
function musicLevel() { if (!audio.mGain) return; const t = audio.ctx.currentTime; audio.mGain.gain.cancelScheduledValues(t); audio.mGain.gain.setTargetAtTime(audio.on ? (G.mode ? .1 : .16) : 0, t, .3); }
function sfx(n, vol = .8, rate = 1) {
  if (!audio.on || !audio.ctx || !audio.buf[n]) return;
  const list = audio.buf[n]; let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === audio.last[n]) i = (i + 1) % list.length;
  audio.last[n] = i;
  const s = audio.ctx.createBufferSource(), g = audio.ctx.createGain(); g.gain.value = vol; s.buffer = list[i]; s.playbackRate.value = rate; s.connect(g).connect(audio.ctx.destination); s.start();
}
addEventListener('pagehide', () => { audio.ctx && audio.ctx.suspend(); });
addEventListener('pageshow', (e) => { if (e.persisted && audio.ctx) audio.ctx.resume().catch(() => {}); });
document.addEventListener('visibilitychange', () => { if (!audio.ctx) return; if (document.hidden) audio.ctx.suspend(); else audio.ctx.resume().catch(() => {}); });
function soundBtn() { $('#bSound').classList.toggle('off', !audio.on); $('#bSound').textContent = audio.on ? '🔊 צליל' : '🔇 צליל'; }
$('#bSound').onclick = () => { audio.on = !audio.on; store.set('sound', audio.on ? 1 : 0); soundBtn(); audioInit(); musicLevel(); };

// ---------- shared game state ----------
const G = { mode: null, score: 0, over: false, tut: null, time: 0, timeMax: 1, talking: false };
function emit(e) { if (G.tut) tutEvent(e); }
function setScore(n) { G.score = n; $('#score span').textContent = n; }
function addScore(n) { setScore(G.score + n); }
function stage() { const r = $('#stage').getBoundingClientRect(); return { W: r.width, H: r.height }; }
function fmt(t) { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
function timerShow() {
  const el = $('#timer'); el.querySelector('span').textContent = fmt(G.time);
  el.querySelector('i').style.transform = 'scaleX(' + Math.max(0, Math.min(1, G.time / G.timeMax)) + ')';
  el.classList.toggle('low', G.time <= 8 && !G.over);
}
function addTime(s) { G.time = Math.max(0, G.time + s); G.timeMax = Math.max(G.timeMax, G.time); timerShow(); }

// =====================================================================================
// ZOOMBA - 2048 of meetings
// =====================================================================================
const ZL = [null,
  { he: "צ'ק-אין", faces: ['yaniv'], c: '#6f84a8' },
  { he: 'סנכרון', faces: ['ofer'], c: '#3f8cff' },
  { he: 'יישור קו', faces: ['amir'], c: '#13a89a' },
  { he: 'פגישת המשך', faces: ['itay'], c: '#8e5cf0' },
  { he: 'תמונת מצב', faces: ['amir', 'daniel'], c: '#ee8a1c' },
  { he: 'POC', faces: ['ofer', 'amir'], c: '#e0447a' },
  { he: 'דמו ליום ראשון', faces: ['amir', 'ofer', 'daniel', 'itay'], c: '#25a548' },
  { he: 'ועדת היגוי', faces: ['ronit', 'amir', 'ofer', 'daniel'], c: '#d6452e' },
  { he: 'פגישה עם רונית', faces: ['ronit', 'amir', 'ofer', 'itay'], c: '#a62f97' },
  { he: 'פגישה עם גלעד', faces: ['gilad', 'amir', 'ofer', 'ronit', 'itay', 'daniel'], c: '#1d3f9e' },
  { he: 'החלטה!', faces: ['gilad', 'amir', 'ofer', 'ronit', 'itay', 'daniel'], c: '#e8a600' },
];
const ZMAX = ZL.length - 1;
const zb = {
  N: 4, grid: null, tiles: [], r: null, moves: 0, nextId: 1, busy: false, best: 0, cw: 0, ch: 0, gap: 6, pad: 6,
  start(tut) {
    this.r = rng(vsOn('zoomba') ? 'zoomba-vs|' + VS.m.seed : 'zoomba|' + DAY + (tut ? '|tut' : '')); this.moves = 0; this.best = 0; this.busy = false;
    $('#zb').innerHTML = ''; $('#zb').hidden = false; this.tiles = []; this.grid = [...Array(4)].map(() => Array(4).fill(null));
    this.layout();
    if (tut) { this.add(1, 1, 1); this.add(3, 1, 1); this.add(2, 3, 2); }
    else { this.spawn(); this.spawn(); }
    verb('החליקו – שתי פגישות זהות מתמזגות לפגישה גדולה יותר', 'amir');
  },
  layout() {
    const { W, H } = stage(), g = this.gap, p = this.pad;
    const cw = Math.min((W - 12 - 2 * p - 3 * g) / 4, 150);
    const ch = Math.min((H - 12 - 2 * p - 3 * g) / 4, cw * 1.75);
    this.cw = cw; this.ch = ch;
    const bw = 4 * cw + 3 * g + 2 * p, bh = 4 * ch + 3 * g + 2 * p, el = $('#zb');
    Object.assign(el.style, { width: bw + 'px', height: bh + 'px', left: (W - bw) / 2 + 'px', top: Math.max(6, (H - bh) / 2) + 'px' });
    el.querySelectorAll('.zc').forEach((c) => c.remove());
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const d = document.createElement('div'); d.className = 'zc'; Object.assign(d.style, { left: p + c * (cw + g) + 'px', top: p + r * (ch + g) + 'px', width: cw + 'px', height: ch + 'px' }); el.prepend(d); }
    for (const t of this.tiles) { this.size(t); this.place(t); }
  },
  xy(r, c) { return [this.pad + c * (this.cw + this.gap), this.pad + r * (this.ch + this.gap)]; },
  size(t) { Object.assign(t.el.style, { width: this.cw + 'px', height: this.ch + 'px', '--fs': Math.max(9, Math.min(14, this.cw / 7.2)) + 'px' }); },
  place(t) { const [x, y] = this.xy(t.r, t.c); const tr = 'translate(' + x + 'px,' + y + 'px)'; t.el.style.transform = tr; t.el.style.setProperty('--tr', tr); },
  render(t) {
    const el = t.el; el.className = 'zt ' + (t.kind !== 'm' ? t.kind : ''); el.innerHTML = '';
    let faces, name, col;
    if (t.kind === 'daniel') { faces = ['daniel-try']; name = 'דניאל'; col = '#e0344a'; }
    else if (t.kind === 'itay') { faces = ['itay']; name = 'איתי'; col = '#555'; }
    else { const d = ZL[t.lv]; faces = d.faces; name = d.he; col = d.c; }
    el.style.setProperty('--c', col);
    const f = document.createElement('div'); f.className = 'faces';
    const n = faces.length; f.style.gridTemplateColumns = n >= 4 ? '1fr 1fr' : '1fr'; f.style.gridTemplateRows = n === 6 ? 'repeat(3,1fr)' : n >= 4 ? '1fr 1fr' : 'repeat(' + n + ',1fr)';
    for (const fc of faces) { const i = document.createElement('img'); i.src = img(fc); i.alt = ''; i.draggable = false; f.appendChild(i); }
    el.appendChild(f);
    const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = name; el.appendChild(nm);
    if (t.kind === 'm') { const lv = document.createElement('div'); lv.className = 'lv'; lv.textContent = t.lv; el.appendChild(lv); }
    if (t.kind === 'itay') { const cd = document.createElement('div'); cd.className = 'cd'; cd.textContent = t.cd; el.appendChild(cd); }
    if (t.kind === 'daniel') { const tg = document.createElement('div'); tg.className = 'tag'; tg.textContent = 'אז קודם כול—'; el.appendChild(tg); }
  },
  add(r, c, lv, kind = 'm', cd = 0) {
    const t = { id: this.nextId++, r, c, lv, kind, cd, el: document.createElement('div') };
    this.render(t); this.size(t); this.place(t); t.el.classList.add('new');
    $('#zb').appendChild(t.el); this.tiles.push(t); this.grid[r][c] = t; return t;
  },
  empties() { const e = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (!this.grid[r][c]) e.push([r, c]); return e; },
  has(kind) { return this.tiles.some((t) => t.kind === kind); },
  spawn() {
    const e = this.empties(); if (!e.length) return;
    const [r, c] = e[Math.floor(this.r() * e.length)], x = this.r();
    if (!G.tut && this.moves >= 14 && !this.has('daniel') && x < .07) { this.add(r, c, 0, 'daniel'); sfx('join', .6); say('daniel', L.daniel, 2200, 'daniel-try'); return; }
    if (!G.tut && this.moves >= 28 && !this.has('itay') && x > .955) { this.add(r, c, 0, 'itay', 7); sfx('itay', .7); say('itay', L.itay, 2600); return; }
    this.add(r, c, this.r() < .9 ? 1 : 2);
  },
  remove(t, cls) {
    this.grid[t.r][t.c] = null; this.tiles = this.tiles.filter((x) => x !== t);
    if (cls) { t.el.classList.add(cls); setTimeout(() => t.el.remove(), 560); } else t.el.remove();
  },
  // one swipe: dir = 'L' 'R' 'U' 'D' (screen directions)
  move(dir) {
    if (this.busy || G.over || !G.mode) return false;
    if (G.tut && !G.tut.waiting) return false;
    const lines = [];
    for (let i = 0; i < 4; i++) {
      const cells = [];
      for (let j = 0; j < 4; j++) {
        if (dir === 'L') cells.push([i, j]); if (dir === 'R') cells.push([i, 3 - j]);
        if (dir === 'U') cells.push([j, i]); if (dir === 'D') cells.push([3 - j, i]);
      }
      lines.push(cells);
    }
    let moved = false; const merges = [], gone = [];
    for (const cells of lines) {
      const ts = cells.map(([r, c]) => this.grid[r][c]).filter(Boolean);
      let k = 0, prev = null;
      for (const t of ts) {
        if (prev && !prev.merged && prev.kind === 'm' && t.kind === 'm' && prev.lv === t.lv && t.lv < ZMAX) {
          prev.merged = true; prev.lv++; gone.push(t); t.r = prev.r; t.c = prev.c; merges.push(prev); moved = true; continue;
        }
        const [r, c] = cells[k++]; if (t.r !== r || t.c !== c) moved = true;
        t.r = r; t.c = c; prev = t;
      }
    }
    if (!moved) return false;
    this.busy = true; this.moves++;
    this.grid = [...Array(4)].map(() => Array(4).fill(null));
    for (const t of this.tiles) { if (!gone.includes(t)) this.grid[t.r][t.c] = t; this.place(t); }
    sfx('slide', .35);
    setTimeout(() => {
      for (const t of gone) { t.el.remove(); }
      this.tiles = this.tiles.filter((t) => !gone.includes(t));
      let gained = 0, kicked = false;
      for (const t of merges) {
        t.merged = false; this.render(t); this.size(t); this.place(t);
        void t.el.offsetWidth; t.el.classList.add('merged');
        gained += 2 ** t.lv;
        if (t.lv > this.best) this.newBest(t.lv);
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {  // a merge right next to Daniel removes him from the meeting
          const n = this.grid[t.r + dr] && this.grid[t.r + dr][t.c + dc];
          if (n && n.kind === 'daniel' && !n.kicked) { n.kicked = true; kicked = true; this.remove(n, 'removed'); gained += 150; }
        }
      }
      if (merges.length) { const top = Math.max(...merges.map((t) => t.lv)); sfx(top >= 7 ? 'big' : 'merge', .7, 1 + Math.min(.4, top * .03)); emit('merge'); }
      if (kicked) { sfx('removed', .8); flash('דניאל הוסר מהפגישה +150'); setTimeout(() => say('amir', L.amirKick), 300); emit('kick'); }
      if (gained) addScore(gained);
      if (vsOn('zoomba')) VS.zMoved(merges);
      for (const t of [...this.tiles]) if (t.kind === 'itay') {  // Itay counts down and leaves by himself
        t.cd--; const cd = t.el.querySelector('.cd'); if (cd) cd.textContent = t.cd;
        if (t.cd <= 0) { this.remove(t, 'removed'); sfx('leave', .7); say('itay', L.itayLeave, 2600); }
      }
      this.spawn();
      this.busy = false;
      if (!this.canMove()) {
        const it = this.tiles.find((t) => t.kind === 'itay');
        if (it) { this.remove(it, 'removed'); sfx('leave', .7); say('itay', L.itayLeave, 2600); }  // no dead end: Itay runs to his call
        else if (vsOn('zoomba')) VS.zLost();
        else if (!G.tut) setTimeout(() => endGame(), 650);
      }
    }, 130);
    return true;
  },
  canMove() {
    if (this.empties().length) return true;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const t = this.grid[r][c]; if (t.kind !== 'm') continue;
      for (const [dr, dc] of [[1, 0], [0, 1]]) { const n = this.grid[r + dr] && this.grid[r + dr][c + dc]; if (n && n.kind === 'm' && n.lv === t.lv && t.lv < ZMAX) return true; }
    }
    return false;
  },
  newBest(lv) {
    this.best = lv;
    if (lv >= 5 && !G.tut) {
      flash('נפתחה ' + ZL[lv].he);
      const who = lv >= 10 ? 'gilad' : lv >= 8 ? 'ronit' : lv % 2 ? 'amir' : 'ofer';
      setTimeout(() => say(who, lv === ZMAX ? 'רגע... זאת החלטה? מישהו רושם?' : L[who]), 500);
    }
    if (lv === ZMAX) { sfx('level', .9); addScore(2048); }
  },
  key(k) { const m = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D', a: 'L', d: 'R', w: 'U', s: 'D' }[k]; if (m) { this.move(m); return true; } },
};
// swipe on the whole stage
const sw = { x: 0, y: 0, on: false };
$('#stage').addEventListener('pointerdown', (e) => { if (G.mode !== 'zoomba') return; sw.on = true; sw.x = e.clientX; sw.y = e.clientY; });
$('#stage').addEventListener('pointermove', (e) => {
  if (!sw.on || G.mode !== 'zoomba') return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
  sw.on = false; zb.move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U'));
});
addEventListener('pointerup', () => { sw.on = false; });

// =====================================================================================
// MEETLY - find the one in the grid
// =====================================================================================
const CROWD = [...Array(24)].map((_, i) => 'crowd-' + String(i + 1).padStart(2, '0'));
const CROWD_TALK = CROWD.slice(0, 8).map((c) => c + '-talk');
const CNAMES = ['מיכל', 'אורי', 'נועה', 'יוסי', 'שירן', 'רועי', 'ליאת', 'אלון', 'הדס', 'גיא', 'טל', 'עדי', 'מורן', 'אבי', 'קרן', 'דודי', 'ענבל', 'עומר', 'סיוון', 'ניר', 'רותם', 'איתן', 'מאיה', 'בועז'];
const STAFF = ['yotam', 'osnat', 'tzvika', 'vova', 'erez', 'ido', 'lior', 'rami', 'yoav'];
const SIZES = [[4, 5], [4, 6], [5, 6], [5, 7], [6, 8], [6, 9], [7, 10], [7, 11], [8, 12]];
const TASKS = {
  hand: { t: 'מצאו את דניאל מרים יד', face: 'daniel', target: 'daniel-hand', name: 'דניאל', decoys: (n) => n >= 2 ? [['daniel', 'דניאל (2)'], ['daniel-try', 'דניאל (iPhone)']] : n >= 1 ? [['daniel', 'דניאל (2)']] : [], said: ['amir', 'דניאל? כן, ראינו. נתייחס לזה בפגישת ההמשך.'] },
  leave: { t: 'מצאו את איתי בורח לשיחה עם גלעד', face: 'itay', target: 'itay-leave', name: 'איתי', decoys: (n) => n >= 1 ? [['itay', 'איתי (2)']] : [], said: ['itay', 'טוב, טוב, אני חייב לזוז, יש לי שיחה עם גלעד.'] },
  mouse: { t: 'מצאו את יניב שלא משתף מסך', face: 'yaniv', target: 'yaniv-mouse', name: 'יניב', decoys: (n) => n >= 1 ? [['yaniv', 'יניב (2)']] : [], said: ['yaniv', 'אני לא משתף מסך! יש לי אישור מאורתופד!'] },
  mute: { t: 'מצאו מי מדבר על מיוט 🔇', face: 'amir-talk', target: 'MUTE', said: ['ofer', 'אתה על מיוט. חד משמעית.'] },
  asleep: { t: 'מצאו מי נרדם בפגישה', face: 'asleep', target: 'asleep', name: 'שגיא ל.', decoys: () => [], said: ['amir', 'מצוין. אז אנחנו מסונכרנים.'] },
  empty: { t: 'מצאו את מי שהשאיר מצלמה ויצא', face: 'noone', target: 'noone', name: 'מורן ב.', decoys: () => [], said: ['ronit', 'רגע, מי בכלל נמצא בשיחה הזאת?'] },
  gilad: { t: 'מצאו את גלעד, המנכ״ל, לפני שאמיר רץ', face: 'gilad', target: 'gilad', name: 'גלעד', decoys: () => [], said: ['gilad', 'אמיר, אתה שוב רץ.'] },
};
const mt = {
  round: 0, task: null, order: [], r: null, t0: 0, found: false,
  start(tut) {
    this.r = rng(vsOn('meetly') ? 'meetly-vs|' + VS.m.seed : 'meetly|' + DAY + (tut ? '|tut' : '')); this.round = 0;
    const keys = Object.keys(TASKS); this.order = tut ? ['hand'] : [];
    if (!tut) { let last = ''; for (let i = 0; i < 40; i++) { let k; do k = pick(this.r, keys); while (k === last); this.order.push(k); last = k; } this.order[0] = 'hand'; }
    $('#mgrid').hidden = false; this.next();
  },
  layout() { this.fit(); },
  fit() {
    const g = $('#mgrid'); const { W, H } = stage(); const [c, r] = this.dims;
    const hf = (H - 8 - (r - 1) * 3) / r;
    const cell = Math.min((W - 8 - (c - 1) * 3) / c, hf * 1.3);
    const ch = Math.min(hf, cell * 1.5);
    g.style.gridTemplateColumns = 'repeat(' + c + ',' + cell + 'px)'; g.style.gridTemplateRows = 'repeat(' + r + ',' + ch + 'px)';
    g.style.justifyContent = 'center'; g.style.alignContent = 'center';
    g.style.setProperty('--mfs', Math.max(8, Math.min(12, cell / 7)) + 'px');
  },
  next() {
    const key = this.order[this.round % this.order.length], T = TASKS[key]; this.task = key; this.found = false;
    const [c, r] = SIZES[Math.min(this.round, SIZES.length - 1)]; this.dims = [c, r];
    const n = c * r, R = this.r, cells = [];
    // the filler: crowd + staff + the managers, never the target's own person unless it is a decoy
    const pool = shuffle(R, [...CROWD.map((f, i) => [f, CNAMES[i]]), ...STAFF.map((s) => [s, NAME[s]]), ...['amir', 'ofer', 'ronit', 'gilad'].filter((p) => p !== T.target).map((p) => [p, NAME[p]])]);
    const talkers = shuffle(R, [...CROWD_TALK.map((f, i) => [f, CNAMES[i]]), ...['amir', 'ofer', 'ronit', 'gilad'].filter((p) => p !== T.target).map((p) => [p + '-talk', NAME[p]])]);
    const used = new Set();
    if (key === 'mute') {
      const [tf, tn] = talkers[0]; used.add(tn);
      cells.push({ f: tf, n: tn, talk: true, mute: true, target: true });
      const nt = Math.min(talkers.length - 1, 2 + Math.floor(this.round / 2));
      for (let i = 1; i <= nt; i++) { cells.push({ f: talkers[i][0], n: talkers[i][1], talk: true, mute: false }); used.add(talkers[i][1]); }
    } else {
      cells.push({ f: T.target, n: T.name, target: true }); used.add(T.name);
      for (const [f, nm] of T.decoys(G.tut ? 1 : this.round)) cells.push({ f, n: nm });
      const nt = Math.min(3, Math.floor(this.round / 2));  // people talking (unmuted) to distract
      for (let i = 0; i < nt; i++) { const [f, nm] = talkers[i]; if (!used.has(nm)) { cells.push({ f, n: nm, talk: true, mute: false }); used.add(nm); } }
    }
    let pi = 0;
    while (cells.length < n) {
      const [f, nm] = pool[pi % pool.length]; pi++;
      if (pi <= pool.length && used.has(nm)) continue;
      cells.push({ f, n: pi > pool.length ? nm + ' (' + (1 + Math.floor(pi / pool.length)) + ')' : nm, mute: R() < .55 });
    }
    shuffle(R, cells);
    const g = $('#mgrid'); g.innerHTML = '';
    cells.forEach((cl, i) => {
      const d = document.createElement('div'); d.className = 'mt' + (cl.talk ? ' speak' : ''); d.dataset.i = i;
      d.innerHTML = '<img alt="" draggable="false"><div class="nmm"></div>';
      d.querySelector('img').src = img(cl.f);
      const nm = d.querySelector('.nmm'); nm.innerHTML = cl.mute ? '<svg class="mic" viewBox="0 0 24 24"><path fill="#ff5a6a" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11z"/><path stroke="#ff5a6a" stroke-width="2.4" d="M4 3l17 18"/></svg>' : '<svg class="mic" viewBox="0 0 24 24"><path fill="#fff" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11z"/></svg>';
      nm.appendChild(document.createTextNode(cl.n));
      d.onpointerdown = (e) => { e.preventDefault(); this.tap(d, cl); };
      g.appendChild(d);
    });
    this.cells = cells; this.fit(); this.t0 = performance.now();
    verb(T.t, T.face);
    if (this.round > 0 && !G.tut) sfx('join', .4);
  },
  tap(d, cl) {
    if (G.over || this.found || !G.mode) return;
    if (G.tut && G.tut.waiting !== 'found') return;
    if (vsOn('meetly')) return VS.mTap(d, cl);
    if (cl.target) {
      this.found = true; d.classList.add('found'); sfx('found', .8);
      const secs = (performance.now() - this.t0) / 1000;
      const pts = 50 + this.round * 15 + Math.max(0, Math.round(60 - secs * 8));
      if (!G.tut) { addScore(pts); addTime(5 + Math.min(4, this.round * .5)); }
      flash('+' + pts); const s = TASKS[this.task].said; say(s[0], s[1], 2000, s[0] === 'amir' && this.task === 'mute' ? 'amir-talk' : undefined);
      emit('found');
      setTimeout(() => { if (G.mode !== 'meetly' || G.over || G.tut) return; this.round++; this.next(); }, 750);
    } else {
      d.classList.remove('wrong'); void d.offsetWidth; d.classList.add('wrong'); sfx('wrong', .6);
      if (!G.tut) { addTime(-3); flash('-3 שניות'); }
    }
  },
  targetEl() { return $('#mgrid').children[this.cells.findIndex((c) => c.target)]; },
};

// =====================================================================================
// TEAMZ - flow: connect every pair, fill the board
// =====================================================================================
const TZ_FACES = ['amir', 'ofer', 'ronit', 'gilad', 'itay', 'daniel', 'yaniv', 'yotam', 'osnat'];
const TZ_COL = ['#2d6cf0', '#18a874', '#e0447a', '#f0a020', '#8e5cf0', '#e0344a', '#16b5c9', '#7a5a3a', '#9ccc2a'];
const TZ_LEVELS = [[5, 6, 5], [5, 7, 5], [6, 7, 6], [6, 8, 7], [7, 9, 8], [7, 10, 9], [8, 11, 9]];
const FIMG = {};
function faceImg(n) { if (!FIMG[n]) { FIMG[n] = new Image(); FIMG[n].src = img(n); } return FIMG[n]; }
// a random Hamiltonian path (backbite moves), cut into k pieces = a level that surely has a full-board solution
function genFlow(C, R, k, r) {
  for (let attempt = 0; attempt < 400; attempt++) {
    let path = [];
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) path.push([y % 2 ? C - 1 - x : x, y]);
    const inP = new Map(); const key = (p) => p[0] + ',' + p[1];
    const nb = (p) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [p[0] + dx, p[1] + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < C && y < R);
    const steps = C * R * 30;
    for (let s = 0; s < steps; s++) {
      if (r() < .5) path.reverse();
      const end = path[path.length - 1];
      const ns = nb(end); const q = ns[Math.floor(r() * ns.length)];
      const idx = path.findIndex((p) => p[0] === q[0] && p[1] === q[1]);
      if (idx === path.length - 2) continue;
      path = path.slice(0, idx + 1).concat(path.slice(idx + 1).reverse());
    }
    // cut into k segments, each at least 3 long
    const N = path.length; const cuts = [];
    let ok = false;
    for (let t = 0; t < 60 && !ok; t++) {
      const cs = new Set(); while (cs.size < k - 1) cs.add(3 + Math.floor(r() * (N - 5)));
      const arr = [...cs].sort((a, b) => a - b); const bounds = [0, ...arr, N];
      ok = true;
      for (let i = 0; i < k; i++) if (bounds[i + 1] - bounds[i] < 3) ok = false;
      if (ok) {
        const segs = []; for (let i = 0; i < k; i++) segs.push(path.slice(bounds[i], bounds[i + 1]));
        // endpoints never next to each other (a 1-step pair is no puzzle) and no straight single-line pieces at most 1
        if (segs.some((s) => Math.abs(s[0][0] - s[s.length - 1][0]) + Math.abs(s[0][1] - s[s.length - 1][1]) < 2)) { ok = false; continue; }
        return segs;
      }
    }
  }
  return null;
}
const tz = {
  C: 5, R: 6, level: 0, pairs: [], paths: [], owner: null, drag: null, cell: 0, ox: 0, oy: 0, done: false,
  start(tut) {
    this.level = 0; this.tut = !!tut; $('#cv').hidden = false; resizeCv();
    this.r = rng(vsOn('teamz') ? 'teamz-vs|' + VS.m.seed : 'teamz|' + DAY);
    this.load();
  },
  load() {
    let segs, C, R;
    if (this.tut) {
      C = 4; R = 4;
      segs = [[[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 1], [1, 1], [2, 1], [3, 1]], [[0, 2], [1, 2], [2, 2], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3]]];
    } else {
      const [c, r, k0] = TZ_LEVELS[Math.min(this.level, TZ_LEVELS.length - 1)]; C = c;
      const { W, H } = stage(); R = vsOn('teamz') ? r + 2 : Math.max(r, Math.min(r + 4, Math.round(c * (H - 10) / (W - 10))));  // the board takes the phone's shape (online: the same board on both phones)
      const k = Math.min(TZ_FACES.length, k0 + Math.floor((R - r) / 2));
      segs = genFlow(C, R, k, this.r) || genFlow(C, R, k - 1, this.r);
    }
    this.C = C; this.R = R; this.done = false;
    const faces = this.tut ? ['amir', 'ofer', 'ronit'] : shuffle(this.r, TZ_FACES.slice()).slice(0, segs.length);
    this.pairs = segs.map((s, i) => ({ a: s[0], b: s[s.length - 1], face: faces[i], col: TZ_COL[TZ_FACES.indexOf(faces[i])], sol: s }));
    this.paths = this.pairs.map(() => []);
    this.pairs.forEach((p) => faceImg(p.face));
    this.layout();
    verb(this.tut ? 'גררו מפרצוף לפרצוף הזהה לו' : 'חברו כל זוג – בלי לחצות, למלא הכול', 'ronit');
    if (!this.tut && this.level > 0 && !vsOn('teamz')) say('ronit', ['רגע, הוספתי עוד בעל עניין.', 'מי בכלל אישר את זה? עוד סבב.', 'לא. אנחנו לא מסונכרנים. עוד פעם.']);
  },
  layout() {
    const { W, H } = stage();
    this.cell = Math.floor(Math.min((W - 10) / this.C, (H - 10) / this.R));
    this.ox = (W - this.cell * this.C) / 2; this.oy = (H - this.cell * this.R) / 2;
  },
  endAt(x, y) { return this.pairs.findIndex((p) => (p.a[0] === x && p.a[1] === y) || (p.b[0] === x && p.b[1] === y)); },
  ownerAt(x, y) { for (let i = 0; i < this.paths.length; i++) if (this.paths[i].some((q) => q[0] === x && q[1] === y)) return i; return -1; },
  complete(i) { const p = this.paths[i], pr = this.pairs[i]; if (p.length < 2) return false; const s = p[0], e = p[p.length - 1]; const isEnd = (q) => (q[0] === pr.a[0] && q[1] === pr.a[1]) || (q[0] === pr.b[0] && q[1] === pr.b[1]); return isEnd(s) && isEnd(e) && !(s[0] === e[0] && s[1] === e[1]); },
  cellAt(px, py) { const x = Math.floor((px - this.ox) / this.cell), y = Math.floor((py - this.oy) / this.cell); return x >= 0 && y >= 0 && x < this.C && y < this.R ? [x, y] : null; },
  down(px, py) {
    if (this.done || G.over) return;
    const c = this.cellAt(px, py); if (!c) return;
    const e = this.endAt(c[0], c[1]);
    if (e >= 0) { this.paths[e] = [c]; this.drag = e; sfx('tap', .4); return; }
    const o = this.ownerAt(c[0], c[1]);
    if (o >= 0) { const p = this.paths[o]; const k = p.findIndex((q) => q[0] === c[0] && q[1] === c[1]); this.paths[o] = p.slice(0, k + 1); this.drag = o; }
  },
  move(px, py) {
    if (this.drag == null) return;
    const c = this.cellAt(px, py); if (!c) return;
    const i = this.drag, p = this.paths[i], last = p[p.length - 1];
    if (c[0] === last[0] && c[1] === last[1]) return;
    // step one cell at a time towards the finger (fast drags)
    const dx = c[0] - last[0], dy = c[1] - last[1];
    if (Math.abs(dx) + Math.abs(dy) > 1) { const st = Math.abs(dx) >= Math.abs(dy) ? [last[0] + Math.sign(dx), last[1]] : [last[0], last[1] + Math.sign(dy)]; this.step(i, st); this.move(px, py); return; }
    this.step(i, c);
  },
  step(i, c) {
    const p = this.paths[i], pr = this.pairs[i];
    const back = p.findIndex((q) => q[0] === c[0] && q[1] === c[1]);
    if (back >= 0) { this.paths[i] = p.slice(0, back + 1); return; }
    if (this.complete(i)) return;
    const e = this.endAt(c[0], c[1]);
    if (e >= 0 && e !== i) return;  // another stakeholder's face blocks
    if (e === i && p.length && p[0][0] === c[0] && p[0][1] === c[1]) return;
    const o = this.ownerAt(c[0], c[1]);
    if (o >= 0 && o !== i) { const op = this.paths[o]; const k = op.findIndex((q) => q[0] === c[0] && q[1] === c[1]); this.paths[o] = op.slice(0, k); }  // cut the other line
    p.push(c); sfx('line', .25, 1 + p.length * .02);
    if (this.complete(i)) { sfx('connect', .6); emit('connect'); this.drag = null; this.check(); }
  },
  up() { if (this.drag != null) { this.drag = null; this.check(); } if (vsOn('teamz')) VS.tProgress(); },
  filled() { let n = 0; for (const p of this.paths) n += p.length; return n; },
  check() {
    if (this.done) return;
    const all = this.pairs.every((_, i) => this.complete(i));
    if (!all) return;
    if (this.filled() < this.C * this.R) { flash('יש משבצות ריקות'); say('ronit', 'רגע, לא כולם בשיחה. כל משבצת צריכה להתמלא.', 2200); return; }
    this.done = true; sfx('level', .8); emit('level');
    if (this.tut) return;
    if (vsOn('teamz')) return VS.tSolved();
    const pts = 60 * this.pairs.length + this.level * 40;
    addScore(pts); addTime(22); flash('מסונכרנים! +' + pts);
    say('amir', 'מצוין. אז אנחנו מסונכרנים.', 1800);
    setTimeout(() => { if (G.mode !== 'teamz' || G.over) return; this.level++; this.load(); }, 1300);
  },
  draw(now) {
    const c = this.cell, ox = this.ox, oy = this.oy;
    ctx.save(); ctx.shadowColor = '#3a2a8055'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#ffffff'; rr(ox - 5, oy - 5, c * this.C + 10, c * this.R + 10, 16); ctx.fill(); ctx.restore();
    ctx.strokeStyle = '#ddd6f3'; ctx.lineWidth = 1.2;
    for (let x = 0; x <= this.C; x++) { ctx.beginPath(); ctx.moveTo(ox + x * c, oy); ctx.lineTo(ox + x * c, oy + this.R * c); ctx.stroke(); }
    for (let y = 0; y <= this.R; y++) { ctx.beginPath(); ctx.moveTo(ox, oy + y * c); ctx.lineTo(ox + this.C * c, oy + y * c); ctx.stroke(); }
    this.paths.forEach((p, i) => {
      const col = this.pairs[i].col;
      ctx.fillStyle = col + '30'; for (const q of p) ctx.fillRect(ox + q[0] * c + 1, oy + q[1] * c + 1, c - 2, c - 2);
      if (p.length < 2) return;
      ctx.strokeStyle = col; ctx.lineWidth = c * .32; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); p.forEach((q, k) => { const x = ox + (q[0] + .5) * c, y = oy + (q[1] + .5) * c; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    });
    this.pairs.forEach((pr, i) => {
      const done = this.complete(i);
      for (const q of [pr.a, pr.b]) {
        const x = ox + (q[0] + .5) * c, y = oy + (q[1] + .5) * c, rad = c * .42;
        ctx.save(); ctx.beginPath(); ctx.arc(x, y, rad + 3, 0, 6.29); ctx.fillStyle = pr.col; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, rad - 1, 0, 6.29); ctx.clip();
        const im = faceImg(pr.face); if (im.complete && im.naturalWidth) ctx.drawImage(im, x - rad, y - rad * .9, rad * 2, rad * 2); else { ctx.fillStyle = '#fff'; ctx.fill(); }
        ctx.restore();
        if (done) { ctx.beginPath(); ctx.arc(x + rad * .7, y - rad * .7, c * .13, 0, 6.29); ctx.fillStyle = '#16a873'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
      }
    });
  },
};
const cv = $('#cv'), ctx = cv.getContext('2d');
let DPR = 1, CW = 0, CH = 0;
function resizeCv() { const { W, H } = stage(); DPR = Math.min(2.5, devicePixelRatio || 1); CW = W; CH = H; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); }
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function pt(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
cv.addEventListener('pointerdown', (e) => { if (G.mode !== 'teamz') return; cv.setPointerCapture(e.pointerId); const [x, y] = pt(e); tz.down(x, y); });
cv.addEventListener('pointermove', (e) => { if (G.mode !== 'teamz') return; const [x, y] = pt(e); tz.move(x, y); });
cv.addEventListener('pointerup', () => G.mode === 'teamz' && tz.up());
cv.addEventListener('pointercancel', () => G.mode === 'teamz' && tz.up());

const MODES = { zoomba: zb, meetly: mt, teamz: tz };
const APP = { zoomba: 'Zoomba', meetly: 'Meetly', teamz: 'Teamz' };
const CLOCK = { meetly: 40, teamz: 75 };

// ---------- loop ----------
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(.1, (now - lastT) / 1000); lastT = now;
  if (G.mode && CLOCK[G.mode] && !G.tut && !G.over && !vsOn(G.mode) && !document.hidden && $('#end').hidden) {
    G.time -= dt; timerShow();
    if (G.time <= 0) { G.time = 0; timerShow(); endGame(); }
  }
  if (G.mode === 'teamz') { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, CW, CH); tz.draw(now); }
  requestAnimationFrame(frame);
}
addEventListener('resize', () => setTimeout(() => { if (!G.mode) return; if (G.mode === 'teamz') resizeCv(); MODES[G.mode].layout(); }, 60));

// ---------- screens ----------
function best(mode) { return Number(store.get('best-' + mode) || 0); }
function saveBest(mode) {
  if (G.tut) return;
  if (G.score > best(mode)) store.set('best-' + mode, G.score);
  if (G.score > Number(store.get('best') || 0)) store.set('best', G.score);
  const d = (store.get('day') || '').split('|'); if (d[0] !== DAY || G.score > Number(d[1] || 0)) store.set('day', DAY + '|' + G.score);
}
function showStart() {
  G.mode = null; G.tut = null; G.over = false;
  $('#play').hidden = true; $('#end').hidden = true; $('#tut').hidden = true; $('#start').hidden = false;
  document.querySelectorAll('[data-rec]').forEach((el) => { const b = best(el.dataset.rec); el.textContent = b ? 'השיא שלכם: ' + b : ''; });
  soundBtn(); musicLevel();
}
function startMode(mode, tutorial) {
  audioInit();
  G.mode = mode; G.over = false; G.round = (G.round || 0) + 1; setScore(0); G.talking = false; clearTimeout(sayT);
  $('#start').hidden = true; $('#end').hidden = true; $('#play').hidden = false; $('#play').dataset.mode = mode;
  $('#appIcon').src = 'assets/app-' + mode + '.png'; $('#appTitle').textContent = APP[mode];
  $('#zb').hidden = $('#mgrid').hidden = $('#cv').hidden = true;
  $('#cl').hidden = $('#clHud').hidden = true; $('#play').classList.remove('narrow', 'vs'); $('#score').hidden = false; $('#bRestart').style.visibility = ''; $('#bAgain').textContent = 'עוד פגישה'; $('#bAgain').hidden = false; $('#bNew').hidden = true;
  $('#timer').hidden = !CLOCK[mode] || vsOn(mode); G.time = G.timeMax = CLOCK[mode] || 0; if (CLOCK[mode]) timerShow();
  $('#flash').classList.remove('on');
  MODES[mode].start(tutorial); musicLevel();
  if (!tutorial) { window.track && window.track('game_start', SLUG); sfx('join', .6); }
}
const END = {
  zoomba: { t: 'אין יותר מקום ביומן', s: 'הלוח התמלא', face: 'amir', line: () => zb.best >= ZMAX ? '"רגע... קיבלנו החלטה? נקבע פגישה לדבר על זה."' : '"הגעתם עד ' + ZL[zb.best || 1].he + '. נמשיך בפגישת ההמשך."' },
  meetly: { t: 'הזמן נגמר', s: 'השיחה הסתיימה', face: 'daniel-try', line: () => '"רגע, רק רציתי…" – מצאתם ' + mt.round + ' בשיחה' },
  teamz: { t: 'הזמן נגמר', s: 'הפגישה הבאה כבר התחילה', face: 'ronit', line: () => '"לא. אנחנו לא מסונכרנים." – יישרתם קו ב-' + tz.level + ' לוחות' },
};
function endGame() {
  if (G.over || !G.mode || G.tut || vsOn(G.mode)) return; G.over = true;
  const mode = G.mode, nb = G.score > best(mode);
  saveBest(mode); sfx('over', .7);
  window.track && window.track('game_over', SLUG);
  if (G.score > 0 && window.VerseFrame && VerseFrame.score) VerseFrame.score(G.score);
  const E = END[mode];
  $('#end').dataset.mode = mode;
  $('#endTitle').innerHTML = E.t + '<small>' + E.s + '</small>';
  $('#endLine').textContent = E.line();
  $('#endFace').src = img(nb ? 'amir-talk' : E.face);
  $('#endScore').textContent = G.score; $('#endNew').hidden = !nb;
  $('#endBest').textContent = nb ? '' : 'השיא שלכם: ' + best(mode);
  setTimeout(() => { $('#end').hidden = false; }, 350);
}
document.querySelectorAll('.app').forEach((b) => b.onclick = (e) => {
  const mode = b.dataset.mode, how = e.target.closest('[data-how]');
  sfx('tap', .5);
  if (how || !store.get('tut-' + mode)) runTutorial(mode); else startMode(mode);
});
$('#bHome').onclick = () => { if (G.mode && !G.tut && !G.over && G.score > 0) { saveBest(G.mode); window.VerseFrame && VerseFrame.score && VerseFrame.score(G.score); } showStart(); };
$('#bRestart').onclick = () => { if (G.tut) return; if (G.score > 0 && !G.over) saveBest(G.mode); startMode(G.mode); };
$('#bAgain').onclick = () => startMode(G.mode);
$('#bMenu').onclick = showStart;
$('#sFace').onclick = () => { if (!G.mode) return; const who = pick(Math.random, ['amir', 'ofer', 'ronit', 'gilad', 'itay']); say(who, L[who]); };

// ---------- the tutorial ----------
const R = (el) => { const r = (typeof el === 'string' ? $(el) : el).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
const SR = (x, y, w, h) => { const r = $('#stage').getBoundingClientRect(); return { x: r.left + x, y: r.top + y, w, h }; };
const TUT = {
  zoomba: [
    { who: 'amir', t: 'אני אמיר, סמנכ״ל אסטרטגיה. ב-Zoomba כל פגישה מולידה עוד פגישה.', spot: () => R('#zb') },
    { who: 'amir', t: 'המטרה: למזג פגישות עד שמגיעים ל"החלטה!". אף אחד בטקי-טק עוד לא הגיע לשם.', spot: () => R('#zb') },
    { who: 'amir', t: 'נסו עכשיו: החליקו למעלה – שני הצ\'ק-אין ייפגשו ויהפכו לסנכרון.', try: 'merge', spot: () => R('#zb') },
    { who: 'ofer', t: 'חד משמעית. בכל החלקה כל הפגישות זזות, ומצטרפת עוד פגישה. המספר בפינה = כמה גדולה הפגישה.', spot: () => R('#zb') },
    { who: 'amir', t: 'מפסידים כשהלוח מלא ואין שתי פגישות זהות זו ליד זו.', spot: () => R('#zb') },
    { who: 'daniel', face: 'daniel-try', t: 'לפעמים דניאל עולה לשיחה. הוא לא מתמזג עם אף אחד ותופס משבצת.', spot: () => R('#zb') },
    { who: 'amir', t: 'מזגו פגישה ממש לידו – והוא מוסר מהפגישה. 150 נקודות בונוס.', spot: () => R('#zb') },
    { who: 'itay', t: 'ואני? אני נכנס, תופס משבצת ויוצא לבד אחרי כמה מהלכים. המספר הלבן אומר מתי.', spot: () => R('#zb') },
    { who: 'amir', t: 'למעלה: הניקוד. ↻ מתחילים מחדש, ⌂ חוזרים לאפליקציות. אז אנחנו מסונכרנים?', spot: () => R('#hud') },
  ],
  meetly: [
    { who: 'amir', t: 'ב-Meetly השיחה ענקית. למטה כתוב את מי מחפשים.', spot: () => R('#strip') },
    { who: 'daniel', face: 'daniel-hand', t: 'נסו עכשיו: מצאו אותי מרים יד והקישו עליי.', try: 'found', spot: () => R('#mgrid') },
    { who: 'amir', t: 'מצוין. כל מציאה מוסיפה זמן, הקשה לא נכונה מורידה 3 שניות. השעון – למעלה.', spot: () => R('#timer') },
    { who: 'ofer', t: 'שימו לב לפרטים: יש גם "דניאל (2)" בלי יד. ו-🔇 אדום = על מיוט.', spot: () => R('#stage') },
    { who: 'amir', t: 'כל סיבוב – יותר משבצות. מוכנים? אז אנחנו מסונכרנים.', spot: () => R('#hud') },
  ],
  teamz: [
    { who: 'ronit', t: 'אני רונית. לפני שמתקדמים – כל בעלי העניין צריכים להיות מסונכרנים.', spot: () => SR(tz.ox, tz.oy, tz.cell * tz.C, tz.cell * tz.R) },
    { who: 'ronit', t: 'נסו עכשיו: גררו קו מאמיר אחד לאמיר השני.', try: 'connect', spot: () => SR(tz.ox, tz.oy, tz.cell * tz.C, tz.cell * tz.R) },
    { who: 'ronit', t: 'קווים לא חוצים זה את זה. וכל המשבצות חייבות להתמלא – כולם בשיחה.', spot: () => SR(tz.ox, tz.oy, tz.cell * tz.C, tz.cell * tz.R) },
    { who: 'ronit', t: 'נסו עכשיו: חברו את כולם ומלאו את כל הלוח. רמז: הקו של רונית מסתובב.', try: 'level', spot: () => SR(tz.ox, tz.oy, tz.cell * tz.C, tz.cell * tz.R) },
    { who: 'amir', t: 'כל לוח שנפתר מוסיף זמן, ובכל לוח יש עוד בעל עניין. מוכנים?', spot: () => R('#timer') },
  ],
};
function runTutorial(mode) {
  G.tut = { mode, i: 0, steps: TUT[mode] };
  startMode(mode, true);
  $('#tut').hidden = false; tutShow();
}
function tutShow() {
  const T = G.tut, s = T.steps[T.i];
  T.waiting = s.try || null;
  $('#tutN').textContent = (T.i + 1) + ' / ' + T.steps.length;
  $('#tutFace').src = img(s.face || s.who);
  $('#tutT').innerHTML = s.t + (s.try ? '<br><span class="try">נסו עכשיו ←</span>' : '');
  $('#tutNext').hidden = !!s.try; $('#tut').classList.toggle('try', !!s.try);
  requestAnimationFrame(() => {
    const r = s.spot ? s.spot() : { x: 0, y: 0, w: 0, h: 0 }, sp = $('#spot');
    Object.assign(sp.style, { left: r.x - 4 + 'px', top: r.y - 4 + 'px', width: r.w + 8 + 'px', height: r.h + 8 + 'px' });
    sp.style.boxShadow = s.try ? '0 0 0 4000px #0004,0 0 0 3px #ffd76a inset' : '';
    const card = $('#tutCard'), mid = r.y + r.h / 2;
    card.style.top = card.style.bottom = '';
    if (s.try || r.h > innerHeight * .5) { card.style.bottom = 'calc(var(--safe-b) + 6px)'; }
    else if (mid > innerHeight * .5) card.style.top = 'calc(var(--safe-t) + 10px)'; else card.style.bottom = 'calc(var(--safe-b) + 14px)';
  });
}
function tutNext() { const T = G.tut; if (!T || T.waiting) return; T.i++; if (T.i >= T.steps.length) return tutEnd(); tutShow(); }
function tutEvent(e) {
  const T = G.tut; if (!T || T.waiting !== e) return;
  T.waiting = null; sfx('found', .5);
  $('#tutT').innerHTML = '<b>יפה מאוד!</b>';
  setTimeout(() => { if (G.tut === T) { T.i++; T.i >= T.steps.length ? tutEnd() : tutShow(); } }, 900);
}
function tutEnd() { const m = G.tut.mode; store.set('tut-' + m, 1); G.tut = null; $('#tut').hidden = true; startMode(m); }
$('#tutNext').onclick = tutNext;
$('#tutSkip').onclick = () => G.tut && tutEnd();
addEventListener('keydown', (e) => {
  if (G.tut) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tutNext(); return; }
    if (e.key === 'Escape') { tutEnd(); return; }
  }
  if (G.mode === 'zoomba' && (!G.tut || G.tut.waiting) && zb.key(e.key)) e.preventDefault();
});

// ---------- boot ----------
['amir', 'ofer', 'ronit', 'gilad', 'itay', 'daniel', 'daniel-try', 'yaniv'].forEach((n) => { const i = new Image(); i.src = img(n); });
TZ_FACES.forEach(faceImg);
showStart(); requestAnimationFrame(frame);

// test hook
window.MEET = { G, zb, mt, tz, startMode, runTutorial, tutNext, endGame, genFlow, TASKS, ZL };
