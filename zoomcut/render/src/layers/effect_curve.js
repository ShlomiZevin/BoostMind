// Film effects of a layered project (the `effect` kind) - the pure part, shared by the editor (effects.tsx) and the
// export (tools/effects_curve.mjs -> pipeline/film_fx.py). One effect layer = one filter (props.filter), its items =
// when it plays (fades in / out at the item's ends). Together they act like ONE adjustment layer: everything drawn
// below the top-most effect layer is moved and coloured; the layers above it (texts, subtitles) never move.
// The camera / light math is render/ui/fx.js - the same code the one-camera videos used.
import { fxAt } from '../../ui/fx.js';

/** The filters: label, default strength, what the strength means. */
export const FILTERS = {
  grade: { label: 'Movie colour', def: 0.4 },
  dark: { label: 'Darken', def: 0.35 },
  vignette: { label: 'Vignette', def: 0.3 },
  grain: { label: 'Film grain', def: 0.12 },
  zoom: { label: 'Slow zoom in', def: 0.35 },
  drift: { label: 'Handheld', def: 0.2 },
  ghost: { label: 'Ghost trail', def: 0.35 },
  flicker: { label: 'Light flicker', def: 0.3 },
  hits: { label: 'Hits', def: 1 },         // items = impacts: kick (zoom punch), shake, flash
  black: { label: 'Black', def: 1 },       // items = cut to black
};

const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

/** How much of an item is on at frame f: faded in over fade_in (default 1.5 s), out over fade_out (default 0.6 s). */
export function envelope(it, f, fps) {
  if (f < it.from || f >= it.from + it.dur) return 0;
  const t = (f - it.from) / fps, d = it.dur / fps;
  const fi = it.fade_in ?? 1.5, fo = it.fade_out ?? 0.6;
  return Math.max(0, Math.min(fi > 0 ? ease(t / fi) : 1, fo > 0 ? ease((d - t) / fo) : 1));
}

export const effectLayers = (project) => (project.layers || []).filter((l) => l.kind === 'effect' && !l.hidden);
/** Index (in project.layers) of the top-most effect layer, or -1: everything below it is filtered. */
export const topEffect = (project) => { let k = -1; (project.layers || []).forEach((l, i) => { if (l.kind === 'effect' && !l.hidden) k = i; }); return k; };

/** The fx.js settings at frame f, made from the effect layers. */
export function fxOf(project, f) {
  const fps = project.canvas.fps;
  const fx = { hits: [], black: [], center: [0.5, 0.36] };
  let zoomFrom = -1;
  for (const l of effectLayers(project)) {
    const pr = l.props || {}, kind = pr.filter;
    if (pr.center) fx.center = pr.center;
    if (kind === 'ghost' && pr.ghost_lag) fx.ghost_lag = pr.ghost_lag;
    for (const it of l.items || []) {
      if (it.hidden) continue;
      const amount = it.amount ?? pr.amount ?? FILTERS[kind]?.def ?? 0;
      if (kind === 'hits') { fx.hits.push({ at: it.from / fps, kick: it.kick ?? pr.kick ?? 0.04, shake: it.shake ?? pr.shake ?? 0.3, flash: it.flash ?? pr.flash ?? 0, hold: it.hold ?? pr.hold }); continue; }
      if (kind === 'black') { fx.black.push([it.from / fps, (it.from + it.dur) / fps]); continue; }
      if (kind === 'zoom') {  // the slow zoom moves over its item and holds there (as before); the latest one started rules
        if (f >= it.from && it.from > zoomFrom) { zoomFrom = it.from; fx.zoom = amount; fx.times = { zoom: [it.from / fps, (it.from + it.dur) / fps] }; }
        continue;
      }
      const a = amount * envelope(it, f, fps);
      if (a <= 0) continue;
      if (kind === 'grade') {
        const g = Math.max(fx._grade || 0, a);
        fx._grade = g;
        fx.grade = { saturation: 1 - 0.35 * g, contrast: 1 + 0.15 * g, brightness: -0.06 * g };
      } else if (FILTERS[kind]) fx[kind] = Math.max(fx[kind] || 0, a);
    }
  }
  return fx;
}

/** The camera and the light at frame f: {z, dx, dy, rot, flash, light, black, vig, grain, ghost, sat, con, bri}. */
export const effectAt = (project, f) => fxAt(fxOf(project, f), f / project.canvas.fps);

/** The look at frame f as CSS for the picture below the effects (transform around the centre + filter). */
export function effectCss(project, f) {
  const s = effectAt(project, f), fx = fxOf(project, f);
  const W = project.canvas.w, H = project.canvas.h, k = W / 1080;  // (fx.js moves in 1080-wide pixels)
  const [cx, cy] = fx.center;
  return { s, lag: Math.max(1, Math.round((fx.ghost_lag ?? 0.2) * project.canvas.fps)),
    transformOrigin: `${(cx * W).toFixed(1)}px ${(cy * H).toFixed(1)}px`,
    transform: `translate(${(s.dx * k).toFixed(2)}px, ${(s.dy * k).toFixed(2)}px) rotate(${s.rot.toFixed(3)}deg) scale(${s.z.toFixed(4)})`,
    filter: `saturate(${s.sat.toFixed(3)}) contrast(${s.con.toFixed(3)}) brightness(${((1 + s.bri) * s.light).toFixed(3)})` };
}

/** Per-frame curve for the export, frames [f0, f1). */
export function effectCurve(project, f0, f1) {
  const out = [];
  for (let f = f0; f < f1; f++) out.push(effectAt(project, f));
  return out;
}
