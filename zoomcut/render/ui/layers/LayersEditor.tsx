// THE editor for a layered project (project.json): Media / Script on the left, the video (render/src/Layers.tsx - the
// same composition the export draws) in the middle, the picked layer's settings on the right, a lane per layer below.
// Every change is an op (./api.ts): instant in the preview, saved, undoable. A Zoom project's lines still go through
// its builder (the Script tab, dragging a voice block): the analysis re-runs and its layers come back merged.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { Layers } from '../../src/Layers';
import { clockFrame, soundDiag, soundClock, soundJump } from '../../src/layers/AudioTrack';
import { useLayered, build, fmtT } from './api';
import { apply } from '../../src/layers/ops.js';
import { tempoOf } from '../../src/layers/clock.js';
import { Timeline, Sel } from './Timeline';
import { ask } from './ask';
import { Media } from './Media';
import { Inspector, hasPanel } from './Inspector';
import { useTyped } from './inspect/controls';
import { LineProps } from '../lineprops';
import { Media as FootageAssign } from '../footage';
import { Handles, pickAt } from './Handles';
import { Subtitles } from './Subtitles';
import { VideoPeek } from './VideoPeek';
import { FaceSwap } from './FaceSwap';
import { Note, notesOf, saveNotes, newNote, NoteWindow, NoteSpots } from './Notes';
import { removeBlock } from './dialogue';

// a crash anywhere in the layered editor never blanks his screen: a note and a way back
export class LayersBoundary extends React.Component<{ children: React.ReactNode }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: any) { return { err: String(e?.message || e) }; }
  render() {
    if (!this.state.err) return this.props.children;
    return <div className="empty" style={{ padding: 40, display: 'grid', gap: 12, maxWidth: 560 }}>
      <b style={{ color: 'var(--text)' }}>The editor tripped over something.</b>
      <span>Nothing is lost - every change was saved as you made it.</span>
      <code style={{ fontSize: 11 }}>{this.state.err}</code>
      <button className="btn primary" style={{ width: 160 }} onClick={() => this.setState({ err: null })}>Back to the editor</button>
    </div>;
  }
}

type Props = { ep: string; top: React.ReactNode; job: any; setJob: (j: any) => void; jobLine: string; reloadEp: () => void; chars: any[]; epData?: any };

export function LayersEditor({ ep, top, job, setJob, jobLine, chars, epData, reloadEp }: Props) {
  const L = useLayered(ep);
  // Ctrl+Z for what a builder changes (a video's length - its cut re-made from the take -, a line fix, a caption, an
  // Inspector action): the project before it is kept, and once the builder's version is loaded the difference goes on
  // the undo list as one step (api.ts record) - so his Ctrl+Z undoes it like any other edit
  const snap = useRef<{ p: any; label: string } | null>(null);
  const before = (label: string) => { if (!snap.current && L.view) snap.current = { p: L.view.project, label }; };
  const reloaded = async () => {
    const v = await L.load();
    const s = snap.current; snap.current = null;
    if (s && v) L.record(s.p, v.project, s.label);
    return v;
  };
  const project = L.live;
  const player = useRef<PlayerRef>(null);
  const frameEl = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  // while playing, the picture follows the SOUND's clock (AudioTrack soundClock): when the computer falls behind on
  // the picture it skips ahead to the sound - never the other way round (the sound jumping after the picture was
  // heard as stutter). His jumps tell the sound themselves (seek -> soundJump), so any gap here is the picture's
  useEffect(() => {
    if (!playing) return;
    let id = 0, lastT = performance.now(), gap = 0, worst = 0, seeks = 0, sent = performance.now();
    const tick = () => {
      const cf = clockFrame(), pl = player.current;
      // the sound report: one line a second to the studio (episodes/_sound.jsonl) - what this browser really does
      const t = performance.now(); gap = Math.max(gap, t - lastT); lastT = t;
      if (cf != null && pl) worst = Math.max(worst, Math.abs(cf - pl.getCurrentFrame()));
      if (t - sent > 1000) {
        const ctx: any = (window as any).__zcCtx;
        fetch('/api/sound-report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ep,
          frame: pl?.getCurrentFrame(), clock: cf == null ? null : Math.round(cf), clockOn: soundClock.on, worstGapFrames: Math.round(worst), pictureSeeks: seeks,
          longestStallMs: Math.round(gap), ctx: ctx && { state: ctx.state, rate: ctx.sampleRate, hint: 'playback', latencyMs: Math.round(((ctx.baseLatency || 0) + (ctx.outputLatency || 0)) * 1000) },
          layers: soundDiag.layers, why: soundDiag.why, starts: soundDiag.starts, failed: soundDiag.failed.slice(-5) }) }).catch(() => {});
        sent = t; gap = 0; worst = 0; seeks = 0;
      }
      if (cf != null && pl?.isPlaying()) {  // (the picture on the sound as HEARD: the clock minus the audio output's delay)
        const c: any = (window as any).__zcCtx, heard = cf - ((c?.baseLatency || 0) + (c?.outputLatency || 0)) * soundClock.perSec;
        const d = heard - pl.getCurrentFrame();
        if (Math.abs(d) > 3) { pl.seekTo(Math.round(heard)); seeks++; }
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing]);
  const [sel, setSel] = useState<Sel>(null);
  // play ONE clip alone (Shift+Space, or ▶ on the picked block): a sound - every other sound is muted, the picture
  // stays; a picture - only it (and its own voice) is seen and heard. A draft while it plays (api.ts 'solo'), never
  // saved; it ends at the clip's end, on pause, or on Escape
  const soloRef = useRef<{ key: string; end: number } | null>(null);
  const [soloKey, setSoloKey] = useState<string | null>(null);
  // (the other layers come back only once the sound has stopped - put back at once, every layer was heard for a
  // split second as it ended)
  const soloBack = useRef(0);
  const endSolo = () => {
    if (!soloRef.current) return; soloRef.current = null; setSoloKey(null); setPlaying(false);
    clearTimeout(soloBack.current); soloBack.current = window.setTimeout(() => L.send([], { commit: false, channel: 'solo' }), 200);
  };
  const playOnly = (s: Sel = sel) => {
    const key = s?.item ? `${s.layer}|${s.item}` : null;
    if (soloRef.current) { const was = soloRef.current.key; player.current?.pause(); endSolo(); if (was === key) return; }
    const l = key && project?.layers.find((x: any) => x.id === s!.layer), it = l?.items?.find((x: any) => x.id === s!.item);
    if (!l || !it) return;
    const keep = new Set([key]);
    const sound = l.kind === 'audio';
    if (!sound && it.link) for (const ly of project.layers) for (const x of ly.items || []) if (ly.kind === 'audio' && x.link === it.link) keep.add(`${ly.id}|${x.id}`);
    const ops: any[] = [];
    for (const ly of project.layers) {
      const items = ly.items || [];
      if (items.some((x: any) => keep.has(`${ly.id}|${x.id}`))) {
        for (const x of items) if (!keep.has(`${ly.id}|${x.id}`) && !x.hidden) ops.push({ op: 'item.update', layer: ly.id, id: x.id, set: { hidden: true } });
        if (ly.muted || ly.hidden) ops.push({ op: 'layer.update', id: ly.id, set: { muted: false, hidden: false } });  // (he asked to hear it)
      } else if (ly.kind === 'audio') { if (!ly.muted) ops.push({ op: 'layer.update', id: ly.id, set: { muted: true } }); }
      else if (!sound && !ly.hidden && !(ly.kind === 'backdrop' && ly.props?.target === l.id)) ops.push({ op: 'layer.update', id: ly.id, set: { hidden: true } });
    }
    clearTimeout(soloBack.current);
    L.send(ops, { commit: false, channel: 'solo' });
    soloRef.current = { key: key!, end: it.from + it.dur };
    setSoloKey(key);
    seek(it.from);
    setTimeout(() => player.current?.play(), 30);  // (after the draft is in: the sound schedules without the others)
  };
  // ▶ above a block: the clip's own file in Media's window, without the other layers - a picture, a video / sound
  // from where the clip starts in it, a text's words
  const [opened, setOpened] = useState<Sel>(null);
  const openClip = (s: Sel) => { player.current?.pause(); setOpened(s); };
  const openedView = () => {
    const l = opened?.item && project?.layers.find((x: any) => x.id === opened.layer), it = l?.items?.find((x: any) => x.id === opened!.item);
    if (!l || !it) return null;
    const close = () => setOpened(null);
    if (it.text != null) return <VideoPeek kind="text" src="" text={String(it.text)} name={l.name || l.id} onClose={close} />;
    const id = it.asset ?? l.props?.asset, a = project.assets?.[id];
    if (!a) return null;
    const kind = l.kind === 'audio' ? 'audio' : a.kind === 'image' ? 'image' : 'video';
    const fpsP = project.canvas.fps || 30, from = it.in || 0, to = from + (it.dur / fpsP) * (it.rate || 1);
    // a video clip: the face swap (beta) under it - and once made, the window plays the swapped copy while it is on
    const take = kind === 'video' && l.kind === 'video';
    const swapped = take && l.props?.face !== false && L.view!.urls[`${id}:face`];
    return <VideoPeek kind={kind} src={kind === 'image' ? L.view!.urls[id] : swapped || `/api/p/${ep}/asset?a=${encodeURIComponent(id)}`} name={a.label || String(a.src).split('/').pop()}
      sub={kind === 'image' ? (a.w ? `${a.w}×${a.h}` : '') : `this clip: ${fmtT(from)} – ${fmtT(to)} of the file`} start={kind === 'image' ? undefined : from} end={kind === 'image' ? undefined : to} onClose={close}>
      {take && <FaceSwap key={`${l.id}|${id}`} ep={ep} project={project} layer={l} asset={id} urls={L.view!.urls} send={L.send} reload={L.load} onMade={close}
        build={async (action, args) => { before(action); const j = await build(ep, { action, ...(args || {}) }); if (j?.running) setJob(j); else reloaded(); }} />}
    </VideoPeek>;
  };
  const [line, setLine] = useState<number | null>(null);
  const [pick, setPick] = useState<{ kind: string; onPick: (id: string) => void } | null>(null);  // a panel asked for a file from Media
  const [tab, setTab] = useState<'media' | 'script' | 'subs'>(() => (localStorage.getItem('zc-ly-tab') as any) || 'media');
  useEffect(() => { try { localStorage.setItem('zc-ly-tab', tab); } catch {} }, [tab]);
  const [tlH, setTlH] = useState(+(localStorage.getItem('zc-ly-tlh') || 340));
  useEffect(() => { try { localStorage.setItem('zc-ly-tlh', String(tlH)); } catch {} }, [tlH]);

  // a builder job (re-analyze, a line fix) ended: its layers changed on disk
  const wasRunning = useRef(false);
  useEffect(() => { if (wasRunning.current && !job?.running) { reloaded(); reloadEp(); } wasRunning.current = !!job?.running; }, [job?.running]);

  useEffect(() => {
    const p = player.current; if (!p) return;
    // (a seek while playing - his on the bar, or the picture kept on the sound's clock - says 'pause' then 'play' at
    // once: only a pause that is still a pause a moment later stops the sound, else it restarted on every seek)
    let paT = 0;
    const fu = (e: any) => {
      setFrame(e.detail.frame);
      if (soloRef.current && e.detail.frame >= soloRef.current.end) { player.current?.pause(); endSolo(); }  // (one clip alone: it ends where the clip does)
    }, pl = () => { clearTimeout(paT); setPlaying(true); },
      pa = () => { clearTimeout(paT); paT = window.setTimeout(() => { if (!player.current?.isPlaying()) { setPlaying(false); endSolo(); } }, 60); };
    p.addEventListener('frameupdate', fu); p.addEventListener('play', pl); p.addEventListener('pause', pa);
    return () => { p.removeEventListener('frameupdate', fu); p.removeEventListener('play', pl); p.removeEventListener('pause', pa); };
  }, [!!project]);

  const fps = project?.canvas.fps || 30;
  const total = project?.duration || 1;
  const speed = project?.speed || 1;
  const seek = (f: number) => { const g = Math.max(0, Math.min(total - 1, Math.round(f))); soundJump(g); player.current?.seekTo(g); setFrame(g); };
  // picking an item shows it: the video jumps into it when the playhead is outside it
  const pickItem = (s: Sel) => {
    setSel(s); setLine(null);
    const it = s?.item && project?.layers.find((l: any) => l.id === s.layer)?.items?.find((i: any) => i.id === s.item);
    if (it && (frame < it.from || frame >= it.from + it.dur)) seek(it.from + Math.min(it.dur - 1, Math.round(fps * 0.4)));
  };
  // a caption picked + the playhead moved onto another caption of its row = that one in the panel (his ask, 2026-11-03:
  // "when I'm on captions and moving the time, put the caption I'm standing on in the property window"); not while
  // playing - it catches up on pause. A gap between captions keeps the last one
  useEffect(() => {
    if (playing || !sel?.item) return;
    const l = project?.layers.find((x: any) => x.id === sel.layer);
    if (l?.kind !== 'subtitles') return;
    const on = (i: any) => frame >= i.from && frame < i.from + i.dur;
    if ((l.items || []).some((i: any) => i.id === sel.item && on(i))) return;  // (still on the picked one - two may overlap)
    const at = (l.items || []).find(on);
    if (at) setSel({ layer: l.id, item: at.id });
  }, [frame, playing]);
  // notes for Claude (Notes.tsx): the open one's window; a new one is only saved once it has words
  const notes = notesOf(project);
  const [noteOpen, setNoteOpen] = useState<{ note: Note; isNew: boolean } | null>(null);
  const [showDone, setShowDone] = useState(() => localStorage.getItem('zc-notes-done') !== '0');  // handled notes on the timeline
  useEffect(() => { try { localStorage.setItem('zc-notes-done', showDone ? '1' : '0'); } catch {} }, [showDone]);
  const openNote = (n: Note | null) => {
    player.current?.pause();
    if (n) { seek(n.at); setNoteOpen({ note: n, isNew: false }); } else setNoteOpen({ note: newNote(frame), isNew: true });
  };
  const saveNote = (n: Note) => {
    const c: Note = { ...n };
    if (c.x == null) { delete c.x; delete c.y; }
    const has = notes.some((x) => x.id === c.id);
    saveNotes(L.send, has ? notes.map((x) => (x.id === c.id ? c : x)) : [...notes, c], has ? 'note' : 'new note');
    setNoteOpen((o) => (o && o.note.id === c.id ? { note: c, isNew: false } : o));
  };
  const deleteNote = (id: string) => { if (notes.some((x) => x.id === id)) saveNotes(L.send, notes.filter((x) => x.id !== id), 'delete note'); };
  const noteSpot = (e: React.MouseEvent) => {  // (the note's window is open: a click on the video points at the spot)
    const r = frameEl.current!.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * project.canvas.w), y = Math.round(((e.clientY - r.top) / r.height) * project.canvas.h);
    if (noteOpen!.isNew) setNoteOpen({ ...noteOpen!, note: { ...noteOpen!.note, x, y } });
    else saveNote({ ...noteOpen!.note, x, y });
  };

  const inputProps = useMemo(() => project && ({ project, urls: L.view!.urls, mode: 'full' as const, playing, playbackRate: speed, gainDb: (L.view as any).gainDb ?? 0 }),
    [project, L.view?.urls, (L.view as any)?.gainDb, playing, speed]);

  // keys: space play, arrows step / jump, Ctrl+Z / Ctrl+Shift+Z, Delete the picked item
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      // (only a box he TYPES in keeps the keys - a slider / switch that still has the focus after he moved it doesn't:
      // Ctrl+Z right after a slider did nothing)
      const t = e.target as HTMLInputElement, tag = t.tagName;
      if (tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && !['range', 'checkbox', 'radio', 'button', 'color'].includes(t.type))) return;
      if (tag === 'INPUT' && t.type === 'range' && /^Arrow|^Home$|^End$/.test(e.key)) return;  // (the slider's own keys)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? L.redo() : L.undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); L.redo(); }
      else if (e.code === 'Space' && e.shiftKey) { e.preventDefault(); playOnly(); }
      else if (e.code === 'Space') { e.preventDefault(); player.current?.toggle(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); seek(frame + (e.shiftKey ? fps : 1)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); seek(frame - (e.shiftKey ? fps : 1)); }
      else if (e.key === 'Home') { e.preventDefault(); seek(0); }
      else if ((e.key === 'n' || e.key === 'N' || e.key === 'מ') && !e.ctrlKey && !e.metaKey && !e.altKey && !noteOpen) { e.preventDefault(); openNote(null); }
      else if (e.key === 'End') { e.preventDefault(); seek(total - 1); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && sel?.item) {
        e.preventDefault();
        // (a block of the What-we-see strip: its neighbour takes its time - the strip has no gaps; dialogue.ts)
        const strip = project?.layers.find((x: any) => x.id === sel.layer)?.kind === 'view';
        L.send(strip ? removeBlock(project, sel.item) : [{ op: 'item.remove', layer: sel.layer, id: sel.item }], { label: strip ? 'delete cut' : 'delete' });
        setSel({ layer: sel.layer });
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel?.layer && !sel.item) {  // the whole layer (asked once)
        e.preventDefault();
        const l = project?.layers.find((x: any) => x.id === sel.layer);
        const n = l?.items?.length || 0;
        if (l) ask({ title: `Delete the layer "${l.name || l.id}"?`, text: `${n ? `${n} clip${n === 1 ? '' : 's'} go${n === 1 ? 'es' : ''} with it. ` : ''}Ctrl+Z brings it back.`, ok: 'Delete' })
          .then((yes) => { if (yes) { L.send([{ op: 'layer.remove', id: l.id }], { label: 'delete layer' }); setSel(null); } });
      } else if (e.key === 'Escape' && soloRef.current) { player.current?.pause(); endSolo(); }
      else if (e.key === 'Escape') { setSel(null); setLine(null); }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  });

  // the script panel's line fix (a builder that has script lines - the Script tab)
  const script: any[] = project?.script || [];
  const lineFix = async (n: number, fix: any) => {
    before('line ' + n);
    const clean = Object.fromEntries(Object.entries(fix || {}).filter(([, v]) => v !== undefined && v !== null && v !== ''));
    const j = await build(ep, { action: 'line', n, fix: clean });
    setJob(j);
  };
  // ONE way to edit any item, whatever made the project (his rule: "everything is one tool, just layers" and
  // "nothing rebuilds - when I change something it should be live"):
  //  1. LIVE: the item changes at once with every item that shares its `link` (its voice, subtitles, picture); in a
  //     continuous cut (`project.edit.ripple`) everything after the edge closes up / makes room;
  //  2. QUIETLY: when a builder made the item, it is told (POST build {action: 'edit'}, render/actions/edit.mjs) and
  //     its next version replaces the live guess when it lands - no "Updating", no wait. The editor never asks which
  //     builder it is.
  const [syncing, setSyncing] = useState(0);
  const liveEdit = (l: any, it: any, side: 'l' | 'r' | 'm', d: number, project = L.live) => {
    const ops: any[] = [], seen = new Set<string>();
    d = takeRoom(project, it, side, d);
    const change = (ly: any, x: any) => {
      const set: any = side === 'm' ? { from: Math.max(0, x.from + d) }
        : side === 'r' ? { dur: Math.max(1, x.dur + d) }
        : ripple ? { dur: Math.max(1, x.dur - d), ...(x.in != null ? { in: Math.max(0, +(x.in + (d / fps) * (x.rate || 1) * tempoOf(ly)).toFixed(4)) } : {}) }
        : { from: Math.max(0, x.from + d), dur: Math.max(1, x.dur - d), ...(x.in != null ? { in: Math.max(0, +(x.in + (d / fps) * (x.rate || 1) * tempoOf(ly)).toFixed(4)) } : {}) };
      ops.push({ op: 'item.update', layer: ly.id, id: x.id, set, user: false });
      seen.add(ly.id + '|' + x.id);
    };
    // ripple: a continuous timeline - an edge closes up / makes room; ripple_move: moving a piece moves everything after
    // it too (lines that follow each other, as the conversation builder plans them)
    const ripple = !!project.edit?.ripple && (side !== 'm' || !!project.edit?.ripple_move);
    // everything that starts after this item starts (lines overlap a little - the next one starts before this one ends)
    // (its subtitles are words inside the piece, not the piece: in a ripple they follow the rule below)
    for (const ly of project.layers) for (const x of ly.items || []) {
      if (x === it || (it.link && x.link === it.link && !(ripple && ly.kind === 'subtitles'))) change(ly, x);
    }
    if (ripple) {  // everything after the edge moves with it (texts, sounds, pictures, his own layers too); what spans
      // the edge - the background, the music, a sound of his - grows / shrinks with it (his rule, 2026-10-28)
      const shift = side === 'l' ? -d : d, edge = side === 'r' ? it.from + it.dur : it.from;
      // the words cut off by a shorter clip: their subtitles go (the right edge: those starting in the cut-off end; the
      // left: those inside the clip that would now start before it)
      const hidden = (ly: any, x: any) => ly.kind === 'subtitles' && side !== 'm' && d !== 0
        && (side === 'r' ? d < 0 && x.from >= edge + d - 0.5 && x.from < edge - 0.5 : d > 0 && x.from >= it.from - 0.5 && x.from < it.from + d - 0.5);
      for (const ly of project.layers) for (const x of ly.items || []) {
        if (seen.has(ly.id + '|' + x.id)) continue;
        if (hidden(ly, x)) { ops.push({ op: 'item.remove', layer: ly.id, id: x.id }); continue; }
        if (x.pin && side !== 'm') continue;  // (pinned to the end / spanning to it: the new length moves it - ops.js repin)
        const after = side === 'r' ? x.from >= edge - 0.5 : x.from > edge;
        if (after) ops.push({ op: 'item.update', layer: ly.id, id: x.id, set: { from: Math.max(0, x.from + shift) }, user: false });
        else if (x.from + x.dur > edge + 0.5) ops.push({ op: 'item.update', layer: ly.id, id: x.id, set: { dur: Math.max(1, x.dur + shift) }, user: false });
      }
      if (side !== 'm' && shift) ops.push({ op: 'project', set: { duration: Math.max(1, (project.duration || 0) + shift) } });  // (the video grows / shrinks with it)
    }
    return ops;
  };
  // how far a clip of a take can go: a clip is a window on its whole take (his rule, 2026-11-05 - "each video is longer
  // than the cut it took"), its edge stops at the take's start / end; and a clip keeps at least a frame
  const takeRoom = (project: any, it: any, side: 'l' | 'r' | 'm', d: number) => {
    if (side === 'm') return d;
    const rate = it.rate || 1, len = project.assets?.[it.asset]?.duration;
    if (side === 'r') {
      d = Math.max(d, 1 - it.dur);
      if (it.in != null && len) d = Math.min(d, Math.floor(((len - (it.in + (it.dur / fps) * rate)) * fps) / rate));
    } else {
      d = Math.min(d, it.dur - 1);
      if (it.in != null) d = Math.max(d, -Math.floor((it.in * fps) / rate));
    }
    return d;
  };
  // the words a longer clip uncovers get their subtitles (from the take's words, work/words/<take>.json), styled as the
  // subtitles beside them; words a subtitle already shows are left alone
  const takeWords = useRef<Record<string, Promise<any[]>>>({});
  const newWordsSubs = async (it: any, side: 'l' | 'r', d: number, ops: any[]) => {
    const take = it.ref?.take, rate = it.rate || 1;
    if (!take || it.in == null || !(side === 'r' ? d > 0 : d < 0)) return [];
    const words = await (takeWords.current[take] ||= fetch(`/pm/${ep}?p=${encodeURIComponent(`work/words/${take}.json`)}`)
      .then((r) => (r.ok ? r.json() : [])).catch(() => []));
    const after = apply(L.live, ops);
    const subs = after.layers.find((x: any) => x.kind === 'subtitles' && x.items?.length);
    if (!subs || !words.length) return [];
    // the uncovered stretch of the take (seconds) and where a second of it plays now (frames)
    const a = side === 'r' ? it.in + (it.dur / fps) * rate : it.in + (d / fps) * rate;
    const z = side === 'r' ? it.in + ((it.dur + d) / fps) * rate : it.in;
    const startIn = side === 'r' ? it.in : a;
    const at = (sec: number) => it.from + ((sec - startIn) * fps) / rate;
    const taken = (f0: number, f1: number) => subs.items.some((x: any) => Math.min(f1, x.from + x.dur) - Math.max(f0, x.from) > (f1 - f0) / 2);  // (a subtitle shows most of it)
    const ws = words.filter((w: any) => w.s >= a - 0.05 && w.s < z && !taken(at(w.s), at(w.e)));
    if (!ws.length) return [];
    const groups: any[][] = [];
    let cur: any[] = [];
    for (const w of ws) {
      if (cur.length && (w.s - cur[cur.length - 1].e > 0.6 || cur.length >= 5)) { groups.push(cur); cur = []; }
      cur.push(w);
      if (cur.length >= 3 && /[.?,!]$/.test(w.w)) { groups.push(cur); cur = []; }
    }
    if (cur.length) groups.push(cur);
    const near = [...subs.items].sort((x: any, y: any) => Math.abs(x.from - at(a)) - Math.abs(y.from - at(a)))[0];
    const { id: _i, text: _t, from: _f, dur: _d, ref: _r, ...look } = near;
    return groups.map((g, k) => {
      const f0 = Math.round(at(g[0].s)), f1 = Math.round(at(g[g.length - 1].e));
      return { op: 'item.add', layer: subs.id, item: { ...look, id: `s${Date.now().toString(36)}${k}`, from: f0, dur: Math.max(8, f1 - f0),
        text: g.map((w) => w.w).join(' '), ref: { sub: take, t: g[0].s }, link: it.link, user: true } };
    });
  };
  // edits waiting for their builder: shown live (the 'sync' draft, they stack), one quiet loop brings the builder's
  // answer in when everything has settled
  const pending = useRef<any[]>([]);
  const syncLoop = useRef<Promise<void> | null>(null);
  const settle = () => {
    if (syncLoop.current) return;
    syncLoop.current = (async () => {
      try {
        let idle = 0;  // idle twice in a row = settled (an edit meanwhile re-runs the builder once more)
        for (let i = 0; i < 1200 && idle < 2; i++) {
          await new Promise((r) => setTimeout(r, 700));
          const s = await (await fetch(`/api/ep/${ep}/job`)).json().catch(() => null);
          idle = s?.running ? 0 : idle + 1;
        }
        await reloaded();
      } finally {
        pending.current = []; L.send([], { commit: false, channel: 'sync' }); setSyncing(0); syncLoop.current = null;
      }
    })();
  };
  // the items whose edit is the builder's: one of his takes (a script line / a take's cut). A caption or a text is its own
  // length / place only - not its line's picture and voice, nothing after it moves (his rule, 2026-10-23); a picture, a
  // sticker, a text placed by the builder is a plain edit - its drag never moves the rest of the video (2026-10-25)
  const isTake = (l: any, it: any) => l.owner === 'builder' && !!it.ref && l.kind !== 'subtitles' && l.kind !== 'text'
    && (it.ref.take != null || it.ref.line != null);
  // dragging one: the push / pull shows while it moves (the project as it was when the drag began)
  const onItemPreview = (l: any, it: any, side: 'l' | 'r' | 'm', d: number, base: any) =>
    isTake(l, it) && project.edit?.ripple && side !== 'm' ? liveEdit(l, it, side, d, base) : null;
  const onItemEdit = (l: any, it: any, side: 'l' | 'r' | 'm', d: number): boolean | 'keep' => {
    if (!isTake(l, it)) return false;  // a layer of his own, a caption, a picture: the plain edit is the edit
    // one camera (a continuous cut): as in CapCut - the edge shows more / less of the take, everything after it moves
    // by exactly that, and that IS the edit: saved as his, no rebuild (his rule, 2026-11-05 - the builder's re-cut
    // after a drag forgot the end card, cut the end music short and joined two clips: "it completely ruined everything")
    if (project.builder?.kind !== 'zoom' && project.edit?.ripple && side !== 'm') {
      const live = liveEdit(l, it, side, d);
      L.send([], { commit: false });
      L.send(live, { commit: false, channel: 'sync' });  // (shown while the uncovered words are looked up)
      (async () => {
        const subs = await newWordsSubs(it, side, takeRoom(L.live, it, side, d), live).catch(() => []);
        L.send([], { commit: false, channel: 'sync' });
        L.send([...live, ...subs].map((o: any) => (o.op === 'item.update' ? { ...o, user: true } : o)), { label: 'trim' });
      })();
      return 'keep';
    }
    before(side === 'm' ? 'move' : 'trim');
    const live = liveEdit(l, it, side, d);
    L.send([], { commit: false });  // (the drag's own draft goes - the live edit below shows it)
    pending.current = [...pending.current, ...live];
    L.send(pending.current, { commit: false, channel: 'sync' });  // shown now, on top of any edit still syncing
    setSyncing((k) => k + 1);
    (async () => {
      const j = await build(ep, { action: 'edit', layer: l.id, item: it.id, side, frames: d }).catch((e) => ({ error: String(e) }));
      if (j?.error) L.setError(j.error);
      if (j?.hand) {  // nothing for the builder: the live edit is saved as his
        pending.current = pending.current.filter((o) => !live.includes(o));
        L.send(pending.current, { commit: false, channel: 'sync' });
        L.send(live.map((o) => ({ ...o, user: true })), { label: side === 'm' ? 'move' : 'trim' });
        setSyncing((k) => Math.max(0, k - 1));
        return;
      }
      settle();
    })();
    return 'keep';
  };

  const startSplit = (e: React.MouseEvent) => {
    const y0 = e.clientY, h0 = tlH;
    const mv = (m: MouseEvent) => setTlH(Math.max(180, Math.min(innerHeight - 300, h0 - (m.clientY - y0))));
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };

  if (!project) return <div className="ed">{top}<div className="empty" style={{ padding: 30 }}>Loading the layers…</div></div>;
  const busy = !!job?.running;
  // a new project: its footage (who is who) and the analysis come first - right here, in the one editor
  const fresh = !project.layers.length;
  const unassigned = epData?.footage?.unassigned?.length || 0;
  // a new one-camera project: its takes, then Analyze (the cut, subtitles, cut-out, eye contact) - lesson.py
  const solo = project.builder?.kind === 'solo' || epData?.episode?.type === 'lesson';
  const soloSetup = fresh && solo ? (
    <div className="card" style={{ margin: 12, gap: 10 }}>
      <div className="card-h"><div className="title grow">New video - the takes</div></div>
      <div className="help" style={{ marginTop: 0 }}>{busy ? 'Analyzing: listening to the takes, cutting the pauses, the subtitles, cutting him out, eye contact…'
        : `From ${String(epData?.episode?.input_dir || 'the footage folder').split(/[\/]/).slice(-2).join('/')}. Analyze makes the cut, the subtitles, the cut-out and eye contact - each one a layer here.`}</div>
      <button className="btn primary" disabled={busy} onClick={async () => setJob(await build(ep, { action: 'analyze' }))}>{busy ? 'Analyzing…' : 'Analyze'}</button>
    </div>) : null;
  const setup = soloSetup || ((fresh || unassigned > 0) && project.builder?.kind === 'zoom' ? (
    <div className="card" style={{ margin: 12, gap: 10 }}>
      <div className="card-h"><div className="title grow">{fresh ? 'New video - the footage' : 'New footage'}</div></div>
      <div className="help" style={{ marginTop: 0 }}>{unassigned ? 'Pick who is in each file - the analysis goes on by itself.'
        : busy ? 'Analyzing: listening to every take, matching the script, cutting out the people…' : 'Analyze: the takes are matched to the script and every person, voice and subtitle becomes a layer.'}</div>
      {epData?.footage && <div className="setup-foot"><FootageAssign data={epData} ep={ep} busy={busy} onJob={setJob} /></div>}
      {!unassigned && <button className="btn primary" disabled={busy} onClick={async () => setJob(await build(ep, { action: 'analyze' }))}>{busy ? 'Analyzing…' : 'Analyze'}</button>}
    </div>) : null);
  const nowLine = [...script].reverse().find((l) => l.start != null && l.start <= frame / fps + 0.01)?.n;
  const curLine = line != null ? script.find((l) => l.n === line) : null;
  const lineCard = curLine && (
    <>
      <LineProps key={curLine.n} l={curLine} busy={busy} chars={chars} onFix={(f: any) => lineFix(curLine.n, f)} />
      <div className="card">
        <div className="card-h"><div className="title grow">Subtitle words</div></div>
        <LineCaption key={curLine.n} words={curLine.fix?.caption || curLine.text}
          save={async (t) => { before('caption'); await build(ep, { action: 'caption', n: curLine.n, text: t === curLine.text ? '' : t }); reloaded(); }} />
        <div className="help">How this line reads on screen; the timing stays the line's.</div>
      </div>
    </>
  );

  return (
    <div className="ed" style={{ ['--tl-h' as any]: `${tlH}px` }}>
      {top}
      <div className="work">
        <div className="pane left">
          <div className="tabs">
            <div className={`tab ${tab === 'media' ? 'on' : ''}`} onClick={() => setTab('media')}>Media</div>
            {script.length > 0 && <div className={`tab ${tab === 'script' ? 'on' : ''}`} onClick={() => setTab('script')}>Script</div>}
            <div className={`tab ${tab === 'subs' ? 'on' : ''}`} onClick={() => setTab('subs')}>Subtitles</div>
            <div className="grow" />
            {(L.saving || syncing > 0) && <span className="help" style={{ margin: 0 }}>{syncing ? 'syncing the line…' : 'saving…'}</span>}
          </div>
          <div className="scroll">
            {tab === 'media' && setup}
            {tab === 'media' && <Media ep={ep} project={project} urls={L.view!.urls} frame={frame} send={L.send} onLoaded={L.load}
              pick={pick && { kind: pick.kind, onPick: (id) => { pick.onPick(id); setPick(null); } }} />}
            {tab === 'subs' && <Subtitles project={project} frame={frame} sel={sel} onPick={pickItem} />}
            {tab === 'script' && <div className="lines">
              {script.map((l) => (
                <div key={l.n} className={`ln ${line === l.n ? 'on' : ''} ${nowLine === l.n ? 'now' : ''} ${l.status === 'skipped' ? 'dropped' : ''}`}
                  onClick={() => { setLine(l.n); setSel(null); if (l.start != null) seek(Math.max(0, (l.start - 0.3) * fps)); }}>
                  <div className="n">{l.n}</div>
                  <div className="av" style={{ background: 'var(--panel-3)' }}>{(l.name || '?')[0]}</div>
                  <div style={{ minWidth: 0 }}><div className="who he" style={{ textAlign: 'left' }}>{l.name}</div><div className="t he">{l.text}</div></div>
                  <div className="sdot" style={{ background: l.status === 'ok' ? 'var(--ok)' : l.status === 'check' ? 'var(--warn)' : l.status === 'missing' ? 'var(--bad)' : 'var(--faint)' }} />
                </div>))}
            </div>}
          </div>
        </div>

        <div className="pane viewer">
          <div className="monitor">
            <div ref={frameEl} style={{ position: 'relative', aspectRatio: `${project.canvas.w}/${project.canvas.h}` }}
              className={`frame ${noteOpen ? 'note-pick' : ''}`}
              onClick={(e) => { if (noteOpen) { noteSpot(e); return; } const s = frameEl.current && pickAt(project, frame, frameEl.current, e.clientX, e.clientY); if (s) { setSel(s); setLine(null); } else player.current?.toggle(); }}>
              {!noteOpen && <Handles project={project} sel={sel} frame={frame} host={frameEl.current} send={L.send} onPick={setSel} />}
              <NoteSpots notes={showDone ? notes : notes.filter((n) => !n.done)} frame={frame} fps={fps} canvas={project.canvas} open={noteOpen?.note || null} />
              {inputProps && <Player ref={player} component={Layers as any} inputProps={inputProps} durationInFrames={total} fps={fps}
                compositionWidth={project.canvas.w} compositionHeight={project.canvas.h} controls={false} clickToPlay={false} playbackRate={speed}
                numberOfSharedAudioTags={0} style={{ width: '100%', height: '100%' }} />}
            </div>
          </div>
          <div className="transport">
            <div><span className="chip">{project.canvas.w}×{project.canvas.h}{speed !== 1 ? ` · ${speed}×` : ''}</span></div>
            <div className="mid">
              <button className="btn ghost icon" title="Back 1 s (Shift+←)" onClick={() => seek(frame - fps)}>⏮</button>
              <button className="play" title="Play / pause (space)" onClick={() => player.current?.toggle()}>{playing ? '❚❚' : '▶'}</button>
              <button className="btn ghost icon" title="On 1 s (Shift+→)" onClick={() => seek(frame + fps)}>⏭</button>
            </div>
            <div className="tc">{fmtT(frame / fps / speed)} <span>/ {fmtT(total / fps / speed)}</span></div>
          </div>
        </div>

        <div className="pane right">
          {!(sel && !curLine && hasPanel(project.layers.find((l: any) => l.id === sel.layer)?.kind)) && <div className="pane-h" style={{ display: 'flex', alignItems: 'center' }}>
            <span className="grow">{curLine ? `Line #${curLine.n}` : sel ? (project.layers.find((l: any) => l.id === sel.layer)?.name || sel.layer) : 'Project'}</span>
            {(sel || curLine) && <button className="btn ghost icon" title="Back to the project settings" onClick={() => { setSel(null); setLine(null); }}>✕</button>}
          </div>}
          <div className="scroll">
            {L.error && <div className="note" style={{ whiteSpace: 'pre-wrap' }} onClick={() => L.setError(null)}>{L.error}</div>}
            {jobLine && <div className="note">{jobLine}</div>}
            {curLine ? <div className="insp">{lineCard}</div>
              : <Inspector project={project} sel={sel} send={L.send} frame={frame} onSel={(s) => { setSel(s); setLine(null); }} urls={L.view!.urls} onOpen={openClip}
                  pickAsset={(kind, onPick) => { setTab('media'); setPick({ kind, onPick }); }}
                  build={async (action, args) => { before(action); const j = await build(ep, { action, ...(args || {}) }); if (j?.running) setJob(j); else reloaded(); }} />}
          </div>
        </div>
      </div>
      <div className="split" onMouseDown={startSplit} />
      <Timeline project={project} frame={frame} sel={sel} onSel={pickItem} onSeek={seek} send={L.send} onItemEdit={onItemEdit} onItemPreview={onItemPreview} onSolo={playOnly} soloKey={soloKey} onOpen={openClip} playing={playing} notes={notes} onNote={openNote} showDone={showDone} onShowDone={setShowDone}
        canUndo={L.canUndo} canRedo={L.canRedo} onUndo={L.undo} onRedo={L.redo} />
      {openedView()}
      {noteOpen && <NoteWindow note={noteOpen.note} isNew={noteOpen.isNew} fps={fps} speed={speed} onSave={saveNote} onSeek={seek}
        onDelete={() => deleteNote(noteOpen.note.id)} onClose={() => setNoteOpen(null)} />}
    </div>
  );
}

/** A script line's subtitle words (saved when he leaves the box, any way - useTyped: picking another line kept the
 *  focus and dropped the words) */
function LineCaption({ words, save }: { words: string; save: (t: string) => void }) {
  const t = useTyped(words, save, { trim: true });
  return <><textarea className="field he" style={{ height: 70, padding: 8, userSelect: 'text' }} dir="auto" {...t.box} />{t.status}</>;
}
