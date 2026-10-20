// Camera & film effects for a scene (episode.json "fx") - one source of truth: the editor applies them live (CSS on
// the picture: set + person), the export reads the same per-frame curve (tools/fx_curve.mjs) and applies it with
// OpenCV (lesson.py fx_pass). Text layers (hook, thoughts, subtitles) sit above and never move.
//
// fx: {
//   every filter is a layer: its strength, and when it plays - times: {<id>: [start, end | null]}, fade: seconds in / out
//   grade_amount + grade: {saturation, contrast, brightness}   movie colour (CSS filter order: saturate, contrast, brightness)
//   ghost: 0..1 (a faded copy of the picture ghost_lag seconds behind: movement leaves a trail), ghost_lag: 0.2
//   dark: 0..1 (the light goes down), vignette: 0..1, grain: 0..1, drift: 0..1 (handheld), flicker: 0..1 (a fluorescent light dipping)
//   zoom: 0..1 + times.zoom   a slow zoom in over the layer's time (or the older push: [[t0, t1, z0, z1], ...])
//   center:   [0.5, 0.36]     the point it zooms into (fractions of the frame - usually the face)
//   hits:     [{at, kick, shake, flash}] impacts ({sound: i, offset} = with that sound; the build writes "at" back)
//   black:    [[t0, t1], ...]  cut to black
// }
const rnd = (seed) => { const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
export const FILTER_IDS = ['grade', 'dark', 'vignette', 'grain', 'zoom', 'drift', 'flicker', 'ghost'];

/** How much of a filter layer is on at time t (0..1): faded in at its start, out at its end. No times = always on. */
export function layerAmount(fx, id, t) {
  const r = fx?.times?.[id];
  if (!r) return 1;
  const fade = Math.max(0.01, fx.fade ?? 1.5);
  const [s, e] = r;
  const inn = ease((t - s) / fade);
  const out = e == null ? 1 : ease((e - t) / Math.min(fade, 0.6));
  return Math.max(0, Math.min(inn, out));
}

/** The camera and the light at time t (seconds of the video). */
export function fxAt(fx, t) {
  fx = fx || {};
  const A = {};
  for (const id of FILTER_IDS) A[id] = layerAmount(fx, id, t);
  let z = 1, dx = 0, dy = 0, rot = 0, flash = 0, light = 1, black = 0;
  if (fx.zoom && fx.times?.zoom) {  // the zoom layer: from 1 to 1 + 0.25 x strength over its own time
    const [s, e] = fx.times.zoom, end = e ?? (fx.end || s + 30);
    z = 1 + 0.25 * fx.zoom * ease((t - s) / Math.max(0.5, end - s));
  } else {
    for (const [t0, t1, z0, z1] of fx.push || []) if (t >= t0) z = z0 + (z1 - z0) * ease((t - t0) / Math.max(0.01, t1 - t0));
  }
  const dr = (fx.drift || 0) * A.drift;
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
  const fl = (fx.flicker || 0) * A.flicker;
  if (fl) {
    const k = Math.floor(t * 15);  // the tube: mostly steady, a dip now and then, sometimes two in a row
    const dip = rnd(k * 1.31 + 5) > 0.9 ? 0.55 + 0.45 * rnd(k * 2.1) : rnd(Math.floor(t * 2) * 4.7) > 0.93 && rnd(k * 0.7) > 0.5 ? 0.7 : 1;
    light = 1 - fl * (1 - dip) * 0.45 - fl * 0.015 * Math.sin(t * 2 * Math.PI * 7.3);
  }
  for (const [t0, t1] of fx.black || []) if (t >= t0 && t < t1) black = 1;
  const g = fx.grade || {}, ga = A.grade;  // the grade, as much of it as its layer is on
  return { z, dx, dy, rot, flash, light, black, vig: (fx.vignette || 0) * A.vignette, grain: (fx.grain || 0) * A.grain, ghost: (fx.ghost || 0) * A.ghost,
    sat: 1 + ((g.saturation ?? 1) - 1) * ga, con: 1 + ((g.contrast ?? 1) - 1) * ga, bri: (g.brightness ?? 0) * ga - 0.5 * (fx.dark || 0) * A.dark };
}

/** Per-frame values for the export: [{z, dx, dy, rot, flash, light, black, vig, grain, sat, con, bri}, ...] */
export function fxCurve(fx, frames, fps = 30) {
  const out = [];
  for (let f = 0; f < frames; f++) out.push(fxAt(fx, f / fps));
  return out;
}

/** The picture's CSS (editor): transform around the centre + the grade and the light as a filter. */
export function fxCss(fx, t, W = 1080, H = 1920) {
  const s = fxAt(fx, t);
  const [cx, cy] = (fx && fx.center) || [0.5, 0.36];
  return {
    transformOrigin: `${(cx * W).toFixed(1)}px ${(cy * H).toFixed(1)}px`,
    transform: `translate(${s.dx.toFixed(2)}px, ${s.dy.toFixed(2)}px) rotate(${s.rot.toFixed(3)}deg) scale(${s.z.toFixed(4)})`,
    filter: `saturate(${s.sat.toFixed(3)}) contrast(${s.con.toFixed(3)}) brightness(${((1 + s.bri) * s.light).toFixed(3)})`,
    flash: s.flash, black: s.black, vig: s.vig, grain: s.grain,
  };
}
