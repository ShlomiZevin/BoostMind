// The inspector's building blocks (design: render/ui/layers/design.md, classes: ../tokens.css) and the one rule for
// settings: a layer's props are its clips' settings; a clip that overrides one shows it (a "clip only" mark, click =
// back to the layer's value), and a change goes where the value lives - the clip's own override, else the layer.
import { ask } from '../ask';
import React, { useEffect, useRef, useState } from 'react';
import { newId } from '../../../src/layers/ops.js';

export type InspectorProps = {
  project: any; layer: any; item: any | null; urls: Record<string, string>;
  send: (ops: any[], opts?: { commit?: boolean }) => void;
  fps: number; frame: number;
  pickAsset: (kind: 'image' | 'video' | 'audio' | 'font', onPick: (id: string) => void) => void;
  build?: (action: string, args?: any) => Promise<void>;  // a builder action (POST /api/p/:id/build) - a job the editor follows
};

/** Read / write a setting on the selected clip or its layer (see the top of this file). */
export function useSettings(P: InspectorProps) {
  const { layer, item, send } = P;
  const own = (k: string) => !!item && item[k] !== undefined && item[k] !== null;
  return {
    get: (k: string, def?: any) => (own(k) ? item[k] : layer.props?.[k] ?? def),
    own,
    set: (k: string, v: any, commit = true) => send([own(k)
      ? { op: 'item.update', layer: layer.id, id: item.id, set: { [k]: v } }
      : { op: 'layer.update', id: layer.id, props: { [k]: v } }], { commit }),
    reset: (k: string) => item && send([{ op: 'item.update', layer: layer.id, id: item.id, set: { [k]: null } }]),
    item: (patch: any, commit = true) => item && send([{ op: 'item.update', layer: layer.id, id: item.id, set: patch }], { commit }),
    layer: (props: any, commit = true) => send([{ op: 'layer.update', id: layer.id, props }], { commit }),
    layerSet: (set: any) => send([{ op: 'layer.update', id: layer.id, set }]),
  };
}

// ---- time -------------------------------------------------------------------------------------------------------
const pad = (n: number, w = 2) => String(n).padStart(w, '0');
/** frames -> "m:ss:ff" */
export const tc = (f: number, fps: number) => { const r = Math.max(0, Math.round(f)); const s = Math.floor(r / fps); return `${Math.floor(s / 60)}:${pad(s % 60)}:${pad(r % fps)}`; };
/** "m:ss:ff" | "m:ss.s" | "12.5" (seconds) -> frames, or null */
export function parseTc(s: string, fps: number): number | null {
  const p = s.trim().split(':');
  if (p.some((x) => x === '' || isNaN(+x))) return null;
  if (p.length === 3) return (+p[0] * 60 + +p[1]) * fps + +p[2];
  if (p.length === 2) return Math.round((+p[0] * 60 + +p[1]) * fps);
  return Math.round(+p[0] * fps);
}

// ---- layout -----------------------------------------------------------------------------------------------------
const Chev = () => <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m9 6 6 6-6 6" /></svg>;

export function Head({ icon, title, sub, end }: { icon: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; end?: React.ReactNode }) {
  return <div className="ins-head"><div className="ins-ico">{icon}</div>
    <div className="grow"><div className="ins-title">{title}</div>{sub && <div className="ins-sub">{sub}</div>}</div>{end}</div>;
}

/** A collapsible section; its open state is remembered per title. */
export function Sec({ title, end, open = true, children }: { title: string; end?: React.ReactNode; open?: boolean; children: React.ReactNode }) {
  const key = 'ins.open.' + title;
  const [o, setO] = useState(() => { try { const v = localStorage.getItem(key); return v == null ? open : v === '1'; } catch { return open; } });
  return <details className="ins-sec" open={o} onToggle={(e) => { const v = (e.target as HTMLDetailsElement).open; setO(v); try { localStorage.setItem(key, v ? '1' : '0'); } catch {} }}>
    <summary><Chev />{title}{end && <span className="end" onClick={(e) => e.stopPropagation()}>{end}</span>}</summary>
    <div className="ins-body">{children}</div></details>;
}

export const Row = ({ label, wide, children }: { label: React.ReactNode; wide?: boolean; children: React.ReactNode }) =>
  <div className={'ins-row' + (wide ? ' wide' : '')}><label>{label}</label><div>{children}</div></div>;
export const Note = ({ warn, children }: { warn?: boolean; children: React.ReactNode }) => <div className={'ins-note' + (warn ? ' warn' : '')}>{children}</div>;

/** "clip only" mark when the selected clip overrides a layer setting; click = use the layer's value again. */
export const Ovr = ({ S, k }: { S: ReturnType<typeof useSettings>; k: string }) =>
  S.own(k) ? <button className="ins-ovr" title="This clip has its own value - click to use the layer's" onClick={() => S.reset(k)}>clip ×</button> : null;

// ---- controls ---------------------------------------------------------------------------------------------------
export function Chips<T extends string | number>({ options, value, onPick }: { options: [T, string][]; value: T | undefined; onPick: (v: T) => void }) {
  return <div className="ins-chips">{options.map(([v, l]) => <button key={String(v)} className={v === value ? 'on' : ''} onClick={() => onPick(v)}>{l}</button>)}</div>;
}

export function Seg<T extends string | number | boolean>({ options, value, onPick, disabled }: { options: [T, string][]; value: T | undefined; onPick: (v: T) => void; disabled?: boolean }) {
  return <div className="ins-seg">{options.map(([v, l]) => <button key={String(v)} disabled={disabled} className={v === value ? 'on' : ''} onClick={() => onPick(v)}>{l}</button>)}</div>;
}

export const Toggle = ({ on, onChange, disabled, title }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; title?: string }) =>
  <button className={'ins-tg' + (on ? ' on' : '')} disabled={disabled} title={title} onClick={() => onChange(!on)} aria-pressed={on} />;

export const ToggleRow = ({ label, on, onChange, disabled, end }: { label: React.ReactNode; on: boolean; onChange: (v: boolean) => void; disabled?: boolean; end?: React.ReactNode }) =>
  <div className="ins-tgrow"><label>{label}</label><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{end}<Toggle on={on} onChange={onChange} disabled={disabled} /></span></div>;

/** A slider: live while it moves (a draft - not saved), saved once on release. Double-click = the default. */
export function Slider({ label, v, min, max, step, def, fmt = (x) => String(+x.toFixed(2)), onChange, disabled, end }: {
  label: React.ReactNode; v: number; min: number; max: number; step: number; def?: number; fmt?: (v: number) => string;
  onChange: (v: number, commit: boolean) => void; disabled?: boolean; end?: React.ReactNode;
}) {
  const [x, setX] = useState(v);
  const dragging = useRef(false);
  useEffect(() => { if (!dragging.current) setX(v); }, [v]);
  const done = () => { if (dragging.current) { dragging.current = false; onChange(x, true); } };
  return <div className={'ins-sl' + (disabled ? ' off' : '')}><label>{label}{end && <> {end}</>}</label>
    <input type="range" min={min} max={max} step={step} value={x}
      onChange={(e) => { dragging.current = true; const n = +e.target.value; setX(n); onChange(n, false); }}
      onPointerUp={done} onKeyUp={done} onBlur={done}
      onDoubleClick={() => { if (def != null) { setX(def); onChange(def, true); } }} />
    <span className="val">{fmt(x)}</span></div>;
}

/** A number with a unit, typed (Enter / leaving the field saves) or nudged with the arrows. */
export function Num({ value, onCommit, step = 1, unit, min, max, digits = 2, nudges }: {
  value: number | undefined; onCommit: (v: number) => void; step?: number; unit?: string; min?: number; max?: number; digits?: number; nudges?: [string, number][];
}) {
  const show = (n: number | undefined) => (n == null || isNaN(n) ? '' : String(+n.toFixed(digits)));
  const [s, setS] = useState(show(value));
  useEffect(() => setS(show(value)), [value]);
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  const commit = (t: string) => { const n = +t; if (t.trim() !== '' && !isNaN(n) && n !== value) onCommit(clamp(n)); else setS(show(value)); };
  return <div className="ins-num">
    <input value={s} onChange={(e) => setS(e.target.value)} onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); onCommit(clamp(+((value ?? 0) + (e.key === 'ArrowUp' ? step : -step)).toFixed(4))); } }} />
    {unit && <span className="unit">{unit}</span>}
    {(nudges || [['−', -step], ['+', step]]).map(([l, d]) => <button key={l} tabIndex={-1} onClick={() => onCommit(clamp(+((value ?? 0) + d).toFixed(4)))}>{l}</button>)}
  </div>;
}

/** A time in frames shown as m:ss:ff, typed as m:ss:ff / m:ss / seconds, nudged by a frame. */
export function Time({ frames, fps, onCommit, min = 0 }: { frames: number; fps: number; onCommit: (f: number) => void; min?: number }) {
  const [s, setS] = useState(tc(frames, fps));
  useEffect(() => setS(tc(frames, fps)), [frames, fps]);
  const go = (f: number) => onCommit(Math.max(min, Math.round(f)));
  return <div className="ins-num">
    <input value={s} onChange={(e) => setS(e.target.value)}
      onBlur={(e) => { const f = parseTc(e.target.value, fps); if (f != null && Math.round(f) !== Math.round(frames)) go(f); else setS(tc(frames, fps)); }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
    <button tabIndex={-1} title="1 frame back" onClick={() => go(frames - 1)}>‹</button>
    <button tabIndex={-1} title="1 frame on" onClick={() => go(frames + 1)}>›</button>
  </div>;
}

/** Where a box hangs from: the 3x3 grid; anchors the renderer doesn't have are off. */
export function Anchor({ value, onPick, allowed }: { value: string; onPick: (a: string) => void; allowed: string[] }) {
  const grid = ['tl', 't', 'tr', 'l', 'c', 'r', 'bl', 'b', 'br'];
  return <div className="ins-anchor">{grid.map((a) => <button key={a} title={a} disabled={!allowed.includes(a)} className={a === value ? 'on' : ''} onClick={() => onPick(a)} />)}</div>;
}

export function Swatches({ value, colors, onPick }: { value?: string; colors: string[]; onPick: (c: string) => void }) {
  const known = colors.some((c) => c.toLowerCase() === (value || '').toLowerCase());
  return <div className="ins-sw">{colors.map((c) => <button key={c} title={c} style={{ background: c }} className={c.toLowerCase() === (value || '').toLowerCase() ? 'on' : ''} onClick={() => onPick(c)} />)}
    <input type="color" title="Any colour" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#ffffff'} onChange={(e) => onPick(e.target.value)} style={known ? undefined : { outline: '2px solid var(--accent)', borderRadius: '50%' }} /></div>;
}

// ---- clip timing, shared by every kind ---------------------------------------------------------------------------
const db = (g: number) => (g <= 0.0001 ? '−∞ dB' : `${(20 * Math.log10(g)).toFixed(1)} dB`);
export const fmt = { db, pct: (v: number) => `${Math.round(v * 100)}%`, s: (v: number) => `${v.toFixed(2)} s`, x: (v: number) => `${+v.toFixed(2)}×`, px: (v: number) => `${Math.round(v)} px` };

/** Split a clip at a frame: the left keeps its start, the right carries on in the source from where the cut is. */
export function splitOps(layer: any, it: any, frame: number, fps: number) {
  const k = Math.round(frame - it.from);
  if (k < 1 || k > it.dur - 1) return null;
  const { ref, user, ...rest } = it;
  const right: any = { ...rest, id: newId(String(it.id).split('~')[0] + '~'), from: it.from + k, dur: it.dur - k, fade_in: undefined };
  if (it.in != null || layer.kind === 'video' || layer.kind === 'audio') right.in = +((it.in ?? 0) + (k / fps) * (it.rate ?? 1)).toFixed(4);
  if (it.anim) delete right.anim;  // (an entrance plays once, on the first part)
  for (const key of Object.keys(right)) if (right[key] === undefined) delete right[key];
  return [{ op: 'item.update', layer: layer.id, id: it.id, set: { dur: k, fade_out: null } },
    { op: 'item.add', layer: layer.id, item: right, index: (layer.items || []).indexOf(it) + 1 }];
}

/** When the clip plays: start, length, (source in, speed), fades, and Split / Delete. */
export function ClipTiming({ P, source, speedCtl, fades = true }: { P: InspectorProps; source?: boolean; speedCtl?: boolean; fades?: boolean }) {
  const { layer, item: it, fps, frame, send } = P;
  const S = useSettings(P);
  if (!it) return null;
  const split = splitOps(layer, it, frame, fps);
  const dur = it.dur / fps;
  return <Sec title="Clip" end={<span>{tc(it.from, fps)} – {tc(it.from + it.dur, fps)}</span>}>
    <div className="ins-pair">
      <div><Time frames={it.from} fps={fps} onCommit={(f) => S.item({ from: f })} /><div className="ins-cap">Starts</div></div>
      <div><Time frames={it.dur} fps={fps} min={1} onCommit={(f) => S.item({ dur: f })} /><div className="ins-cap">Length</div></div>
    </div>
    {source && <div className="ins-pair">
      <div><Num value={it.in ?? 0} step={1 / fps} digits={3} min={0} unit="s" nudges={[['‹', -1 / fps], ['›', 1 / fps]]} onCommit={(v) => S.item({ in: v })} /><div className="ins-cap">From the source at</div></div>
      {speedCtl ? <div><Num value={it.rate ?? 1} step={0.05} min={0.25} max={4} unit="×" onCommit={(v) => S.item({ rate: v === 1 ? null : v })} /><div className="ins-cap">Clip speed</div></div> : <div />}
    </div>}
    {fades && <>
      <Slider label="Fade in" v={it.fade_in ?? 0} min={0} max={Math.min(3, dur)} step={0.01} def={0} fmt={fmt.s} onChange={(v, c) => S.item({ fade_in: v || null }, c)} />
      <Slider label="Fade out" v={it.fade_out ?? 0} min={0} max={Math.min(3, dur)} step={0.01} def={0} fmt={fmt.s} onChange={(v, c) => S.item({ fade_out: v || null }, c)} />
    </>}
    <div className="ins-acts">
      <button className="btn" disabled={!split} title={split ? 'Cut this clip in two at the playhead' : 'Put the playhead inside the clip'} onClick={() => split && send(split)}>Split at playhead</button>
      <button className="btn danger" onClick={() => send([{ op: 'item.remove', layer: layer.id, id: it.id }])}>Delete clip</button>
    </div>
  </Sec>;
}

/** The layer itself: shown / hidden, (muted), its name. */
export function LayerState({ P, sound }: { P: InspectorProps; sound?: boolean }) {
  const { layer, send } = P;
  const S = useSettings(P);
  return <Sec title="Layer" open={false} end={<span>{layer.items?.length || 0} clips</span>}>
    <Row label="Name"><input className="ins-select" defaultValue={layer.name || ''} key={layer.id}
      onBlur={(e) => e.target.value !== (layer.name || '') && S.layerSet({ name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} /></Row>
    <ToggleRow label="Shown" on={!layer.hidden} onChange={(v) => S.layerSet({ hidden: !v })} />
    {sound && <ToggleRow label="Heard" on={!layer.muted} onChange={(v) => S.layerSet({ muted: !v })} />}
    <ToggleRow label="Locked" on={!!layer.locked} onChange={(v) => S.layerSet({ locked: v })} />
    <button className="btn danger" onClick={async () => { if (await ask({ title: `Delete the layer "${layer.name || layer.id}"?`, text: `${layer.items?.length ? `${layer.items.length} clip${layer.items.length === 1 ? '' : 's'} go${layer.items.length === 1 ? 'es' : ''} with it. ` : ''}Ctrl+Z brings it back.`, ok: 'Delete' })) send([{ op: 'layer.remove', id: layer.id }], { label: 'delete layer' }); }}>Delete layer</button>
  </Sec>;
}

// ---- how a clip comes in, and "the whole video" -----------------------------------------------------------------
export const ENTRANCES: Record<string, { label: string; anim: any }> = {
  none: { label: 'None', anim: null },
  fade: { label: 'Fade', anim: { opacity: [[0, 0], [0.2, 1]] } },
  pop: { label: 'Pop', anim: { opacity: [[0, 0], [0.08, 1]], scale: [[0, 0.6], [0.14, 1.08], [0.24, 1]] } },
  rise: { label: 'Rise', anim: { opacity: [[0, 0], [0.18, 1]], y: [[0, 40], [0.25, 0]] } },
  drop: { label: 'Drop', anim: { opacity: [[0, 0], [0.12, 1]], y: [[0, -60], [0.22, 6], [0.3, 0]] } },
};
const entranceOf = (anim: any) => Object.keys(ENTRANCES).find((k) => JSON.stringify(ENTRANCES[k].anim) === JSON.stringify(anim ?? null)) ?? 'custom';

export function Entrance({ P }: { P: InspectorProps }) {
  const S = useSettings(P);
  const it = P.item;
  if (!it) return null;
  const now = entranceOf(it.anim);
  return <Row label="Comes in"><Chips options={[...Object.entries(ENTRANCES).map(([k, e]) => [k, e.label] as [string, string]), ...(now === 'custom' ? [['custom', 'Custom'] as [string, string]] : [])]}
    value={now} onPick={(k) => k !== 'custom' && S.item({ anim: ENTRANCES[k].anim })} /></Row>;
}

/** On for the whole video (runs from the start to the end, and stays there when the length changes). */
export function WholeVideo({ P }: { P: InspectorProps }) {
  const S = useSettings(P);
  const it = P.item, D = P.project.duration;
  if (!it) return null;
  const on = it.pin === 'span' && it.from === 0;
  return <ToggleRow label="The whole video" on={on} onChange={(v) => S.item(v ? { from: 0, dur: D, pin: 'span' } : { pin: null, dur: Math.min(it.dur, 5 * P.fps) })} />;
}

export function Opacity({ P }: { P: InspectorProps }) {
  const S = useSettings(P);
  return <Slider label={<>Opacity <Ovr S={S} k="opacity" /></>} v={S.get('opacity', 1)} min={0} max={1} step={0.01} def={1} fmt={fmt.pct} onChange={(v, c) => S.set('opacity', v, c)} />;
}

// ---- icons ------------------------------------------------------------------------------------------------------
const ic = (d: React.ReactNode) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
export const ICON = {
  video: ic(<><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>),
  backdrop: ic(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m3 16 5-5 4 4 3-3 6 6" /></>),
  image: ic(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 17-5-5-9 8" /></>),
  text: ic(<path d="M5 6V4h14v2M12 4v16M9 20h6" />),
  subtitles: ic(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 14h4M13 14h4M7 10h10" /></>),
  shape: ic(<rect x="4" y="4" width="16" height="16" rx="3" />),
  audio: ic(<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0" />),
  effect: ic(<path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2" />),
};
