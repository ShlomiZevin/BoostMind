// Everything that marks a moment on the ruler - his notes (a flag; a range note also a bar to its end), the socials' end,
// the video's end, the quick note buttons at the stopped playhead - laid out together so NOTHING covers anything else
// (his ask, 2026-11-17: "the flag where the social lives is hiding other stuff ... make it not a mess").
//   the ruler, top to bottom:  times (the ticks) | the marks row: flags + chips | the range bars, each in a free row
//   - every mark is a small chip; its words open on hover (a note's text, "Socials end · 1:45.1 ×", "End")
//   - marks that would touch become ONE chip with their count; hovering it lists them (click = open / go there)
//   - the socials' end and the video's end also keep a thin line across the ruler you can drag, grouped or not
//   - a range note's bar takes the first row where it touches no other bar (the ruler grows a row for it)
import React from 'react';
import { fmtT } from './api';
import { Note, NoteView, inView, noteState, noteDrag, noteStateWord, PinIc } from './Notes';

export const MARK_TOP = 16;   // the marks row: under the times
const BAR_TOP = 37, BAR_ROW = 5;  // the range bars: under the marks row, BAR_ROW px a row
const NOTE_W = 18, SPLIT_W = 22, END_W = 34, GROUP_W = 44, QP_W = 26, GAP = 3;

/** which row every range note's bar takes (the first where it touches no other), and how many rows */
export function barRows(notes: Note[], view: NoteView, px: (f: number) => number) {
  const ends: number[] = [], row = new Map<string, number>();
  for (const n of notes.filter((x) => x.end != null && inView(view, x)).sort((a, b) => a.at - b.at)) {
    let r = ends.findIndex((e) => px(n.at) > e + GAP);
    if (r < 0) r = Math.min(ends.length, 2);  // (a fourth bar on top of each other shares the last row)
    ends[r] = Math.max(ends[r] ?? 0, px(n.end!));
    row.set(n.id, r);
  }
  return { row, rows: ends.length };
}
/** the ruler's height: times + marks, and a row per stack of range bars */
export const rulerHeight = (rows: number) => (rows ? BAR_TOP + rows * BAR_ROW : 36);
export const barTop = (row: number) => BAR_TOP + row * BAR_ROW;

type Mark = { k: string; kind: 'note' | 'split' | 'end'; at: number; l: number; r: number; n?: Note };
type Props = {
  notes: Note[]; view: NoteView; split: number | null; total: number; width: number; fps: number; speed: number; pps: number;
  px: (f: number) => number; send: any; onOpenNote?: (n: Note) => void; onSeek: (f: number) => void;
  onSplitDown: (e: React.MouseEvent) => void; onDropSplit: () => void; onEndDown: (e: React.MouseEvent) => void;
  quick?: { at: number; node: React.ReactNode } | null;  // the note buttons at the stopped playhead (one chip, all on hover)
};

export function RulerMarks({ notes, view, split, total, width, fps, speed, pps, px, send, onOpenNote, onSeek, onSplitDown, onDropSplit, onEndDown, quick }: Props) {
  const t = (f: number) => fmtT(f / fps / (speed || 1));
  const shown = onOpenNote ? notes.filter((n) => inView(view, n)) : [];
  const down = noteDrag({ notes, pps, fps, total, onOpen: (n) => onOpenNote?.(n), send, onSeek });
  const { row } = barRows(shown, view, px);

  // the marks, left to right; those that would touch -> one group
  const marks: Mark[] = shown.map((n) => ({ k: 'n' + n.id, kind: 'note', at: n.at, l: px(n.at) - NOTE_W / 2, r: px(n.at) + NOTE_W / 2, n }));
  if (split != null) marks.push({ k: 'split', kind: 'split', at: split, l: px(split) - 1, r: px(split) + SPLIT_W });
  marks.push({ k: 'end', kind: 'end', at: total, l: px(total) - END_W, r: px(total) + 1 });
  marks.sort((a, b) => a.l - b.l || (a.kind === 'end' ? 1 : -1));
  const groups: { ms: Mark[]; l: number; r: number }[] = [];
  for (const m of marks) {
    const g = groups[groups.length - 1];
    if (g && m.l < g.r + GAP) { g.ms.push(m); g.r = Math.max(g.r, m.r, g.l + GROUP_W); } else groups.push({ ms: [m], l: m.l, r: m.r });
  }
  for (const g of groups) if (g.ms.length > 1) { g.l = Math.max(0, Math.min(g.l, width - GROUP_W)); g.r = g.l + GROUP_W; }

  // the words after the socials' end ("Only on the Shlomiverse") - only where they fit; never over a mark
  const busy = groups.map((g) => [g.l, g.r]);
  let vlab: number | null = null;
  const sg = groups.find((g) => g.ms.length === 1 && g.ms[0].kind === 'split');
  if (sg) {
    const next = groups[groups.indexOf(sg) + 1], room = (next ? next.l : px(total) - END_W) - (sg.r + 6);
    if (room >= 150) { vlab = sg.r + 6; busy.push([vlab, vlab + 140]); }
  }
  // the quick buttons at the playhead: right of it, past any mark in the way
  let qx = quick ? px(quick.at) + 4 : 0;
  if (quick) for (let i = 0; i < 40; i++) { const hit = busy.find(([l, r]) => qx < r + 2 && qx + QP_W > l - 2); if (!hit) break; qx = hit[1] + 3; }

  const tip = (n: Note) => `${noteStateWord(n)} · ${t(n.at)}${n.end != null ? ` – ${t(n.end)}` : ''}`;
  const groupRow = (m: Mark) => {
    if (m.kind === 'note') return <button key={m.k} className={noteState(m.n!)} onClick={() => onOpenNote?.(m.n!)}>
      <span className="ic"><PinIc /></span><span className="tm">{t(m.at)}{m.n!.end != null ? ` – ${t(m.n!.end)}` : ''}</span><span className="tx" dir="auto">{m.n!.text.split('\n')[0] || '(empty note)'}</span></button>;
    if (m.kind === 'split') return <button key={m.k} className="split" onClick={() => onSeek(m.at)}>
      <span className="ic">✂</span><span className="tm">{t(m.at)}</span><span className="tx">Socials end - after it only on the Shlomiverse</span>
      <b title="No socials end - one version again" onClick={(e) => { e.stopPropagation(); onDropSplit(); }}>×</b></button>;
    return <button key={m.k} className="end" onClick={() => onSeek(Math.max(0, total - 1))}><span className="ic">⇥</span><span className="tm">{t(total)}</span><span className="tx">The video's end</span></button>;
  };
  const dot = (m: Mark) => <i key={m.k} className={m.kind === 'note' ? noteState(m.n!) : m.kind} />;

  return <>
    {split != null && <>
      <div className="ltl-vband" style={{ left: px(split), width: Math.max(0, px(total) - px(split)) }} />
      <div className="ltl-split" style={{ left: px(split) }} onMouseDown={onSplitDown} title="The socials end here - drag to move it (Ctrl+Z undoes)" />
    </>}
    <div className="rmk-endline" style={{ left: px(total) }} onMouseDown={onEndDown} title="The video's end - drag it (nothing is deleted; Ctrl+Z undoes)" />
    {vlab != null && <span className="rmk-vlab" style={{ left: vlab }}>Only on the Shlomiverse</span>}

    {shown.filter((n) => n.end != null).map((n) => (
      <div key={'b' + n.id} className={`ltl-nband ${noteState(n)}`} style={{ left: px(n.at), width: Math.max(2, px(n.end!) - px(n.at)), top: barTop(row.get(n.id) || 0) }}
        onMouseDown={(e) => down(e, n)} title={`${tip(n)}: ${n.text}\n(click to open, drag to move, drag an edge to change the start / end)`}>
        <i className="l" onMouseDown={(e) => down(e, n, 'l')} /><i className="r" onMouseDown={(e) => down(e, n, 'r')} /></div>))}

    {groups.map((g) => {
      if (g.ms.length > 1) {
        const ids = g.ms.filter((m) => m.n).map((m) => m.n!.id).join(' ');
        return <div key={g.ms[0].k} className="rmk rgrp" title="" data-notes={ids} style={{ left: g.l, top: MARK_TOP }} onMouseDown={(e) => e.stopPropagation()}>
          <span className="dots">{g.ms.slice(0, 4).map(dot)}</span><b>{g.ms.length}</b>
          <div className="rmk-pop">{g.ms.map(groupRow)}<div className="hint">Close together here - zoom in to pull them apart</div></div>
        </div>;
      }
      const m = g.ms[0];
      if (m.kind === 'note') return <div key={m.k} data-note={m.n!.id} className={`ltl-note rmk ${noteState(m.n!)}`} title="" style={{ left: px(m.at), top: MARK_TOP }} onMouseDown={(e) => down(e, m.n!)}>
        <PinIc /><span className="rmk-tip" dir="auto"><em>{tip(m.n!)}</em>{m.n!.text.split('\n')[0].slice(0, 90) || '(empty note)'}{m.n!.reply ? <small>Claude: {m.n!.reply.slice(0, 90)}</small> : null}</span></div>;
      if (m.kind === 'split') return <div key={m.k} className="rmk rsplit" title="" style={{ left: px(m.at), top: MARK_TOP }} onMouseDown={onSplitDown}>
        <span className="ic">✂</span><span className="lab">Socials end · {t(m.at)}<b title="No socials end - one version again" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDropSplit(); }}>×</b></span></div>;
      return <div key={m.k} className="rmk rend" style={{ left: px(total), top: MARK_TOP }} onMouseDown={onEndDown} title="The video's end - drag it left or right (nothing is deleted; Ctrl+Z undoes)">End</div>;
    })}

    {quick && <div className="ltl-qp" style={{ left: qx, top: MARK_TOP - 1 }} onMouseDown={(e) => e.stopPropagation()}>{quick.node}</div>}
  </>;
}
