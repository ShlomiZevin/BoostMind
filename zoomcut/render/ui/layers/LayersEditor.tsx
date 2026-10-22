// THE editor for a layered project (project.json): Media / Script on the left, the video (render/src/Layers.tsx - the
// same composition the export draws) in the middle, the picked layer's settings on the right, a lane per layer below.
// Every change is an op (./api.ts): instant in the preview, saved, undoable. A Zoom project's lines still go through
// its builder (the Script tab, dragging a voice block): the analysis re-runs and its layers come back merged.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { Layers } from '../../src/Layers';
import { useLayered, build, fmtT } from './api';
import { Timeline, Sel } from './Timeline';
import { Media } from './Media';
import { Inspector } from './Inspector';
import { LineProps } from '../editor';

type Props = { ep: string; top: React.ReactNode; job: any; setJob: (j: any) => void; jobLine: string; reloadEp: () => void; chars: any[] };

export function LayersEditor({ ep, top, job, setJob, jobLine, chars }: Props) {
  const L = useLayered(ep);
  const project = L.live;
  const player = useRef<PlayerRef>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sel, setSel] = useState<Sel>(null);
  const [line, setLine] = useState<number | null>(null);
  const [pick, setPick] = useState<{ kind: string; onPick: (id: string) => void } | null>(null);  // a panel asked for a file from Media
  const [tab, setTab] = useState<'media' | 'script'>(() => (localStorage.getItem('zc-ly-tab') as any) || 'media');
  useEffect(() => { try { localStorage.setItem('zc-ly-tab', tab); } catch {} }, [tab]);
  const [tlH, setTlH] = useState(+(localStorage.getItem('zc-ly-tlh') || 340));
  useEffect(() => { try { localStorage.setItem('zc-ly-tlh', String(tlH)); } catch {} }, [tlH]);

  // a builder job (re-analyze, a line fix) ended: its layers changed on disk
  const wasRunning = useRef(false);
  useEffect(() => { if (wasRunning.current && !job?.running) L.load(); wasRunning.current = !!job?.running; }, [job?.running]);

  useEffect(() => {
    const p = player.current; if (!p) return;
    const fu = (e: any) => setFrame(e.detail.frame), pl = () => setPlaying(true), pa = () => setPlaying(false);
    p.addEventListener('frameupdate', fu); p.addEventListener('play', pl); p.addEventListener('pause', pa);
    return () => { p.removeEventListener('frameupdate', fu); p.removeEventListener('play', pl); p.removeEventListener('pause', pa); };
  }, [!!project]);

  const fps = project?.canvas.fps || 30;
  const total = project?.duration || 1;
  const speed = project?.speed || 1;
  const seek = (f: number) => { const g = Math.max(0, Math.min(total - 1, Math.round(f))); player.current?.seekTo(g); setFrame(g); };
  const inputProps = useMemo(() => project && ({ project, urls: L.view!.urls, mode: 'full' as const, playing, playbackRate: speed }),
    [project, L.view?.urls, playing, speed]);

  // keys: space play, arrows step / jump, Ctrl+Z / Ctrl+Shift+Z, Delete the picked item
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? L.redo() : L.undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); L.redo(); }
      else if (e.code === 'Space') { e.preventDefault(); player.current?.toggle(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); seek(frame + (e.shiftKey ? fps : 1)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); seek(frame - (e.shiftKey ? fps : 1)); }
      else if (e.key === 'Home') { e.preventDefault(); seek(0); }
      else if (e.key === 'End') { e.preventDefault(); seek(total - 1); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && sel?.item) {
        e.preventDefault();
        L.send([{ op: 'item.remove', layer: sel.layer, id: sel.item }], { label: 'delete' });
        setSel({ layer: sel.layer });
      } else if (e.key === 'Escape') { setSel(null); setLine(null); }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  });

  // a Zoom line: its voice / subtitle blocks belong to the analysis - dragging one fixes the line (as the old screen did)
  const script: any[] = project?.script || [];
  const lineFix = async (n: number, fix: any) => {
    const clean = Object.fromEntries(Object.entries(fix || {}).filter(([, v]) => v !== undefined && v !== null && v !== ''));
    const j = await build(ep, { action: 'line', n, fix: clean });
    setJob(j);
  };
  const onItemEdit = (l: any, it: any, side: 'l' | 'r' | 'm', d: number) => {
    if (project?.builder?.kind !== 'zoom' || l.owner !== 'builder' || l.kind !== 'audio' || it.ref?.line == null) return false;
    const ln = script.find((x) => x.n === it.ref.line);
    if (!ln || ln.in == null) return false;
    const sec = d / fps, fx = ln.fix || {};
    if (side === 'm') lineFix(ln.n, { ...fx, shift: +((fx.shift || 0) + sec).toFixed(3) });
    else {
      const base = { ...fx, clip: fx.clip ?? ln.clip, in: fx.in ?? ln.in };
      if (side === 'l') lineFix(ln.n, ln.interrupted ? { ...base, in: Math.max(0, +(base.in + sec).toFixed(3)), out: undefined, cut: fx.cut ?? ln.cut }
        : { ...base, in: Math.max(0, +(base.in + sec).toFixed(3)), out: fx.out ?? ln.out });
      else if (ln.interrupted) lineFix(ln.n, { ...base, out: undefined, cut: +((fx.cut ?? ln.cut) + sec).toFixed(3) });
      else lineFix(ln.n, { ...base, out: +((fx.out ?? ln.out) + sec).toFixed(3) });
    }
    return true;
  };

  const startSplit = (e: React.MouseEvent) => {
    const y0 = e.clientY, h0 = tlH;
    const mv = (m: MouseEvent) => setTlH(Math.max(180, Math.min(innerHeight - 300, h0 - (m.clientY - y0))));
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };

  if (!project) return <div className="ed">{top}<div className="empty" style={{ padding: 30 }}>Loading the layers…</div></div>;
  const busy = !!job?.running;
  const nowLine = [...script].reverse().find((l) => l.start != null && l.start <= frame / fps + 0.01)?.n;
  const curLine = line != null ? script.find((l) => l.n === line) : null;
  const lineCard = curLine && (
    <>
      <LineProps key={curLine.n} l={curLine} busy={busy} chars={chars} onFix={(f: any) => lineFix(curLine.n, f)} />
      <div className="card">
        <div className="card-h"><div className="title grow">Subtitle words</div></div>
        <textarea className="field he" style={{ height: 70, padding: 8, userSelect: 'text' }} key={curLine.n} defaultValue={curLine.fix?.caption || curLine.text}
          onBlur={async (e) => { const t = e.target.value.trim(); if (t !== (curLine.fix?.caption || curLine.text)) { await build(ep, { action: 'caption', n: curLine.n, text: t === curLine.text ? '' : t }); L.load(); } }} />
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
            <div className="grow" />
            {L.saving && <span className="help" style={{ margin: 0 }}>saving…</span>}
          </div>
          <div className="scroll">
            {tab === 'media' && <Media ep={ep} project={project} urls={L.view!.urls} frame={frame} send={L.send} onLoaded={L.load}
              pick={pick && { kind: pick.kind, onPick: (id) => { pick.onPick(id); setPick(null); } }} />}
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
            <div className="frame" style={{ position: 'relative', aspectRatio: `${project.canvas.w}/${project.canvas.h}` }}>
              {inputProps && <Player ref={player} component={Layers as any} inputProps={inputProps} durationInFrames={total} fps={fps}
                compositionWidth={project.canvas.w} compositionHeight={project.canvas.h} controls={false} clickToPlay playbackRate={speed}
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
          <div className="pane-h" style={{ display: 'flex', alignItems: 'center' }}>
            <span className="grow">{curLine ? `Line #${curLine.n}` : sel ? (project.layers.find((l: any) => l.id === sel.layer)?.name || sel.layer) : 'Project'}</span>
            {(sel || curLine) && <button className="btn ghost icon" title="Back to the project settings" onClick={() => { setSel(null); setLine(null); }}>✕</button>}
          </div>
          <div className="scroll">
            {L.error && <div className="note" style={{ whiteSpace: 'pre-wrap' }} onClick={() => L.setError(null)}>{L.error}</div>}
            {jobLine && <div className="note">{jobLine}</div>}
            {curLine ? <div className="insp">{lineCard}</div>
              : <Inspector project={project} sel={sel} send={L.send} frame={frame} onSel={(s) => { setSel(s); setLine(null); }} urls={L.view!.urls}
                  pickAsset={(kind, onPick) => { setTab('media'); setPick({ kind, onPick }); }}
                  build={async (action, args) => { const j = await build(ep, { action, ...(args || {}) }); if (j?.running) setJob(j); else L.load(); }} />}
          </div>
        </div>
      </div>
      <div className="split" onMouseDown={startSplit} />
      <Timeline project={project} frame={frame} sel={sel} onSel={(s) => { setSel(s); setLine(null); }} onSeek={seek} send={L.send} onItemEdit={onItemEdit}
        canUndo={L.canUndo} canRedo={L.canRedo} onUndo={L.undo} onRedo={L.redo} />
    </div>
  );
}
