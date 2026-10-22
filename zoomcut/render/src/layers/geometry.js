// Where things sit on the canvas - ONE set of functions for the editor (Remotion) and the export (ffmpeg).
// pipeline/layer_geometry.py is the same math in Python; tools/geometry_parity.mjs checks the two agree.
// Every box is {x, y, w, h} in canvas pixels, top-left.

/**
 * Where a video sits inside its item box: the item box is a window, the video is placed behind it and the window
 * shows part of it. Returns {left, top, width, height} relative to the box.
 *   fit "cover" - fills the window, centred, then nudged by x / y (fractions of the window) and zoom (>= 1)
 *   fit "face"  - fills the window and puts the head near the top: the asset's framing (cx, top) from the cut-out,
 *                 `head` = where the top of the head lands (fraction of the window height, default 0.09)
 *   fit "contain" - the whole video inside the window (letterboxed), x / y / zoom as for cover
 * The video never leaves an empty edge in cover / face (clamped).
 */
export function fitBox(asset, box, p = {}) {
  const fit = p.fit || 'cover';
  const zoom = Math.max(fit === 'contain' ? 0.1 : 1, p.zoom ?? 1);
  const base = fit === 'contain' ? Math.min(box.w / asset.w, box.h / asset.h) : Math.max(box.w / asset.w, box.h / asset.h);
  const s = base * zoom;
  const vw = asset.w * s, vh = asset.h * s;
  let left, top;
  if (fit === 'face') {
    const fr = asset.framing || {};
    const fx = fr.cx ?? 0.5;
    const headTop = fr.top ?? Math.max(0, (fr.cy ?? 0.4) - (fr.fh ?? 0.3) * 0.7);
    left = box.w / 2 - fx * vw + (p.x ?? 0) * box.w;
    top = box.h * ((p.head ?? 0.09) + (p.y ?? 0)) - headTop * vh;
  } else {
    left = (box.w - vw) / 2 + (p.x ?? 0) * box.w;
    top = (box.h - vh) / 2 + (p.y ?? 0) * box.h;
  }
  if (fit !== 'contain') {
    left = Math.min(0, Math.max(box.w - vw, left));
    top = Math.min(0, Math.max(box.h - vh, top));
  }
  return { left, top, width: vw, height: vh };
}

/**
 * Where a backdrop photo sits behind a cut-out video: inside the video's own box (vw x vh, from fitBox), cover,
 * pan x / y (-0.5..0.5) and zoom. zoom < 1 = a smaller room, but never below covering `view` - the part of the video
 * box the window shows ({x0, y0, w, h}) - so there is never an empty edge.
 */
export function backdropBox(img, vw, vh, p = {}, view) {
  let s = Math.max(vw / img.w, vh / img.h) * Math.max(0.3, p.zoom ?? 1);
  if (view) s = Math.max(s, view.w / img.w, view.h / img.h);
  const sw = img.w * s, sh = img.h * s;
  let left = (vw - sw) * (0.5 + (p.x ?? 0)), top = (vh - sh) * (0.5 + (p.y ?? 0));
  if (view) {
    left = Math.min(view.x0, Math.max(view.x0 + view.w - sw, left));
    top = Math.min(view.y0, Math.max(view.y0 + view.h - sh, top));
  }
  return { left, top, width: sw, height: sh };
}

/**
 * An image item's box: w given, h from the picture's proportions when missing. anchor "c" = x / y are its centre.
 */
export function imageBox(asset, box) {
  const w = box.w ?? asset.w ?? 0;
  const h = box.h ?? (asset.w ? (w * asset.h) / asset.w : 0);
  const c = box.anchor === 'c';
  return { x: c ? box.x - w / 2 : box.x ?? 0, y: c ? box.y - h / 2 : box.y ?? 0, w, h };
}

/** Keyframes [[t seconds from the item's start, value], ...] -> the value at t (linear, held at the ends). */
export function keyAt(keys, t, d = 1) {
  if (!keys || !keys.length) return d;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return keys[keys.length - 1][1];
}

/** An item's opacity at frame f: its own opacity x fade in / out (seconds) x its "opacity" keyframes. */
export function itemOpacity(it, props, f, fps) {
  const t = (f - it.from) / fps, d = it.dur / fps;
  let o = it.opacity ?? props.opacity ?? 1;
  const fi = it.fade_in ?? props.fade_in ?? 0, fo = it.fade_out ?? props.fade_out ?? 0;
  if (fi > 0) o *= Math.min(1, Math.max(0, t / fi));
  if (fo > 0) o *= Math.min(1, Math.max(0, (d - t) / fo));
  if (it.anim?.opacity) o *= keyAt(it.anim.opacity, t);
  return o;
}
