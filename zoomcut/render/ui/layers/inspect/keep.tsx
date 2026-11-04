// "Keep things…" - what the cut-out keeps besides him (his ask, 2026-11-04: "mark what I want to keep from a video... it
// catches the thing I mark to its edges, like CapCut... so the session will know"; the layout from a GPT Image concept he
// asked for: the things as cards on the left, the frame big in the middle, how to mark on the right, one green action).
// Tap / paint on a thing (right-click or "Not this" = leave that part out): SAM 2 outlines it at once
// (render/actions/keep.mjs -> tools/sam/keep.py serve). Keep = episode.json keep_objects[<take>] + Analyze, which follows
// each thing through the take into the cut-out (lesson.py keep_objects_matte). Sessions read / write the same marks
// (skill: edit-video, reference.md "KEEP THINGS").
import React, { useEffect, useRef, useState } from 'react';
import { build as callBuild } from '../api';
import { tabProject } from '../../common';
import { InspectorProps } from './controls';
import './keep.css';

type Pt = [number, number, number];  // fx, fy (fractions of the take's own frame - before a mirror), 1 keep / 0 not this
type Obj = { what: string; t: number; points: Pt[]; from?: number; to?: number; thumb?: string; mask?: string; edge?: string };

const mmss = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const Ic = {
  keep: <svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#2fae64" /><circle cx="12" cy="12" r="4.5" fill="none" stroke="#fff" strokeWidth="2.4" /></svg>,
  not: <svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#e0574e" /><path d="M8 8l8 8M16 8l-8 8" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /></svg>,
  many: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f0b44c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="12" height="12" rx="2.5" /><path d="M9 3h10a2 2 0 0 1 2 2v10" /></svg>,
  undo: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>,
  more: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>,
  ok: <svg width="13" height="13" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#2fae64" /><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  todo: <svg width="13" height="13" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2" /></svg>,
};

/** Its outline as a picture: the mask's edge, 2 px, drawn over the frame (a light tint + a crisp line - his concept). */
const edgeOf = (mask: string) => new Promise<string>((ok) => {
  const m = new Image();
  m.onload = () => {
    const w = m.naturalWidth, h = m.naturalHeight, c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d')!;
    g.drawImage(m, 0, 0);
    const src = g.getImageData(0, 0, w, h), a = src.data, out = g.createImageData(w, h), o = out.data;
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && a[(y * w + x) * 4 + 3] > 127;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      if (inside(x - 2, y) && inside(x + 2, y) && inside(x, y - 2) && inside(x, y + 2) && inside(x - 1, y - 1) && inside(x + 1, y + 1)) continue;
      const k = (y * w + x) * 4; o[k] = 120; o[k + 1] = 245; o[k + 2] = 170; o[k + 3] = 255;
    }
    g.putImageData(out, 0, 0);
    ok(c.toDataURL('image/png'));
  };
  m.src = mask;
});

/** The thing's picture for its card: the frame cropped to where its outline is. */
const thumbOf = (frame: string, mask: string, mirrored: boolean) => new Promise<string>((ok) => {
  const f = new Image(), m = new Image();
  let n = 0;
  const go = () => {
    if (++n < 2) return;
    const w = f.naturalWidth, h = f.naturalHeight, c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d')!;
    g.drawImage(m, 0, 0, w, h);
    const a = g.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (a[(y * w + x) * 4 + 3] > 127) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 <= x0) return ok('');
    const s = Math.max(x1 - x0, y1 - y0) * 1.08, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, o = document.createElement('canvas');
    o.width = o.height = 96;
    const og = o.getContext('2d')!;
    if (mirrored) { og.translate(96, 0); og.scale(-1, 1); }
    og.fillStyle = '#111'; og.fillRect(0, 0, 96, 96);
    og.drawImage(f, cx - s / 2, cy - s / 2, s, s, 0, 0, 96, 96);
    ok(o.toDataURL('image/jpeg', 0.85));
  };
  f.onload = go; m.onload = go; f.src = frame; m.src = mask;
});

export function KeepThings({ P, mirrored, onDone }: { P: InspectorProps; mirrored: boolean; onDone: () => void }) {
  const ep = tabProject.get();
  const { layer, item, fps, frame } = P;
  // the clip: the picked one, else the one under the playhead, else the first
  const clip = item || (layer.items || []).find((i: any) => frame >= i.from && frame < i.from + i.dur) || layer.items?.[0];
  const asset = clip?.asset;
  const rate = clip?.rate || 1;
  const t0 = clip?.in ?? 0, t1 = t0 + ((clip?.dur || 1) / fps) * rate;
  const total = P.project.assets?.[asset]?.duration || t1;
  const atHead = clip && frame >= clip.from && frame < clip.from + clip.dur ? t0 + ((frame - clip.from) / fps) * rate : t0 + Math.min(0.3, (t1 - t0) / 2);
  const [ready, setReady] = useState<boolean | null>(null);
  const [objs, setObjs] = useState<Obj[]>([]);
  const [cur, setCur] = useState(0);
  const [img, setImg] = useState<{ w: number; h: number; src: string; t: number } | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const [mode, setMode] = useState<1 | 0>(1);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [menu, setMenu] = useState<number | null>(null);
  const [naming, setNaming] = useState<number | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const imgRef = useRef(img);
  imgRef.current = img;
  const ask = (body: any) => callBuild(ep, { action: 'keep', asset, ...body });
  const o = objs[cur];
  const marked = (x?: Obj) => !!x?.points.some((p) => p[2]);
  const upd = (i: number, patch: Partial<Obj>) => setObjs((all) => all.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  const loadFrame = async (t: number) => {
    setBusy(imgRef.current ? 'Loading the frame…' : 'Getting ready - the first time takes a few seconds…'); setErr('');
    const j = await ask({ op: 'frame', t }).catch((e: any) => ({ error: String(e) }));
    setBusy('');
    if (j.error) { setErr(j.error); return null; }
    const v = { w: j.w, h: j.h, src: `data:image/jpeg;base64,${j.jpg}`, t };
    setImg(v);
    return v;
  };
  const outline = async (i: number, pts: Pt[], fr = imgRef.current) => {
    if (!pts.some((p) => p[2])) { upd(i, { mask: undefined, edge: undefined, thumb: undefined }); return; }
    const j = await ask({ op: 'mask', points: pts });
    if (j.error) { setErr(j.error); return; }
    setErr('');
    const mask = `data:image/png;base64,${j.png}`;
    upd(i, { mask });
    edgeOf(mask).then((edge) => upd(i, { edge }));
    if (fr) thumbOf(fr.src, mask, mirrored).then((thumb) => upd(i, { thumb }));
  };
  useEffect(() => {  // what is already kept on this take; else a first thing to mark at the playhead
    if (!asset) return;
    (async () => {
      const s = await ask({ op: 'state' }).catch(() => null);
      setReady(!!s?.ready);
      if (!s?.ready) return;
      const have: Obj[] = s.objects?.length ? s.objects : [{ what: '', t: +atHead.toFixed(3), points: [] }];
      setObjs(have); setCur(0);
      if (!s.objects?.length) setNaming(0);
      // (each saved thing's outline + picture, from its own moment; the first one's frame stays up)
      for (let i = have.length - 1; i >= 0; i--) { const fr = await loadFrame(have[i].t); if (fr) await outline(i, have[i].points, fr); }
    })();
  }, [asset]);

  const pick = async (i: number) => {
    setCur(i); setMenu(null);
    if (img?.t !== objs[i].t) { const fr = await loadFrame(objs[i].t); if (fr && marked(objs[i])) outline(i, objs[i].points, fr); }
  };
  const another = () => {
    setObjs((all) => [...all, { what: '', t: img?.t ?? atHead, points: [] }]);
    setCur(objs.length); setNaming(objs.length);
  };
  const remove = (i: number) => {
    setMenu(null);
    const next = objs.filter((_, k) => k !== i);
    setObjs(next.length ? next : [{ what: '', t: img?.t ?? atHead, points: [] }]);
    setCur(Math.max(0, Math.min(cur > i ? cur - 1 : cur, next.length - 1)));
  };
  const setPoints = (pts: Pt[]) => { upd(cur, { points: pts }); outline(cur, pts); };
  const moment = async (t: number) => {  // another moment for this thing: its marks were for the old one
    setScrub(null);
    if (Math.abs(t - (img?.t ?? -1)) < 0.03) return;
    upd(cur, { t, points: [], mask: undefined, edge: undefined, thumb: undefined });
    await loadFrame(t);
  };

  // tap / paint: a mark where the mouse goes down, more along the stroke; the outline follows them
  const at = (e: React.MouseEvent | MouseEvent): [number, number] => {
    const r = stage.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    return [mirrored ? 1 - x : x, y];
  };
  const down = (e: React.MouseEvent) => {
    if (!img || !o || busy) return;
    e.preventDefault();
    const lab = e.button === 2 || e.altKey ? 0 : mode;
    let pts: Pt[] = [...o.points, [...at(e), lab] as Pt];
    setPoints(pts);
    let last = { x: e.clientX, y: e.clientY }, sent = Date.now();
    const i = cur;
    const mv = (m: MouseEvent) => {
      if (Math.hypot(m.clientX - last.x, m.clientY - last.y) < 22 || pts.length >= 40) return;
      last = { x: m.clientX, y: m.clientY };
      pts = [...pts, [...at(m), lab] as Pt];
      upd(i, { points: pts });
      if (Date.now() - sent > 150) { sent = Date.now(); outline(i, pts); }
    };
    const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); outline(i, pts); };
    addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };

  const save = async () => {
    setBusy('Saving…');
    try {
      await P.build?.('keep', { op: 'save', asset, build: true,
        objects: objs.filter(marked).map((x, i) => ({ what: x.what.trim() || `thing ${i + 1}`, t: x.t, points: x.points, from: x.from, to: x.to })) });
      onDone();
    } finally { setBusy(''); }
  };

  if (!asset) return <div className="kp-empty">No take on this layer.</div>;
  if (ready === false) return <div className="kp-empty">The outline tool isn't installed on this computer (tools/sam) - a session can set it up.</div>;
  const n = objs.filter(marked).length;
  const mins = Math.max(1, Math.round((total * 8) / 60));  // (measured: a 37 s take, 5 min - following + the cut-out)
  const sh = 520, sw = img ? Math.round((sh * img.w) / img.h) : Math.round((sh * 9) / 16);
  const tShow = scrub ?? img?.t ?? atHead;
  return <div className="kp">
    <div className="kp-body">
      <div className="kp-col kp-list">
        <div className="kp-h">Things to keep</div>
        {objs.map((x, i) => <div key={i} className={`kp-card ${i === cur ? 'on' : ''}`} onClick={() => pick(i)}>
          <div className="kp-thumb">{x.thumb ? <img src={x.thumb} alt="" /> : <span>{i + 1}</span>}</div>
          <div className="kp-card-t">
            {naming === i
              ? <input autoFocus className="kp-name" dir="auto" value={x.what} placeholder="What is it?" onClick={(e) => e.stopPropagation()}
                  onChange={(e) => upd(i, { what: e.target.value })} onBlur={() => setNaming(null)}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') setNaming(null); }} />
              : <b dir="auto" onDoubleClick={(e) => { e.stopPropagation(); setNaming(i); }}>{x.what || `Thing ${i + 1}`}</b>}
            <span className={`kp-state ${marked(x) ? 'ok' : ''}`}>{marked(x) ? Ic.ok : Ic.todo}{marked(x) ? 'Marked' : 'Not marked yet'}</span>
          </div>
          <button className="kp-more" title="Rename / remove" onClick={(e) => { e.stopPropagation(); setMenu(menu === i ? null : i); }}>{Ic.more}</button>
          {menu === i && <div className="kp-menu" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { setMenu(null); setNaming(i); }}>Rename</button>
            <button className="bad" onClick={() => remove(i)}>Remove</button>
          </div>}
        </div>)}
        <button className="kp-add" onClick={another}>+ Add another thing</button>
      </div>

      <div className="kp-col kp-mid">
        <div className="kp-stage" ref={stage} style={{ width: sw, height: sh }} onMouseDown={down} onContextMenu={(e) => e.preventDefault()}>
          {img && <img className="kp-frame" src={img.src} alt="" draggable={false} style={mirrored ? { transform: 'scaleX(-1)' } : undefined} />}
          {img && o?.mask && <div className="kp-mask" style={{ WebkitMaskImage: `url(${o.mask})`, maskImage: `url(${o.mask})`, ...(mirrored ? { transform: 'scaleX(-1)' } : {}) }} />}
          {img && o?.edge && <img className="kp-edge" src={o.edge} alt="" draggable={false} style={mirrored ? { transform: 'scaleX(-1)' } : undefined} />}
          {o?.points.map((p, i) => <i key={i} className={`kp-pt ${p[2] ? 'k' : 'n'}`} style={{ left: `${(mirrored ? 1 - p[0] : p[0]) * 100}%`, top: `${p[1] * 100}%` }} />)}
          <span className="kp-time">{mmss(tShow)} / {mmss(total)}</span>
          {(busy || !img) && <div className="kp-busy"><i />{busy || 'Getting ready…'}</div>}
        </div>
        <div className="kp-scrub" style={{ width: sw }}>
          <input type="range" min={t0} max={t1} step={0.05} value={tShow} disabled={!!busy}
            onChange={(e) => setScrub(+e.target.value)} onMouseUp={(e) => moment(+(e.target as HTMLInputElement).value)}
            onKeyUp={(e) => moment(+(e.target as HTMLInputElement).value)} />
          <span>{mmss(tShow)}</span>
        </div>
      </div>

      <div className="kp-col kp-help">
        <div className="kp-h">How to mark</div>
        <div className="kp-tip">{Ic.keep}<div><b>Tap or paint on a thing to keep it</b><span>We'll find its exact edges automatically.</span></div></div>
        <div className="kp-tip">{Ic.not}<div><b>Mark a part to not keep</b><span>Right-click, or choose Not this and paint on what shouldn't stay.</span></div></div>
        <div className="kp-tip">{Ic.many}<div><b>Several things, one clip</b><span>Name each one. Pick a moment where it is clearly seen - it's followed through the whole clip.</span></div></div>
        {err && <div className="kp-err">{err}</div>}
      </div>
    </div>

    <div className="kp-foot">
      <div className="kp-mode">
        <button className={mode === 1 ? 'on k' : ''} onClick={() => setMode(1)}>{Ic.keep}Keep</button>
        <button className={mode === 0 ? 'on n' : ''} onClick={() => setMode(0)}>{Ic.not}Not this</button>
      </div>
      <button className="btn kp-btn" disabled={!o?.points.length} onClick={() => setPoints([])}>Clear marks</button>
      <button className="btn kp-btn" disabled={!o?.points.length} onClick={() => setPoints(o.points.slice(0, -1))}>{Ic.undo}Undo</button>
      <div className="kp-go">
        <button className="kp-primary" disabled={!n || !!busy} onClick={save}>
          {n ? `Keep ${n === 1 ? '1 thing' : `${n} things`} and make the cut-out` : 'Mark a thing to keep'}</button>
        <span>This runs in the background - about {mins} min for this {Math.round(total)} s clip.</span>
      </div>
    </div>
  </div>;
}
