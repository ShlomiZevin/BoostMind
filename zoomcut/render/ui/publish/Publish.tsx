// Publish - the exported video to his socials (render/publish.mjs). One window: the video on the left; on the right
// the caption and a card per platform (on / off, its options, then its progress and a link to the post). Opened from
// Export ("Export and publish…" - the export publishes by itself when it ends) or from the Publish button (the file
// already made). A platform not connected yet shows as such; Facebook is Instagram's own "Share to Facebook".
// The project remembers what he picked (episode.json publish); a new project starts from his last picks.
import React, { useEffect, useMemo, useState } from 'react';
import './publish.css';

type Platform = { id: string; name: string; what: string; manual?: boolean; ok: boolean; handle?: string; note?: string; until?: string; limits: any };
type Item = { state: string; log: string[]; url?: string | null; note?: string; error?: string };
type Run = { running: boolean; items: Record<string, Item> } | null;

const api = async (url: string, body?: any) =>
  (await fetch(url, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined)).json();
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} } };

// each platform's colour and mark (plain shapes in one solid colour - no logos copied)
const BRAND: Record<string, { bg: string; fg: string; mark: React.ReactNode }> = {
  instagram: { bg: '#d6336c', fg: '#fff', mark: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" /></svg> },
  tiktok: { bg: '#111', fg: '#fff', mark: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 3h3c.3 2.2 1.6 3.6 4 3.9v3.1c-1.5 0-2.9-.4-4-1.2V15a6 6 0 1 1-6-6v3.2a2.8 2.8 0 1 0 3 2.8V3z" /></svg> },
  youtube: { bg: '#e62117', fg: '#fff', mark: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 8.5v7l6-3.5-6-3.5z" /></svg> },
  x: { bg: '#e8e6e3', fg: '#111', mark: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg> },
  facebook: { bg: '#1877f2', fg: '#fff', mark: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.5V21h3z" /></svg> },
};
// what each platform's post will be, seen before the click (as the adapters send it - YouTube: unknown = PRIVATE)
const VIS: Record<string, (o: any) => string> = {
  instagram: (o) => `PUBLIC · ${o.instagram?.reelsOnly ? 'Reels tab only' : 'grid + Reels tab'}`,
  tiktok: () => 'your DRAFTS (private until you post it)',
  youtube: (o) => (['public', 'unlisted', 'private'].includes(o.youtube?.privacy) ? o.youtube.privacy.toUpperCase() : 'PRIVATE'),
  x: () => 'PUBLIC',
  facebook: () => 'a Telegram reminder - you share the Instagram Reel',
};
export const Mark = ({ id, size = 34 }: { id: string; size?: number }) => {
  const b = BRAND[id] || { bg: 'var(--panel-3)', fg: 'var(--text)', mark: null };
  return <span className="pb-mark" style={{ width: size, height: size, background: b.bg, color: b.fg }}>{b.mark}</span>;
};

export function PublishWindow({ ep, mode, output, stale, onExport, onClose }: {
  ep: string;
  mode: 'export' | 'now';  // 'export': save the post, the export publishes it when it ends; 'now': the file already made
  output: string | null; stale: boolean;
  onExport: () => void;     // start the export (the window has saved the post)
  onClose: () => void;
}) {
  const [platforms, setPlatforms] = useState<Platform[] | null>(null);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [yTitle, setYTitle] = useState('');
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [opt, setOpt] = useState<any>({ instagram: { reelsOnly: false }, youtube: { privacy: 'public' } });
  const [run, setRun] = useState<Run>(null);
  const [err, setErr] = useState('');
  const [duration, setDuration] = useState(0);
  const [file, setFile] = useState<{ name: string; size: number; exported: number; stale: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      const [pl, cur] = await Promise.all([api('/api/publish/platforms'), api(`/api/ep/${ep}/publish`)]);
      setPlatforms(pl);
      setTitle(cur.title || ep);
      setFile(cur.file || null);
      const post = cur.post, last = JSON.parse(store.get('zc-publish') || '{}');
      setCaption(post?.caption ?? '');
      setYTitle(post?.title || cur.title || '');
      const picks: string[] = post?.platforms || last.platforms || pl.filter((p: Platform) => p.ok && !p.manual).map((p: Platform) => p.id);
      setOn(Object.fromEntries(pl.map((p: Platform) => [p.id, p.ok && !p.manual && picks.includes(p.id)])));
      if (post?.options || last.options) setOpt({ ...opt, ...(last.options || {}), ...(post?.options || {}) });
      if (cur.run) setRun(cur.run);
    })();
  }, [ep]);
  // a run going on: follow it
  useEffect(() => {
    if (!run?.running) return;
    const t = setTimeout(async () => { const cur = await api(`/api/ep/${ep}/publish`); setRun(cur.run); }, 1200);
    return () => clearTimeout(t);
  }, [run]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose]);

  const picked = useMemo(() => (platforms || []).filter((p) => on[p.id]), [platforms, on]);
  const post = () => ({ platforms: picked.map((p) => p.id), caption, title: yTitle, options: opt });
  const warn = (p: Platform) => {
    const w: string[] = [];
    if (p.limits?.caption && caption.length > p.limits.caption) w.push(`${p.name} takes the first ${p.limits.caption} characters`);
    if (p.limits?.seconds && duration > p.limits.seconds) w.push(`longer than ${p.name}'s ${Math.floor(p.limits.seconds / 60)}:${String(p.limits.seconds % 60).padStart(2, '0')}`);
    return w;
  };
  const go = async (exportFirst: boolean) => {
    setErr('');
    store.set('zc-publish', JSON.stringify({ platforms: post().platforms, options: opt }));
    if (exportFirst) { await api(`/api/ep/${ep}/publish`, { ...post(), afterExport: true }); onExport(); onClose(); return; }
    const r = await api(`/api/ep/${ep}/publish`, post());
    if (r.error) setErr(r.error); else setRun(r.run);
  };
  const running = !!run?.running, finished = run && !run.running;
  const isStale = !!(file?.stale ?? stale);
  const when = (t: number) => { const d = new Date(t), today = new Date().toDateString() === d.toDateString(); return (today ? 'today ' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ') + d.toTimeString().slice(0, 5); };
  const len = duration ? `${Math.floor(duration / 60)}:${String(Math.round(duration % 60)).padStart(2, '0')}` : '';
  const doneCount = run ? Object.values(run.items).filter((i) => i.state === 'done').length : 0;

  return (
    <div className="pb" onMouseDown={(e) => { if (e.target === e.currentTarget && !running) onClose(); }}>
      <div className="pb-box">
        <div className="pb-video">
          {output ? <video src={`${output}?v=${Date.now()}`} muted autoPlay loop playsInline onLoadedMetadata={(e) => setDuration((e.target as HTMLVideoElement).duration || 0)} />
            : <div className="pb-novideo"><div className="pb-novideo-t he">{title}</div><div className="pb-novideo-s">The video is made when you export</div></div>}
          {isStale && output && mode === 'now' && <div className="pb-stale">Older than your last changes</div>}
        </div>

        <div className="pb-side">
          <div className="pb-h">
            <div><div className="pb-title">Publish</div><div className="pb-sub he">{title}</div></div>
            <button className="pb-x" onClick={onClose} title="Close (Esc)">✕</button>
          </div>

          <label className="pb-l">Caption</label>
          <textarea className="pb-cap he" dir="auto" rows={4} value={caption} disabled={running} placeholder="What goes under the video - text, #hashtags"
            onChange={(e) => setCaption(e.target.value)} />
          <div className="pb-count">{caption && <button className="pb-copy" onClick={() => navigator.clipboard?.writeText(caption)} title="Copy the caption">Copy</button>}{caption.length}</div>

          <div className="pb-l" style={{ marginTop: 14 }}>Where</div>
          <div className="pb-list">
            {(platforms || []).map((p) => {
              const it = run?.items[p.id];
              const sel = !!on[p.id];
              return (
                <div key={p.id} className={`pb-card ${sel ? 'on' : ''} ${!p.ok ? 'off' : ''} ${it ? 'st-' + it.state : ''}`}>
                  <div className="pb-row" onClick={() => { if (p.ok && !p.manual && !run) setOn({ ...on, [p.id]: !sel }); }}>
                    <Mark id={p.id} />
                    <div className="pb-main">
                      <div className="pb-name">{p.name} <span className="pb-what">{p.what}</span></div>
                      <div className="pb-meta">{p.manual ? p.note : !p.ok ? 'Not connected yet' : [p.handle, p.note].filter(Boolean).join(' · ')}</div>
                      {sel && !run && <div className={`pb-vis ${VIS[p.id]?.(opt) === 'PUBLIC' ? 'pub' : ''}`}>Goes out: {VIS[p.id]?.(opt) || '-'}</div>}
                    </div>
                    {it ? <span className={`pb-state ${it.state}`}>{it.state === 'done' ? '✓' : it.state === 'failed' ? '!' : it.state === 'publishing' ? <span className="pb-spin" /> : it.state === 'skipped' ? '–' : '…'}</span>
                      : p.ok && !p.manual ? <div className={`switch ${sel ? 'on' : ''}`} /> : null}
                  </div>
                  {sel && !run && p.id === 'instagram' && (
                    <div className="pb-opt"><div className="seg" style={{ gridTemplateColumns: '1fr 1fr' }}>
                      <button className={!opt.instagram?.reelsOnly ? 'on' : ''} onClick={() => setOpt({ ...opt, instagram: { reelsOnly: false } })}>Grid + Reels</button>
                      <button className={opt.instagram?.reelsOnly ? 'on' : ''} onClick={() => setOpt({ ...opt, instagram: { reelsOnly: true } })}>Reels tab only</button>
                    </div><div className="pb-tip">Then tap "Share to Facebook" on it in Instagram</div></div>)}
                  {sel && !run && p.id === 'youtube' && (
                    <div className="pb-opt">
                      <input className="pb-in he" dir="auto" value={yTitle} maxLength={100} placeholder="Title" onChange={(e) => setYTitle(e.target.value)} />
                      <div className="seg" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginTop: 6 }}>
                        {['public', 'unlisted', 'private'].map((v) => <button key={v} className={opt.youtube?.privacy === v ? 'on' : ''} onClick={() => setOpt({ ...opt, youtube: { privacy: v } })}>{v[0].toUpperCase() + v.slice(1)}</button>)}
                      </div></div>)}
                  {sel && !run && p.id === 'tiktok' && <div className="pb-opt"><div className="pb-tip">Goes to your TikTok drafts - TikTok takes no text with a draft, so the caption comes to your Telegram to paste; add a sound and post</div></div>}
                  {sel && !run && p.id === 'x' && (
                    <div className="pb-opt"><textarea className="pb-in he" dir="auto" rows={2} value={opt.x?.text ?? ''} placeholder={`Its own text (empty = the caption${caption.length > 280 ? ', cut at 280' : ''})`}
                      onChange={(e) => setOpt({ ...opt, x: { text: e.target.value } })} /></div>)}
                  {sel && !run && p.id === 'facebook' && !on.instagram && <div className="pb-warn">Needs Instagram on - the reminder shares that Reel</div>}
                  {sel && !run && warn(p).map((w) => <div key={w} className="pb-warn">{w}</div>)}
                  {it && (it.state === 'publishing' || it.state === 'waiting') && <div className="pb-log">{it.log.at(-1) || (it.state === 'waiting' ? 'waiting for its turn' : 'starting…')}</div>}
                  {it?.state === 'done' && <div className="pb-done">{it.url ? <a href={it.url} target="_blank" rel="noreferrer">Open the {p.what.toLowerCase()} ↗</a> : null}{it.note ? <span>{it.note}</span> : null}</div>}
                  {(it?.state === 'failed' || it?.state === 'skipped') && <div className="pb-warn">{it.error}</div>}
                </div>
              );
            })}
            {!platforms && <div className="pb-tip">Loading…</div>}
          </div>

          {mode === 'now' && file && !finished && (  // what goes out - seen before the click
            <div className={`pb-file ${isStale ? 'stale' : ''}`}>
              <div className="pb-file-n">{file.name}</div>
              <div className="pb-file-m">{[len, `${(file.size / 1048576).toFixed(1)} MB`, `exported ${when(file.exported)}`].filter(Boolean).join(' · ')}</div>
              {isStale && <div className="pb-file-w">You changed the video after this export - export again to publish it</div>}
            </div>)}
          {err && <div className="pb-warn" style={{ marginTop: 10, marginLeft: 0 }}>{err}</div>}
          <div className="pb-foot">
            {finished ? (
              <><div className="pb-sum">{doneCount ? `Out in ${doneCount} place${doneCount === 1 ? '' : 's'} ✓` : 'Nothing went out'}</div>
                <button className="btn" onClick={() => setRun(null)}>Publish again</button><button className="btn primary" onClick={onClose}>Done</button></>
            ) : running ? (
              <><div className="pb-sum">Publishing… you can close this, it carries on</div><button className="btn" onClick={onClose}>Close</button></>
            ) : mode === 'export' || !output ? (
              <><div className="pb-sum">{picked.length ? `When the export is done → ${picked.map((p) => p.name).join(', ')}` : 'Pick where it goes'}</div>
                <button className="btn primary" disabled={!picked.length} onClick={() => go(true)}>Export & publish</button></>
            ) : (
              <><div className="pb-sum">{picked.length ? picked.map((p) => p.name).join(', ') : 'Pick where it goes'}</div>
                {isStale  // (never a file older than his last change - it goes out public and can't be undone)
                  ? <button className="btn primary" disabled={!picked.length} onClick={() => go(true)} title="Export with your latest changes - it publishes when the export ends">Export again & publish</button>
                  : <button className="btn primary" disabled={!picked.length} onClick={() => go(false)}>Publish to {picked.length}</button>}</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// the top bar's state while a publish runs (from any window / tab): "Publishing · Instagram ✓ · X …"
export function usePublishState(ep: string) {
  const [run, setRun] = useState<Run>(null);
  useEffect(() => {
    if (!ep) return;
    let stop = false;
    const look = async () => {
      const cur = await api(`/api/ep/${ep}/publish`).catch(() => null);
      if (stop) return;
      setRun(cur?.run || null);
      setTimeout(look, cur?.run?.running ? 1500 : 8000);
    };
    look();
    return () => { stop = true; };
  }, [ep]);
  return run;
}
