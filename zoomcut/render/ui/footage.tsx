// The footage of a Zoom project: who is in each file (the layered editor's Media tab shows it while files wait for a name)
import React, { useState } from 'react';
import { api, Data, Job } from './common';
import { VideoPeek, PeekThumb } from './layers/VideoPeek';

export function Media({ data, ep, busy, onJob }: { data: Data | null; ep: string; busy: boolean; onJob: (j: Job) => void }) {
  const [peek, setPeek] = useState<string | null>(null);  // a file playing whole - to see who it is
  const f = data?.footage;
  if (!f) return <div className="empty" style={{ padding: 16 }}>No footage scanned yet.</div>;
  const chars = data!.episode?.characters || [];
  const picked = (data!.episode?.files || {}) as Record<string, any>;  // picks made since the last scan show at once
  const rows = [...f.unassigned.map((rel) => ({ rel, char: picked[rel]?.char || '', kind: picked[rel]?.kind || 'lines' })), ...f.clips];
  const assign = async (rel: string, char: string, kind: string) => {
    const r = await api(`/api/ep/${ep}/files`, { files: { [rel]: { char, kind } } });
    if (r?.running) onJob(r); else window.dispatchEvent(new Event('studio-reload'));  // (waiting for the other files: just show the pick)
  };
  return (
    <>
      {f.unassigned.length > 0 && <div className="note">Pick a character for every file — the edit continues once all are assigned.</div>}
      {rows.map((r) => {
        const c = chars.find((x: any) => x.id === r.char);
        return (
          <div key={r.rel} className="item">
            <PeekThumb src={`/api/ep/${ep}/footthumb?rel=${encodeURIComponent(r.rel)}`} onPlay={() => setPeek(r.rel)} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="name">{r.rel}</div>
              <div className="ctl">
                <select className="field" disabled={busy} value={r.char} onChange={(e) => assign(r.rel, e.target.value, r.kind)}>
                  <option value="">Who is this?</option>
                  {chars.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <select className="field" disabled={busy || !r.char} value={r.kind} onChange={(e) => assign(r.rel, r.char, e.target.value)}>
                  <option value="lines">Dialogue</option>
                  <option value="listen">Listening</option>
                </select>
              </div>
            </div>
          </div>);
      })}
      {peek && <VideoPeek src={`/api/ep/${ep}/footage?rel=${encodeURIComponent(peek)}`} name={peek} onClose={() => setPeek(null)}>
        <select className="field" disabled={busy} value={rows.find((x) => x.rel === peek)?.char || ''}
          onChange={(e) => { const r = rows.find((x) => x.rel === peek)!; assign(r.rel, e.target.value, r.kind); }}>
          <option value="">Who is this?</option>
          {chars.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select></VideoPeek>}
    </>
  );
}
