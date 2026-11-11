// התרופות של שמונה - Lola fits Savta's 8 pm medicines. One game, three modes on the same pills:
//   box  = Block-Blast pill organizer (a bigger pill takes more cells; full row / day clears)
//   sort = Ball-Sort pill bottles (one medicine per bottle)
//   tray = match-3 tray (fill Savta's order in so many moves)
'use strict';
const SLUG = 'pills';
const $ = (s) => document.querySelector(s);
const store = {
  get(k) { try { return localStorage.getItem('shlomiverse:' + SLUG + ':' + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('shlomiverse:' + SLUG + ':' + k, String(v)); } catch (e) {} },
};
const DAY = (() => { const d = new Date(Date.now() + 2 * 3600e3); return d.toISOString().slice(0, 10); })();
function rng(seed) { let h = 1779033703 ^ seed.length; for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
const wait = (ms) => new Promise((res) => setTimeout(res, ms));

// ---------- the medicines (real generics, their real look) ----------
// len = cells a pill takes in the pill box; real = its real size (0..1) for drawing
const MEDS = [
  { id: 'aspirin', he: 'מיקרופירין', len: 1, real: .42, col: '#ffffff', say: 'מיקרופירין, אמא. הקטן הלבן.' },
  { id: 'bisoprolol', he: 'קונקור', len: 1, real: .5, col: '#f5d54a', say: 'קונקור – הלב הצהוב.' },
  { id: 'warfarin', he: 'קומדין', len: 1, real: .55, col: '#f3a07e', say: 'קומדין, האפרסקי. כמו תמיד.' },
  { id: 'omeprazole', he: 'אומפרדקס', len: 2, real: .8, col: '#b04fd0', say: 'אומפרדקס – הקפסולה הסגולה-ורודה.' },
  { id: 'metformin', he: "גלוקופאג'", len: 2, real: .88, col: '#f2f2f2', say: "גלוקופאג', הלבן הגדול. של הסוכר." },
  { id: 'atorvastatin', he: 'ליפיטור', len: 1, real: .68, col: '#eeeeee', say: 'ליפיטור, הסגלגל הלבן. של הכולסטרול.' },
  { id: 'calcium', he: 'קלציום D', len: 3, real: 1, col: '#efe6d2', say: 'קלציום. ענק, אני יודעת. בבקשה אמא.' },
  { id: 'vitd', he: 'ויטמין D3', len: 1, real: .42, col: '#f2c021', say: 'ויטמין D – הטיפה הצהובה.' },
  { id: 'omega3', he: 'אומגה 3', len: 2, real: .9, col: '#f09a12', say: 'אומגה 3, הזהב.' },
  { id: 'iron', he: 'פרו-גרדומט', len: 1, real: .6, col: '#b8321e', say: 'פרו-גרדומט, האדום. הברזל.' },
  { id: 'fusid', he: 'פוסיד', len: 1, real: .62, col: '#f4f4f4', say: 'פוסיד – זה של המים, אמא.' },
  { id: 'vaben', he: 'ואבן', len: 1, real: .5, col: '#9fbfe0', say: 'ואבן. רק בלילה, אמא.' },
];
const MED = Object.fromEntries(MEDS.map((m) => [m.id, m]));
const IMG = {};
function loadImg(src) { return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(i); i.src = src; }); }

// ---------- the characters' lines ----------
const L = {
  savtaSuspect: ['רגע. זאת התרופה שלי?', 'היא חושבת שאני לא יודעת.', 'את הוורוד הזה לא היה לי אתמול.', 'למה היא סופרת כל כך מהר?', 'אני סופרת אחריה. תדעו לכם.', 'מה זאת המוזיקה הזאתי? שוב הקופה?'],
  savtaWhisper: ['תזכרו את השיחה הזאתי.', 'אל תשתו מהכוס שלה.', 'אם אחות שלה תדרוך פה, אותי כבר לא תראו.', 'תכתבו על הקבר שלי: משוגעת.', 'גם בקופת חולים כבר מכירים אותה.'],
  savtaPleased: ['טוב... הפעם זה נראה בסדר.', 'תודה, לולה. בשמחה.', 'אנחנו אוהבים אורחים.', 'נו, יפה. אבל אני בודקת.'],
  lolaPlease: ['בבקשה אמא.', 'אמא, אני מכינה!', 'כבר מביאה לך.', 'אמא, זה אותו כדור כמו אתמול!', 'אמא, אני על הקו עם הקופה. מקום שבע.'],
  lolaWater: ['אמא, מים! אני מביאה!', 'הנה, אמא. עם מים.', 'Maybe she come? She wants to meet you.'],
  lolaOops: ['אופס... סליחה אמא.', 'רגע, רגע, אני מסדרת.'],
};
const ui = { savta: $('#savta'), lola: $('#lola'), bubble: $('#bubble') };
let sayT = 0, lastLine = '';
function say(who, pose, text, ms = 2600) {
  if (Array.isArray(text)) { let t; do t = pick(Math.random, text); while (t === lastLine && text.length > 1); text = t; }
  lastLine = text;
  ui[who].src = 'assets/' + who + '-' + pose + '.webp';
  ui.savta.classList.toggle('talk', who === 'savta'); ui.lola.classList.toggle('talk', who === 'lola');
  ui.bubble.className = who + (pose === 'whisper' ? ' whisper' : '');
  ui.bubble.textContent = text; G.talking = true;
  clearTimeout(sayT); sayT = setTimeout(() => { G.talking = false; ui.savta.classList.remove('talk'); ui.lola.classList.remove('talk'); tip(); }, ms);
}
let verbText = '';
function verb(t) { verbText = t || ''; if (!G.talking) tip(); }
function tip() {  // the instruction + the bulb button
  if (!verbText || !G.mode) { ui.bubble.className = 'quiet'; return; }
  ui.bubble.className = 'tip';
  ui.bubble.innerHTML = '<button id="bHint" class="pb" aria-label="רמז"><img src="assets/bulb.webp" alt=""></button><span></span>';
  ui.bubble.querySelector('span').textContent = verbText;
}
function showHint() {  // the hand shows a real move now
  if (!G.mode || G.over) return;
  G.lastInput = performance.now() - 60000; hint.h = null; hint.forced = true;
  const M = MODES[G.mode]; if (M.hint && !M.hint()) say('lola', 'oops', 'אמא, אין פה מהלך...');
  sfx('rattle', .3);
}
ui.bubble.addEventListener('click', (e) => { if (ui.bubble.classList.contains('tip')) showHint(); });
function flash(t) { const f = $('#flash'); f.textContent = t; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }

// ---------- sound ----------
const SND = { place: 3, rattle: 3, clear: 3, pop: 3, error: 1, win: 1, lose: 1, shake: 1, combo: 1, swap: 1, stamp: 2, print: 1, vanish: 4, cascade: 1 };
const audio = { ctx: null, buf: {}, last: {}, on: store.get('sound') !== '0' };
// iPhone (Safari and Chrome are both WebKit): leaving the page leaves the context 'suspended' or 'interrupted', and it
// only comes back from inside a tap - so every tap wakes it, plays one silent sample (WebKit's unlock), and if the
// context still will not run it is thrown away and built again (his bug, 11 Nov: no sound after returning to the page)
function audioWake() {
  const c = audio.ctx; if (!c) return audioInit();
  if (c.state === 'running') return;
  try { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) {}
  const p = c.resume(); const check = () => setTimeout(() => { if (audio.ctx === c && c.state !== 'running') audioRebuild(); }, 400);
  p && p.then ? p.then(check, check) : check();
}
function audioRebuild() {
  const old = audio.ctx; audio.ctx = null; audio.buf = {}; hold.src = null; hold.gain = null; hold.vo = null;
  try { old && old.close(); } catch (e) {}
  audioInit();
}
function audioInit() {
  if (audio.ctx) { if (audio.ctx.state !== 'running') audioWake(); return; }
  try { audio.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  for (const [n, k] of Object.entries(SND)) for (let i = 1; i <= k; i++) {
    const f = k > 1 ? n + i : n;
    fetch('assets/sfx/' + f + '.mp3').then((r) => r.arrayBuffer()).then((b) => audio.ctx.decodeAudioData(b)).then((d) => { (audio.buf[n] = audio.buf[n] || []).push(d); }).catch(() => {});
  }
  const get = (f) => fetch('assets/sfx/' + f + '.mp3').then((r) => r.arrayBuffer()).then((b) => audio.ctx.decodeAudioData(b));
  loadTrack();
  for (const id of VO) get('vo-' + id).then((d) => { audio.buf['vo-' + id] = [d]; if (id === 'hello' && !hold.said) { hold.said = 1; vo('hello'); } }).catch(() => {});
}
// the first touch anywhere opens the line: music + "שלום, הגעתם לקופת החולים"
for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) addEventListener(ev, () => audioWake(), { capture: true, passive: true });
// hold music = the whole game is "on hold with the kupa"; the menu voice ducks it
const VO = ['hello', 'wait', 'queue7', 'queue42', 'time', 'rec', 'star', 'menu', 'busy', 'bye'];
const hold = { src: null, gain: null, buf: null, vo: null, last: '', t: 0, said: 0, track: 0 };
const TRACKS = [['hold', 'פור אליזה'], ['hold2', 'ויוואלדי'], ['hold3', 'קלאסית בטלפון'], ['hold4', 'בוסה נובה']];
hold.track = Math.min(TRACKS.length - 1, Math.max(0, Number(store.get('music')) || 0));
function musicBtn() { const b = $('#bMusic b'); if (b) b.textContent = TRACKS[hold.track][1]; }
function loadTrack() {
  const i = hold.track;
  fetch('assets/sfx/' + TRACKS[i][0] + '.mp3').then((r) => r.arrayBuffer()).then((b) => audio.ctx.decodeAudioData(b)).then((d) => {
    if (hold.track !== i) return;
    if (hold.src) { try { hold.src.stop(); } catch (e) {} hold.src.disconnect(); hold.src = null; }
    hold.buf = d; holdStart();
  }).catch(() => {});
}
function nextTrack() {  // "לבחירת מוזיקת המתנה הקישו 9"
  hold.track = (hold.track + 1) % TRACKS.length; store.set('music', hold.track); musicBtn();
  if (!audio.on) { audio.on = true; store.set('sound', 1); soundBtn(); }
  if (audio.ctx) loadTrack(); else audioInit();
}
function holdStart() {
  if (!audio.ctx || !hold.buf || hold.src) return;
  hold.gain = audio.ctx.createGain(); hold.gain.gain.value = 0; hold.gain.connect(audio.ctx.destination);
  hold.src = audio.ctx.createBufferSource(); hold.src.buffer = hold.buf; hold.src.loop = true; hold.src.connect(hold.gain); hold.src.start();
  holdLevel();
}
function holdLevel() {
  if (!hold.gain) return;
  const v = !audio.on ? 0 : hold.vo ? .05 : .15, t = audio.ctx.currentTime;
  hold.gain.gain.cancelScheduledValues(t); hold.gain.gain.setTargetAtTime(v, t, .25);
}
function vo(id) {  // one menu line at a time, never the same twice in a row
  if (!audio.on || !audio.ctx || hold.vo) return false;
  if (Array.isArray(id)) { const c = id.filter((x) => x !== hold.last); id = c[Math.floor(Math.random() * c.length)]; }
  const b = audio.buf['vo-' + id]; if (!b) return false;
  const s = audio.ctx.createBufferSource(), g = audio.ctx.createGain(); g.gain.value = .95; s.buffer = b[0]; s.connect(g).connect(audio.ctx.destination);
  hold.vo = s; hold.last = id; holdLevel(); s.onended = () => { if (hold.vo === s) { hold.vo = null; holdLevel(); } }; s.start(.05 + audio.ctx.currentTime);
  return true;
}
function voStop() { if (hold.vo) { try { hold.vo.stop(); } catch (e) {} hold.vo = null; holdLevel(); } }
function voTick(now) {  // while playing: a menu announcement every 45-75 s
  if (!G.mode || G.over || G.tut || document.hidden) { hold.t = 0; return; }
  if (!hold.t) hold.t = now + 25000 + Math.random() * 15000;
  if (now > hold.t) { hold.t = now + 45000 + Math.random() * 30000; vo(['wait', 'queue7', 'queue42', 'time', 'rec', 'star']); }
}
function sfx(n, vol = .8, rate = 1) {
  if (!audio.on || !audio.ctx || !audio.buf[n]) return;
  const list = audio.buf[n]; let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === audio.last[n]) i = (i + 1) % list.length;
  audio.last[n] = i;
  const s = audio.ctx.createBufferSource(), g = audio.ctx.createGain(); g.gain.value = vol; s.buffer = list[i]; s.playbackRate.value = rate; s.connect(g).connect(audio.ctx.destination); s.start();
}
addEventListener('pagehide', () => { voStop(); audio.ctx && audio.ctx.suspend(); });
addEventListener('pageshow', (e) => { if (e.persisted && audio.ctx) audio.ctx.resume().catch(() => {}); });
document.addEventListener('visibilitychange', () => { if (!audio.ctx) return; if (document.hidden) { voStop(); audio.ctx.suspend(); } else audio.ctx.resume().catch(() => {}); });
function soundBtn() { $('#bSound').classList.toggle('off', !audio.on); }
$('#bMusic').onclick = nextTrack;
$('#bSound').onclick = () => { audio.on = !audio.on; store.set('sound', audio.on ? 1 : 0); soundBtn(); audioInit(); if (!audio.on) voStop(); holdLevel(); };

// ---------- canvas ----------
const cv = $('#cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() {
  const r = $('#stage').getBoundingClientRect(); DPR = Math.min(2.5, devicePixelRatio || 1);
  W = r.width; H = r.height; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  if (G.mode) MODES[G.mode].layout();
}
addEventListener('resize', () => setTimeout(resize, 50));

function drawPill(m, cx, cy, boxW, boxH, vertical, alpha = 1, scale = 1) {
  const im = IMG[m.id]; if (!im || !im.width) return;
  const bw = boxW, bh = boxH;  // boxW = along the pill; rotation stands it up
  const k = Math.min(bw / im.width, bh / im.height) * scale;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy); if (vertical) ctx.rotate(Math.PI / 2);
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
  ctx.drawImage(im, -im.width * k / 2, -im.height * k / 2, im.width * k, im.height * k);
  ctx.restore();
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

// sparkles
let parts = [];
function burst(x, y, col, n = 10) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 60 + Math.random() * 160; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: .6 + Math.random() * .3, t: 0, col, r: 2 + Math.random() * 3 }); } }
let pops = [];
function popText(x, y, t) { pops.push({ x, y, t: 0, txt: t }); }
function popName(x, y, id, pts) { pops.push({ x, y, t: 0, name: MED[id].he, col: MED[id].col, pts }); }
function nameChip(name, x, y, col, size, extra) {  // the pill's name in a highlighted chip (its colour on the edge); numbers drawn apart so RTL never scrambles them
  ctx.save(); ctx.textBaseline = 'middle';
  ctx.font = '900 ' + size + 'px Rubik, sans-serif'; const nw = ctx.measureText(name).width;
  const es = Math.round(size * 1.05); ctx.font = '900 ' + es + 'px Rubik, sans-serif'; const ew = extra ? ctx.measureText(extra).width + size * .5 : 0;
  const w = nw + ew + size * 1.3, h = size * 1.6; x = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, x));
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2; ctx.fillStyle = '#fffaf0'; rr(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.lineWidth = 3; ctx.strokeStyle = parseInt(col.slice(3, 5), 16) > 200 && parseInt(col.slice(5, 7), 16) > 200 ? '#8f6ac8' : col; ctx.stroke();
  const right = x + w / 2 - size * .65;
  ctx.font = '900 ' + size + 'px Rubik, sans-serif'; ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.fillStyle = '#3b2068'; ctx.fillText(name, right, y + 1);
  if (extra) { ctx.font = '900 ' + es + 'px Rubik, sans-serif'; ctx.direction = 'ltr'; ctx.textAlign = 'left'; ctx.fillStyle = '#d63a7a'; ctx.fillText(extra, x - w / 2 + size * .65, y + 1); }
  ctx.restore();
}
function drawFx(dt) {
  parts = parts.filter((p) => (p.t += dt) < p.life);
  for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.globalAlpha = 1;
  pops = pops.filter((p) => (p.t += dt * (p.name ? .6 : 1)) < 1);
  ctx.font = '900 22px Rubik, sans-serif'; ctx.textAlign = 'center'; ctx.direction = 'ltr';
  for (const p of pops) if (p.name) { ctx.globalAlpha = p.t > .7 ? (1 - p.t) / .3 : 1; nameChip(p.name, p.x, p.y - p.t * 34, p.col, 17, (p.pts ? '+' + p.pts : '') + (p.n ? '  ×' + p.n : '')); }
  ctx.font = '900 22px Rubik, sans-serif'; ctx.textAlign = 'center'; ctx.direction = 'ltr';
  for (const p of pops) { if (p.name) continue; ctx.globalAlpha = 1 - p.t; ctx.lineWidth = 4; ctx.strokeStyle = '#7a2448'; ctx.strokeText(p.txt, p.x, p.y - p.t * 40); ctx.fillStyle = '#fff'; ctx.fillText(p.txt, p.x, p.y - p.t * 40); }
  ctx.globalAlpha = 1;
}

// ---------- game state ----------
const G = { mode: null, score: 0, over: false, busy: false, tut: null, events: [] };
function emit(e) { G.events.push(e); idleReset(); if (G.tut) tutEvent(e); }
function setScore(n) { G.score = n; $('#score span').textContent = n; }
function addScore(n, x, y) { setScore(G.score + n); if (x != null) popText(x, y, '+' + n); }

// =====================================================================
// MODE 1: קופסת השבוע - Block Blast on a 7-day pill box
// =====================================================================
const BOX = { C: 7, R: 8 };
const SHAPES = (() => {
  const base = [
    { c: [[0, 0]], w: 4 }, { c: [[0, 0], [1, 0]], w: 6 }, { c: [[0, 0], [1, 0], [2, 0]], w: 5 }, { c: [[0, 0], [1, 0], [2, 0], [3, 0]], w: 3 },
    { c: [[0, 0], [1, 0], [0, 1], [1, 1]], w: 4 }, { c: [[0, 0], [0, 1], [1, 1]], w: 4 }, { c: [[0, 0], [0, 1], [0, 2], [1, 2]], w: 3 },
    { c: [[0, 0], [1, 0], [2, 0], [1, 1]], w: 2 }, { c: [[1, 0], [2, 0], [0, 1], [1, 1]], w: 2 }, { c: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]], w: 2 },
    { c: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]], w: 1 }, { c: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]], w: 1 },
  ];
  const out = [], seen = new Set();
  const norm = (c) => { const mx = Math.min(...c.map((p) => p[0])), my = Math.min(...c.map((p) => p[1])); return c.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]); };
  for (const b of base) {
    let c = b.c; const rots = [];
    for (let r = 0; r < 4; r++) { c = norm(c.map(([x, y]) => [-y, x])); rots.push(c); const m = norm(c.map(([x, y]) => [-x, y])); rots.push(m); }
    const uniq = rots.filter((c) => { const k = JSON.stringify(c); if (seen.has(k)) return false; seen.add(k); return true; });
    for (const c of uniq) out.push({ cells: c, w: b.w / uniq.length });
  }
  return out;
})();
// tile a shape with pills of length len (bars), or null
function tile(cells, len) {
  const set = new Set(cells.map(([x, y]) => x + ',' + y));
  const rec = () => {
    if (!set.size) return [];
    let best = null; for (const k of set) { const [x, y] = k.split(',').map(Number); if (!best || y < best[1] || (y === best[1] && x < best[0])) best = [x, y]; }
    const [x, y] = best;
    for (const dir of len === 1 ? ['h'] : ['h', 'v']) {
      const ks = []; for (let i = 0; i < len; i++) ks.push(dir === 'h' ? (x + i) + ',' + y : x + ',' + (y + i));
      if (ks.every((k) => set.has(k))) { ks.forEach((k) => set.delete(k)); const r = rec(); if (r) return [{ x, y, dir }, ...r]; ks.forEach((k) => set.add(k)); }
    }
    return null;
  };
  return rec();
}
const BOXMEDW = { 1: 6, 2: 3, 3: 1.4 };
function makePiece(r) {
  let tot = 0; for (const m of MEDS) tot += BOXMEDW[m.len];
  let x = r() * tot, med = MEDS[0]; for (const m of MEDS) { x -= BOXMEDW[m.len]; if (x <= 0) { med = m; break; } }
  const opts = SHAPES.map((s) => ({ s, t: tile(s.cells, med.len) })).filter((o) => o.t);
  let wt = opts.reduce((a, o) => a + o.s.w, 0), y = r() * wt, o = opts[0];
  for (const op of opts) { y -= op.s.w; if (y <= 0) { o = op; break; } }
  const w = Math.max(...o.s.cells.map((c) => c[0])) + 1, h = Math.max(...o.s.cells.map((c) => c[1])) + 1;
  return { med: med.id, cells: o.s.cells, pills: o.t, w, h };
}
const box = {
  grid: null, pills: null, nextId: 1, tray: [], r: null, drag: null, combo: 0, placed: 0, seen: {},
  start(tutorial) {
    this.grid = Array.from({ length: BOX.R }, () => Array(BOX.C).fill(0)); this.pills = {}; this.combo = 0; this.placed = 0; this.seen = {};
    this.r = rng(SLUG + '|box|' + DAY + '|' + (G.round || 0));
    if (tutorial) {
      // a row that is one pill short + a capsule that closes it
      const row = BOX.R - 1;
      for (let c = 0; c < BOX.C; c++) if (c !== 3 && c !== 4) this.put({ med: c % 2 ? 'aspirin' : 'warfarin', x: c, y: row, dir: 'h', len: 1 });
      this.put({ med: 'iron', x: 0, y: row - 1, dir: 'h', len: 1 });
      this.tray = [{ med: 'omeprazole', cells: [[0, 0], [1, 0]], pills: [{ x: 0, y: 0, dir: 'h' }], w: 2, h: 1 }, null, null];
    } else this.deal();
    $('#hudMid').innerHTML = '<div class="tile" id="boxDays"><small>ימים סגורים</small> <span>0</span></div>';
    this.days = 0;
    this.layout();
    verb('גררו כדורים לקופסה');
  },
  put(p) {
    const id = this.nextId++; this.pills[id] = p;
    for (let i = 0; i < p.len; i++) { const x = p.dir === 'h' ? p.x + i : p.x, y = p.dir === 'h' ? p.y : p.y + i; this.grid[y][x] = id; }
    p.born = performance.now();
  },
  fits(pc, gx, gy) { return pc.cells.every(([x, y]) => { const X = gx + x, Y = gy + y; return X >= 0 && Y >= 0 && X < BOX.C && Y < BOX.R && !this.grid[Y][X]; }); },
  canPlace(pc) { for (let y = 0; y < BOX.R; y++) for (let x = 0; x < BOX.C; x++) if (this.fits(pc, x, y)) return true; return false; },
  deal() {
    for (let tries = 0; tries < 30; tries++) {
      this.tray = [makePiece(this.r), makePiece(this.r), makePiece(this.r)];
      if (this.tray.some((p) => this.canPlace(p))) return;
    }
  },
  layout() {
    const trayH = Math.min(H * .2, 118), verbR = 10;
    const cell = Math.floor(Math.min((W - 16) / (BOX.C + .5), (H - trayH - verbR - 30) / (BOX.R + .7)));
    this.cell = cell; this.hh = Math.round(cell * .7); this.bx = Math.round((W - cell * BOX.C) / 2);
    this.by = Math.round(Math.max(this.hh + 10, (H - verbR - trayH - 14 - cell * BOX.R - this.hh) / 2 + this.hh + 4));
    this.trayY = this.by + cell * BOX.R + 14; this.trayH = Math.max(60, Math.min(trayH * 1.3, H - this.trayY - verbR));
    this.tc = Math.min(cell * .74, this.trayH / 3.3);
  },
  slot(i) { const ww = (W - 26) / 3; return { x: W - 13 - (i + .5) * ww, y: this.trayY + this.trayH / 2 - 3 }; }, // rtl: first piece on the right
  pcScale(pc) { return Math.min(this.tc, ((W - 26) / 3 - 22) / pc.w, (this.trayH - 26) / pc.h); },
  pieceRect(i) { const pc = this.tray[i]; if (!pc) return null; const s = this.slot(i), c = this.pcScale(pc); return { x: s.x - pc.w * c / 2, y: s.y - pc.h * c / 2, w: pc.w * c, h: pc.h * c }; },
  cellToX(c) { return this.bx + c * this.cell; },
  drawPieceAt(pc, x0, y0, c, alpha = 1) {
    for (const p of pc.pills) {
      const m = MED[pc.med], vert = p.dir === 'v', w = vert ? c : m.len * c, h = vert ? m.len * c : c;
      ctx.globalAlpha = alpha * .9; ctx.fillStyle = '#cfe2f6'; rr(x0 + p.x * c + 1.5, y0 + p.y * c + 1.5, w - 3, h - 3, c * .26); ctx.fill(); ctx.fillStyle = '#e4effa'; rr(x0 + p.x * c + 3, y0 + p.y * c + 3, w - 6, (h - 6) * .45, c * .2); ctx.fill(); ctx.globalAlpha = 1;
      const s = m.len === 1 ? .68 + .32 * m.real : .92;
      drawPill(m, x0 + p.x * c + w / 2, y0 + p.y * c + h / 2, (vert ? h : w) * .9, c * .9, vert, alpha, s);
    }
  },
  ghost: null,
  draw(dt, now) {
    const c = this.cell, bx = this.bx, by = this.by;
    // the organizer: white plastic frame, a header row with the days, pale blue compartments
    const fw = c * BOX.C, fh = c * BOX.R, hh = this.hh, fr = Math.max(8, c * .22);
    ctx.save(); ctx.shadowColor = 'rgba(60,30,10,.45)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#f4f6fa'; rr(bx - fr, by - hh - fr * .9, fw + fr * 2, fh + hh + fr * 1.9, fr * 1.6); ctx.fill(); ctx.restore();
    const gr = ctx.createLinearGradient(0, by - hh - fr, 0, by + fh + fr); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#dfe5ee');
    ctx.fillStyle = gr; rr(bx - fr, by - hh - fr * .9, fw + fr * 2, fh + hh + fr * 1.9, fr * 1.6); ctx.fill();
    ctx.font = '900 ' + Math.round(hh * .62) + 'px Rubik, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
    const days = 'אבגדהוש', full = this.fullCols ? this.fullCols(now) : null;
    for (let col = 0; col < BOX.C; col++) {
      ctx.fillStyle = '#bcd6f2'; rr(bx + col * c + 2, by - hh - 2, c - 4, hh - 2, 7); ctx.fill();
      ctx.fillStyle = '#d6e7f8'; rr(bx + col * c + 3, by - hh - 1, c - 6, (hh - 4) * .5, 6); ctx.fill();
      ctx.fillStyle = '#244f8f'; ctx.fillText(days[BOX.C - 1 - col], bx + col * c + c / 2, by - hh / 2 - 1);
    }
    for (let y = 0; y < BOX.R; y++) for (let x = 0; x < BOX.C; x++) ctx.drawImage(IMG.cell, bx + x * c, by + y * c, c, c);
    // the ghost: a dashed outline where it lands, and the lines it closes glow gold
    if (this.ghost) {
      const g = this.ghost, pc = this.tray[this.drag.i];
      if (g.ok) {
        const { rows, cols } = this.wouldClear(pc, g.x, g.y), pulse = .45 + .2 * Math.sin(now / 120);
        ctx.save(); ctx.shadowColor = '#ffd23b'; ctx.shadowBlur = 14; ctx.fillStyle = 'rgba(255,214,70,' + pulse + ')'; ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 3;
        rows.forEach((y) => { rr(bx + 1, by + y * c + 1, fw - 2, c - 2, 10); ctx.fill(); ctx.stroke(); });
        cols.forEach((x) => { rr(bx + x * c + 1, by + 1, c - 2, fh - 2, 10); ctx.fill(); ctx.stroke(); });
        ctx.restore();
      }
      ctx.save(); ctx.setLineDash([6, 5]); ctx.lineWidth = 2.5; ctx.strokeStyle = g.ok ? '#ffffff' : '#ff6b6b'; ctx.fillStyle = g.ok ? 'rgba(255,255,255,.28)' : 'rgba(255,80,80,.18)';
      for (const p of pc.pills) { const m = MED[pc.med], X = g.x + p.x, Y = g.y + p.y, w = p.dir === 'v' ? c : m.len * c, h = p.dir === 'v' ? m.len * c : c; rr(bx + X * c + 4, by + Y * c + 4, w - 8, h - 8, c * .25); ctx.fill(); ctx.stroke(); }
      ctx.restore();
    }
    for (const id in this.pills) {  // the well under each pill = exactly the cells it takes
      const p = this.pills[id], vert = p.dir === 'v', w = vert ? c : p.len * c, h = vert ? p.len * c : c;
      if (p.dying != null) continue;
      ctx.fillStyle = 'rgba(120,160,215,.55)'; rr(bx + p.x * c + 2.5, by + p.y * c + 2.5, w - 5, h - 5, c * .24); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; rr(bx + p.x * c + 4, by + p.y * c + 4, w - 8, (h - 8) * .4, c * .2); ctx.fill();
    }
    for (const id in this.pills) {
      const p = this.pills[id], m = MED[p.med], vert = p.dir === 'v';
      const w = vert ? c : p.len * c, h = vert ? p.len * c : c;
      let s = p.len === 1 ? .68 + .32 * m.real : .94, a = 1;
      if (p.dying != null) { const t = (now - p.dying) / 260; s *= Math.max(0, 1 + t * .4); a = Math.max(0, 1 - t); }
      else if (p.born) { const t = Math.min(1, (now - p.born) / 160); s *= .8 + .2 * t; }
      drawPill(m, bx + p.x * c + w / 2, by + p.y * c + h / 2, (vert ? h : w) * .9, c * .9, vert, a, s);
    }
    // the tray
    { // the cream tray with three wells
      const ty = this.trayY, th = this.trayH;
      ctx.save(); ctx.shadowColor = 'rgba(60,30,10,.4)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5; ctx.fillStyle = '#f3e3c8'; rr(10, ty, W - 20, th, 20); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#fbf1e1'; rr(13, ty + 3, W - 26, th - 8, 18); ctx.fill();
      const ww = (W - 26) / 3;
      for (let i = 0; i < 3; i++) { ctx.fillStyle = '#efdcbd'; rr(16 + i * ww, ty + 8, ww - 6, th - 18, 14); ctx.fill(); ctx.fillStyle = '#f7ead6'; rr(18 + i * ww, ty + 11, ww - 10, th - 22, 12); ctx.fill(); }
    }
    for (let i = 0; i < 3; i++) {
      const pc = this.tray[i]; if (!pc || (this.drag && this.drag.i === i)) continue;
      const r = this.pieceRect(i), ok = this.canPlace(pc);
      this.drawPieceAt(pc, r.x, r.y, this.pcScale(pc), ok ? 1 : .35);
      const sl = this.slot(i); ctx.globalAlpha = ok ? 1 : .5; nameChip(MED[pc.med].he, sl.x, this.trayY + this.trayH - 13, MED[pc.med].col, 11.5); ctx.globalAlpha = 1;
    }
    if (this.drag) { const d = this.drag, pc = this.tray[d.i]; this.drawPieceAt(pc, d.x - pc.w * c / 2, d.y - pc.h * c / 2, c, .95); nameChip(MED[pc.med].he, d.x, d.y - pc.h * c / 2 - 16, MED[pc.med].col, 15); }
  },
  wouldClear(pc, gx, gy) {
    const occ = (x, y) => this.grid[y][x] || pc.cells.some(([a, b]) => gx + a === x && gy + b === y);
    const rows = [], cols = [];
    for (let y = 0; y < BOX.R; y++) { let f = true; for (let x = 0; x < BOX.C; x++) if (!occ(x, y)) { f = false; break; } if (f) rows.push(y); }
    for (let x = 0; x < BOX.C; x++) { let f = true; for (let y = 0; y < BOX.R; y++) if (!occ(x, y)) { f = false; break; } if (f) cols.push(x); }
    return { rows, cols };
  },
  down(px, py) {
    if (G.over || G.busy) return;
    for (let i = 0; i < 3; i++) {
      const r = this.pieceRect(i); if (!r) continue;
      const m = 16; if (px > r.x - m && px < r.x + r.w + m && py > r.y - m && py < r.y + r.h + m) {
        this.drag = { i, x: px, y: py - this.cell * 1.6, ox: 0 }; sfx('place', .4); this.move(px, py); return;
      }
    }
    if (py < this.trayY) { say('savta', 'suspect', L.savtaSuspect); }
  },
  move(px, py) {
    if (!this.drag) return;
    const d = this.drag, pc = this.tray[d.i], c = this.cell;
    d.x = px; d.y = py - c * 1.6 - pc.h * c / 2 + c / 2;
    const gx = Math.round((d.x - pc.w * c / 2 - this.bx) / c), gy = Math.round((d.y - pc.h * c / 2 - this.by) / c);
    const inside = d.y < this.trayY && gx > -pc.w && gy > -pc.h;
    this.ghost = inside ? { x: gx, y: gy, ok: this.fits(pc, gx, gy) } : null;
  },
  up() {
    if (!this.drag) return;
    const d = this.drag, pc = this.tray[d.i], g = this.ghost; this.drag = null; this.ghost = null;
    if (!g) return;
    if (!g.ok) { sfx('error', .5); say('lola', 'oops', 'אמא, זה לא נכנס שם.'); return; }
    this.place(d.i, g.x, g.y);
  },
  place(i, gx, gy) {
    const pc = this.tray[i], m = MED[pc.med];
    for (const p of pc.pills) this.put({ med: pc.med, x: gx + p.x, y: gy + p.y, dir: p.dir, len: m.len });
    this.tray[i] = null; this.placed++;
    sfx('place'); addScore(pc.cells.length); popName(this.bx + (gx + pc.w / 2) * this.cell, this.by + (gy + pc.h / 2) * this.cell, pc.med, pc.cells.length);
    emit('place');
    if (!this.seen[m.id]) { this.seen[m.id] = 1; say('lola', 'please', m.say); }
    const { rows, cols } = this.wouldClear({ cells: [] }, 0, 0);
    const n = rows.length + cols.length;
    if (n) {
      this.combo++;
      const dying = new Set();
      rows.forEach((y) => { for (let x = 0; x < BOX.C; x++) dying.add(this.grid[y][x]); });
      cols.forEach((x) => { for (let y = 0; y < BOX.R; y++) dying.add(this.grid[y][x]); });
      const now = performance.now(), c = this.cell;
      for (const id of dying) { const p = this.pills[id]; p.dying = now; burst(this.bx + p.x * c + c / 2, this.by + p.y * c + c / 2, MED[p.med].col, 5); }
      setTimeout(() => { for (const id of dying) { const p = this.pills[id]; if (!p) continue; for (let k = 0; k < p.len; k++) { const x = p.dir === 'h' ? p.x + k : p.x, y = p.dir === 'h' ? p.y : p.y + k; this.grid[y][x] = 0; } delete this.pills[id]; } this.afterPlace(); }, 270);
      const pts = 10 * n * n * this.combo + dying.size * 2;
      const cx = this.bx + c * BOX.C / 2, cy = this.by + (rows.length ? (rows[0] + .5) * c : c * BOX.R / 2);
      addScore(pts, cx, cy);
      this.days += cols.length; const dd = $('#boxDays span'); if (dd) dd.textContent = this.days;
      sfx(this.combo > 1 ? 'combo' : 'clear');
      if (cols.length) flash(cols.length > 1 ? cols.length + ' ימים סגורים!' : 'יום סגור!');
      else if (n > 1) flash('×' + n + '!');
      else if (this.combo > 1) flash('קומבו ×' + this.combo);
      if (this.combo > 2 || n > 1) say('savta', 'pleased', L.savtaPleased); else if (Math.random() < .5) say('lola', 'water', L.lolaWater);
      emit('clear');
      G.busy = true;
    } else { this.combo = 0; this.afterPlace(); if (this.placed % 7 === 0) say('savta', Math.random() < .5 ? 'whisper' : 'suspect', Math.random() < .5 ? L.savtaWhisper : L.savtaSuspect); }
  },
  afterPlace() {
    G.busy = false;
    if (G.tut) return;
    if (this.tray.every((p) => !p)) this.deal();
    const left = this.tray.filter(Boolean);
    if (!left.some((p) => this.canPlace(p))) { G.busy = true; setTimeout(() => endGame('box'), 700); say('savta', 'whisper', 'אמרתי לכם. היא לא מצליחה להכניס.'); sfx('shake'); }
  },
};

// =====================================================================
// MODE 2: הבקבוקים - Ball Sort with pill bottles
// =====================================================================
const CAP = 4;
function sortSolvable(bottles, limit = 120000) {
  const done = (s) => s.every((b) => !b.length || (b.length === CAP && b.every((x) => x === b[0])));
  const key = (s) => s.map((b) => b.join(',')).sort().join('|');
  const seen = new Set(); const stack = [bottles.map((b) => b.slice())]; let n = 0;
  while (stack.length && n++ < limit) {
    const s = stack.pop(); if (done(s)) return true;
    const k = key(s); if (seen.has(k)) continue; seen.add(k);
    for (let i = 0; i < s.length; i++) {
      const a = s[i]; if (!a.length) continue; const top = a[a.length - 1];
      if (a.every((x) => x === top) && a.length === CAP) continue;
      for (let j = 0; j < s.length; j++) {
        if (i === j) continue; const b = s[j];
        if (b.length >= CAP || (b.length && b[b.length - 1] !== top)) continue;
        if (!b.length && a.every((x) => x === top)) continue;
        const t = s.map((x) => x.slice()); t[j].push(t[i].pop()); stack.push(t);
      }
    }
  }
  return false;
}
function sortLevel(level, r) {
  const n = Math.min(10, 2 + level), empties = level >= 9 ? 2 : 2;
  // look-alikes from level 3: the white ones together, the yellow ones together
  const whites = ['aspirin', 'atorvastatin', 'metformin', 'calcium', 'fusid'], yellows = ['bisoprolol', 'vitd', 'omega3', 'warfarin'];
  let ids = MEDS.map((m) => m.id);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const bright = ['warfarin', 'bisoprolol', 'omeprazole', 'iron', 'omega3', 'aspirin', 'vaben'];
  if (level < 3) ids = [...bright].sort(() => r() - .5);
  else ids = [...new Set([...(level % 2 ? whites : yellows).slice(0, Math.min(4, n - 1)), ...ids])];
  ids = ids.slice(0, n);
  for (let t = 0; t < 60; t++) {
    const all = []; ids.forEach((id) => { for (let k = 0; k < CAP; k++) all.push(id); });
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    const bottles = []; for (let b = 0; b < n; b++) bottles.push(all.slice(b * CAP, b * CAP + CAP));
    for (let e = 0; e < empties; e++) bottles.push([]);
    if (bottles.some((b) => b.length === CAP && b.every((x) => x === b[0]))) continue;
    if (sortSolvable(bottles)) return bottles;
  }
  return null;
}
const sort = {
  b: [], level: 1, sel: -1, moves: 0, hist: [], fly: null, r: null, doneSaid: {}, capT: {},
  start(tutorial) {
    this.level = 1; this.r = rng(SLUG + '|sort|' + DAY + '|' + (G.round || 0));
    $('#bUndo').hidden = false;
    this.load(tutorial);
  },
  load(tutorial) {
    this.b = tutorial ? [['warfarin', 'aspirin', 'warfarin', 'aspirin'], ['aspirin', 'warfarin', 'aspirin', 'warfarin'], [], []] : (sortLevel(this.level, this.r) || [['aspirin', 'aspirin', 'aspirin'], ['aspirin'], []]);
    this.sel = -1; this.moves = 0; this.hist = []; this.doneSaid = {}; this.fly = null;
    $('#hudMid').innerHTML = '<div class="tile p"><small>תור מס׳</small><span id="sLevel"></span></div><div class="tile p"><small>מהלכים</small><span id="sMoves">0</span></div>';
    $('#sLevel').textContent = tutorial ? '–' : this.level;
    this.layout();
    verb('הקישו על בקבוק, ואז על בקבוק אחר');
    if (!tutorial) say('savta', 'whisper', this.level === 1 ? 'ערבבתי לה הכול. נראה אותה עכשיו.' : pick(Math.random, ['שוב ערבבתי. שתתאמן.', 'היא חושבת שאני לא יודעת להבדיל ביניהם.', 'הלבנים כולם אותו דבר? נראה אותה.']));
  },
  layout() {
    const n = this.b.length, im = IMG.bottle, ar = im && im.width ? im.height / im.width : 1.5, gapX = 10, cap = IMG.cap, car = cap && cap.width ? cap.height / cap.width : .7;
    const gapOf = (bw) => Math.max(40, bw * car - bw * ar * .19 + 14);  // a full bottle's cap must clear the label above it
    let best = null; // 1, 2 or 3 rows - whichever gives the biggest bottles
    for (let rows = 1; rows <= 3; rows++) {
      const perRow = Math.ceil(n / rows); if (rows > 1 && Math.ceil(n / (rows - 1)) === perRow) continue;
      let bw = Math.min((W - 20 - gapX * (perRow - 1)) / perRow, ((H - 24 - rows * 22 - (rows - 1) * 40) / rows) / ar, 112);
      while (rows > 1 && bw > 30 && rows * bw * ar + (rows - 1) * gapOf(bw) + rows * 22 + 24 > H) bw -= 2;
      if (!best || bw > best.bw) best = { rows, perRow, bw };
    }
    const { rows, perRow } = best, bw = best.bw, bh = bw * ar;
    this.bw = bw; this.bh = bh; this.pos = [];
    const gapY = gapOf(bw), totalH = rows * bh + (rows - 1) * gapY, y0 = Math.max(bw * car - bh * .19 + 8, H - totalH - bh * .05 - 30);  // near the thumbs
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / perRow), inRow = Math.min(perRow, n - row * perRow), k = i - row * perRow;
      const rowW = inRow * bw + (inRow - 1) * gapX;
      this.pos.push({ x: W - ((W - rowW) / 2 + k * (bw + gapX)) - bw, y: y0 + row * (bh + gapY) }); // rtl
    }
  },
  slotY(i, k) { const p = this.pos[i]; const top = p.y + this.bh * .25, bot = p.y + this.bh * .91; const sh = (bot - top) / CAP; return bot - sh * (k + .5); },
  draw(dt, now) {
    const bw = this.bw, bh = this.bh, sh = bh * .66 / CAP;
    for (let i = 0; i < this.b.length; i++) {
      const p = this.pos[i], b = this.b[i], lift = i === this.sel ? -bh * .06 : 0;
      ctx.save(); ctx.fillStyle = 'rgba(50,20,0,.28)'; ctx.beginPath(); ctx.ellipse(p.x + bw / 2, p.y + bh * .985, bw * .5, bw * .1, 0, 0, 6.28); ctx.fill(); ctx.restore();
      ctx.drawImage(IMG.bottle, p.x, p.y + lift, bw, bh);
      for (let k = 0; k < b.length; k++) {
        if (this.fly && this.fly.to === i && k === b.length - 1) continue;
        const m = MED[b[k]]; let y = this.slotY(i, k) + lift;
        if (i === this.sel && k === b.length - 1) {
          y = p.y - sh * .2 + Math.sin(now / 180) * 3;
          ctx.save(); ctx.strokeStyle = '#ffd23b'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
          for (const a of [-2.4, -1.57, -.74]) { const r0 = bw * .42, r1 = bw * .6; ctx.beginPath(); ctx.moveTo(p.x + bw / 2 + Math.cos(a) * r0, y + Math.sin(a) * r0 * .8); ctx.lineTo(p.x + bw / 2 + Math.cos(a) * r1, y + Math.sin(a) * r1 * .8); ctx.stroke(); }
          ctx.restore();
          ctx.save(); ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 16; drawPill(m, p.x + bw / 2, y, bw * .8, sh * 1.25, false); ctx.restore();
          nameChip(m.he, p.x + bw / 2, y - sh * .95, m.col, 14);
          continue;
        }
        drawPill(m, p.x + bw / 2, y, bw * .72 * (.6 + .4 * m.real), sh * .96, false);
      }
      ctx.globalAlpha = .3; ctx.drawImage(IMG.bottle, p.x, p.y + lift, bw, bh); ctx.globalAlpha = 1; // the front of the plastic
      const full = b.length === CAP && b.every((x) => x === b[0]);
      if (full) {
        const m = MED[b[0]], cap = IMG.cap, t = Math.min(1, (now - (this.capT[i] || 0)) / 300);
        if (cap && cap.width) { const cw = bw * 1.0, ch = cw * cap.height / cap.width; ctx.drawImage(cap, p.x + bw / 2 - cw / 2, p.y + bh * .19 - ch - (1 - t) * 30, cw, ch); }
        drawLabel(m.id, p.x + bw / 2, p.y + lift + bh * .6, bw * .93, this.capT[i] || 0, now);
      }
    }
    if (this.fly) {
      const f = this.fly, t = Math.min(1, (now - f.t0) / f.dur), e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e - Math.sin(t * Math.PI) * this.bh * .25;
      const m = MED[f.med]; drawPill(m, x, y, this.bw * .72 * (.6 + .4 * m.real), this.bh * .66 / CAP * .96, false);
      if (t >= 1) { this.fly = null; }
    }
  },
  hit(px, py) { for (let i = 0; i < this.pos.length; i++) { const p = this.pos[i]; if (px > p.x - 5 && px < p.x + this.bw + 5 && py > p.y - this.bh * .3 && py < p.y + this.bh + 14) return i; } return -1; },
  down(px, py) {
    if (G.over || G.busy) return;
    const i = this.hit(px, py); if (i < 0) { this.sel = -1; return; }
    if (this.sel < 0) { if (this.b[i].length) { this.sel = i; sfx('rattle', .35); } else say('lola', 'oops', 'הבקבוק הזה ריק, אמא.'); return; }
    if (i === this.sel) { this.sel = -1; return; }
    this.tryMove(this.sel, i);
  },
  tryMove(a, b) {
    const A = this.b[a], B = this.b[b], top = A[A.length - 1];
    if (B.length >= CAP || (B.length && B[B.length - 1] !== top)) {
      sfx('error', .5); say('lola', 'oops', B.length >= CAP ? 'הבקבוק מלא.' : 'זה לא אותו כדור! תסתכלו על הצורה.'); this.sel = -1; return false;
    }
    this.hist.push(this.b.map((x) => x.slice()));
    B.push(A.pop()); this.sel = -1; this.moves++; $('#sMoves').textContent = this.moves;
    const pa = this.pos[a], pb = this.pos[b];
    this.fly = { med: top, to: b, t0: performance.now(), dur: 260, x0: pa.x + this.bw / 2, y0: pa.y - this.bh * .1, x1: pb.x + this.bw / 2, y1: this.slotY(b, B.length - 1) };
    setTimeout(() => sfx('rattle'), 220);
    emit('sortmove');
    const full = B.length === CAP && B.every((x) => x === B[0]);
    if (full && !this.doneSaid[b]) { this.doneSaid[b] = 1; setTimeout(() => { this.capT[b] = performance.now(); sfx('print', .55); setTimeout(() => sfx('stamp', .9), 850); burst(pb.x + this.bw / 2, pb.y, MED[top].col, 14); if (!this.checkWin()) say('lola', 'please', MED[top].he + '. המרשם נופק!'); }, 280); }
    return true;
  },
  undo() { if (!this.hist.length || G.busy) return; this.b = this.hist.pop(); this.sel = -1; this.fly = null; this.moves++; $('#sMoves').textContent = this.moves; this.doneSaid = {}; this.b.forEach((B, i) => { if (B.length === CAP && B.every((x) => x === B[0])) this.doneSaid[i] = 1; }); sfx('swap'); },
  checkWin() {
    if (!this.b.every((B) => !B.length || (B.length === CAP && B.every((x) => x === B[0])))) return false;
    G.busy = true; emit('sortwin');
    const pts = 100 + this.level * 40 + Math.max(0, 60 - this.moves * 2);
    addScore(pts, W / 2, H / 2); sfx('win'); flash('הכול מסודר!');
    say('savta', 'pleased', L.savtaPleased);
    window.VerseFrame && VerseFrame.score(G.score);
    saveBest('sort');
    if (G.tut) return true;
    setTimeout(() => { this.level++; G.busy = false; sfx('shake', .6); this.load(); }, 2300);
    return true;
  },
};

// =====================================================================
// MODE 3: המגש של סבתא - match-3 with an order
// =====================================================================
const TR = { C: 7, R: 8 };
const tray = {
  g: null, level: 1, moves: 0, order: null, meds: null, sel: null, r: null, anim: 0, swipe: null,
  start(tutorial) { this.level = 1; this.r = rng(SLUG + '|tray|' + DAY + '|' + (G.round || 0)); this.load(tutorial); },
  load(tutorial) {
    const lv = this.level;
    const pool = MEDS.map((m) => m.id); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(this.r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const bright = ['warfarin', 'bisoprolol', 'omeprazole', 'iron', 'omega3', 'aspirin', 'vaben'].sort(() => this.r() - .5), whites = ['metformin', 'atorvastatin', 'calcium', 'vitd', 'fusid'].sort(() => this.r() - .5);
    this.meds = tutorial ? ['iron', 'aspirin', 'warfarin', 'omeprazole', 'vitd', 'bisoprolol'] : lv < 3 ? bright.slice(0, 5) : [...bright.slice(0, lv < 5 ? 5 : 4), ...whites.slice(0, lv < 5 ? 1 : 2)];
    const nOrd = tutorial ? 1 : Math.min(3, 1 + Math.ceil(lv / 2));
    this.order = this.meds.slice(0, nOrd).map((id) => ({ id, n: tutorial ? 3 : Math.min(30, 8 + lv * 2 + Math.floor(this.r() * 4)) }));
    this.moves = tutorial ? 9 : Math.max(14, 24 - lv);
    this.g = []; for (let y = 0; y < TR.R; y++) { const row = []; for (let x = 0; x < TR.C; x++) row.push(this.cellNew(x, y, row)); this.g.push(row); }
    if (tutorial) { // a fixed board with one obvious move: the marked iron down next to two irons
      const fill = ['aspirin', 'warfarin', 'omeprazole', 'vitd', 'bisoprolol'];
      for (let y = 0; y < TR.R; y++) for (let x = 0; x < TR.C; x++) this.g[y][x] = { m: fill[(x + 2 * y) % 5], oy: 0, sp: null, die: 0 };
      this.g[5][2].m = 'iron'; this.g[5][3].m = 'iron'; this.g[4][4].m = 'iron'; this.tutCell = [4, 4];
    }
    if (!tutorial) while (!this.hasMove()) this.shuffle(true);
    this.sel = null; this.busy = false;
    this.hud(); this.layout();
    verb('החליפו שני כדורים – שלושה זהים');
    if (!tutorial) say('savta', 'suspect', lv === 1 ? 'המרשם של שמונה. אני סופרת כל אחד.' : pick(Math.random, L.savtaSuspect));
  },
  cellNew(x, y, row) {
    let m, t = 0;
    do { m = pick(this.r, this.meds); t++; } while (t < 20 && ((x >= 2 && row[x - 1].m === m && row[x - 2].m === m) || (y >= 2 && this.g[y - 1][x].m === m && this.g[y - 2][x].m === m)));
    return { m, oy: 0, sp: null, die: 0 };
  },
  hud() {
    $('#hudMid').innerHTML = '<div class="tile p"><small>תור מס׳</small><span>' + (G.tut ? '–' : this.level) + '</span></div><div class="tile p"><small>מהלכים</small><span id="tMoves"></span></div>';
    const tk = $('#ticket'); tk.hidden = false;
    tk.innerHTML = '<b>המרשם של סבתא</b>' + this.order.map((o) => `<div class="tile ord" data-o="${o.id}"><img src="assets/pill-${o.id}.webp" alt="${MED[o.id].he}"><span>${o.n}</span><em>${MED[o.id].he}</em></div>`).join('');
    this.hudUpd();
  },
  hudUpd() {
    $('#tMoves').textContent = this.moves;
    for (const o of this.order) { const el = document.querySelector(`.ord[data-o="${o.id}"]`); if (!el) continue; el.querySelector('span').textContent = Math.max(0, o.n); el.classList.toggle('done', o.n <= 0); }
  },
  layout() {
    const c = Math.floor(Math.min((W - 28) / TR.C, (H - 62 - 30) / TR.R)); this.c = c;
    this.x0 = Math.round((W - c * TR.C) / 2); this.y0 = 72;  // right under the prescription
  },
  draw(dt, now) {
    const c = this.c, x0 = this.x0, y0 = this.y0;
    ctx.save(); ctx.shadowColor = 'rgba(60,30,10,.45)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6; ctx.fillStyle = '#eef1f6'; rr(x0 - 12, y0 - 12, c * TR.C + 24, c * TR.R + 24, 22); ctx.fill(); ctx.restore();
    { const gr = ctx.createLinearGradient(0, y0 - 12, 0, y0 + c * TR.R + 12); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#dde4ee'); ctx.fillStyle = gr; rr(x0 - 12, y0 - 12, c * TR.C + 24, c * TR.R + 24, 22); ctx.fill(); }
    for (let y = 0; y < TR.R; y++) for (let x = 0; x < TR.C; x++) ctx.drawImage(IMG.cell, x0 + x * c, y0 + y * c, c, c);
    if (this.sel) { ctx.strokeStyle = '#ffb13b'; ctx.lineWidth = 4; rr(x0 + this.sel[0] * c + 3, y0 + this.sel[1] * c + 3, c - 6, c - 6, 10); ctx.stroke(); }
    ctx.save(); rr(x0, y0, c * TR.C, c * TR.R, 10); ctx.clip();
    for (let y = 0; y < TR.R; y++) for (let x = 0; x < TR.C; x++) {
      const k = this.g[y][x]; if (!k || !k.m) continue;
      if (k.oy) { k.oy = Math.max(0, k.oy - dt * 14); }
      let cx = x0 + x * c + c / 2 + (k.ox || 0) * c, cy = y0 + (y - k.oy) * c + c / 2 + (k.oyS || 0) * c, s = 1, a = 1;
      if (k.die) { const t = (now - k.die) / 220; s = 1 + t * .5; a = Math.max(0, 1 - t); }
      const m = MED[k.m];
      if (k.sp) {
        const col = k.sp === 'bomb' ? '255,80,170' : '80,170,255', g = ctx.createRadialGradient(cx, cy, 0, cx, cy, c * .5);
        g.addColorStop(0, 'rgba(' + col + ',.95)'); g.addColorStop(.55, 'rgba(' + col + ',.5)'); g.addColorStop(1, 'rgba(' + col + ',0)');
        ctx.save(); ctx.globalAlpha = .75 + .25 * Math.sin(now / 150); ctx.fillStyle = g; ctx.fillRect(cx - c / 2, cy - c / 2, c, c); ctx.restore();
        if (k.sp !== 'bomb') { ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; const d = c * .44, v = k.sp === 'col';
          for (const sg of [-1, 1]) { ctx.beginPath(); const ex = v ? cx : cx + sg * d, ey = v ? cy + sg * d : cy; ctx.moveTo(v ? cx : cx + sg * d * .55, v ? cy + sg * d * .55 : cy); ctx.lineTo(ex, ey); ctx.lineTo(ex - (v ? 5 : sg * 5), ey - (v ? sg * 5 : 5)); ctx.moveTo(ex, ey); ctx.lineTo(ex - (v ? -5 : sg * 5), ey - (v ? sg * 5 : -5)); ctx.stroke(); }
          ctx.restore(); } }
      drawPill(m, cx, cy, c * .86, c * .78, false, a, (.62 + .38 * m.real) * s);
    }
    ctx.restore();
    if (G.tut && this.tutCell && G.tut.tryOn === 'match') { const [tx, ty] = this.tutCell, p = .5 + .5 * Math.sin(now / 200); ctx.strokeStyle = 'rgba(255,215,90,' + (.5 + p * .5) + ')'; ctx.lineWidth = 4; rr(x0 + tx * c + 2, y0 + ty * c + 2, c - 4, c - 4, 10); ctx.stroke(); }
  },
  at(px, py) { const x = Math.floor((px - this.x0) / this.c), y = Math.floor((py - this.y0) / this.c); return x >= 0 && y >= 0 && x < TR.C && y < TR.R ? [x, y] : null; },
  down(px, py) {
    if (G.over || this.busy) return;
    const p = this.at(px, py); if (!p) return;
    if (this.sel && Math.abs(this.sel[0] - p[0]) + Math.abs(this.sel[1] - p[1]) === 1) { const s = this.sel; this.sel = null; this.swap(s, p); return; }
    this.sel = p; this.swipe = { p, x: px, y: py };
  },
  move(px, py) {
    if (!this.swipe || this.busy) return;
    const dx = px - this.swipe.x, dy = py - this.swipe.y, th = this.c * .35;
    if (Math.abs(dx) < th && Math.abs(dy) < th) return;
    const [x, y] = this.swipe.p, q = Math.abs(dx) > Math.abs(dy) ? [x + Math.sign(dx), y] : [x, y + Math.sign(dy)];
    this.swipe = null;
    if (q[0] < 0 || q[1] < 0 || q[0] >= TR.C || q[1] >= TR.R) return;
    this.sel = null; this.swap([x, y], q);
  },
  up() { this.swipe = null; },
  async tween(a, b, ms) {
    const A = this.g[a[1]][a[0]], B = this.g[b[1]][b[0]], dx = b[0] - a[0], dy = b[1] - a[1], t0 = performance.now();
    await new Promise((res) => { const f = () => { const t = Math.min(1, (performance.now() - t0) / ms); A.ox = dx * t; A.oyS = dy * t; B.ox = -dx * t; B.oyS = -dy * t; if (t < 1) requestAnimationFrame(f); else res(); }; f(); });
    A.ox = A.oyS = B.ox = B.oyS = 0;
  },
  async swap(a, b) {
    this.busy = true; sfx('swap', .6);
    await this.tween(a, b, 140);
    const A = this.g[a[1]][a[0]]; this.g[a[1]][a[0]] = this.g[b[1]][b[0]]; this.g[b[1]][b[0]] = A;
    let m = this.findMatches();
    const bothSp = this.g[a[1]][a[0]].sp && this.g[b[1]][b[0]].sp;
    if (!m.length && !bothSp) {
      sfx('error', .5); await this.tween(a, b, 140);
      const B = this.g[a[1]][a[0]]; this.g[a[1]][a[0]] = this.g[b[1]][b[0]]; this.g[b[1]][b[0]] = B;
      if (Math.random() < .4) say('savta', 'suspect', 'מה היא מזיזה לי שם?');
      this.busy = false; return;
    }
    this.moves--; this.hudUpd(); emit('match');
    await this.resolve([a, b]);
    this.busy = false;
    this.check();
  },
  findMatches() {
    const out = [];
    for (let y = 0; y < TR.R; y++) { let s = 0; for (let x = 1; x <= TR.C; x++) { if (x < TR.C && this.g[y][x].m && this.g[y][x].m === this.g[y][s].m) continue; if (x - s >= 3) out.push({ dir: 'h', cells: Array.from({ length: x - s }, (_, i) => [s + i, y]) }); s = x; } }
    for (let x = 0; x < TR.C; x++) { let s = 0; for (let y = 1; y <= TR.R; y++) { if (y < TR.R && this.g[y][x].m && this.g[y][x].m === this.g[s][x].m) continue; if (y - s >= 3) out.push({ dir: 'v', cells: Array.from({ length: y - s }, (_, i) => [x, s + i]) }); s = y; } }
    return out;
  },
  async resolve(swapCells) {
    let chain = 0;
    for (;;) {
      const groups = this.findMatches(); if (!groups.length) break;
      chain++;
      const kill = new Map(); const spawn = [];
      for (const grp of groups) {
        const gm = this.g[grp.cells[0][1]][grp.cells[0][0]].m, gx = grp.cells.reduce((a, q) => a + q[0], 0) / grp.cells.length, gy = grp.cells.reduce((a, q) => a + q[1], 0) / grp.cells.length;
        if (gm) pops.push({ x: this.x0 + (gx + .5) * this.c, y: this.y0 + (gy + .5) * this.c, t: 0, name: MED[gm].he, col: MED[gm].col, pts: 10 * chain * grp.cells.length, n: grp.cells.length });
        for (const [x, y] of grp.cells) kill.set(x + ',' + y, [x, y]);
        if (grp.cells.length >= 4) {
          const at = (chain === 1 && swapCells && grp.cells.find(([x, y]) => swapCells.some((s) => s[0] === x && s[1] === y))) || grp.cells[1];
          spawn.push({ at, m: this.g[grp.cells[0][1]][grp.cells[0][0]].m, sp: grp.cells.length >= 5 ? 'bomb' : (grp.dir === 'h' ? 'row' : 'col') });
        }
      }
      // specials caught in a match fire
      const fire = [...kill.values()];
      for (let i = 0; i < fire.length; i++) {
        const [x, y] = fire[i], k = this.g[y][x]; if (!k.sp) continue;
        const add = []; if (k.sp === 'row') for (let X = 0; X < TR.C; X++) add.push([X, y]); else if (k.sp === 'col') for (let Y = 0; Y < TR.R; Y++) add.push([x, Y]); else for (let Y = 0; Y < TR.R; Y++) for (let X = 0; X < TR.C; X++) if (this.g[Y][X].m === k.m) add.push([X, Y]);
        k.sp = null; for (const c of add) { const kk = c[0] + ',' + c[1]; if (!kill.has(kk)) { kill.set(kk, c); fire.push(c); } }
        sfx('combo', .6);
      }
      for (const s of spawn) kill.delete(s.at[0] + ',' + s.at[1]);
      const now = performance.now(), c = this.c;
      let pts = 0;
      for (const [x, y] of kill.values()) {
        const k = this.g[y][x]; k.die = now; pts += 10 * chain;
        const o = this.order.find((o) => o.id === k.m); if (o && o.n > 0) o.n--;
        burst(this.x0 + x * c + c / 2, this.y0 + y * c + c / 2, MED[k.m].col, 3);
      }
      for (const s of spawn) { const k = this.g[s.at[1]][s.at[0]]; k.sp = s.sp; k.m = s.m; const o = this.order.find((o) => o.id === s.m); if (o && o.n > 0) o.n--; }
      addScore(pts);
      sfx('vanish', 1, Math.min(1.5, 1 + (chain - 1) * .12)); if (chain > 1) setTimeout(() => sfx('cascade', .55, Math.min(1.3, .9 + chain * .08)), 90);
      if (kill.size >= 4) setTimeout(() => sfx('pop', .9, 1.15), 140);
      if (chain === 3) { flash('שרשרת!'); say('lola', 'water', L.lolaWater); }
      this.hudUpd();
      await wait(230);
      for (const [x, y] of kill.values()) this.g[y][x] = { m: null };
      // fall
      for (let x = 0; x < TR.C; x++) {
        let w = TR.R - 1;
        for (let y = TR.R - 1; y >= 0; y--) { const k = this.g[y][x]; if (k.m) { if (w !== y) { this.g[w][x] = k; k.oy = w - y; k.die = 0; this.g[y][x] = { m: null }; } w--; } }
        for (let y = w; y >= 0; y--) { this.g[y][x] = { m: pick(this.r, this.meds), oy: w + 1 + 0.5, die: 0 }; }
      }
      await wait(260);
    }
    if (!this.hasMove()) { this.shuffle(); sfx('shake'); say('lola', 'oops', 'אמא, אני מערבבת מחדש.'); }
  },
  hasMove() {
    for (let y = 0; y < TR.R; y++) for (let x = 0; x < TR.C; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const X = x + dx, Y = y + dy; if (X >= TR.C || Y >= TR.R) continue;
      const a = this.g[y][x]; this.g[y][x] = this.g[Y][X]; this.g[Y][X] = a; const ok = this.findMatches().length > 0; this.g[Y][X] = this.g[y][x]; this.g[y][x] = a;
      if (ok) return true;
    }
    return false;
  },
  shuffle(quiet) {
    for (let t = 0; t < 50; t++) {
      const all = this.g.flat(); for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(this.r() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
      for (let y = 0; y < TR.R; y++) for (let x = 0; x < TR.C; x++) this.g[y][x] = all[y * TR.C + x];
      if (!this.findMatches().length && this.hasMove()) return;
    }
  },
  check() {
    if (this.order.every((o) => o.n <= 0)) {
      G.busy = true; emit('traywin');
      const bonus = this.moves * 25; addScore(100 + bonus, W / 2, H / 2); sfx('win'); flash(bonus ? 'המרשם נופק! +' + this.moves + ' מהלכים' : 'המרשם נופק!');
      say('savta', 'pleased', L.savtaPleased); saveBest('tray');
      window.VerseFrame && VerseFrame.score(G.score);
      if (G.tut) return;
      setTimeout(() => { this.level++; G.busy = false; this.load(); }, 1800);
    } else if (this.moves <= 0) { G.busy = true; setTimeout(() => endGame('tray'), 600); }
    else if (this.moves === 3) say('lola', 'oops', 'אמא, נשארו שלושה מהלכים!');
  },
};

const MODES = { box, sort, tray };

// ---------- the pharmacy label a full bottle gets (printed like a real kupat holim pharmacy sticker) ----------
const DOSE = { fusid: '40 מ"ג', vaben: '10 מ"ג', aspirin: '75 מ"ג', bisoprolol: '5 מ"ג', warfarin: '5 מ"ג', omeprazole: '20 מ"ג', metformin: '850 מ"ג', atorvastatin: '20 מ"ג', calcium: '600 מ"ג', vitd: '1000 יב"ל', omega3: '1000 מ"ג', iron: '105 מ"ג' };
const LABELS = {};
function labelFor(id) {
  if (LABELS[id]) return LABELS[id];
  const im = IMG.label; if (!im || !im.width) return null;
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d');
  g.drawImage(im, 0, 0); g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const F = (w, px) => w + ' ' + px + 'px "Miriam Libre", Arial, sans-serif', cx = c.width / 2, maxW = c.width - 44;
  const line = (t, y, w, px, col = '#1d1d1f') => { g.font = F(w, px); let k = px; while (g.measureText(t).width > maxW && k > 10) { k--; g.font = F(w, k); } g.fillStyle = col; g.fillText(t, cx, y); };
  line('בית מרקחת · קופת החולים', 29, 700, 21, '#ffffff');
  line('לכבוד: סבתא', 82, 400, 22);
  line(MED[id].he, 140, 700, 58);
  line(DOSE[id] || '', 198, 700, 32);
  line('כדור 1 בשעה 20:00, עם מים', 242, 400, 20);
  line('מרשם 0842' + (MEDS.findIndex((m) => m.id === id) + 13) + '   11/11/26', 276, 400, 15, '#555');
  const out = wrapLabel(c);
  if (!document.fonts || document.fonts.check('700 20px "Miriam Libre"')) LABELS[id] = out;  // cache only once Miriam is in
  return out;
}
function wrapLabel(c) {  // the flat sticker bent around the round jar: edges squeezed + shaded, a slight arc, a gloss stripe
  const W = c.width, H = c.height, k = H * .05, o = document.createElement('canvas'); o.width = W; o.height = Math.ceil(H + k); const g = o.getContext('2d');
  const N = 80, TM = 1.15, sm = Math.sin(TM);
  for (let i = 0; i < N; i++) {
    const a0 = (-1 + 2 * i / N) * TM, a1 = (-1 + 2 * (i + 1) / N) * TM;
    const x0 = W / 2 + Math.sin(a0) / sm * W / 2, x1 = W / 2 + Math.sin(a1) / sm * W / 2;
    g.drawImage(c, i * W / N, 0, W / N + .6, H, x0, k * Math.cos((a0 + a1) / 2), x1 - x0 + .6, H);
  }
  g.globalCompositeOperation = 'source-atop';
  const sh = g.createLinearGradient(0, 0, W, 0);
  sh.addColorStop(0, 'rgba(60,30,0,.45)'); sh.addColorStop(.16, 'rgba(60,30,0,.12)'); sh.addColorStop(.5, 'rgba(0,0,0,0)'); sh.addColorStop(.84, 'rgba(60,30,0,.12)'); sh.addColorStop(1, 'rgba(60,30,0,.5)');
  g.fillStyle = sh; g.fillRect(0, 0, W, o.height);
  const gl = g.createLinearGradient(W * .22, 0, W * .42, 0);
  gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(.5, 'rgba(255,255,255,.38)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gl; g.fillRect(W * .22, 0, W * .2, o.height);
  return o;
}
function drawLabel(id, cx, cy, w, t0, now) {  // prints in 350 ms after the cap, the red stamp thumps at 850 ms - the one hit
  const lab = labelFor(id); if (!lab) return;
  const t = (now - t0 - 350) / 300; if (t < 0) return;
  const e = Math.min(1, t), ee = 1 - (1 - e) * (1 - e), h = w * lab.height / lab.width;
  ctx.save(); ctx.translate(cx, cy - (1 - ee) * h * .25); ctx.rotate(-2 * Math.PI / 180); ctx.globalAlpha = ee;
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2; ctx.drawImage(lab, -w / 2, -h / 2, w, h);
  ctx.restore();
  const st = IMG.stamp, u = (now - t0 - 850) / 120; if (!st || !st.width || u < 0) return;
  const f = Math.min(1, u), sw = w * .46 * (1 + (1 - f) * .7);
  ctx.save(); ctx.translate(cx - w * .22, cy + h * .3); ctx.rotate(-14 * Math.PI / 180); ctx.scale(.86, 1); ctx.globalAlpha = .88 * f; ctx.drawImage(st, -sw / 2, -sw / 2, sw, sw * st.height / st.width); ctx.restore();
}

// ---------- the hand that shows a move (when the player waits, and in every "try it" step) ----------
const hint = { h: null, t0: 0 };
function idleReset() { G.lastInput = performance.now(); hint.h = null; hint.forced = false; }
box.hint = function () {
  let best = null;
  this.tray.forEach((pc, i) => { if (!pc) return; for (let y = 0; y < BOX.R; y++) for (let x = 0; x < BOX.C; x++) if (this.fits(pc, x, y)) { const w = this.wouldClear(pc, x, y), sc = (w.rows.length + w.cols.length) * 100 + y; if (!best || sc > best.sc) best = { i, x, y, sc }; } });
  if (!best) return null;
  const r = this.pieceRect(best.i), pc = this.tray[best.i], c = this.cell;
  return { kind: 'drag', pc, a: { x: r.x + r.w / 2, y: r.y + r.h / 2 }, b: { x: this.bx + (best.x + pc.w / 2) * c, y: this.by + (best.y + pc.h / 2) * c + c * 1.6 } };
};
sort.hint = function () {
  let best = null; const b = this.b;
  for (let i = 0; i < b.length; i++) { const A = b[i]; if (!A.length) continue; const top = A[A.length - 1]; if (A.length === CAP && A.every((x) => x === top)) continue;
    for (let j = 0; j < b.length; j++) { if (i === j) continue; const B = b[j]; if (B.length >= CAP || (B.length && B[B.length - 1] !== top)) continue; if (!B.length && A.every((x) => x === top)) continue;
      const sc = B.length ? 10 + B.length : 1; if (!best || sc > best.sc) best = { i, j, sc }; } }
  if (!best) return null;
  const P = (k) => ({ x: this.pos[k].x + this.bw / 2, y: this.pos[k].y + this.bh * .55 });
  return { kind: 'tap2', a: P(best.i), b: P(best.j) };
};
tray.hint = function () {
  let best = null;
  for (let y = 0; y < TR.R; y++) for (let x = 0; x < TR.C; x++) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= TR.C || Y >= TR.R) continue;
    const a = this.g[y][x]; this.g[y][x] = this.g[Y][X]; this.g[Y][X] = a;
    const m = this.findMatches(); this.g[Y][X] = this.g[y][x]; this.g[y][x] = a;
    if (!m.length) continue;
    const sc = m.reduce((s, g) => s + g.cells.length, 0) + (this.order.some((o) => o.n > 0 && o.id === a.m) ? 5 : 0);
    if (!best || sc > best.sc) best = { x, y, X, Y, sc };
  }
  if (!best) return null; const c = this.c;
  return { kind: 'drag', a: { x: this.x0 + (best.x + .5) * c, y: this.y0 + (best.y + .5) * c }, b: { x: this.x0 + (best.X + .5) * c, y: this.y0 + (best.Y + .5) * c } };
};
function drawHint(now) {
  const M = MODES[G.mode]; if (!M || G.over || G.busy || M.busy || M.drag || M.fly) return;
  const wait = G.tut ? (G.tut.waiting || hint.forced ? 700 : Infinity) : 5000;
  if (now - (G.lastInput || now) < wait) return;
  if (!hint.h) { hint.h = M.hint(); hint.t0 = now; if (!hint.h) return; }
  const h = hint.h, im = IMG.hand; if (!im || !im.width) return;
  const t = ((now - hint.t0) % 1900) / 1900; let x, y, press = 0, alpha = 1;
  if (h.kind === 'drag') {
    const e = t < .15 ? 0 : t > .75 ? 1 : (t - .15) / .6, ee = e < .5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2;
    x = h.a.x + (h.b.x - h.a.x) * ee; y = h.a.y + (h.b.y - h.a.y) * ee; press = t > .08 && t < .8 ? 1 : 0; alpha = t > .88 ? (1 - t) / .12 : t < .05 ? t / .05 : 1;
    if (h.pc && press) { const c = box.cell; box.drawPieceAt(h.pc, x - h.pc.w * c / 2, y - c * 1.6 - h.pc.h * c / 2, c, .55 * alpha); }
  } else {
    const first = t < .45; const P = first ? h.a : h.b, tt = first ? t / .45 : (t - .5) / .45;
    x = P.x; y = P.y; press = tt > .3 && tt < .6 ? 1 : 0; alpha = t > .45 && t < .5 ? 0 : 1;
    if (press) { ctx.save(); ctx.globalAlpha = .6; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 14 + (tt - .3) * 60, 0, 6.28); ctx.stroke(); ctx.restore(); }
  }
  const w = Math.max(54, Math.min(76, W * .17)), hh = w * im.height / im.width, sc = press ? .9 : 1;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(sc, sc); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
  ctx.drawImage(im, -w * .14, -hh * .06, w, hh); ctx.restore();
}

// ---------- loop + input ----------
let lastT = performance.now();
function frame(now) { voTick(now);
  const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
  if (G.mode) { MODES[G.mode].draw(dt, now); drawFx(dt); drawHint(now); }
  requestAnimationFrame(frame);
}
function pt(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
cv.addEventListener('pointerdown', (e) => { audioInit(); idleReset(); if (!G.mode) return; cv.setPointerCapture(e.pointerId); const [x, y] = pt(e); MODES[G.mode].down(x, y); });
cv.addEventListener('pointermove', (e) => { if (!G.mode || !MODES[G.mode].move) return; const [x, y] = pt(e); MODES[G.mode].move(x, y); });
cv.addEventListener('pointerup', (e) => { if (G.mode && MODES[G.mode].up) MODES[G.mode].up(); });
cv.addEventListener('pointercancel', () => { if (G.mode && MODES[G.mode].up) MODES[G.mode].up(); });
ui.savta.onclick = () => say('savta', Math.random() < .5 ? 'whisper' : 'suspect', Math.random() < .5 ? L.savtaWhisper : L.savtaSuspect);
ui.lola.onclick = () => say('lola', Math.random() < .5 ? 'please' : 'water', Math.random() < .5 ? L.lolaPlease : L.lolaWater);

// ---------- screens ----------
const NAMES = { box: 'קופסת השבוע', sort: 'הבקבוקים', tray: 'המגש של סבתא' };
function best(mode) { return Number(store.get('best-' + mode) || 0); }
function saveBest(mode) {
  if (G.tut) return;
  if (G.score > best(mode)) store.set('best-' + mode, G.score);
  if (G.score > Number(store.get('best') || 0)) store.set('best', G.score);
  const d = (store.get('day') || '').split('|'); if (d[0] !== DAY || G.score > Number(d[1] || 0)) store.set('day', DAY + '|' + G.score);
}
function showStart() {
  G.mode = null; G.tut = null; $('#play').hidden = true; $('#end').hidden = true; $('#tut').hidden = true; $('#start').hidden = false;
  document.querySelectorAll('[data-rec]').forEach((el) => { const b = best(el.dataset.rec); el.textContent = b ? 'שיא: ' + b : ''; });
  soundBtn(); musicBtn(); queueTick(true);
  if (hold.said && audio.ctx) setTimeout(() => { if (!G.mode) vo('menu'); }, 600);
}
let qN = 7, qT = 0;
function queueTick(reset) {
  clearTimeout(qT); if (G.mode) return;
  if (reset) qN = 7 + Math.floor(Math.random() * 6);
  $('#qLine').innerHTML = qN > 0 ? '📞 מקומך בתור: <b>' + qN + '</b> · בחרו שלוחה' : '📞 <b>התור שלכם הגיע!</b> בחרו שלוחה';
  if (qN <= 0) qN = 43;
  qN--; qT = setTimeout(queueTick, 4000);
}
function startMode(mode, tutorial) {
  audioInit();
  G.mode = mode; G.over = false; G.busy = false; G.round = (G.round || 0) + 1; setScore(0); parts = []; pops = [];
  $('#start').hidden = true; $('#end').hidden = true; $('#play').hidden = false; $('#bUndo').hidden = true; $('#ticket').hidden = true;
  resize(); idleReset(); MODES[mode].start(tutorial);
  if (!tutorial) { window.track && window.track('game_start', SLUG); say('lola', 'please', L.lolaPlease); }
}
function endGame(mode) {
  if (G.over) return; G.over = true;
  const nb = G.score > best(mode);
  saveBest(mode); sfx('lose', .7);
  window.track && window.track('game_over', SLUG);
  if (G.score > 0 && window.VerseFrame && VerseFrame.score) VerseFrame.score(G.score);
  $('#endTitle').innerHTML = mode === 'box' ? 'אין תורים פנויים<small>הקופסה התמלאה</small>' : 'השיחה נותקה<small>נגמרו המהלכים</small>';
  setTimeout(() => vo(mode === 'box' ? ['busy', 'bye'] : ['bye', 'busy']), 900);
  $('#endLine').textContent = mode === 'box' ? '"אמרתי לכם. היא לא מצליחה להכניס."' : '"חסר לי כדור. תזכרו את השיחה הזאתי."';
  $('#endFace').src = 'assets/savta-' + (nb ? 'thumbs' : 'whisper') + '.webp';
  $('#endScore').textContent = G.score;
  $('#endNew').hidden = !nb;
  $('#endBest').textContent = nb ? '' : 'השיא שלכם: ' + best(mode);
  verb(''); G.talking = false; ui.bubble.className = 'quiet'; $('#end').hidden = false;
}
document.querySelectorAll('.mode').forEach((b) => b.onclick = (e) => {
  const mode = b.dataset.mode, how = e.target.closest('[data-how]');
  if (how || !store.get('tut-' + mode)) runTutorial(mode); else startMode(mode);
});
$('#bHome').onclick = () => { if (G.mode && !G.tut && G.score > 0 && !G.over) { saveBest(G.mode); window.window.VerseFrame && VerseFrame.score(G.score); } showStart(); };
$('#bRestart').onclick = () => { if (G.tut) return; if (G.score > 0 && !G.over) saveBest(G.mode); startMode(G.mode); };
$('#bUndo').onclick = () => G.mode === 'sort' && sort.undo();
$('#bAgain').onclick = () => startMode(G.mode);
$('#bMenu').onclick = showStart;

// ---------- the tutorial ----------
const R = (el) => { const r = (typeof el === 'string' ? $(el) : el).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
const SR = (x, y, w, h) => { const r = cv.getBoundingClientRect(); return { x: r.left + x, y: r.top + y, w, h }; };
const TUT = {
  box: [
    { t: 'אני לולה, המטפלת של סבתא. כל ערב בשמונה אני מכינה לה את התרופות.', spot: () => R('#lola') },
    { who: 'savta', t: 'וזאת סבתא. היא בטוחה שאני מחליפה לה את הכדורים, אז היא בודקת כל אחד.', spot: () => R('#savta') },
    { t: 'זאת קופסת השבוע: עמודה לכל יום, א׳ עד ש׳. המטרה: להכניס כמה שיותר כדורים.', spot: () => SR(box.bx - 8, box.by - box.hh - 8, box.cell * BOX.C + 16, box.cell * BOX.R + box.hh + 16) },
    { t: 'כל כדור בגודל האמיתי שלו: מיקרופירין קטן – משבצת אחת. קפסולה – שתיים. קלציום ענק – שלוש.', spot: () => SR(box.bx, box.by + box.cell * (BOX.R - 2), box.cell * BOX.C, box.cell * 2) },
    { t: 'כאן מחכים הכדורים הבאים. גוררים אותם לקופסה – אפשר לשים אותם רק במקום פנוי.', spot: () => SR(10, box.trayY, W - 20, box.trayH) },
    { t: 'נסו עכשיו: גררו את הקפסולה הסגולה לחור בשורה התחתונה – היד מראה איך.', try: 'clear', spot: () => SR(6, box.by + box.cell * (BOX.R - 1) - 4, W - 12, box.trayY + box.trayH - (box.by + box.cell * (BOX.R - 1)) + 8) },
    { t: 'יפה! שורה מלאה או יום מלא – נסגרים ומתפנים. כמה ביחד = הרבה יותר נקודות.', spot: () => R('#score') },
    { t: 'מפסידים כשאף כדור כבר לא נכנס. כדור חיוור = אין לו מקום כרגע.', spot: () => SR(10, box.trayY, W - 20, box.trayH) },
    { t: 'הבית – חזרה לתפריט הראשי. החץ – חיוג חוזר, מתחילים מחדש. מוכנים? בבקשה אמא!', spot: () => R('#hud') },
  ],
  sort: [
    { who: 'savta', t: 'סבתא שפכה את כל התרופות לבקבוקים "כדי לתפוס את לולה". עכשיו הכול מעורבב.', spot: () => R('#savta') },
    { t: 'המטרה: בכל בקבוק – תרופה אחת בלבד, ארבעה כדורים זהים. תסתכלו על הצורה, הגודל והצבע.', spot: () => SR(0, 0, W, H) },
    { t: 'מקישים על בקבוק – הכדור העליון עולה. מקישים על בקבוק אחר – הוא עובר לשם.', spot: () => SR(sort.pos[0].x - 6, sort.pos[0].y - 30, sort.bw + 12, sort.bh + 36) },
    { t: 'מותר להעביר רק לבקבוק ריק, או על כדור זהה. ובכל בקבוק נכנסים ארבעה.', spot: () => SR(sort.pos[2].x - 6, sort.pos[2].y - 30, sort.bw * 2 + 22, sort.bh + 36) },
    { t: 'נסו עכשיו: העבירו כדור לבקבוק ריק.', try: 'sortmove', spot: () => SR(0, 0, W, H) },
    { t: 'יופי! עכשיו סדרו את כל הבקבוקים – קומדין לחוד, מיקרופירין לחוד.', try: 'sortwin', spot: () => SR(0, 0, W, H) },
    { t: 'מצוין! טעיתם? החץ האחורי מבטל מהלך. כל שלב – יותר תרופות, וגם כאלה שנראות כמעט אותו דבר.', spot: () => R('#bUndo') },
    { t: 'פחות מהלכים = יותר נקודות. מוכנים? אמא, אני מסדרת!', spot: () => R('#hud') },
  ],
  tray: [
    { who: 'savta', t: 'זה המגש של סבתא. יש לה מרשם מהקופה לשמונה בערב – והיא סופרת כל כדור.', spot: () => R('#savta') },
    { who: 'savta', t: 'זה המרשם שלי: כמה כדורים מכל תרופה. וכאן למעלה – כמה מהלכים נשארו.', spot: () => R('#ticket') },
    { t: 'מחליפים שני כדורים שכנים – גוררים אחד לכיוון השני. שלושה זהים בשורה – יוצאים למגש.', spot: () => SR(tray.x0, tray.y0, tray.c * TR.C, tray.c * TR.R) },
    { t: 'נסו עכשיו: גררו את הפרו-גרדומט האדום המסומן למטה, ליד שני האדומים – היד מראה איך.', try: 'match', tryOn: 'match', spot: () => SR(tray.x0 + tray.c * 1.5, tray.y0 + tray.c * 3.5, tray.c * 4, tray.c * 3) },
    { t: 'יפה! ארבעה בשורה = כדור זוהר שמנקה שורה שלמה. חמישה = מנקה את כל התרופה הזאת.', spot: () => SR(tray.x0, tray.y0, tray.c * TR.C, tray.c * TR.R) },
    { t: 'מפסידים כשנגמרים המהלכים לפני שהמרשם מלא. מהלכים שנשארו = בונוס.', spot: () => R('#hudMid') },
    { t: 'מוכנים? בבקשה אמא!', spot: () => R('#hud') },
  ],
};
function runTutorial(mode) {
  startMode(mode, true);
  G.tut = { mode, i: 0, steps: TUT[mode] };
  $('#tut').hidden = false; tutShow();
}
function tutShow() {
  const T = G.tut, s = T.steps[T.i];
  T.tryOn = s.tryOn || null; T.waiting = s.try || null;
  const left = T.steps.length - T.i - 1; $('#tutN').textContent = left ? 'מקומך בתור: ' + left : 'התור שלכם הגיע!'; $('#tutFace').src = 'assets/' + (s.who === 'savta' ? 'savta-suspect' : 'lola-please') + '.webp'; idleReset();
  $('#tutT').innerHTML = s.t + (s.try ? '<br><span class="try">נסו עכשיו ←</span>' : '');
  $('#tutNext').hidden = !!s.try; $('#tut').classList.toggle('try', !!s.try);
  requestAnimationFrame(() => {
    const r = s.spot ? s.spot() : { x: 0, y: 0, w: 0, h: 0 }, sp = $('#spot');
    Object.assign(sp.style, { left: r.x - 4 + 'px', top: r.y - 4 + 'px', width: r.w + 8 + 'px', height: r.h + 8 + 'px' });
    sp.style.boxShadow = s.try ? '0 0 0 4000px #0005,0 0 0 3px #ffd76a inset' : '';
    const card = $('#tutCard'), mid = r.y + r.h / 2;
    card.style.top = card.style.bottom = '';
    if (mid > innerHeight * .5) card.style.top = 'calc(var(--safe-t) + 10px)'; else card.style.bottom = 'calc(var(--safe-b) + 14px)';
    if (s.try && r.h > innerHeight * .6) { card.style.bottom = ''; card.style.top = 'calc(var(--safe-t) + 6px)'; }  // the boards sit low - the card goes over the header
  });
}
function tutNext() {
  const T = G.tut; if (!T || T.waiting) return;
  T.i++; if (T.i >= T.steps.length) return tutEnd();
  tutShow();
}
function tutEvent(e) {
  const T = G.tut; if (!T || T.waiting !== e) return;
  T.waiting = null; sfx('clear', .5);
  $('#tutT').innerHTML = '<b>יפה מאוד!</b>';
  setTimeout(() => { if (G.tut === T) { T.i++; T.i >= T.steps.length ? tutEnd() : tutShow(); } }, 900);
}
function tutEnd() { voStop(); const m = G.tut.mode; store.set('tut-' + m, 1); G.tut = null; $('#tut').hidden = true; startMode(m); }
$('#tutNext').onclick = tutNext;
$('#tutSkip').onclick = () => G.tut && tutEnd();
addEventListener('keydown', (e) => {
  if (!G.mode && !G.tut && '123'.includes(e.key) && e.key.length === 1) { const b = document.querySelectorAll('.mode')[+e.key - 1]; if (b && !$('#start').hidden) b.click(); return; }
  if (e.key === '*' && G.mode) { $('#bHome').click(); return; }
  if (e.key === '9') { nextTrack(); return; }
  if (!G.tut) return;
  if (e.key === ' ' || e.key === 'Enter' || e.key === '1') { e.preventDefault(); tutNext(); }
  if (e.key === 'Escape' || e.key === '#') tutEnd();
});

// ---------- boot ----------
(async () => {
  const list = [...MEDS.map((m) => [m.id, 'assets/pill-' + m.id + '.webp']), ['cell', 'assets/cell.jpg'], ['bottle', 'assets/bottle.webp'], ['cap', 'assets/cap.webp'], ['hand', 'assets/hand.webp'], ['label', 'assets/label.webp'], ['stamp', 'assets/stamp.webp']];
  await Promise.all(list.map(async ([k, src]) => { IMG[k] = await loadImg(src); }));
  ['savta-whisper', 'savta-pleased', 'savta-thumbs', 'lola-water', 'lola-oops'].forEach((n) => loadImg('assets/' + n + '.webp'));
  document.fonts && document.fonts.load('700 20px "Miriam Libre"').then(() => { for (const k in LABELS) delete LABELS[k]; }).catch(() => {});
  showStart(); requestAnimationFrame(frame);
})();

// test hook
window.PILLS = { labelFor, showHint, hint, G, box, sort, tray, MEDS, startMode, runTutorial, endGame, sortSolvable, sortLevel, tutNext, audio, hold, vo };
