// The one-camera engine's two entrances, as an item's `anim` keyframes (layers.md "Animation") - not text styles:
//  - "Pops in": springs past its size and settles in 0.35 s, shrinks away in its last 0.2 s (editor.tsx popScale,
//    lesson.py pop_expr) -> `anim.scale`, sampled every 1/60 s (linear between samples = the curve at every frame).
//  - "Blinks": on for 72% of each second from the item's start (editor.tsx blinkOn) -> `anim.opacity` steps.
// Both depend on the item's length (dur, seconds): when the length changes, write them again.

const r4 = (v) => Math.round(v * 10000) / 10000;
const clamp = (k) => Math.max(0, Math.min(1, k));

/** The old pop's scale at t (seconds since the start) of an item `dur` seconds long. */
export function popScaleAt(t, dur) {
  const p = clamp(t / 0.35), q = dur == null ? 1 : clamp((dur - t) / 0.2);
  return (0.3 + 0.7 * (1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2)) * (0.3 + 0.7 * q);
}

/** {scale: [[t, v], ...]} - the pop as keyframes. */
export function popAnim(dur, step = 1 / 60) {
  const ts = new Set();
  for (let t = 0; t <= Math.min(0.35, dur) + 1e-9; t += step) ts.add(r4(t));
  ts.add(r4(Math.min(0.35, dur)));
  for (let k = 0; k * step <= 0.2 + 1e-9; k++) { const t = dur - k * step; if (t >= 0) ts.add(r4(t)); }
  ts.add(r4(Math.max(0, dur - 0.2)));
  return { scale: [...ts].sort((a, b) => a - b).map((t) => [t, r4(popScaleAt(t, dur))]) };
}

/** {opacity: [[t, v], ...]} - on for the first 72% of every second, off for the rest. */
export function blinkAnim(dur) {
  const keys = [];
  for (let k = 0; k < Math.ceil(dur); k++) keys.push([k, 1], [r4(k + 0.7199), 1], [r4(k + 0.72), 0], [r4(k + 0.9999), 0]);
  keys.push([Math.ceil(dur), 1]);
  return { opacity: keys };
}

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
export const hasPop = (anim, dur) => !!anim?.scale && same(anim.scale, popAnim(dur).scale);
export const hasBlink = (anim, dur) => !!anim?.opacity && same(anim.opacity, blinkAnim(dur).opacity);

/** anim with some keys replaced (null removes one); null when nothing is left. */
export function mergeAnim(anim, patch) {
  const out = { ...(anim || {}) };
  for (const [k, v] of Object.entries(patch)) { if (v == null) delete out[k]; else out[k] = v; }
  return Object.keys(out).length ? out : null;
}
