// A dialogue project (skill/edit-video/layers.md -> "Dialogue"): a group of rows per character - its video row (the
// clips), its background row (a picture or a video under the clips; each background item linked to its clip), its voice,
// any picture or text of its own - and the "What we see" strip (a `view` layer: items {from, dur, show: <video layer
// id>}) that says whose rows are on screen when. Everything is a real layer he sees and changes; flatten() only cuts
// each character's drawn rows to where the strip shows that character, so the editor (render/src/Layers.tsx), its
// stills and the export (pipeline/export_layers.py, through tools/flatten_view.mjs) draw the very same frames. Pure,
// cheap (it runs on every change while he drags), and a project without a strip comes back as it is.

const ROWS_OK = new Set(['audio', 'view']);  // (layers that may sit between the character rows - nothing drawn)

/** The strip's items in time order (the first visible view layer), [] when there is none. */
export function stripOf(p) {
  const v = (p.layers || []).find((l) => l.kind === 'view' && !l.hidden);
  return v ? (v.items || []).filter((i) => !i.hidden && i.dur > 0).sort((a, b) => a.from - b.from) : [];
}

/** The frames where the video row `id` may be drawn: where the strip shows it, and where the strip says nothing
 *  (there every row draws as it always did). [[from, to], ...] */
export function shownSpans(strip, id) {
  const out = [];
  let t = 0;
  const add = (a, b) => { if (b <= a) return; const l = out[out.length - 1]; if (l && l[1] >= a) l[1] = Math.max(l[1], b); else out.push([a, b]); };
  for (const s of strip) {
    add(t, s.from);
    if (s.show === id) add(s.from, s.from + s.dur);
    t = Math.max(t, s.from + s.dur);
  }
  add(t, Infinity);
  return out;
}

/** Is row `id` on screen at frame f (by the strip)? */
export const shownAt = (strip, id, f) => shownSpans(strip, id).some(([a, b]) => f >= a && f < b);

// an item cut to the spans: each piece keeps its place in the take (`in` moves with its start); a fade stays only on
// the item's own ends. One piece covering it all keeps its id; pieces are "<id>~<k>"
function clip(it, spans, fps) {
  const a0 = it.from, z0 = it.from + it.dur, out = [];
  for (const [a, b] of spans) {
    const s = Math.max(a, a0), e = Math.min(b, z0);
    if (e - s < 0.5) continue;
    const pc = { ...it, from: s, dur: e - s };
    if (it.in != null && s > a0) pc.in = +(it.in + ((s - a0) / fps) * (it.rate ?? 1)).toFixed(4);
    if (s > a0) delete pc.fade_in;
    if (e < z0) delete pc.fade_out;
    out.push(pc);
  }
  if (out.length === 1 && out[0].from === a0 && out[0].dur === it.dur) return [{ ...it }];
  return out.map((pc, k) => ({ ...pc, id: `${it.id}~${k}` }));
}

// where the strip shows a row that has no clip (a cut moved past the clip's handles): that row's nearest frame held
// (rate 0 - the clip before ends -> its last frame, else the clip after -> its first), never a black hole in the
// picture; the strip marks the stretch hatched so he sees it is frozen. A held frame keeps its clip's `link`, so the
// clip's background (and anything else linked to it in the character's group) is held with it - memberHolds().
function holds(strip, l, items, fps) {
  const own = (l.items || []).filter((i) => !i.hidden && i.dur > 0);
  if (!own.length) return [];
  const out = [];
  for (const s of strip) {
    if (s.show !== l.id) continue;
    const cover = items.filter((i) => !i.hidden && i.from < s.from + s.dur && i.from + i.dur > s.from).map((i) => [i.from, i.from + i.dur]).sort((a, b) => a[0] - b[0]);
    const gaps = [];
    let t = s.from;
    for (const [a, b] of cover) { if (a > t + 0.5) gaps.push([t, a]); t = Math.max(t, b); }
    if (s.from + s.dur > t + 0.5) gaps.push([t, s.from + s.dur]);
    for (const [a, b] of gaps) {
      const before = own.filter((i) => i.from + i.dur <= a + 0.5).sort((x, y) => y.from + y.dur - (x.from + x.dur))[0];
      const after = own.filter((i) => i.from >= b - 0.5).sort((x, y) => x.from - y.from)[0];
      const src = before && (!after || a - (before.from + before.dur) <= after.from - b) ? before : after;
      if (!src || src.in == null) continue;
      out.push(held(src, a, b, src === before, fps, `${src.id}~h${out.length}`));
    }
  }
  return out;
}

// an item frozen over [a, b): a video at its last (end) or first frame, a picture / text as it is
function held(src, a, b, end, fps, id) {
  const { fade_in, fade_out, ...rest } = src;
  const o = { ...rest, id, from: a, dur: b - a };
  if (src.in != null) Object.assign(o, { in: +Math.max(0, end ? src.in + (src.dur / fps) * (src.rate ?? 1) - 1 / fps : src.in).toFixed(4), rate: 0 });
  return o;
}

// a row's held frames -> the same stretch for its linked items in another row of the character's group (its background)
function memberHolds(rowHolds, l, items, fps) {
  const out = [];
  for (const h of rowHolds) {
    if (!h.link || items.some((i) => !i.hidden && i.from < h.from + h.dur && i.from + i.dur > h.from)) continue;
    const src = (l.items || []).filter((i) => !i.hidden && i.dur > 0 && i.link === h.link).sort((x, y) => x.from - y.from);
    if (!src.length) continue;
    const end = src[0].from < h.from, s = end ? src[src.length - 1] : src[0];
    out.push(held(s, h.from, h.from + h.dur, end, fps, `${s.id}~h${out.length}`));
  }
  return out;
}

const NOT_OWN = new Set(['audio', 'view', 'effect', 'subtitles']);  // (rows in a character's group that are not drawn as theirs)

export function flatten(p) {
  const layers = p?.layers || [];
  if (!layers.some((l) => l.kind === 'view')) return p;
  const fps = p.canvas?.fps || 30;
  const strip = stripOf(p);
  const governed = new Set(strip.map((s) => s.show));
  // whose each drawn row is: a character's video row (named on the strip), and every drawn row in its group
  const rowOf = new Map();
  for (const l of layers) if (l.kind === 'video' && governed.has(l.id)) rowOf.set(l.id, l);
  for (const l of layers) {
    if (rowOf.has(l.id) || !l.group || NOT_OWN.has(l.kind)) continue;
    const r = layers.find((x) => x.kind === 'video' && governed.has(x.id) && x.group === l.group);
    if (r) rowOf.set(l.id, r);
  }
  // each cut to where the strip shows its character; the video row's held frames hold its linked rows too
  const cut = new Map(), rowHolds = new Map();
  for (const l of layers) {
    if (rowOf.get(l.id)?.id !== l.id) continue;
    const items = (l.items || []).flatMap((it) => clip(it, shownSpans(strip, l.id), fps));
    const h = holds(strip, l, items, fps);
    rowHolds.set(l.id, h);
    cut.set(l.id, { ...l, items: [...items, ...h] });
  }
  for (const l of layers) {
    const r = rowOf.get(l.id);
    if (!r || r.id === l.id) continue;
    const items = (l.items || []).flatMap((it) => clip(it, shownSpans(strip, r.id), fps));
    cut.set(l.id, { ...l, items: [...items, ...memberHolds(rowHolds.get(r.id) || [], l, items, fps)] });
  }
  // the characters' rows next to each other with nothing else drawn between them (the strip shows one at a time):
  // everyone's rows above their clips, then the clips, then everyone's rows under them (the backgrounds) - few runs for
  // the export, as a project without characters. Otherwise each row stays where it is.
  const ids = layers.map((l) => l.id);
  const mine = layers.filter((l) => rowOf.has(l.id));
  const i0 = mine.length ? ids.indexOf(mine[0].id) : -1, i1 = mine.length ? ids.indexOf(mine[mine.length - 1].id) : -1;
  const together = governed.size > 1 && layers.slice(i0, i1 + 1).every((l) => rowOf.has(l.id) || ROWS_OK.has(l.kind));
  // (layers are bottom first: under the clips = before its video row)
  const side = (x) => { const r = rowOf.get(x.id); return r.id === x.id ? 1 : ids.indexOf(x.id) < ids.indexOf(r.id) ? 0 : 2; };
  const out = [];
  for (const [i, l] of layers.entries()) {
    if (l.kind === 'view') continue;
    if (together && i >= i0 && i <= i1) {
      if (i === i0) for (const k of [0, 1, 2]) for (const x of mine) if (side(x) === k) out.push(cut.get(x.id));
      if (!rowOf.has(l.id)) out.push(l);  // (a voice row between them stays where it was)
      continue;
    }
    out.push(cut.get(l.id) || l);
  }
  return { ...p, layers: out };
}

/** A flattened item id back to the item it came from ("p12~1" -> "p12", a held frame "p12~h0" -> "p12"). */
export const sourceId = (id) => String(id).replace(/~h?\d+$/, '');
