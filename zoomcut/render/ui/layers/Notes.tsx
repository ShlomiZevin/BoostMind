// Notes for Claude (his ask, 2026-10-28: "a marker I can place... a note in this place with what's the problem and
// what to fix - I just say fix notes and he does it"). A note = a moment (frame) + his words + optionally a spot on the
// picture; kept in project.json `notes` (an op like any other: saved, Ctrl+Z, kept through rebuilds, moved with what
// plays under it when a take is made longer / shorter - pipeline/project.py). A session reads them with
// `node tools/notes.mjs <ep>` and answers on the note (done + reply).
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fmtT, Send } from './api';
import './notes.css';

export type Note = { id: string; at: number; text: string; x?: number; y?: number; done?: boolean; reply?: string; t?: number };

export const notesOf = (project: any): Note[] => (Array.isArray(project?.notes) ? project.notes : []);
export const saveNotes = (send: Send, next: Note[], label = 'note') => send([{ op: 'project', set: { notes: next } }], { label });
export const newNote = (at: number): Note => ({ id: 'n' + Date.now().toString(36), at: Math.round(at), text: '', t: Date.now() });

const PinIc = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h14v13l-7 5-7-5z" /></svg>;

/** The notes on the ruler: a flag each (yellow open, grey answered). Click opens it; drag moves it along the video. */
export function NotePins({ notes, px, pps, fps, total, onOpen, send }: { notes: Note[]; px: (f: number) => number; pps: number; fps: number; total: number;
  onOpen: (n: Note) => void; send: Send }) {
  const down = (e: React.MouseEvent, n: Note) => {
    e.stopPropagation(); e.preventDefault();
    const x0 = e.clientX;
    let moved = false, at = n.at;
    const mv = (m: MouseEvent) => {
      if (!moved && Math.abs(m.clientX - x0) < 4) return;
      moved = true;
      at = Math.max(0, Math.min(total - 1, Math.round(n.at + ((m.clientX - x0) / pps) * fps)));
      send([{ op: 'project', set: { notes: notes.map((x) => (x.id === n.id ? { ...x, at } : x)) } }], { commit: false });
    };
    const up = () => {
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up);
      if (!moved) { onOpen(n); return; }
      send([], { commit: false });
      saveNotes(send, notes.map((x) => (x.id === n.id ? { ...x, at } : x)), 'move note');
    };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };
  return <>{notes.map((n) => (
    <div key={n.id} data-note={n.id} className={`ltl-note ${n.done ? 'done' : ''}`} style={{ left: px(n.at) }} onMouseDown={(e) => down(e, n)}
      title={`${n.done ? 'Answered' : 'Note'} at ${fmtT(n.at / fps)}: ${n.text}${n.reply ? `\nClaude: ${n.reply}` : ''}\n(click to open, drag to move)`}><PinIc /></div>))}</>;
}

/** The spots on the picture: a ring where a note points, while the playhead is at it (the open one always). */
export function NoteSpots({ notes, frame, fps, canvas, open }: { notes: Note[]; frame: number; fps: number; canvas: { w: number; h: number }; open: Note | null }) {
  const shown = notes.filter((n) => n.x != null && n.id !== open?.id && Math.abs(frame - n.at) <= fps * 0.6);
  if (open?.x != null) shown.push(open);
  return <>{shown.map((n) => (
    <div key={n.id} className={`note-spot ${n.done ? 'done' : ''}`} style={{ left: `${(n.x! / canvas.w) * 100}%`, top: `${(n.y! / canvas.h) * 100}%` }} />))}</>;
}

/** The note's window: right above its flag on the ruler (a new one: above the playhead) - his ask, 2026-10-28; a click
 *  on the video marks the spot. */
export function NoteWindow({ note, isNew, fps, speed, onSave, onDelete, onClose, onSeek }: { note: Note; isNew: boolean; fps: number; speed: number;
  onSave: (n: Note) => void; onDelete: () => void; onClose: () => void; onSeek: (f: number) => void }) {
  const [text, setText] = useState(note.text);
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
  useEffect(() => { setText(note.text); }, [note.id]);
  useEffect(() => { box.current?.focus(); }, [note.id]);
  const close = () => {  // (closing keeps what he wrote - nothing is lost; an empty new note just goes)
    if (text.trim() && text !== note.text) onSave({ ...note, text: text.trim() });
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
        <span className="grow">{isNew ? 'New note for Claude' : note.done ? 'Note - answered' : 'Note for Claude'}</span>
        <button className="btn ghost" style={{ height: 24, padding: '0 8px', fontSize: 12 }} title="Go to this moment" onClick={() => onSeek(note.at)}>at {fmtT(note.at / fps / speed)}</button>
        <button className="btn ghost icon" style={{ width: 24, height: 24 }} title="Close (Esc) - what you wrote is kept" onClick={close}>✕</button>
      </div>
      <textarea ref={box} className="field note-text" dir="auto" rows={5} value={text} onChange={(e) => setText(e.target.value)}
        placeholder="What's wrong here and what to fix… (Ctrl+Enter saves)" />
      <div className="help" style={{ margin: 0 }}>{note.x != null ? 'The spot is marked on the video - click the video to move it.' : 'Optional: click the video to point at the exact spot.'}</div>
      {note.reply && <div className="note-reply"><b>Claude:</b> <span dir="auto">{note.reply}</span></div>}
      <div className="note-acts">
        {!isNew && <button className="btn" onClick={() => { onSave({ ...note, text: text.trim() || note.text, done: !note.done }); onClose(); }}>{note.done ? 'Reopen' : 'Mark done'}</button>}
        {note.x != null && <button className="btn ghost" onClick={() => onSave({ ...note, text: text.trim() || note.text, x: undefined, y: undefined })}>Clear the spot</button>}
        <div className="grow" />
        <button className="btn ghost" style={{ color: 'var(--bad)' }} onClick={() => { onDelete(); onClose(); }}>{isNew ? 'Cancel' : 'Delete'}</button>
        <button className="btn primary" disabled={!text.trim()} onClick={close}>Save</button>
      </div>
    </div>
  );
}
