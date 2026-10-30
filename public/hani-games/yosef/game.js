// יוסף מוקיר שבת - a story book with a small game on every page.
// Pages come from story.json (text with niqqud), pictures assets/pages/pNN.jpg, narration assets/audio/pNN.mp3.
const $ = (id) => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a), irnd = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
const KEY = { done: 'hani-games:yosef:done', page: 'hani-games:yosef:page', tut: 'hani-games:yosef:tut', snd: 'hani-games:yosef:snd' };
const TEST_SPEED = +(new URLSearchParams(location.search).get('speed') || 1);

let story = null, page = 0, started = false;
const done = new Set(JSON.parse(store.get(KEY.done) || '[]'));

/* ---------------- sound ---------------- */
const SND = { ctx: null, raw: {}, buf: {}, on: store.get(KEY.snd) !== '0', last: {}, master: null, music: null, musicGain: null };
const HS_BASE = window.HS_BASE || (location.pathname.includes('/hani-games/') ? '/hani-games/sounds/' : '../hani-sounds/');
const OWN = ['coin-1', 'coin-2', 'coin-3', 'wrong-1', 'wrong-2', 'pop-1', 'pop-2', 'pop-3', 'squash-1', 'squash-2', 'squash-3', 'tak', 'ring', 'siren', 'page-1', 'page-2', 'stamp', 'win-1', 'win-2', 'whoosh', 'scrape-1', 'scrape-2', 'lid', 'gold-1', 'gold-2', 'bonk-1', 'bonk-2', 'bonk-3', 'popup-1', 'popup-2', 'popup-3', 'dizzy-1', 'dizzy-2', 'miss-1', 'jump-1', 'jump-2', 'gust-1', 'gust-2', 'thud-1', 'thud-2', 'splash-1', 'splash-2', 'card-1', 'card-2', 'card-3', 'paid'];
const HS = ['niggun-freilach'];
for (const n of [...OWN, ...HS]) fetch(OWN.includes(n) ? `assets/snd/${n}.mp3` : HS_BASE + n + '.mp3').then((r) => r.ok ? r.arrayBuffer() : null).then((b) => { if (b) { SND.raw[n] = b; decode(n); } }).catch(() => {});
function ctx() {
  if (!SND.ctx) { try { SND.ctx = new (window.AudioContext || window.webkitAudioContext)(); SND.master = SND.ctx.createGain(); SND.master.connect(SND.ctx.destination); SND.master.gain.value = SND.on ? 1 : 0; } catch (e) { return null; } for (const n in SND.raw) decode(n); }
  if (SND.ctx.state === 'suspended') SND.ctx.resume();
  return SND.ctx;
}
function decode(n) {
  if (!SND.ctx || SND.buf[n] || !SND.raw[n]) return;
  const b = SND.raw[n]; SND.raw[n] = null;
  SND.ctx.decodeAudioData(b).then((x) => { SND.buf[n] = x; if (n === 'niggun-freilach') startMusic(); }).catch(() => {});
}
// play('coin') picks one of coin-1, coin-2... never the same one twice in a row
function play(name, vol = 1, rate = 1) {
  const c = SND.ctx; if (!c) return;
  let n = name;
  if (!SND.buf[name]) {
    const opts = Object.keys(SND.buf).filter((k) => k.startsWith(name + '-'));
    if (!opts.length) return;
    const fresh = opts.filter((k) => k !== SND.last[name]);
    n = pick(fresh.length ? fresh : opts); SND.last[name] = n;
  }
  const s = c.createBufferSource(), g = c.createGain();
  s.buffer = SND.buf[n]; s.playbackRate.value = rate * rnd(.96, 1.04); g.gain.value = vol;
  s.connect(g); g.connect(SND.master); s.start();
}
function startMusic() {
  if (SND.music || !SND.buf['niggun-freilach'] || !SND.ctx) return;
  const s = SND.ctx.createBufferSource(), g = SND.ctx.createGain();
  s.buffer = SND.buf['niggun-freilach']; s.loop = true; g.gain.value = .16;
  s.connect(g); g.connect(SND.master); s.start(); SND.music = s; SND.musicGain = g;
}
function duck(on) { if (SND.musicGain && SND.ctx) SND.musicGain.gain.setTargetAtTime(on ? .05 : .16, SND.ctx.currentTime, .3); }
function hush() { try { SND.ctx && SND.ctx.suspend(); } catch (e) {} voice.pause(); }
addEventListener('pagehide', hush);
document.addEventListener('visibilitychange', () => { if (document.hidden) hush(); });
document.addEventListener('click', (e) => { if (e.target.closest('a')) hush(); }, true);

/* narration */
const voice = new Audio();
voice.preload = 'auto';
voice.addEventListener('play', () => duck(true));
voice.addEventListener('pause', () => duck(false));
voice.addEventListener('ended', () => { duck(false); const p = story.pages[page]; if (isGame(p) && !done.has(p.id)) $('playBtn').classList.add('nudge'); });
function read() {
  if (!started || !SND.on) return;
  voice.src = `assets/audio/${story.pages[page].id}.mp3`;
  voice.currentTime = 0; voice.play().catch(() => {});
}

/* ---------------- the book ---------------- */
function esc(s) { return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]); }
const isGame = (p) => p.game && p.game !== 'end';
function renderStamps() {
  $('stamps').innerHTML = story.pages.filter(isGame).map((p) => `<i class="${done.has(p.id) ? 'done' : ''} ${p === story.pages[page] ? 'here' : ''}"></i>`).join('');
}
function showPage(i, dir = 0) {
  page = clamp(i, 0, story.pages.length - 1); store.set(KEY.page, page);
  const p = story.pages[page], el = $('page');
  const paint = () => {
    $('txt').innerHTML = p.lines.map((l) => /^\(.*\)$/.test(l) ? `<p class="aside">${esc(l)}</p>` : `<p>${esc(l)}</p>`).join('');
    $('txt').scrollTop = 0;
    const img = new Image(), pic = $('pic');
    pic.style.backgroundImage = ''; pic.querySelector('.ph').style.display = '';
    img.onload = () => { pic.style.backgroundImage = `url(${img.src})`; pic.querySelector('.ph').style.display = 'none'; };
    img.src = `assets/pages/${p.id}.jpg`;
    $('pnum').textContent = page + 1;
    $('stamp').classList.toggle('on', done.has(p.id));
    const pb = $('playBtn');
    const again = p.game === 'end' || (page === story.pages.length - 1 && done.has(p.id));
    pb.querySelector('span').textContent = again ? 'מֵהַהַתְחָלָה' : done.has(p.id) ? 'לְשַׂחֵק שׁוּב' : 'שַׂחֲקוּ!';
    pb.classList.toggle('gold', again);
    pb.classList.toggle('again', !again && done.has(p.id));
    pb.classList.remove('nudge');
    pb.hidden = !p.game;
    $('prevBtn').disabled = page === 0;
    $('nextBtn').disabled = page === story.pages.length - 1;
    renderStamps();
    read();
  };
  if (!dir) { paint(); return; }
  const [o, n] = dir > 0 ? ['out', 'in'] : ['in', 'out'];
  el.classList.add(o); play('page', .6);
  setTimeout(() => { paint(); el.classList.remove(o); el.classList.add(n); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove(n))); }, 300);
}
$('nextBtn').onclick = () => showPage(page + 1, 1);
$('prevBtn').onclick = () => showPage(page - 1, -1);
$('readBtn').onclick = () => { ctx(); if (!voice.paused) voice.pause(); else read(); };
$('homeBtn').onclick = () => { hush(); location.href = '../'; };
function paintSnd() { $('sndBtn').classList.toggle('off', !SND.on); $('readBtn').classList.toggle('off', !SND.on); }
$('sndBtn').onclick = () => {
  SND.on = !SND.on; store.set(KEY.snd, SND.on ? '1' : '0'); ctx();
  if (SND.master) SND.master.gain.value = SND.on ? 1 : 0;
  if (!SND.on) voice.pause(); paintSnd();
};
$('playBtn').onclick = () => {
  ctx(); const p = story.pages[page];
  if (p.game === 'end' || (page === story.pages.length - 1 && done.has(p.id))) { done.clear(); store.set(KEY.done, '[]'); showPage(0, 1); return; }
  openGame(p);
};

/* ---------------- the game panel ---------------- */
const cv = $('gc'), g = cv.getContext('2d');
// the game's own coordinates: 600x400 on a wide screen, 400 wide and taller on an upright phone (P)
let W = 600, H = 400, P = false;
let G = null, gPage = null, raf = 0, lastT = 0, msgCb = null, over = false, gTime = 0;
function fit() {
  const r = $('gWrap').getBoundingClientRect(), was = W + 'x' + H;
  P = r.width < r.height * .95;
  if (P) { W = 400; H = Math.round(clamp(400 * r.height / r.width, 520, 720)); } else { W = 600; H = 400; }
  const s = Math.min(r.width / W, r.height / H), dpr = Math.min(devicePixelRatio || 1, 2);
  if (G && was !== W + 'x' + H && !over) G.init();
  cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px';
  cv.width = Math.round(W * s * dpr); cv.height = Math.round(H * s * dpr);
  g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
}
addEventListener('resize', () => { if ($('play').classList.contains('on')) fit(); });
function openGame(p) {
  voice.pause(); gPage = p; G = GAMES[p.game]();
  { const pr = $('pic').getBoundingClientRect(), pl = $('play'); pl.style.setProperty('--pic', `url(assets/pages/${p.id}.jpg)`); pl.style.setProperty('--from', `${pr.top}px ${innerWidth - pr.right}px ${innerHeight - pr.bottom}px ${pr.left}px round 12px`); }
  $('gTitle').innerHTML = `${G.title}<small>${G.help}</small>`;
  $('play').classList.add('on'); fit(); over = true; gTime = 0;
  G.init(); draw();
  message(G.title, G.how || G.help, 'מַתְחִילִים!', () => { over = false; });
  cancelAnimationFrame(raf); lastT = performance.now(); raf = requestAnimationFrame(loop);
}
function closeGame() { $('play').classList.remove('on'); cancelAnimationFrame(raf); G = null; $('gMsg').classList.remove('on'); }
$('gClose').onclick = closeGame;
function message(h, p, btn, cb) {
  const m = $('gMsg'); m.querySelector('h2').textContent = h; m.querySelector('p').textContent = p;
  m.querySelector('button').textContent = btn; msgCb = cb; m.classList.add('on');
}
$('gMsg').querySelector('button').onclick = () => { $('gMsg').classList.remove('on'); const f = msgCb; msgCb = null; f && f(); };
function win(text) {
  if (over) return; over = true; play('win', .8);
  setTimeout(() => {
    const first = !done.has(gPage.id);
    done.add(gPage.id); store.set(KEY.done, JSON.stringify([...done]));
    // stats (Shlomi's /stats/): game_over = finished the book - won the last page's game
    if (page === story.pages.length - 1 && window.track) track('game_over', 'yosef');
    message('כׇּל הַכָּבוֹד!', text, 'לַסִּפּוּר', () => {
      closeGame(); $('stamp').classList.remove('on'); void $('stamp').offsetWidth; $('stamp').classList.add('on'); play('stamp', .9);
      const last = page === story.pages.length - 1; $('playBtn').querySelector('span').textContent = last ? 'מֵהַהַתְחָלָה' : 'לְשַׂחֵק שׁוּב'; $('playBtn').classList.toggle('gold', last); $('playBtn').classList.toggle('again', !last); renderStamps();
      if (page < story.pages.length - 1) { $('nextBtn').classList.add('glow'); setTimeout(() => $('nextBtn').classList.remove('glow'), 2500); }
    });
  }, 700);
}
function fail(text) {
  if (over) return; over = true; play('wrong', .6);
  setTimeout(() => message('אוֹי!', text, 'עוֹד פַּעַם', () => { G.init(); over = false; }), 500);
}
function loop(t) {
  const dt = Math.min(.05, (t - lastT) / 1000) * TEST_SPEED; lastT = t;
  if (G) { if (!over) { gTime += dt; G.update(dt); } fx.update(dt); draw(); }
  raf = requestAnimationFrame(loop);
}
function draw() { g.clearRect(0, 0, W, H); G.draw(); fx.draw(); }
function pt(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
cv.addEventListener('pointerdown', (e) => { if (!G || over) return; cv.setPointerCapture(e.pointerId); const p = pt(e); G.down && G.down(p.x, p.y); });
cv.addEventListener('pointermove', (e) => { if (!G || over) return; const p = pt(e); G.move && G.move(p.x, p.y, e.buttons || e.pressure > 0); });
cv.addEventListener('pointerup', (e) => { if (!G || over) return; const p = pt(e); G.up && G.up(p.x, p.y); });

/* little floating texts and sparkles */
const fx = {
  list: [],
  text(x, y, s, col = '#24304a') { this.list.push({ k: 't', x, y, s, col, t: 0 }); },
  burst(x, y, col = '#f2b632', n = 10) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), v = rnd(60, 180); this.list.push({ k: 'p', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, col, t: 0 }); } },
  update(dt) { for (const f of this.list) { f.t += dt; if (f.k === 'p') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 300 * dt; } else f.y -= 40 * dt; } this.list = this.list.filter((f) => f.t < (f.k === 'p' ? .6 : 1)); },
  draw() {
    for (const f of this.list) {
      g.globalAlpha = 1 - f.t / (f.k === 'p' ? .6 : 1);
      if (f.k === 'p') { g.fillStyle = f.col; g.beginPath(); g.arc(f.x, f.y, 4, 0, 7); g.fill(); }
      else { g.font = '900 26px Rubik'; g.direction = dirOf(f.s); g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = '#fff'; g.strokeText(f.s, f.x, f.y); g.fillStyle = f.col; g.fillText(f.s, f.x, f.y); }
    }
    g.globalAlpha = 1;
  },
};

/* ---------------- painted art: scene backgrounds + object sprites (drawings below are only the fallback) ---------------- */
const SPR = {}, SCN = {};
['card', 'phone', 'pizza', 'burger', 'falafel', 'sushi', 'diamond', 'diamond-crack', 'pot', 'pot-open', 'lid', 'truck', 'stew', 'shtender', 'laptop', 'gemara', 'zvi-sign', 'workers', 'puddle', 'boxes', 'stroller', 'door', 'cap', 'shtender2', 'pop-a', 'pop-b', 'bonked-a', 'bonked-b', 'zvi-up-r', 'zvi-hit-r', 'zvi-up-l', 'zvi-hit-l', 'coin', 'attic', 'attic-gold',
  'face-yosef', 'face-a', 'face-b', 'face-c', 'face-d', 'face-e', 'face-f', 'face-g', 'face-h', 'face-i'].forEach((n) => { const im = new Image(); im.src = `assets/sprites/${n}.png`; SPR[n] = im; });
['office', 'screen', 'velvet', 'highway', 'kitchen', 'yeshiva', 'street', 'whack-bg', 'night'].forEach((n) => { const im = new Image(); im.src = `assets/play/${n}.jpg`; SCN[n] = im; });
const ok = (im) => im && im.complete && im.naturalWidth > 0;
const has = (n) => ok(SPR[n]);
// a sprite centred on x,y, w wide (keeps its own shape), turned by rot
function spr(n, x, y, w, rot = 0) {
  const im = SPR[n]; if (!ok(im)) return false;
  const h = w * im.naturalHeight / im.naturalWidth;
  if (rot) { g.save(); g.translate(x, y); g.rotate(rot); g.drawImage(im, -w / 2, -h / 2, w, h); g.restore(); }
  else g.drawImage(im, x - w / 2, y - h / 2, w, h);
  return true;
}
// the game's scene, filling the play area (cover)
function scene(n) {
  const im = SCN[n]; if (!ok(im)) return false;
  const s = Math.max(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * s, h = im.naturalHeight * s;
  g.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); return true;
}

/* ---------------- simple drawings (flat, soft outlines - the book's look) ---------------- */
const INK = '#24304a';
function shape(fill, lw = 3) { g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = INK; g.stroke(); }
function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function circle(x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); }
const dirOf = (s) => /[\u0590-\u05FF]/.test(s) ? 'rtl' : 'ltr';
function label(s, x, y, size = 22, col = INK, align = 'center', font = 'Rubik') { g.direction = dirOf(s); g.font = `900 ${size}px ${font}`; g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = col; g.fillText(s, x, y); }
function outlined(s, x, y, size = 26, col = INK) { g.direction = dirOf(s); g.font = `900 ${size}px Rubik`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 6; g.strokeStyle = '#fff'; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y); }
function coin(x, y, r = 20) {
  if (spr('coin', x, y, r * 2.2)) return;
  circle(x, y, r); shape('#f5c542'); circle(x, y, r * .72); g.lineWidth = 2; g.strokeStyle = '#c99417'; g.stroke();
  label('₪', x, y + 1, r * .95, '#a5740c');
}
function food(kind, x, y, s = 1) {
  if (spr(kind, x, y, 60 * s)) return;
  g.save(); g.translate(x, y); g.scale(s, s);
  if (kind === 'pizza') { g.beginPath(); g.moveTo(-22, -18); g.lineTo(22, -18); g.lineTo(0, 24); g.closePath(); shape('#f7c95c'); rr(-24, -24, 48, 9, 5); shape('#d99a3d'); for (const [a, b] of [[-8, -6], [6, -4], [0, 8]]) { circle(a, b, 4); shape('#d9534f', 2); } }
  else if (kind === 'burger') { g.beginPath(); g.ellipse(0, -8, 24, 14, 0, Math.PI, 0); g.closePath(); shape('#e8a54b'); rr(-25, -6, 50, 8, 4); shape('#6b3e26'); rr(-23, 3, 46, 5, 3); shape('#7cc35a', 2); rr(-24, 9, 48, 10, 5); shape('#e8a54b'); }
  else if (kind === 'falafel') { g.beginPath(); g.arc(0, 0, 24, .2, Math.PI - .2); g.closePath(); shape('#f1d9a6'); for (const [a, b] of [[-9, 2], [3, 0], [12, 5], [-2, 10]]) { circle(a, b - 6, 6); shape('#9b6a2f', 2); } }
  else if (kind === 'sushi') { rr(-20, -12, 40, 24, 10); shape('#fff'); rr(-14, -16, 28, 10, 5); shape('#f08a5d'); rr(-20, 0, 40, 6, 2); shape('#2f4f3a', 2); }
  g.restore();
}
// the orange meal card (תן ביס) - fork and knife, no logo
function mealCard(x, y, s = 1, a = 0) {
  if (spr('card', x, y, 64 * s, a)) return;
  g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
  rr(-26, -17, 52, 34, 6); shape('#f36f21'); rr(-20, -6, 10, 8, 2); g.fillStyle = '#f5c542'; g.fill();
  g.lineWidth = 3; g.strokeStyle = '#fff'; g.lineCap = 'round';
  g.beginPath(); g.moveTo(6, -9); g.lineTo(6, 10); g.moveTo(2, -9); g.lineTo(2, -2); g.moveTo(10, -9); g.lineTo(10, -2); g.moveTo(2, -2); g.lineTo(10, -2); g.stroke();
  g.beginPath(); g.moveTo(17, -9); g.quadraticCurveTo(22, -2, 17, 2); g.lineTo(17, 10); g.stroke(); g.lineCap = 'butt';
  g.restore();
}
// the phone with the orange app: the saved balance fills up
function wallet(x, y, f = 0) {
  if (has('phone')) { spr('phone', x, y - 6, 92); bar(x - 46, y + 58, 92, 14, f, '#3aa565'); return; }
  rr(x - 40, y - 46, 80, 92, 12); shape('#2b2f3a'); rr(x - 33, y - 39, 66, 74, 6); g.fillStyle = '#f36f21'; g.fill();
  rr(x - 25, y + 8, 50, 12, 6); g.fillStyle = '#fff'; g.fill(); if (f > 0) { rr(x - 23, y + 10, 46 * clamp(f, 0, 1), 8, 4); g.fillStyle = '#3aa565'; g.fill(); }
  g.lineWidth = 3; g.strokeStyle = '#fff'; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x - 6, y - 26); g.lineTo(x - 6, y - 4); g.moveTo(x - 10, y - 26); g.lineTo(x - 10, y - 18); g.moveTo(x - 2, y - 26); g.lineTo(x - 2, y - 18); g.moveTo(x - 10, y - 18); g.lineTo(x - 2, y - 18); g.stroke();
  g.beginPath(); g.moveTo(x + 7, y - 26); g.quadraticCurveTo(x + 12, y - 18, x + 7, y - 14); g.lineTo(x + 7, y - 4); g.stroke(); g.lineCap = 'butt';
}
// a man's head and shoulders: kippa black|knit|none, glasses, beard black|brown|white|none, shirt colour
function man(x, y, s, o) {
  if (o.face && spr('face-' + o.face, x, y + 8 * s, 104 * s)) return;
  g.save(); g.translate(x, y); g.scale(s, s);
  rr(-30, 26, 60, 40, 18); shape(o.shirt || '#fff');
  if (o.jacket) { g.beginPath(); g.moveTo(-30, 44); g.lineTo(-30, 66); g.lineTo(-6, 66); g.lineTo(-12, 30); g.closePath(); shape('#2a2a33'); g.beginPath(); g.moveTo(30, 44); g.lineTo(30, 66); g.lineTo(6, 66); g.lineTo(12, 30); g.closePath(); shape('#2a2a33'); }
  circle(0, 0, 26); shape('#f6d2b0');
  if (o.beard && o.beard !== 'none') { const c = { black: '#2b2523', brown: '#7a4a2a', white: '#e9e6e0', red: '#b5552b' }[o.beard]; g.beginPath(); g.moveTo(-25, 9); g.quadraticCurveTo(-22, 42, 0, 44); g.quadraticCurveTo(22, 42, 25, 9); g.quadraticCurveTo(14, 15, 0, 13); g.quadraticCurveTo(-14, 15, -25, 9); g.closePath(); shape(c); g.beginPath(); g.ellipse(0, 19, 6, 4, 0, 0, 7); g.fillStyle = '#c96a5a'; g.fill(); }
  circle(-9, -3, 3); g.fillStyle = INK; g.fill(); circle(9, -3, 3); g.fill();
  if (o.glasses) { g.lineWidth = 2.5; g.strokeStyle = INK; circle(-9, -3, 8); g.stroke(); circle(9, -3, 8); g.stroke(); g.beginPath(); g.moveTo(-1, -3); g.lineTo(1, -3); g.stroke(); }
  if (!o.beard || o.beard === 'none') { g.beginPath(); g.arc(0, 8, 8, .3, Math.PI - .3); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke(); }
  g.fillStyle = o.hair || '#2b2523'; g.beginPath(); g.arc(0, -4, 26, Math.PI * 1.05, Math.PI * 1.95); g.fill();
  if (o.kippa === 'black') { g.beginPath(); g.ellipse(0, -22, 17, 9, 0, Math.PI, 0); g.closePath(); shape('#1d1d24'); }
  else if (o.kippa === 'knit') { g.beginPath(); g.ellipse(0, -23, 13, 7, 0, Math.PI, 0); g.closePath(); shape('#4f8fd6'); g.lineWidth = 2; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(-8, -26); g.lineTo(8, -26); g.stroke(); }
  else if (o.kippa === 'cap') { g.beginPath(); g.ellipse(0, -18, 25, 13, 0, Math.PI, 0); g.closePath(); shape('#d9534f'); rr(-2, -21, 34, 7, 3); shape('#d9534f', 2); }
  g.restore();
}
function diamond(x, y, s, crack, glint = 0) {
  const painted = spr(crack ? 'diamond-crack' : 'diamond', x, y, 62 * s);
  g.save(); g.translate(x, y); g.scale(s, s);
  if (painted) { if (glint > 0) sparkle(glint); g.restore(); return; }
  g.beginPath(); g.moveTo(-24, -8); g.lineTo(-12, -22); g.lineTo(12, -22); g.lineTo(24, -8); g.lineTo(0, 24); g.closePath(); shape('#bfe9ff', 3 / s);
  g.beginPath(); g.moveTo(-24, -8); g.lineTo(24, -8); g.moveTo(-12, -22); g.lineTo(-6, -8); g.lineTo(0, 24); g.lineTo(6, -8); g.lineTo(12, -22); g.lineWidth = 1.6 / s; g.strokeStyle = '#4a7fa8'; g.stroke();
  g.beginPath(); g.moveTo(-16, -10); g.lineTo(-9, -19); g.lineTo(-4, -10); g.closePath(); g.fillStyle = '#fff'; g.fill();
  if (crack) { g.beginPath(); g.moveTo(8, -20); g.lineTo(3, -10); g.lineTo(9, -2); g.lineTo(2, 10); g.lineWidth = 2.5 / s; g.strokeStyle = '#3a3a48'; g.stroke(); }
  if (glint > 0) sparkle(glint);
  g.restore();
}
function sparkle(glint) { g.globalAlpha = glint; g.fillStyle = '#fff'; for (const [a, b, r] of [[18, -24, 5], [-22, 4, 3.5]]) { g.beginPath(); g.moveTo(a, b - r * 2); g.lineTo(a + r * .5, b); g.lineTo(a, b + r * 2); g.lineTo(a - r * .5, b); g.closePath(); g.fill(); g.beginPath(); g.moveTo(a - r * 2, b); g.lineTo(a, b + r * .5); g.lineTo(a + r * 2, b); g.lineTo(a, b - r * .5); g.closePath(); g.fill(); } g.globalAlpha = 1; }
function pot(x, y, s = 1, lid = 0) {
  if (has('pot') && has('pot-open') && has('lid')) {
    if (lid <= 0.02) { spr('pot', x, y - 6 * s, 128 * s); return; }
    spr('pot-open', x, y, 128 * s); spr('lid', x - lid * 20 * s, y - 44 * s - lid * 46 * s, 112 * s, -lid * .45); return;
  }
  g.save(); g.translate(x, y); g.scale(s, s);
  rr(-48, -30, 96, 62, 14); shape('#7d8b99'); rr(-58, -20, 12, 10, 4); shape('#5d6a77'); rr(46, -20, 12, 10, 4); shape('#5d6a77');
  g.save(); g.translate(0, -32 - lid * 40); g.rotate(-lid * .4);
  g.beginPath(); g.ellipse(0, 0, 52, 11, 0, 0, 7); shape('#98a6b4'); rr(-9, -14, 18, 10, 4); shape('#5d6a77');
  g.restore(); g.restore();
}
function hat(x, y, s = 1) {
  if (spr('hat', x, y, 84 * s)) return;
  g.save(); g.translate(x, y); g.scale(s, s);
  g.beginPath(); g.ellipse(0, 6, 34, 8, 0, 0, 7); shape('#6b4a32'); rr(-20, -20, 40, 28, 10); shape('#7d5a3e'); rr(-20, -2, 40, 7, 2); shape('#3a2a20', 2);
  g.restore();
}
function bug(x, y, a, s = 1, flat = 0) {
  if (spr(flat ? 'splat' : 'bug', x, y, 50 * s, a + Math.PI / 2)) return;
  g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s * (1 - flat * .5));
  g.lineWidth = 2.5; g.strokeStyle = INK;
  for (const k of [-1, 1]) for (const d of [-7, 0, 7]) { g.beginPath(); g.moveTo(d, 0); g.lineTo(d + 4, k * 15); g.stroke(); }
  g.beginPath(); g.ellipse(0, 0, 14, 10, 0, 0, 7); shape(flat ? '#7a8a50' : '#9ccc3c'); circle(14, 0, 6); shape('#556b2f');
  g.beginPath(); g.moveTo(-14, 0); g.lineTo(10, 0); g.lineWidth = 2; g.stroke();
  if (!flat) { circle(16, -2, 1.8); g.fillStyle = '#fff'; g.fill(); circle(16, 2, 1.8); g.fill(); }
  g.restore();
}
function item(kind, x, y, s = 1) {
  const SZ = { challah: 84, wine: 44, candles: 64, cup: 46, plate: 72, icecream: 44, chips: 52, ball: 54, soda: 34, cholent: 92 };
  if (spr(kind === 'cholent' ? 'pot' : kind, x, y, (SZ[kind] || 60) * s)) return;
  g.save(); g.translate(x, y); g.scale(s, s);
  switch (kind) {
    case 'challah': g.beginPath(); g.ellipse(0, 4, 34, 18, 0, 0, 7); shape('#d98e3a'); for (const d of [-16, 0, 16]) { g.beginPath(); g.ellipse(d, -2, 11, 13, 0, 0, 7); shape('#e8a54b', 2); } break;
    case 'wine': rr(-11, -12, 22, 40, 6); shape('#7b1e3a'); rr(-5, -30, 10, 20, 3); shape('#7b1e3a'); rr(-9, 0, 18, 12, 2); shape('#fff6dd', 2); break;
    case 'cup': g.beginPath(); g.moveTo(-16, -22); g.lineTo(16, -22); g.lineTo(11, 0); g.lineTo(-11, 0); g.closePath(); shape('#e9c35a'); rr(-3, 0, 6, 14, 2); shape('#e9c35a', 2); rr(-13, 13, 26, 7, 3); shape('#e9c35a', 2); break;
    case 'candles': for (const d of [-12, 12]) { rr(d - 9, 6, 18, 14, 3); shape('#c9d1d9', 2); rr(d - 5, -22, 10, 30, 2); shape('#fffdf6', 2); g.beginPath(); g.ellipse(d, -30, 4.5, 8, 0, 0, 7); shape('#f2b632', 2); } break;
    case 'cholent': pot(0, 4, .62, 0); label("צ'וֹלֶנְט", 0, 8, 13, '#fff'); break;
    case 'icecream': g.beginPath(); g.moveTo(-14, -4); g.lineTo(14, -4); g.lineTo(0, 30); g.closePath(); shape('#e8b36b'); circle(0, -12, 15); shape('#f7a8c4'); break;
    case 'chips': g.beginPath(); g.moveTo(-18, -26); g.lineTo(18, -26); g.lineTo(22, 28); g.lineTo(-22, 28); g.closePath(); shape('#f2c94c'); circle(0, 2, 10); shape('#e8833a', 2); break;
    case 'ball': circle(0, 0, 22); shape('#fff'); g.beginPath(); g.moveTo(0, -22); g.lineTo(0, 22); g.moveTo(-22, 0); g.lineTo(22, 0); g.lineWidth = 2.5; g.stroke(); break;
    case 'soda': rr(-13, -26, 26, 54, 8); shape('#d9534f'); rr(-13, -6, 26, 14, 2); shape('#fff', 2); break;
    case 'plate': g.beginPath(); g.ellipse(0, 0, 30, 20, 0, 0, 7); shape('#fff'); g.beginPath(); g.ellipse(0, 0, 19, 12, 0, 0, 7); g.lineWidth = 2; g.strokeStyle = '#c9d1d9'; g.stroke(); break;
    case 'phone': rr(-16, -28, 32, 56, 7); shape('#2b2f3a'); rr(-12, -22, 24, 40, 3); g.fillStyle = s.off ? '#111' : '#7cc3f5'; g.fill(); break;
  }
  g.restore();
}
function phone(x, y, ringing, off, t) {
  const sh = ringing && !off ? Math.sin(t * 50) * 3 : 0;
  if (spr('phone-ring', x + sh, y, 70, sh * .02)) return;
  g.save(); g.translate(x + sh, y);
  rr(-17, -30, 34, 60, 8); shape('#2b2f3a'); rr(-13, -24, 26, 44, 3); g.fillStyle = off ? '#14161c' : '#7cc3f5'; g.fill();
  if (!off) { circle(0, -4, 7); g.fillStyle = '#3aa565'; g.fill(); label('בּוֹס', 0, 12, 10, '#fff'); }
  g.restore();
  if (ringing && !off) { g.lineWidth = 3; g.strokeStyle = '#d9534f'; for (const r of [26, 36]) { g.beginPath(); g.arc(x, y, r + (t * 30 % 10), -.6, .6); g.stroke(); g.beginPath(); g.arc(x, y, r + (t * 30 % 10), Math.PI - .6, Math.PI + .6); g.stroke(); } }
}
function bg(top, bottom) { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
function bar(x, y, w, h, f, col) { rr(x, y, w, h, h / 2); shape('#fff', 2.5); if (f > 0) { rr(x + 3, y + 3, (w - 6) * clamp(f, 0, 1), h - 6, (h - 6) / 2); g.fillStyle = col; g.fill(); } }
const near = (a, b, r) => Math.hypot(a.x - b.x, a.y - b.y) < r;

/* ---------------- the games, one per page ---------------- */
// every game lays itself out in init() from W, H and P (upright phone), so it fills the screen either way
const DAYS = ['רִאשׁוֹן', 'שֵׁנִי', 'שְׁלִישִׁי', 'רְבִיעִי', 'חֲמִישִׁי'];
const GAMES = {
  // p01: catch the orange meal cards in the phone, let the lunch offers fall by
  coins: () => {
    let wx, wy, items, got, spawn, shake;
    return {
      title: 'חוֹסְכִים תֵּן בִּיס', help: 'תּוֹפְסִים אֶת הַכַּרְטִיס הַכָּתֹם בַּטֶּלֶפוֹן. אֹכֶל – לֹא תּוֹפְסִים!',
      how: 'גּוֹרְרִים אֶת הַטֶּלֶפוֹן יָמִינָה וּשְׂמֹאלָה. כַּרְטִיס תֵּן בִּיס כָּתֹם – תּוֹפְסִים וְחוֹסְכִים לְשַׁבָּת. אֹכֶל – נוֹתְנִים לוֹ לִפֹּל!',
      init() { wx = W / 2; wy = H - 62; items = []; got = 0; spawn = .5; shake = 0; },
      update(dt) {
        spawn -= dt; shake = Math.max(0, shake - dt);
        if (spawn <= 0) { spawn = rnd(.55, .9); items.push({ x: rnd(40, W - 40), y: -30, c: Math.random() < .55, k: pick(['pizza', 'burger', 'falafel', 'sushi']), v: (rnd(130, 170) + got * 12) * H / 400 * (P ? .8 : 1), a: rnd(-1, 1) }); }
        for (const it of items) { it.y += it.v * dt; it.a += dt; }
        for (const it of items) if (!it.done && it.y > wy - 42 && it.y < wy + 10 && Math.abs(it.x - wx) < 56) {
          it.done = true;
          if (it.c) { got++; play('coin', .7); fx.text(wx, wy - 60, '+ תֵּן בִּיס', '#f36f21'); fx.burst(wx, wy - 20); if (got >= 10) win('חָסַכְתָּ אֶת הַתֵּן בִּיס שֶׁל כׇּל הַשָּׁבוּעַ – לְשַׁבָּת!'); }
          else { got = Math.max(0, got - 1); shake = .4; play('wrong', .5); fx.text(wx, wy - 60, 'בִּזְבַּזְתָּ אֶת הַתֵּן בִּיס!', '#d9534f'); }
        }
        items = items.filter((it) => !it.done && it.y < H + 40);
      },
      draw() {
        if (!scene('office')) { bg('#dff0fb', '#fffdf6'); g.fillStyle = '#9cc3e0'; for (const [x, w, h] of [[.07, .12, .55], [.23, .15, .72], [.78, .13, .62]]) { rr(x * W, H - h * H, w * W, h * H, 4); g.fill(); } }
        rr(W / 2 - 180, 8, 360, 76, 16); g.fillStyle = '#fffdf6dd'; g.fill();
        label('יוֹם ' + DAYS[Math.min(4, Math.floor(got / 2))], W / 2, 28, 24);
        const gap = Math.min(34, (W - 30) / 10);
        for (let i = 0; i < 10; i++) { const x = W / 2 - (i - 4.5) * gap; if (i < got) mealCard(x, 62, .55); else { circle(x, 62, 12); g.lineWidth = 2; g.strokeStyle = '#c5b98f'; g.setLineDash([4, 4]); g.stroke(); g.setLineDash([]); } }
        for (const it of items) { if (it.c) mealCard(it.x, it.y, 1.1, Math.sin(it.a) * .3); else food(it.k, it.x, it.y, 1.15); }
        wallet(wx + (shake ? Math.sin(shake * 60) * 6 : 0), wy, got / 10);
      },
      down(x) { wx = clamp(x, 45, W - 45); }, move(x, y, b) { if (b) wx = clamp(x, 45, W - 45); },
    };
  },
  // p02: find Yosef among the faces on the lawyer's AI screen
  find: () => {
    let round, faces, bad, ok;
    const YOS = { kippa: 'black', glasses: true, beard: 'black', shirt: '#fff' };
    const make = () => {
      const cols = P ? 3 : 4, rows = round === 0 ? 2 + (P ? 1 : 0) : (P ? 4 : 3), n = cols * rows, list = [];
      while (list.length < n - 1) {
        const f = { kippa: pick(['black', 'knit', 'none', 'cap']), glasses: Math.random() < .5, beard: pick(['black', 'brown', 'white', 'none', 'red']), shirt: pick(['#fff', '#cfe3f5', '#f5e1b8', '#d8f0d0']) };
        if (round > 0 && Math.random() < .6) { const k = pick(['kippa', 'glasses', 'beard']); Object.assign(f, YOS); f[k] = k === 'glasses' ? false : k === 'kippa' ? pick(['knit', 'none']) : pick(['brown', 'white', 'none']); }
        if (f.kippa === 'black' && f.glasses && f.beard === 'black') continue;
        if (f.kippa === 'black' && round > 0) f.jacket = Math.random() < .5;
        list.push(f);
      }
      const close = ['a', 'b', 'd', 'h', 'g'], far = ['c', 'e', 'f', 'i'];
      list.forEach((f) => { f.face = round === 0 ? pick(far.concat(['g'])) : pick(Math.random() < .65 ? close : far); });
      list.push({ ...YOS, me: true, face: 'yosef' }); shuffle(list);
      const top = 56, cw = (W - 20) / cols, ch = (H - top - 14) / rows, s = Math.min(cw, ch) / 112;
      faces = list.map((f, i) => ({ ...f, x: 10 + cw * (i % cols + .5), y: top + ch * (Math.floor(i / cols) + .5) - 8 * s, s }));
      bad = null; ok = null;
    };
    return {
      title: 'אֵיפֹה יוֹסֵף?', help: 'יוֹסֵף: כִּפָּה שְׁחוֹרָה, מִשְׁקָפַיִם וְזָקָן שָׁחֹר',
      how: 'הַבִּינָה הַמְּלָאכוּתִית שֶׁל צְבִי מְחַפֶּשֶׂת אֶת יוֹסֵף מוֹקִיר שַׁבָּת. מִצְאוּ אוֹתוֹ: כִּפָּה שְׁחוֹרָה, מִשְׁקָפַיִם וְזָקָן שָׁחֹר. שָׁלוֹשׁ פְּעָמִים!',
      init() { round = 0; make(); },
      update(dt) { if (bad) bad.t -= dt; if (bad && bad.t <= 0) bad = null; if (ok) { ok.t -= dt; if (ok.t <= 0) { ok = null; round++; if (round >= 3) win('מְצָאתֶם אֶת יוֹסֵף – בְּדִיּוּק כְּמוֹ הַמַּעֲרֶכֶת!'); else make(); } } },
      draw() {
        if (!scene('screen')) { rr(4, 4, W - 8, H - 8, 16); shape('#16233d'); g.fillStyle = '#ffffff08'; for (let y = 10; y < H; y += 6) g.fillRect(8, y, W - 16, 2); }
        label('מַעֲרֶכֶת בִּינָה מְלָאכוּתִית', W / 2, 28, 18, '#7cc3f5'); label(`${Math.min(round + 1, 3)} / 3`, 36, 28, 16, '#7cc3f5');
        for (const f of faces) {
          const wob = bad && bad.f === f ? Math.sin(bad.t * 60) * 5 : 0;
          circle(f.x + wob, f.y + 6 * f.s, 48 * f.s); g.fillStyle = '#24406ecc'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#7cc3f5'; g.stroke();
          man(f.x + wob, f.y, f.s, f);
          if (ok && f.me) { circle(f.x, f.y + 6 * f.s, 52 * f.s); g.lineWidth = 6; g.strokeStyle = '#3aa565'; g.stroke(); }
        }
      },
      down(x, y) {
        if (ok) return;
        for (const f of faces) if (Math.hypot(x - f.x, y - f.y - 6 * f.s) < 50 * f.s) {
          if (f.me) { ok = { t: .9 }; play('pop', .8); fx.burst(f.x, f.y, '#7cc3f5'); fx.text(f.x, f.y - 50 * f.s, 'יוֹסֵף!', '#3aa565'); }
          else { bad = { f, t: .4 }; play('wrong', .5); }
          return;
        }
      },
    };
  },
  // p03: pick the biggest diamond - without a crack
  diamond: () => {
    let round, gems, glint, picked, tray;
    const make = () => {
      const sizes = shuffle([.9, 1.05, 1.2, 1.35, 1.6]), k = P ? 1.25 : 1;
      // upright: 3 above, 2 below; wide: one row of 5
      const spots = P ? [[-1, 0], [0, 0], [1, 0], [-.5, 1], [.5, 1]] : [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]];
      const dx = P ? 120 : 108, dy = 150, y0 = P ? tray.y + tray.h / 2 - dy / 2 : tray.y + tray.h / 2;
      gems = sizes.map((s, i) => ({ s: s * k, x: W / 2 + spots[i][0] * dx, y: y0 + spots[i][1] * dy, crack: false }));
      const best = gems.reduce((a, b) => b.s > a.s ? b : a); best.best = true;
      if (round > 0) { best.crack = true; best.best = false; best.s += .25 * k; gems.filter((q) => !q.crack).sort((a, b) => b.s - a.s)[0].best = true; }
      picked = null;
    };
    return {
      title: 'הַיַּהֲלוֹם הֲכִי גָּדוֹל', help: 'בּוֹחֲרִים אֶת הַגָּדוֹל בְּיוֹתֵר – בְּלִי סְדָקִים!',
      how: 'צְבִי קוֹנֶה בְּכָל הַכֶּסֶף יַהֲלוֹם אֶחָד. עִזְרוּ לוֹ לִבְחֹר אֶת הֲכִי גָּדוֹל – אֲבָל יַהֲלוֹם עִם סֶדֶק לֹא שָׁוֶה כְּלוּם!',
      init() { tray = P ? { x: 16, y: 90, w: W - 32, h: H - 130 } : { x: 30, y: 110, w: 540, h: 210 }; round = 0; glint = 0; make(); },
      update(dt) { glint += dt; if (picked) { picked.t -= dt; if (picked.t <= 0) { if (picked.ok) { round++; if (round >= 3) { picked = null; win('בָּחַרְתָּ יַהֲלוֹם מֻשְׁלָם!'); return; } make(); } else picked = null; } } },
      draw() {
        if (!scene('velvet')) { bg('#f4ecdf', '#e9dcc5'); rr(tray.x, tray.y, tray.w, tray.h, 26); shape('#2c3e72'); rr(tray.x + 14, tray.y + 14, tray.w - 28, tray.h - 28, 18); g.fillStyle = '#34488a'; g.fill(); }
        outlined('הַבּוּרְסָה לְיַהֲלוֹמִים', W / 2, 40, 24); outlined(`${Math.min(round + 1, 3)} / 3`, 36, 40, 16);
        gems.forEach((q, i) => { diamond(q.x, q.y, q.s, q.crack, (Math.sin(glint * 3 + i) + 1) / 2 * .9); if (picked && picked.q === q) { circle(q.x, q.y, 34 * q.s + 8); g.lineWidth = 5; g.strokeStyle = picked.ok ? '#3aa565' : '#d9534f'; g.stroke(); } });
      },
      down(x, y) {
        if (picked) return;
        for (const q of gems) if (Math.hypot(x - q.x, y - q.y) < 30 * q.s + 14) {
          const ok = !!q.best; picked = { q, ok, t: ok ? .8 : .7 };
          if (ok) { play('coin', .8, 1.3); fx.burst(q.x, q.y, '#bfe9ff', 14); }
          else { play('wrong', .5); fx.text(q.x, q.y - 34 * q.s - 20, q.crack ? 'יֵשׁ סֶדֶק!' : 'יֵשׁ גָּדוֹל יוֹתֵר', '#d9534f'); }
          return;
        }
      },
    };
  },
  // p06: the diamond rolls into a cholent pot on the truck - which one, after they swap?
  pots: () => {
    let round, wins, pots, ph, t, hatIn, swaps, sw, reveal, X, PY, PS;
    const start = () => {
      pots = [0, 1, 2].map((i) => ({ id: i, slot: i, x: X[i], y: PY, lid: 1 })); hatIn = irnd(0, 2); ph = 'drop'; t = 0; reveal = null;
      swaps = 3 + round * 2; sw = null;
    };
    return {
      title: 'אֵיפֹה הַיַּהֲלוֹם?', help: 'עוֹקְבִים אַחֲרֵי הַסִּיר שֶׁבּוֹ נָפַל הַיַּהֲלוֹם',
      how: 'הַיַּהֲלוֹם מִתְגַּלְגֵּל לְתוֹךְ סִיר צ\'וֹלֶנְט, וְהַסִּירִים מִתְעַרְבְּבִים עַל הַמַּשָּׂאִית. עִקְבוּ בָּעֵינַיִם – וְהַקִּישׁוּ עַל הַסִּיר הַנָּכוֹן!',
      init() { PS = P ? .82 : 1; const d = P ? 128 : 140; X = [W / 2 - d, W / 2, W / 2 + d]; PY = P ? H * .6 : 250; round = 0; wins = 0; start(); },
      update(dt) {
        t += dt;
        if (ph === 'drop' && t > 1.4) { ph = 'close'; t = 0; play('lid', .7); }
        if (ph === 'close') { pots.forEach((p) => p.lid = Math.max(0, 1 - t * 3)); if (t > .6) { ph = 'mix'; t = 0; } }
        if (ph === 'mix') {
          const dur = Math.max(.32, .7 - round * .14);
          if (!sw) { if (swaps <= 0) { ph = 'pick'; return; } const [a, b] = shuffle([0, 1, 2]).slice(0, 2); sw = { a: pots.find((p) => p.slot === a), b: pots.find((p) => p.slot === b), t: 0, dur }; play('whoosh', .35); swaps--; }
          sw.t += dt; const k = Math.min(1, sw.t / sw.dur), e = k * k * (3 - 2 * k);
          const xa = X[sw.a.slot], xb = X[sw.b.slot];
          sw.a.x = xa + (xb - xa) * e; sw.b.x = xb + (xa - xb) * e; sw.a.y = PY - Math.sin(e * Math.PI) * 26; sw.b.y = PY + Math.sin(e * Math.PI) * 14;
          if (k >= 1) { const s = sw.a.slot; sw.a.slot = sw.b.slot; sw.b.slot = s; sw.a.y = sw.b.y = PY; sw = null; }
        }
        if (ph === 'reveal') { pots.forEach((p) => { if (p === reveal.p || (!reveal.ok && p.id === hatIn)) p.lid = Math.min(1, p.lid + dt * 3); }); if (t > 1.3) { if (reveal.ok) { wins++; if (wins >= 3) { ph = 'done'; win('מְצָאתֶם אֶת הַיַּהֲלוֹם – בְּתוֹךְ הַצ\'וֹלֶנְט!'); return; } round++; } start(); } }
      },
      draw() {
        const by = PY - (P ? 170 : 130);
        if (!scene('highway')) { bg('#2b3a67', '#5b6fa8'); g.fillStyle = '#fffbe0'; circle(W - 70, 50, 22); g.fill(); rr(0, by, W, 20, 0); g.fillStyle = '#8e8e9a'; g.fill(); }
        if (!spr('truck', W / 2 - W * .06, PY + 40, W * 1.12)) { rr(20, PY + 35, W - 40, 40, 8); shape('#f5f1e6'); label('הַמִּסְעָדָה הַיְּהוּדִית', W / 2, PY + 56, 18, '#7b1e3a'); for (const x of [80, W - 80]) { circle(x, PY + 86, 24); shape('#2b2f3a'); circle(x, PY + 86, 9); shape('#c9d1d9', 2); } }
        outlined(`${Math.min(wins + 1, 3)} / 3`, 36, 30, 16);
        if (ph === 'drop') { const k = Math.min(1, t / 1.1); diamond(X[hatIn] + (1 - k) * 80, by + 10 + k * (PY - by - 40), .8, false, .8); }
        pots.forEach((p) => { pot(p.x, p.y, PS, p.lid); if (p.lid > .5 && p.id === hatIn && ph !== 'drop') diamond(p.x, p.y - 40 * PS, .6, false, .8); });
        if (ph === 'pick') outlined('אֵיפֹה הַיַּהֲלוֹם?', W / 2, PY - 100, 30);
      },
      down(x, y) {
        if (ph !== 'pick') return;
        for (const p of pots) if (Math.abs(x - p.x) < 62 * PS && Math.abs(y - p.y) < 70) {
          const ok = p.id === hatIn; reveal = { p, ok }; ph = 'reveal'; t = 0; play('lid', .7);
          setTimeout(() => { if (ok) { play('pop', .8); fx.burst(p.x, p.y - 40); } else play('wrong', .5); }, 250);
          return;
        }
      },
    };
  },
  // p02: whack-a-mole - Haredim pop out of the "עולמה של תורה" shtenders with a laptop, dreaming of the modern hi-tech city;
  // Zvi jumps over and brings his "שוויון בנטל" sign down on the head - and they sink back to the Gemara
  whack: () => {
    const NEED = 12, TIME = 45, HIT = .13;
    let slots, got, spawn, zvi, escaped;
    // Zvi stands beside the head so the sign comes down on it; facing right he stands on its left, facing left - on its right
    const zw = () => P ? 172 : 140;
    const zh = (n) => { const im = SPR[n]; return ok(im) ? zw() * im.naturalHeight / im.naturalWidth : zw() * 1.2; };
    const spot = (x, headY) => { const d = x < W * .5 ? 'l' : 'r', w = zw(), h = zh('zvi-hit-' + d); return { d, x: x + (d === 'r' ? -w * .3 : w * .3), y: Math.max(h * .5 + 2, headY - h * .4) }; };
    return {
      title: 'צְבִי מְגַיֵּס', help: `מַקִּישִׁים עַל מִי שֶׁמֵּצִיץ – ${NEED} פְּעָמִים`,
      how: 'מִתּוֹךְ הַסְּטֶנְדֶּרִים שֶׁל עוֹלָמָהּ שֶׁל תּוֹרָה מְצִיצִים חֲרֵדִים עִם מַחְשֵׁב – הֵם רוֹצִים לָצֵאת לָעוֹלָם הַמּוֹדֶרְנִי, לָעֲבֹד בְּהַיְטֶק! הַקִּישׁוּ עֲלֵיהֶם מַהֵר – וּצְבִי מוֹרִיד עֲלֵיהֶם אֶת הַשֶּׁלֶט "שִׁוְיוֹן בַּנֵּטֶל", וְהֵם חוֹזְרִים לַגְּמָרָא.',
      init() {
        // rows of shtenders on the floor, the back rows smaller (like holes in a lawn)
        const rows = P ? [2, 3, 2, 3] : [3, 4, 3], top = P ? H * .42 : H * .58, bot = H - (P ? 58 : 46);
        slots = []; rows.forEach((n, r) => { const k = rows.length > 1 ? r / (rows.length - 1) : 1, y = top + (bot - top) * k, sc = .72 + k * .28, w = Math.min(W / (n + .6), P ? 128 : 120) * sc;
          for (let i = 0; i < n; i++) slots.push({ x: W / 2 + (i - (n - 1) / 2) * (W - 30) / (n + .25), y, w, who: null }); });
        got = 0; spawn = .6; escaped = 0; gTime = 0;
        zvi = { x: P ? 70 : 70, y: P ? H * .22 : H * .3, d: 'r', pose: 'up', t: 9, fx: 0, fy: 0, tx: 0, ty: 0 };
      },
      update(dt) {
        spawn -= dt;
        const free = slots.filter((s) => !s.who);
        if (spawn <= 0 && free.length) { spawn = rnd(.5, .9) * Math.max(.55, 1 - got * .035); const s = pick(free); s.who = { v: pick(['a', 'b']), t: 0, stay: Math.max(.8, rnd(1.15, 1.55) - got * .035), u: 0, hit: 0 }; play('popup', .35); }
        for (const s of slots) { const w = s.who; if (!w) continue; w.t += dt;
          if (w.hit) { w.hit += dt; w.u = w.hit < HIT + .4 ? 1 : Math.max(0, 1 - (w.hit - HIT - .4) * 3); if (w.u <= 0) s.who = null; continue; }
          w.u = w.t < .15 ? w.t / .15 : w.t > w.stay ? Math.max(0, 1 - (w.t - w.stay) / .15) : 1;
          if (w.t > w.stay + .16) { s.who = null; escaped++; fx.text(s.x, s.y - s.w, 'יָצָא לְהַיְטֶק!', '#24406e'); } }
        // Zvi: jumps to the spot with the sign up, then brings it down
        zvi.t += dt;
        if (zvi.t < HIT) { const k = zvi.t / HIT; zvi.x = zvi.fx + (zvi.tx - zvi.fx) * k; zvi.y = zvi.fy + (zvi.ty - zvi.fy) * k - Math.sin(k * Math.PI) * 30; zvi.pose = 'up'; }
        else if (zvi.pose === 'up' && zvi.t < HIT + .05) { zvi.x = zvi.tx; zvi.y = zvi.ty; zvi.pose = 'hit'; if (zvi.ok) { play('bonk', .8); setTimeout(() => play('dizzy', .45), 120); fx.burst(zvi.hx, zvi.hy + 6, '#f2b632', 8); } else play('miss', .4); }
        else if (zvi.t > HIT + .38) zvi.pose = 'up';
        if (gTime > TIME) fail(`תָּפַסְתָּ ${got} מִתּוֹךְ ${NEED}. נְנַסֶּה שׁוּב?`);
      },
      draw() {
        if (!scene('whack-bg')) bg('#bfe3f7', '#d9b98a');
        for (const s of slots) {
          const w = s.who, fh = s.w * 1.05;
          if (w && w.u > 0) {
            const cy = s.y + fh * .42 - (fh * .95 + s.w * .1) * w.u;
            g.save(); g.beginPath(); g.rect(0, 0, W, s.y - s.w * .08); g.clip();
            spr((w.hit > HIT ? 'bonked-' : 'pop-') + w.v, s.x, cy, fh);
            g.restore();
          }
          if (!spr('shtender2', s.x, s.y, s.w)) { rr(s.x - s.w / 2, s.y - s.w * .3, s.w, s.w * .55, 6); shape('#a46c47'); }
        }
        if (zvi.pose === 'hit' && zvi.ok && zvi.t < HIT + .2) { g.fillStyle = '#f2b632'; g.beginPath(); for (let i = 0; i < 16; i++) { const r = i % 2 ? 10 : 24, q = i / 16 * Math.PI * 2; g.lineTo(zvi.hx + Math.cos(q) * r, zvi.hy + 6 + Math.sin(q) * r); } g.closePath(); g.fill(); }
        rr(W / 2 - 110, 10, 220, 60, 14); g.fillStyle = '#fffdf6e6'; g.fill();
        label(`${got} / ${NEED}`, W / 2, 30, 22); const f = clamp(gTime / TIME, 0, 1); bar(W / 2 - 85, 46, 170, 15, 1 - f, f < .7 ? '#3aa565' : '#d9534f');
        if (!spr(`zvi-${zvi.pose}-${zvi.d}`, zvi.x, zvi.y, zw())) spr('zvi-sign', zvi.x, zvi.y, zw() * .7);
      },
      get slots() { return slots; },
      down(x, y) {
        if (zvi.t < HIT + .12) return;   // one swing at a time
        let target = null;
        for (const s of slots) { const w = s.who, fh = s.w * 1.05; if (!w || w.hit || w.u < .35) continue;
          if (Math.abs(x - s.x) < s.w * .55 && y > s.y - s.w * .1 - fh * 1.05 && y < s.y + s.w * .15) { target = s; break; } }
        const headY = target ? target.y - target.w * .1 - target.w * 1.05 * .98 : y, hx = target ? target.x : x, sp = spot(hx, headY);
        Object.assign(zvi, { fx: zvi.x, fy: zvi.y, tx: sp.x, ty: sp.y, d: sp.d, t: 0, pose: 'up', ok: !!target, hx, hy: headY });
        if (target) {
          target.who.hit = .001; got++;
          setTimeout(() => fx.text(sp.x, sp.y - zh('zvi-hit-' + sp.d) * .62, 'תִּתְגַּיֵּס!', '#d9534f'), HIT * 1000);
          if (got >= NEED) setTimeout(() => win('כֻּלָּם חָזְרוּ לְעוֹלָמָהּ שֶׁל תּוֹרָה!'), 450);
        }
      },
    };
  },
  // p05: the wind blows Zvi's cap - steer it with the finger into the restaurant truck passing under the bridge
  wind: () => {
    let cap, truck, wins, gust, gustT, landed, miss, fingerX, BY, RY;
    const drop = () => { cap = { x: W * rnd(.3, .7), y: BY - 10, vx: 0, a: 0 }; fingerX = null; landed = 0; miss = 0; gust = 0; gustT = .4; };
    return {
      title: 'הָרוּחַ וְהַכּוֹבַע', help: 'גּוֹרְרִים יָמִינָה וּשְׂמֹאלָה – שֶׁהַכּוֹבַע יִפֹּל לְתוֹךְ הַמַּשָּׂאִית',
      how: 'רוּחַ חֲזָקָה הֵעִיפָה אֶת הַכּוֹבַע שֶׁל צְבִי! גִּרְרוּ אֶת הָאֶצְבַּע יָמִינָה וּשְׂמֹאלָה וְכַוְּנוּ אוֹתוֹ – שֶׁיִּנְחַת בְּתוֹךְ הַמַּשָּׂאִית שֶׁל הַמִּסְעָדָה הַיְּהוּדִית. שָׁלוֹשׁ פְּעָמִים!',
      init() { BY = P ? H * .22 : H * .3; RY = H - (P ? 70 : 52); wins = 0; truck = { x: W + 120, w: P ? 230 : 210, v: 70 }; drop(); },
      update(dt) {
        truck.x -= truck.v * dt; if (truck.x < -truck.w) truck.x = W + truck.w * .7;
        if (landed) { landed += dt; cap.x = truck.x + truck.w * .17; if (landed > 1.1) { if (wins >= 3) { win('הַכּוֹבַע נָחַת בְּתוֹךְ הַמַּשָּׂאִית – יַחַד עִם הַיַּהֲלוֹם!'); return; } truck.v += 25; drop(); } return; }
        if (miss) { miss += dt; if (miss > 1) drop(); return; }
        gustT -= dt; if (gustT <= 0) { gustT = rnd(.7, 1.4); gust = rnd(-1, 1) * (60 + wins * 25); play('gust', .3); }
        const want = fingerX == null ? 0 : clamp((fingerX - cap.x) * 3, -220, 220);
        cap.vx += ((want + gust) - cap.vx) * Math.min(1, dt * 3); cap.x = clamp(cap.x + cap.vx * dt, 30, W - 30);
        cap.y += (P ? 70 : 55) * dt * (1 + wins * .12); cap.a = Math.sin(gTime * 5) * .3 + cap.vx * .002;
        const bedTop = RY - truck.w * .3, bx0 = truck.x - truck.w * .12, bx1 = truck.x + truck.w * .46;
        if (cap.y >= bedTop) {
          if (cap.x > bx0 && cap.x < bx1) { landed = .001; wins++; play('thud', .8); setTimeout(() => play('coin', .8, 1.3), 200); fx.burst(cap.x, bedTop, '#bfe9ff', 14); fx.text(cap.x, bedTop - 40, 'בְּתוֹךְ הַמַּשָּׂאִית!', '#3aa565'); }
          else if (cap.y > RY - 10) { miss = .001; play('wrong', .5); fx.text(cap.x, RY - 50, 'פִּסְפּוּס', '#d9534f'); }
        }
      },
      draw() {
        if (!scene('highway')) bg('#2b3a67', '#5b6fa8');
        if (!spr('truck', truck.x, RY - truck.w * .22, truck.w)) { rr(truck.x - truck.w / 2, RY - 60, truck.w, 50, 8); shape('#f5f1e6'); }
        { const lx = truck.x + truck.w * .17, ly = RY - truck.w * .2, lw = truck.w * .56; rr(lx - lw / 2, ly - 13, lw, 26, 6); shape('#fffdf6', 2); label('הַמִּסְעָדָה הַיְּהוּדִית', lx, ly + 1, P ? 15 : 14, '#7b1e3a'); }
        if (!spr('cap', cap.x, cap.y, 74, cap.a)) { circle(cap.x, cap.y, 22); shape('#24406e'); }
        g.fillStyle = '#ffffffcc'; for (let i = 0; i < 4; i++) { const yy = BY + 40 + i * 50, xx = ((gTime * (gust >= 0 ? 160 : -160) + i * 140) % (W + 100) + W + 100) % (W + 100) - 50; rr(xx, yy, 40, 3, 2); g.fill(); }
        outlined(`${Math.min(wins + 1, 3)} / 3`, 40, 30, 18, '#24406e');
      },
      down(x) { fingerX = x; }, move(x, y, b) { if (b) fingerX = x; }, up() { fingerX = null; },
    };
  },
  // p07: run with the cholent to Yosef's house before Shabbat - tap to jump over the puddles, boxes and strollers
  run: () => {
    const LEN = 26;
    let off, vy, jy, obs, spawn, hits, inv, dist, done2, GY, WX, WW;
    return {
      title: 'רָצִים לְיוֹסֵף', help: 'מַקִּישִׁים כְּדֵי לִקְפֹּץ – אֶל תִּשְׁפְּכוּ אֶת הַצ\'וֹלֶנְט!',
      how: 'הָעוֹבְדִים רָצִים עִם הַסִּיר לְבֵיתוֹ שֶׁל יוֹסֵף, לִפְנֵי שַׁבָּת. הַקִּישׁוּ כְּדֵי לִקְפֹּץ מֵעַל שְׁלוּלִיּוֹת, אַרְגָּזִים וַעֲגָלוֹת. שָׁלוֹשׁ הִתְנַגְּשֻׁיּוֹת – וְהַצ\'וֹלֶנְט נִשְׁפָּךְ!',
      init() { GY = H - (P ? 70 : 46); WX = W * .7; WW = P ? 170 : 150; off = 0; vy = 0; jy = 0; obs = []; spawn = 1.4; hits = 0; inv = 0; dist = 0; done2 = 0; },
      update(dt) {
        const v = (P ? 210 : 230) + dist * 4;
        if (done2) { done2 += dt; if (done2 > .9) win('הַצ\'וֹלֶנְט הִגִּיעַ לְיוֹסֵף – בְּדִיּוּק לִפְנֵי שַׁבָּת!'); return; }
        off += v * dt; dist += dt; inv = Math.max(0, inv - dt);
        vy += 1500 * dt; jy = Math.min(0, jy + vy * dt); if (jy === 0) vy = 0;
        spawn -= dt; if (spawn <= 0 && dist < LEN - 2) { spawn = rnd(1.1, 1.9) * Math.max(.65, 1 - dist * .012); const k = pick(['puddle', 'boxes', 'stroller']); obs.push({ k, x: -60, w: k === 'puddle' ? 90 : k === 'boxes' ? 62 : 74, h: k === 'puddle' ? 10 : k === 'boxes' ? 58 : 70 }); }
        for (const o of obs) o.x += v * dt;
        obs = obs.filter((o) => o.x < W + 100);
        for (const o of obs) if (!o.hit && !inv && Math.abs(o.x - WX) < (o.w + WW * .5) / 2 && -jy < o.h - 4) { o.hit = true; hits++; inv = 1; play('splash', .7); fx.text(WX, GY - WW, 'אוֹי!', '#d9534f'); if (hits >= 3) { fail('הַצ\'וֹלֶנְט נִשְׁפַּךְ... נְנַסֶּה שׁוּב?'); return; } }
        if (dist >= LEN) { done2 = .001; play('win', .6); }
      },
      draw() {
        const im = SCN.street;
        if (ok(im)) { const s = H / im.naturalHeight, w = im.naturalWidth * s, x0 = off % (2 * w); for (let x = x0 - 2 * w; x < W; x += 2 * w) { g.drawImage(im, x, 0, w, H); g.save(); g.translate(x + 2 * w, 0); g.scale(-1, 1); g.drawImage(im, 0, 0, w, H); g.restore(); } }
        else bg('#f6c48a', '#fffdf6');
        if (dist > LEN - 3) { const k = clamp((dist - (LEN - 3)) / 3, 0, 1); spr('door', -120 + k * (WX - WW * .55 + 120 - 60), GY - 95, 190); }
        for (const o of obs) { const s = o.k === 'puddle' ? 1 : 1; if (!spr(o.k, o.x, GY - o.h / 2 + (o.k === 'puddle' ? 6 : 0), o.w * s)) { rr(o.x - o.w / 2, GY - o.h, o.w, o.h, 6); shape('#b58457'); } }
        g.globalAlpha = inv && Math.floor(inv * 10) % 2 ? .45 : 1;
        if (!spr('workers', WX, GY - WW * .38 + jy + (jy ? 0 : Math.abs(Math.sin(off * .03)) * -4), WW)) { rr(WX - 40, GY - 80 + jy, 80, 80, 10); shape('#fff'); }
        g.globalAlpha = 1;
        const f = clamp(dist / LEN, 0, 1); bar(W / 2 - 100, 14, 200, 18, f, '#3aa565'); outlined('עַד הַבַּיִת שֶׁל יוֹסֵף', W / 2, 46, 14);
        for (let i = 0; i < 3; i++) { circle(W - 30 - i * 26, 24, 9); g.fillStyle = i < 3 - hits ? '#f2b632' : '#ffffff55'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke(); }
      },
      down() { if (jy === 0 && !done2) { vy = -(P ? 640 : 600); play('jump', .5); } },
    };
  },
  // p08: Yosef pays with all his saved Ten Bis - tap the orange cards in the order of the week
  pay: () => {
    let round, cards, next, shake, paidT, PH;
    const make = () => {
      const cols = P ? 2 : 3, spots = []; for (let r = 0; r < (P ? 3 : 2); r++) for (let c = 0; c < cols; c++) spots.push([c, r]);
      shuffle(spots); const y0 = P ? 300 : 175, cw = (W - 40) / cols, ch = P ? 120 : 105;
      cards = DAYS.map((d, i) => ({ d, i, x: 20 + cw * (spots[i][0] + .5) + rnd(-12, 12), y: y0 + ch * spots[i][1] + rnd(-8, 8), a: rnd(-.25, .25), vx: round ? rnd(-30, 30) : 0, vy: round ? rnd(-20, 20) : 0, gone: 0 }));
      next = 0; shake = null;
    };
    return {
      title: 'מְשַׁלְּמִים בְּתֵן בִּיס', help: 'מַקִּישִׁים עַל הַכַּרְטִיסִים לְפִי סֵדֶר הַיָּמִים: רִאשׁוֹן, שֵׁנִי...',
      how: 'יוֹסֵף מְשַׁלֵּם אֶת כׇּל הַתֵּן בִּיס שֶׁחָסַךְ! הַקִּישׁוּ עַל הַכַּרְטִיסִים הַכְּתֻמִּים לְפִי סֵדֶר הַיָּמִים: רִאשׁוֹן, שֵׁנִי, שְׁלִישִׁי, רְבִיעִי, חֲמִישִׁי. פַּעֲמַיִם!',
      init() { PH = { x: W / 2, y: P ? 150 : 100 }; round = 0; paidT = 0; make(); },
      update(dt) {
        if (paidT) { paidT += dt; if (paidT > 1) { round++; paidT = 0; if (round >= 2) { win('יוֹסֵף שִׁלֵּם אֶת כׇּל הַתֵּן בִּיס – וְהַצ\'וֹלֶנְט שֶׁלּוֹ!'); return; } make(); } return; }
        for (const c of cards) { if (c.gone) { c.gone += dt * 2.2; continue; } c.x += c.vx * dt; c.y += c.vy * dt; if (c.x < 60 || c.x > W - 60) c.vx *= -1; if (c.y < (P ? 250 : 150) || c.y > H - 50) c.vy *= -1; }
        if (shake) { shake.t -= dt; if (shake.t <= 0) shake = null; }
      },
      draw() {
        if (!scene('kitchen')) bg('#f4ead8', '#e6d4b5');
        g.fillStyle = '#fffdf6cc'; g.fillRect(0, 0, W, H);
        wallet(PH.x + (P ? 70 : 120), PH.y, (next + (paidT ? 0 : 0)) / 5);
        pot(PH.x - (P ? 70 : 120), PH.y + 10, P ? .8 : .7, 0);
        rr(PH.x - (P ? 70 : 120) - 44, PH.y + 52, 88, 26, 8); shape('#fff', 2); label("צ'וֹלֶנְט", PH.x - (P ? 70 : 120), PH.y + 66, 15);
        if (!paidT && next < 5) outlined('עַכְשָׁיו: ' + DAYS[next], W / 2, P ? 240 : 30, 24, '#f36f21');
        else if (paidT) outlined('שֻׁלַּם!', W / 2, P ? 240 : 30, 30, '#3aa565');
        for (const c of cards) {
          if (c.gone >= 1) continue;
          const k = c.gone, x = c.x + (PH.x + (P ? 70 : 120) - c.x) * k, y = c.y + (PH.y - c.y) * k, wob = shake && shake.c === c ? Math.sin(shake.t * 60) * 6 : 0;
          mealCard(x + wob, y, (P ? 1.7 : 1.5) * (1 - k * .6), c.a);
          if (!k) outlined(c.d, x + wob, y + (P ? 44 : 38), 20, INK);
        }
        outlined(`${Math.min(round + 1, 2)} / 2`, 36, P ? 30 : 64, 16);
      },
      down(x, y) {
        if (paidT) return;
        for (const c of cards) if (!c.gone && Math.abs(x - c.x) < 62 && Math.abs(y - c.y) < 50) {
          if (c.i === next) { c.gone = .001; next++; play('card', .7); fx.text(c.x, c.y - 40, c.d + ' ✓', '#3aa565'); if (next >= 5) { paidT = .001; setTimeout(() => play('paid', .8), 350); } }
          else { shake = { c, t: .35 }; play('wrong', .5); fx.text(c.x, c.y - 40, 'עוֹד לֹא', '#d9534f'); }
          return;
        }
      },
    };
  },
  // p10: the diamond is sold - tap the flying gold coins and fill all thirteen attics
  gold: () => {
    let coins, filled, spawn, fly, ATT, roofY, houseH;
    return {
      title: 'עֹשֶׁר רַב', help: 'מַקִּישִׁים עַל מַטְבְּעוֹת הַזָּהָב – כָּל אֶחָד עוֹלֶה לָעֲלִיָּה',
      how: 'יוֹסֵף מָכַר אֶת הַיַּהֲלוֹם – וְהִתְעַשֵּׁר עֹשֶׁר רַב! הַקִּישׁוּ עַל מַטְבְּעוֹת הַזָּהָב שֶׁעָפִים, וּמַלְאוּ אֶת כׇּל שְׁלוֹשׁ עֶשְׂרֵה הָעֲלִיּוֹת.',
      init() {
        const rows = P ? [5, 4, 4] : [7, 6], top = P ? 110 : 140, rowH = 64;
        ATT = []; rows.forEach((n, r) => { for (let i = 0; i < n; i++) ATT.push({ x: W / 2 - (i - (n - 1) / 2) * 60, y: top + r * rowH + 10 }); });
        roofY = top - 20; houseH = rows.length * rowH + 20;
        coins = []; filled = 0; spawn = 0; fly = [];
      },
      update(dt) {
        spawn -= dt;
        if (spawn <= 0) { spawn = rnd(.35, .6); coins.push({ x: rnd(50, W - 50), y: H + 20, vx: rnd(-40, 40), vy: -rnd(280, 330) * Math.sqrt(H / 400) }); }
        for (const c of coins) { c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 170 * dt * (H / 400); }
        coins = coins.filter((c) => !c.got && c.y < H + 40);
        for (const f of fly) f.t += dt * 2.2; fly = fly.filter((f) => f.t < 1);
      },
      draw() {
        if (!scene('night')) bg('#1f2d55', '#3d4f86');
        const hw = P ? W - 40 : 460, hx = W / 2 - hw / 2;
        g.beginPath(); g.moveTo(hx - 10, roofY); g.lineTo(W / 2, roofY - 70); g.lineTo(hx + hw + 10, roofY); g.closePath(); shape('#b5553b');
        rr(hx, roofY, hw, houseH, 6); shape('#f1e4c8');
        ATT.forEach((a, i) => { if (spr(i < filled ? 'attic-gold' : 'attic', a.x, a.y, 54)) return; rr(a.x - 22, a.y - 24, 44, 46, 6); shape(i < filled ? '#f5c542' : '#2b3550', 2.5); if (i < filled) { coin(a.x - 8, a.y + 6, 9); coin(a.x + 8, a.y + 6, 9); coin(a.x, a.y - 7, 9); } });
        label(`${filled} / 13`, W / 2, roofY + houseH + 30, 26, '#fff');
        for (const c of coins) coin(c.x, c.y, 24);
        for (const f of fly) { const a = ATT[f.i], k = f.t; coin(f.x + (a.x - f.x) * k, f.y + (a.y - f.y) * k, 24 - k * 12); }
      },
      down(x, y) {
        if (filled >= 13) return;
        for (const c of coins) if (Math.hypot(x - c.x, y - c.y) < 38) {
          c.got = true; const i = filled++; fly.push({ i, x: c.x, y: c.y, t: 0 }); play('gold', .7); fx.burst(c.x, c.y);
          if (filled >= 13) setTimeout(() => win('מַאן דְּחָסִיךְ תֵּן בִּיס לְשַׁבְּתָא – פָּרְעֵיהּ שַׁבְּתָא!'), 450);
          return;
        }
      },
    };
  },
  // p09: open the pot at home - scrape the stew away and find the diamond
  dig: () => {
    let C, layer, lc, gem, found, lastScr, touched;
    const paintStew = () => {
      layer = document.createElement('canvas'); layer.width = W; layer.height = H; lc = layer.getContext('2d');
      lc.fillStyle = '#7a4a26'; lc.beginPath(); lc.arc(C.x, C.y, C.r, 0, 7); lc.fill();
      if (ok(SPR.stew)) { lc.save(); lc.beginPath(); lc.arc(C.x, C.y, C.r, 0, 7); lc.clip(); lc.drawImage(SPR.stew, C.x - C.r * 1.15, C.y - C.r * 1.15, C.r * 2.3, C.r * 2.3); lc.restore(); return; }
      const blob = (x, y, r, col, rx = 1) => { lc.fillStyle = col; lc.beginPath(); lc.ellipse(x, y, r * rx, r, rnd(0, 3), 0, 7); lc.fill(); lc.lineWidth = 2.5; lc.strokeStyle = '#3d2412'; lc.stroke(); };
      const at = (m) => { const a = rnd(0, 6.28), d = Math.sqrt(Math.random()) * (C.r - m); return [C.x + Math.cos(a) * d, C.y + Math.sin(a) * d]; };
      for (let i = 0; i < 70; i++) { const [x, y] = at(18); blob(x, y, rnd(5, 9), pick(['#5a3418', '#8f5a30', '#c9a26a'])); }
      for (let i = 0; i < 16; i++) { const [x, y] = at(30); blob(x, y, rnd(14, 20), pick(['#e2b45e', '#d9a24c']), 1.3); }
      for (let i = 0; i < 5; i++) { const [x, y] = at(30); blob(x, y, 15, '#f4f1e8', 1.35); lc.fillStyle = '#f3d27a'; lc.beginPath(); lc.arc(x, y, 6, 0, 7); lc.fill(); }
      for (let i = 0; i < 4; i++) { const [x, y] = at(30); blob(x, y, 13, '#a83b2e', 2); }
    };
    const cleared = () => { let n = 0, m = 0; const d = lc.getImageData(gem.x - 22, gem.y - 22, 44, 44).data; for (let i = 3; i < d.length; i += 16) { m++; if (d[i] < 40) n++; } return n / m; };
    return {
      title: 'פּוֹתְחִים אֶת הַסִּיר', help: 'גּוֹרְרִים אֶת הַכַּף בַּסִּיר – מַשֶּׁהוּ קָשֶׁה מִסְתַּתֵּר שָׁם!',
      how: 'יוֹסֵף פּוֹתֵחַ אֶת הַסִּיר בַּבַּיִת. גִּרְרוּ אֶת הָאֶצְבַּע בְּתוֹךְ הַסִּיר וְחַפְּשׂוּ – מַשֶּׁהוּ קָשֶׁה מִסְתַּתֵּר בְּתוֹךְ הַצ\'וֹלֶנְט!',
      init() {
        C = { x: W / 2, y: H / 2 + 6, r: Math.min(W, H) / 2 - 36 };
        paintStew(); const a = rnd(0, 6.28), d = rnd(30, C.r - 50); gem = { x: C.x + Math.cos(a) * d, y: C.y + Math.sin(a) * d }; found = false; lastScr = 0; touched = false; this.sp = null;
      },
      update() {},
      draw() {
        if (!scene('kitchen')) bg('#f4ead8', '#e6d4b5');
        circle(C.x, C.y, C.r + 22); shape('#8d9aa8', 4); circle(C.x, C.y, C.r); g.fillStyle = '#4a525c'; g.fill();
        diamond(gem.x, gem.y, 1.05, false, found ? (Math.sin(gTime * 6) + 1) / 2 : .4);
        g.drawImage(layer, 0, 0, W, H);
        if (this.sp) { g.save(); g.translate(this.sp.x, this.sp.y); g.rotate(-.6); rr(-8, 0, 16, 120, 6); shape('#c9a26a'); g.beginPath(); g.ellipse(0, -6, 20, 26, 0, 0, 7); shape('#b98e56'); g.restore(); }
      },
      down(x, y) { this.sp = { x, y }; this.scrape(x, y); },
      move(x, y, b) { this.sp = { x, y }; if (b) this.scrape(x, y); },
      up() { this.sp = null; },
      scrape(x, y) {
        if (found || Math.hypot(x - C.x, y - C.y) > C.r + 10) return;
        lc.globalCompositeOperation = 'destination-out'; lc.beginPath(); lc.arc(x, y, 26, 0, 7); lc.fill(); lc.globalCompositeOperation = 'source-over';
        if (gTime - lastScr > .25) { lastScr = gTime; play('scrape', .35); }
        if (Math.hypot(x - gem.x, y - gem.y) < 26 && !touched) { touched = true; play('tak', .9); fx.text(gem.x, gem.y - 40, 'טַק!', '#24406e'); }
        if (cleared() > .5) { found = true; play('coin', .9, 1.2); fx.burst(gem.x, gem.y, '#bfe9ff', 18); win('יַהֲלוֹם עֲנָק וְנוֹצֵץ – בְּתוֹךְ הַצ\'וֹלֶנְט!'); }
      },
    };
  },
};

/* ---------------- tutorial (first time) ---------------- */
const TUT = [
  { el: 'txt', h: 'סֵפֶר סִפּוּר', p: 'זֶה סֵפֶר. בְּכָל עַמּוּד – חֵלֶק מֵהַסִּפּוּר, וְהַמְּסַפֵּר מַקְרִיא אוֹתוֹ.' },
  { el: 'readBtn', h: 'הַקְרָאָה', p: 'רוֹצִים לִשְׁמֹעַ שׁוּב? לוֹחֲצִים כָּאן.' },
  { el: 'playBtn', h: 'מִשְׂחָק', p: 'בְּהַרְבֵּה עַמּוּדִים מְחַכֶּה מִשְׂחָק קָטָן. לוֹחֲצִים "שַׂחֲקוּ!".' },
  { el: 'stamps', h: 'חוֹתָמוֹת', p: 'מְנַצְּחִים בַּמִּשְׂחָק – מְקַבְּלִים חוֹתֶמֶת.' },
  { el: 'nextBtn', h: 'הָעַמּוּד הַבָּא', p: 'מְדַפְדְּפִים לָעַמּוּד הַבָּא – גַּם בְּלִי לְשַׂחֵק. הַמַּטָּרָה: לִשְׁמֹעַ אֶת כׇּל הַסִּפּוּר, וְלֶאֱסֹף אֶת כׇּל הַחוֹתָמוֹת!' },
];
const tut = {
  on: false, i: 0,
  begin() { this.on = true; this.i = 0; this.show(); },
  show() {
    document.querySelectorAll('.glow').forEach((e) => e.classList.remove('glow'));
    const s = TUT[this.i], c = $('tutCard');
    c.querySelector('h3').textContent = s.h; c.querySelector('p').textContent = s.p;
    c.querySelector('.dots').innerHTML = TUT.map((_, k) => `<i class="${k === this.i ? 'on' : ''}"></i>`).join('');
    c.querySelector('.next').textContent = this.i === TUT.length - 1 ? 'יָאלְלָה!' : 'הַבָּא';
    c.classList.add('on'); $(s.el).classList.add('glow');
    c.style.top = s.el === 'nextBtn' || s.el === 'playBtn' || s.el === 'readBtn' && innerHeight < 500 ? '' : '';
  },
  next() { play('pop', .4); this.i++; if (this.i >= TUT.length) this.end(); else this.show(); },
  end() { this.on = false; $('tutCard').classList.remove('on'); document.querySelectorAll('.glow').forEach((e) => e.classList.remove('glow')); store.set(KEY.tut, '1'); read(); },
};
$('tutCard').querySelector('.next').onclick = () => tut.next();
addEventListener('keydown', (e) => {
  if (e.key !== ' ' && e.key !== 'Enter') return;
  if (tut.on) { e.preventDefault(); tut.next(); return; }
  if ($('gMsg').classList.contains('on')) { e.preventDefault(); $('gMsg').querySelector('button').click(); return; }
  if ($('start').classList.contains('on')) { e.preventDefault(); $('goBtn').click(); }
});

/* ---------------- start ---------------- */
function go() {
  ctx(); startMusic(); started = true;
  $('start').classList.remove('on');
  window.track && track('game_start', 'yosef');   // stats: someone opened the book to read and play
  if (!store.get(KEY.tut)) { showPage(page); voice.pause(); tut.begin(); } else showPage(page);
}
$('goBtn').onclick = go;
$('restartBtn').onclick = () => { done.clear(); store.set(KEY.done, '[]'); page = 0; go(); };
// always the fresh story (a cached old 404 must never leave the book stuck), one retry
const getStory = () => fetch('story.json?v=' + Date.now(), { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
getStory().catch(() => new Promise((ok) => setTimeout(ok, 800)).then(getStory)).then((s) => {
  story = s; page = clamp(+store.get(KEY.page) || 0, 0, story.pages.length - 1);
  if (page > 0 || done.size) { $('goBtn').querySelector('span').textContent = 'מַמְשִׁיכִים לִקְרֹא'; $('restartBtn').style.display = ''; }
  paintSnd(); showPage(page); $('loading').style.display = 'none';
}).catch(() => { $('loading').textContent = 'לֹא הִצְלַחְנוּ לִטְעֹן'; });
window.__game = { GAMES, win: () => win('בדיקה'), open: (i) => { page = i; openGame(story.pages[i]); }, get G() { return G; }, get over() { return over; }, tut, showPage, done };
