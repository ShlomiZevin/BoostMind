import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Player, PlayerRef } from '@remotion/player';
import { ZoomCall } from '../src/ZoomCall';

type Fix = { clip?: string; in?: number; out?: number; cut?: number; layout?: string; pause_before?: number; skip?: boolean };
type Take = { clip: string; in: number; out: number; cut?: number; score?: number; heard?: string };
type Line = {
  n: number; speaker: string; name: string; text: string; interrupted: boolean;
  status: 'ok' | 'check' | 'missing' | 'skipped'; score: number | null; heard: string;
  auto: Take | null; alternatives: Take[]; clip: string | null; in: number | null; out: number | null;
  cut: number | null; start: number | null; fix: Fix;
};
type Job = { running: boolean; kind: string; log: string[]; code: number | null };
type Data = {
  episode: any; state: { lines: Line[]; total: number; takes: string[] } | null; edit: any;
  footage: { clips: { rel: string; char: string; kind: string }[]; unassigned: string[] } | null;
  audioVersion: number | null; output: string | null; job: Job | null;
};

const api = async (url: string, body?: any) => {
  const r = await fetch(url, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  return r.json();
};
const fmt = (t: number | null | undefined) => (t == null ? '–' : t.toFixed(2));
const COLORS: Record<string, string> = { amir: 'var(--amir)', ofer: 'var(--ofer)', daniel: 'var(--daniel)' };
const STATUS: Record<string, string> = { ok: 'matched', check: 'check', missing: 'missing', skipped: 'skipped' };

function App() {
  const [eps, setEps] = useState<{ id: string; title: string }[]>([]);
  const [ep, setEp] = useState<string>(() => localStorage.getItem('zc-ep') || '');
  const [data, setData] = useState<Data | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [frame, setFrame] = useState(0);
  const player = useRef<PlayerRef>(null);

  useEffect(() => {
    api('/api/episodes').then((l) => {
      setEps(l);
      if (!ep || !l.find((e: any) => e.id === ep)) setEp(l.find((e: any) => !e.id.endsWith('-test'))?.id || l[0]?.id);
    });
  }, []);

  const load = useCallback(async () => {
    if (!ep) return;
    const d: Data = await api(`/api/ep/${ep}`);
    setData(d);
    setJob(d.job);
    return d;
  }, [ep]);

  useEffect(() => {
    if (!ep) return;
    try { localStorage.setItem('zc-ep', ep); } catch {}
    setData(null);
    load();
  }, [ep]);

  // poll while a job runs, reload when it ends
  useEffect(() => {
    if (!job?.running) return;
    const t = setInterval(async () => {
      const j: Job = await api(`/api/ep/${ep}/job`);
      setJob(j);
      if (!j.running) { clearInterval(t); load(); }
    }, 700);
    return () => clearInterval(t);
  }, [job?.running, ep]);

  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const h = (e: any) => setFrame(e.detail.frame);
    p.addEventListener('frameupdate', h);
    return () => p.removeEventListener('frameupdate', h);
  }, [data?.edit]);

  const lines = data?.state?.lines || [];
  const fps = data?.edit?.fps || 30;
  const nowLine = useMemo(() => {
    const t = frame / fps;
    let cur: number | null = null;
    for (const l of lines) if (l.start != null && l.start <= t + 0.01) cur = l.n;
    return cur;
  }, [frame, lines, fps]);

  const props = useMemo(() => data?.edit && ({
    ...data.edit, mediaBase: `/media/${ep}/`, audioSrc: data.audioVersion ? `/media/${ep}/dialogue.wav?v=${data.audioVersion}` : undefined,
  }), [data?.edit, data?.audioVersion, ep]);

  const saveFix = async (n: number, fix: Fix) => {
    const clean = Object.fromEntries(Object.entries(fix).filter(([, v]) => v !== undefined && v !== null && v !== ''));
    setJob(await api(`/api/ep/${ep}/line`, { n, fix: clean }));
  };
  const seek = (l: Line) => {
    if (l.start == null || !player.current) return;
    player.current.seekTo(Math.max(0, Math.round((l.start - 0.4) * fps)));
    player.current.play();
  };

  const counts = lines.reduce((a: any, l) => ((a[l.status] = (a[l.status] || 0) + 1), a), {});
  const busy = !!job?.running;
  const lastLog = job?.log?.length ? job.log[job.log.length - 1] : '';
  const exportPct = job?.kind === 'export' && /Rendered (\d+)\/(\d+)/.exec(lastLog);

  return (
    <div className="app">
      <header>
        <div className="brand">zoom<span>cut</span></div>
        <select value={ep} onChange={(e) => setEp(e.target.value)}>
          {eps.map((e) => <option key={e.id} value={e.id}>{e.id}</option>)}
        </select>
        {busy ? (
          <span className="pill busy">{job!.kind === 'export'
            ? (exportPct ? `Rendering ${Math.round((100 * +exportPct[1]) / +exportPct[2])}%` : 'Exporting…')
            : 'Updating preview…'}</span>
        ) : job && job.code ? <span className="pill err">Last run failed</span>
          : data?.state ? <span className="pill ok">{fmt(data.state.total)}s · {lines.length} lines</span> : null}
        <div className="spacer" />
        <button disabled={busy} onClick={async () => setJob(await api(`/api/ep/${ep}/analyze`, {}))}>Re-analyze</button>
        {data?.output && !busy && <a href={`${data.output}?v=${Date.now()}`} target="_blank"><button>Open MP4</button></a>}
        <button className="primary" disabled={busy || !data?.state} onClick={async () => setJob(await api(`/api/ep/${ep}/export`, {}))}>Export MP4</button>
      </header>

      <main>
        <div className="stage">
          <div className="phone">
            {props ? (
              <Player ref={player} component={ZoomCall as any} inputProps={props} durationInFrames={props.durationInFrames}
                fps={props.fps} compositionWidth={1080} compositionHeight={1920} controls
                style={{ width: '100%', height: '100%' }} clickToPlay spaceKeyToPlayOrPause />
            ) : <div className="empty">{busy ? 'Working…' : 'No preview yet — press Re-analyze'}</div>}
          </div>
          <div className="meta">Click a line to jump to it · space plays/pauses · every change rebuilds the preview in a few seconds</div>
        </div>

        <div className="side">
          {data && <Footage data={data} ep={ep} busy={busy} onJob={setJob} />}
          {data && <TextOnVideo key={ep + (data.episode?.overlays?.length || 0)} data={data} ep={ep} busy={busy} onJob={setJob} />}

          {(busy || job?.code) && job?.log?.length ? (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="log">{job.log.slice(-12).join('\n')}</div>
            </div>
          ) : null}

          {lines.length > 0 && (
            <>
              <div className="section-title">Script</div>
              <div className="summary">
                {['ok', 'check', 'missing', 'skipped'].filter((k) => counts[k]).map((k) =>
                  <span key={k} className={`status ${k}`}>{counts[k]} {STATUS[k]}</span>)}
              </div>
            </>
          )}
          <div className="lines">
            {lines.map((l) => (
              <Row key={l.n} l={l} sel={sel === l.n} now={nowLine === l.n} takes={data?.state?.takes || []} busy={busy}
                onClick={() => { setSel(sel === l.n ? null : l.n); seek(l); }} onFix={(f) => saveFix(l.n, f)} />
            ))}
          </div>
          {data && !lines.length && !busy && <div className="empty">No analysis yet for this episode.</div>}
        </div>
      </main>
    </div>
  );
}

function Footage({ data, ep, busy, onJob }: { data: Data; ep: string; busy: boolean; onJob: (j: Job) => void }) {
  const f = data.footage;
  const chars = data.episode?.characters || [];
  const [open, setOpen] = useState(false);
  if (!f) return null;
  const rows = [...f.unassigned.map((rel) => ({ rel, char: '', kind: /listen|react|שקט|תגובה/i.test(rel) ? 'listen' : 'lines' })), ...f.clips];
  const show = open || f.unassigned.length > 0;
  const assign = async (rel: string, char: string, kind: string) => onJob(await api(`/api/ep/${ep}/files`, { files: { [rel]: { char, kind } } }));
  return (
    <div className="card footage">
      <div className="section-title" style={{ margin: 0, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        Footage · {rows.length} files {show ? '▾' : '▸'}
      </div>
      {show && (
        <div style={{ marginTop: 10 }}>
          {f.unassigned.length > 0 && <div className="warn">Tell me whose footage these are — the edit continues once every file has a character.</div>}
          <table><tbody>
            {rows.map((r) => (
              <tr key={r.rel}>
                <td style={{ wordBreak: 'break-all' }}>{r.rel}</td>
                <td>
                  <select disabled={busy} value={r.char} onChange={(e) => assign(r.rel, e.target.value, r.kind)}>
                    <option value="">who?</option>
                    {chars.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </td>
                <td>
                  <select disabled={busy || !r.char} value={r.kind} onChange={(e) => assign(r.rel, r.char, e.target.value)}>
                    <option value="lines">lines</option>
                    <option value="listen">listening</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}
    </div>
  );
}

type Overlay = { text: string; start: number; end: number | null; style: string };

function TextOnVideo({ data, ep, busy, onJob }: { data: Data; ep: string; busy: boolean; onJob: (j: Job) => void }) {
  const [items, setItems] = useState<Overlay[]>(() => data.episode?.overlays || []);
  const [subs, setSubs] = useState<boolean>(data.episode?.subtitles !== false);
  const dirty = JSON.stringify(items) !== JSON.stringify(data.episode?.overlays || []) || subs !== (data.episode?.subtitles !== false);
  const upd = (i: number, patch: Partial<Overlay>) => setItems(items.map((o, k) => (k === i ? { ...o, ...patch } : o)));
  const save = async () => onJob(await api(`/api/ep/${ep}/settings`, { overlays: items.filter((o) => o.text.trim()), subtitles: subs }));
  return (
    <div className="card footage">
      <div className="section-title" style={{ margin: 0 }}>Text on video</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
        {items.map((o, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'start' }}>
            <textarea dir="rtl" rows={2} value={o.text} disabled={busy} onChange={(e) => upd(i, { text: e.target.value })}
              style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 7, padding: '8px 10px',
                color: 'var(--text)', font: '15px Heebo, sans-serif', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
              <div className="ctl"><label>Where</label>
                <select value={o.style} disabled={busy} onChange={(e) => upd(i, { style: e.target.value })}>
                  <option value="pov">top (POV)</option><option value="label">middle</option>
                </select></div>
              <div className="ctl"><label>From (s)</label>
                <input type="number" step={0.5} min={0} value={o.start} disabled={busy} onChange={(e) => upd(i, { start: +e.target.value || 0 })} /></div>
              <div className="ctl"><label>Until (s)</label>
                <input type="number" step={0.5} min={0} placeholder="end" value={o.end ?? ''} disabled={busy}
                  onChange={(e) => upd(i, { end: e.target.value === '' ? null : +e.target.value })} /></div>
              <button className="small" disabled={busy} onClick={() => setItems(items.filter((_, k) => k !== i))}>Remove</button>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button disabled={busy} onClick={() => setItems([...items, { text: items.length ? '' : 'פוב: ', start: 0, end: null, style: 'pov' }])}>+ Add text</button>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--muted)' }}>
            <input type="checkbox" checked={subs} disabled={busy} onChange={(e) => setSubs(e.target.checked)} /> Subtitles
          </label>
          <div style={{ flex: 1 }} />
          <button className="primary" disabled={busy || !dirty} onClick={save}>Apply</button>
        </div>
      </div>
    </div>
  );
}

function Row({ l, sel, now, takes, busy, onClick, onFix }: {
  l: Line; sel: boolean; now: boolean; takes: string[]; busy: boolean; onClick: () => void; onFix: (f: Fix) => void;
}) {
  const fix = l.fix || {};
  const edited = Object.keys(fix).length > 0;
  const cur: Take | null = l.clip ? { clip: l.clip, in: l.in!, out: l.out!, cut: l.cut ?? undefined } : null;
  const options: Take[] = [...(l.auto ? [l.auto] : []), ...l.alternatives];
  const key = (t: Take) => `${t.clip}|${t.in}`;
  const curKey = cur ? options.find((o) => o.clip === cur.clip && Math.abs(o.in - cur.in) < 0.5)?.clip + '|' + options.find((o) => o.clip === cur.clip && Math.abs(o.in - cur.in) < 0.5)?.in : '';
  const set = (patch: Fix) => onFix({ ...fix, ...patch });
  const nudge = (field: 'in' | 'out' | 'cut', d: number) => {
    if (!cur) return;
    const base = (fix as any)[field] ?? (cur as any)[field];
    const patch: Fix = { clip: fix.clip ?? cur.clip, in: fix.in ?? cur.in };
    if (field === 'cut') patch.cut = +(base + d).toFixed(3);
    else { patch.out = fix.out ?? cur.out; (patch as any)[field] = +(base + d).toFixed(3); }
    set(patch);
  };
  return (
    <div className={`row ${sel ? 'sel' : ''} ${now ? 'now' : ''} ${l.status === 'skipped' ? 'dim' : ''}`} onClick={onClick}>
      <div className="row-head">
        <div className="num">{l.n}</div>
        <div className="who" style={{ color: COLORS[l.speaker] || 'var(--text)' }}>{l.name}</div>
        <div>
          <div className="text">{l.text}</div>
          {l.heard && <div className="heard"><b>heard:</b> {l.heard}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className={`status ${l.status}`}>{STATUS[l.status]}{l.score != null && l.status !== 'skipped' ? ` ${Math.round(l.score * 100)}` : ''}</span>
          {edited && <div className="edited">edited</div>}
        </div>
      </div>

      {sel && (
        <div className="controls" onClick={(e) => e.stopPropagation()}>
          <div className="ctl">
            <label>Take</label>
            <select className="take" disabled={busy || !options.length} value={curKey}
              onChange={(e) => {
                const t = options.find((o) => key(o) === e.target.value);
                if (!t) return;
                if (l.auto && key(t) === key(l.auto)) { const { clip, in: _i, out, cut, ...rest } = fix; onFix(rest); }
                else set({ clip: t.clip, in: t.in, out: t.out, cut: l.interrupted ? t.cut : undefined });
              }}>
              {!curKey && cur && <option value="">{cur.clip} @ {fmt(cur.in)} (edited)</option>}
              {options.map((o, i) => (
                <option key={key(o)} value={key(o)}>
                  {i === 0 && l.auto ? 'auto · ' : ''}{o.clip} @ {fmt(o.in)}s{o.score != null ? ` · ${Math.round(o.score * 100)}` : ''}{o.heard ? ` · ${o.heard.slice(0, 40)}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="ctl">
            <label>Start</label>
            <div className="nudge">
              <button className="small" disabled={busy || !cur} onClick={() => nudge('in', -0.05)}>−</button>
              <span className="val">{fmt(fix.in ?? cur?.in)}</span>
              <button className="small" disabled={busy || !cur} onClick={() => nudge('in', 0.05)}>+</button>
            </div>
          </div>
          {l.interrupted ? (
            <div className="ctl">
              <label>Cut off at</label>
              <div className="nudge">
                <button className="small" disabled={busy || !cur} onClick={() => nudge('cut', -0.05)}>−</button>
                <span className="val">{fmt(fix.cut ?? cur?.cut)}</span>
                <button className="small" disabled={busy || !cur} onClick={() => nudge('cut', 0.05)}>+</button>
              </div>
            </div>
          ) : (
            <div className="ctl">
              <label>End</label>
              <div className="nudge">
                <button className="small" disabled={busy || !cur} onClick={() => nudge('out', -0.05)}>−</button>
                <span className="val">{fmt(fix.out ?? cur?.out)}</span>
                <button className="small" disabled={busy || !cur} onClick={() => nudge('out', 0.05)}>+</button>
              </div>
            </div>
          )}
          <div className="ctl">
            <label>Pause before (s)</label>
            <input type="number" step={0.1} min={0} disabled={busy} placeholder="auto" defaultValue={fix.pause_before ?? ''}
              onBlur={(e) => { const v = e.target.value === '' ? undefined : +e.target.value; if (v !== fix.pause_before) set({ pause_before: v }); }} />
          </div>
          <div className="ctl">
            <label>Layout</label>
            <select disabled={busy} value={fix.layout || ''} onChange={(e) => set({ layout: e.target.value || undefined })}>
              <option value="">auto</option>
              <option value="speaker">speaker</option>
              <option value="duo">duo</option>
              <option value="gallery">gallery</option>
            </select>
          </div>
          <div className="ctl">
            <label>&nbsp;</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button disabled={busy} onClick={() => set({ skip: !fix.skip || undefined })}>{fix.skip ? 'Use line' : 'Drop line'}</button>
              <button disabled={busy || !edited} onClick={() => onFix({})}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
