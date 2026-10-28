// A script line of a Zoom project: its take and timing, its sound, its layout (the layered editor's Script tab)
import React, { useEffect, useState } from 'react';
import { colorOf, f2, Fix, I, LAYOUTS, Line, STATUS, Take } from './common';

export function Num({ value, onCommit, step = 0.05, disabled, placeholder }: { value?: number | null; onCommit: (v: number | undefined) => void; step?: number; disabled?: boolean; placeholder?: string }) {
  const [v, setV] = useState(value == null ? '' : f2(value));
  useEffect(() => setV(value == null ? '' : f2(value)), [value]);
  const commit = (s: string) => { const n = s === '' ? undefined : +(+s).toFixed(3); if (n !== value && !(n !== undefined && isNaN(n))) onCommit(n); };
  const bump = (d: number) => { const n = Math.max(0, +((value ?? 0) + d).toFixed(3)); setV(f2(n)); onCommit(n); };
  return (
    <div className="num">
      <input value={v} disabled={disabled} placeholder={placeholder} onChange={(e) => setV(e.target.value)}
        onBlur={(e) => commit(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
      <div className="arr">
        <button disabled={disabled} onClick={() => bump(step)} tabIndex={-1}>{I.up}</button>
        <button disabled={disabled} onClick={() => bump(-step)} tabIndex={-1}>{I.down}</button>
      </div>
    </div>
  );
}

export function LineProps({ l, busy, chars, onFix }: { l: Line; busy: boolean; chars: any[]; onFix: (f: Fix) => void }) {
  const fix = l.fix || {};
  const cur: Take | null = l.clip ? { clip: l.clip, in: l.in!, out: l.out!, cut: l.cut ?? undefined } : null;
  const options: Take[] = [...(l.auto ? [l.auto] : []), ...l.alternatives];
  const key = (t: Take) => `${t.clip}|${t.in}`;
  const match = cur && options.find((o) => o.clip === cur.clip && Math.abs(o.in - cur.in) < 0.5);
  const set = (p: Fix) => onFix({ ...fix, ...p });
  const setTime = (field: 'in' | 'out' | 'cut', v: number | undefined) => {
    if (!cur || v === undefined) return;
    const p: Fix = { clip: fix.clip ?? cur.clip, in: fix.in ?? cur.in };
    if (!l.interrupted) p.out = fix.out ?? cur.out;
    else { p.out = undefined; p.cut = fix.cut ?? cur.cut; }
    (p as any)[field] = v;
    set(p);
  };
  const lay = fix.layout || '';
  const endField = l.interrupted ? 'cut' : 'out';
  return (
    <>
      <div className="card">
        <div className="card-h">
          <div className="av" style={{ background: colorOf(l.speaker, chars) }}>{l.name[0]}</div>
          <div className="title grow">Line {l.n} — <span className="he">{l.name}</span></div>
          <span className={`badge ${l.status}`}>{STATUS[l.status]}{l.score != null && l.status !== 'skipped' ? ` ${Math.round(l.score * 100)}%` : ''}</span>
        </div>
        <div className="quote he">{l.text}</div>
        {l.heard && <div className="heard he">שמעתי: {l.heard}</div>}
        {l.status === 'check' && <div className="help" style={{ marginTop: 0 }}>Not fully sure about this match (English words or mumbling). Play it, then keep it or pick another take.</div>}
        {l.status === 'missing' && <div className="help" style={{ marginTop: 0 }}>Not found in any take. Record it, or drop the line.</div>}
      </div>

      <div className="card">
        <div className="sec">Take & timing{Object.keys(fix).length > 0 && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>edited</span>}</div>
        <div className="row2"><label>Take</label>
          <select className="field" disabled={busy || !options.length} value={match ? key(match) : ''}
            onChange={(e) => {
              const t = options.find((o) => key(o) === e.target.value); if (!t) return;
              if (l.auto && key(t) === key(l.auto)) { const { clip, in: _i, out, cut, ...rest } = fix; onFix(rest); }
              else set({ clip: t.clip, in: t.in, out: t.out, cut: l.interrupted ? t.cut : undefined });
            }}>
            {!match && cur && <option value="">{cur.clip} @ {f2(cur.in)}s (edited)</option>}
            {options.map((o, i) => <option key={key(o)} value={key(o)}>{i === 0 && l.auto ? 'Best — ' : ''}{o.clip} @ {f2(o.in)}s{o.score != null ? ` · ${Math.round(o.score * 100)}%` : ''}</option>)}
          </select></div>
        <div className="pair">
          <label>In</label><Num value={fix.in ?? cur?.in} disabled={busy || !cur} onCommit={(v) => setTime('in', v)} />
          <label>{l.interrupted ? 'Cut' : 'Out'}</label><Num value={(fix as any)[endField] ?? (cur as any)?.[endField]} disabled={busy || !cur} onCommit={(v) => setTime(endField, v)} />
        </div>
        {l.interrupted && <div className="help">"Cut" is the moment the next speaker jumps in — this line is interrupted.</div>}
        <div className="row2"><label>Pause</label><Num value={fix.pause_before} placeholder="auto" step={0.1} disabled={busy} onCommit={(v) => set({ pause_before: v })} /></div>
      </div>

      <LineSound fix={fix} busy={busy} set={set} />

      <div className="card">
        <div className="sec">Layout</div>
        <div className="seg">{LAYOUTS.map(([k, label]) => <button key={k} className={lay === k ? 'on' : ''} disabled={busy} onClick={() => set({ layout: k || undefined })}>{label}</button>)}</div>
        <div className="help">{LAYOUTS.find(([k]) => k === lay)?.[2]}</div>
      </div>

      <div className="actions">
        <button className="btn primary block" disabled={busy} onClick={() => set({ skip: !fix.skip || undefined })}>{I.drop}{fix.skip ? 'Restore line' : 'Drop line'}</button>
        <button className="btn block" disabled={busy || !Object.keys(fix).length} onClick={() => onFix({})}>{I.reset}Reset</button>
      </div>
    </>
  );
}

// a line's sound: its volume and a softener for a shouted / too-close line (applied in the mix, editor and export alike)
function LineSound({ fix, busy, set }: { fix: Fix; busy: boolean; set: (p: Fix) => void }) {
  const [vol, setVol] = useState(Math.round((fix.gain ?? 1) * 100));
  useEffect(() => setVol(Math.round((fix.gain ?? 1) * 100)), [fix.gain]);
  const commit = () => { const g = vol / 100; if (Math.abs(g - (fix.gain ?? 1)) > 0.004) set({ gain: Math.abs(g - 1) < 0.004 ? undefined : g }); };
  return (
    <div className="card">
      <div className="sec">Sound{(fix.gain != null || fix.soften) && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>edited</span>}</div>
      <div className="row2"><label>Volume</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="range" min={0} max={150} step={5} value={vol} disabled={busy} style={{ flex: 1, accentColor: 'var(--accent)' }}
            onChange={(e) => setVol(+e.target.value)} onMouseUp={commit} onKeyUp={commit} onTouchEnd={commit} />
          <span style={{ minWidth: 44, textAlign: 'right', color: 'var(--dim)' }}>{vol}%</span>
        </div></div>
      <div className="check-row"><span>Soften (shouted / too close to the mic)</span>
        <div className={`switch ${fix.soften ? 'on' : ''}`} onClick={() => !busy && set({ soften: fix.soften ? undefined : true })} /></div>
      <div className="help">Rebuilds the sound in a few seconds. Soften takes the harshness out and evens the peaks; Volume turns the line up or down.</div>
    </div>
  );
}
