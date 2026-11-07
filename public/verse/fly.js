// The flight in, as a game (his idea 2026-11-07: "instead of the video, a short game - you are a spaceship flying to the
// Shlomiverse and you dodge the characters on the way; very fun, not that easy, not that hard"). A draft for him: it plays in
// the citizenship journey only behind gates.js FLY_OPEN (citizen.js flight()), and at /verse/fly/ on its own.
//   play(el, { muted, onDone, onSkip, chars, seed, records }) -> { stop }   onDone / onSkip get the flight's stats
//   prefetch(chars)   warms the first screen (citizen.js calls it on the stamp screen, so the game opens at once)
// One thumb: drag anywhere and the ship moves with the finger (relative, so it never hides under it) and fires while the
// finger is down - a cannon that overheats, so dodging still matters (round 2, his notes 2026-11-07). Arrows + space on a
// computer. The characters come down in their round bubbles like in the flight teaser; 3 shields, a few more to pick up;
// two lost runs and the next one is calmer. The goal at the top is the planet seen from behind, as the teaser's turn begins
// (round 3, his note: "we should see the star first from behind, so when it circles around at the end it makes sense"); the
// landing hands over to that very moment and the word turns onto the ring (art/fly-end.mp4 - re-rendered clean by the teaser's
// own compositor, scripts/v2-design/fly-comp-v4.py), then the score goes on today's table (opts.records, from citizen.js).
// Art: scripts/v2-design/fly-art.mjs (GPT Image). Music: the teaser's own, a seamless 8 s loop + its landing bars. Effects:
// real sound effects (scripts/v2-design/fly-sfx.mjs - round 3: "the sounds are terrible, it should be immersive").
import { T } from './copy.js';

const ART = '/verse/art/';
const Y = () => T.fly;
// who flies at you: well-known characters with portraits (real people of the verse, no public figures). The first five load
// with the first screen, the rest once the flight starts (round 2: "it took long to load")
const CAST = ['demokratovich', 'miriam', 'yotam', 'hani', 'nahor', 'rosenblum', 'asaf', 'ayelet', 'vova', 'amir', 'osnat', 'yaniv', 'dorit', 'genz'];
const EARLY = 5;
// the tuning, in "u" = 1/360 of the play width per second (so a wide phone plays like a narrow one)
const TUNE = {
  dur: 26,                 // seconds to the planet (round 2: shorter, was 40)
  shields: 3, blink: 1.2,  // a hit costs a shield + 1.2 s of blinking
  calm: 0.86,              // no new characters after this share of the way: a breath before the landing
  normal: { gap: [0.85, 0.3], vy: [180, 345], homing: true, wall: 116, lives: [0.38, 0.72] },
  easy: { gap: [1.35, 0.6], vy: [135, 238], homing: false, wall: 150, lives: [0.2, 0.42, 0.62, 0.8] },   // after two lost runs
  easyAfter: 2,
  gun: { every: 0.28, speed: 700, heat: 0.2, cool: 0.3, coolHot: 0.5, resume: 0.25 },   // ~3.5 shots/s; ~2 s of fire overheats it for 1.5 s
  score: { star: 10, shot: 25, life: 50, shield: 100 },   // + every shield left at the landing; a pickup with full shields = life
};
// the teaser's first frame of the turning logo (540x960): the planet's ring centre and width, so the game's planet ends there
const CLIP = { w: 540, h: 960, cx: 267, cy: 444.5, ring: 292 };
const PLANET_RING = 0.66;   // the ring's share of fly-planet.webp's width (its faint glow edge counted - matched on screen to the clip)
const FIRST = ['fly-space.webp', 'fly-ship.webp', 'fly-planet.webp', 'fly-star.webp'];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const absImg = (p) => (!p ? '' : /^(https?:|\/)/.test(p) ? p : '/wiki/' + p);
const BARE = /שלומי(?!וורס)|\.\.\.\?/;   // never his bare name on screen; no fill-in-the-blank lines ("...?")
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const wikiChars = () => { try { return Object.values(C); } catch (e) { return []; } };   // the wiki page's own data, when there

// ---------- loading: one cache shared by prefetch() and play() ----------
const PRE = {};
const pic = (src, low) => { if (PRE[src]) return PRE[src]; const i = new Image(); i.decoding = 'async'; if (low) i.fetchPriority = 'low'; i.src = src; return (PRE[src] = i); };
const castOf = (chars) => { const by = Object.fromEntries((chars || []).filter((c) => c && c.img).map((c) => [c.id, c])); return CAST.map((id) => by[id]).filter(Boolean); };
export function prefetch(chars) {
  FIRST.forEach((n) => pic(ART + n));
  castOf(chars || wikiChars()).slice(0, EARLY).forEach((c) => pic(absImg(c.img), true));
  if (!PRE.music) PRE.music = fetch(ART + 'fly-music.mp3').then((r) => r.arrayBuffer()).catch(() => null);
  ['laser-1', 'boom-1', 'engine'].forEach((n) => fetch(ART + `fly-${n}.mp3`).catch(() => {}));   // into the cache for the first shots
}

const SHIELD_D = 'M12 2.5 4 5.6v6.1c0 4.9 3.3 8.4 8 9.8 4.7-1.4 8-4.9 8-9.8V5.6z';
const SVG = {
  shield: `<svg viewBox="0 0 24 24"><path d="${SHIELD_D}"/><path d="M12 6.2v11.6" class="hl"/></svg>`,
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" class="on"/><path d="m16 9.5 5 5M21 9.5l-5 5" class="off"/></svg>',
  // a hand with its finger down, for "drag"
  hand: '<svg viewBox="0 0 64 64"><path d="M26 30V11.5a4.5 4.5 0 0 1 9 0V27l.4-1.6a4.3 4.3 0 0 1 8.3 1.7l-.2 2 .5-1a4.2 4.2 0 0 1 7.7 2.9l-.3 2.2.4-.6a4 4 0 0 1 7 3.6l-1.8 9.2C55.5 54.5 50 60 42 60h-5.5c-5 0-8.6-2.2-11.6-6.3L14.6 40a4.6 4.6 0 0 1 6.9-6z" fill="#fff" stroke="#1a1410" stroke-width="2.4" stroke-linejoin="round"/></svg>',
};

const CSS = `
.fly { position: fixed; inset: 0; z-index: 120; background: #050302; display: flex; justify-content: center; font-family: 'Heebo', -apple-system, sans-serif; color: #fff;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
.fly-stage { position: relative; height: 100%; overflow: hidden; touch-action: none; }
.fly canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.fly video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity .55s ease, transform 4.5s cubic-bezier(.2, .6, .3, 1); pointer-events: none; }
.fly video.on { opacity: 1; }
.fly video.settle { transform: scale(1.05); }
.fly-hud { position: absolute; top: calc(10px + env(safe-area-inset-top, 0px)); inset-inline: 10px; display: flex; align-items: center; gap: 10px; direction: rtl; pointer-events: none; z-index: 5; transition: opacity .4s; }
.fly-hud.gone { opacity: 0; }
.fly-shields { display: flex; gap: 3px; flex: none; }
.fly-shields svg { width: 22px; height: 22px; fill: #ff6a1f; stroke: #ffd27a; stroke-width: 1.4; filter: drop-shadow(0 0 4px rgba(255, 106, 31, .7)); transition: transform .25s, opacity .25s; }
.fly-shields svg .hl { stroke: rgba(255, 240, 200, .75); fill: none; stroke-width: 1.2; }
.fly-shields svg.lost { fill: none; stroke: rgba(255, 255, 255, .28); filter: none; transform: scale(.82); }
.fly-shields svg.lost .hl { display: none; }
.fly-shields svg.pop { transform: scale(1.5); }
.fly-prog { flex: 1; position: relative; height: 8px; border-radius: 99px; background: rgba(255, 255, 255, .14); box-shadow: inset 0 0 0 1px rgba(255, 180, 120, .25); margin-inline-end: 16px; }
.fly-prog i { position: absolute; inset-block: 0; right: 0; width: 100%; border-radius: 99px; background: linear-gradient(to left, #ff6a1f, #ffb347); transform-origin: right; transform: scaleX(0); box-shadow: 0 0 8px rgba(255, 120, 40, .7); }
.fly-prog img { position: absolute; left: -22px; top: 50%; width: 40px; height: 40px; transform: translateY(-50%); }
.fly-btn { pointer-events: auto; flex: none; height: 34px; border-radius: 99px; border: 1px solid rgba(255, 255, 255, .3); background: rgba(10, 6, 4, .55); color: #fff; font: inherit; font-weight: 700; font-size: 15px;
  display: grid; place-items: center; padding: 0 14px; -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); cursor: pointer; }
.fly-mute { width: 34px; padding: 0; }
.fly-mute svg { width: 19px; height: 19px; }
.fly-mute .off, .fly-mute.muted .on { display: none; } .fly-mute.muted .off { display: inline; }
.fly-score { position: absolute; top: calc(48px + env(safe-area-inset-top, 0px)); right: 12px; font-weight: 900; font-size: 17px; direction: ltr; z-index: 3; pointer-events: none; text-shadow: 0 1px 3px #000; transition: opacity .4s; font-variant-numeric: tabular-nums; }
.fly-score.bump { animation: flyBump .25s; }
@keyframes flyBump { 50% { transform: scale(1.3); } }
.fly-say { position: absolute; left: 0; top: 0; z-index: 2; max-width: 46%; padding: 5px 10px 6px; border-radius: 14px; background: rgba(255, 248, 238, .94); color: #1d140e; font-size: 13px; font-weight: 700; line-height: 1.25;
  direction: rtl; text-align: right; pointer-events: none; opacity: 0; transition: opacity .25s; box-shadow: 0 4px 14px rgba(0, 0, 0, .45); white-space: normal; }
.fly-say.on { opacity: 1; }
.fly-layer { position: absolute; inset: 0; z-index: 4; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; text-align: center; direction: rtl;
  padding: 0 22px calc(40px + env(safe-area-inset-bottom, 0px)); transition: opacity .3s; }
.fly-layer.hide { opacity: 0; pointer-events: none; }
.fly-tut { justify-content: center; padding-bottom: 30vh; background: radial-gradient(ellipse 85% 32% at 50% 44%, rgba(5, 3, 2, .72), transparent 75%); }
.fly-tut svg { width: 60px; height: 60px; margin-bottom: 10px; animation: flyDrag 1.8s ease-in-out infinite; filter: drop-shadow(0 4px 10px rgba(0, 0, 0, .6)); }
@keyframes flyDrag { 0%, 100% { transform: translateX(-46px) rotate(-6deg); } 50% { transform: translateX(46px) rotate(6deg); } }
.fly-tut b { font-size: 20px; font-weight: 800; line-height: 1.35; max-width: 310px; }
.fly-tut b em { font-style: normal; display: inline-block; background: #ff6a1f; color: #fff; border-radius: 9px; padding: 0 9px 2px; margin-inline-end: 6px; box-shadow: 0 0 14px rgba(255, 106, 31, .6); }
.fly-tut small { margin-top: 8px; font-size: 14.5px; color: rgba(255, 236, 220, .8); max-width: 300px; line-height: 1.4; }
.fly-over { background: rgba(5, 3, 2, .62); justify-content: center; gap: 10px; -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px); }
.fly-over > b { font-size: 26px; font-weight: 900; }
.fly-res > b { font-size: 22px; font-weight: 900; }
.fly-over span, .fly-res .fly-stats { font-size: 14.5px; color: rgba(255, 236, 220, .85); max-width: 320px; line-height: 1.4; }
.fly-over em { font-style: normal; font-size: 14px; color: #ffcf8a; }
.fly-big { margin-top: 10px; min-width: 200px; height: 50px; border-radius: 99px; border: 0; background: #ff6a1f; color: #fff; font: inherit; font-weight: 800; font-size: 19px; box-shadow: 0 6px 24px rgba(255, 106, 31, .45); cursor: pointer; }
.fly-res { padding-bottom: calc(26px + env(safe-area-inset-bottom, 0px)); gap: 3px; background: linear-gradient(to top, rgba(5, 3, 2, .9), rgba(5, 3, 2, .55) 34%, transparent 50%); }
.fly-res .fly-pts { font-size: 30px; font-weight: 900; color: #ffb347; line-height: 1.1; text-shadow: 0 0 18px rgba(255, 106, 31, .5); }
.fly-board { width: min(300px, 100%); margin-top: 6px; display: none; }
.fly-board.on { display: block; }
.fly-board h4 { margin: 0 0 4px; font-size: 13px; font-weight: 800; color: #ffcf8a; letter-spacing: .02em; }
.fly-board ol { list-style: none; margin: 0; padding: 0; }
.fly-board li { display: flex; align-items: center; gap: 8px; height: 26px; padding: 0 10px; border-radius: 9px; font-size: 14px; }
.fly-board li:nth-child(odd) { background: rgba(255, 255, 255, .06); }
.fly-board li.me { background: rgba(255, 106, 31, .28); box-shadow: inset 0 0 0 1px rgba(255, 160, 90, .6); }
.fly-board li i { font-style: normal; width: 16px; font-weight: 800; color: #ffcf8a; }
.fly-board li span { flex: 1; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fly-board li b { font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums; }
.fly-board p { margin: 4px 0 0; font-size: 13px; color: rgba(255, 236, 220, .75); }
`;

export function play(el, opts = {}) {
  const Z = Y();
  if (!document.getElementById('fly-css')) { const s = document.createElement('style'); s.id = 'fly-css'; s.textContent = CSS; document.head.appendChild(s); }
  const root = document.createElement('div');
  root.className = 'fly';
  root.innerHTML = `<div class="fly-stage">
    <canvas></canvas>
    <video muted playsinline preload="none"></video>
    <div class="fly-hud"><div class="fly-shields">${SVG.shield.repeat(TUNE.shields)}</div>
      <div class="fly-prog" role="progressbar" aria-label="${Z.progress}"><i></i><img src="${ART}fly-planet.webp" alt=""></div>
      <button class="fly-btn fly-mute" aria-label="${Z.sound}">${SVG.sound}</button><button class="fly-btn fly-skip">${Z.skip}</button></div>
    <div class="fly-score">0</div>
    <div class="fly-say"></div><div class="fly-say"></div>
    <div class="fly-layer fly-tut">${SVG.hand}<b><em>${Z.verb}</em>${Z.how}</b><small>${Z.howSmall}</small></div>
    <div class="fly-layer fly-over hide"><b>${Z.lost}</b><span></span><em></em><button class="fly-big">${Z.retry}</button></div>
    <div class="fly-layer fly-res hide"><b>${Z.landed}</b><div class="fly-pts"></div><span class="fly-stats"></span>
      <div class="fly-board"><h4>${Z.board}</h4><ol></ol><p></p></div><button class="fly-big">${Z.go}</button></div>
  </div>`;
  el.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const stage = $('.fly-stage'), cv = $('canvas'), cx = cv.getContext('2d'), video = $('video');
  const shieldEls = [...root.querySelectorAll('.fly-shields svg')], fill = $('.fly-prog i'), scoreEl = $('.fly-score');
  const says = [...root.querySelectorAll('.fly-say')].map((d) => ({ d, f: null, until: 0 }));
  const tut = $('.fly-tut'), over = $('.fly-over'), res = $('.fly-res'), hud = $('.fly-hud'), muteBtn = $('.fly-mute');

  // ---------- art ----------
  const A = { space: pic(ART + 'fly-space.webp'), ship: pic(ART + 'fly-ship.webp'), star: pic(ART + 'fly-star.webp'), planet: pic(ART + 'fly-planet.webp') };
  const ok = (i) => i.complete && i.naturalWidth;
  // the faces, each drawn once into its own round bubble with the teaser's orange rim (no pixel reads - cross-origin is fine)
  const FS = 176;
  const faces = [];
  function bubbleOf(f, im) {
    const b = document.createElement('canvas'); b.width = b.height = FS; const g = b.getContext('2d'), R = FS / 2 - 9;
    g.save(); g.shadowColor = 'rgba(255,106,31,.95)'; g.shadowBlur = 12; g.fillStyle = '#ff6a1f'; g.beginPath(); g.arc(FS / 2, FS / 2, R + 2, 0, 7); g.fill(); g.restore();
    g.save(); g.beginPath(); g.arc(FS / 2, FS / 2, R, 0, 7); g.clip();
    const s = Math.max((2 * R) / im.width, (2 * R) / im.height), w = im.width * s, h = im.height * s;
    g.drawImage(im, FS / 2 - w / 2, FS / 2 - R - (h - 2 * R) * 0.3, w, h); g.restore();   // portraits are tall: keep the upper part (the face)
    const rim = g.createLinearGradient(0, 0, FS, FS); rim.addColorStop(0, '#ffc46b'); rim.addColorStop(1, '#ff5a12');
    g.strokeStyle = rim; g.lineWidth = 4; g.beginPath(); g.arc(FS / 2, FS / 2, R, 0, 7); g.stroke();
    f.cv = b;
  }
  function loadFace(f) {
    if (f.im) return;
    f.im = pic(absImg(f.img), true);
    if (ok(f.im)) bubbleOf(f, f.im); else f.im.addEventListener('load', () => bubbleOf(f, f.im), { once: true });
  }
  const loadRest = () => faces.forEach(loadFace);
  Promise.resolve(opts.chars || wikiChars()).then((chars) => {
    for (const c of castOf(chars)) faces.push({ id: c.id, name: c.name, img: c.img, quotes: (c.quotes || []).filter((q) => q.length <= 34 && !BARE.test(q)), cv: null });
    faces.slice(0, EARLY).forEach(loadFace);
    if (G.phase !== 'intro') loadRest(); else setTimeout(loadRest, 2500);
  }).catch(() => {});

  // ---------- sound: the teaser's music + synthesized effects (WebAudio, started by the first touch) ----------
  let muted = opts.muted != null ? !!opts.muted : (() => { try { return localStorage.getItem('fly-muted') === '1'; } catch (e) { return false; } })();
  const au = makeAudio(muted);
  const setMute = (m) => { muted = m; muteBtn.classList.toggle('muted', m); au && au.mute(m); try { localStorage.setItem('fly-muted', m ? '1' : '0'); } catch (e) {} };
  setMute(muted);

  // ---------- the game's state ----------
  const G = {
    phase: 'intro', t: 0, p: 0, shields: TUNE.shields, hits: 0, stars: 0, shot: 0, lives: 0, score: 0, fails: 0, tries: 1, easy: false, total: 0,
    ship: { x: 0, y: 0, tx: 0, ty: 0, vx: 0, tilt: 0, blink: 0, s: 1, a: 1 }, ents: [], gems: [], pick: [], shots: [], booms: [], parts: [], dots: [],
    spawnIn: 1.2, gemIn: 2, sayIn: 3, livesAt: [], gunIn: 0, heat: 0, hot: false, fire: false,
    shake: 0, flash: 0, endT: 0, bgY: 0, slow: 1, timeScale: 1, frames: [], work: [], bot: null,
  };
  let W = 360, H = 740, u = 1, dpr = 1, R = rng(opts.seed != null ? opts.seed : (Date.now() ^ 0x5eed));
  const ship = G.ship;
  // round 3 ("a branding spaceship... the logo much more clear; maybe change the proportions"): a white ship carrying the whole
  // logo, ~a quarter of the screen wide so the word reads on a phone; its hit circle is the logo's disc in the middle
  const shipW = () => 92 * u, shipH = () => 92 * u * 1.018, shipR = () => 18 * u;

  function layout() {
    const vw = innerWidth, vh = root.clientHeight || innerHeight;
    const nw = Math.round(Math.min(vw, vh * 0.62)), nh = vh;   // phone upright = the whole screen; a computer = a phone-shaped column
    const kx = nw / W, ky = nh / H;   // the address bar came or went: everything keeps its place on the new size
    for (const e of [...G.ents, ...G.gems, ...G.pick]) { e.x *= kx; e.x0 = (e.x0 || 0) * kx; e.y *= ky; }
    ship.x *= kx; ship.tx *= kx; ship.y *= ky; ship.ty *= ky;
    W = nw; H = nh; u = W / 360;
    stage.style.width = W + 'px';
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    if (!G.dots.length) for (let i = 0; i < 70; i++) G.dots.push({ x: R(), y: R(), z: 0.35 + R() * 0.65 });
  }
  layout();
  function home() { ship.x = ship.tx = W / 2; ship.y = ship.ty = H * 0.76; ship.vx = 0; ship.tilt = 0; ship.s = 1; ship.a = 1; ship.blink = 0; }
  home();
  const lim = () => ({ x0: shipW() * 0.34, x1: W - shipW() * 0.34, y0: H * 0.36, y1: H - shipH() * 0.52 });   // the wing tips may leave the screen
  const K = () => (G.easy ? TUNE.easy : TUNE.normal);
  const level = () => ease(clamp(G.p / TUNE.calm, 0, 1));
  const vyNow = () => lerp(K().vy[0], K().vy[1], level()) * u;
  const setScore = (bump) => { scoreEl.textContent = G.score; if (bump) { scoreEl.classList.remove('bump'); void scoreEl.offsetWidth; scoreEl.classList.add('bump'); } };

  // ---------- the characters' patterns ----------
  const loaded = () => faces.filter((f) => f.cv);
  let lastFace = null;
  function pickFace() {
    const L = loaded(); if (!L.length) return null;
    let i = Math.floor(R() * L.length); if (L.length > 1 && L[i] === lastFace) i = (i + 1) % L.length;
    return (lastFace = L[i]);
  }
  function bubble(x, mode, extra = {}) {
    const f = pickFace(); if (!f) return null;
    const r = (23 + R() * 11) * u;   // a touch smaller since round 3's bigger ship
    const e = { f, x, x0: x, y: -r - 8 * u, r, vy: vyNow() * (0.9 + R() * 0.22), vx: 0, mode, t: 0, amp: 0, w: 0, ph: R() * 6.28,
      rot: (R() - 0.5) * 0.5, spin: (R() < 0.25 ? (R() - 0.5) * 1.6 : 0), wob: 0.15 + R() * 0.3, knocked: false, flash: 0, ...extra };
    e.hp = e.r > 31 * u ? 3 : 2;   // two shots, the big ones three - shooting your way through is never free
    G.ents.push(e); return e;
  }
  function spawn() {
    const p = G.p, k = K(), roll = R(), margin = 40 * u;
    const rx = () => margin + R() * (W - 2 * margin);
    let extra = 0;
    if (p < 0.1) bubble(rx(), 'line', { vy: vyNow() * 0.85 });
    else if (p < 0.35) { if (roll < 0.55) bubble(rx(), 'line'); else bubble(W * (0.3 + R() * 0.4), 'sine', { amp: (40 + R() * 40) * u, w: 1.2 + R() * 0.6 }); }
    else if (p < 0.62) {
      if (roll < 0.3) bubble(rx(), 'line');
      else if (roll < 0.6) bubble(W * (0.3 + R() * 0.4), 'sine', { amp: (50 + R() * 50) * u, w: 1.3 + R() * 0.7 });
      else if (roll < 0.85) { pair(); extra = 0.25; }
      else { const sd = R() < 0.5 ? 1 : -1; bubble(sd > 0 ? margin : W - margin, 'line', { vx: sd * (45 + R() * 50) * u }); }   // a slow diagonal
    } else {
      if (roll < 0.2) bubble(rx(), 'line');
      else if (roll < 0.4) bubble(W * (0.3 + R() * 0.4), 'sine', { amp: (60 + R() * 50) * u, w: 1.5 + R() * 0.7 });
      else if (roll < 0.6) { pair(); extra = 0.2; }
      else if (roll < 0.8) { wall(k.wall * u); extra = 0.5; }
      else if (k.homing) bubble(rx(), 'home');
      else bubble(rx(), 'line');
    }
    return extra;
  }
  function pair() {   // two from the sides closing in like a gate: through the gap they leave in the middle, or around them
    const vy = vyNow() * 0.95, gap = (K().wall + 6) * u, cxp = W * (0.38 + R() * 0.24);
    for (const s of [-1, 1]) {
      const e = bubble(cxp + s * W * 0.42, 'pair', { vy }); if (!e) continue;
      e.px = cxp + s * (gap / 2 + e.r); e.side = s; e.vx = (-s * Math.abs(e.x - e.px)) / ((H * 0.45) / vy);   // shut by the middle of the screen
    }
  }
  function wall(gap) {   // a row with one way through - the tense part (or shoot your own way)
    const r = 25 * u, gx = gap / 2 + 60 * u + R() * (W - gap - 120 * u), vy = vyNow() * 0.9;
    for (let x = gx - gap / 2 - r; x > -r; x -= 2.15 * r) bubble(x, 'line', { r, vy, spin: 0 });
    for (let x = gx + gap / 2 + r; x < W + r; x += 2.15 * r) bubble(x, 'line', { r, vy, spin: 0 });
  }
  function gemRow() {   // a few stars to pick up, in a line or an arc
    const n = 3 + Math.floor(R() * 3), x0 = 50 * u + R() * (W - 100 * u), curve = (R() - 0.5) * 120 * u, vy = vyNow() * 0.92;
    for (let i = 0; i < n; i++) G.gems.push({ x: clamp(x0 + Math.sin((i / n) * 3.14) * curve, 24 * u, W - 24 * u), y: -20 * u - i * 34 * u, vy, ph: R() * 6 });
  }
  function homeStretch() {   // the calm before the landing: a trail of stars up the middle
    for (let i = 0; i < 8; i++) G.gems.push({ x: W / 2 + Math.sin(i * 0.7) * 60 * u, y: -20 * u - i * 40 * u, vy: vyNow() * 0.9, ph: i });
  }
  function life() {   // a shield floating down - rare (round 2: "lives to collect in space")
    G.pick.push({ x: 50 * u + R() * (W - 100 * u), y: -24 * u, vy: vyNow() * 0.7, ph: R() * 6 });
  }

  // ---------- input: drag anywhere (relative) and the cannon fires while the finger is down; arrows + space on a computer ----------
  let drag = null; const keys = {};
  const onDown = (e) => {
    if (e.target.closest('button')) return;
    au && au.unlock();
    if (G.phase === 'intro' || G.phase === 'paused') begin();
    if (G.phase !== 'fly') return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
  };
  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.id || G.phase !== 'fly') return;
    const g = e.pointerType === 'mouse' ? 1 : 1.15;
    ship.tx += (e.clientX - drag.x) * g; ship.ty += (e.clientY - drag.y) * g; drag.x = e.clientX; drag.y = e.clientY;
    const L = lim(); ship.tx = clamp(ship.tx, L.x0, L.x1); ship.ty = clamp(ship.ty, L.y0, L.y1);
  };
  const onUp = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
  const KEYS = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1, a: 1, d: 1, w: 1, s: 1, ' ': 1 };
  const onKey = (e) => {
    if (!KEYS[e.key]) return;
    e.preventDefault(); keys[e.key] = e.type === 'keydown';
    if (e.type === 'keydown') { au && au.unlock(); if (G.phase === 'intro' || G.phase === 'paused') begin(); }
  };
  const onVis = () => { if (document.hidden && G.phase === 'fly') { G.phase = 'paused'; drag = null; au && au.pause(); showTut(true); } };
  stage.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
  addEventListener('keydown', onKey); addEventListener('keyup', onKey);
  document.addEventListener('visibilitychange', onVis);
  const onResize = () => layout(); addEventListener('resize', onResize);
  muteBtn.onclick = () => setMute(!muted);
  const stats = () => ({ time: Math.round(G.t * 10) / 10, total: Math.round(G.total * 10) / 10, score: G.score, stars: G.stars, shot: G.shot, shields: G.shields, lives: G.lives, hits: G.hits, tries: G.tries, easy: G.easy });
  $('.fly-skip').onclick = () => { const s = stats(); stop(); opts.onSkip && opts.onSkip(s); };
  over.onclick = () => { if (over.dataset.ready) restart(); };
  res.querySelector('.fly-big').onclick = () => { const s = stats(); stop(); opts.onDone && opts.onDone(s); };

  const tutHTML = tut.innerHTML;
  res.querySelector('b').innerHTML = Z.landed.replace('שלומיוורס', '<span>שלומי<i style="font-style:normal;color:#ff6a1f">וורס</i></span>');   // the name in the logo's two colours (his note 2026-11-06)
  function showTut(paused) {   // the first screen, and the same place when they come back to a paused flight
    tut.innerHTML = paused ? `${SVG.hand}<b>${Z.paused}</b>` : tutHTML;
    tut.classList.remove('hide');
  }
  function fresh() {
    G.t = 0; G.p = 0; G.shields = TUNE.shields; G.stars = 0; G.shot = 0; G.lives = 0; G.score = 0;
    G.ents = []; G.gems = []; G.pick = []; G.shots = []; G.booms = []; G.parts = []; G.spawnIn = 1.2; G.gemIn = 2; G.slow = 1; G.shake = 0; G.heat = 0; G.hot = false;
    G.livesAt = K().lives.slice(); G.stretch = false;
  }
  function begin() {
    tut.classList.add('hide');
    if (G.phase === 'intro') { fresh(); loadRest(); }
    G.phase = 'fly';
    au && au.music();
  }
  function restart() {
    over.classList.add('hide'); delete over.dataset.ready;
    G.tries++; G.easy = G.fails >= TUNE.easyAfter;
    fresh();
    says.forEach((s) => { s.f = null; s.d.classList.remove('on'); });
    shieldEls.forEach((s) => s.classList.remove('lost')); setScore();
    home(); G.phase = 'fly'; au && au.duck(false);
  }

  // ---------- the loop ----------
  let raf = 0, last = performance.now(), dead = false;
  function frame(now) {
    if (dead) return;
    if (!root.isConnected) return stop();   // the page moved on without us
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    G.frames.push(dt * 1000); if (G.frames.length > 600) G.frames.shift();
    const total = dt * G.timeScale, n = Math.max(1, Math.ceil(total / (1 / 60)));
    const w0 = performance.now();
    for (let i = 0; i < n; i++) step(total / n);
    if (!G.clipOn) draw();   // once the clip covers the stage the canvas rests
    G.work.push(performance.now() - w0); if (G.work.length > 600) G.work.shift();
  }
  function step(dt) {
    const L = lim();
    if (G.phase === 'fly' || G.phase === 'crash') dt *= G.slow;
    G.bgY += (14 * u + (G.phase === 'end' ? 0 : vyNow() * 0.1)) * dt * (G.phase === 'end' ? 1 + 5 * Math.sin(Math.min(1, G.endT / 1.5) * Math.PI) : 1);
    for (const d of G.dots) { d.y += (d.z * (G.phase === 'end' ? 3 : 1) * (60 + vyNow() * 0.35)) * dt / H; if (d.y > 1) { d.y -= 1; d.x = R(); } }
    if (G.phase === 'intro' || G.phase === 'paused' || G.phase === 'over' || G.phase === 'done') return fx(dt);
    if (G.phase === 'end') return ending(dt);
    if (G.phase === 'crash') { G.slow = Math.max(0.2, G.slow - dt * 2); G.crashT -= dt / G.slow; if (G.crashT <= 0) lost(); }
    if (G.phase === 'fly') {
      G.t += dt; G.total += dt; G.p = Math.min(1, G.t / TUNE.dur);
      if (G.bot) G.bot(G, dt, { W, H, u, shipR: shipR(), lim: L });
      const kv = 380 * u * dt;
      if (keys.ArrowLeft || keys.a) ship.tx -= kv; if (keys.ArrowRight || keys.d) ship.tx += kv;
      if (keys.ArrowUp || keys.w) ship.ty -= kv; if (keys.ArrowDown || keys.s) ship.ty += kv;
      ship.tx = clamp(ship.tx, L.x0, L.x1); ship.ty = clamp(ship.ty, L.y0, L.y1);
      const k = Math.min(1, dt * 22), ox = ship.x;
      ship.x += (ship.tx - ship.x) * k; ship.y += (ship.ty - ship.y) * k;
      ship.vx = (ship.x - ox) / Math.max(dt, 1e-4);
      ship.tilt += (clamp(ship.vx / (700 * u), -1, 1) * 0.32 - ship.tilt) * Math.min(1, dt * 10);
      if (ship.blink > 0) ship.blink -= dt;
      gun(dt);
      if (G.p < TUNE.calm) {
        G.spawnIn -= dt;
        if (G.spawnIn <= 0) { const k2 = K(); G.spawnIn = lerp(k2.gap[0], k2.gap[1], level()) * (0.8 + R() * 0.4) + spawn(); }
        G.gemIn -= dt; if (G.gemIn <= 0) { G.gemIn = 1.6 + R() * 1.2; gemRow(); }
        if (G.livesAt.length && G.p >= G.livesAt[0]) { G.livesAt.shift(); life(); }
      } else if (!G.stretch) { G.stretch = true; homeStretch(); }
      if (G.p > 0.5 && !G.clipReady) { G.clipReady = true; video.preload = 'auto'; video.src = ART + 'fly-end.mp4'; au && au.prepLand(); }   // the end, fetched while they fly
      if (G.p >= 1) { G.phase = 'end'; G.endT = 0; G.end0 = { x: ship.x, y: ship.y }; G.stretch = false; au && au.whoosh(); }
    }
    // the characters
    const sx = ship.x, sy = ship.y, sr = shipR();
    for (const e of G.ents) {
      e.t += dt; if (e.flash > 0) e.flash -= dt;
      if (e.knocked) { e.x += e.vx * dt; e.y += e.vy * dt; e.rot += e.spin * dt; continue; }
      if (e.mode === 'sine') e.x = e.x0 + Math.sin(e.t * e.w + e.ph) * e.amp;
      else if (e.mode === 'home' && e.y < sy - 90 * u) { e.vx += clamp((sx - e.x) * 1.4, -160 * u, 160 * u) * dt; e.vx = clamp(e.vx, -75 * u, 75 * u); e.x += e.vx * dt; }
      else if (e.mode === 'pair') { e.x += e.vx * dt; if (e.side * (e.x - e.px) <= 0) { e.x = e.px; e.vx = 0; } }
      else e.x += e.vx * dt;
      e.y += e.vy * dt; e.rot = e.spin ? e.rot + e.spin * dt : Math.sin(e.t * 1.3 + e.ph) * e.wob;
      if (G.phase === 'fly' && ship.blink <= 0 && Math.hypot(e.x - sx, e.y - sy) < sr + e.r * 0.82) hit(e);
    }
    // the shots
    for (const b of G.shots) {
      b.y -= b.v * dt;
      for (const e of G.ents) {
        if (e.dead || e.knocked || Math.abs(e.x - b.x) > e.r + 4 * u || Math.abs(e.y - b.y) > e.r + 8 * u || Math.hypot(e.x - b.x, e.y - b.y) > e.r + 3 * u) continue;
        b.gone = true;
        if (--e.hp > 0) { e.flash = 0.12; e.y -= 6 * u; au && au.tick(); burst(b.x, b.y, 5, '#ffe2b0', 120); }
        else boom(e);
        break;
      }
    }
    G.shots = G.shots.filter((b) => !b.gone && b.y > -20 * u);
    G.ents = G.ents.filter((e) => !e.dead && e.y < H + e.r + 60 * u && e.x > -W * 0.6 && e.x < W * 1.6);
    // the stars
    for (const g of G.gems) {
      g.y += g.vy * dt; g.ph += dt * 4;
      const d = Math.hypot(g.x - sx, g.y - sy);
      if (G.phase === 'fly' && d < 60 * u) { g.x += (sx - g.x) * Math.min(1, dt * 6); g.y += (sy - g.y) * Math.min(1, dt * 6); }
      if (G.phase === 'fly' && d < sr + 16 * u) { g.got = true; G.stars++; G.score += TUNE.score.star; setScore(true); au && au.star(G.stars); burst(g.x, g.y, 6, '#ffd27a', 120); }
    }
    G.gems = G.gems.filter((g) => !g.got && g.y < H + 30 * u);
    // the shields floating down
    for (const q of G.pick) {
      q.y += q.vy * dt; q.ph += dt * 3; q.x += Math.sin(q.ph) * 20 * u * dt;
      const d = Math.hypot(q.x - sx, q.y - sy);
      if (G.phase === 'fly' && d < 70 * u) { q.x += (sx - q.x) * Math.min(1, dt * 5); q.y += (sy - q.y) * Math.min(1, dt * 5); }
      if (G.phase === 'fly' && d < sr + 20 * u) { q.got = true; gotLife(q); }
    }
    G.pick = G.pick.filter((q) => !q.got && q.y < H + 40 * u);
    sayings(dt);
    fx(dt);
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt);
    fill.style.transform = `scaleX(${G.p})`;
  }
  function gun(dt) {
    const firing = drag || G.fire || keys[' '] || keys.ArrowLeft || keys.ArrowRight || keys.ArrowUp || keys.ArrowDown;
    const g = TUNE.gun;
    G.heat = Math.max(0, G.heat - (G.hot ? g.coolHot : g.cool) * dt);
    if (G.hot && G.heat <= g.resume) G.hot = false;
    G.gunIn -= dt;
    if (!firing || G.hot || G.gunIn > 0) return;
    G.gunIn = g.every; G.heat += g.heat;
    if (G.heat >= 1) { G.heat = 1; G.hot = true; au && au.overheat(); }
    G.shots.push({ x: ship.x, y: ship.y - shipH() * 0.45, v: g.speed * u });
    au && au.pew();
  }
  function boom(e) {   // a comic pop: the face swells and bursts, a spiky star, confetti
    e.dead = true; G.shot++; G.score += TUNE.score.shot; setScore(true);
    G.booms.push({ x: e.x, y: e.y, r: e.r, f: e.f, rot: e.rot, t: 0, spikes: 9 + Math.floor(R() * 4), turn: R() * 6.28 });
    burst(e.x, e.y, 18, '#ffd27a', 260); burst(e.x, e.y, 10, '#ff6a1f', 200); burst(e.x, e.y, 6, '#ffffff', 160);
    G.shake = Math.max(G.shake, 0.12);
    au && au.boom();
  }
  function gotLife(q) {
    burst(q.x, q.y, 14, '#ffd27a', 180);
    if (G.shields < TUNE.shields) {
      const s = shieldEls[G.shields]; G.shields++;
      if (s) { s.classList.remove('lost'); s.classList.add('pop'); setTimeout(() => s.classList.remove('pop'), 220); }
    } else { G.lives++; G.score += TUNE.score.life; setScore(true); }
    au && au.life();
  }
  function hit(e) {
    G.hits++; G.shields--; ship.blink = TUNE.blink; G.shake = 0.35;
    e.knocked = true; const dx = e.x - ship.x || 1; e.vx = Math.sign(dx) * 260 * u; e.vy = -60 * u; e.spin = Math.sign(dx) * 6;
    burst((e.x + ship.x) / 2, (e.y + ship.y) / 2, 16, '#ff8a3d', 260);
    const s = shieldEls[G.shields]; if (s) { s.classList.add('pop'); setTimeout(() => { s.classList.remove('pop'); s.classList.add('lost'); }, 160); }
    try { navigator.vibrate && navigator.vibrate(G.shields > 0 ? 60 : [80, 40, 120]); } catch (err) {}
    au && au.hit();
    if (G.shields <= 0) { G.phase = 'crash'; G.crashT = 0.7; drag = null; burst(ship.x, ship.y, 40, '#ffb347', 340); au && au.crash(); ship.a = 0; }
  }
  function lost() {
    G.phase = 'over'; G.fails++;
    const easyNext = G.fails >= TUNE.easyAfter;
    over.querySelector('span').textContent = Z.lostLine;
    over.querySelector('em').textContent = easyNext ? Z.easier : '';
    over.classList.remove('hide'); au && au.duck(true);
    setTimeout(() => { over.dataset.ready = '1'; }, 350);   // a tap still on its way from the crash doesn't restart it
  }
  function burst(x, y, n, c, sp) { for (let i = 0; i < n; i++) { const a = R() * 6.28, v = (0.3 + R()) * sp * u; G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + R() * 0.4, t: 0, c, s: (1.5 + R() * 2.5) * u }); } }
  function fx(dt) {
    for (const q of G.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.96; q.vy *= 0.96; }
    G.parts = G.parts.filter((q) => q.t < q.life);
    for (const b of G.booms) { b.t += dt; b.y += 40 * u * dt; }
    G.booms = G.booms.filter((b) => b.t < 0.45);
  }

  // a character on its way past sometimes says one of its own lines, beside its head (rules.md: talks beside his own head)
  function sayings(dt) {
    G.sayIn -= dt;
    if (G.sayIn <= 0 && G.phase === 'fly') {
      G.sayIn = 3 + R() * 2.5;
      const busy = new Set(says.map((s) => s.f));
      const c = G.ents.filter((e) => !e.knocked && e.f.quotes.length && !busy.has(e) && e.y > 40 * u && e.y < H * 0.45);
      const slot = says.find((s) => !s.f);
      if (c.length && slot) {
        const e = c[Math.floor(R() * c.length)]; slot.f = e; slot.until = G.t + 1.9;
        slot.d.textContent = e.f.quotes[Math.floor(R() * e.f.quotes.length)]; slot.w = slot.d.offsetWidth; slot.h = slot.d.offsetHeight; slot.d.classList.add('on');
      }
    }
    for (const s of says) {
      if (!s.f) continue;
      const e = s.f;
      if (G.t > s.until || e.knocked || e.dead || e.y > H * 0.8 || G.phase !== 'fly') { s.d.classList.remove('on'); s.f = null; continue; }
      const w = s.w, h = s.h, left = e.x > W / 2;
      const x = clamp(left ? e.x - e.r - 6 * u - w : e.x + e.r + 6 * u, 4, W - w - 4), y = clamp(e.y - e.r - h * 0.3, 60 * u, H - h - 4);
      s.d.style.transform = `translate(${x}px, ${y}px)`;
    }
  }

  // ---------- the landing: the planet settles where the teaser's turning logo begins, the ship flies in, the clip takes over ----------
  function clipPlanet() {
    const s = Math.max(W / CLIP.w, H / CLIP.h), ox = (W - CLIP.w * s) / 2, oy = (H - CLIP.h * s) / 2;
    return { x: CLIP.cx * s + ox, y: CLIP.cy * s + oy, ring: CLIP.ring * s };
  }
  const flyPlanet = (p) => ({ x: W / 2, y: lerp(H * 0.15, H * 0.21, p), ring: lerp(0.3, 0.5, p * p) * W });
  function planetNow() {
    if (G.phase !== 'end' && G.phase !== 'done') return flyPlanet(G.p);
    const a = flyPlanet(1), b = clipPlanet(), k = ease(clamp(G.endT / 1.5, 0, 1));
    return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), ring: lerp(a.ring, b.ring, k) };
  }
  function ending(dt) {
    G.endT += dt;
    const T0 = G.endT, P = planetNow(), k = ease(clamp(T0 / 1.35, 0, 1));
    ship.x = lerp(G.end0.x, P.x, k); ship.y = lerp(G.end0.y, P.y, k) - Math.sin(k * Math.PI) * 30 * u;
    ship.s = lerp(1, 0.1, k * k); ship.a = T0 < 1.2 ? 1 : Math.max(0, 1 - (T0 - 1.2) / 0.2); ship.tilt *= 0.9; ship.blink = 0;
    for (const e of G.ents) { e.y += e.vy * dt * 1.6; }
    for (const g of G.gems) g.y += g.vy * dt * 1.6;
    for (const q of G.pick) q.y += q.vy * dt * 1.6;
    G.shots = [];
    if (T0 > 0.3) { hud.classList.add('gone'); scoreEl.style.opacity = '0'; }
    if (T0 >= 1.3 && !G.flashed) { G.flashed = true; G.flash = 1; burst(P.x, P.y, 26, '#ffd27a', 200); }
    if (T0 >= 1.5 && !G.clip) {
      G.clip = true; G.phase = 'done';
      G.score += G.shields * TUNE.score.shield;   // every shield brought home counts
      au && au.land();
      if (!video.src) video.src = ART + 'fly-end.mp4';
      video.muted = true;
      const c = clipPlanet(); video.style.transformOrigin = `${c.x}px ${c.y}px`;
      const show = () => { video.classList.add('on'); setTimeout(() => { G.clipOn = true; }, 600); setTimeout(() => video.classList.add('settle'), 1800); };
      video.play().then(show).catch(() => {});   // no clip (a slow line, a refusal): the game's own planet stays and the result still comes
      let shown = false; const result = () => { if (shown || dead) return; shown = true; showResult(); };
      video.onended = result; setTimeout(result, 6400);   // the clip runs 5.6 s: the word turns on, the glow settles
    }
    fx(dt);
  }
  function showResult() {
    res.querySelector('.fly-pts').textContent = Z.points(G.score);
    res.querySelector('.fly-stats').textContent = Z.result(Math.round(G.t), G.stars, G.shot, G.shields);
    res.classList.remove('hide');
    // today's table (records/fly_<day>, citizen.js passes the doors): the score goes in, the top shows here
    const rc = opts.records; if (!rc) return;
    const board = res.querySelector('.fly-board'), ol = board.querySelector('ol'), note = board.querySelector('p');
    const esc = (s) => String(s || '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
    Promise.resolve(rc.submit(G.score)).catch(() => null).then((r) => Promise.resolve(rc.top()).catch(() => []).then((top) => {
      if (dead) return;
      const me = rc.me && rc.me();
      ol.innerHTML = (top || []).slice(0, 3).map((x, i) => `<li class="${me && x.uid === me ? 'me' : ''}"><i>${i + 1}</i><span>${esc(x.nick || x.first)}</span><b>${Math.round(x.value)}</b></li>`).join('');
      note.textContent = r && r.place ? Z.mine(r.place) : (top && top.length ? '' : Z.boardEmpty);
      board.classList.add('on');
    }));
  }

  // ---------- drawing ----------
  const shieldPath = typeof Path2D !== 'undefined' ? new Path2D(SHIELD_D) : null;
  function draw() {
    const c = cx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (G.shake > 0) { const m = (G.shake / 0.35) * 8 * u; c.translate((R() - 0.5) * m, (R() - 0.5) * m); }
    // space (seamless tile) and two layers of passing stars
    c.fillStyle = '#060302'; c.fillRect(-20, -20, W + 40, H + 40);
    if (ok(A.space)) {
      const th = W * (A.space.naturalHeight / A.space.naturalWidth), off = G.bgY % th;
      for (let y = off - th; y < H; y += th) c.drawImage(A.space, 0, y, W, th + 1);
    }
    const streak = G.phase === 'done' ? 0 : G.phase === 'end' ? 1 + 10 * Math.sin(Math.min(1, G.endT / 1.5) * Math.PI) : 1;
    c.fillStyle = streak > 1.5 ? '#ffd9b8' : '#fff';
    for (const d of G.dots) { c.globalAlpha = (0.25 + d.z * 0.6) * (streak > 1.5 ? 0.45 : 1); c.fillRect(d.x * W, d.y * H, d.z * 1.6 * u * (streak > 1.5 ? 0.6 : 1), d.z * 1.6 * u * streak); }
    c.globalAlpha = 1;
    // the goal: the planet from behind, its word not on the ring yet - it turns on only in the clip, at the landing
    if (ok(A.planet)) {
      const P = planetNow(), pul = G.phase === 'done' ? 1 : 1 + Math.sin(performance.now() / 600) * 0.012, w = (P.ring / PLANET_RING) * pul;
      c.drawImage(A.planet, P.x - w / 2, P.y - w / 2, w, w);
    }
    // stars and shields to pick up
    if (ok(A.star)) for (const g of G.gems) { const s = (20 + Math.sin(g.ph) * 2) * u; c.drawImage(A.star, g.x - s / 2, g.y - s / 2, s, s); }
    // the characters
    for (const e of G.ents) {
      if (!e.f.cv) continue;
      const s = (e.r * 2 * FS) / (FS - 18);
      c.save(); c.translate(e.x, e.y); c.rotate(e.rot); c.drawImage(e.f.cv, -s / 2, -s / 2, s, s);
      if (e.flash > 0) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.7; c.fillStyle = '#fff3e0'; c.beginPath(); c.arc(0, 0, e.r, 0, 6.283); c.fill(); }
      c.restore();
    }
    for (const b of G.booms) drawBoom(c, b);
    for (const q of G.pick) drawLife(c, q);   // over the faces: a shield must never hide behind one
    // shots and sparks
    c.globalCompositeOperation = 'lighter';
    for (const b of G.shots) {   // a glowing bolt: an orange halo, a white-hot core, a fading tail
      c.fillStyle = 'rgba(255,120,30,.45)'; c.fillRect(b.x - 4.5 * u, b.y - 12 * u, 9 * u, 24 * u);
      const g = c.createLinearGradient(b.x, b.y - 12 * u, b.x, b.y + 16 * u); g.addColorStop(0, '#fffbe6'); g.addColorStop(0.45, '#ffc15a'); g.addColorStop(1, 'rgba(255,100,20,0)');
      c.fillStyle = g; c.fillRect(b.x - 2.4 * u, b.y - 12 * u, 4.8 * u, 28 * u);
    }
    for (const q of G.parts) { c.globalAlpha = 1 - q.t / q.life; c.fillStyle = q.c; c.beginPath(); c.arc(q.x, q.y, q.s * (1 - (q.t / q.life) * 0.5), 0, 6.283); c.fill(); }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    // a soft shade under the HUD, so the shields and the bar read over whatever passes
    if (G.phase !== 'done') { const sh = c.createLinearGradient(0, 0, 0, 90 * u); sh.addColorStop(0, 'rgba(5,3,2,.6)'); sh.addColorStop(1, 'rgba(5,3,2,0)'); c.fillStyle = sh; c.fillRect(0, 0, W, 90 * u); }
    // the ship (blinking after a hit), its engine flickering, the cannon's heat under it
    if (ship.a > 0 && ok(A.ship) && !(ship.blink > 0 && Math.floor(ship.blink * 12) % 2)) {
      const w = shipW() * ship.s, h = shipH() * ship.s;
      c.save(); c.globalAlpha = ship.a; c.translate(ship.x, ship.y); c.rotate(ship.tilt);
      c.globalCompositeOperation = 'lighter';
      const fl = 0.85 + Math.random() * 0.3, gr = c.createRadialGradient(0, h * 0.4, 0, 0, h * 0.4, w * 0.3 * fl);
      gr.addColorStop(0, 'rgba(255,190,110,.55)'); gr.addColorStop(1, 'rgba(255,90,20,0)');
      c.fillStyle = gr; c.fillRect(-w, h * 0.4 - w, w * 2, w * 2);
      c.globalCompositeOperation = 'source-over';
      c.drawImage(A.ship, -w / 2, -h * 0.52, w, h);   // the logo's disc (52% down the picture) sits on the ship's point
      c.restore();
    }
    if (G.phase === 'fly' && G.heat > 0.04) {   // the heat: an arc under the ship, orange to red, blinking when it is too hot
      const r = 30 * u, a0 = Math.PI * 0.2, a1 = Math.PI * 0.8;
      c.save(); c.translate(ship.x, ship.y + 16 * u); c.lineCap = 'round'; c.lineWidth = 3.5 * u;
      c.strokeStyle = 'rgba(255,255,255,.16)'; c.beginPath(); c.arc(0, 0, r, a0, a1); c.stroke();
      c.strokeStyle = G.hot ? (Math.floor(performance.now() / 120) % 2 ? '#ff3b1f' : '#ffb347') : G.heat > 0.7 ? '#ff5a1f' : '#ffb347';
      c.beginPath(); c.arc(0, 0, r, a1 - (a1 - a0) * G.heat, a1); c.stroke(); c.restore();
    }
    // the flash as the ship enters the planet
    if (G.flash > 0) {
      const P = planetNow(), r = (P.ring / PLANET_RING) * (0.4 + (1 - G.flash) * 0.5);
      const gr = c.createRadialGradient(P.x, P.y, 0, P.x, P.y, r);
      gr.addColorStop(0, `rgba(255,236,200,${0.9 * G.flash})`); gr.addColorStop(1, 'rgba(255,120,40,0)');
      c.globalCompositeOperation = 'lighter'; c.fillStyle = gr; c.fillRect(P.x - r, P.y - r, r * 2, r * 2); c.globalCompositeOperation = 'source-over';
      G.flash = Math.max(0, G.flash - 1 / 30);
    }
  }
  function drawLife(c, q) {   // a shield in a glowing bubble, a white plus on it
    const s = (40 + Math.sin(q.ph * 3) * 3) * u, bob = Math.sin(q.ph * 1.5) * 2 * u;
    c.save(); c.translate(q.x, q.y + bob);
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(0, 0, 0, 0, 0, s * 0.95); g.addColorStop(0, 'rgba(255,170,80,.55)'); g.addColorStop(1, 'rgba(255,106,31,0)');
    c.fillStyle = g; c.fillRect(-s, -s, s * 2, s * 2);
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = 'rgba(255,220,160,.9)'; c.lineWidth = 2 * u; c.beginPath(); c.arc(0, 0, s * 0.62, 0, 6.283); c.stroke();
    if (shieldPath) {
      const k = (s * 0.8) / 24; c.translate(-12 * k, -12.4 * k); c.scale(k, k);
      c.fillStyle = '#ff6a1f'; c.fill(shieldPath); c.lineWidth = 1.4; c.strokeStyle = '#ffd27a'; c.stroke(shieldPath);
      c.strokeStyle = '#fff'; c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(12, 8.2); c.lineTo(12, 15.8); c.moveTo(8.2, 12); c.lineTo(15.8, 12); c.stroke();
    }
    c.restore();
  }
  function drawBoom(c, b) {   // 0.45 s: the face swells and fades, a spiky comic star bursts out of it
    const k = b.t / 0.45, s = b.r * (1 + k * 0.9);
    c.save(); c.translate(b.x, b.y);
    if (k < 0.45 && b.f.cv) { c.globalAlpha = 1 - k / 0.45; const fs = (s * 2 * FS) / (FS - 18); c.rotate(b.rot); c.drawImage(b.f.cv, -fs / 2, -fs / 2, fs, fs); c.rotate(-b.rot); }
    const R1 = b.r * (0.7 + ease(Math.min(1, k * 1.6)) * 1.1), R0 = R1 * 0.55;
    c.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4; c.rotate(b.turn + k * 0.6);
    const star = (ro, ri) => { c.beginPath(); for (let i = 0; i < b.spikes * 2; i++) { const a = (i / (b.spikes * 2)) * 6.283, r = i % 2 ? ri : ro * (0.85 + ((i * 37) % 7) / 30); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); };
    star(R1, R0); c.fillStyle = '#ff6a1f'; c.fill(); c.lineWidth = 3 * u; c.strokeStyle = '#2a1206'; c.stroke();
    star(R1 * 0.68, R0 * 0.62); c.fillStyle = '#ffd23f'; c.fill();
    c.beginPath(); c.arc(0, 0, R0 * 0.42, 0, 6.283); c.fillStyle = '#fffbe8'; c.fill();
    c.restore();
  }
  raf = requestAnimationFrame(frame);

  function stop() {
    if (dead) return; dead = true;
    cancelAnimationFrame(raf);
    stage.removeEventListener('pointerdown', onDown);
    removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp);
    removeEventListener('keydown', onKey); removeEventListener('keyup', onKey); removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVis);
    try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) {}
    au && au.close();
    if (window.FLY === G) delete window.FLY;
    root.remove();
  }
  G.stop = stop; G.stats = stats; G.restart = () => over.dataset.ready && restart(); G.faces = faces;
  window.FLY = G;   // the test hook (rules.md 11): tests read the game from here, never from pixels
  return { stop, stats };
}

// ---------- sound: real effects (fly-sfx.mjs) on WebAudio - several takes for what repeats, never the same one twice running,
// a little pitch play on the shots; the music and an engine hum under everything ----------
const SFX = { pew: ['laser-1', 'laser-2', 'laser-3'], boom: ['boom-1', 'boom-2'], hit: ['hit'], life: ['life'], star: ['star'], whoosh: ['whoosh'], engine: ['engine'] };
function makeAudio(muted) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
  const mus = ctx.createGain(); mus.gain.value = 0.55; mus.connect(master);
  const fx = ctx.createGain(); fx.gain.value = 0.85; fx.connect(master);
  const buf = {};
  const decode = (b) => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no));
  const load = (k, url, pre) => (pre || fetch(url).then((r) => r.arrayBuffer())).then((b) => (b ? decode(b.slice(0)) : null)).then((b) => { if (b) buf[k] = b; }).catch(() => {});
  const ready = { music: load('music', ART + 'fly-music.mp3', PRE.music), land: null, fx: null };
  // the effects load in two steps: what the flight needs at once, then the rest
  const loadFx = () => {
    if (ready.fx) return ready.fx;
    const first = ['laser-1', 'laser-2', 'laser-3', 'boom-1', 'boom-2', 'star', 'hit', 'engine'];
    ready.fx = Promise.all(first.map((n) => load(n, ART + `fly-${n}.mp3`))).then(() => Promise.all(['life', 'whoosh'].map((n) => load(n, ART + `fly-${n}.mp3`))));
    return ready.fx;
  };
  let loop = null, hum = null, wantMusic = false, closed = false;
  const now = () => ctx.currentTime;
  const last = {};
  function play(kind, gain = 1, rate = 1) {
    const L = SFX[kind].filter((n) => buf[n]); if (!L.length || closed) return;
    let n = L[Math.floor(Math.random() * L.length)]; if (L.length > 1 && n === last[kind]) n = L[(L.indexOf(n) + 1) % L.length];
    last[kind] = n;
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = buf[n]; s.playbackRate.value = rate; g.gain.value = gain;
    s.connect(g).connect(fx); s.start();
  }
  const jit = (a) => 1 + (Math.random() - 0.5) * a;
  function bed(k, gain, out) {   // a loop that fades in
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = buf[k]; s.loop = true; if (k === 'engine') { s.loopStart = 0.03; s.loopEnd = buf[k].duration - 0.03; }
    g.gain.setValueAtTime(0.0001, now()); g.gain.exponentialRampToValueAtTime(gain, now() + 0.6);
    s.connect(g).connect(out); s.g = g; s.start(); return s;
  }
  const fade = (s) => { if (!s) return; s.g.gain.setTargetAtTime(0.0001, now(), 0.18); setTimeout(() => { try { s.stop(); } catch (e) {} }, 900); };
  return {
    unlock() { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); loadFx(); },
    pause() { ctx.suspend().catch(() => {}); },
    mute(m) { master.gain.setTargetAtTime(m ? 0 : 1, now(), 0.05); },
    music() {
      wantMusic = true;
      ready.music.then(() => { if (wantMusic && !loop && buf.music && !closed) loop = bed('music', 1, mus); });
      loadFx().then(() => { if (wantMusic && !hum && buf.engine && !closed) hum = bed('engine', 0.32, fx); });
    },
    prepLand() { if (!ready.land) ready.land = load('land', ART + 'fly-land.mp3'); },
    duck(on) { mus.gain.setTargetAtTime(on ? 0.2 : 0.55, now(), 0.15); if (hum) hum.g.gain.setTargetAtTime(on ? 0.06 : 0.32, now(), 0.15); },
    star(n) { play('star', 0.75, 1 + (Math.min(n, 12) % 6) * 0.05); },
    pew() { play('pew', 0.5, jit(0.14)); },
    tick() { play('hit', 0.22, 1.9 * jit(0.1)); },
    boom() { play('boom', 0.95, jit(0.18)); },
    overheat() { play('hit', 0.3, 0.55); },
    life() { play('life', 0.9); },
    hit() { play('hit', 1, jit(0.08)); },
    crash() { play('boom', 1, 0.62); play('hit', 0.8, 0.8); },
    whoosh() { play('whoosh', 0.95); fade(hum); hum = null; },
    // the landing bars of the teaser's music take over from the loop, the same piece going on
    land() {
      wantMusic = false;
      fade(loop); loop = null; fade(hum); hum = null;
      const go = () => { if (closed || !buf.land) return; const s = ctx.createBufferSource(); s.buffer = buf.land; s.connect(mus); s.start(); };
      if (buf.land) go(); else { this.prepLand(); ready.land.then(go); }
      mus.gain.setTargetAtTime(0.75, now(), 0.1);
    },
    close() { closed = true; try { loop && loop.stop(); hum && hum.stop(); } catch (e) {} ctx.close().catch(() => {}); },
  };
}
