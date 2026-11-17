// The Shlomiverse's locked version of a video with a socials ending - BETA, loaded by nothing yet (his ask, 2026-11-17).
// A video whose socials version "loses reception" (zoomcut render/src/layers/ending.js) plays here in full only for a
// signed-in viewer. Signed out, the full file plays up to the same moment and the reception drops there too, drawn
// live over the real video exactly as the studio draws it: two glitches with their sounds (the voices drop out), the
// picture freezes, breaks into blocks and goes dark, the error box ("בעיית קליטה / הקשר עם יקום שלומיוורס נותק").
// Here its last line and button say "sign in" - signing in brings the reception back and the video goes on from that
// second. One more thing for a gated video: a pill at the start - "seen it on the socials? jump to where it dropped".
// A light lock (his call): the full file is the one the page plays; scrubbing past the drop drops the signal again.
//
//   const gate = signalLost({ video, stage, drop, signedIn, signIn, assets })
//     video     the <video> playing the FULL file            stage   its box (the overlay covers it)
//     drop      {at, glitches: [[start, end, amount], ...]} - seconds in the full file (studio: version.js dropOf)
//     signedIn  () => boolean                                signIn  async () => boolean (the site's sign-in)
//     assets    {logo, glitch1, glitch2, hiss} URLs
//   gate.check() after the viewer signs in or out elsewhere; gate.destroy() when the player closes.
// The glitch is the studio's own plan for each frame (effect_curve.js glitchPlan, copied below), the blocks its
// pixelBlock - so the site, the editor and the exported socials file show the same glitch.

const FPS = 30;
function glitchPlan(f, a, W, H) {   // = zoomcut/render/src/layers/effect_curve.js glitchPlan
  const r = (s) => { const x = Math.sin(s * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
  if (!(a > 0.002) || r(f * 9.13 + 1) < 0.2) return null;
  const k = W / 1080, n = 2 + Math.floor(r(f * 2.11 + 3) * 4), bands = [], lines = [];
  for (let i = 0; i < n; i++) bands.push({ y: Math.floor(r(f * 3.71 + i * 1.3 + 4) * H), h: Math.max(4, Math.floor((0.015 + 0.07 * r(f * 5.31 + i * 2.7 + 5)) * H)),
    dx: Math.round((r(f * 7.13 + i * 3.1 + 6) - 0.5) * 2 * 70 * a * k) });
  for (let i = 0; i < 3; i++) lines.push({ y: Math.floor(r(f * 11.7 + i * 4.3 + 7) * H), h: Math.max(2, Math.round((1 + 3 * r(f * 13.1 + i + 8)) * k)), o: +(a * (0.35 + 0.4 * r(f * 17.3 + i + 9))).toFixed(3) });
  return { split: Math.round(a * 18 * (0.4 + 0.6 * r(f * 1.37 + 2)) * k), bands, lines };
}
const pixelBlock = (a, W) => Math.max(2, Math.round((4 + 76 * a) * W / 1080));   // = effect_curve.js pixelBlock

const NO_SIGNAL = '<svg viewBox="0 0 100 64" aria-hidden="true"><rect x="0" y="42" width="15" height="22" rx="3" fill="#ff6a1f"/><rect x="20" y="29" width="15" height="35" rx="3" fill="#ff6a1f" opacity=".32"/><rect x="40" y="16" width="15" height="48" rx="3" fill="#ff6a1f" opacity=".32"/><rect x="60" y="3" width="15" height="61" rx="3" fill="#ff6a1f" opacity=".32"/><path d="M81 3l16 16M97 3L81 19" stroke="#ff6a1f" stroke-width="6" stroke-linecap="round"/></svg>';
const WORDS = { label: 'בעיית קליטה', title: 'הקשר עם יקום<br>שלומיוורס נותק', line: 'לסיום המלא – מתחברים לשלומיוורס', btn: 'מתחברים ומחזירים את הקליטה',
  wait: 'מתחברים…', back: 'הקליטה חזרה', jump: 'ראיתם ברשתות? לרגע שהקליטה נפלה' };

export function signalLost({ video, stage, drop, signedIn, signIn, assets = {}, words = {} }) {
  const T = { ...WORDS, ...words };
  if (!drop || !(drop.at > 0)) return { check() {}, destroy() {} };
  const at = +drop.at, glitches = (drop.glitches || []).map(([s, e, a]) => [+s, +e, a ?? 1]);
  const root = document.createElement('div');
  root.className = 'sl';
  root.innerHTML = `<canvas class="sl-cv"></canvas><div class="sl-dark"></div>
    <div class="sl-card" hidden><div class="sl-box"></div>
      <img class="sl-logo" alt="" src="${assets.logo || ''}">
      <div class="sl-label">${NO_SIGNAL}<span>${T.label}</span></div>
      <div class="sl-title">${T.title}</div>
      <div class="sl-line">${T.line}</div>
      <button class="sl-btn" type="button">${T.btn}</button></div>
    <div class="sl-toast" hidden>${T.back}</div>
    <button class="sl-jump" type="button" hidden>${T.jump}<i>‹</i></button>`;
  stage.append(root);
  const cv = root.querySelector('.sl-cv'), ctx = cv.getContext('2d'), dark = root.querySelector('.sl-dark'), card = root.querySelector('.sl-card');
  const btn = root.querySelector('.sl-btn'), toast = root.querySelector('.sl-toast'), jump = root.querySelector('.sl-jump');
  const off = document.createElement('canvas'), comp = document.createElement('canvas'), tiny = document.createElement('canvas'), still = document.createElement('canvas');
  let state = 'play', raf = 0, gone = false, wasMuted = false, inGlitch = -1, lostAt = 0;

  // the card's units: the stage's width / 1080 (laid out like the studio's 1080 x 1920 ending)
  const size = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    root.style.setProperty('--u', `${w / 1080}px`);
    for (const c of [cv, off, comp]) { c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h)); }
    if (state === 'lost') drawStill(1);
  };
  const ro = new ResizeObserver(size); ro.observe(stage); size();

  // the video's picture as the stage shows it (object-fit cover / contain)
  const fitRect = (cw, ch) => {
    const vw = video.videoWidth || cw, vh = video.videoHeight || ch, cover = getComputedStyle(video).objectFit !== 'contain';
    const s = cover ? Math.max(cw / vw, ch / vh) : Math.min(cw / vw, ch / vh), w = vw * s, h = vh * s;
    return [(cw - w) / 2, (ch - h) / 2, w, h];
  };
  const drawVideo = (c, src = video) => { const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); const [x, y, w, h] = fitRect(c.width, c.height); g.drawImage(src, x, y, w, h); };

  // ---- sound: the same files as the studio's ending, on the audio clock (unlocked by the viewer's first tap) ----
  let ac = null; const bufs = {};
  const unlock = () => {
    if (ac) { if (ac.state === 'suspended') ac.resume().catch(() => {}); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    for (const k of ['glitch1', 'glitch2', 'hiss']) if (assets[k]) fetch(assets[k]).then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b)).then((d) => { bufs[k] = d; }).catch(() => {});
  };
  const sfx = (k, from, len, gain = 1, fade = 0) => {
    if (!ac || !bufs[k]) return null;
    const s = ac.createBufferSource(), g = ac.createGain(), t = ac.currentTime;
    s.buffer = bufs[k]; s.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(fade ? 0 : gain, t); if (fade) g.gain.linearRampToValueAtTime(gain, t + fade);
    s.start(t, from, len); return { s, g };
  };
  ['pointerdown', 'keydown', 'touchend'].forEach((e) => document.addEventListener(e, unlock, { capture: true }));
  video.addEventListener('play', unlock);

  // ---- the glitch: the red pulled one way and the blue the other, bands of that torn sideways, static lines ----
  const TINT = ['#f00', '#0f0', '#00f'];
  const drawGlitch = (gp) => {
    const W = cv.width, H = cv.height, g = comp.getContext('2d'), o = off.getContext('2d');
    g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    TINT.forEach((tint, i) => {
      drawVideo(off); o.globalCompositeOperation = 'multiply'; o.fillStyle = tint; o.fillRect(0, 0, W, H); o.globalCompositeOperation = 'source-over';
      g.globalCompositeOperation = 'lighter'; g.drawImage(off, i === 0 ? -gp.split : i === 2 ? gp.split : 0, 0);
    });
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(comp, 0, 0);
    for (const b of gp.bands) if (b.h > 0) ctx.drawImage(comp, 0, b.y, W, b.h, b.dx, b.y, W, b.h);
    for (const [i, l] of gp.lines.entries()) {
      ctx.globalAlpha = l.o;
      for (let x = -((performance.now() / 8 + i * 11) % 16); x < W; x += 16) { ctx.fillStyle = '#fff'; ctx.fillRect(x, l.y, 3, l.h); ctx.fillStyle = '#777'; ctx.fillRect(x + 3, l.y, 2, l.h); ctx.fillStyle = '#ccc'; ctx.fillRect(x + 9, l.y, 2, l.h); }
      ctx.globalAlpha = 1;
    }
  };
  // ---- the frozen picture in blocks: a amount 0..0.6 (the studio's ending.pixel), drawn from the frame it froze on ----
  const drawStill = (k) => {
    const W = cv.width, H = cv.height, b = pixelBlock(0.6 * k, W);
    if (k <= 0.01) { ctx.drawImage(still, 0, 0, W, H); return; }
    tiny.width = Math.max(1, Math.round(W / b)); tiny.height = Math.max(1, Math.round(H / b));
    const t = tiny.getContext('2d'); t.imageSmoothingEnabled = true; t.drawImage(still, 0, 0, tiny.width, tiny.height);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(tiny, 0, 0, W, H); ctx.imageSmoothingEnabled = true;
  };
  const ramp = (ms, fn, done) => { const t0 = performance.now(); const go = (t) => { const k = Math.min(1, (t - t0) / ms); fn(k); if (k < 1 && !gone) requestAnimationFrame(go); else done?.(); }; requestAnimationFrame(go); };
  // the studio's flicker keys ([seconds, opacity], linear between, from the card's first frame)
  const flick = (el, keys, loop = 0) => {
    const T0 = keys[keys.length - 1][0];
    el.animate(keys.map(([t, v]) => ({ offset: T0 ? t / T0 : 1, opacity: v })), { duration: Math.max(1, T0 * 1000), fill: 'both', delay: loop ? 0 : 0, iterations: 1 });
    if (loop) setTimeout(() => !gone && el.animate([{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0.3, offset: 0.62 }, { opacity: 0.3, offset: 0.7 }, { opacity: 1, offset: 0.72 }, { opacity: 1 }], { duration: loop * 1000, iterations: Infinity }), T0 * 1000);
  };

  let hiss = null;
  function lose() {
    if (state === 'lost' || signedIn()) return;
    state = 'lost'; lostAt = performance.now();
    video.pause();
    const freeze = () => {
      still.width = cv.width; still.height = cv.height; drawVideo(still);
      cv.style.opacity = '1'; drawStill(0);
      ramp(220, (k) => drawStill(k));
      dark.style.transition = 'opacity .3s linear'; dark.style.opacity = '1';
      hiss = sfx('hiss', 0.8, 3.2, 0.1, 0.08); if (hiss) hiss.g.gain.linearRampToValueAtTime(0, ac.currentTime + 3.1);
      setTimeout(showCard, 120);
    };
    if (Math.abs(video.currentTime - (at - 1 / FPS)) > 0.08) { video.addEventListener('seeked', freeze, { once: true }); video.currentTime = at - 1 / FPS; } else freeze();
  }
  function showCard() {
    if (state !== 'lost' || gone) return;
    card.hidden = false; jump.hidden = true;
    const q = (s) => card.querySelector(s);
    flick(q('.sl-box'), [[0, 0], [0.03, 1], [0.06, 0.35], [0.09, 1]]);
    flick(q('.sl-logo'), [[0, 0], [0.04, 1], [0.08, 0.15], [0.12, 1], [1.1, 1], [1.13, 0.35], [1.17, 1], [1.95, 1], [1.98, 0.5], [2.02, 1]], 3.2);
    flick(q('.sl-label'), [[0, 0], [0.05, 1], [0.6, 1], [0.62, 0.25], [0.95, 0.25], [0.97, 1]], 1.8);
    flick(q('.sl-title'), [[0, 0], [0.08, 0], [0.11, 1], [0.15, 0.3], [0.19, 1]]);
    flick(q('.sl-line'), [[0, 0], [0.3, 0], [0.42, 1]]);
    const C = 'translate(-50%,-50%) ';   // (the card's parts are centred by their transform)
    q('.sl-btn').animate([{ offset: 0, opacity: 0, transform: C + 'scale(.85)' }, { offset: 0.45 / 0.7, opacity: 0, transform: C + 'scale(.85)' }, { offset: 0.55 / 0.7, opacity: 1, transform: C + 'scale(.95)' }, { offset: 0.6 / 0.7, opacity: 1, transform: C + 'scale(1.04)' }, { offset: 1, opacity: 1, transform: C + 'scale(1)' }], { duration: 700, fill: 'both' });
  }
  // signed in: the reception comes back - a short glitch, the blocks get small, the dark lifts, the video goes on
  function restore() {
    if (state !== 'lost') return;
    state = 'back';
    hiss?.g.gain.cancelScheduledValues(ac.currentTime); hiss?.g.gain.linearRampToValueAtTime(0, ac.currentTime + 0.15);
    sfx('glitch2', 0.16, 0.16, 0.8);
    card.animate([{ opacity: 1 }, { opacity: 0.2, offset: 0.25 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }).onfinish = () => { card.hidden = true; card.getAnimations().forEach((a) => a.cancel()); };
    dark.style.transition = 'opacity .35s linear'; dark.style.opacity = '0';
    ramp(320, (k) => drawStill(1 - k), () => {
      cv.style.opacity = '0'; state = 'play';
      toast.hidden = false; toast.animate([{ opacity: 0, transform: 'translate(-50%,-6px)' }, { opacity: 1, transform: 'translate(-50%,0)', offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1800 }).onfinish = () => { toast.hidden = true; };
      video.currentTime = Math.min(video.duration || at, at);
      video.play().catch(() => {});
    });
  }
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (signedIn()) return restore();
    btn.textContent = T.wait; btn.disabled = true;
    const ok = await Promise.resolve(signIn()).catch(() => false);
    btn.textContent = T.btn; btn.disabled = false;
    if (ok || signedIn()) restore();
  });
  root.addEventListener('click', (e) => { if (state === 'lost') e.stopPropagation(); });   // (the card is the page now - a tap doesn't play under it)

  // "seen it on the socials? jump to where it dropped" - a few seconds before, so the drop comes again
  jump.addEventListener('click', (e) => { e.stopPropagation(); jump.hidden = true; video.currentTime = Math.max(0, at - 3.5); video.play().catch(() => {}); });
  const jumpShow = () => { if (state === 'play' && !signedIn() && video.currentTime < at - 8) { jump.hidden = false; clearTimeout(jumpShow.t); jumpShow.t = setTimeout(() => { jump.hidden = true; }, 9000); } };

  // the clock: every frame while it plays
  const tick = () => {
    raf = 0;
    if (gone) return;
    const t = video.currentTime;
    if (signedIn()) { if (state === 'lost') restore(); if (inGlitch >= 0) { cv.style.opacity = '0'; video.muted = wasMuted; inGlitch = -1; } }
    else if (state === 'play') {
      if (t >= at - 1 / FPS / 2) { cv.style.opacity = '0'; if (inGlitch >= 0) video.muted = wasMuted; inGlitch = -1; lose(); }
      else {
        const gi = glitches.findIndex(([s, e]) => t >= s && t < e);
        if (gi >= 0) {
          if (inGlitch !== gi) { if (inGlitch < 0) wasMuted = video.muted; inGlitch = gi; video.muted = true; sfx(gi === 0 ? 'glitch1' : 'glitch2', gi === 0 ? 0 : 0.16, glitches[gi][1] - glitches[gi][0], gi === 0 ? 0.9 : 1); }
          const gp = glitchPlan(Math.round(t * FPS), glitches[gi][2], cv.width, cv.height);
          if (gp) { drawGlitch(gp); cv.style.opacity = '1'; } else cv.style.opacity = '0';
        } else if (inGlitch >= 0) { cv.style.opacity = '0'; video.muted = wasMuted; inGlitch = -1; }
      }
    }
    if (!jump.hidden && (state !== 'play' || t > at - 8)) jump.hidden = true;   // (only early in the video, never over the box)
    if (!video.paused) raf = requestAnimationFrame(tick);
  };
  const run = () => { if (!raf) raf = requestAnimationFrame(tick); };
  const onPlay = () => { if (state === 'lost' && !signedIn()) { video.pause(); return; } run(); jumpShow(); };
  const onSeeked = () => { if (!signedIn() && state === 'play' && video.currentTime >= at - 1 / FPS / 2) lose(); };
  video.addEventListener('play', onPlay); video.addEventListener('seeked', onSeeked); video.addEventListener('timeupdate', run);
  if (!video.paused) onPlay();
  else if (!signedIn() && video.currentTime >= at - 0.05) lose();

  return {
    check() { if (signedIn() && state === 'lost') restore(); else if (!signedIn() && video.currentTime >= at - 0.05 && state === 'play') lose(); },
    destroy() { gone = true; cancelAnimationFrame(raf); ro.disconnect(); root.remove(); hiss?.s.stop(); ['pointerdown', 'keydown', 'touchend'].forEach((e) => document.removeEventListener(e, unlock, { capture: true }));
      video.removeEventListener('play', onPlay); video.removeEventListener('seeked', onSeeked); video.removeEventListener('timeupdate', run); video.removeEventListener('play', unlock); },
    get state() { return state; },
  };
}
