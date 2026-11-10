// Notes for Claude (his ask, 2026-10-28: "a marker I can place... a note in this place with what's the problem and
// what to fix - I just say fix notes and he does it"). A note = a moment (frame) + his words + optionally a spot on the
// picture; kept in project.json `notes` (an op like any other: saved, Ctrl+Z, kept through rebuilds, moved with what
// plays under it when a take is made longer / shorter - pipeline/project.py). A session reads them with
// `node tools/notes.mjs <ep>` and answers on the note (done + reply).
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fmtT, Send } from './api';
import './notes.css';

// end (2026-11-10, his ask: "mark a range ... start and end"): a note about a stretch - at = its start, end = its end
// (frames); none = a moment. Made by Shift+drag on the ruler (or dragging from the ruler's note button).
export type Note = { id: string; at: number; end?: number; text: string; kind?: string; x?: number; y?: number; done?: boolean; reply?: string; t?: number;
  fixed?: number; seen?: boolean };

// a note's life (his ask, 2026-11-09 - "know what was fixed on the last run, go to those places, then make them
// disappear"): open (yellow, for Claude) -> fixed (green: Claude fixed it - tools/notes.mjs done sets `fixed`; he hasn't
// looked yet) -> checked (grey, hidden: he looked - `seen`, or he ticked it himself). Older handled notes = checked.
export type NoteState = 'open' | 'fixed' | 'checked';
export const noteState = (n: Note): NoteState => (!n.done ? 'open' : n.fixed && !n.seen ? 'fixed' : 'checked');
export type NoteView = 'active' | 'open' | 'fixed' | 'all';
export const NOTE_VIEWS: [NoteView, string][] = [['active', 'Open + fixed'], ['open', 'Open'], ['fixed', 'Fixed - to check'], ['all', 'All (+ checked)']];
export const inView = (v: NoteView, n: Note) => { const s = noteState(n); return v === 'all' || (v === 'active' ? s !== 'checked' : s === v); };

// ready-made notes (his ask, 2026-10-28) - one click; `kind` tells the session exactly what to do (SKILL.md "fix notes")
export const PRESETS = [
  { kind: 'tighten', label: 'Tighten the cut', text: 'Tighten the cut: bring these two clips closer together - no gap or pause between them.' },
  { kind: 'silence', label: 'Cut the silence', text: 'Cut the silence here.' },
];

export const notesOf = (project: any): Note[] => (Array.isArray(project?.notes) ? project.notes : []);
export const saveNotes = (send: Send, next: Note[], label = 'note') => send([{ op: 'project', set: { notes: next } }], { label });
export const newNote = (at: number, end?: number): Note => ({ id: 'n' + Date.now().toString(36), at: Math.round(at), ...(end != null && Math.round(end) > Math.round(at) ? { end: Math.round(end) } : {}), text: '', t: Date.now() });
/** when a note is about: "0:12.3" or "0:12.3 – 0:15.1" (as he sees it, at the project's speed) */
export const noteWhen = (n: Note, fps: number, speed = 1) => fmtT(n.at / fps / speed) + (n.end != null ? ` – ${fmtT(n.end / fps / speed)}` : '');

const PinIc = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h14v13l-7 5-7-5z" /></svg>;

/** The notes on the ruler: a flag each (yellow open, green fixed, grey checked); a range note also a band to its end.
 *  Click opens it; drag the flag / the band moves it along, a band's edge changes its start / end. */
export function NotePins({ notes, view = 'active', px, pps, fps, total, onOpen, send, onSeek }: { notes: Note[]; view?: NoteView; px: (f: number) => number; pps: number; fps: number; total: number;
  onOpen: (n: Note) => void; send: Send; onSeek?: (f: number) => void }) {
  const down = (e: React.MouseEvent, n: Note, side: 'm' | 'l' | 'r' = 'm') => {
    e.stopPropagation(); e.preventDefault();
    const x0 = e.clientX, len = n.end != null ? n.end - n.at : 0, tr = (e.currentTarget as HTMLElement).closest('.ltl-track');
    let moved = false, next = n;
    const mv = (m: MouseEvent) => {
      if (!moved && Math.abs(m.clientX - x0) < 4) return;
      if (!moved) tr?.classList.add('ranging');  // (the quick buttons hide while a note is dragged)
      moved = true;
      const d = Math.round(((m.clientX - x0) / pps) * fps);
      if (side === 'm') { const at = Math.max(0, Math.min(total - 1 - len, n.at + d)); next = { ...n, at, ...(n.end != null ? { end: at + len } : {}) }; }
      else if (side === 'l') next = { ...n, at: Math.max(0, Math.min(n.end! - 1, n.at + d)) };
      else next = { ...n, end: Math.max(n.at + 1, Math.min(total, n.end! + d)) };
      send([{ op: 'project', set: { notes: notes.map((x) => (x.id === n.id ? next : x)) } }], { commit: false });
      onSeek?.(side === 'r' ? Math.min(total - 1, next.end! - 1) : next.at);  // (the viewer shows the edge being set)
    };
    const up = () => {
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up);
      tr?.classList.remove('ranging');
      if (!moved) { onOpen(n); return; }
      send([], { commit: false });
      saveNotes(send, notes.map((x) => (x.id === n.id ? next : x)), side === 'm' ? 'move note' : 'note range');
    };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };
  const tip = (n: Note) => `${{ open: 'Open', fixed: 'Fixed - check it', checked: 'Checked' }[noteState(n)]} note ${n.end != null ? 'from' : 'at'} ${noteWhen(n, fps)}: ${n.text}${n.reply ? `\nClaude: ${n.reply}` : ''}`;
  return <>{notes.filter((n) => inView(view, n)).map((n) => (
    <React.Fragment key={n.id}>
      {n.end != null && <div className={`ltl-nband ${noteState(n)}`} style={{ left: px(n.at), width: Math.max(2, px(n.end) - px(n.at)) }} onMouseDown={(e) => down(e, n)}
        title={tip(n) + '\n(click to open, drag to move, drag an edge to change the start / end)'}>
        <i className="l" onMouseDown={(e) => down(e, n, 'l')} /><i className="r" onMouseDown={(e) => down(e, n, 'r')} /></div>}
      <div data-note={n.id} className={`ltl-note ${noteState(n)}`} style={{ left: px(n.at) }} onMouseDown={(e) => down(e, n)}
        title={tip(n) + '\n(click to open, drag to move)'}><PinIc /></div>
    </React.Fragment>))}</>;
}

/** The spots on the picture: a ring where a note points, while the playhead is at it (the open one always). */
export function NoteSpots({ notes, frame, fps, canvas, open }: { notes: Note[]; frame: number; fps: number; canvas: { w: number; h: number }; open: Note | null }) {
  const shown = notes.filter((n) => n.x != null && n.id !== open?.id && (n.end != null ? frame >= n.at - fps * 0.6 && frame <= n.end : Math.abs(frame - n.at) <= fps * 0.6));
  if (open?.x != null) shown.push(open);
  return <>{shown.map((n) => (
    <div key={n.id} className={`note-spot ${n.done ? 'done' : ''}`} style={{ left: `${(n.x! / canvas.w) * 100}%`, top: `${(n.y! / canvas.h) * 100}%` }} />))}</>;
}

/** The note's window: right above its flag on the ruler (a new one: above the playhead) - his ask, 2026-10-28; a click
 *  on the video marks the spot. */
export function NoteWindow({ note, isNew, fps, speed, onSave, onDelete, onClose, onSeek, onNext }: { note: Note; isNew: boolean; fps: number; speed: number;
  onSave: (n: Note) => void; onDelete: () => void; onClose: () => void; onSeek: (f: number) => void; onNext?: () => void }) {
  const [text, setText] = useState(note.text);
  const [kind, setKind] = useState(note.kind);
  const box = useRef<HTMLTextAreaElement>(null);
  const win = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; bottom: number; arrow: number } | null>(null);
  useLayoutEffect(() => {  // (where its flag is - or the playhead, for a new one - on the ruler)
    const place = () => {
      const flag = document.querySelector(`[data-note="${CSS.escape(note.id)}"]`) || document.querySelector('.ltl .playhead');
      const ruler = document.querySelector('.ltl-ruler');
      if (!flag || !ruler) return setPos(null);
      const x = flag.getBoundingClientRect().left + flag.getBoundingClientRect().width / 2, top = ruler.getBoundingClientRect().top;
      const w = win.current?.offsetWidth || 340, left = Math.max(8, Math.min(innerWidth - w - 8, x - w / 2));
      setPos({ left, bottom: innerHeight - top + 10, arrow: Math.max(14, Math.min(w - 14, x - left)) });
    };
    place();
    addEventListener('resize', place);
    return () => removeEventListener('resize', place);
  }, [note.id, note.at]);
  useEffect(() => { setText(note.text); setKind(note.kind); }, [note.id]);
  const preset = (p: typeof PRESETS[number]) => {  // (again = off; its words go only where his own aren't)
    const was = PRESETS.find((x) => x.kind === kind), mine = text.trim() && text.trim() !== was?.text;
    if (kind === p.kind) { setKind(undefined); if (!mine) setText(''); return; }
    setKind(p.kind);
    if (!mine) setText(p.text);
    box.current?.focus();
  };
  useEffect(() => { box.current?.focus(); }, [note.id]);
  const close = () => {  // (closing keeps what he wrote - nothing is lost; an empty new note just goes)
    if (text.trim() && (text !== note.text || kind !== note.kind)) onSave({ ...note, text: text.trim(), kind });
    else if (isNew && !text.trim()) onDelete();
    onClose();
  };
  const keys = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); close(); }
  };
  return (
    <div className="note-win" ref={win} onKeyDown={keys} style={pos ? { left: pos.left, bottom: pos.bottom, top: 'auto' } : undefined}>
      {pos && <div className="note-arrow" style={{ left: pos.arrow }} />}
      <div className="note-h">
        <span className="grow">{isNew ? 'New note for Claude' : 'Note for Claude'}</span>
        <button className="btn ghost" style={{ height: 24, padding: '0 8px', fontSize: 12 }} title={note.end != null ? 'Go to its start' : 'Go to this moment'} onClick={() => onSeek(note.at)}>{note.end != null ? '' : 'at '}{noteWhen(note, fps, speed)}</button>
        <button className="btn ghost icon" style={{ width: 24, height: 24 }} title="Close (Esc) - what you wrote is kept" onClick={close}>✕</button>
      </div>
      <div className="note-presets">{PRESETS.map((p) => (
        <button key={p.kind} className={`note-chip ${kind === p.kind ? 'on' : ''}`} onClick={() => preset(p)} title={p.text}>{p.label}</button>))}</div>
      <textarea ref={box} className="field note-text" dir="auto" rows={5} value={text} onChange={(e) => setText(e.target.value)}
        placeholder={note.end != null ? "What's wrong in this stretch and what to fix… (Ctrl+Enter saves)" : "What's wrong here and what to fix… (Ctrl+Enter saves)"} />
      <div className="help" style={{ margin: 0 }}>{note.x != null ? 'The spot is marked on the video - click the video to move it.' : 'Optional: click the video to point at the exact spot.'}</div>
      {note.reply && <div className="note-reply"><b>Claude:</b> <span dir="auto">{note.reply}</span></div>}
      {noteState(note) === 'fixed' && <div className="note-check">
        <span className="grow">Claude fixed this - is it right?</span>
        <button className="btn ghost" onClick={() => { onSave({ ...note, done: false, fixed: undefined, seen: undefined }); }} title="Not fixed: it goes back to Claude (open)">Not yet</button>
        <button className="btn ok" onClick={() => { onSave({ ...note, seen: true }); onNext ? onNext() : onClose(); }} title="Checked - it hides; the next fixed note opens">Looks good ✓</button>
      </div>}
      <div className="note-acts">
        {!isNew && noteState(note) !== 'fixed' && <label className={`note-handled ${note.done ? 'on' : ''}`} title="Handled: done (ticked = checked, it hides with the others); untick to reopen it for Claude">
          <input type="checkbox" checked={!!note.done} onChange={(e) => onSave({ ...note, text: text.trim() || note.text, kind, done: e.target.checked, seen: e.target.checked || undefined, ...(e.target.checked ? {} : { fixed: undefined }) })} /> Handled</label>}
        {note.x != null && <button className="btn ghost" onClick={() => onSave({ ...note, text: text.trim() || note.text, kind, x: undefined, y: undefined })}>Clear the spot</button>}
        {note.end != null && !isNew && <button className="btn ghost" title="Make it a note about one moment (its start)" onClick={() => onSave({ ...note, text: text.trim() || note.text, kind, end: undefined })}>Just the start</button>}
        <div className="grow" />
        <button className="btn ghost" style={{ color: 'var(--bad)' }} onClick={() => { onDelete(); onClose(); }}>{isNew ? 'Cancel' : 'Delete'}</button>
        <button className="btn primary" disabled={!text.trim()} onClick={close}>Save</button>
      </div>
    </div>
  );
}
