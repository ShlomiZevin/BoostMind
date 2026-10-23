// The timeline of a layered project: a lane per layer, grouped (one group per character, Window, Text, Sound...),
// the top layer first. Click a block = select it; drag it = move; drag an edge = trim (a video / sound edge pulls back
// the original footage, never past the take's ends). Ctrl+wheel zooms. Every change is an op (live while dragging).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KIND_COLOR, KIND_LABEL, Send, fmtT } from './api';
import './timeline.css';

export type Sel = { layer: string; item?: string } | null;

type Props = {
  project: any; frame: number; sel: Sel; onSel: (s: Sel) => void; onSeek: (f: number) => void; send: Send;
  onItemEdit?: (layer: any, it: any, side: 'l' | 'r' | 'm', dFrames: number) => boolean | 'keep';  // a builder item: its builder takes the change
  canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void;
};

const TH = 30;  // lane height
const NW = 200;  // the names column

const EyeIc = ({ off }: { off?: boolean }) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{off && <path d="M4 4l16 16" />}</svg>;
const SpkIc = ({ off }: { off?: boolean }) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
  <path d="M4 9v6h4l5 4V5L8 9z" />{off ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" />}</svg>;

export function groupsOf(project: any) {
  // top layer first; a group sits where its topmost layer is
  const out: { name: string; layers: any[] }[] = [];
  for (const l of [...(project.layers || [])].reverse()) {
    const g = l.group || KIND_LABEL[l.kind] || 'Layers';
    const hit = out.find((x) => x.name === g);
    if (hit) hit.layers.push(l); else out.push({ name: g, layers: [l] });
  }
  // sound-only groups go under the pictures, like any editor
  return [...out.filter((g) => g.layers.some((l) => l.kind !== 'audio')), ...out.filter((g) => g.layers.every((l) => l.kind === 'audio'))];
}

// what a block says: its words (a text, a subtitle, a voice's line), else its file's name
const blockText = (l: any, it: any, project: any) => {
  if (it.text != null) return String(it.text).replace('{clock}', '00:00');
  if (l.kind === 'audio' && it.ref?.line != null) { const ln = (project.script || []).find((x: any) => x.n === it.ref.line); if (ln) return ln.text; }
  const a = project.assets?.[it.asset ?? l.props?.asset];
  return a ? a.label || String(a.src).split('/').pop() : '';
};

export function Timeline({ project, frame, sel, onSel, onSeek, send, onItemEdit, canUndo, canRedo, onUndo, onRedo }: Props) {
  const fps = project.canvas.fps, total = project.duration;
  const [pps, setPps] = useState(() => +(localStorage.getItem('zc-ly-pps') || 60));  // pixels per second
  useEffect(() => { try { localStorage.setItem('zc-ly-pps', String(pps)); } catch {} }, [pps]);
  const [closed, setClosed] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem('zc-ly-closed') || '{"Window":true}'); } catch { return { Window: true }; } });  // (the Zoom window's parts start folded)
  useEffect(() => { try { localStorage.setItem('zc-ly-closed', JSON.stringify(closed)); } catch {} }, [closed]);
  // ONE scroll box: each row = its name (sticky on the left) + its lane - they can't drift apart (timeline.css)
  const lanes = useRef<HTMLDivElement>(null);
  const px = (f: number) => (f / fps) * pps;
  const width = px(total) + 200;
  const groups = useMemo(() => groupsOf(project), [project]);
  const selLink = sel?.item ? project.layers.find((l: any) => l.id === sel.layer)?.items?.find((i: any) => i.id === sel.item)?.link : null;
  const [drag, setDrag] = useState<{ layer: string; item: string; d: number; side: string } | null>(null);

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

  // a block dragged: d frames (live draft), committed on release
  const startDrag = (e: React.MouseEvent, l: any, it: any, side: 'l' | 'r' | 'm') => {
    e.stopPropagation(); e.preventDefault();
    onSel({ layer: l.id, item: it.id });
    if (l.locked) return;
    const x0 = e.clientX;
    const asset = project.assets?.[it.asset];
    const rate = it.rate || 1;
    const opsFor = (d: number) => {
      if (side === 'm') return [{ op: 'item.update', layer: l.id, id: it.id, set: { from: Math.max(0, it.from + d) } }];
      if (side === 'r') {
        let dur = Math.max(1, it.dur + d);
        if (asset?.duration && it.in != null) dur = Math.min(dur, Math.floor((asset.duration - it.in) / rate * fps));  // never past the take's end
        return [{ op: 'item.update', layer: l.id, id: it.id, set: { dur } }];
      }
      let dd = Math.min(d, it.dur - 1);
      if (it.in != null) dd = Math.max(dd, -Math.floor((it.in / rate) * fps));  // never before the take's start
      dd = Math.max(dd, -it.from);
      return [{ op: 'item.update', layer: l.id, id: it.id, set: { from: it.from + dd, dur: it.dur - dd, ...(it.in != null ? { in: +(it.in + (dd / fps) * rate).toFixed(4) } : {}) } }];
    };
    let last = 0;
    const mv = (m: MouseEvent) => {
      const d = Math.round(((m.clientX - x0) / pps) * fps);
      if (d === last) return;
      last = d;
      setDrag({ layer: l.id, item: it.id, d, side });
      send(opsFor(d), { commit: false });
    };
    const up = () => {
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up);
      setDrag(null);
      if (!last) { send([], { commit: false }); return; }
      const taken = onItemEdit && onItemEdit(l, it, side, last);  // the builder takes it
      if (taken) { if (taken !== 'keep') send([], { commit: false }); return; }  // ('keep': the drag shows until the builder's answer lands)
      send(opsFor(last), { label: side === 'm' ? 'move' : 'trim' });
    };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };

  const step = pps >= 120 ? 1 : pps >= 50 ? 2 : pps >= 20 ? 5 : 10;
  const ticks = [];
  for (let s = 0; s <= total / fps; s += step) ticks.push(s);
  const toggle = (l: any, key: 'hidden' | 'muted') => send([{ op: 'layer.update', id: l.id, set: { [key]: !l[key] } }], { label: key });

  return (
    <div className="tl">
      <div className="tl-bar">
        <button className="btn ghost icon" disabled={!canUndo} title="Undo (Ctrl+Z)" onClick={onUndo}>↶</button>
        <button className="btn ghost icon" disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" onClick={onRedo}>↷</button>
        <div className="vsep" />
        <span className="chip">{project.layers.length} layers · {project.layers.reduce((n: number, l: any) => n + (l.items?.length || 0), 0)} items</span>
        <div className="grow" />
        <button className="btn ghost" style={{ height: 26, padding: '0 9px', fontSize: 12 }} title="The whole video in view"
          onClick={() => { const w = (lanes.current?.clientWidth || 1000) - NW; setPps(Math.max(8, (w - 40) / (total / fps))); }}>Fit</button>
        <span style={{ color: 'var(--faint)', fontSize: 12 }}>Zoom</span>
        <input type="range" min={8} max={400} value={pps} onChange={(e) => setPps(+e.target.value)} />
      </div>
      <div className="ltl" ref={lanes} style={{ ['--th' as any]: `${TH}px`, ['--nw' as any]: `${NW}px` }}
        onWheel={(e) => { if (e.ctrlKey) { e.preventDefault(); setPps((p) => Math.max(8, Math.min(400, p * (e.deltaY < 0 ? 1.15 : 0.87)))); } }}>
        <div className="ltl-in" style={{ width: NW + width }}>
          <div className="ltl-row ltl-ruler">
            <div className="ltl-name" />
            <div className="ltl-track" style={{ width }} onMouseDown={seekAt}>
              {ticks.map((s) => <div key={s} className="tick" style={{ left: s * pps }}><span>{fmtT(s).replace(/\.\d$/, '')}</span></div>)}
            </div>
          </div>
          {groups.map((g) => (
            <React.Fragment key={g.name}>
              <div className="ltl-row ltl-grp">
                <div className="ltl-name" onClick={() => setClosed({ ...closed, [g.name]: !closed[g.name] })}>
                  <span className="caret">{closed[g.name] ? '▸' : '▾'}</span><span className="nm he" style={{ direction: 'rtl' }}>{g.name}</span>
                </div>
                <div className="ltl-track" style={{ width }} onMouseDown={seekAt} />
              </div>
              {!closed[g.name] && g.layers.map((l) => (
                <div key={l.id} data-lane={l.id} className={`ltl-row ltl-lay ${sel?.layer === l.id ? 'sel' : ''}`}>
                  <div className="ltl-name" style={{ opacity: l.hidden ? 0.5 : 1 }} onClick={() => onSel({ layer: l.id })} title={`${KIND_LABEL[l.kind]} · ${l.id}`}>
                    <span className="dot" style={{ background: KIND_COLOR[l.kind] }} />
                    <span className="nm" dir="auto">{l.name || l.id}</span>
                    {l.kind === 'audio'
                      ? <button className="btn ghost icon" style={{ width: 22, height: 22 }} title={l.muted ? 'Sound on' : 'Mute'} onClick={(e) => { e.stopPropagation(); toggle(l, 'muted'); }}><SpkIc off={l.muted} /></button>
                      : <button className="btn ghost icon" style={{ width: 22, height: 22 }} title={l.hidden ? 'Show' : 'Hide'} onClick={(e) => { e.stopPropagation(); toggle(l, 'hidden'); }}><EyeIc off={l.hidden} /></button>}
                  </div>
                  <div className="ltl-track" style={{ width, opacity: l.hidden || l.muted ? 0.45 : 1 }}
                    onMouseDown={(e) => { if (e.target === e.currentTarget) { onSel({ layer: l.id }); seekAt(e); } }}>
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
                      return (
                        <div key={it.id} data-layer={l.id} data-item={it.id} className={`blk ${isSel ? 'sel' : ''} ${linked ? 'linked' : ''} ${drag?.item === it.id && drag.layer === l.id ? 'dragging' : ''}`}
                          style={{ left: px(it.from), width: Math.max(3, w), background: KIND_COLOR[l.kind], opacity: it.hidden ? 0.4 : 1, top: 4, bottom: 4, padding: w > 30 ? '0 6px' : 0,
                            color: l.kind === 'text' ? '#2a2000' : '#fff', fontSize: 11 }}
                          title={blockText(l, it, project)}
                          onMouseDown={(e) => startDrag(e, l, it, 'm')}>
                          {w > 24 && <span className="he" style={{ overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none' }}>{blockText(l, it, project)}</span>}
                          {w > 14 && <><div className="hd l" onMouseDown={(e) => startDrag(e, l, it, 'l')} /><div className="hd r" onMouseDown={(e) => startDrag(e, l, it, 'r')} /></>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </React.Fragment>
          ))}
          <div className="playhead" style={{ left: NW + px(frame), height: '100%' }} />
        </div>
      </div>
    </div>
  );
}
