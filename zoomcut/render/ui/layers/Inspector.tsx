// The right panel of the layered editor. Nothing picked: the project (title, speed, colour, add a layer). A layer or
// an item picked: its panel - the per-kind panels in ./inspect (INSPECTORS) when they exist, otherwise a plain panel
// that shows every setting the format has (skill/edit-video/layers.md), so nothing is ever hidden from him.
import { ask } from './ask';
import React from 'react';
import { KIND_LABEL, Send } from './api';
import { SpeedPick } from '../speed';
import { newId } from '../../src/layers/ops.js';
import { TEXT_STYLES, SUB_STYLES } from '../../src/layers/styles';
import { FILTERS } from '../../src/layers/effect_curve.js';

const panels = import.meta.glob('./inspect/index.ts', { eager: true }) as Record<string, any>;
const INSPECTORS: Record<string, React.FC<any>> = Object.values(panels)[0]?.INSPECTORS || {};

const SKIP = new Set(['id', 'ref', 'user', 'items', 'removed', 'owner', 'kind']);
const isColor = (k: string, v: any) => typeof v === 'string' && (/^(#|rgb)/.test(v) || /color|fill|stroke$|^bg$/.test(k));

function Field({ k, v, onChange, assets, kind }: { k: string; v: any; onChange: (v: any, commit?: boolean) => void; assets: Record<string, any>; kind: string }) {
  if (k === 'asset' || k === 'font') {
    const want = k === 'font' ? 'font' : kind === 'backdrop' ? 'image' : kind === 'audio' ? null : kind;
    const opts = Object.entries(assets).filter(([, a]: any) => (want ? a.kind === want : a.kind === 'audio' || a.kind === 'video'));
    return <div className="row2"><label>{k}</label><select className="field" value={v ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      {k === 'font' && <option value="">System</option>}
      {opts.map(([id, a]: any) => <option key={id} value={id}>{a.label || a.family || a.src.split('/').pop()}</option>)}</select></div>;
  }
  if (k === 'style') {
    const names = Object.keys(kind === 'subtitles' ? SUB_STYLES : TEXT_STYLES);
    return <div className="row2"><label>style</label><select className="field" value={v ?? ''} onChange={(e) => onChange(e.target.value)}>
      {names.map((n) => <option key={n} value={n}>{n}</option>)}</select></div>;
  }
  if (k === 'clean') return <div className="row2"><label>noise</label><div className="seg" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
    {['off', 'mild', 'strong', 'nn'].map((c) => <button key={c} className={(v || 'off') === c ? 'on' : ''} onClick={() => onChange(c)}>{c === 'nn' ? 'NN' : c}</button>)}</div></div>;
  if (k === 'fit') return <div className="row2"><label>fit</label><div className="seg" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
    {['cover', 'face', 'contain'].map((c) => <button key={c} className={(v || 'cover') === c ? 'on' : ''} onClick={() => onChange(c)}>{c}</button>)}</div></div>;
  if (typeof v === 'boolean') return <div className="check-row"><span>{k}</span><div className={`switch ${v ? 'on' : ''}`} onClick={() => onChange(!v)} /></div>;
  if (typeof v === 'number') {
    const range: Record<string, [number, number, number]> = { volume: [0, 2, 0.01], opacity: [0, 1, 0.01], zoom: [0.3, 3, 0.01], x: [-1080, 1080, 1], y: [-1920, 1920, 1],
      presence: [-6, 8, 0.5], gain: [0, 3, 0.01], size: [10, 160, 1], radius: [0, 60, 1], width: [0, 20, 1], head: [0, 0.4, 0.01], saturate: [0, 2, 0.01],
      contrast: [0.5, 1.5, 0.01], brightness: [0.5, 1.5, 0.01], fade_in: [0, 3, 0.05], fade_out: [0, 3, 0.05], rate: [0.25, 4, 0.05] };
    const r = range[k];
    if (r && !(k === 'x' || k === 'y')) return (  // dragging = live, letting go = saved
      <div className="row2"><label>{k}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="range" min={r[0]} max={r[1]} step={r[2]} value={v} style={{ flex: 1, accentColor: 'var(--accent)' }}
            onChange={(e) => onChange(+e.target.value, false)} onPointerUp={(e) => onChange(+(e.target as HTMLInputElement).value)}
            onKeyUp={(e) => onChange(+(e.target as HTMLInputElement).value)} />
          <span style={{ minWidth: 44, textAlign: 'right', color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{r[2] < 1 ? v.toFixed(2) : Math.round(v)}</span>
        </div></div>);
    return <div className="row2"><label>{k}</label><input className="field" type="number" value={+v.toFixed(4)} step={Math.abs(v) < 3 ? 0.01 : 1}
      onChange={(e) => onChange(+e.target.value, false)} onBlur={(e) => onChange(+e.target.value)} /></div>;
  }
  if (isColor(k, v)) return <div className="row2"><label>{k}</label><div style={{ display: 'flex', gap: 6 }}>
    {/^#[0-9a-f]{6}$/i.test(v) && <input type="color" value={v} onChange={(e) => onChange(e.target.value, false)} onBlur={(e) => onChange(e.target.value)} style={{ width: 34, height: 34, padding: 0, border: 0, background: 'none' }} />}
    <input className="field" defaultValue={v} onBlur={(e) => onChange(e.target.value)} /></div></div>;
  if (typeof v === 'string') return k === 'text'
    ? <div><div className="sec" style={{ marginBottom: 6 }}>text</div><textarea className="field he" style={{ height: 80, padding: 8, userSelect: 'text' }} defaultValue={v} key={v}
        onChange={(e) => onChange(e.target.value, false)} onBlur={(e) => onChange(e.target.value)} /></div>
    : <div className="row2"><label>{k}</label><input className="field" defaultValue={v} key={v} onBlur={(e) => onChange(e.target.value)} /></div>;
  if (v && typeof v === 'object' && !Array.isArray(v)) return (
    <div style={{ display: 'grid', gap: 8, paddingLeft: 8, borderLeft: '1px solid var(--edge)' }}>
      <div className="sec">{k}</div>
      {Object.entries(v).map(([kk, vv]) => <Field key={kk} k={kk} v={vv} assets={assets} kind={kind} onChange={(nv, c) => onChange({ ...v, [kk]: nv }, c)} />)}
    </div>);
  return <div className="row2"><label>{k}</label><code style={{ color: 'var(--faint)', fontSize: 11, overflow: 'hidden' }}>{JSON.stringify(v)}</code></div>;
}

// the settings a kind has even when the project hasn't set them yet (so the panel shows them)
const DEFAULTS: Record<string, any> = {
  video: { fit: 'cover', zoom: 1, x: 0, y: 0, radius: 0, cutout: false, look: { saturate: 1, contrast: 1, brightness: 1 } },
  backdrop: { asset: '', x: 0, y: 0, zoom: 1 },
  audio: { volume: 1, clean: 'off', presence: 0 },
  text: { style: 'plain' }, subtitles: { style: 'zoom', size: 46 }, shape: { fill: '', stroke: '', width: 0, radius: 0 }, image: {},
};

export function Inspector({ project, sel, send, frame, onSel, extra, urls, pickAsset, build }: {
  project: any; sel: { layer: string; item?: string } | null; send: Send; frame: number; onSel: (s: any) => void; extra?: React.ReactNode;
  urls: Record<string, string>; pickAsset: (kind: string, onPick: (id: string) => void) => void; build: (action: string, args?: any) => Promise<void>;
}) {
  const fps = project.canvas.fps, W = project.canvas.w, H = project.canvas.h;
  const layer = sel && project.layers.find((l: any) => l.id === sel.layer);
  const item = layer && sel?.item ? (layer.items || []).find((i: any) => i.id === sel.item) : null;
  if (!layer) {
    const addLayer = (layer: any) => { send([{ op: 'layer.add', layer, index: project.layers.length - project.layers.slice().reverse().findIndex((l: any) => l.kind !== 'audio') }], { label: 'add layer' }); onSel({ layer: layer.id, item: layer.items?.[0]?.id }); };
    return <div className="insp">
      <div className="card">
        <div className="card-h"><div className="title grow">Project</div></div>
        <div className="row2"><label>Title</label><input className="field he" defaultValue={project.title} key={project.title} onBlur={(e) => e.target.value !== project.title && send([{ op: 'project', set: { title: e.target.value } }])} /></div>
        <div className="sec">Speed</div>
        <SpeedPick speed={project.speed || 1} onSpeed={(v) => send([{ op: 'project', set: { speed: v } }], { label: 'speed' })} />
        <div className="row2"><label>Length</label><span>{(project.duration / fps / (project.speed || 1)).toFixed(1)} s{project.speed !== 1 ? ` · ${(project.duration / fps).toFixed(1)} s at 1×` : ''}</span></div>
        <div className="row2"><label>Background</label><input type="color" value={project.canvas.color || '#000000'} onChange={(e) => send([{ op: 'project', set: { canvas: { color: e.target.value } } }], { commit: false })}
          onBlur={(e) => send([{ op: 'project', set: { canvas: { color: e.target.value } } }])} style={{ width: 40, height: 30, border: 0, background: 'none' }} /></div>
        <div className="help">The whole video, every layer together. Export makes the file at this speed.</div>
      </div>
      <div className="card">
        <div className="card-h"><div className="title grow">Add a layer</div></div>
        <div className="add-row" style={{ borderTop: 0, marginTop: 0, paddingTop: 0 }}>
          <button className="add-chip" onClick={() => addLayer({ id: newId('text.'), kind: 'text', name: 'Text', group: 'Text', props: { style: 'pov', theme: 'light', size: 46 },
            items: [{ id: 'i1', from: frame, dur: Math.min(3 * fps, project.duration - frame), text: 'פוב: ', box: { x: W / 2, y: 276, w: W - 120, anchor: 't' } }] })}>Text</button>
          <button className="add-chip" onClick={() => addLayer({ id: newId('shape.'), kind: 'shape', name: 'Shape', group: 'Shapes', props: { fill: 'rgba(0,0,0,0.5)', radius: 12 },
            items: [{ id: 'i1', from: frame, dur: Math.min(3 * fps, project.duration - frame), box: { x: 90, y: 800, w: W - 180, h: 300 } }] })}>Shape</button>
          <span className="help" style={{ margin: 0 }}>Pictures, sounds, footage: from Media</span>
        </div>
        <div className="sec">Film effect - on everything under it (texts above it stay clean)</div>
        <div className="add-row" style={{ borderTop: 0, marginTop: 0, paddingTop: 0 }}>
          {Object.entries(FILTERS as Record<string, any>).map(([k, f]) => (
            <button key={k} className="add-chip" title={f.help || ''} onClick={() => {
              // an effect goes under the texts / subtitles: right above the last video-ish layer
              const lastPic = project.layers.map((l: any) => l.kind).lastIndexOf('video');
              const lid = newId('fx.');
              send([{ op: 'layer.add', layer: { id: lid, kind: 'effect', name: f.label || k, group: 'Effects', props: { filter: k },
                items: [{ id: 'i1', from: frame, dur: Math.min(5 * fps, project.duration - frame) }] }, index: Math.max(0, lastPic + 1) }], { label: 'add effect' });
              onSel({ layer: lid, item: 'i1' });
            }}>{f.label || k}</button>))}
        </div>
      </div>
      {extra}
      <div className="empty" style={{ padding: 18 }}>Click a lane or a block on the timeline to see its settings. Ctrl+Z undoes any change.</div>
    </div>;
  }
  const P = INSPECTORS[layer.kind];
  if (P) return <div className="insp"><P project={project} layer={layer} item={item} send={send} fps={fps} frame={frame} urls={urls} pickAsset={pickAsset} build={build} />{extra}</div>;
  const setLayer = (k: string, v: any, commit = true) => send([{ op: 'layer.update', id: layer.id, props: { [k]: v } }], { commit, label: k });
  const setItem = (k: string, v: any, commit = true) => send([{ op: 'item.update', layer: layer.id, id: item.id, set: { [k]: v } }], { commit, label: k });
  const props = { ...(DEFAULTS[layer.kind] || {}), ...(layer.props || {}) };
  const idx = project.layers.indexOf(layer);
  return <div className="insp">
    {item && <div className="card">
      <div className="card-h"><div className="title grow">{KIND_LABEL[layer.kind]} item</div>
        {item.user && <span className="badge" title="changed by hand: a rebuild keeps it">yours</span>}</div>
      <div className="row2"><label>at</label><span>{(item.from / fps).toFixed(2)} s · {(item.dur / fps).toFixed(2)} s long</span></div>
      {Object.entries(item).filter(([k]) => !SKIP.has(k) && k !== 'from' && k !== 'dur').map(([k, v]) =>
        <Field key={k} k={k} v={v} assets={project.assets} kind={layer.kind} onChange={(nv, c) => setItem(k, nv, c !== false)} />)}
      <div className="actions">
        <button className="btn" onClick={() => setItem('hidden', !item.hidden)}>{item.hidden ? 'Show' : 'Hide'}</button>
        <button className="btn" onClick={() => { send([{ op: 'item.remove', layer: layer.id, id: item.id }], { label: 'delete' }); onSel({ layer: layer.id }); }}>Delete</button>
      </div>
    </div>}
    <div className="card">
      <div className="card-h"><div className="title grow">{layer.name || layer.id}</div><span className="badge">{KIND_LABEL[layer.kind]}</span></div>
      {item && <div className="help" style={{ marginTop: -8 }}>The layer's settings - every item of it uses them unless the item sets its own.</div>}
      <div className="row2"><label>name</label><input className="field" defaultValue={layer.name || ''} key={layer.id} onBlur={(e) => e.target.value !== layer.name && send([{ op: 'layer.update', id: layer.id, set: { name: e.target.value } }])} /></div>
      {Object.entries(props).filter(([k]) => !SKIP.has(k)).map(([k, v]) => <Field key={k} k={k} v={v} assets={project.assets} kind={layer.kind} onChange={(nv, c) => setLayer(k, nv, c !== false)} />)}
      <div className="actions" style={{ flexWrap: 'wrap' }}>
        <button className="btn" title="Draw it above the layer over it" disabled={idx >= project.layers.length - 1} onClick={() => send([{ op: 'layer.move', id: layer.id, index: idx + 1 }])}>Up</button>
        <button className="btn" disabled={idx <= 0} onClick={() => send([{ op: 'layer.move', id: layer.id, index: idx - 1 }])}>Down</button>
        <button className="btn" onClick={() => send([{ op: 'layer.update', id: layer.id, set: { [layer.kind === 'audio' ? 'muted' : 'hidden']: !(layer.kind === 'audio' ? layer.muted : layer.hidden) } }])}>
          {layer.kind === 'audio' ? (layer.muted ? 'Sound on' : 'Mute') : layer.hidden ? 'Show' : 'Hide'}</button>
        <button className="btn" onClick={async () => { if (await ask({ title: `Delete the layer "${layer.name || layer.id}"?`, text: `${layer.items?.length ? `${layer.items.length} clip${layer.items.length === 1 ? '' : 's'} go${layer.items.length === 1 ? 'es' : ''} with it. ` : ''}Ctrl+Z brings it back.`, ok: 'Delete' })) { send([{ op: 'layer.remove', id: layer.id }], { label: 'delete layer' }); onSel(null); } }}>Delete layer</button>
      </div>
      {layer.owner === 'builder' && <div className="help">Its items come from the analysis; what you change here stays when it runs again.</div>}
    </div>
    {extra}
  </div>;
}
