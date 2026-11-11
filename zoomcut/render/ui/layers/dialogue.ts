// A dialogue project in the timeline (layers.md -> "Dialogue"; the drawing side is render/src/layers/view.js): a group
// of rows per character (its video clips, its background row under them, its voice, any picture of its own), and the
// "What we see" strip on top - whose rows are on screen when. A clip, its background, its voice and the line's subtitles
// are one group (group.ts - moved, trimmed, cut, deleted together; Alt = one piece alone); the strip's cuts move only
// who is seen. Nothing pushes anything else.
// The pure helpers here give the ops; Timeline.tsx wires them to the mouse and the keys.
import { stripOf } from '../../src/layers/view.js';

export const viewLayer = (p: any) => (p.layers || []).find((l: any) => l.kind === 'view');
export const isDialogue = (p: any) => !!viewLayer(p);

// one colour per character - the strip's block and the character's rows share it
const PALETTE = ['#4a86e8', '#e0795a', '#3fa66b', '#c2507a', '#d9a441', '#8a5cd6', '#3aa7b8'];

/** The characters: every video row that is named on the strip (or, in a group nobody on the strip is in, the group's
 *  top video row - a video background is not a character), in the order of the layers (top first, as the timeline
 *  lists them) - {id (the video row), name, color, group}. */
export function characters(p: any) {
  const named = new Set(stripOf(p).map((s: any) => s.show));
  const ls = [...(p.layers || [])].reverse();
  const groupsNamed = new Set(ls.filter((l: any) => named.has(l.id)).map((l: any) => l.group).filter(Boolean));
  const vids = ls.filter((l: any, i: number) => l.kind === 'video' && (named.has(l.id)
    || (l.group && !groupsNamed.has(l.group) && !ls.slice(0, i).some((x: any) => x.kind === 'video' && x.group === l.group))));
  return vids.map((l: any, i: number) => ({ id: l.id, name: l.group || l.name || l.id, color: PALETTE[i % PALETTE.length], group: l.group }));
}

/** layer id -> its character's colour (the video row and every row of its group), for the blocks */
export function rowColors(p: any): Record<string, string> {
  if (!isDialogue(p)) return {};
  const out: Record<string, string> = {};
  for (const c of characters(p)) {
    out[c.id] = c.color;
    if (c.group) for (const l of p.layers || []) if (l.group === c.group) out[l.id] = c.color;
  }
  return out;
}

/** How far a voice is from its own picture (seconds; - = heard before it, + = after), null when it is with it. */
export function soundOffset(p: any, l: any, it: any) {
  if (l.kind !== 'audio' || !it.link || it.in == null || !isDialogue(p)) return null;
  const fps = p.canvas.fps;
  for (const ly of p.layers || []) {
    if (ly.kind !== 'video') continue;
    const v = (ly.items || []).find((x: any) => x.link === it.link && x.asset === it.asset);
    if (!v || v.in == null) continue;
    const off = (it.from / fps - it.in) - (v.from / fps - v.in);
    return Math.abs(off) * fps < 1.5 ? null : off;  // (a frame either way is the cut's rounding, not a move)
  }
  return null;
}

/** Where a strip cut snaps: every voice's start / end, every clip's start / end (frames). */
export function snapFrames(p: any) {
  const s = new Set<number>();
  for (const l of p.layers || []) if (l.kind === 'audio' || l.kind === 'video') for (const it of l.items || []) {
    if (l.kind === 'audio' && !(it.link || l.group)) continue;  // (music, sounds: not a cut)
    s.add(Math.round(it.from)); s.add(Math.round(it.from + it.dur));
  }
  return [...s].sort((a, b) => a - b);
}

/** The stretches of a strip block whose row has no clip there (shown hatched: nothing of him to see) - [[a, b], ...] */
export function noPicture(p: any, s: any) {
  const row = (p.layers || []).find((l: any) => l.id === s.show);
  const items = (row?.items || []).filter((i: any) => !i.hidden).map((i: any) => [i.from, i.from + i.dur]).sort((a: any, b: any) => a[0] - b[0]);
  const out: number[][] = [];
  let t = s.from;
  const end = s.from + s.dur;
  for (const [a, b] of items) {
    if (b <= t) continue;
    if (a >= end) break;
    if (a > t + 0.5) out.push([t, Math.min(a, end)]);
    t = Math.max(t, b);
  }
  if (end - t > 0.5) out.push([t, end]);
  return out;
}

const sorted = (l: any) => [...(l?.items || [])].sort((a: any, b: any) => a.from - b.from);

/** The strip's cut between `a` and the block right after it, moved by d frames (both neighbours change; neither gets
 *  shorter than a frame). */
export function moveCut(p: any, a: any, d: number) {
  const v = viewLayer(p), list = sorted(v), b = list[list.indexOf(a) + 1];
  if (!b || Math.abs(b.from - (a.from + a.dur)) > 1) return { ops: [] as any[], moved: 0 };
  const cut = Math.max(a.from + 1, Math.min(b.from + b.dur - 1, a.from + a.dur + d));
  const moved = cut - (a.from + a.dur);
  return { moved, ops: [{ op: 'item.update', layer: v.id, id: a.id, set: { dur: cut - a.from } },
    { op: 'item.update', layer: v.id, id: b.id, set: { from: cut, dur: b.from + b.dur - cut } }] };
}

/** A new cut on the strip at frame f: the block there splits in two (both show the same row - pick the other one). */
export function splitAt(p: any, f: number) {
  const v = viewLayer(p);
  const s = sorted(v).find((x: any) => f > x.from + 0.5 && f < x.from + x.dur - 0.5);
  if (!v || !s) return null;
  const id = `w${Date.now().toString(36)}`;
  return { id, ops: [{ op: 'item.update', layer: v.id, id: s.id, set: { dur: f - s.from } },
    { op: 'item.add', layer: v.id, item: { id, from: f, dur: s.from + s.dur - f, show: s.show } }] };
}

/** A strip block deleted: its neighbour takes its time (the one before; the first block - the one after). */
export function removeBlock(p: any, id: string) {
  const v = viewLayer(p), list = sorted(v), i = list.findIndex((x: any) => x.id === id), s = list[i];
  if (!s) return [];
  const ops: any[] = [{ op: 'item.remove', layer: v.id, id }];
  const prev = list[i - 1], next = list[i + 1];
  if (prev && Math.abs(prev.from + prev.dur - s.from) <= 1) ops.push({ op: 'item.update', layer: v.id, id: prev.id, set: { dur: s.from + s.dur - prev.from } });
  else if (next && Math.abs(next.from - (s.from + s.dur)) <= 1) ops.push({ op: 'item.update', layer: v.id, id: next.id, set: { from: s.from, dur: next.from + next.dur - s.from } });
  return ops;
}
