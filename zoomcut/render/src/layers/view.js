// A dialogue project (skill/edit-video/layers.md -> "Dialogue"): one video row per character, each clip carrying its
// own background (item `bg`), and the "What we see" strip (a `view` layer: items {from, dur, show: <video layer id>})
// that says whose row is on screen when. flatten() turns that into the plain layers every drawing already knows - the
// clips cut to where the strip shows their row, each clip's background as a picture right under it - so the editor
// (render/src/Layers.tsx), its stills and the export (pipeline/export_layers.py, through tools/flatten_view.mjs) draw
// the very same frames. Pure, cheap (it runs on every change while he drags), and a project without a strip or a clip
// background comes back as it is.

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

// a clip's background -> a picture item (canvas pixels, like any picture; no box = covers the frame)
function bgItem(p, l, it) {
  const bg = { ...(l.props?.bg || {}), ...(it.bg || {}) };
  const a = bg.asset && p.assets?.[bg.asset];
  if (!a) return null;
  let box = bg.box;
  if (!box) {
    const { w: W, h: H } = p.canvas, s = Math.max(W / (a.w || W), H / (a.h || H));
    box = { x: (W - a.w * s) / 2, y: (H - a.h * s) / 2, w: a.w * s, h: a.h * s };
  }
  const o = { id: it.id, from: it.from, dur: it.dur, asset: bg.asset, box };
  for (const k of ['blur', 'brightness', 'saturate']) if (bg[k] != null) o[k] = bg[k];
  for (const k of ['opacity', 'fade_in', 'fade_out', 'hidden']) if (it[k] != null) o[k] = it[k];
  return o;
}

export function flatten(p) {
  const layers = p?.layers || [];
  const hasView = layers.some((l) => l.kind === 'view');
  const hasBg = layers.some((l) => l.kind === 'video' && (l.props?.bg || (l.items || []).some((i) => i.bg)));
  if (!hasView && !hasBg) return p;
  const fps = p.canvas?.fps || 30;
  const strip = stripOf(p);
  const governed = new Set(strip.map((s) => s.show));
  // each video row: its items cut to the strip, and its clips' backgrounds
  const rows = new Map();
  for (const l of layers) {
    if (l.kind !== 'video') continue;
    const spans = governed.has(l.id) ? shownSpans(strip, l.id) : null;
    const items = spans ? (l.items || []).flatMap((it) => clip(it, spans, fps)) : (l.items || []);
    const bgs = items.map((it) => bgItem(p, l, it)).filter(Boolean);
    const props = { ...(l.props || {}) };
    delete props.bg;
    rows.set(l.id, { layer: { ...l, props, items: items.map(({ bg, ...it }) => it) }, bgs });
  }
  const bgLayer = (id, name, items, hidden) => ({ id, kind: 'image', name, hidden: !!hidden, nopick: true, props: {}, items });
  // the character rows next to each other with nothing drawn between them (the strip shows one at a time): their
  // backgrounds go in ONE picture layer under them, the rows right above it - one picture run + one video run for the
  // export, as a project without rows. Otherwise each row gets its own background layer right under it.
  const ids = layers.map((l) => l.id);
  const gov = layers.filter((l) => l.kind === 'video' && governed.has(l.id));
  const i0 = gov.length ? ids.indexOf(gov[0].id) : -1, i1 = gov.length ? ids.indexOf(gov[gov.length - 1].id) : -1;
  const together = gov.length > 1 && layers.slice(i0, i1 + 1).every((l) => governed.has(l.id) || ROWS_OK.has(l.kind));
  const out = [];
  for (const [i, l] of layers.entries()) {
    if (l.kind === 'view') continue;
    if (together && i >= i0 && i <= i1) {
      if (i === i0) {
        const bgs = gov.flatMap((g) => (g.hidden ? [] : rows.get(g.id).bgs));
        if (bgs.length) out.push(bgLayer(`${gov[0].id}~bg`, 'Backgrounds', bgs, false));
        for (const g of gov) out.push(rows.get(g.id).layer);
      }
      if (l.kind !== 'video') out.push(l);  // (a voice row between them stays where it was)
      continue;
    }
    const r = rows.get(l.id);
    if (!r) { out.push(l); continue; }
    if (r.bgs.length) out.push(bgLayer(`${l.id}~bg`, `${l.name || l.id} - backgrounds`, r.bgs, l.hidden));
    out.push(r.layer);
  }
  return { ...p, layers: out };
}

/** A flattened item id back to the item it came from ("p12~1" -> "p12"). */
export const sourceId = (id) => String(id).replace(/~\d+$/, '');
