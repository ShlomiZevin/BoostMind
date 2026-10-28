// Media: every file the project uses or can use (its assets) - footage, backgrounds and pictures, sounds, fonts.
// Add a file (it goes to the project's media/), put any of them on the timeline at the playhead. A file's picture
// opens it big (VideoPeek): a video or a sound plays, a picture shows large - and there, not in this list, he marks
// it Use / Don't use with a note ("the first part from this take"). Kept on the asset (mark, note), for him and for
// whoever edits the project (the skill reads them); the list only gets a small sign on a marked file's picture.
import React, { useEffect, useRef, useState } from 'react';
import { Send, upload, build } from './api';
import { newId } from '../../src/layers/ops.js';
import { VideoPeek, PeekThumb } from './VideoPeek';

// in the window: Use / Don't use + a note for one file
function Marks({ id, a, send }: { id: string; a: any; send: Send }) {
  const [note, setNote] = useState(a.note || '');
  useEffect(() => setNote(a.note || ''), [id, a.note]);
  const save = (patch: any) => {
    const next = { ...a, ...patch };
    for (const k of ['mark', 'note']) if (!next[k]) delete next[k];
    send([{ op: 'asset.add', id, asset: next }], { label: 'mark ' + (a.label || a.src.split('/').pop()) });
  };
  const keep = () => { if (note.trim() !== (a.note || '')) save({ note: note.trim() }); };
  return (
    <div className="mk">
      <div className="mk-b">
        <button className={`mk-use ${a.mark === 'use' ? 'on' : ''}`} onClick={() => save({ mark: a.mark === 'use' ? '' : 'use' })}>✓ Use this</button>
        <button className={`mk-skip ${a.mark === 'skip' ? 'on' : ''}`} onClick={() => save({ mark: a.mark === 'skip' ? '' : 'skip' })}>✕ Don't use</button>
      </div>
      <div className="mk-l">Note</div>
      <textarea className="mk-note he" dir="auto" rows={3} value={note} placeholder="e.g. take the first part from this one, the ending from the other"
        onChange={(e) => setNote(e.target.value)} onBlur={keep} />
    </div>
  );
}
// a small sign on a marked file's picture (✓ use, ✕ don't, • a note only)
const Dot = ({ a }: { a: any }) => (a.mark ? <span className={`mk-dot ${a.mark}`}>{a.mark === 'use' ? '✓' : '✕'}</span>
  : a.note ? <span className="mk-dot note">•</span> : null);

const SECTIONS: [string, string, (a: any) => boolean][] = [
  ['video', 'Footage', (a) => a.kind === 'video'],
  ['bg', 'Backgrounds', (a) => a.kind === 'image' && (a.tag === 'background' || /^backgrounds\//.test(a.src))],
  ['image', 'Pictures', (a) => a.kind === 'image' && !(a.tag === 'background' || /^backgrounds\//.test(a.src))],
  ['audio', 'Sounds', (a) => a.kind === 'audio'],
  ['font', 'Fonts', (a) => a.kind === 'font'],
];

export function Media({ ep, project, urls, frame, send, onLoaded, pick }: {
  ep: string; project: any; urls: Record<string, string>; frame: number; send: Send; onLoaded: () => void;
  pick?: { kind: string; onPick: (id: string) => void } | null;
}) {
  const fileIn = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState('');
  const [peek, setPeek] = useState<string | null>(null);  // the file open big
  // when each video was recorded (render/actions/dates.mjs - the phone's time inside the file): Footage newest first
  // (his ask, 2026-10-28: "I want last to be first"); asked again when videos come or go
  const [dates, setDates] = useState<Record<string, number>>({});
  const vids = Object.keys(project.assets || {}).filter((id) => project.assets[id].kind === 'video').sort().join('|');
  useEffect(() => { build(ep, { action: 'dates' }).then((r: any) => { if (r?.dates) setDates(r.dates); }).catch(() => {}); }, [ep, vids]);
  // Footage: all, or only the videos not on the timeline yet (his ask, 2026-10-28) - remembered
  const [onlyNew, setOnlyNew] = useState(() => { try { return localStorage.getItem('zc-media-new') === '1'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('zc-media-new', onlyNew ? '1' : '0'); } catch {} }, [onlyNew]);
  const when = (id: string) => (dates[id] ? new Date(dates[id]).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  const W = project.canvas.w, H = project.canvas.h, fps = project.canvas.fps;
  const add = async (files: FileList | null) => {
    for (const f of Array.from(files || [])) {
      setBusy(`Adding ${f.name}…`);
      const r = await upload(ep, f);
      if (r.error) alert(r.error);
    }
    setBusy('');
    onLoaded();
  };
  // a file onto the timeline: its own new layer at the playhead
  const place = (id: string, a: any) => {
    const lid = newId(a.kind === 'audio' ? 'sound.' : a.kind === 'image' ? 'image.' : 'video.');
    const dur = a.kind === 'image' ? 3 * fps : Math.max(1, Math.round((a.duration || 3) * fps));
    const item: any = { id: 'i1', from: frame, dur: Math.min(dur, project.duration - frame), asset: id };
    let layer: any;
    if (a.kind === 'image') layer = { id: lid, kind: 'image', name: (a.label || a.src.split('/').pop()).replace(/\.[^.]+$/, ''), group: 'Pictures', props: {},
      items: [{ ...item, fade_in: 0.2, box: { x: W / 2, y: H / 2, w: Math.min(W * 0.8, a.w || W), anchor: 'c' } }] };
    else if (a.kind === 'audio') layer = { id: lid, kind: 'audio', name: (a.label || a.src.split('/').pop()).replace(/\.[^.]+$/, ''), group: 'Sound', props: { volume: 1 }, items: [{ ...item, in: 0 }] };
    else if (a.kind === 'video') layer = { id: lid, kind: 'video', name: a.label || a.src.split('/').pop(), group: 'Video', props: { fit: 'cover' },
      items: [{ ...item, in: 0, box: { x: 0, y: 0, w: W, h: H } }] };
    else return;
    const index = a.kind === 'audio' ? project.layers.length : project.layers.length - project.layers.slice().reverse().findIndex((l: any) => l.kind !== 'audio');
    send([{ op: 'layer.add', layer, index }], { label: 'add ' + a.kind });
  };
  const used = new Set(project.layers.flatMap((l: any) => [l.props?.asset, ...(l.items || []).map((i: any) => i.asset), ...(l.items || []).map((i: any) => i.font)]));
  return (
    <div className="media">
      <div style={{ display: 'flex', gap: 8, padding: '10px 12px 0' }}>
        <button className="btn" style={{ flex: 1 }} onClick={() => fileIn.current?.click()}>+ Add files</button>
        <input ref={fileIn} type="file" multiple hidden onChange={(e) => add(e.target.files)} />
      </div>
      {busy && <div className="help" style={{ padding: '8px 14px 0' }}>{busy}</div>}
      {pick && <div className="note">Pick a {pick.kind === 'image' ? 'picture' : pick.kind} below</div>}
      {SECTIONS.map(([k, title, test]) => {
        // one entry per FILE: a builder makes an asset per placement of a sound (its own filter / pitch), all the same
        // file - he saw house-bed.mp3 12 times in haredit-2 (2026-10-27). "In use" = any of them is on the timeline
        const same = new Map<string, string[]>();
        const list = (Object.entries(project.assets || {}).filter(([, a]: any) => test(a)) as [string, any][]).filter(([id, a]) => {
          const k = a.src || id, g = same.get(k);
          if (g) { g.push(id); return false; }
          same.set(k, [id]);
          return true;
        });
        const inUse = (id: string, a: any) => (same.get(a.src || id) || [id]).some((x) => used.has(x));
        if (k === 'video') list.sort(([x], [y]) => (dates[y] || 0) - (dates[x] || 0));  // (newest first; no date yet: last)
        if (!list.length) return null;
        const shown = k === 'video' && onlyNew ? list.filter(([id, a]) => !inUse(id, a)) : list;
        return (
          <div key={k}>
            <div className="m-sec">{title}{k === 'video'
              ? <span className="m-show">
                  <button className={onlyNew ? '' : 'on'} onClick={() => setOnlyNew(false)} title="Every video">All {list.length}</button>
                  <button className={onlyNew ? 'on' : ''} onClick={() => setOnlyNew(true)} title="Only the videos that are not on the timeline yet">Not added {list.filter(([id, a]) => !inUse(id, a)).length}</button>
                </span>
              : <span>{list.length}</span>}</div>
            {k === 'video' && onlyNew && !shown.length && <div className="help" style={{ padding: '4px 14px 8px' }}>Every video is on the timeline.</div>}
            {(k === 'bg' || k === 'image') ? (
              <div className="pm-grid">
                {list.map(([id, a]) => (
                  <div key={id} className={`pm ${pick?.kind === 'image' ? 'on' : ''}`} title={a.src}>
                    <button className="pm-img" style={{ position: 'relative' }} title="Open it big" onClick={() => (pick && pick.kind === 'image' ? pick.onPick(id) : setPeek(id))}>
                      <img src={urls[id]} loading="lazy" style={{ objectFit: k === 'bg' ? 'cover' : 'contain' }} /><Dot a={a} /></button>
                    <div className="pm-name">{a.label || a.src.split('/').pop()}</div>
                    {!pick && <button className="pm-use" onClick={() => place(id, a)}>{inUse(id, a) ? '+ again' : '+ timeline'}</button>}
                  </div>
                ))}
              </div>
            ) : shown.map(([id, a]) => (
              <div key={id} className="m-row" onClick={() => (pick && pick.kind === a.kind ? pick.onPick(id) : null)}>
                {a.kind === 'video' ? <span className="mk-wrap"><PeekThumb src={`/api/p/${ep}/thumb?asset=${encodeURIComponent(id)}`} onPlay={() => (pick ? pick.kind === 'video' && pick.onPick(id) : setPeek(id))} /><Dot a={a} /></span>
                  : a.kind === 'audio' ? <span className="mk-wrap"><button className="m-ic" style={{ cursor: 'pointer', border: 0, font: 'inherit', color: 'inherit' }} title="Listen" onClick={(e) => { e.stopPropagation(); pick ? pick.kind === 'audio' && pick.onPick(id) : setPeek(id); }}>♪</button><Dot a={a} /></span>
                  : <div className="m-ic">Aa</div>}
                <div className="m-main">
                  <div className="m-name he">{a.label || a.src.split('/').pop()}</div>
                  <div className="m-sub">{a.kind === 'font' ? a.family : `${a.duration ? a.duration.toFixed(1) + ' s' : ''}${a.w ? ` · ${a.w}×${a.h}` : ''}${when(id) ? ` · ${when(id)}` : ''}${inUse(id, a) ? ' · in use' : ''}`}</div>
                </div>
                {a.kind !== 'font' && !pick && <button className="pm-use" style={{ width: 70 }} onClick={(e) => { e.stopPropagation(); place(id, a); }}>+ timeline</button>}
              </div>
            ))}
          </div>
        );
      })}
      {peek && project.assets?.[peek] && (() => {
        const a = project.assets[peek];
        return <VideoPeek kind={a.kind} src={a.kind === 'image' ? urls[peek] : `/api/p/${ep}/asset?a=${encodeURIComponent(peek)}`} name={a.label || a.src.split('/').pop()} onClose={() => setPeek(null)}
          sub={[a.duration ? a.duration.toFixed(1) + ' s' : '', a.w ? `${a.w}×${a.h}` : '', used.has(peek) ? 'in use' : ''].filter(Boolean).join(' · ')}
          actions={<button className="btn" onClick={() => { place(peek, a); setPeek(null); }}>{used.has(peek) ? '+ Timeline again' : '+ Timeline'}</button>}>
          <Marks id={peek} a={a} send={send} /></VideoPeek>;
      })()}
    </div>
  );
}
