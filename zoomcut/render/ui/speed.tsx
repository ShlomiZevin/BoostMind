import React, { useState } from 'react';

const SPEEDS = [1, 1.05, 1.1, 1.2, 1.3];
// the presets, and his own exact number beside them (0.5-2x; typed, applied on Enter or leaving the box)
export function SpeedPick({ speed, onSpeed }: { speed: number; onSpeed: (v: number) => void }) {
  // the presets and a sixth button: "Custom" - his own number, lit like a preset when it is the speed; click to type it
  const own = !SPEEDS.includes(speed);
  const [edit, setEdit] = useState(false);
  const [txt, setTxt] = useState('');
  const open = () => { setTxt(own ? String(speed) : ''); setEdit(true); };
  const commit = () => {
    setEdit(false);
    const v = +txt;
    if (txt.trim() && Number.isFinite(v)) { const c = Math.min(2, Math.max(0.5, +v.toFixed(3))); if (c !== speed) onSpeed(c); }
  };
  return <div className="seg spd" style={{ gridTemplateColumns: `repeat(${SPEEDS.length}, 1fr) 1.25fr` }}>
    {SPEEDS.map((v) => <button key={v} className={speed === v ? 'on' : ''} onClick={() => onSpeed(v)}>{v === 1 ? '1×' : `${v}×`}</button>)}
    {edit
      ? <span className="spd-edit"><input autoFocus type="number" min={0.5} max={2} step={0.01} value={txt} placeholder="1.15"
          onChange={(e) => setTxt(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setTxt(''); setEdit(false); } }} />×</span>
      : <button className={own ? 'on spd-own' : 'spd-own'} onClick={open} title="Your own speed (0.5-2×): click, type it, Enter">
          {own ? <>{+speed.toFixed(3)}×<small>custom</small></> : <>Custom…</>}</button>}
  </div>;
}
