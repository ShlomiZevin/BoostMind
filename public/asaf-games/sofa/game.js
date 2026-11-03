// מה אני אגיד לך? – whack-a-mole in Asaf's living room. Asaf, the annoying friend who can never be happy for you, pops
// up from behind the sofa, its arms, the window and the laundry basket to ruin your good news. Bop him with the
// newspaper before he finishes his line - and don't hit your own good news (a cake, a ring, car keys...) when it pops up.
'use strict';
const $ = (id) => document.getElementById(id);
const rnd = (a, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const KEY = { best: 'shlomiverse:sofa:best', day: 'shlomiverse:sofa:day', tut: 'shlomiverse:sofa:tut', snd: 'shlomiverse:sofa:snd' };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} },
};
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

// ───────────────────────── the room ─────────────────────────
// in the painting's pixels (1024 x 1536): where each hiding place's edge (lip) is, and how wide a pop-up is there
const ROOM = { w: 1024, h: 1536, crop: 40 };   // up to 40 px of each side may fall off a narrow phone
const SPOTS = [
  { id: 'win', x: 236, lip: 366, s: 250, clip: [42, 40, 430] },   // the window (clipped to its frame)
  { id: 'bL', x: 282, lip: 584, s: 330 },                          // behind the sofa back
  { id: 'bM', x: 512, lip: 584, s: 330 },
  { id: 'bR', x: 742, lip: 584, s: 330 },
  { id: 'aL', x: 92, lip: 684, s: 300 },                           // behind the sofa arms
  { id: 'aR', x: 932, lip: 684, s: 300 },
  { id: 'tbl', x: 512, lip: 1082, s: 400 },                        // behind the coffee table
  { id: 'bas', x: 140, lip: 1158, s: 400 },                        // the laundry basket
  { id: 'chr', x: 862, lip: 1150, s: 400 },                        // the back of the armchair
];
const GOOD = [
  { id: 'cake', t: 'יום הולדת!' }, { id: 'gift', t: 'קיבלתי מתנה!' }, { id: 'keys', t: 'אוטו חדש!' },
  { id: 'ring', t: 'התארסתי!' }, { id: 'phone', t: 'התקבלתי לעבודה!' }, { id: 'plane', t: 'טסים לחופשה!' },
];
const HAND = 0.10;        // how far below the edge Asaf's fingers hang
const ITEM_BASE = 0.74;   // the painted items stand in a cup - its lower part stays hidden behind the edge

// ───────────────────────── art ─────────────────────────
const IMG = {};
const img = (k, src) => { const i = new Image(); i.src = src; IMG[k] = i; return i; };
img('bg', 'assets/bg.jpg'); img('news', 'assets/newspaper.webp');
for (const p of ['talk', 'smug', 'hit', 'phone']) img('a-' + p, `assets/asaf-${p}.webp`);
for (const g of GOOD) img('g-' + g.id, `assets/good-${g.id}.webp`);
const ok = (im) => im && im.complete && im.naturalWidth;

// ───────────────────────── Asaf's words ─────────────────────────
const sayEl = $('say');
let sayT = 0;
function say(text, dur = 1.6, loud = false) { sayEl.textContent = text; sayEl.classList.add('on'); sayEl.classList.toggle('loud', loud); sayT = dur; }
const LINES = {
  pop: ['וואלה.', 'מה אני אגיד לך?', 'כמה? ברוטו?', 'בטח לא מהיום הראשון.', 'זה רק עניין של זמן.', 'מה זה משנה?', 'וואי וואי וואי.', 'אתה סומך עליו?', 'אללה יסתור.', 'בטח ראה אותך כזה טמבל.', 'הולכים לפטר אותך, אח שלי.', 'אני כבר לא התחברתי.'],
  phone: ['שמעת?! תבדוק את הרילס!', 'שלחתי לך איזה 20 רילס!', 'אתה לא יכול להגיב אפילו על אחד?'],
  ruin: ['ביאסת את התחת היום.', 'אתה כזה טמבל.', 'תתחיל לשלוח קורות חיים.', 'אמרתי לך. מה אני אגיד לך?'],
  own: ['וואלה. הרסת לעצמך לבד.', 'חחח. אפילו לא הייתי צריך.', 'אתה כזה טמבל.'],
  bonk: ['בום!', 'טראח!', 'שקט!', 'פאק!'],
};
function pickNo(list, key) { const last = pickNo[key]; let l = pick(list); if (list.length > 1 && l === last) l = list[(list.indexOf(l) + 1) % list.length]; pickNo[key] = l; return l; }

// ───────────────────────── effects ─────────────────────────
const fxEl = $('fx');
function popText(x, y, text, cls) { const p = document.createElement('div'); p.className = 'pop' + (cls ? ' ' + cls : ''); p.style.left = x + 'px'; p.style.top = y + 'px'; p.textContent = text; fxEl.appendChild(p); setTimeout(() => p.remove(), 900); }
function flash() { const f = document.createElement('div'); f.className = 'flash'; fxEl.appendChild(f); setTimeout(() => f.remove(), 400); }
function banner(text) { const b = document.createElement('div'); b.className = 'banner'; b.innerHTML = text; fxEl.appendChild(b); setTimeout(() => b.remove(), 1600); }

// ───────────────────────── sound ─────────────────────────
const SND = { ctx: null, raw: {}, buf: {}, on: store.get(KEY.snd) !== '0', last: {}, master: null };
const SFX = ['bonk-1', 'bonk-2', 'bonk-3', 'swing-1', 'swing-2', 'pop-1', 'pop-2', 'break-1', 'break-2', 'combo', 'over', 'start'];
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
// a name plays one of its variants (bonk → bonk-1..3), never the same one twice in a row
function play(name, vol = 1) {
  if (!SND.ctx) return;
  const vars = SFX.filter((n) => n === name || n.startsWith(name + '-')).filter((n) => SND.buf[n]);
  if (!vars.length) return;
  let n = pick(vars);
  if (vars.length > 1 && n === SND.last[name]) n = vars[(vars.indexOf(n) + 1) % vars.length];
  SND.last[name] = n;
  const src = SND.ctx.createBufferSource(), gn = SND.ctx.createGain();
  src.buffer = SND.buf[n]; src.playbackRate.value = rnd(.94, 1.06); gn.gain.value = vol;
  src.connect(gn).connect(SND.master); src.start();
}
const SPK = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const MUTE = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
function sndIcons() { document.querySelectorAll('.sndBtn').forEach((b) => { b.innerHTML = SND.on ? SPK : MUTE; }); }
document.querySelectorAll('.sndBtn').forEach((b) => b.onclick = () => { audioUnlock(); SND.on = !SND.on; store.set(KEY.snd, SND.on ? '1' : '0'); if (SND.master) SND.master.gain.value = SND.on ? 1 : 0; sndIcons(); });
sndIcons();

// ───────────────────────── layout ─────────────────────────
const cv = $('cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, L = { k: 1, x0: 0, y0: 0 };
const cssPx = (v) => { const d = document.createElement('div'); d.style.cssText = `position:fixed;top:${v};visibility:hidden`; document.body.appendChild(d); const t = d.getBoundingClientRect().top; d.remove(); return t; };
function layout() {
  DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  document.body.classList.toggle('turn', W > H * 1.15 && H < 520 && 'ontouchstart' in window);
  const top = cssPx('var(--safe-t)') + 100, bottom = H - 56 - cssPx('env(safe-area-inset-bottom,0px)');
  const k = Math.min(W / (ROOM.w - ROOM.crop * 2), (bottom - top) / ROOM.h, 0.9);
  L = { k, x0: (W - ROOM.w * k) / 2, y0: top + Math.max(0, (bottom - top - ROOM.h * k) * 0.35), top, bottom };
}
addEventListener('resize', layout); addEventListener('verseframe', layout);
const rx = (x) => L.x0 + x * L.k, ry = (y) => L.y0 + y * L.k;

// ───────────────────────── state ─────────────────────────
let state = 'menu', paused = false, tutorial = false;
let score = 0, hearts = 3, combo = 0, bestCombo = 0, hits = 0, T = 0, nextPop = 0;
const moles = [];   // { spot, kind: 'asaf'|'phone'|'good', good, pose, phase: 'rise'|'up'|'hit'|'down', t, up, y (0 up .. 1 hidden), hits }
const swing = { t: 0, x: 0, y: 0 };

function freeSpots() { return SPOTS.filter((s) => !moles.some((m) => m.spot === s)); }
function spawn(kind, spot, up) {
  const free = freeSpots(); if (!free.length) return null;
  spot = spot || pick(free);
  const m = { spot, kind, phase: 'rise', t: 0, up, y: 1, hits: 0 };
  if (kind === 'good') m.good = pick(GOOD);
  else m.pose = kind === 'phone' ? 'phone' : pick(['talk', 'smug']);
  moles.push(m); play('pop', .45);
  if (kind === 'asaf') say(pickNo(LINES.pop, 'pop'), Math.min(1.6, up + .2));
  if (kind === 'phone') say(pickNo(LINES.phone, 'ph'), Math.min(1.8, up + .2));
  return m;
}
// how hard it is after T seconds
const gap = () => Math.max(0.42, 1.05 - T * 0.011);
const upTime = () => Math.max(0.6, 1.45 - T * 0.011);
const maxUp = () => T < 12 ? 1 : T < 35 ? 2 : 3;
function spawnTick(dt) {
  nextPop -= dt;
  if (nextPop > 0 || moles.filter((m) => m.phase !== 'down').length >= maxUp()) return;
  nextPop = gap() * rnd(0.75, 1.25);
  const r = Math.random(), goodP = Math.min(0.26, 0.1 + T * 0.003), phoneP = T > 20 ? 0.14 : 0;
  if (r < goodP) spawn('good', null, upTime() * 1.15);
  else if (r < goodP + phoneP) spawn('phone', null, upTime() * 1.5);
  else spawn('asaf', null, upTime());
}
function startGame() {
  tutorial = false; state = 'play'; score = 0; hearts = 3; combo = 0; bestCombo = 0; hits = 0; T = 0; nextPop = 0.9; moles.length = 0;
  showHUD(true); show(null); hud(); play('start', .6); banner('יאללה!');
  window.track && window.track('game_start', 'sofa');
}

// ───────────────────────── geometry of a pop-up ─────────────────────────
function moleRect(m) {
  const s = m.spot, isGood = m.kind === 'good';
  const im = isGood ? IMG['g-' + m.good.id] : IMG['a-' + (m.phase === 'hit' ? 'hit' : m.pose)];
  const w = s.s * (isGood ? 0.8 : 1) * L.k, ar = ok(im) ? im.naturalHeight / im.naturalWidth : 1, h = w * ar;
  const lip = ry(s.lip), base = isGood ? lip + h * (1 - ITEM_BASE) : lip + h * HAND;   // where the sprite's bottom sits when up
  return { im, x: rx(s.x) - w / 2, y: base - h + m.y * h, w, h, lip, clipY: isGood ? lip : lip + h * HAND };
}

// ───────────────────────── input: bop ─────────────────────────
cv.addEventListener('pointerdown', (e) => {
  audioUnlock();
  if (paused || (state !== 'play' && state !== 'tut')) return;
  const x = e.clientX, y = e.clientY;
  swing.t = 0.2; swing.x = x; swing.y = y;
  // the front-most pop-up under the finger (generous: a little around what is visible)
  let hit = null;
  for (const m of moles) {
    if (m.phase === 'down' || m.phase === 'hit' || m.y > 0.75) continue;
    const r = moleRect(m), pad = r.w * 0.08;
    if (x > r.x + r.w * 0.1 - pad && x < r.x + r.w * 0.9 + pad && y > r.y - pad && y < r.clipY + pad) hit = m;
  }
  if (!hit) { play('swing', .5); if (!tutorial) combo = 0; hud(); return; }
  const r = moleRect(hit);
  if (hit.kind === 'good') return smashGood(hit, r);
  hit.hits++;
  if (hit.kind === 'phone' && hit.hits < 2) { play('bonk', .7); popText(x, r.y, 'עוד אחת!'); hit.pose = 'talk'; hit.t = Math.min(hit.t, 0.2); return; }
  bonk(hit, r, x);
});
function bonk(m, r, x) {
  m.phase = 'hit'; m.t = 0; combo++; hits++; bestCombo = Math.max(bestCombo, combo);
  const mult = Math.min(4, 1 + Math.floor(combo / 5)), pts = (m.kind === 'phone' ? 25 : 10) * mult;
  if (!tutorial) score += pts;
  play('bonk', .9); popText(x, r.y, `${pickNo(LINES.bonk, 'bk')} ⁦+${pts}⁩`);
  sayEl.classList.remove('on'); sayT = 0;
  if (combo > 0 && combo % 5 === 0) { play('combo', .5); popText(W / 2, ry(820), `רצף ×${mult}`, 'good'); }
  if (!tutorial && combo % 12 === 0 && hearts < 3) { hearts++; popText(W / 2, ry(900), 'לב חזר!', 'good'); }
  if (tutWait && tutWait.id === 'hit') tutWait.done = true;
  hud();
}
function smashGood(m, r) {
  m.phase = 'down'; m.t = 0; combo = 0;
  play('break', .8); flash(); popText(rx(m.spot.x), r.y, 'אוי! ' + m.good.t, 'bad');
  say(pickNo(LINES.own, 'own'), 2, true);
  if (tutorial) { if (tutWait && tutWait.id === 'spare') tutWait.again = true; }
  else loseHeart();
  hud();
}
function loseHeart() {
  hearts--; $('hearts').classList.remove('hit'); void $('hearts').offsetWidth; $('hearts').classList.add('hit');
  if (hearts <= 0) gameOver();
}

// ───────────────────────── every frame ─────────────────────────
function step(dt) {
  T += tutorial ? 0 : dt;
  if (state === 'play') spawnTick(dt);
  for (const m of moles) {
    m.t += dt;
    if (m.phase === 'rise') { m.y = Math.max(0, 1 - m.t / 0.12); if (m.y === 0) { m.phase = 'up'; m.t = 0; } }
    else if (m.phase === 'up' && m.t >= m.up) {
      m.phase = 'down'; m.t = 0;
      if (m.kind === 'good') {                                  // left alone: your news is safe
        popText(rx(m.spot.x), moleRect(m).y, m.good.t, 'good');
        if (tutWait && tutWait.id === 'spare' && !tutWait.again) tutWait.done = true;
        if (tutWait && tutWait.id === 'spare') tutWait.again = false;
      } else {                                                  // he finished his line: your news is ruined
        combo = 0; say(pickNo(LINES.ruin, 'ruin'), 2, true); play('break', .4);
        if (!tutorial) loseHeart();
        hud();
      }
    } else if (m.phase === 'hit' && m.t >= 0.32) { m.phase = 'down'; m.t = 0; }
    else if (m.phase === 'down') m.y = Math.min(1, m.t / 0.14);
  }
  for (let i = moles.length - 1; i >= 0; i--) if (moles[i].phase === 'down' && moles[i].y >= 1) moles.splice(i, 1);
  if (swing.t > 0) swing.t -= dt;
  if (tutorial) tutSpawn();
}

// ───────────────────────── drawing ─────────────────────────
function drawMole(m, now) {
  const r = moleRect(m); if (!ok(r.im)) return;
  ctx.save(); ctx.beginPath();
  const s = m.spot;
  if (s.clip) ctx.rect(rx(s.clip[0]), ry(s.clip[1]), (s.clip[2] - s.clip[0]) * L.k, r.clipY - ry(s.clip[1]));
  else ctx.rect(0, 0, W, r.clipY);
  ctx.clip();
  const shake = m.phase === 'hit' ? Math.sin(now * 70) * 3 : 0;
  const squash = m.phase === 'hit' ? 0.94 : 1;
  ctx.translate(r.x + r.w / 2 + shake, r.y + r.h); ctx.scale(1, squash);
  if (m.kind === 'good') { ctx.shadowColor = '#facc15'; ctx.shadowBlur = 18; }
  ctx.drawImage(r.im, -r.w / 2, -r.h, r.w, r.h);
  ctx.restore();
  // a ring that runs out = how long until he finishes his line
  if (m.kind !== 'good' && m.phase === 'up') {
    const left = 1 - m.t / m.up, cx = r.x + r.w * 0.82, cy = r.y + r.h * 0.12, R = Math.max(10, r.w * 0.07);
    ctx.save(); ctx.lineWidth = 5; ctx.strokeStyle = '#ffffffaa'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = left < 0.35 ? '#ef4444' : '#facc15'; ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); ctx.stroke(); ctx.restore();
  }
}
function draw(now) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#efd9b8'); g.addColorStop(1, '#e2bf93');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (ok(IMG.bg)) ctx.drawImage(IMG.bg, L.x0, L.y0, ROOM.w * L.k, ROOM.h * L.k);
  // the window and the sofa back are behind the arms and the basket: draw the far ones first
  const order = ['win', 'bL', 'bM', 'bR', 'aL', 'aR', 'tbl', 'bas', 'chr'];
  for (const id of order) for (const m of moles) if (m.spot.id === id) drawMole(m, now);
  if (swing.t > 0 && ok(IMG.news)) {                               // the newspaper comes down
    const p = 1 - swing.t / 0.2, a = -0.9 + p * 1.3, sz = Math.min(170, W * 0.36);
    ctx.save(); ctx.translate(swing.x + sz * 0.15, swing.y + sz * 0.05); ctx.rotate(a);
    ctx.drawImage(IMG.news, -sz * 0.1, -sz * 0.9, sz, sz); ctx.restore();
  }
}

// ───────────────────────── HUD + screens ─────────────────────────
function hud() {
  $('hearts').textContent = '❤️'.repeat(Math.max(0, hearts)) + '🤍'.repeat(Math.max(0, 3 - hearts));
  $('scoreTxt').textContent = score;
  const mult = Math.min(4, 1 + Math.floor(combo / 5));
  $('combo').textContent = combo >= 3 ? `רצף ${combo}${mult > 1 ? ' ×' + mult : ''}` : '';
}
function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id)); }
function showHUD(on) { $('hud').classList.toggle('on', on); $('strip').classList.toggle('on', on); $('chip').classList.toggle('on', on); }
function bestNum() { return +(store.get(KEY.best) || 0); }
function showBest() {
  const b = bestNum(), d = (store.get(KEY.day) || '').split('|');
  const td = d[0] === today() ? +d[1] : 0;
  $('bestStart').innerHTML = b ? `השיא שלכם: <b>${b}</b>` + (td ? ` · היום: <b>${td}</b>` : '') : 'כמה זמן תחזיקו מול אסף?';
  $('bestOver').innerHTML = b ? `השיא שלכם: <b>${b}</b>` : '';
}
function gameOver() {
  state = 'over'; play('over', .7); say('אתה כזה טמבל.', 3, true);
  window.track && window.track('game_over', 'sofa'); window.VerseFrame && VerseFrame.score(score);   // the verse's daily records
  const b = bestNum(), rec = score > b;
  if (rec) store.set(KEY.best, score);
  const d = (store.get(KEY.day) || '').split('|');
  if (d[0] !== today() || score > +d[1]) store.set(KEY.day, `${today()}|${score}`);
  setTimeout(() => {
    fxEl.innerHTML = ''; showHUD(false); moles.length = 0;
    $('overScore').innerHTML = `${score}<small>נקודות · ${hits} מכות · רצף ${bestCombo}</small>`;
    $('overLine').textContent = score >= 600 ? '״וואלה... לא רע. בטח היה לך מזל.״' : score >= 250 ? '״כמה? ברוטו? בטח לא מהיום הראשון.״' : '״מה אני אגיד לך? ביאסת את התחת היום.״';
    $('overRec').innerHTML = rec && score ? '<span class="newrec">שיא חדש!</span>' : '';
    showBest(); show('over');
  }, 1500);
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
$('quitBtn').onclick = () => { paused = false; SND.ctx && SND.ctx.resume(); state = 'menu'; moles.length = 0; tut.end(true); showHUD(false); showBest(); show('start'); };
addEventListener('pagehide', () => { if (SND.ctx) SND.ctx.suspend(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (state === 'play') pause(true); else if (SND.ctx) SND.ctx.suspend(); } });
document.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => SND.ctx && SND.ctx.suspend()));

// ───────────────────────── tutorial ─────────────────────────
const tutCard = $('tutCard'), tutHole = $('tutHole');
let tutWait = null;
const spotRoom = () => ({ x: Math.max(4, L.x0 + 4), y: L.y0 + 4, w: Math.min(W - 8, ROOM.w * L.k - 8), h: ROOM.h * L.k * 0.6 });
const spotEl = (id) => () => { const r = $(id).getBoundingClientRect(); return { x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 }; };
const STEPS = [
  { text: 'זה הסלון של <b>אסף</b>, החבר המאוס. הוא תמיד על הספה – ומוצא את הבעיה בכל בשורה טובה שלכם.', spot: spotRoom },
  { text: '<b>המטרה:</b> כשהוא קופץ – <b>הקישו עליו</b> עם העיתון לפני שהוא גומר את המשפט. כל מכה = נקודות.', spot: spotEl('scoreBox') },
  { text: 'אלה <b>הלבבות</b>. אסף הספיק להגיד את שלו? נשבר לב. שלושה – ונגמר. הטבעת ליד הראש שלו = כמה זמן נשאר.', spot: spotEl('hearts') },
  { text: 'נסו עכשיו: אסף קופץ מאחורי הספה – <b>הקישו עליו!</b>', try: 'hit', spawn: 'asaf' },
  { text: 'גם <b>הבשורות הטובות</b> שלכם קופצות: עוגה, טבעת, מפתחות לאוטו... <b>אל תרביצו להן!</b> מכה בבשורה = לב נשבר.' },
  { text: 'נסו: <b>אל תיגעו</b> בבשורה – תנו לה לרדת לבד.', try: 'spare', spawn: 'good' },
  { text: 'אסף עם <b>טלפון</b>? הוא שולח לכם 20 רילס. עליו צריך <b>שתי מכות</b>. ומכה בריק שוברת את הרצף.' },
  { text: 'מכות ברצף מכפילות את הנקודות, ו-12 ברצף מחזירות לב. וככל שעובר הזמן – הוא קופץ מהר יותר. מוכנים?', spot: spotEl('scoreBox'), last: true },
];
function tutSpawn() {
  const s = STEPS[tut.i]; if (!s || !s.spawn || !tutWait || tutWait.done) return;
  if (moles.length) return;
  if (tutWait.pause > 0) { tutWait.pause -= 1 / 60; return; }
  spawn(s.spawn, SPOTS[s.spawn === 'good' ? 6 : 2], s.spawn === 'good' ? 2.2 : 5);
  tutWait.pause = 0.6;
}
const tut = {
  on: false, i: 0,
  begin() {
    show(null); showHUD(true); state = 'tut'; tutorial = true; this.on = true; this.i = 0;
    score = 0; hearts = 3; combo = 0; hits = 0; T = 0; moles.length = 0; hud();
    say('מה? עוד פעם אתה? יאללה.', 2.5);
    tutCard.classList.add('on'); this.enter();
  },
  enter() {
    const s = STEPS[this.i];
    tutWait = s.try ? { id: s.try, done: false, pause: 0.4 } : null;
    $('tutText').innerHTML = s.text;
    $('tutCount').textContent = `${this.i + 1} / ${STEPS.length}`;
    $('tutBar').firstElementChild.style.width = ((this.i + 1) / STEPS.length * 100) + '%';
    $('tutNext').innerHTML = (s.last ? 'שחקו!' : 'הבא') + ' <span class="keyhint">(רווח)</span>';
  },
  next() {
    if (tutWait && !tutWait.done) return;
    play('pop', .4);
    if (++this.i >= STEPS.length) return this.end();
    this.enter();
  },
  end(quiet) {
    this.on = false; tutWait = null; tutCard.classList.remove('on'); $('tutDim').classList.remove('on');
    store.set(KEY.tut, '1'); tutorial = false; moles.length = 0;
    if (!quiet) startGame();
  },
  frame() {
    if (!this.on) return;
    const s = STEPS[this.i], sp = s.spot && s.spot();
    const dim = sp && !(tutWait && !tutWait.done);
    $('tutDim').classList.toggle('on', !!dim);
    if (dim) Object.assign(tutHole.style, { left: sp.x + 'px', top: sp.y + 'px', width: sp.w + 'px', height: sp.h + 'px' });
    // the card stays at the bottom, clear of the sofa
    tutCard.style.top = 'auto'; tutCard.style.bottom = `calc(env(safe-area-inset-bottom,0px) + 64px)`;
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
    const live = moles.filter((m) => m.phase === 'up' || m.phase === 'rise');
    if (live.some((m) => m.kind !== 'good')) t = '<em>הקישו</em> על אסף!';
    else if (live.some((m) => m.kind === 'good')) t = '<em>אל תיגעו</em> בבשורה';
    else t = 'חכו שהוא <em>יקפוץ</em>';
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
layout(); hud(); showBest(); requestAnimationFrame(frame);

// for the tests
window.SOFA = { get state() { return state; }, get score() { return score; }, get hearts() { return hearts; }, get combo() { return combo; }, get tut() { return tut.on; }, moles, moleRect, startGame, spawn, SPOTS, get L() { return L; } };
