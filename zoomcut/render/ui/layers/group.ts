// A group (his ask, 2026-11-10: "when I have a character and background and sound, they are all together ... I can cut
// all three layers ... if I stretch, I stretch all together"): every item that shares a `link` - a character's clip,
// its background, its voice, the line's subtitles - is edited as one. Moving any of them moves all; an edge moves the
// edges that reach it (shortening cuts whatever would play past it); S cuts them all at the playhead; Delete removes
// them all; Alt + drag / Alt + Delete = that piece alone. Subtitles never lead a group (a caption is its own,
// 2026-10-23), and a builder's take keeps its builder's edit (LayersEditor onItemEdit) - no group there.
// Pure helpers: the ops. Timeline.tsx / LayersEditor.tsx wire them to the mouse and the keys. Documented in
// skill/edit-video/layers.md -> "Groups".
import { tempoOf } from '../../src/layers/clock.js';

export type Member = { layer: any; it: any };

const LEADS = new Set(['video', 'image', 'audio', 'text']);  // (a text / sticker in a group leads it too; subtitles never)
export const isTakeItem = (l: any, it: any) => l.owner === 'builder' && !!it.ref && l.kind !== 'subtitles' && l.kind !== 'text'
  && (it.ref.take != null || it.ref.line != null);

/** The rest of an item's group: what shares its `link` on the OTHER rows (not the strip) - [] when it leads none. */
export function groupOf(p: any, l: any, it: any): Member[] {
  if (!it?.link || !LEADS.has(l.kind) || isTakeItem(l, it)) return [];
  const out: Member[] = [];
  for (const ly of p.layers || []) {
    if (ly.id === l.id || ly.kind === 'view') continue;
    for (const x of ly.items || []) if (x.link === it.link) out.push({ layer: ly, it: x });
  }
  return out.some((m) => isTakeItem(m.layer, m.it)) ? [] : out;  // (a builder's take in it: its builder edits it)
}

// seconds of the source per frame here (a held frame - rate 0 - stays on its frame)
const rateOf = (ly: any, x: any) => (x.rate ?? 1) * tempoOf(ly);

/** A group's edge moved: the dragged item's `side` edge moved by m frames (already within its own limits). Every member
 *  that reaches that edge (with it, or past it - a voice heard a moment before / after its picture) moves by m; one
 *  inside the clip is cut only when the new edge passes it; subtitles are never stretched. Each stops at its own
 *  footage's ends; one left with nothing goes. */
export function edgeOps(p: any, it: any, side: 'l' | 'r', m: number, members: Member[]) {
  const fps = p.canvas.fps, E0 = side === 'r' ? it.from + it.dur : it.from, E1 = E0 + m, ops: any[] = [];
  if (!m) return ops;
  for (const { layer: ly, it: x } of members) {
    const end = x.from + x.dur;
    if (side === 'r' ? x.from >= E0 : end <= E0) continue;  // (wholly on the far side of this edge: not this edge's)
    const xe = side === 'r' ? end : x.from;
    const reaches = ly.kind !== 'subtitles' && (side === 'r' ? xe >= E0 - 1 : xe <= E0 + 1);
    let ne: number;
    if (reaches) ne = xe + m;
    else if (side === 'r' ? xe > E1 : xe < E1) ne = E1;
    else continue;
    const r = rateOf(ly, x), len = p.assets?.[x.asset]?.duration;
    if (side === 'r') { if (x.in != null && len && r > 0) ne = Math.min(ne, x.from + Math.floor(((len - x.in) / r) * fps)); }
    else { if (x.in != null && r > 0) ne = Math.max(ne, x.from - Math.floor((x.in / r) * fps)); ne = Math.max(0, ne); }
    const a = side === 'r' ? x.from : ne, b = side === 'r' ? ne : end;
    if (b - a < 1) { ops.push({ op: 'item.remove', layer: ly.id, id: x.id }); continue; }
    ops.push({ op: 'item.update', layer: ly.id, id: x.id, set: side === 'r' ? { dur: b - a }
      : { from: a, dur: b - a, ...(x.in != null ? { in: +Math.max(0, x.in + ((a - x.from) / fps) * r).toFixed(4) } : {}) } });
  }
  return ops;
}

/** Cut a group at frame f: everything of it across f is cut in two, everything after f (and the second halves) becomes
 *  a group of its own (a new link); a subtitle goes to the half its middle is in. With no group: the item alone. */
export function splitOps(p: any, l: any, it: any, f: number) {
  if (!(f > it.from && f < it.from + it.dur)) return null;
  const fps = p.canvas.fps, stamp = Date.now().toString(36);
  const link = it.link ? `${it.link}.s${stamp}` : undefined;
  const all: Member[] = [{ layer: l, it }, ...groupOf(p, l, it)];
  const ops: any[] = [];
  let firstNew = '';
  for (const { layer: ly, it: x } of all) {
    const end = x.from + x.dur;
    if (end <= f) continue;
    const after = ly.kind === 'subtitles' ? x.from + x.dur / 2 >= f : x.from >= f;
    if (after) { if (link) ops.push({ op: 'item.update', layer: ly.id, id: x.id, set: { link } }); continue; }
    if (ly.kind === 'subtitles') continue;  // (its middle is before the cut: it stays with the first half)
    let id = `${x.id}s${stamp}`;
    while ((ly.items || []).some((i: any) => i.id === id)) id += 'x';
    const dIn = ((f - x.from) / fps) * rateOf(ly, x);
    ops.push({ op: 'item.update', layer: ly.id, id: x.id, set: { dur: f - x.from, ...(x.fade_out ? { fade_out: 0 } : {}) } });
    ops.push({ op: 'item.add', layer: ly.id, item: { ...x, id, from: f, dur: end - f, ...(x.in != null ? { in: +(x.in + dIn).toFixed(4) } : {}),
      ...(x.fade_in ? { fade_in: 0 } : {}), ...(link ? { link } : {}) } });
    if (x === it) firstNew = id;
  }
  return { ops, id: firstNew };
}

/** Delete an item with its group (alone = just it). */
export function removeOps(p: any, l: any, it: any, alone = false) {
  return [{ layer: l, it }, ...(alone ? [] : groupOf(p, l, it))].map(({ layer, it: x }) => ({ op: 'item.remove', layer: layer.id, id: x.id }));
}
