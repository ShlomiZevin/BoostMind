// The timeline of a layered project: a lane per layer, grouped (one group per character, Window, Text, Sound...),
// the top layer first. Click a block = select it; drag it = move; drag an edge = trim (a video / sound edge pulls back
// the original footage, never past the take's ends). Ctrl+wheel zooms (around the mouse), Alt / Shift+wheel scrolls
// sideways. Pick a block first (a click): only the picked one drags - by its body or by its edge grips - so a
// neighbour's edge is never grabbed by mistake. Every change is an op (live while dragging).
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { KIND_COLOR, KIND_LABEL, Send, fmtT } from './api';
import './timeline.css';
import { ask } from './ask';
import { Note, NotePins, PRESETS, saveNotes, newNote, NoteView, NOTE_VIEWS, inView, noteState } from './Notes';
import { Find } from './Find';
import { tempoOf, paceK } from '../../src/layers/clock.js';
import { tabProject } from '../common';
import { viewLayer, characters, rowColors, soundOffset, snapFrames, noPicture, moveCut, splitAt } from './dialogue';
import { groupOf, edgeOps, splitOps, removeOps, isTakeItem } from './group';
import { pinned } from '../../src/layers/ops.js';

export type Sel = { layer: string; item?: string } | null;

type Props = {
  project: any; frame: number; sel: Sel; onSel: (s: Sel) => void; onSeek: (f: number) => void; send: Send;
  onItemEdit?: (layer: any, it: any, side: 'l' | 'r' | 'm', dFrames: number) => boolean | 'keep';  // a builder item: its builder takes the change
  // while it drags: the ops that show it (one of his takes in a continuous cut - everything after it moves along), or null
  onItemPreview?: (layer: any, it: any, side: 'l' | 'r' | 'm', dFrames: number, base: any) => any[] | null;
  canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void;
  onSolo?: (s: Sel) => void; soloKey?: string | null;  // play one clip alone in the video (Shift+Space, the edge card)
  playing?: boolean;  // (stopped: the quick notes wait, faint, beside the playhead on the ruler)
  onOpen?: (s: Sel) => void;  // open the clip's own file in a window (▶ above the block, on hover)
  notes?: Note[]; onNote?: (n: Note | null, at?: number, end?: number) => void; noteView?: NoteView; onNoteView?: (v: NoteView) => void;  // notes for Claude: a flag each on the ruler (null = a new one at the playhead)
};

const TH = 30;  // lane height
const NW = 200;  // the names column

const EyeIc = ({ off }: { off?: boolean }) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{off && <path d="M4 4l16 16" />}</svg>;
const SpkIc = ({ off }: { off?: boolean }) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
  <path d="M4 9v6h4l5 4V5L8 9z" />{off ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" />}</svg>;

// the copied clip (right-click -> Copy, or Ctrl+C): the clip + its group (group.ts - its background, its voice, the
// line's subtitles) - pasted (right-click a row -> Paste here, or Ctrl+V at the playhead) as new copies in this project
let CLIP: { ep: string; kind: string; layer: string; group?: string; it: any; with: { layer: string; kind: string; it: any }[] } | null = null;

export function groupsOf(project: any) {
  // top layer first; a group sits where its topmost layer is
  const out: { name: string; layers: any[] }[] = [];
  for (const l of [...(project.layers || [])].reverse()) {
    if (l.kind === 'view') continue;  // (the "What we see" strip has its own row on top)
    const g = l.group || KIND_LABEL[l.kind] || 'Layers';
    const hit = out.find((x) => x.name === g);
    if (hit) hit.layers.push(l); else out.push({ name: g, layers: [l] });
  }
  // a dialogue project: in each character's group the clips first, the voice right under them
  if ((project.layers || []).some((l: any) => l.kind === 'view')) for (const g of out) g.layers.sort((a, b) => Number(a.kind === 'audio') - Number(b.kind === 'audio'));
  // sound-only groups go under the pictures, like any editor
  return [...out.filter((g) => g.layers.some((l) => l.kind !== 'audio')), ...out.filter((g) => g.layers.every((l) => l.kind === 'audio'))];
}

// ▶ above a block opens its own file (Media's window): a picture, a video, a sound, a text's words
// (not a subtitle - his note: no need, its words are right there)
const opens = (l: any, it: any, project: any) => l.kind !== 'subtitles' && (it.text != null || !!project.assets?.[it.asset ?? l.props?.asset]);
/** volume words + the clip's volume line (the same numbers as the sound panel: a clip's gain, a row's volume) */
const dbOf = (g: number) => (g <= 0.0005 ? -Infinity : 20 * Math.log10(g));
const dbTxt = (g: number) => { const d = dbOf(g); return d === -Infinity ? 'silent' : Math.abs(d) < 0.05 ? '0 dB' : `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} dB`; };
const lineAt = (g: number) => { const d = Math.max(-18, Math.min(6, dbOf(g))); return d >= 0 ? 0.58 - (d / 6) * 0.28 : 0.58 + (-d / 18) * 0.28; };  // 0 = the block's top: +6 dB 30%, 0 dB 58%, -18 dB 86%
/** the ready-made notes' icons, for the quick buttons on the ruler (tighten = two clips pushed together; silence = scissors) */
// the ruler's note buttons - each an icon AND its word (his note, 2026-11-11: tighten and silence looked alike): arrows
// closing on a cut, a muted speaker, a speech bubble
const QN_IC: Record<string, React.ReactNode> = {
  tighten: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h7M6 8.5 9.5 12 6 15.5M22 12h-7M18 8.5 14.5 12l3.5 3.5M12 4v16" /></svg>,
  note: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4z" /><path d="M12 8.5v4M10 10.5h4" /></svg>,
  silence: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9v6h4l5 4V5L7 9z" /><path d="M16 9l6 6M22 9l-6 6" /></svg>,
};
const QN_WORD: Record<string, string> = { note: 'Note', tighten: 'Tighten', silence: 'Cut silence' };
const OPEN_WORD: Record<string, string> = { video: 'video', image: 'picture', audio: 'sound', text: 'text', subtitle: 'line' };

// what a block says: its words (a text, a subtitle, a voice's line), else its file's name
const blockText = (l: any, it: any, project: any) => {
  if (it.text != null) return String(it.text).replace('{clock}', '00:00');
  if (it.link && (l.kind === 'video' || l.kind === 'audio') && (project.layers || []).some((x: any) => x.kind === 'view')) {  // (a dialogue clip / voice: its line's words)
    const words = (project.layers || []).filter((x: any) => x.kind === 'subtitles').flatMap((x: any) => (x.items || []).filter((s: any) => s.link === it.link))
      .filter((s: any) => s.from < it.from + it.dur && s.from + s.dur > it.from).sort((a: any, b: any) => a.from - b.from).map((s: any) => s.text);
    if (words.length) return words.join(' ');
  }
  if (l.kind === 'audio' && it.ref?.line != null) { const ln = (project.script || []).find((x: any) => x.n === it.ref.line); if (ln) return ln.text; }
  const a = project.assets?.[it.asset ?? l.props?.asset];
  return a ? a.label || String(a.src).split('/').pop() : '';
};

export function Timeline({ project, frame, sel, onSel, onSeek, send, onItemEdit, onItemPreview, onSolo, soloKey, onOpen, playing, canUndo, canRedo, onUndo, onRedo, notes = [], onNote, noteView = 'active', onNoteView }: Props) {
  const fps = project.canvas.fps, total = project.duration;
  const [pps, setPps] = useState(() => +(localStorage.getItem('zc-ly-pps') || 60));  // pixels per second
  useEffect(() => { try { localStorage.setItem('zc-ly-pps', String(pps)); } catch {} }, [pps]);
  const [closed, setClosed] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem('zc-ly-closed') || '{"Window":true}'); } catch { return { Window: true }; } });  // (the Zoom window's parts start folded)
  useEffect(() => { try { localStorage.setItem('zc-ly-closed', JSON.stringify(closed)); } catch {} }, [closed]);
  // ONE scroll box: each row = its name (sticky on the left) + its lane - they can't drift apart (timeline.css)
  const lanes = useRef<HTMLDivElement>(null);
  // the wheel: Ctrl zooms around the mouse (the moment under it stays put), Alt / Shift scrolls sideways, plain scrolls
  // the layers. A native listener - React's wheel listener is passive, so it can't stop the browser zooming the page.
  const anchor = useRef<{ t: number; x: number } | null>(null);  // (the time under the mouse, kept there after a zoom)
  useEffect(() => {
    const el = lanes.current; if (!el) return;
    const wheel = (e: WheelEvent) => {
      const d = e.deltaY || e.deltaX;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const x = e.clientX - el.getBoundingClientRect().left - NW;  // (where the mouse is in the lanes' view)
        setPps((p) => {
          const n = Math.max(8, Math.min(400, p * (d < 0 ? 1.15 : 0.87)));
          anchor.current = { t: Math.max(0, (el.scrollLeft + x) / p), x };
          return n;
        });
      } else if (e.altKey || e.shiftKey) {
        e.preventDefault();
        el.scrollLeft += d;
      }
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);
  useLayoutEffect(() => {
    const el = lanes.current, a = anchor.current; if (!el || !a) return;
    anchor.current = null;
    el.scrollLeft = Math.max(0, a.t * pps - a.x);
  }, [pps]);
  const px = (f: number) => (f / fps) * pps;
  const width = px(total) + 200;
  const groups = useMemo(() => groupsOf(project), [project]);
  const selLink = sel?.item ? project.layers.find((l: any) => l.id === sel.layer)?.items?.find((i: any) => i.id === sel.item)?.link : null;
  // a dialogue project (dialogue.ts): the "What we see" strip on top, a colour per character on its rows
  const view = viewLayer(project);
  const chars = useMemo(() => characters(project), [project]);
  const colors = useMemo(() => rowColors(project), [project]);
  const [choose, setChoose] = useState<string | null>(null);  // the strip block whose "who is seen" list is open
  const [cutTip, setCutTip] = useState<{ x: number; text: string } | null>(null);
  const [drag, setDrag] = useState<{ layer: string; item: string; d: number; side: string; to?: string | null; dy?: number } | null>(null);

  // something picked (on the video, in a panel): unfold its group, bring its lane and block into view
  useEffect(() => {
    if (!sel) return;
    const g = groups.find((x) => x.layers.some((l) => l.id === sel.layer));
    if (g && closed[g.name]) { setClosed({ ...closed, [g.name]: false }); return; }
    const el = lanes.current; if (!el) return;
    const lane = el.querySelector(`[data-lane="${CSS.escape(sel.layer)}"]`) as HTMLElement | null;
    if (lane) {
      const top = lane.offsetTop, h = lane.offsetHeight;
      if (top < el.scrollTop + TH || top + h > el.scrollTop + el.clientHeight) el.scrollTop = Math.max(0, top - el.clientHeight / 2);
    }
    const it = sel.item && project.layers.find((l: any) => l.id === sel.layer)?.items?.find((i: any) => i.id === sel.item);
    if (it) { const x = px(it.from); if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - NW - 60) el.scrollLeft = Math.max(0, x - 120); }
  }, [sel?.layer, sel?.item, closed]);

  // keep the playhead in view while playing
  useEffect(() => {
    const el = lanes.current; if (!el) return;
    const x = px(frame);  // (in the lanes' own x: the names column covers the first NW px of the view)
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - NW - 40) el.scrollLeft = Math.max(0, x - 80);
  }, [Math.floor(frame / fps)]);

  const seekAt = (e: React.MouseEvent) => {  // (on a lane's track: its left edge is frame 0, wherever it is scrolled)
    const tr = e.currentTarget as HTMLElement;
    const go = (cx: number) => onSeek(Math.max(0, Math.min(total - 1, Math.round(((cx - tr.getBoundingClientRect().left) / pps) * fps))));
    go(e.clientX);
    const mv = (m: MouseEvent) => go(m.clientX);
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };

  // moving / trimming one block by d frames, from the project as it was when it began: the ops, and the frames it
  // really moved (never past the take's ends). A drag and a nudge both go through here, so they behave the same
  const trimmer = (l: any, it: any, side: 'l' | 'r' | 'm', chain = false, alone = false) => {
    if (l.kind === 'view') return cutTrimmer(l, it, side);
    const asset = project.assets?.[it.asset];
    const rate = (it.rate || 1) * tempoOf(l) * paceK(project, l, it);  // (seconds of the source per second here - a sound row's tempo, a group's own speed too)
    // never past the video's end: moved there it ends at the end, stretched there it stops at it (his takes excepted -
    // pulling back footage at the end makes the video longer, their builder re-plans the length)
    const take = it.ref?.take != null || it.ref?.line != null;
    const end = take ? Infinity : total;
    // two clips in one row never cover each other (his rule, 2026-11-02: "you can't drag and just override it"): a move
    // or an edge stops at the neighbour before / after it. Clips that already overlap don't block. Not for one of his
    // takes in a continuous cut - there a longer piece pushes the rest along, nothing is covered.
    const rippleTake = !!project.edit?.ripple && l.owner === 'builder' && take && l.kind !== 'subtitles' && l.kind !== 'text' && (side !== 'm' || !!project.edit?.ripple_move);
    const others = (l.items || []).filter((x: any) => x !== it && !x.hidden);
    const prevEnd = Math.max(0, ...others.filter((x: any) => x.from + x.dur <= it.from + 0.5).map((x: any) => x.from + x.dur));
    const nextFrom = Math.min(Infinity, ...others.filter((x: any) => x.from >= it.from + it.dur - 0.5).map((x: any) => x.from));
    const joinedL = others.some((x: any) => Math.abs(x.from + x.dur - it.from) <= 1), joinedR = others.some((x: any) => Math.abs(x.from - (it.from + it.dur)) <= 1);
    const lo = rippleTake || (chain && joinedL) ? 0 : prevEnd, hi = rippleTake || (chain && joinedR) ? Infinity : nextFrom;
    const opsFor = (d: number) => {
      if (side === 'm') return [{ op: 'item.update', layer: l.id, id: it.id, set: { from: Math.max(0, lo, Math.min(it.from + d, end - it.dur, hi - it.dur)) } }];
      if (side === 'r') {
        let dur = Math.max(1, Math.min(it.dur + d, end - it.from, hi - it.from));
        if (asset?.duration && it.in != null) dur = Math.min(dur, Math.floor((asset.duration - it.in) / rate * fps));  // never past the take's end
        return [{ op: 'item.update', layer: l.id, id: it.id, set: { dur } }];
      }
      let dd = Math.min(d, it.dur - 1);
      if (it.in != null) dd = Math.max(dd, -Math.floor((it.in / rate) * fps));  // never before the take's start
      dd = Math.max(dd, -it.from, lo - it.from);
      return [{ op: 'item.update', layer: l.id, id: it.id, set: { from: it.from + dd, dur: it.dur - dd, ...(it.in != null ? { in: +(it.in + (dd / fps) * rate).toFixed(4) } : {}) } }];
    };
    const moved = (d: number) => { const s: any = opsFor(d)[0].set; return side === 'r' ? s.dur - it.dur : s.from - it.from; };
    // its group (group.ts - a character's clip, background, voice, the line's subtitles): a move takes all of it, an
    // edge the edges that reach it. Alt = this piece alone (a voice alone still takes its words)
    const grp = groupOf(project, l, it).filter((g) => !alone || (side === 'm' && l.kind === 'audio' && g.layer.kind === 'subtitles'));
    const follow = (ops: any[], d: number) => side === 'm'
      ? [...ops, ...grp.map((g) => ({ op: 'item.update', layer: g.layer.id, id: g.it.id, set: { from: Math.max(0, g.it.from + moved(d)) } }))]
      : side === 'l' && stuck.length ? ops : [...ops, ...edgeOps(project, it, side, moved(d), grp)];  // (a start stuck to the clip before keeps its place)
    const base = project;
    // a nudge (chain): an edge where the clip is STUCK to the next one on its lane moves that one and every clip stuck
    // after it (and their linked voice / subtitles) - the join stays a join; a clip with space after it just changes.
    // A start edge on a join keeps its place (stuck to the clip before) - its footage slips and the rest follow.
    const stuck: any[] = [];
    if (chain && side !== 'm') {
      const lane = [...(l.items || [])].sort((a: any, b: any) => a.from - b.from);
      let end = it.from + it.dur, k = lane.indexOf(it) + 1;
      while (k < lane.length && Math.abs(lane[k].from - end) <= 1) { stuck.push(lane[k]); end = lane[k].from + lane[k].dur; k++; }
      if (side === 'l') {
        const prev = lane[lane.indexOf(it) - 1];
        if (!prev || Math.abs(prev.from + prev.dur - it.from) > 1) stuck.length = 0;  // (a start with space before it: just itself)
      }
    }
    const chainOps = (d: number) => {
      if (!stuck.length) return opsFor(d);
      const m = moved(d), own: any = { ...opsFor(d)[0] };
      if (side === 'l') own.set = { ...own.set, from: it.from };  // (stuck to the clip before: only its footage slips)
      const shift = side === 'r' ? m : -m, links = new Set(stuck.map((x) => x.link).filter(Boolean));
      const ops = [own, ...stuck.map((x) => ({ op: 'item.update', layer: l.id, id: x.id, set: { from: Math.max(0, x.from + shift) } }))];
      for (const ly of project.layers) if (ly.id !== l.id) for (const x of ly.items || []) if (x.link && links.has(x.link)) ops.push({ op: 'item.update', layer: ly.id, id: x.id, set: { from: Math.max(0, x.from + shift) } });
      return ops;
    };
    // live while it changes (a take in a continuous cut: everything after it moves along)
    const preview = (d: number) => { const ops = (onItemPreview && onItemPreview(l, it, side, moved(d), base)) || follow(chainOps(d), d); send(ops, { commit: false }); return ops; };
    // done: one undoable change - or the builder takes it (its live edit shows until the builder's answer lands)
    const commit = (d: number, label: string) => {
      if (!d || !moved(d)) { send([], { commit: false }); return; }
      const taken = onItemEdit && onItemEdit(l, it, side, moved(d));
      if (taken) { if (taken !== 'keep') send([], { commit: false }); return; }
      send(follow(chainOps(d), d), { label });
    };
    return { it, moved, preview, commit, ops: (d: number) => follow(chainOps(d), d), stuck: stuck.length > 0 };
  };
  // the strip's blocks: an edge between two blocks is a cut - moving it changes who is seen there and nothing else
  // (both neighbours change); a block's body doesn't move (the strip has no gaps). A drag, a nudge: the same path
  const cutTrimmer = (l: any, it: any, side: 'l' | 'r' | 'm') => {
    const list = [...(l.items || [])].sort((a: any, b: any) => a.from - b.from), k = list.indexOf(it);
    const left = side === 'r' ? it : side === 'l' ? list[k - 1] : null;  // (the block whose END is this cut)
    const after = left ? list[list.indexOf(left) + 1] : null;
    const joinedCut = !!after && Math.abs(after.from - (left.from + left.dur)) <= 1;
    const lim = (d: number) => Math.max(-it.from, Math.min(d, it.dur - 1));
    const plain = (d: number) => side === 'r' ? [{ op: 'item.update', layer: l.id, id: it.id, set: { dur: Math.max(1, it.dur + d) } }]
      : side === 'l' ? [{ op: 'item.update', layer: l.id, id: it.id, set: { from: it.from + lim(d), dur: it.dur - lim(d) } }] : [];
    const opsFor = (d: number) => (side === 'm' ? [] : joinedCut ? moveCut(project, left, d).ops : plain(d));
    const moved = (d: number) => (side === 'm' ? 0 : joinedCut ? moveCut(project, left, d).moved : side === 'r' ? Math.max(1, it.dur + d) - it.dur : lim(d));
    const preview = (d: number) => { const ops = opsFor(d); send(ops, { commit: false }); return ops; };
    const commit = (d: number, label: string) => { if (!d || !moved(d)) { send([], { commit: false }); return; } send(opsFor(d), { label: label === 'nudge' ? 'nudge cut' : 'cut' }); };
    return { it, moved, preview, commit, ops: opsFor, stuck: joinedCut };
  };
  // dragging a cut on the strip (the grip between two blocks): it snaps to a voice's start / end, a clip's edge and the
  // playhead when it comes within 6 px
  const snaps = useMemo(() => snapFrames(project), [project]);
  const startCut = (e: React.MouseEvent, a: any) => {
    e.stopPropagation(); e.preventDefault();
    flushNudge(); setChoose(null);
    if (view.locked) return;
    const x0 = e.clientX, at0 = a.from + a.dur, near = (6 / pps) * fps;
    let last = 0;
    const mv = (m: MouseEvent) => {
      let f = at0 + ((m.clientX - x0) / pps) * fps;
      const c = [...snaps, frame].reduce((b, x) => (Math.abs(x - f) < Math.abs(b - f) ? x : b), Infinity);
      f = Math.abs(c - f) <= near ? c : Math.round(f);
      const r = moveCut(project, a, f - at0);
      if (r.moved === last) return;
      last = r.moved;
      send(r.ops, { commit: false });
      setCutTip({ x: px(at0 + r.moved), text: `${fmtT((at0 + r.moved) / fps)}${r.moved ? ` · ${r.moved > 0 ? '+' : '−'}${(Math.abs(r.moved) / fps).toFixed(2)} s` : ''}` });
    };
    const up = () => {
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up); document.body.style.cursor = ''; setCutTip(null);
      if (!last) { send([], { commit: false }); return; }
      send(moveCut(project, a, last).ops, { label: 'cut' });
    };
    document.body.style.cursor = 'ew-resize';
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };
  // copy / paste a clip (his ask, 2026-11-09): a right-click menu on a clip / a row, Ctrl+C / Ctrl+V
  const [ctx, setCtx] = useState<{ x: number; y: number; layer: string; item?: string; at: number } | null>(null);
  const [, setCopied] = useState(0);
  const copyClip = (l: any, it: any) => {
    const withIt = groupOf(project, l, it).map((g) => ({ layer: g.layer.id, kind: g.layer.kind, it: g.it }));
    CLIP = { ep: tabProject.get(), kind: l.kind, layer: l.id, group: l.group, it: JSON.parse(JSON.stringify(it)), with: JSON.parse(JSON.stringify(withIt)) };
    setCopied((n) => n + 1);
  };
  const canPaste = (l: any) => !!CLIP && CLIP.ep === tabProject.get() && (l?.kind === CLIP.kind || project.layers.some((x: any) => x.id === CLIP!.layer));
  const pasteClip = (l: any, at: number) => {
    if (!CLIP || CLIP.ep !== tabProject.get()) return;
    const tl = l?.kind === CLIP.kind ? l : project.layers.find((x: any) => x.id === CLIP!.layer);
    if (!tl) return;
    const stamp = Date.now().toString(36), from = Math.max(0, Math.round(at));
    const link = CLIP.it.link ? `${CLIP.it.link}.c${stamp}` : undefined;
    const fresh = (x: any, layer: any, f: number) => {
      let id = `${x.id}c${stamp}`;
      while ((layer.items || []).some((i: any) => i.id === id)) id += 'x';
      return { ...x, id, from: Math.max(0, f), ...(link ? { link } : {}) };
    };
    const ops: any[] = [{ op: 'item.add', layer: tl.id, item: fresh(CLIP.it, tl, from) }];
    for (const w of CLIP.with) {  // (its background, its voice: on the same kind of row of the character it is pasted to; subtitles on theirs)
      const d = (w.kind !== 'subtitles' && tl.group && tl.group !== CLIP.group && project.layers.find((x: any) => x.group === tl.group && x.kind === w.kind && x.id !== tl.id))
        || project.layers.find((x: any) => x.id === w.layer);
      if (d) ops.push({ op: 'item.add', layer: d.id, item: fresh(w.it, d, from + (w.it.from - CLIP.it.from)) });
    }
    send(ops, { label: 'paste' });
    onSel({ layer: tl.id, item: ops[0].item.id });
  };
  const frameAt = (e: React.MouseEvent) => {
    const tr = (e.currentTarget as HTMLElement).closest('.ltl-track') as HTMLElement | null;
    return tr ? Math.max(0, Math.min(total - 1, Math.round(((e.clientX - tr.getBoundingClientRect().left) / pps) * fps))) : frame;
  };
  useEffect(() => {
    if (!ctx) return;
    const off = (e: Event) => { if (!(e.target as HTMLElement).closest?.('.ctxm')) setCtx(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setCtx(null); } };
    addEventListener('mousedown', off, true); addEventListener('keydown', esc, true); addEventListener('blur', () => setCtx(null), { once: true });
    return () => { removeEventListener('mousedown', off, true); removeEventListener('keydown', esc, true); };
  }, [ctx]);

  // S: the picked clip cut at the playhead with its whole group (group.ts - a builder's take and a caption excepted);
  // the strip picked (or a clip the playhead isn't on): a new cut on the "What we see" strip
  // the scissors (his ask, 2026-11-11): Ctrl held over the timeline turns the pointer into scissors; a click on a clip
  // cuts it - with its group - right where it was clicked
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Control' || e.key === 'Meta') lanes.current?.classList.toggle('cutting', e.type === 'keydown'); };
    const off = () => lanes.current?.classList.remove('cutting');
    addEventListener('keydown', k); addEventListener('keyup', k); addEventListener('blur', off);
    return () => { removeEventListener('keydown', k); removeEventListener('keyup', k); removeEventListener('blur', off); };
  }, []);
  const canCut = (l: any, it: any) => l.kind !== 'view' && l.kind !== 'subtitles' && !l.locked && !isTakeItem(l, it);
  const cutAt = (l: any, it: any, f: number) => {
    const c = canCut(l, it) && splitOps(project, l, it, f);
    if (c) { send(c.ops, { label: 'cut clip' }); onSel({ layer: l.id, item: it.id }); }
  };
  // where the mouse is over the layers (his asks, 2026-11-11): + = a note right there, Ctrl+K = the clip under it cut
  // there (with its group)
  const hov = useRef<{ f: number; layer?: string; item?: string } | null>(null);
  const hoverMove = (e: React.MouseEvent) => {
    const tr = lanes.current?.querySelector('.ltl-track') as HTMLElement | null;
    if (!tr) return;
    const b = (e.target as HTMLElement).closest('[data-item]') as HTMLElement | null;
    hov.current = { f: Math.max(0, Math.min(total - 1, Math.round(((e.clientX - tr.getBoundingClientRect().left) / pps) * fps))), layer: b?.dataset.layer, item: b?.dataset.item };
  };
  const splitHere = () => {
    const sl = sel?.item && project.layers.find((x: any) => x.id === sel.layer), si = sl && (sl.items || []).find((i: any) => i.id === sel!.item);
    if (sl && si && canCut(sl, si)) {
      const c = splitOps(project, sl, si, Math.round(frame));
      if (c) { send(c.ops, { label: 'cut clip' }); return; }
    }
    const r = view && splitAt(project, Math.round(frame));
    if (!r) return;
    send(r.ops, { label: 'new cut' });
    onSel({ layer: view.id, item: r.id }); setChoose(r.id);
  };

  // a block dragged: d frames (live draft), committed on release. A grip clicked without dragging picks that edge
  // a move's ops with the clip landing on another row: it leaves its row for that one (same id unless taken); what of its
  // own character's rows moved with it (its background, its voice) goes to the same kind of row of the new row's character
  const toRow = (ops: any[], l: any, it: any, to: string) => {
    const L = (id: string) => project.layers.find((x: any) => x.id === id);
    const tl = L(to);
    const dest = (ly: any) => (ly.id === l.id ? tl : l.group && ly.group === l.group && tl.group && tl.group !== l.group
      ? project.layers.find((x: any) => x.group === tl.group && x.kind === ly.kind && x.id !== tl.id) : null);
    return ops.flatMap((o: any) => {
      const ly = o.op === 'item.update' && L(o.layer), d = ly && dest(ly);
      if (!d) return [o];
      const x = ly.items.find((i: any) => i.id === o.id);
      const id = (d.items || []).some((i: any) => i.id === x.id) ? `${x.id}m${Date.now().toString(36)}` : x.id;
      return [{ op: 'item.remove', layer: ly.id, id: x.id }, { op: 'item.add', layer: d.id, item: { ...x, ...o.set, id } }];
    });
  };
  const startDrag = (e: React.MouseEvent, l: any, it: any, side: 'l' | 'r' | 'm') => {
    e.stopPropagation(); e.preventDefault();
    flushNudge();
    if ((e.ctrlKey || e.metaKey) && l.kind !== 'view') { cutAt(l, it, frameAt(e)); return; }  // (the scissors, on an edge too)
    onSel({ layer: l.id, item: it.id });
    if (l.locked) return;
    const x0 = e.clientX;
    const t = trimmer(l, it, side, false, e.altKey);  // (Alt: this piece alone, not its group)
    let last = 0, to: string | null = null, dy = 0;
    // a clip moved up / down onto another row of its kind (video -> video, picture -> picture, sound -> sound)
    const laneAt = (m: MouseEvent) => {
      if (side !== 'm') return null;
      const row = (document.elementFromPoint(m.clientX, m.clientY) as HTMLElement | null)?.closest('[data-lane]') as HTMLElement | null;
      const tl = row && project.layers.find((x: any) => x.id === row.dataset.lane);
      if (!tl || tl.id === l.id || tl.kind !== l.kind || tl.locked || l.kind === 'view') return null;
      const src = lanes.current?.querySelector(`[data-lane="${CSS.escape(l.id)}"]`) as HTMLElement | null;
      return { id: tl.id, dy: src ? row!.getBoundingClientRect().top - src.getBoundingClientRect().top : 0 };
    };
    const mv = (m: MouseEvent) => {
      const d = Math.round(((m.clientX - x0) / pps) * fps);
      const at = laneAt(m);
      if (d === last && (at?.id ?? null) === to) return;
      const dChanged = d !== last;
      last = d; to = at?.id ?? null; dy = at?.dy ?? 0;
      setDrag({ layer: l.id, item: it.id, d, side, to, dy });
      if (dChanged) t.preview(d);
    };
    const up = () => {
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up);
      setDrag(null);
      // (an edge's card only for a click on the edge - after a drag it just gets in the way, his note 2026-11-09)
      setEdge(side === 'm' || last !== 0 ? null : { layer: l.id, item: it.id, side, total: 0 });
      if (to) { send(toRow(t.ops(last), l, it, to), { label: 'move to row' }); onSel({ layer: to, item: it.id }); return; }
      t.commit(last, side === 'm' ? 'move' : 'trim');
    };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };

  // ---- nudging a cut edge: pick a start / end (click it), then , . (Shift = 3 frames) or type +120 / -80 and Enter.
  // The video cuts on whole frames (33 ms at 30 fps), so ms are rounded to frames and the chip says what it became.
  // Presses close together are one change (one Ctrl+Z, one builder run); everything linked follows like a drag
  // (the line follows the mouse; a short rest locks it there with its buttons, so the mouse can go to them - his note:
  // "when I want to choose them I just move the line". Moving on past the buttons, or back left, unlocks it)
  const qnAt = useRef(0), qn = useRef<{ lock: number | null; t: any }>({ lock: null, t: 0 });
  const qnMove = (e: React.MouseEvent) => {
    const tr = e.currentTarget as HTMLElement, x = e.clientX - tr.getBoundingClientRect().left, st = qn.current;
    tr.classList.toggle('shift', e.shiftKey);  // (Shift held = about to mark a stretch: the quick buttons step aside)
    if ((e.target as HTMLElement).closest('.ltl-qn, .ltl-qp')) return;  // (on the buttons: the line stays - never stopPropagation here, it would cut a playhead drag)
    if (st.lock != null && x >= st.lock - 10 && x <= st.lock + 250) return;  // (the three buttons right of the line)
    if (st.lock != null) { st.lock = null; tr.classList.remove('qn-lock'); }
    qnAt.current = Math.max(0, Math.min(total - 1, Math.round((x / pps) * fps)));
    tr.style.setProperty('--qx', `${px(qnAt.current)}px`);
    clearTimeout(st.t);
    st.t = setTimeout(() => { st.lock = px(qnAt.current); tr.classList.add('qn-lock'); }, 160);
  };
  const qnLeave = (e: React.MouseEvent) => { const st = qn.current; clearTimeout(st.t); st.lock = null; (e.currentTarget as HTMLElement).classList.remove('qn-lock', 'shift'); };
  // a range note (his ask, 2026-11-10: "dragging the mouse ... mark a range and say something on it"): Shift+drag on
  // the ruler (a plain drag there still moves the playhead), or press the ruler's note button and drag along it. The
  // stretch shows while the mouse moves; letting go opens the note for it (a tiny drag = the plain click)
  const [rangeDraft, setRangeDraft] = useState<{ a: number; b: number } | null>(null);
  useEffect(() => {  // (Shift pressed / let go: the quick buttons step aside at once, not only on the next mouse move)
    const k = (e: KeyboardEvent) => { if (e.key === 'Shift') document.querySelector('.ltl-ruler .ltl-track')?.classList.toggle('shift', e.type === 'keydown'); };
    addEventListener('keydown', k); addEventListener('keyup', k);
    return () => { removeEventListener('keydown', k); removeEventListener('keyup', k); };
  }, []);
  const rangeDragged = useRef(false);
  const markRange = (e: React.MouseEvent, from?: number) => {
    const tr = (e.currentTarget as HTMLElement).closest('.ltl-track') as HTMLElement;
    const fAt = (cx: number) => Math.max(0, Math.min(total, Math.round(((cx - tr.getBoundingClientRect().left) / pps) * fps)));
    const a = from ?? fAt(e.clientX), x0 = e.clientX;
    let b = a;
    rangeDragged.current = false;
    // (the viewer shows the frame under the mouse the whole way - his ask: "see the right frame ... when I started the
    // mark and when I ended it"; the quick buttons hide meanwhile)
    const mv = (m: MouseEvent) => {
      if (!rangeDragged.current && Math.abs(m.clientX - x0) < 5) return;
      if (!rangeDragged.current) { tr.classList.add('ranging'); onSeek(Math.min(total - 1, a)); }
      rangeDragged.current = true;
      b = fAt(m.clientX);
      setRangeDraft({ a, b });
      onSeek(Math.min(total - 1, b));
    };
    const up = () => {
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up);
      tr.classList.remove('ranging');
      setRangeDraft(null);
      if (rangeDragged.current && Math.abs(b - a) >= 2) onNote!(null, Math.min(a, b), Math.max(a, b));
      else if (from == null) onSeek(Math.min(total - 1, a));
    };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };
  const quickNote = (k: string, at = qnAt.current) => {
    const pr = PRESETS.find((x) => x.kind === k)!;
    saveNotes(send, [...notes, { ...newNote(at), kind: pr.kind, text: pr.text }], pr.label.toLowerCase());
  };
  const [vtip, setVtip] = useState<{ k: string; g: number } | null>(null);
  const [vhov, setVhov] = useState<string | null>(null);  // the clip whose volume line the mouse is on (its dB shows, its ▶ hides)  // a volume being dragged (its words over it)
  const clipVol = (e: React.MouseEvent, l: any, it: any) => {
    e.stopPropagation(); e.preventDefault();
    const k = `${l.id}|${it.id}`, g0 = it.gain ?? 1, d0 = Math.max(-40, dbOf(g0)), y0 = e.clientY;
    let g = g0;
    const set = (v: number, commit: boolean) => send([{ op: 'item.update', layer: l.id, id: it.id, set: { gain: v === 1 ? null : v } }], commit ? { label: 'clip volume' } : { commit: false });
    setVtip({ k, g });
    const mv = (m: MouseEvent) => {
      let d = Math.min(6.02, d0 + (y0 - m.clientY) * 0.4);
      if (Math.abs(d) < 0.6) d = 0;
      const n = d <= -40 ? 0 : +Math.min(2, 10 ** (d / 20)).toFixed(3);
      if (n === g) return;
      g = n; setVtip({ k, g }); set(g, false);
    };
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); setVtip(null); if (g !== g0) set(g, true); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };
  const rowVol = (e: React.MouseEvent, l: any) => {
    e.stopPropagation(); e.preventDefault();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect(), g0 = l.props?.volume ?? 1;
    let g = g0;
    const at = (x: number) => { let n = Math.max(0, Math.min(2, ((x - r.left) / r.width) * 2)); if (Math.abs(n - 1) < 0.04) n = 1; return +n.toFixed(3); };
    const set = (v: number, commit: boolean) => send([{ op: 'layer.update', id: l.id, props: { volume: v } }], commit ? { label: 'row volume' } : { commit: false });
    const go = (x: number) => { const n = at(x); if (n === g) return; g = n; setVtip({ k: l.id, g }); set(g, false); };
    setVtip({ k: l.id, g }); go(e.clientX);
    const mv = (m: MouseEvent) => go(m.clientX);
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); setVtip(null); if (g !== g0) set(g, true); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };
  const [edge, setEdge] = useState<{ layer: string; item: string; side: 'l' | 'r'; total: number; f0?: number } | null>(null);
  const [typing, setTyping] = useState<string | null>(null);
  const burst = useRef<{ key: string; t: ReturnType<typeof trimmer>; d: number; timer: number } | null>(null);
  const edgeItem = edge && project.layers.find((l: any) => l.id === edge.layer)?.items?.find((i: any) => i.id === edge.item);
  // is the picked edge a join (the clip stuck to the next / the one before)? - the card says what a nudge will do
  const joined = (() => {
    if (!edge || !edgeItem) return false;
    const l = project.layers.find((x: any) => x.id === edge.layer), lane = [...(l?.items || [])].sort((a: any, b: any) => a.from - b.from), k = lane.indexOf(edgeItem);
    return edge.side === 'r' ? !!lane[k + 1] && Math.abs(lane[k + 1].from - (edgeItem.from + edgeItem.dur)) <= 1 : !!lane[k - 1] && Math.abs(lane[k - 1].from + lane[k - 1].dur - edgeItem.from) <= 1;
  })();
  const flushNudge = () => {
    const b = burst.current; if (!b) return;
    burst.current = null; clearTimeout(b.timer);
    b.t.commit(b.d, 'nudge');
  };
  useEffect(() => () => flushNudge(), []);
  // the picked edge goes when its clip isn't picked any more, or is gone
  useEffect(() => {
    if (edge && (!edgeItem || sel?.layer !== edge.layer || sel?.item !== edge.item)) { flushNudge(); setEdge(null); setTyping(null); }
  }, [sel?.layer, sel?.item, !!edgeItem]);
  const edgeAt = (it: any, side: 'l' | 'r') => (side === 'l' ? it.from : it.from + it.dur);
  const toMs = (f: number) => Math.round((f / fps) * 1000);
  const nudge = (dFrames: number) => {
    if (!edge || !edgeItem || !dFrames) return;
    const l = project.layers.find((x: any) => x.id === edge.layer);
    if (!l || l.locked) return;
    const key = `${edge.layer}|${edge.item}|${edge.side}`;
    if (burst.current && burst.current.key !== key) flushNudge();
    const b = burst.current || (burst.current = { key, t: trimmer(l, edgeItem, edge.side, true), d: 0, timer: 0 });
    const was = b.t.moved(b.d), now = b.t.moved(b.d + dFrames);  // (stops at the take's ends)
    if (now === was) return;
    b.d = now;
    const ops = b.t.preview(b.d);
    clearTimeout(b.timer); b.timer = window.setTimeout(flushNudge, 600);
    setEdge({ ...edge, total: edge.total + (now - was), f0: edge.f0 ?? (edge.side === 'l' ? b.t.it.from : b.t.it.from + b.t.it.dur) });
    // the picture shows the new cut: its first frame (a start) or its last (an end) - where the preview put it (in a
    // continuous cut a start stays and the rest closes up)
    const s = { ...b.t.it, ...(ops.find((o: any) => o.layer === edge.layer && o.id === edge.item)?.set || {}) };
    onSeek(edge.side === 'l' ? s.from : s.from + s.dur - 1);
  };
  // Tab / Shift+Tab: the next / previous cut on the same lane (a join: the end of one, then the start of the next)
  const walk = (dir: 1 | -1) => {
    if (!edge) return;
    const l = project.layers.find((x: any) => x.id === edge.layer); if (!l) return;
    const all = (l.items || []).flatMap((it: any) => [{ it, side: 'l' as const, f: it.from, o: 1 }, { it, side: 'r' as const, f: it.from + it.dur, o: 0 }])
      .sort((a: any, b: any) => a.f - b.f || a.o - b.o);
    const i = all.findIndex((x: any) => x.it.id === edge.item && x.side === edge.side);
    const n = all[i + dir]; if (!n) return;
    flushNudge(); setTyping(null);
    onSel({ layer: l.id, item: n.it.id });
    setEdge({ layer: l.id, item: n.it.id, side: n.side, total: 0 });
    onSeek(n.side === 'l' ? n.f : n.f - 1);
  };
  // typed ms -> whole frames (less than a frame: one frame that way)
  const typedFrames = (s: string) => {
    const ms = parseFloat(s.replace(/[^\d.+-]/g, '').replace(/^\+/, ''));
    if (!Number.isFinite(ms) || !ms) return 0;
    return Math.round((ms / 1000) * fps) || Math.sign(ms);
  };
  const applyTyped = (s: string) => { setTyping(null); nudge(typedFrames(s)); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      // (an undo / redo: the card's count starts again from where the edge is now)
      if (edge && (e.ctrlKey || e.metaKey) && /^[zy]$/i.test(e.key)) { flushNudge(); setEdge({ ...edge, total: 0, f0: undefined }); return; }
      const tag0 = (e.target as HTMLElement).tagName;
      const typingBox = tag0 === 'INPUT' || tag0 === 'TEXTAREA' || tag0 === 'SELECT';
      if (!typingBox && (e.ctrlKey || e.metaKey) && !e.altKey && e.code === 'KeyK') {  // the clip under the mouse cut there; else the picked one at the playhead
        e.preventDefault();
        const h = hov.current, hl = h?.layer && project.layers.find((x: any) => x.id === h.layer), hi = hl && (hl.items || []).find((i: any) => i.id === h!.item);
        if (hl && hi && hl.kind !== 'view') cutAt(hl, hi, h!.f); else splitHere();
        return;
      }
      if (!typingBox && hov.current && onNote && !edge && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === '+' || e.code === 'NumpadAdd')) {
        e.preventDefault(); onNote(null, hov.current.f); return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.code === 'KeyC' || e.code === 'KeyV') && tag0 !== 'INPUT' && tag0 !== 'TEXTAREA' && tag0 !== 'SELECT' && !window.getSelection()?.toString()) {
        const sl = sel && project.layers.find((x: any) => x.id === sel.layer), si = sl && sel!.item && (sl.items || []).find((i: any) => i.id === sel!.item);
        if (e.code === 'KeyC' && sl && si && sl.kind !== 'view') { e.preventDefault(); copyClip(sl, si); return; }
        if (e.code === 'KeyV' && CLIP) { e.preventDefault(); pasteClip(sl && sl.kind !== 'view' ? sl : null, frame); return; }
      }
      if (e.code === 'KeyS' && !e.ctrlKey && !e.metaKey && !e.altKey && tag0 !== 'INPUT' && tag0 !== 'TEXTAREA' && tag0 !== 'SELECT') { e.preventDefault(); splitHere(); return; }
      if (choose && e.key === 'Escape') { setChoose(null); return; }
      if (!edge || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // (by the key's place, not its letter: , and . are ת and ץ on his Hebrew keyboard)
      if (e.code === 'Comma' || e.code === 'Period') { e.preventDefault(); nudge((e.code === 'Comma' ? -1 : 1) * (e.shiftKey ? 3 : 1)); }
      else if (e.key === 'Tab') { e.preventDefault(); walk(e.shiftKey ? -1 : 1); }
      else if (/^[0-9+\-]$/.test(e.key)) { e.preventDefault(); setTyping(e.key); }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  });

  const step = pps >= 120 ? 1 : pps >= 50 ? 2 : pps >= 20 ? 5 : 10;
  const ticks = [];
  for (let s = 0; s <= total / fps; s += step) ticks.push(s);
  const toggle = (l: any, key: 'hidden' | 'muted') => send([{ op: 'layer.update', id: l.id, set: { [key]: !l[key] } }], { label: key });
  // the whole layer (its name's trash, or Delete with the layer picked) - asked once; Ctrl+Z brings it back
  const removeLayer = async (l: any) => {
    const n = l.items?.length || 0;
    if (!(await ask({ title: `Delete the layer "${l.name || l.id}"?`, text: `${n ? `${n} clip${n === 1 ? '' : 's'} go${n === 1 ? 'es' : ''} with it. ` : ''}Ctrl+Z brings it back.`, ok: 'Delete' }))) return;
    send([{ op: 'layer.remove', id: l.id }], { label: 'delete layer' });
    onSel(null);
  };
  // End here: the video's length = the playhead; every item past it goes, one across it is cut there. "pin": "end"
  // items (an end card) move to the new end and "span" ones across the cut end there by themselves (ops.js repin); a
  // "span" one that starts after the cut goes like the rest
  const endHere = () => {
    const f = Math.round(frame);
    if (f < 1 || f >= total) return;
    const ops: any[] = [{ op: 'project', set: { duration: f } }];
    for (const l of project.layers) for (const it of l.items || []) {
      if (it.pin === 'end' || (pinned(it, total) && it.from < f)) continue;
      if (it.from >= f) ops.push({ op: 'item.remove', layer: l.id, id: it.id });
      else if (it.from + it.dur > f) ops.push({ op: 'item.update', layer: l.id, id: it.id, set: { dur: f - it.from } });
    }
    send(ops, { label: 'end here' });
  };
  // the end's handle on the ruler: drag the video's length left / right - live, one undoable change; nothing is
  // deleted (what runs past the end just isn't in the video); "pin" items follow (ops.js repin)
  const dragEnd = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    const x0 = e.clientX, t0 = total;
    let last = t0;
    const at = (m: MouseEvent) => Math.max(fps, Math.round(t0 + ((m.clientX - x0) / pps) * fps));
    const mv = (m: MouseEvent) => { const f = at(m); if (f === last) return; last = f; send([{ op: 'project', set: { duration: f } }], { commit: false }); };
    const up = () => {
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up); document.body.style.cursor = '';
      if (last === t0) { send([], { commit: false }); return; }
      send([{ op: 'project', set: { duration: last } }], { label: 'video length' });
    };
    document.body.style.cursor = 'ew-resize';
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };
  // drag a layer by its name up / down: a line shows where it lands; on top in the list = drawn on top. Ctrl+Z undoes
  const [lmove, setLmove] = useState<{ id: string; over?: string; below?: boolean } | null>(null);
  const lmoved = useRef(false);  // (a drag isn't also a click)
  const startLayerMove = (e: React.MouseEvent, l: any) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    const y0 = e.clientY;
    let on = false, at: { over?: string; below?: boolean } = {};
    lmoved.current = false;
    const mv = (ev: MouseEvent) => {
      if (!on && Math.abs(ev.clientY - y0) < 5) return;
      on = true; lmoved.current = true; document.body.style.cursor = 'grabbing';
      const row = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest('[data-lane]') as HTMLElement | null;
      const over = row?.dataset.lane;
      if (!row || !over || over === l.id) at = {};
      else { const r = row.getBoundingClientRect(); at = { over, below: ev.clientY > r.top + r.height / 2 }; }
      setLmove({ id: l.id, ...at });
    };
    const up = () => {
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up);
      document.body.style.cursor = '';
      setLmove(null);
      if (!on || !at.over) return;
      const rest = project.layers.filter((x: any) => x.id !== l.id);
      const t = rest.findIndex((x: any) => x.id === at.over);
      if (t < 0) return;
      const index = at.below ? t : t + 1;  // (the list is top first; the project's layers bottom first)
      if (index !== project.layers.indexOf(l)) send([{ op: 'layer.move', id: l.id, index }], { label: 'move layer' });
    };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };

  // the picked edge's card (from three OpenAI concepts drawn on the real timeline, 2026-11-02): above the lane (below
  // it near the top), what the nudge did + where the edge is; the keys only until the first nudge (quiet after); typing
  // says what it becomes in whole frames; "Play only this clip" here, off the clip. The ghost = what moved.
  const [cardAt, setCardAt] = useState<{ below: boolean; align: 'c' | 'l' | 'r' }>({ below: false, align: 'c' });
  useLayoutEffect(() => {
    const el = lanes.current; if (!el || !edge || !edgeItem) return;
    const place = () => {
      const lane = el.querySelector(`[data-lane="${CSS.escape(edge.layer)}"]`) as HTMLElement | null; if (!lane) return;
      const x = px(edgeAt(edgeItem, edge.side)) - el.scrollLeft, view = el.clientWidth - NW;
      const n = { below: lane.offsetTop - el.scrollTop < 150, align: (x < 150 ? 'l' : x > view - 150 ? 'r' : 'c') as 'c' | 'l' | 'r' };
      setCardAt((o) => (o.below === n.below && o.align === n.align ? o : n));
    };
    place();
    el.addEventListener('scroll', place);
    return () => el.removeEventListener('scroll', place);
  }, [edge?.layer, edge?.item, edge?.side, edgeItem?.from, edgeItem?.dur, pps]);
  const edgeCard = () => {
    const f = edgeAt(edgeItem, edge!.side), t = edge!.total, sign = (n: number) => (n > 0 ? '+' : '−');
    const g0 = edge!.f0 != null && t ? Math.min(edge!.f0, f) : null, g1 = edge!.f0 != null && t ? Math.max(edge!.f0, f) : null;
    const typed = typing != null ? typedFrames(typing) : 0;
    const on = soloKey === `${edge!.layer}|${edge!.item}`;
    const fr = (n: number) => `${Math.abs(n)} frame${Math.abs(n) === 1 ? '' : 's'}`;
    return <>
      {g0 != null && <div className="edge-ghost" style={{ left: px(g0), width: Math.max(2, px(g1! - g0)) }} />}
      <div className={`edge-card ${cardAt.below ? 'below' : ''} al-${cardAt.align}`} style={{ left: px(f) }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="ec-top">
          {t ? <b>{sign(t)}{toMs(Math.abs(t))} ms</b> : <b>{edge!.side === 'l' ? 'Start' : 'End'}</b>}
          <span>{t ? `${fr(t)} · ${(edge!.side === 'l') === t > 0 ? 'shorter' : 'longer'}` : `at ${(f / fps).toFixed(2)} s`}</span>
          <span className="ec-what">{edge!.layer === view?.id ? 'who is seen changes here' : joined ? 'the clips after it follow' : 'just this clip'}</span>
        </div>
        {typing != null ? <div className="ec-type">
          <input autoFocus value={typing} size={6} spellCheck={false} onChange={(e) => setTyping(e.target.value)}
            onFocus={(e) => { const v = e.currentTarget.value.length; e.currentTarget.setSelectionRange(v, v); }}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') applyTyped(e.currentTarget.value); else if (e.key === 'Escape') setTyping(null); }}
            onBlur={() => setTyping(null)} />
          <span>ms</span>
          {typed !== 0 && <span className="ec-eq">= {sign(typed)}{toMs(Math.abs(typed))} ms ({fr(typed)})</span>}
          <kbd>Enter</kbd>
        </div> : t === 0 ? <div className="ec-keys">
          <span><kbd>,</kbd><kbd>.</kbd> one frame</span><span><kbd>Shift</kbd> 3 frames</span><span>or type -80</span>
        </div> : null}
        {onSolo && <button className={`ec-play ${on ? 'on' : ''}`} onClick={() => onSolo({ layer: edge!.layer, item: edge!.item })}>
          {on ? <svg width="9" height="9" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" rx="1" fill="currentColor" /></svg>
            : <svg width="9" height="9" viewBox="0 0 10 10"><path d="M2 1l7 4-7 4z" fill="currentColor" /></svg>}
          {on ? 'Stop' : 'Play only this clip'}<kbd>Shift+Space</kbd></button>}
      </div>
    </>;
  };

  const ctxL = ctx && project.layers.find((x: any) => x.id === ctx.layer);
  const ctxI = ctxL && ctx!.item ? (ctxL.items || []).find((i: any) => i.id === ctx!.item) : null;
  return (
    <div className="tl">
      {ctx && ctxL && <div className="ctxm" style={{ left: ctx.x, top: ctx.y }} onContextMenu={(e) => e.preventDefault()}>
        {ctxI && <button onClick={() => { copyClip(ctxL, ctxI); setCtx(null); }}>Copy<kbd>Ctrl+C</kbd></button>}
        <button disabled={!canPaste(ctxL)} onClick={() => { pasteClip(ctxL, ctx.at); setCtx(null); }}
          title={CLIP && CLIP.kind !== ctxL.kind ? 'The copied clip goes on its own kind of row - here it lands on the row it came from' : ''}>Paste here · {fmtT(ctx.at / fps)}<kbd>Ctrl+V</kbd></button>
        {ctxI && <button onClick={() => { send(removeOps(project, ctxL, ctxI), { label: 'delete' }); setCtx(null); }}>Delete<kbd>Del</kbd></button>}
        {ctxI && groupOf(project, ctxL, ctxI).length > 0 && <button onClick={() => { send(removeOps(project, ctxL, ctxI, true), { label: 'delete' }); setCtx(null); }}
          title="Only this piece - the rest of its group stays">Delete this piece only<kbd>Alt+Del</kbd></button>}
      </div>}
      <div className="tl-bar">
        <button className="btn ghost icon" disabled={!canUndo} title="Undo (Ctrl+Z)" onClick={() => { if (edge) setEdge({ ...edge, total: 0, f0: undefined }); onUndo(); }}>↶</button>
        <button className="btn ghost icon" disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" onClick={() => { if (edge) setEdge({ ...edge, total: 0, f0: undefined }); onRedo(); }}>↷</button>
        <div className="vsep" />
        <span className="chip">{project.layers.length} layers · {project.layers.reduce((n: number, l: any) => n + (l.items?.length || 0), 0)} items</span>
        <div className="vsep" />
        <button className="btn" style={{ height: 26, padding: '0 9px', fontSize: 12 }} disabled={frame < 1 || frame >= total - 1} onClick={endHere}
          title="The video ends at the playhead - everything after it goes, in every layer (an end card pinned to the end moves with it). Ctrl+Z undoes">End here ⇥</button>
        {onNote && <button className="btn" style={{ height: 26, padding: '0 9px', fontSize: 12 }} onClick={() => onNote(null)}
          title="A note for Claude at the playhead: what's wrong here and what to fix - then tell Claude &quot;fix notes&quot; (N)">+ Note{notes.some((n) => !n.done) ? ` · ${notes.filter((n) => !n.done).length} open` : ''}</button>}
        {onNoteView && notes.length > 0 && <select className="field tl-notes" value={noteView} onChange={(e) => onNoteView(e.target.value as NoteView)}
          title="Which notes the timeline shows: open = for Claude, fixed = Claude fixed them on the last run (green), checked = you looked (hidden)">
          {NOTE_VIEWS.map(([v, label]) => <option key={v} value={v}>{label} ({notes.filter((n) => inView(v, n)).length})</option>)}</select>}
        {(() => {
          const fixed = notes.filter((n) => noteState(n) === 'fixed').sort((a, b) => a.at - b.at);
          if (!fixed.length || !onNote) return null;
          return <>
            <button className="btn" style={{ height: 26, padding: '0 9px', fontSize: 12, color: 'var(--ok)' }} onClick={() => onNote(fixed[0])}
              title="Go through what Claude fixed: each fixed note opens at its place - Looks good hides it and opens the next">Check fixed ({fixed.length}) ›</button>
            <button className="btn ghost" style={{ height: 26, padding: '0 9px', fontSize: 12 }} title="Every fixed note is checked - they all hide (Ctrl+Z undoes)"
              onClick={() => saveNotes(send, notes.map((n) => (noteState(n) === 'fixed' ? { ...n, seen: true } : n)), 'fixed notes checked')}>All look good ✓</button>
          </>;
        })()}
        <div className="vsep" />
        <Find project={project} fps={fps} onGo={(h) => { onSel({ layer: h.layer, item: h.item }); onSeek(h.at); }} />
        <div className="grow" />
        <button className="btn ghost" style={{ height: 26, padding: '0 9px', fontSize: 12 }} title="The whole video in view"
          onClick={() => { const w = (lanes.current?.clientWidth || 1000) - NW; setPps(Math.max(8, (w - 40) / (total / fps))); }}>Fit</button>
        <span style={{ color: 'var(--faint)', fontSize: 12 }}>Zoom</span>
        <input type="range" min={8} max={400} value={pps} onChange={(e) => setPps(+e.target.value)} />
      </div>
      <div className="ltl" ref={lanes} style={{ ['--th' as any]: `${TH}px`, ['--nw' as any]: `${NW}px` }}
        onMouseMove={hoverMove} onMouseLeave={() => { hov.current = null; }}>
        <div className="ltl-in" style={{ width: NW + width }}>
          <div className="ltl-row ltl-ruler">
            <div className="ltl-name" />
            <div className="ltl-track" style={{ width }} onMouseDown={(e) => (onNote && e.shiftKey ? (e.preventDefault(), markRange(e)) : seekAt(e))} onMouseMove={onNote ? qnMove : undefined} onMouseLeave={onNote ? qnLeave : undefined}
              title={onNote ? 'Click / drag = move the playhead · Shift+drag = mark a stretch and write a note on it' : undefined}>
              {ticks.map((s) => <div key={s} className="tick" style={{ left: s * pps }}><span>{fmtT(s).replace(/\.\d$/, '')}</span></div>)}
              {onNote && <NotePins notes={notes} view={noteView} px={px} pps={pps} fps={fps} total={total} onOpen={onNote} send={send} onSeek={onSeek} />}
              {onNote && <div className="ltl-qn" onMouseDown={(e) => e.stopPropagation()}>
                <button title="A note for Claude right here (at the line) - write what to fix. Press and drag along the ruler = a note on that stretch"
                  onMouseDown={(e) => markRange(e, qnAt.current)} onClick={() => { if (!rangeDragged.current) onNote(null, qnAt.current); rangeDragged.current = false; }}>{QN_IC.note}<span>{QN_WORD.note}</span></button>
                {PRESETS.map((pr) => <button key={pr.kind} title={`${pr.label} - a note for Claude right here (at the line)`}
                  onClick={() => quickNote(pr.kind)}>{QN_IC[pr.kind]}<span>{QN_WORD[pr.kind]}</span></button>)}
              </div>}
              {onNote && !playing && <div className="ltl-qp" style={{ left: px(frame) }} onMouseDown={(e) => e.stopPropagation()}>
                <button title="A note for Claude here, at the playhead - write what to fix. Press and drag along the ruler = a note on that stretch"
                  onMouseDown={(e) => markRange(e, frame)} onClick={() => { if (!rangeDragged.current) onNote(null); rangeDragged.current = false; }}>{QN_IC.note}<span>{QN_WORD.note}</span></button>
                {PRESETS.map((pr) => <button key={pr.kind} title={`${pr.label} - a note for Claude here, at the playhead`}
                  onClick={() => quickNote(pr.kind, frame)}>{QN_IC[pr.kind]}<span>{QN_WORD[pr.kind]}</span></button>)}
              </div>}
              {rangeDraft && <div className="ltl-nband draft" style={{ left: px(Math.min(rangeDraft.a, rangeDraft.b)), width: Math.max(2, Math.abs(px(rangeDraft.b) - px(rangeDraft.a))) }}>
                <span>{fmtT(Math.min(rangeDraft.a, rangeDraft.b) / fps / (+project.speed || 1))} – {fmtT(Math.max(rangeDraft.a, rangeDraft.b) / fps / (+project.speed || 1))}</span></div>}
              <div className="ltl-endh" style={{ left: px(total) }} onMouseDown={dragEnd} title="The video's end - drag it left or right (nothing is deleted; Ctrl+Z undoes)">End</div>
            </div>
          </div>
          {view && (() => {
            const list = [...(view.items || [])].sort((a: any, b: any) => a.from - b.from);
            const who = (id: string) => chars.find((c) => c.id === id);
            return <div data-lane={view.id} className={`ltl-row ltl-lay ltl-view ${sel?.layer === view.id ? 'sel' : ''}`}>
              <div className="ltl-name" onClick={() => onSel({ layer: view.id })} title="Who is on screen - drag the line between two blocks to change who is seen there (nothing else moves); click a block to pick who is seen; S = a new cut at the playhead">
                <span className="dot" style={{ background: KIND_COLOR.view }} /><span className="nm">What we see</span>
                <button className="btn ghost icon" style={{ width: 22, height: 22 }} title="A new cut at the playhead (S)" onClick={(e) => { e.stopPropagation(); splitHere(); }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M8.2 8.2 20 20M8.2 15.8 20 4" /></svg></button>
              </div>
              <div className="ltl-track" style={{ width }} onMouseDown={(e) => { if (e.target === e.currentTarget) { setChoose(null); onSel({ layer: view.id }); seekAt(e); } }}>
                {list.map((s: any, k: number) => {
                  const c = who(s.show), isSel = sel?.layer === view.id && sel.item === s.id, w = px(s.dur);
                  const ed = isSel && edge?.layer === view.id && edge.item === s.id ? edge.side : null;
                  const next = list[k + 1], cut = next && Math.abs(next.from - (s.from + s.dur)) <= 1;
                  return <React.Fragment key={s.id}>
                    <div data-layer={view.id} data-item={s.id} className={`blk vblk ${isSel ? 'sel' : ''} ${ed ? 'edge-' + ed : ''}`}
                      style={{ left: px(s.from), width: Math.max(3, w), background: c?.color || '#555', top: 4, bottom: 4, padding: w > 30 ? '0 6px' : 0, color: '#fff', fontSize: 11 }}
                      title={`${c?.name || s.show} is seen - click: who is seen here · the line between two blocks: drag it`}
                      onMouseDown={(e) => {
                        e.stopPropagation(); e.preventDefault(); flushNudge();
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect(), x = e.clientX - r.left;
                        const side = w >= 24 && x <= 7 ? 'l' : w >= 24 && x >= r.width - 7 ? 'r' : null;
                        onSel({ layer: view.id, item: s.id }); setTyping(null);
                        setEdge(side ? { layer: view.id, item: s.id, side, total: 0 } : null);
                        if (side) { setChoose(null); onSeek(side === 'l' ? s.from : s.from + s.dur - 1); } else setChoose(choose === s.id ? null : s.id);
                      }}>
                      {noPicture(project, s).map(([a, b], j) => <i key={j} className="vnone" style={{ left: px(a - s.from), width: Math.max(2, px(b - a)) }} title="Nothing of this character here - no clip on the row" />)}
                      {w > 24 && <span className="he vname">{c?.name || s.show}</span>}
                      {choose === s.id && <div className="vpick" onMouseDown={(e) => e.stopPropagation()}>
                        <div className="vpick-h">Who is seen here</div>
                        {chars.map((o) => <button key={o.id} className={o.id === s.show ? 'on' : ''} onClick={() => {
                          setChoose(null);
                          if (o.id !== s.show) send([{ op: 'item.update', layer: view.id, id: s.id, set: { show: o.id } }], { label: 'who is seen' });
                        }}><i style={{ background: o.color }} />{o.name}</button>)}
                      </div>}
                    </div>
                    {cut && <div className="vcut" style={{ left: px(s.from + s.dur) }} onMouseDown={(e) => startCut(e, s)} title="Drag: who is seen changes here (it snaps to the start / end of a voice and to the playhead)" />}
                  </React.Fragment>;
                })}
                {cutTip && <span className="blk-tip" style={{ left: cutTip.x, bottom: 'auto', top: -22 }}>{cutTip.text}</span>}
                {edge?.layer === view.id && edgeItem && !drag && edgeCard()}
              </div>
            </div>;
          })()}
          {groups.map((g) => (
            <React.Fragment key={g.name}>
              <div className="ltl-row ltl-grp">
                <div className="ltl-name" onClick={() => setClosed({ ...closed, [g.name]: !closed[g.name] })}>
                  <span className="caret">{closed[g.name] ? '▸' : '▾'}</span>
                  {(() => { const c = g.layers.map((l) => colors[l.id]).find(Boolean); return c ? <span className="gdot" style={{ background: c }} /> : null; })()}
                  <span className="nm he" dir="auto" style={{ textAlign: 'left', unicodeBidi: 'plaintext' }}>{g.name}</span>
                </div>
                <div className="ltl-track" style={{ width }} onMouseDown={seekAt} />
              </div>
              {!closed[g.name] && g.layers.map((l) => (
                <div key={l.id} data-lane={l.id} className={`ltl-row ltl-lay ${l.kind === 'audio' ? 'snd' : ''} ${sel?.layer === l.id ? 'sel' : ''} ${lmove?.id === l.id ? 'lmoving' : ''} ${lmove?.over === l.id ? (lmove.below ? 'drop-below' : 'drop-above') : ''} ${drag?.to === l.id ? 'drop-to' : ''}`}>
                  <div className={`ltl-name ${vtip?.k === l.id ? 'vol-on' : ''}`} style={{ opacity: l.hidden ? 0.5 : 1, ...(colors[l.id] ? { boxShadow: `inset 3px 0 0 ${colors[l.id]}` } : {}) }} onMouseDown={(e) => startLayerMove(e, l)}
                    onClick={() => { if (lmoved.current) { lmoved.current = false; return; } onSel({ layer: l.id }); }} title={`${KIND_LABEL[l.kind]} · ${l.id} - drag it up or down to move the layer`}>
                    <span className="dot" style={{ background: KIND_COLOR[l.kind] }} />
                    <span className="nm" dir="auto">{l.name || l.id}</span>
                    {l.kind === 'audio' && <span className={`ltl-db ${(l.props?.volume ?? 1) !== 1 ? 'vset' : ''}`}>{dbTxt(vtip?.k === l.id ? vtip.g : l.props?.volume ?? 1)}</span>}
                    <button className="btn ghost icon ltl-del" style={{ width: 22, height: 22 }} title="Delete this layer (Ctrl+Z brings it back)"
                      onClick={(e) => { e.stopPropagation(); removeLayer(l); }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg></button>
                    {l.kind === 'audio'
                      ? <button className="btn ghost icon" style={{ width: 22, height: 22 }} title={l.muted ? 'Sound on' : 'Mute'} onClick={(e) => { e.stopPropagation(); toggle(l, 'muted'); }}><SpkIc off={l.muted} /></button>
                      : <button className="btn ghost icon" style={{ width: 22, height: 22 }} title={l.hidden ? 'Show' : 'Hide'} onClick={(e) => { e.stopPropagation(); toggle(l, 'hidden'); }}><EyeIc off={l.hidden} /></button>}
                    {l.kind === 'audio' && <div className="ltl-vol" title="Volume of the whole row - drag left / right · double-click: back to 0 dB"
                      onMouseDown={(e) => rowVol(e, l)} onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => { e.stopPropagation(); send([{ op: 'layer.update', id: l.id, props: { volume: 1 } }], { label: 'row volume' }); }}>
                      <i style={{ width: `${(Math.min(2, (vtip?.k === l.id ? vtip.g : l.props?.volume) ?? 1) / 2) * 100}%` }} />
                    </div>}
                  </div>
                  <div className="ltl-track" style={{ width, opacity: l.hidden || l.muted ? 0.45 : 1 }}
                    onMouseDown={(e) => { if (e.target === e.currentTarget && e.button === 0) { onSel({ layer: l.id }); seekAt(e); } }}
                    onContextMenu={(e) => { if (e.target !== e.currentTarget || l.kind === 'view') return; e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, layer: l.id, at: frameAt(e) }); }}>
                    {l.kind === 'backdrop' && (() => {
                      const t = project.layers.find((x: any) => x.id === l.props?.target);
                      const span = t?.items?.length ? [Math.min(...t.items.map((i: any) => i.from)), Math.max(...t.items.map((i: any) => i.from + i.dur))] : [0, total];
                      return <div className={`blk ${sel?.layer === l.id ? 'sel' : ''}`} style={{ left: px(span[0]), width: Math.max(4, px(span[1] - span[0])), background: KIND_COLOR.backdrop }}
                        onMouseDown={(e) => { e.stopPropagation(); onSel({ layer: l.id }); }}>{project.assets?.[l.props?.asset]?.src?.split('/').pop() || 'no photo'}</div>;
                    })()}
                    {(l.items || []).map((it: any) => {
                      const isSel = sel?.layer === l.id && sel.item === it.id;
                      const linked = !isSel && !!it.link && it.link === selLink;  // the same line's voice / subtitle
                      const w = px(it.dur);
                      const ed = isSel && edge?.layer === l.id && edge.item === it.id ? edge.side : null;  // its picked edge
                      const tint = colors[l.id], off = tint ? soundOffset(project, l, it) : null;
                      return (
                        <div key={it.id} data-layer={l.id} data-item={it.id} className={`blk ${l.kind === 'audio' ? 'snd' : ''} ${isSel ? 'sel' : ''} ${linked ? 'linked' : ''} ${drag?.item === it.id && drag.layer === l.id ? 'dragging' : ''} ${ed ? 'edge-' + ed : ''}`}
                          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onSel({ layer: l.id, item: it.id }); setCtx({ x: e.clientX, y: e.clientY, layer: l.id, item: it.id, at: frameAt(e) }); }}
                          style={{ ...(drag?.to && drag.item === it.id && drag.layer === l.id ? { transform: `translateY(${drag.dy}px)`, zIndex: 5, pointerEvents: 'none' } : {}), left: px(it.from), width: Math.max(3, w), background: tint ? (l.kind === 'audio' ? `color-mix(in srgb, ${tint} 55%, #1d1c1b)` : tint) : KIND_COLOR[l.kind], opacity: it.hidden ? 0.4 : 1, top: 4, bottom: 4, padding: w > 30 ? '0 6px' : 0,
                            color: l.kind === 'text' ? '#2a2000' : '#fff', fontSize: 11 }}
                          title={isSel ? `${blockText(l, it, project)} - drag it, or its edges (click an edge, then , . or type ±ms)` : `${blockText(l, it, project)} - click to pick it (near its start / end: that edge)`}
                          onMouseMove={onOpen ? (e) => { const el = e.currentTarget; el.style.setProperty('--mx', `${e.clientX - el.getBoundingClientRect().left}px`); } : undefined}
                          onMouseDown={(e) => {
                            if ((e.ctrlKey || e.metaKey) && e.button === 0) { e.stopPropagation(); e.preventDefault(); flushNudge(); cutAt(l, it, frameAt(e)); return; }  // (the scissors)
                            if (isSel) { setEdge(null); setTyping(null); startDrag(e, l, it, 'm'); return; }
                            e.stopPropagation(); e.preventDefault(); flushNudge();
                            onSel({ layer: l.id, item: it.id });
                            // a click right at its start / end picks that edge too (ready for , . or a typed ±ms)
                            const r = (e.currentTarget as HTMLElement).getBoundingClientRect(), x = e.clientX - r.left;
                            const side = w >= 24 && x <= 7 ? 'l' : w >= 24 && x >= r.width - 7 ? 'r' : null;
                            setEdge(side ? { layer: l.id, item: it.id, side, total: 0 } : null); setTyping(null);
                            if (side) onSeek(side === 'l' ? it.from : it.from + it.dur - 1);
                          }}>
                          {w > 24 && <span className="he" style={{ overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none' }}>{blockText(l, it, project)}</span>}
                          {isSel && <><div className="hd l" title="Drag: where it starts · click: pick it, then , . or type ±ms" onMouseDown={(e) => startDrag(e, l, it, 'l')} /><div className="hd r" title="Drag: where it ends · click: pick it, then , . or type ±ms" onMouseDown={(e) => startDrag(e, l, it, 'r')} /></>}
                          {l.kind === 'audio' && w > 90 && (it.gain ?? 1) !== 1 && <span className="blk-db">{dbTxt(it.gain)}</span>}
                          {it.pace > 0 && w > 34 && <span className="blk-pace" title={`Its own speed: ${+it.pace}× (the project: ${+(project.speed || 1)}×)`}>{+it.pace}×</span>}
                          {off != null && w > 60 && <span className="blk-off" title="This voice is moved from its own picture - heard before (−) / after (+) we see it">sound {off < 0 ? '−' : '+'}{Math.abs(off).toFixed(2)} s</span>}
                          {l.kind === 'audio' && !drag && w > 10 && (
                            <div className={`blk-vol ${vtip?.k === `${l.id}|${it.id}` ? 'on' : ''}`} style={{ top: `${lineAt(it.gain ?? 1) * 100}%` }}
                              title="Volume of this clip - drag up / down · double-click: back to 0 dB"
                              onMouseDown={(e) => clipVol(e, l, it)} onMouseEnter={() => setVhov(`${l.id}|${it.id}`)} onMouseLeave={() => setVhov(null)}
                              onDoubleClick={(e) => { e.stopPropagation(); send([{ op: 'item.update', layer: l.id, id: it.id, set: { gain: null } }], { label: 'clip volume' }); }}>
                              <i /></div>)}
                          {l.kind === 'audio' && w > 10 && <b className={`blk-vtip ${vtip?.k === `${l.id}|${it.id}` || vhov === `${l.id}|${it.id}` ? 'on' : ''}`}>{dbTxt(vtip?.k === `${l.id}|${it.id}` ? vtip.g : it.gain ?? 1)}</b>}
                          {onOpen && !drag && !ed && !vtip && vhov !== `${l.id}|${it.id}` && opens(l, it, project) && (
                            <button className="blk-open" title={`Open just this ${OPEN_WORD[l.kind] || 'clip'} - its own file, without the other layers`}
                              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }} onClick={(e) => { e.stopPropagation(); onOpen({ layer: l.id, item: it.id }); }}>
                              <svg width="9" height="9" viewBox="0 0 10 10"><path d="M2 1l7 4-7 4z" fill="currentColor" /></svg>
                            </button>)}
                          {drag && drag.item === it.id && drag.layer === l.id && drag.d !== 0 && (
                            <span className="blk-tip">{drag.side === 'l' ? 'start' : drag.side === 'r' ? 'end' : 'moved'} {drag.d > 0 ? '+' : '−'}{(Math.abs(drag.d) / fps).toFixed(2)} s</span>)}
                        </div>
                      );
                    })}
                    {edge?.layer === l.id && edgeItem && !drag && edgeCard()}
                  </div>
                </div>
              ))}
            </React.Fragment>
          ))}
          <div className="ltl-after" style={{ left: NW + px(total) }} />
          <div className="playhead" style={{ left: NW + px(frame), height: '100%' }} />
          {edge && edgeItem && !drag && <div className="edge-line" style={{ left: NW + px(edgeAt(edgeItem, edge.side)) }} />}
        </div>
      </div>
    </div>
  );
}
