// פילאי פלואים – a story chain: a small mishap on one end, a wonder on the other.
// Tap the middle cards in the order they happened, and see how the mishap itself led to the wonder.
'use strict';
const $ = (id) => document.getElementById(id);
const rnd = (a, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const KEY = { best: 'hani-games:pilai:best', bestTime: 'hani-games:pilai:bestTime', day: 'hani-games:pilai:day', tut: 'hani-games:pilai:tut', snd: 'hani-games:pilai:snd' };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} },
};
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const MID = 3;   // cards between the mishap and the wonder

// ───────────────────────── Hani ─────────────────────────
const haniEl = $('hani'), sayEl = $('say');
const POSES = ['calm', 'talk', 'surprised', 'chin']; const poseSrc = {};
for (const p of POSES) { const i = new Image(); i.src = poseSrc[p] = `assets/pose-${p}.png`; }
let haniPose = 'calm', faceT = 0, sayT = 0;
function setPose(n, hold = 0) {
  if (hold) faceT = hold;
  if (haniPose === n) return;
  haniPose = n; haniEl.src = poseSrc[n];
  haniEl.classList.remove('pop'); void haniEl.offsetWidth; haniEl.classList.add('pop');
}
function say(text, dur = 3) { sayEl.textContent = text; sayEl.classList.add('on'); sayT = dur; if (faceT <= 0) setPose('talk'); }
const LINES = {
  wrong: ['הממ... מה קרה קודם?', 'לא בדיוק. מה בא עכשיו?', 'רגע, תחשבו – מה קרה אחר כך?', 'כמעט! מה היה לפני זה?'],
  wonder: ['פילאי פלואים! איך אברהם משה אומר.', 'את קולטת?! הכל היה לטובה!', 'וואו, איזו השגחה פרטית!', 'גם זו לטובה! פילאי פלואים!'],
  over: ['רואים? כל צרה קטנה – בסוף נס גדול.', 'ברוך השם, פילאי פלואים!', 'הכל לטובה, תמיד. עוד פעם?', 'בשורות טובות, ישועות ונחמות!'],
};

// ───────────────────────── effects ─────────────────────────
const fxEl = $('fx');
function sparks(x, y, n = 14, color) {
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div'); s.className = 'spark'; s.style.left = x + 'px'; s.style.top = y + 'px'; if (color) s.style.background = color; fxEl.appendChild(s);
    const a = rnd(Math.PI * 2), r = rnd(30, 100);
    s.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * r}px,${Math.sin(a) * r}px) scale(.2)`, opacity: 0 }], { duration: rnd(450, 850), easing: 'ease-out' }).onfinish = () => s.remove();
  }
}
function banner(text, small) {
  const b = document.createElement('div'); b.className = 'nin'; b.innerHTML = text + (small ? `<small>${small}</small>` : '');
  fxEl.appendChild(b); setTimeout(() => b.remove(), 2200);
}
const mid = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

// ───────────────────────── sound ─────────────────────────
const SND = { ctx: null, raw: {}, buf: {}, on: store.get(KEY.snd) !== '0', last: {}, master: null, music: null };
const OWN = ['good-1', 'good-2', 'good-3', 'good-4', 'place-1', 'place-2', 'wrong-1', 'wrong-2', 'nin', 'wonder', 'over', 'click', 'whoosh'];
// Hani's own sounds live once on the site (/hani-games/sounds/); a local copy sits in ../hani-sounds/
const HS_BASE = window.HS_BASE || (location.pathname.includes('/hani-games/') ? '/hani-games/sounds/' : '../hani-sounds/');
const HS = ['niggun-freilach'];
const SFX = [...OWN, ...HS];
for (const n of SFX) fetch(OWN.includes(n) ? `assets/snd/${n}.mp3` : HS_BASE + n + '.mp3').then((r) => r.ok ? r.arrayBuffer() : null).then((b) => { if (b) { SND.raw[n] = b; decode(n); } }).catch(() => {});
function decode(n) {
  if (!SND.ctx || !SND.raw[n] || SND.buf[n]) return;
  const b = SND.raw[n]; SND.raw[n] = null;
  SND.ctx.decodeAudioData(b).then((x) => { SND.buf[n] = x; if (n === 'niggun-freilach') startMusic(); }).catch(() => {});
}
function audioUnlock() {
  if (SND.ctx) { if (SND.ctx.state === 'suspended' && !paused) SND.ctx.resume(); return; }
  try { SND.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  SND.master = SND.ctx.createGain(); SND.master.gain.value = SND.on ? 1 : 0; SND.master.connect(SND.ctx.destination);
  for (const n of SFX) decode(n);
}
// a name plays one of its variants (good → good-1..4), never the same one twice in a row
function play(name, vol = 1) {
  if (!SND.ctx) return;
  const vars = SFX.filter((n) => n === name || n.startsWith(name + '-')).filter((n) => SND.buf[n]);
  if (!vars.length) return;
  let n = pick(vars);
  if (vars.length > 1 && n === SND.last[name]) n = vars[(vars.indexOf(n) + 1) % vars.length];
  SND.last[name] = n;
  const src = SND.ctx.createBufferSource(), gn = SND.ctx.createGain();
  src.buffer = SND.buf[n]; src.playbackRate.value = rnd(.96, 1.04); gn.gain.value = vol;
  src.connect(gn).connect(SND.master); src.start();
}
function startMusic() {
  if (SND.music || !SND.buf['niggun-freilach']) return;
  const src = SND.ctx.createBufferSource(), gn = SND.ctx.createGain();
  src.buffer = SND.buf['niggun-freilach']; src.loop = true; gn.gain.value = .2;
  src.connect(gn).connect(SND.master); src.start(); SND.music = src;
}
const ICON_ON = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l6 6M22 9l-6 6" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>';
function drawSnd() { document.querySelectorAll('.sndBtn').forEach((b) => b.innerHTML = SND.on ? ICON_ON : ICON_OFF); }
document.querySelectorAll('.sndBtn').forEach((b) => b.addEventListener('click', () => {
  SND.on = !SND.on; store.set(KEY.snd, SND.on ? '1' : '0'); audioUnlock();
  if (SND.master) SND.master.gain.value = SND.on ? 1 : 0; drawSnd();
}));
drawSnd();
addEventListener('pointerdown', audioUnlock, { capture: true });
addEventListener('keydown', audioUnlock, { capture: true });

// ───────────────────────── layout ─────────────────────────
function layout() {
  const W = innerWidth, H = innerHeight, tall = H > W * 1.15;
  const strip = Math.round(clamp(H * .11, 70, 96)); document.documentElement.style.setProperty('--strip', strip + 'px');
  document.body.classList.toggle('tall', tall);
  const TH = H - 58 - strip - 10, R = document.documentElement.style;
  // a phone on its side: the chain doesn't fit - ask to turn it upright
  document.body.classList.toggle('turn', !tall && H < 470 && W < 1000);
  if (tall) {
    const hw = Math.min((W - 40) / 3, 140, TH * .3), handH = hw + 75;
    let gap = clamp(H * .03, 10, 30), arrows = 4 * 17;
    let rowh = (TH - 28 - handH - 2 * gap - arrows) / 5 - 2;
    const tiny = rowh < 50; document.body.classList.toggle('tiny', tiny);   // a small phone: no arrows, tighter gaps
    if (tiny) { gap = 6; rowh = (TH - 28 - handH - 2 * gap) / 5 - 3; }
    R.setProperty('--hw', hw + 'px'); R.setProperty('--fs', '13px'); R.setProperty('--gap', gap + 'px');
    R.setProperty('--rowh', clamp(rowh, 38, 96) + 'px');
  } else {
    const fs = clamp(W / 80, 13, 17), cw = Math.min(210, (W - 30 - 4 * 32) / 5, (TH - 150 - fs * 6) / 1.95);
    R.setProperty('--cw', cw + 'px'); R.setProperty('--hw', cw * .95 + 'px'); R.setProperty('--fs', fs + 'px');
  }
  fitSlots();
}
// an empty slot is exactly as tall as a card next to it
function fitSlots() {
  const c = document.querySelector('#chain .card'); if (!c) return;
  document.querySelectorAll('#chain .slot').forEach((s) => { s.style.height = c.offsetHeight + 'px'; });
}
addEventListener('resize', layout);

// ───────────────────────── cards ─────────────────────────
function cardEl(c, cls = '', tag = '') {
  const d = document.createElement('div'); d.className = 'card ' + cls;
  d.innerHTML = (tag ? `<span class="tag">${tag}</span>` : '') + `<img src="assets/cards/${c.img}.jpg" alt=""><p>${c.t}</p>`;
  return d;
}
const arrow = () => { const a = document.createElement('span'); a.className = 'arrow'; a.textContent = '←'; return a; };
// a card flies from where it was tapped into its slot
function fly(from, toEl, done) {
  const a = from.getBoundingClientRect(), b = toEl.getBoundingClientRect();
  const f = from.cloneNode(true); f.classList.add('flycard'); f.classList.remove('shake');
  Object.assign(f.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px', margin: 0 });
  document.body.appendChild(f); toEl.style.visibility = 'hidden'; from.style.visibility = 'hidden';
  requestAnimationFrame(() => requestAnimationFrame(() => Object.assign(f.style, { left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px', opacity: .95 })));
  setTimeout(() => { f.remove(); toEl.style.visibility = ''; from.remove(); done && done(); }, 470);
}

// ───────────────────────── game state ─────────────────────────
let STORIES = [];
let state = 'menu', paused = false;
let order = [], si = 0, story = null, placed = 0, mistakes = 0, stars = 0, t0 = 0, busy = false;
function renderStory() {
  const C = story.cards, chain = $('chain'), hand = $('hand');
  chain.innerHTML = ''; hand.innerHTML = ''; hand.hidden = false; $('nextBtn').hidden = true; $('ask').textContent = 'מה קרה אחר כך?';
  chain.append(cardEl(C[0], 'start', 'מתחילים'), arrow());
  for (let i = 1; i <= MID; i++) { const s = document.createElement('div'); s.className = 'slot'; s.dataset.i = i; s.textContent = '?'; chain.append(s, arrow()); }
  chain.append(cardEl(C[C.length - 1], 'end', 'פילאי פלואים!'));
  // the middle cards, never already in the right order
  let mix; do { mix = shuffle([1, 2, 3]); } while (mix.every((v, k) => v === k + 1));
  for (const i of mix) { const el = cardEl(C[i]); el.dataset.i = i; el.style.transform = `rotate(${rnd(-4, 4).toFixed(1)}deg)`; el.onclick = () => choose(el); hand.append(el); }
  placed = 0; mistakes = 0; markNext();
  requestAnimationFrame(fitSlots); setTimeout(fitSlots, 300);
  [...document.querySelectorAll('#table img')].forEach((im) => im.addEventListener('load', fitSlots, { once: true }));
}
function markNext() { document.querySelectorAll('#chain .slot').forEach((s) => s.classList.toggle('next', +s.dataset.i === placed + 1)); }
function choose(el) {
  if (busy || paused || (state !== 'play' && state !== 'tut')) return;
  const i = +el.dataset.i;
  if (i === placed + 1) {
    busy = true; placed++;
    const slot = document.querySelector(`#chain .slot[data-i="${i}"]`), real = cardEl(story.cards[i], 'lit');
    slot.replaceWith(real);
    play('place', .7);
    fly(el, real, () => {
      busy = false; const m = mid(real); sparks(m.x, m.y, 10, '#b8f5d0'); play('good', .6);
      say('ואז... ' + story.cards[i].t.replace(/^אז /, ''), 3);
      if (placed >= MID) storyDone(); else markNext();
      if (tutWait && tutWait.id === 'pick') tutWait.done = true;
    });
  } else {
    mistakes++; play('wrong', .6); setPose('chin', 1.4); say(pick(LINES.wrong), 2.2);
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  }
  hud();
}
function storyDone() {
  const got = mistakes === 0 ? 3 : mistakes === 1 ? 2 : 1;
  const end = document.querySelector('#chain .card.end'); end.classList.add('win');
  $('ask').textContent = 'ככה צרה קטנה הפכה לנס!';
  setTimeout(() => {
    const m = mid(end); for (let k = 0; k < 3; k++) setTimeout(() => sparks(m.x, m.y, 16, '#ffe27a'), k * 180);
    play('wonder', .8); if (got === 3) setTimeout(() => play('nin', .5), 500);
    banner('פילאי פלואים!', state === 'tut' ? '' : '★'.repeat(got));
    setPose('surprised', 2.6); say(story.cards[story.cards.length - 1].t + ' ' + pick(LINES.wonder), 3.4);
    if (state === 'play') { stars += got; prog(true); $('hand').hidden = true; $('nextBtn').hidden = false; $('nextBtn').textContent = si + 1 < order.length ? 'לסיפור הבא' : 'לסיכום'; }
    if (state === 'tut' && tutWait && tutWait.id === 'finish') tutWait.done = true;
    hud();
  }, 350);
}
function nextStory() {
  if (state !== 'play' || $('nextBtn').hidden) return;
  play('click');
  si++; if (si >= order.length) { gameOver(); return; }
  story = order[si]; renderStory(); prog(); play('whoosh', .6); introSay();
}
const introSay = () => say(story.cards[0].t + ' איך זה נגמר בנס?', 3.2);

// ───────────────────────── HUD / screens ─────────────────────────
function hud() { $('starTxt').textContent = stars; }
function prog(doneNow) {
  const p = $('prog'); if (p.children.length !== order.length) p.innerHTML = order.map(() => '<i></i>').join('');
  [...p.children].forEach((d, k) => { d.classList.toggle('on', k < si || (k === si && doneNow)); d.classList.toggle('now', k === si && !doneNow); });
}
const parseRec = (s) => { const [a, b] = (s || '').split('|'); return { stars: +a || 0, time: +b || 0 }; };
const better = (a, b) => a.stars > b.stars || (a.stars === b.stars && a.stars > 0 && (b.time === 0 || a.time < b.time));
const best = () => ({ stars: +store.get(KEY.best) || 0, time: +store.get(KEY.bestTime) || 0 });   // the games page reads the stars as a plain number
const dayBest = () => { const [d, ...r] = (store.get(KEY.day) || '').split('|'); return d === today() ? parseRec(r.join('|')) : { stars: 0, time: 0 }; };
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
function showBest() {
  const b = best(), d = dayBest();
  $('bestStart').innerHTML = b.stars ? `השיא שלך: <b>${b.stars}★</b> (${fmtT(b.time)})${d.stars ? `<br>השיא של היום: <b>${d.stars}★</b>` : ''}` : '';
}
function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id)); }
function playing(on) { $('hud').classList.toggle('on', on); $('strip').classList.toggle('on', on); $('table').classList.toggle('on', on); if (on) layout(); }
function startGame() {
  order = shuffle(STORIES.slice()); si = 0; stars = 0; t0 = performance.now();
  state = 'play'; show(null); playing(true); story = order[0]; renderStory(); prog(); hud();
  window.track && track('game_start', 'pilai');
  play('whoosh', .6); introSay();
}
function gameOver() {
  state = 'over'; window.track && track('game_over', 'pilai'); fxEl.innerHTML = '';
  play('over', .8);
  const time = Math.round((performance.now() - t0) / 1000), me = { stars, time };
  const prev = best(), rec = better(me, prev), dPrev = dayBest(), dRec = better(me, dPrev);
  if (rec) { store.set(KEY.best, stars); store.set(KEY.bestTime, time); }
  if (dRec) store.set(KEY.day, today() + '|' + stars + '|' + time);
  playing(false);
  $('overScore').textContent = `${stars} / ${order.length * 3} ★`;
  $('overLine').textContent = '״' + pick(LINES.over) + '״';
  $('overRec').innerHTML = rec ? '<span class="newrec">שיא חדש!</span>' : dRec ? '<span class="newrec">שיא של היום!</span>' : '';
  const b = rec ? me : prev, d = dRec ? me : dPrev;
  $('bestOver').innerHTML = `זמן: <b>${fmtT(time)}</b><br>השיא שלך: <b>${b.stars}★</b> (${fmtT(b.time)}) · השיא של היום: <b>${d.stars}★</b>`;
  show('over');
}
function pause(on) {
  if (state !== 'play' && state !== 'tut') return;
  if (on === paused) return;
  paused = on;
  if (on) { show('paused'); SND.ctx && SND.ctx.suspend(); }
  else { show(null); SND.ctx && SND.ctx.resume(); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(true); hush(); } });
// leaving for the site: phones keep the page alive in the back cache, so the sound must stop by itself
function hush() { try { SND.ctx && SND.ctx.suspend(); } catch (e) {} }
addEventListener('pagehide', hush);
document.querySelectorAll('a[href]').forEach((a) => a.addEventListener('click', hush));
addEventListener('pageshow', (e) => { if (e.persisted && (state === 'play' || state === 'tut')) pause(true); });
$('pauseBtn').onclick = () => { play('click'); pause(true); };
$('resumeBtn').onclick = () => { play('click'); pause(false); };
$('quitBtn').onclick = () => { paused = false; SND.ctx && SND.ctx.resume(); state = 'menu'; playing(false); tut.end(true); showBest(); show('start'); };
$('playBtn').onclick = () => { play('click'); if (!store.get(KEY.tut)) tut.begin(); else startGame(); };
$('howBtn').onclick = () => { play('click'); tut.begin(); };
$('againBtn').onclick = () => { play('click'); startGame(); };
$('nextBtn').onclick = nextStory;
addEventListener('keydown', (e) => {
  if (tut.on) return;
  if (e.key === 'Escape' && state === 'play') pause(!paused);
  if ((e.key === ' ' || e.key === 'Enter') && paused) { e.preventDefault(); pause(false); return; }
  if ((e.key === ' ' || e.key === 'Enter') && state === 'menu' && $('start').classList.contains('on')) { e.preventDefault(); $('playBtn').click(); }
  else if ((e.key === ' ' || e.key === 'Enter') && state === 'over') { e.preventDefault(); startGame(); }
  else if ((e.key === ' ' || e.key === 'Enter') && state === 'play') { e.preventDefault(); nextStory(); }
  // 1 / 2 / 3: the hand's cards from the right
  if (/^[1-3]$/.test(e.key) && state === 'play') { const c = $('hand').children[+e.key - 1]; if (c) choose(c); }
});

// ───────────────────────── tutorial ─────────────────────────
const tutCard = $('tutCard'), tutHole = $('tutHole');
let tutWait = null;
const elSpot = (sel) => () => { const els = [...document.querySelectorAll(sel)]; if (!els.length) return null; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const el of els) { const r = el.getBoundingClientRect(); x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); } return { x: x0 - 8, y: y0 - 8, w: x1 - x0 + 16, h: y1 - y0 + 16 }; };
const STEPS = [
  { text: 'כל סיפור מתחיל ב<b>צרה קטנה</b>. כאן: <b>האוטובוס איחר...</b>', spot: elSpot('#chain .card.start') },
  { text: '...ונגמר ב<b>נס</b>! אבל איך צרה כזאת הפכה לנס? את זה אתם מגלים.', spot: elSpot('#chain .card.end') },
  { text: 'אלה הקלפים של האמצע. <b>הקישו על מה שקרה אחר כך</b> – והוא נכנס למקום המסומן. <span class="keyhint">(במחשב: גם 1, 2, 3)</span>', try: 'pick', spot: elSpot('#hand .card, #chain .slot.next') },
  { text: 'טעיתם? הקלף רק רועד, ומנסים שוב. סיפור <b>בלי טעויות = 3 כוכבים</b>.', spot: elSpot('#stars') },
  { text: '<b>השלימו את הסיפור</b> עד הנס!', try: 'finish', spot: elSpot('#hand .card, #chain .slot') },
  { text: '6 סיפורים, ובכל אחד – צרה קטנה שהופכת לנס. כמה כוכבים תאספו? <b>בהצלחה!</b>', last: true },
];
const tut = {
  on: false, i: 0,
  step() { return STEPS[this.i] || {}; },
  begin() {
    state = 'tut'; this.on = true; this.i = 0; stars = 0; order = STORIES.slice(); si = 0;
    show(null); playing(true); story = STORIES.find((s) => s.id === 'bus') || STORIES[0]; renderStory(); $('prog').innerHTML = ''; hud();
    tutCard.classList.add('on'); this.enter(); introSay();
  },
  enter() {
    const s = this.step();
    tutWait = null;
    if (s.try === 'pick') tutWait = { id: 'pick', done: placed > 0 };
    if (s.try === 'finish') tutWait = { id: 'finish', done: placed >= MID };
    $('tutText').innerHTML = s.text;
    $('tutCount').textContent = `${this.i + 1} / ${STEPS.length}`;
    $('tutBar').firstElementChild.style.width = ((this.i + 1) / STEPS.length * 100) + '%';
    $('tutNext').innerHTML = (s.last ? 'שחקו!' : 'הבא') + ' <span class="keyhint">(רווח)</span>';
  },
  next() {
    const s = this.step();
    if (tutWait && !tutWait.done) return;
    play('click');
    if (s.last) { this.end(); return; }
    this.i++; this.enter();
  },
  end(silent) {
    if (!this.on) return;
    this.on = false; tutWait = null; tutCard.classList.remove('on'); $('tutDim').classList.remove('on');
    store.set(KEY.tut, '1');
    if (!silent) startGame();
  },
  frame() {
    if (!this.on) return;
    const s = this.step(), sp = s.spot ? s.spot() : null;
    // while the player must tap a card, the cards stay bright and tappable: no dimming then
    const dim = sp && !(tutWait && !tutWait.done);
    $('tutDim').classList.toggle('on', !!dim);
    if (dim) Object.assign(tutHole.style, { left: sp.x + 'px', top: sp.y + 'px', width: sp.w + 'px', height: sp.h + 'px' });
    const H = innerHeight, low = sp ? sp.y + sp.h / 2 > H * .5 : false;
    tutCard.style.top = low ? `calc(var(--safe-t) + 60px)` : 'auto';
    tutCard.style.bottom = low ? 'auto' : `calc(var(--safe-b) + var(--strip) + 10px)`;
    if (tutWait && tutWait.done && !tutWait.shown) { tutWait.shown = true; $('tutText').innerHTML = s.text + ' <span class="ok">יופי!</span>'; }
    $('tutNext').disabled = !!(tutWait && !tutWait.done);
  },
};
$('tutNext').onclick = () => tut.next();
$('tutSkip').onclick = () => { play('click'); tut.end(); };
addEventListener('keydown', (e) => {
  if (!tut.on || paused) return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tut.next(); }
  if (e.key === 'Escape') tut.end();
  if (/^[1-3]$/.test(e.key)) { const c = $('hand').children[+e.key - 1]; if (c) choose(c); }
});

// ───────────────────────── loop ─────────────────────────
let lastT = performance.now();
function frame(t) {
  const dt = Math.min(.05, (t - lastT) / 1000); lastT = t;
  if (!paused) {
    if (sayT > 0) { sayT -= dt; if (sayT <= 0) sayEl.classList.remove('on'); }
    if (faceT > 0) faceT -= dt; else if (sayT <= 0 && haniPose !== 'calm') setPose('calm');
    tut.frame();
  }
  requestAnimationFrame(frame);
}

// ───────────────────────── boot ─────────────────────────
fetch('assets/stories.json', { cache: 'no-store' }).then((r) => r.json()).then((j) => {
  STORIES = j; layout(); showBest(); requestAnimationFrame(frame);
  for (const s of STORIES) for (const c of s.cards) { const i = new Image(); i.src = `assets/cards/${c.img}.jpg`; }
}).catch(() => { $('bestStart').textContent = 'לא הצלחנו לטעון. נסו לרענן.'; });

// for the tests
window.PILAI = { get state() { return state; }, get story() { return story; }, get placed() { return placed; }, get stars() { return stars; }, get si() { return si; }, tut, startGame };
