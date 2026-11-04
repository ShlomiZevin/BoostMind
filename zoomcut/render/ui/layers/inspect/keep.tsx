// "Keep things…" - what the cut-out keeps besides him (his ask, 2026-11-04: "mark what I want to keep from a video... it
// catches the thing I mark to its edges, like CapCut... so the session will know"). A frame of the take: tap / paint on
// the thing (right-click or "Not this" = leave that part out), SAM 2 shows its outline at once (render/actions/keep.mjs
// -> tools/sam/keep.py serve). Each thing gets a name; Keep them = episode.json keep_objects[<take>] + Analyze, which
// follows each thing through the take into the cut-out (lesson.py keep_objects_matte). Sessions read / write the same
// marks (skill: edit-video, layers.md "Keep things").
import React, { useEffect, useRef, useState } from 'react';
import { build as callBuild } from '../api';
import { tabProject } from '../../common';
import { InspectorProps, Note } from './controls';
import './keep.css';

type Pt = [number, number, number];  // fx, fy (fractions of the take's own frame - before a mirror), 1 keep / 0 not this
type Obj = { what: string; t: number; points: Pt[]; from?: number; to?: number };

export function KeepThings({ P, mirrored, onDone }: { P: InspectorProps; mirrored: boolean; onDone: () => void }) {
  const ep = tabProject.get();
  const { layer, item, fps, frame } = P;
  // the clip: the picked one, else the one under the playhead, else the first
  const clip = item || (layer.items || []).find((i: any) => frame >= i.from && frame < i.from + i.dur) || layer.items?.[0];
  const asset = clip?.asset;
  const rate = clip?.rate || 1;
  const t0 = clip?.in ?? 0, t1 = t0 + ((clip?.dur || 1) / fps) * rate;
  const atHead = clip && frame >= clip.from && frame < clip.from + clip.dur ? t0 + ((frame - clip.from) / fps) * rate : t0 + Math.min(0.3, (t1 - t0) / 2);
  const [ready, setReady] = useState<boolean | null>(null);
  const [objs, setObjs] = useState<Obj[]>([]);
  const [cur, setCur] = useState(0);
  const [img, setImg] = useState<{ w: number; h: number; src: string; t: number } | null>(null);
  const [mask, setMask] = useState<string | null>(null);
  const [mode, setMode] = useState<1 | 0>(1);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const stage = useRef<HTMLDivElement>(null);
  const ask = (body: any) => callBuild(ep, { action: 'keep', asset, ...body });
  const o = objs[cur];

  const loadFrame = async (t: number) => {
    setBusy(img ? 'Loading the frame…' : 'Loading - the first time takes a few seconds…'); setErr('');
    const j = await ask({ op: 'frame', t }).catch((e: any) => ({ error: String(e) }));
    setBusy('');
    if (j.error) { setErr(j.error); return false; }
    setImg({ w: j.w, h: j.h, src: `data:image/jpeg;base64,${j.jpg}`, t });
    return true;
  };
  const outline = async (pts: Pt[]) => {
    if (!pts.some((p) => p[2])) { setMask(null); return; }
    const j = await ask({ op: 'mask', points: pts });
    if (j.error) setErr(j.error); else { setErr(''); setMask(`data:image/png;base64,${j.png}`); }
  };
  useEffect(() => {  // what is already kept on this take; a first thing to mark at the playhead
    if (!asset) return;
    (async () => {
      const s = await ask({ op: 'state' }).catch(() => null);
      setReady(!!s?.ready);
      if (!s?.ready) return;
      const have: Obj[] = s.objects?.length ? s.objects : [{ what: '', t: +atHead.toFixed(3), points: [] }];
      setObjs(have); setCur(0);
      if (await loadFrame(have[0].t)) outline(have[0].points);
    })();
  }, [asset]);

  const setPoints = (pts: Pt[]) => {
    setObjs((all) => all.map((x, i) => (i === cur ? { ...x, points: pts } : x)));
    outline(pts);
  };
  const pick = async (i: number) => {
    setCur(i); setMask(null);
    if (await loadFrame(objs[i].t)) outline(objs[i].points);
  };
  const another = async () => {
    const t = img?.t ?? atHead;
    setObjs((all) => [...all, { what: '', t, points: [] }]); setCur(objs.length); setMask(null);
  };
  const remove = (i: number) => {
    const next = objs.filter((_, k) => k !== i);
    setObjs(next.length ? next : [{ what: '', t: img?.t ?? atHead, points: [] }]);
    const n = Math.max(0, Math.min(cur, next.length - 1)); setCur(n);
    if (next[n]) outline(next[n].points); else setMask(null);
  };
  const moment = async (t: number) => {  // another moment for this thing: its marks were for the old one
    setObjs((all) => all.map((x, i) => (i === cur ? { ...x, t, points: [] } : x))); setMask(null);
    await loadFrame(t);
  };

  // tap / paint: a point where the mouse goes down, more along the stroke; the outline follows each one
  const at = (e: React.MouseEvent | MouseEvent): [number, number] => {
    const r = stage.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    return [mirrored ? 1 - x : x, y];
  };
  const down = (e: React.MouseEvent) => {
    if (!img || !o) return;
    e.preventDefault();
    const lab = e.button === 2 || e.altKey ? 0 : mode;
    let pts: Pt[] = [...o.points, [...at(e), lab] as Pt];
    setPoints(pts);
    let last = { x: e.clientX, y: e.clientY }, sent = Date.now();
    const mv = (m: MouseEvent) => {
      if (Math.hypot(m.clientX - last.x, m.clientY - last.y) < 22 || pts.length >= 40) return;
      last = { x: m.clientX, y: m.clientY };
      pts = [...pts, [...at(m), lab] as Pt];
      setObjs((all) => all.map((x, i) => (i === cur ? { ...x, points: pts } : x)));
      if (Date.now() - sent > 150) { sent = Date.now(); outline(pts); }
    };
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); outline(pts); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };

  const save = async () => {
    setBusy('Saving…');
    try { await P.build?.('keep', { op: 'save', asset, objects: objs.map((x, i) => ({ ...x, what: x.what || `thing ${i + 1}` })), build: true }); onDone(); }
    finally { setBusy(''); }
  };

  if (!asset) return <Note>No take on this layer.</Note>;
  if (ready === false) return <Note warn>The outline tool isn't installed on this computer (tools/sam). A session can set it up.</Note>;
  const secs = P.project.assets?.[asset]?.duration || t1 - t0;
  const marked = objs.filter((x) => x.points.some((p) => p[2]));
  const dw = img ? Math.round((440 * img.w) / img.h) : 248;
  return <section className="ins-sec kp">
    <div className="kp-things">
      {objs.map((x, i) => <span key={i} className={`kp-thing ${i === cur ? 'on' : ''}`}>
        <button onClick={() => pick(i)}>{x.what || `Thing ${i + 1}`}{x.points.some((p) => p[2]) ? '' : ' · not marked'}</button>
        {objs.length > 1 || x.points.length ? <button className="kp-x" title="Remove it" onClick={() => remove(i)}>✕</button> : null}
      </span>)}
      <button className="kp-add" onClick={another}>+ Another thing</button>
    </div>
    {o && <input className="field kp-name" dir="auto" value={o.what} placeholder="What is it? (the cookie box)"
      onChange={(e) => setObjs((all) => all.map((x, i) => (i === cur ? { ...x, what: e.target.value } : x)))} />}
    <div className="kp-tools">
      <div className="ins-seg kp-mode">
        <button className={mode === 1 ? 'on' : ''} onClick={() => setMode(1)}>Keep this</button>
        <button className={mode === 0 ? 'on' : ''} onClick={() => setMode(0)}>Not this</button>
      </div>
      <button className="btn" disabled={!o?.points.length} onClick={() => setPoints(o.points.slice(0, -1))} title="Take back the last mark">Undo mark</button>
      <button className="btn" disabled={!o?.points.length} onClick={() => setPoints([])}>Clear</button>
    </div>
    <div className="kp-stage" ref={stage} style={{ width: dw, height: 440 }} onMouseDown={down} onContextMenu={(e) => e.preventDefault()}>
      {img && <img src={img.src} alt="" draggable={false} style={mirrored ? { transform: 'scaleX(-1)' } : undefined} />}
      {img && mask && <div className="kp-mask" style={{ WebkitMaskImage: `url(${mask})`, maskImage: `url(${mask})`, ...(mirrored ? { transform: 'scaleX(-1)' } : {}) }} />}
      {o?.points.map((p, i) => <i key={i} className={`kp-pt ${p[2] ? 'k' : 'n'}`} style={{ left: `${(mirrored ? 1 - p[0] : p[0]) * 100}%`, top: `${p[1] * 100}%` }} />)}
      {(busy || !img) && <div className="kp-busy">{busy || 'Loading…'}</div>}
    </div>
    {o && <div className="kp-when">
      <span>Moment</span>
      <input type="range" min={t0} max={t1} step={0.05} defaultValue={o.t} key={`${cur}-${o.t}`} onMouseUp={(e) => moment(+(e.target as HTMLInputElement).value)} />
      <b>{o.t.toFixed(1)} s</b>
    </div>}
    {err && <Note warn>{err}</Note>}
    <Note>Tap or paint on the thing - its outline shows in green. Right-click (or Not this) for a part that shouldn't stay. Pick a moment where it is clearly seen.</Note>
    <button className="btn primary ins-wide" disabled={!marked.length || !!busy} onClick={save}>
      Keep {marked.length === 1 ? (marked[0].what || 'it') : `${marked.length} things`} · make the cut-out</button>
    <Note>Follows {marked.length === 1 ? 'it' : 'them'} through the whole take - about {Math.max(1, Math.round((secs * 5) / 60))} min for {Math.round(secs)} s, in Jobs. You can keep editing.</Note>
  </section>;
}
