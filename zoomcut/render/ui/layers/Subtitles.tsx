// Every subtitle of the video in one list (his ask, 2026-10-28: "a place to see all the subtitles... and copy all"):
// in time order, the one on screen now lit and kept in view; a click picks it on the timeline (and the video jumps to
// it); Copy all = every subtitle's words, one per line (or with their times).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fmtT } from './api';

type Sel = { layer: string; item?: string } | null;

export function Subtitles({ project, frame, sel, onPick }: { project: any; frame: number; sel: Sel; onPick: (s: Sel) => void }) {
  const fps = project.canvas.fps, speed = project.speed || 1;
  const layers = project.layers.filter((l: any) => l.kind === 'subtitles');
  const rows = useMemo(() => layers.flatMap((l: any) => (l.items || []).map((it: any) => ({ l, it })))
    .filter((r: any) => String(r.it.text || '').trim())
    .sort((a: any, b: any) => a.it.from - b.it.from), [project]);
  const now = rows.find((r: any) => frame >= r.it.from && frame < r.it.from + r.it.dur);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {  // (the one on screen stays in view while it plays)
    const el = now && box.current?.querySelector(`[data-sub="${CSS.escape(now.l.id + '|' + now.it.id)}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [now?.it.id]);
  const [copied, setCopied] = useState('');
  const copy = async (times: boolean) => {
    const text = rows.map((r: any) => (times ? `${fmtT(r.it.from / fps / speed)}  ` : '') + String(r.it.text).trim()).join('\n');
    try { await navigator.clipboard.writeText(text); setCopied(times ? 'times' : 'all'); }
    catch { setCopied('fail'); }
    setTimeout(() => setCopied(''), 1600);
  };
  if (!rows.length) return <div className="empty" style={{ padding: 16 }}>No subtitles in this video yet.</div>;
  return (
    <div className="subs-all" ref={box}>
      <div className="subs-bar">
        <span className="help" style={{ margin: 0 }}>{rows.length} subtitles</span>
        <div className="grow" />
        <button className="btn" style={{ height: 26, padding: '0 10px', fontSize: 12 }} onClick={() => copy(false)} title="Every subtitle's words, one per line">
          {copied === 'all' ? 'Copied ✓' : copied === 'fail' ? 'Could not copy' : 'Copy all'}</button>
        <button className="btn ghost" style={{ height: 26, padding: '0 8px', fontSize: 12 }} onClick={() => copy(true)} title="The same, each with its time in the video">
          {copied === 'times' ? 'Copied ✓' : 'with times'}</button>
      </div>
      {rows.map((r: any) => {
        const on = sel?.layer === r.l.id && sel.item === r.it.id;
        return (
          <div key={r.l.id + '|' + r.it.id} data-sub={r.l.id + '|' + r.it.id} className={`sub-row ${on ? 'on' : ''} ${now === r ? 'now' : ''}`}
            onClick={() => onPick({ layer: r.l.id, item: r.it.id })} title="Pick it on the timeline">
            <span className="sub-t">{fmtT(r.it.from / fps / speed)}</span>
            <span className="sub-x he" dir="auto">{String(r.it.text).trim()}</span>
            {layers.length > 1 && <span className="sub-l">{r.l.name || r.l.id}</span>}
          </div>
        );
      })}
    </div>
  );
}
