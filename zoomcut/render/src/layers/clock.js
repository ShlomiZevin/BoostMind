// A video layer in the editor, as parts of its assets - the pure logic behind VideoTrack (no DOM):
// which item shows at a frame, which COPY of its asset plays it, and where that copy's video should be.
// Two copies per asset: an item that continues the previous one of the same asset (no jump in the source) plays on
// in the same copy; one that jumps gets the other copy, which waits there already seeked - so a cut is seamless.

/**
 * The layer's items in order, each with its copy ("asset:variant#slot"). variant = which file of the asset plays it.
 * @param {any[]} items @param {number} fps @param {(it: any) => string} [variantOf]
 */
export function partsOf(items, fps, variantOf = (it) => 'preview') {
  const list = (items || []).filter((i) => !i.hidden && i.dur > 0).sort((a, b) => a.from - b.from);
  const last = {};  // "asset:variant" -> {slot, item}
  return list.map((it) => {
    const key = `${it.asset}:${variantOf(it)}`;
    const prev = last[key];
    let slot = 0;
    if (prev) slot = continues(prev.item, it, fps) ? prev.slot : 1 - prev.slot;
    last[key] = { slot, item: it };
    return { ...it, key, slot, copy: `${key}#${slot}` };
  });
}

/** Does `b` carry on from `a` in the source, with nothing cut out between them (same rate, back to back)? */
export function continues(a, b, fps) {
  return a.from + a.dur === b.from && (a.rate ?? 1) === (b.rate ?? 1)
    && Math.abs(srcAt(a, a.from + a.dur, fps) - (b.in ?? 0)) < 1.5 / fps;
}

/** Seconds into the asset that part `p` shows at frame f. */
export function srcAt(p, f, fps) {
  return (p.in ?? 0) + ((f - p.from) / fps) * (p.rate ?? 1);
}

/** The part on screen at frame f (the last one when items overlap), or -1. */
export function activeAt(parts, f) {
  for (let i = parts.length - 1; i >= 0; i--) if (f >= parts[i].from && f < parts[i].from + parts[i].dur) return i;
  return -1;
}

/** Every part on screen at frame f, by copy (items may overlap - a dissolve; the later one wins a shared copy). */
export function activeParts(parts, f) {
  const out = {};
  for (const p of parts) if (f >= p.from && f < p.from + p.dur) out[p.copy] = p;
  return out;
}

/** Each copy's next use after frame f (where it should wait, seeked), as {copy: part}. */
export function nextUses(parts, f) {
  const out = {};
  for (const p of parts) if (p.from > f && !out[p.copy]) out[p.copy] = p;
  return out;
}

/** Every copy the layer uses, with the asset key ("asset:variant") it plays. */
export function copiesOf(parts) {
  const out = {};
  for (const p of parts) out[p.copy] = p.key;
  return out;
}
