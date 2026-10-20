// Movie-style thought text: the words drift in one by one (blur to sharp, a little scale and tilt), some big and some
// small, the line floats slowly up, then everything blurs and drifts away. One motion for both sides: the editor plays
// it live (ThoughtText in editor.tsx) and the export renders it frame by frame (tools/thought_frames.mjs).
const BIG = ['וואט', 'רגע', 'אמאלה', 'מה', 'וואו', 'אוי'];
const rnd = (seed) => { const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const clamp = (k) => Math.max(0, Math.min(1, k));
const ease = (k) => 1 - Math.pow(1 - k, 3);

export const THOUGHT_STYLE = {
  color: '#ffffff', fontWeight: 800, lineHeight: 1.15,
  textShadow: '0 4px 22px rgba(0,0,0,0.7), 0 0 3px rgba(0,0,0,0.65)',
};

/** The words of a thought with their own size, tilt and offset (always the same for the same text). */
export function thoughtWords(text, base = 70) {
  const words = String(text).split(/\s+/).filter(Boolean);
  return words.map((w, i) => {
    const bare = w.replace(/[.,?!…:"׳״-]/g, '');
    let s = 0.68 + rnd(i + words.length * 3.1) * 0.26;  // most words small, the exclamations big
    if (BIG.includes(bare)) s = 1.6;
    else if (/[?!]$/.test(w)) s = 1.12;
    return { w, size: Math.round(base * s), rot: (rnd(i * 7.3 + 1) - 0.5) * 7, dy: Math.round((rnd(i * 3.7 + 2) - 0.5) * 22) };
  });
}

/** One word at time t (seconds of the video) of a thought shown from start to end.
 *  motion "horror": the words slam in as he says them (a flicker, a scale-down, sharp), shiver while held, a glitch
 *  frame now and then, and dissolve into the dark at the end. */
export function wordState(i, n, t, start, end, motion) {
  if (motion === 'horror') return horrorWord(i, n, t, start, end);
  const dur = Math.max(0.6, end - start);
  const spread = Math.min(0.55 * dur, 0.12 * n + 0.15);  // the words arrive over the first part of the thought
  const a = start + (n > 1 ? (i / (n - 1)) * spread : 0);
  const e = ease(clamp((t - a) / 0.34));
  const out = clamp((t - (end - 0.45)) / 0.45);
  const blur = (1 - e) * 9 + out * 7;
  return {
    opacity: e * (1 - out),
    transform: `translateY(${((1 - e) * 28 - out * 34).toFixed(1)}px) scale(${(0.72 + 0.28 * e + 0.08 * out).toFixed(3)})`,
    filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none',
  };
}

function horrorWord(i, n, t, start, end) {
  const dur = Math.max(0.6, end - start);
  const spread = Math.min(0.72 * dur, 0.35 * n);  // with his voice: the words arrive about as he says them
  const a = start + (n > 1 ? (i / (n - 1)) * spread : 0);
  const k = (t - a) / 0.16;
  if (k < 0) return { opacity: 0, transform: 'scale(1.35)', filter: 'blur(10px)' };
  const e = ease(clamp(k));
  const f = Math.floor(t * 30);
  const flick = k < 1.6 && (f % 3 === 1) ? 0.35 : 1;  // two frames of flicker as it lands
  const out = clamp((t - (end - 0.5)) / 0.5);
  const glitch = rnd(f * 0.37 + i * 5.1) > 0.975 ? 1 : 0;
  const jx = (rnd(Math.floor(t * 15) + i * 9.7) - 0.5) * 5 + glitch * 14, jy = (rnd(Math.floor(t * 15) * 1.3 + i * 4.1) - 0.5) * 4;
  const blur = (1 - e) * 10 + out * 9;
  return {
    opacity: e * flick * (1 - out) * (glitch ? 0.6 : 1),
    transform: `translate(${jx.toFixed(1)}px, ${(jy - out * 20).toFixed(1)}px) scale(${(1.35 - 0.35 * e + 0.1 * out).toFixed(3)})`,
    filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none',
  };
}

/** Each thought in its own spot (a little left / right, higher / lower), floating up while it is heard. */
export function lineDrift(t, start, text = '', motion) {
  const n = String(text).length;
  if (motion === 'horror') {  // closer to the middle, creeping toward us
    const dx = (rnd(n * 1.7 + 4) - 0.5) * 90, dy = (rnd(n * 2.3 + 9) - 0.5) * 110;
    return `translate(${dx.toFixed(1)}px, ${(dy - Math.max(0, t - start) * 5).toFixed(1)}px) scale(${(1 + Math.min(0.08, Math.max(0, t - start) * 0.016)).toFixed(4)})`;
  }
  const dx = (rnd(n * 1.7 + 4) - 0.5) * 170, dy = (rnd(n * 2.3 + 9) - 0.5) * 190;
  return `translate(${dx.toFixed(1)}px, ${(dy - Math.max(0, t - start) * 9).toFixed(1)}px)`;
}
