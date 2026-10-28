import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
// The editor: the top bar (project menu, jobs, Send / Publish) around the one layered editor. A video made before layers
// (no project.json) shows a card instead - Re-analyze builds its layers and it opens here like every other.
import { api, Data, I, Job, Proj, tabProject } from './common';
import { LayersEditor, LayersBoundary } from './layers/LayersEditor';
import { NewVideo } from './newvideo';
import { PublishWindow, usePublishState, Mark } from './publish/Publish';

// the fonts the layers draw with ("zc-<id>", e.g. the subtitles' zc-assistant) - declared once for the whole page
fetch('/api/fonts').then((r) => r.json()).then((l: { id: string; name: string; file: string | null }[]) => {
  const css = l.filter((f) => f.file).map((f) => `@font-face{font-family:"zc-${f.id}";src:url(/fonts/${f.file});font-weight:100 900;}`).join('');
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
}).catch(() => {});

// ---------- app ------------------------------------------------------------------------
function Editor() {
  const [eps, setEps] = useState<Proj[]>([]);
  const [pubWin, setPubWin] = useState<null | 'export' | 'now'>(null);  // the Publish window (to his socials)
  const [stalePick, setStalePick] = useState<'email' | 'telegram' | null>(null);
  const setDone = async (id: string, done: boolean) => {
    setEps((l) => l.map((e) => (e.id === id ? { ...e, done } : e)));
    await api(`/api/ep/${id}/done`, { done });
  };
  const projSel = useRef<HTMLSelectElement>(null);
  useEffect(() => {  // the shared menu's ✓
    const el = projSel.current; if (!el) return;
    const on = (e: any) => setDone(e.detail.value, e.detail.done);
    el.addEventListener('studio-done', on);
    return () => el.removeEventListener('studio-done', on);
  });
  const [ep, setEp] = useState(tabProject.get());  // this tab's project (another tab can hold another video)
  const pubRun = usePublishState(ep);  // a publish to his socials going on (the top bar shows it)
  const [data, setData] = useState<Data | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const chars: any[] = data?.episode?.characters || [];
  useEffect(() => { api('/api/episodes').then((l) => { setEps(l); if (!l.find((e: any) => e.id === ep) && !ep.startsWith('_')) setEp(l.find((e: any) => !e.id.endsWith('-test'))?.id || l[0]?.id); }); }, []);
  const load = useCallback(async () => { if (!ep) return; const d: Data = await api(`/api/ep/${ep}`); setData(d); setJob(d.job); }, [ep]);
  useEffect(() => { if (ep) { tabProject.set(ep); setData(null); load(); } }, [ep]);
  useEffect(() => { const on = () => load(); window.addEventListener('studio-reload', on); return () => window.removeEventListener('studio-reload', on); }, [load]);
  useEffect(() => {  // one project for every tool: picked in the Reader or Karaoke -> opened here too
    const on = (e: StorageEvent) => { if (e.key === 'zc-ep' && e.newValue && e.storageArea === sessionStorage) setEp(e.newValue); };  // this tab's tools only
    addEventListener('storage', on);
    return () => removeEventListener('storage', on);
  }, []);
  useEffect(() => {  // a job already running (another tab, before a refresh): follow it
    if (!ep) return;
    api(`/api/ep/${ep}/job`).then((j: any) => { if (j?.running) setJob(j); }).catch(() => {});  // (no job yet: an empty answer)
  }, [ep]);
  useEffect(() => {
    if (!job?.running) return;
    const t = setInterval(async () => { const j: Job = await api(`/api/ep/${ep}/job`); setJob(j); if (!j.running) { clearInterval(t); load(); if (!j.code && j.send?.length) followSends(j.send); } }, 700);
    return () => clearInterval(t);
  }, [job?.running, ep]);

  useEffect(() => {  // (the arrows up / down never scroll the page - the editor's own keys do the rest)
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') e.preventDefault();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  // ---- share the exported video ----
  const [share, setShare] = useState<{ channel: string; running: boolean; ok: boolean | null; log: string[]; error: string | null } | null>(null);
  const sendOrAsk = (channel: 'email' | 'telegram') => ((data as any)?.outputStale ? setStalePick(channel) : send(channel));  // an old export: ask first
  const send = async (channel: 'email' | 'telegram') => {
    let j = await api(`/api/ep/${ep}/share`, { channel });
    if (j.error && !j.channel) { setShare({ channel, running: false, ok: false, log: [], error: j.error }); return; }
    setShare(j);
    while (j?.running) { await new Promise((r) => setTimeout(r, 1000)); j = await api(`/api/ep/${ep}/share/${channel}`); setShare(j); }
  };
  const followSends = async (channels: string[]) => {
    for (const ch of channels) {
      let j: any = null;
      for (let i = 0; i < 600; i++) {
        j = await api(`/api/ep/${ep}/share/${ch}`);
        if (j) setShare(j);
        if (j && !j.running) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  };
  // sends run by the server (after an export, after a restart, from another tab) show here too
  useEffect(() => {
    if (!ep) return;
    let stop = false;
    const look = async () => {
      const all = (await Promise.all(['telegram', 'email'].map((c) => api(`/api/ep/${ep}/share/${c}`).catch(() => null)))).filter(Boolean) as any[];
      const now = all.find((x) => x.running) || all.sort((x, y) => (y.ended || 0) - (x.ended || 0))[0];
      if (!stop && now && (now.running || !share?.running)) setShare(now);
      if (!stop) setTimeout(look, all.some((x) => x.running) ? 1500 : 6000);
    };
    look();
    return () => { stop = true; };
  }, [ep]);
  const shareText = share && (share.running ? (share.log[share.log.length - 1] || 'Preparing…')
    : share.ok ? (share.channel === 'email' ? '✓ Sent by email' : '✓ Sent to Telegram') : `Send failed: ${share.error}`);

  const busy = !!job?.running;
  const last = (job?.log?.length ? job.log[job.log.length - 1] : '').trim();
  const pct = job?.kind === 'export' && /Rendered (\d+)\/(\d+)/.exec(last);
  const statusText = busy
    ? job!.kind === 'export' ? (pct ? `Exporting · ${Math.round(100 * +pct[1] / +pct[2])}%` : last.includes('interface') ? 'Exporting · drawing the interface…' : 'Exporting…')
      : last.startsWith('cutting out') ? last.replace('cutting out', 'Removing background ·') : last.startsWith('· transcribing') ? last.replace('· transcribing', 'Listening to') : 'Updating preview…'
    : job?.code === 2 && data?.footage?.unassigned?.length ? 'Waiting: who is in each file' : job?.code ? 'Last run failed' : ((data as any)?.layeredReady || data?.state || (data as any)?.preview || (data as any)?.output || (data as any)?.layers?.person) ? 'Preview ready' : 'Not analyzed yet';

  const lessonData = (data as any)?.episode?.type === 'lesson' ? (data as any) : null;
  const ready = !!(data as any)?.layered || !!data?.state || !!lessonData?.preview || !!lessonData?.output || !!lessonData?.layers?.person;  // a layered preview counts
  const top = (
      <div className="top studio-top">
        {/* @ts-ignore - the shared studio bar (render/studio/bar.js) */}
        <studio-nav app="video"></studio-nav>
        <div className="proj">
          {/* the shared project menu (render/studio/bar.js) draws this - the same one in every tool */}
          <select data-picker="project" ref={projSel} value={ep} onChange={(e) => setEp(e.target.value)}>
            {eps.map((e) => <option key={e.id} value={e.id} data-sub={e.title} data-done={e.done ? '1' : '0'} data-tag={e.test ? 'test' : undefined}
              data-meta={`${e.template || ''} · ${e.created ? new Date(e.created).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}`}>{e.id}</option>)}
          </select>
        </div>
        {job?.kind === 'export' && (busy || share?.running) ? (() => {
          // the export, step by step: preparing -> rendering n% -> sending -> done
          const rendered = /Rendered (\d+)\/(\d+)/.exec((job?.log || []).filter((l: string) => l.startsWith('Rendered')).at(-1) || '');
          const p = rendered ? +rendered[1] / +rendered[2] : 0;
          const stage = !busy ? (share?.log?.at(-1) || 'Sending…') : rendered ? `Rendering ${Math.round(p * 100)}%` : 'Preparing the layers and the sound…';
          const dest = (job?.send || []).map((c: string) => (c === 'email' ? 'Email' : 'Telegram')).join(' + ');
          return <div className="xp">
            <span className="xp-k">Exporting {ep}</span>
            <div className="xp-bar"><div style={{ width: `${Math.round((busy ? (rendered ? 0.08 + 0.92 * p : 0.04) : 1) * 100)}%` }} /></div>
            <span className="xp-s">{stage}</span>
            <span className="xp-d">{busy ? (dest ? `then → ${dest}` : 'then → the file only') : ''}</span>
          </div>;
        })() : <div className="state"><span className={`ring ${busy ? 'busy' : job?.code && !(job.code === 2 && data?.footage?.unassigned?.length) ? 'err' : ''}`} />{statusText}</div>}
        <div className="grow" />
        {busy && <button className="btn" onClick={async () => setJob(await api(`/api/ep/${ep}/cancel`, {}))}>{I.stop} Stop</button>}
        <button className="btn" disabled={busy} onClick={async () => setJob(await api(`/api/ep/${ep}/analyze`, {}))}>Re-analyze</button>
        {shareText && <div className="state" style={{ color: share!.ok === false ? 'var(--bad)' : share!.ok ? 'var(--ok)' : 'var(--dim)' }}>{shareText}</div>}
        {data?.output && !busy && <a href={`${data.output}?v=${Date.now()}`} target="_blank"><button className="btn">Open MP4</button></a>}
        {pubRun && (pubRun.running || Date.now() - ((pubRun as any).ended || 0) < 10 * 60e3) && <span className="pb-top" title="Open the Publish window" onClick={() => setPubWin('now')}>
          {pubRun.running ? 'Publishing' : 'Published'} {Object.entries(pubRun.items).map(([p, it]: any) => <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Mark id={p} size={16} />{it.state === 'done' ? '✓' : it.state === 'failed' ? '!' : it.state === 'skipped' ? '–' : '…'}</span>)}</span>}
        {pubWin && <PublishWindow ep={ep} canTest={!lessonData || !!(data as any)?.layered} onClose={() => setPubWin(null)}
          onExport={async (send) => { setShare(null); setJob(await api(`/api/ep/${ep}/export`, { send, quick: false })); }}
          onTest={async () => { setShare(null); setJob(await api(`/api/ep/${ep}/export`, { test: true, send: ['telegram'] })); }} />}
        {stalePick && <div className="pm-modal" onClick={() => setStalePick(null)}>
          <div className="pm-box" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>The video changed after the last export</div>
            <div className="help" style={{ margin: '0 0 14px' }}>The file you'd send doesn't have your latest changes.</div>
            <div style={{ display: 'grid', gap: 6 }}>
              <button className="btn primary" onClick={async () => { const ch = stalePick; setStalePick(null); setShare(null); setJob(await api(`/api/ep/${ep}/export`, { send: [ch] })); }}>Export again, then send it</button>
              <button className="btn" onClick={() => { const ch = stalePick; setStalePick(null); send(ch); }}>Send the old file anyway</button>
              <button className="btn ghost" onClick={() => setStalePick(null)}>Cancel</button>
            </div>
          </div>
        </div>}
        <button className="btn primary" disabled={busy || !ready} onClick={() => setPubWin('now')} title="Test on your phone, send the file, publish - one window">{I.export} Send</button>
      </div>
  );
  // a layered project (project.json): the one layered editor - every layer a lane, every change an op
  if ((data as any)?.layered) return <LayersBoundary><LayersEditor ep={ep} top={top} job={job} setJob={setJob} jobLine={busy ? statusText : ''} reloadEp={load} chars={chars} epData={data} /></LayersBoundary>;
  // a video made before layers: Re-analyze builds them (from its footage and its settings) and it opens in the editor
  return (
    <div className="ed" style={{ gridTemplateRows: '52px minmax(0, 1fr)' }}>
      {top}
      <div style={{ overflow: 'auto', padding: 12, display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 560px)', alignContent: 'start' }}>
        {data && <div className="card" style={{ gap: 10 }}>
          <div className="card-h"><div className="title grow">Made before layers</div></div>
          <div className="help" style={{ marginTop: 0 }}>{busy ? 'Analyzing: listening to the takes, cutting, the subtitles - it opens here as layers when it is done.'
            : 'This video was edited before the editor had layers. Re-analyze builds its layers from its footage and its settings, and it opens here like every other video.'}</div>
          <button className="btn primary" disabled={busy} onClick={async () => setJob(await api(`/api/ep/${ep}/analyze`, {}))}>{busy ? 'Analyzing…' : 'Re-analyze'}</button>
        </div>}
        <div className="card"><div className="card-h"><div className="title grow">+ New video</div></div><NewVideo /></div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Editor />);
