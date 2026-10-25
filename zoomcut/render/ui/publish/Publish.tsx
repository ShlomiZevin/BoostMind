// Publish - the exported video to his socials (render/publish.mjs). One compact window: the video + its caption, a
// tile per platform (tap on / off), the few options only for what's picked, one line of what goes where, one button;
// then each platform's result with a link. Opened from
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
      // (a project's title can carry a working tag - "(spiritual-4)", "(3)": not for the public)
      const clean = String(cur.title || ep).replace(/\s*\([ -~]*\)\s*$/, '').trim();
      setTitle(clean);
      setFile(cur.file || null);
      const post = cur.post, last = JSON.parse(store.get('zc-publish') || '{}');
      setCaption(post?.caption ?? '');
      setYTitle(post?.title || clean);
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

  // one line of what goes where, in plain words (before the click)
  const where = picked.map((p) => (p.id === 'tiktok' ? 'TikTok drafts' : p.id === 'facebook' ? 'a Facebook reminder' : p.id === 'youtube' ? `YouTube (${(opt.youtube?.privacy || 'public')})` : p.name));
  const tileState = (id: string) => run?.items[id]?.state;

  return (
    <div className="pb" onMouseDown={(e) => { if (e.target === e.currentTarget && !running) onClose(); }}>
      <div className="pb-box">
        <div className="pb-h">
          <div className="pb-title">Publish</div>
          <button className="pb-x" onClick={onClose} title="Close (Esc)">✕</button>
        </div>

        {/* the video + its caption */}
        <div className="pb-row1">
          <div className="pb-thumb">
            {output ? <video src={`${output}?v=${Date.now()}`} muted autoPlay loop playsInline onLoadedMetadata={(e) => setDuration((e.target as HTMLVideoElement).duration || 0)} />
              : <span className="pb-thumb-t">made on export</span>}
          </div>
          <div className="pb-capbox">
            <div className="pb-name he">{title}</div>
            <textarea className="pb-cap he" dir="auto" value={caption} disabled={running} placeholder="Caption and #hashtags"
              onChange={(e) => setCaption(e.target.value)} />
            <div className="pb-fileline">
              {mode === 'now' && file ? <span className={isStale ? 'warn' : ''}>{isStale ? 'Changed after this export - export again' : [len, `exported ${when(file.exported)}`].filter(Boolean).join(' · ')}</span> : <span>Publishes when the export is done</span>}
              {caption && <button className="pb-copy" onClick={() => navigator.clipboard?.writeText(caption)}>Copy</button>}
            </div>
          </div>
        </div>

        {/* where: a tile per platform, tap to switch */}
        <div className="pb-tiles">
          {(platforms || []).map((p) => {
            const sel = !!on[p.id], st = tileState(p.id);
            return (
              <button key={p.id} className={`pb-tile ${sel ? 'on' : ''} ${!p.ok ? 'off' : ''} ${st ? 'st-' + st : ''}`} disabled={!p.ok || !!run}
                title={!p.ok ? 'Not connected yet' : p.id === 'facebook' ? 'A Telegram reminder to share the Instagram Reel' : `${p.handle || ''}`}
                onClick={() => setOn({ ...on, [p.id]: !sel })}>
                <Mark id={p.id} size={30} />
                <span className="pb-tile-n">{p.name}</span>
                <span className="pb-tick">{st === 'done' ? '✓' : st === 'failed' ? '!' : st === 'publishing' ? <span className="pb-spin" /> : sel ? '✓' : ''}</span>
              </button>
            );
          })}
        </div>

        {/* the few options, only for what's picked */}
        {!run && (on.instagram || on.youtube || on.x) && (
          <div className="pb-opts">
            {on.instagram && <div className="pb-o"><span>Instagram</span>
              <select value={opt.instagram?.reelsOnly ? 'reels' : 'grid'} onChange={(e) => setOpt({ ...opt, instagram: { reelsOnly: e.target.value === 'reels' } })}>
                <option value="grid">Grid + Reels</option><option value="reels">Reels tab only</option></select></div>}
            {on.youtube && <div className="pb-o"><span>YouTube</span>
              <input className="he" dir="auto" value={yTitle} maxLength={100} placeholder="Title" onChange={(e) => setYTitle(e.target.value)} />
              <select value={opt.youtube?.privacy || 'public'} onChange={(e) => setOpt({ ...opt, youtube: { privacy: e.target.value } })}>
                <option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option></select></div>}
            {on.x && <div className="pb-o"><span>X</span>
              <input className="he" dir="auto" value={opt.x?.text ?? ''} placeholder="Shorter text for X (optional)" onChange={(e) => setOpt({ ...opt, x: { text: e.target.value } })} /></div>}
          </div>)}

        {/* the results, with links */}
        {run && <div className="pb-results">
          {Object.entries(run.items).map(([id, it]) => {
            const p = (platforms || []).find((x) => x.id === id);
            return <div key={id} className={`pb-res ${it.state}`}><Mark id={id} size={20} /><span className="pb-res-n">{p?.name}</span>
              <span className="pb-res-t">{it.state === 'done' ? (it.url ? <a href={it.url} target="_blank" rel="noreferrer">open ↗</a> : it.note) : it.state === 'failed' || it.state === 'skipped' ? it.error : it.log.at(-1) || 'waiting'}</span></div>;
          })}
        </div>}

        {err && <div className="pb-err">{err}</div>}
        <div className="pb-foot">
          <div className="pb-sum">{finished ? (doneCount ? `Out in ${doneCount} place${doneCount === 1 ? '' : 's'} ✓` : 'Nothing went out') : running ? 'Publishing - you can close this' : picked.length ? `→ ${where.join(' · ')}` : 'Pick where it goes'}</div>
          {finished ? <><button className="btn" onClick={() => setRun(null)}>Again</button><button className="btn primary" onClick={onClose}>Done</button></>
            : running ? <button className="btn" onClick={onClose}>Close</button>
            : mode === 'export' || !output || isStale ? <button className="btn primary" disabled={!picked.length} onClick={() => go(true)}>{mode === 'export' || !output ? 'Export & publish' : 'Export again & publish'}</button>
            : <button className="btn primary" disabled={!picked.length} onClick={() => go(false)}>Publish</button>}
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
