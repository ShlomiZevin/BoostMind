// A group (his ask, 2026-11-10: "when I have a character and background and sound, they are all together ... I can cut
// all three layers ... if I stretch, I stretch all together"): every item that shares a `link` - a character's clip,
// its background, its voice, the line's subtitles - is edited as one. Moving any of them moves all; an edge moves the
// edges that reach it (shortening cuts whatever would play past it); S cuts them all at the playhead; Delete removes
// them all; Alt + drag / Alt + Delete = that piece alone. Subtitles never lead a group (a caption is its own,
// 2026-10-23), and a builder's take keeps its builder's edit (LayersEditor onItemEdit) - no group there.
// Pure helpers: the ops. Timeline.tsx / LayersEditor.tsx wire them to the mouse and the keys. Documented in
// skill/edit-video/layers.md -> "Groups".
import { tempoOf, paceK } from '../../src/layers/clock.js';
import { apply } from '../../src/layers/ops.js';

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
const rateOf = (p: any, ly: any, x: any) => (x.rate ?? 1) * tempoOf(ly) * paceK(p, ly, x);

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
    const r = rateOf(p, ly, x), len = p.assets?.[x.asset]?.duration;
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
    const dIn = ((f - x.from) / fps) * rateOf(p, ly, x);
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

// ---- a group's own speed (his ask, 2026-11-11: "I wanted the video in 1.4 and there is a specific one I would like
// in 1.2 ... speed per group"). `pace` on every clip of the group = its real speed, apart from the project's (project
// 1.4x, this group 1.2x; null = the project's). Its clips play that fast - a video clip by its `rate` (pace / project
// speed), a sound clip stretched with its pitch kept (AudioTrack / layers_audio read `pace`) - so the group gets longer
// / shorter on the timeline: it stretches from its start, and everything after it moves by the difference (a stretch
// across it - music, a strip block - grows / shrinks; a cut inside it keeps its place in the line). Changing the
// project's speed keeps such a group at its own speed.

const membersOf = (p: any, l: any, it: any): Member[] => [{ layer: l, it }, ...groupOf(p, l, it)];
export const paceOf = (it: any) => (it?.pace ? +it.pace : null);

/** Time warped around one stretch [g0, E): before it the same, inside it scaled by k, after it moved by the difference. */
function warpOps(p: any, members: Member[], k: number, rateK: number, pace: number | null) {
  const g0 = Math.min(...members.map((m) => m.it.from)), E = Math.max(...members.map((m) => m.it.from + m.it.dur));
  const d = Math.round((E - g0) * k) - (E - g0);
  const map = (b: number) => (b <= g0 ? b : b >= E ? b + d : Math.round(g0 + (b - g0) * k));
  const mine = new Set(members.map((m) => `${m.layer.id}|${m.it.id}`));
  // another group moves as a whole (by where it starts - its first clip that isn't a subtitle)
  const starts: Record<string, number> = {};
  for (const ly of p.layers || []) for (const x of ly.items || []) if (x.link && ly.kind !== 'subtitles' && ly.kind !== 'view')
    starts[x.link] = Math.min(starts[x.link] ?? Infinity, x.from);
  const ops: any[] = [];
  for (const ly of p.layers || []) for (const x of ly.items || []) {
    const a = x.from, b = x.from + x.dur;
    if (mine.has(`${ly.id}|${x.id}`)) {
      const set: any = { from: map(a), dur: Math.max(1, map(b) - map(a)), pace: pace ?? null };
      if (ly.kind !== 'audio' && x.in != null && x.rate !== 0) { const r = +((x.rate ?? 1) * rateK).toFixed(5); set.rate = Math.abs(r - 1) < 1e-4 ? null : r; }
      ops.push({ op: 'item.update', layer: ly.id, id: x.id, set });
      continue;
    }
    if (x.pin) continue;  // (an end card / a whole-video item: the new length places it - ops.js repin)
    if (x.link && ly.kind !== 'view' && starts[x.link] != null && Number.isFinite(starts[x.link])) {
      const s = map(starts[x.link]) - starts[x.link];
      if (s) ops.push({ op: 'item.update', layer: ly.id, id: x.id, set: { from: Math.max(0, a + s) } });
      continue;
    }
    const na = map(a), nb = map(b);
    if (na !== a || nb !== b) ops.push({ op: 'item.update', layer: ly.id, id: x.id, set: { from: na, dur: Math.max(1, nb - na) } });
  }
  const notes = (p.notes || []).map((n: any) => ({ ...n, at: map(n.at), ...(n.end != null ? { end: map(n.end) } : {}) }));
  ops.push({ op: 'project', set: { duration: Math.max(1, map(p.duration)), ...(p.notes?.length ? { notes } : {}) } });
  return ops;
}

/** Set a group's own speed (null = the project's again). [] when nothing changes. */
export function speedOps(p: any, l: any, it: any, pace: number | null) {
  const P = p.speed || 1, members = membersOf(p, l, it);
  const cur = paceOf(it) ?? P, next = pace ?? P;
  if (Math.abs(cur - next) < 1e-4 && paceOf(it) === pace) return [];
  return warpOps(p, members, cur / next, next / cur, pace);
}

/** The project's speed changed: every group with its own speed keeps it (its clips get longer / shorter on the
 *  timeline by new / old, everything after it moves) - one group at a time, the last first. */
export function projectSpeedOps(p: any, speed: number) {
  const P = p.speed || 1, ops: any[] = [];
  let cur = p;
  if (Math.abs(P - speed) > 1e-4) {
    const seen = new Set<string>(), groups: { l: any; it: any; from: number }[] = [];
    for (const ly of p.layers || []) for (const x of ly.items || []) {
      if (!paceOf(x) || ly.kind === 'subtitles') continue;
      const key = x.link || `${ly.id}|${x.id}`;
      if (seen.has(key)) continue;
      seen.add(key); groups.push({ l: ly, it: x, from: x.from });
    }
    groups.sort((a, b) => b.from - a.from);
    for (const g of groups) {
      const ly = cur.layers.find((x: any) => x.id === g.l.id), x = ly?.items?.find((i: any) => i.id === g.it.id);
      if (!x) continue;
      const o = warpOps(cur, membersOf(cur, ly, x), speed / P, P / speed, paceOf(x));
      ops.push(...o); cur = apply(cur, o);
    }
  }
  ops.push({ op: 'project', set: { speed } });
  return ops;
}
