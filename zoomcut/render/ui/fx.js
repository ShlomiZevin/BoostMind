// Camera & film effects for a scene (episode.json "fx") - one source of truth: the editor applies them live (CSS on
// the picture: set + person), the export reads the same per-frame curve (tools/fx_curve.mjs) and applies it with
// OpenCV (lesson.py fx_pass). Text layers (hook, thoughts, subtitles) sit above and never move.
//
// fx: {
//   push:     [[t0, t1, z0, z1], ...]   slow zoom (eased), seconds of the video
//   center:   [0.5, 0.36]               the point it zooms into (fractions of the frame - usually the face)
//   drift:    0..1                      handheld breathing (a slow sway)
//   hits:     [{at, kick, shake, flash}] impacts: a zoom kick, a shake that dies away, a white flash
//             ({sound: i, offset} instead of "at" = with that sound; the build writes "at" back)
//   flicker:  0..1                      a fluorescent light that dips now and then
//   grade:    {saturation, contrast, brightness}   on the whole picture (CSS filter order: saturate, contrast, brightness)
//   vignette: 0..1, grain: 0..1
//   black:    [[t0, t1], ...]           cut to black
// }
const rnd = (seed) => { const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

/** The camera and the light at time t (seconds of the video). */
export function fxAt(fx, t) {
  fx = fx || {};
  let z = 1, dx = 0, dy = 0, rot = 0, flash = 0, light = 1, black = 0;
  for (const [t0, t1, z0, z1] of fx.push || []) {
    if (t >= t0) z = z0 + (z1 - z0) * ease((t - t0) / Math.max(0.01, t1 - t0));
  }
  const dr = fx.drift || 0;
  if (dr) {
    dx += dr * (5 * Math.sin(t * 0.61) + 3 * Math.sin(t * 1.37 + 1));
    dy += dr * (4 * Math.sin(t * 0.47 + 2) + 2.5 * Math.sin(t * 1.13));
    rot += dr * 0.35 * Math.sin(t * 0.39 + 0.5);
  }
  for (const h of fx.hits || []) {
    if (h.at == null || t < h.at - 0.04) continue;
    const u = t - h.at;
    if (h.kick) z += h.kick * Math.min(1, (u + 0.04) / 0.07) * Math.exp(-Math.max(0, u) / (h.hold || 0.45));
    if (h.shake && u >= 0 && u < 0.9) {
      const a = h.shake * 26 * Math.exp(-u / 0.2);
      const f = Math.floor(t * 30);  // a new position every frame - a real camera hit, not a wobble
      dx += a * (rnd(f * 1.7 + 3) - 0.5) * 2;
      dy += a * (rnd(f * 2.9 + 7) - 0.5) * 2;
      rot += h.shake * 1.2 * Math.exp(-u / 0.2) * (rnd(f * 3.3 + 1) - 0.5);
    }
    if (h.flash && u >= 0) flash = Math.max(flash, h.flash * Math.exp(-u / 0.09));
  }
  const fl = fx.flicker || 0;
  if (fl) {
    const k = Math.floor(t * 15);  // the tube: mostly steady, a dip now and then, sometimes two in a row
    const dip = rnd(k * 1.31 + 5) > 0.9 ? 0.55 + 0.45 * rnd(k * 2.1) : rnd(Math.floor(t * 2) * 4.7) > 0.93 && rnd(k * 0.7) > 0.5 ? 0.7 : 1;
    light = 1 - fl * (1 - dip) * 0.45 - fl * 0.015 * Math.sin(t * 2 * Math.PI * 7.3);
  }
  for (const [t0, t1] of fx.black || []) if (t >= t0 && t < t1) black = 1;
  return { z, dx, dy, rot, flash, light, black };
}

/** Per-frame values for the export: [{z, dx, dy, rot, flash, light, black}, ...] */
export function fxCurve(fx, frames, fps = 30) {
  const out = [];
  for (let f = 0; f < frames; f++) out.push(fxAt(fx, f / fps));
  return out;
}

/** The picture's CSS (editor): transform around the centre + the grade and the light as a filter. */
export function fxCss(fx, t, W = 1080, H = 1920) {
  const s = fxAt(fx, t);
  const [cx, cy] = (fx && fx.center) || [0.5, 0.36];
  const g = (fx && fx.grade) || {};
  return {
    transformOrigin: `${(cx * W).toFixed(1)}px ${(cy * H).toFixed(1)}px`,
    transform: `translate(${s.dx.toFixed(2)}px, ${s.dy.toFixed(2)}px) rotate(${s.rot.toFixed(3)}deg) scale(${s.z.toFixed(4)})`,
    filter: `saturate(${g.saturation ?? 1}) contrast(${g.contrast ?? 1}) brightness(${((1 + (g.brightness ?? 0)) * s.light).toFixed(3)})`,
    flash: s.flash, black: s.black,
  };
}
