// Send - ONE window for everything that leaves the studio (his ask, 2026-10-25: "everything in one export window").
// Designed from a Leonardo mockup (his pick): the video + its caption, "Test on my phone" (a fast low-quality export
// straight to his Telegram), SEND THE FILE (Telegram, Email), PUBLISH (Instagram, TikTok, YouTube, X, Facebook -
// render/publish.mjs), the few options only for what's picked, one big button. An up-to-date export goes out AS IS;
// otherwise the button exports first and everything goes out when the export ends. The project remembers its post
// (publish.json); a new project starts from his last picks.
import React, { useEffect, useMemo, useState } from 'react';
import './publish.css';

type Platform = { id: string; name: string; what: string; manual?: boolean; ok: boolean; handle?: string; note?: string; until?: string; limits: any };
type Item = { state: string; log: string[]; url?: string | null; note?: string; error?: string };
type Run = { running: boolean; items: Record<string, Item> } | null;

const api = async (url: string, body?: any) =>
  (await fetch(url, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined)).json();
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} } };

// each destination's colour and mark (plain shapes in one solid colour - no logos copied)
const BRAND: Record<string, { bg: string; fg: string; mark: React.ReactNode }> = {
  telegram: { bg: '#229ed9', fg: '#fff', mark: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 4.2 3.6 10.8c-1 .4-1 1.1-.2 1.4l4.3 1.3 1.7 5.2c.2.6.4.8.8.8.4 0 .6-.2.9-.5l2.1-2 4.4 3.2c.8.5 1.4.2 1.6-.8l2.9-13.6c.3-1.2-.4-1.8-1.6-1.6zM9.2 13.2l8.6-5.4c.4-.3.8-.1.5.2l-7 6.4-.3 3-1.8-4.2z" /></svg> },
  email: { bg: '#6e56cf', fg: '#fff', mark: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="M4 7l8 6 8-6" /></svg> },
  instagram: { bg: '#d6336c', fg: '#fff', mark: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" /></svg> },
  tiktok: { bg: '#111', fg: '#fff', mark: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 3h3c.3 2.2 1.6 3.6 4 3.9v3.1c-1.5 0-2.9-.4-4-1.2V15a6 6 0 1 1-6-6v3.2a2.8 2.8 0 1 0 3 2.8V3z" /></svg> },
  youtube: { bg: '#e62117', fg: '#fff', mark: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 8.5v7l6-3.5-6-3.5z" /></svg> },
  x: { bg: '#e8e6e3', fg: '#111', mark: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg> },
  facebook: { bg: '#1877f2', fg: '#fff', mark: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.5V21h3z" /></svg> },
};
export const Mark = ({ id, size = 34 }: { id: string; size?: number }) => {
  const b = BRAND[id] || { bg: 'var(--panel-3)', fg: 'var(--text)', mark: null };
  return <span className="pb-mark" style={{ width: size, height: size, background: b.bg, color: b.fg }}>{b.mark}</span>;
};
const CHANNELS = [{ id: 'telegram', name: 'Telegram' }, { id: 'email', name: 'Email' }];

export function PublishWindow({ ep, canTest, onExport, onTest, onClose }: {
  ep: string;
  canTest: boolean;                        // (the old lesson engine has no quick export)
  onExport: (send: string[]) => void;      // export, then the server sends to these channels (the socials: publish.json afterExport)
  onTest: () => void;                      // the fast low-quality export, straight to his Telegram
  onClose: () => void;
}) {
  const [platforms, setPlatforms] = useState<Platform[] | null>(null);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [yTitle, setYTitle] = useState('');
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [ch, setCh] = useState<Record<string, boolean>>(() => { try { return JSON.parse(store.get('zc-send-ch') || '{}'); } catch { return {}; } });
  const [opt, setOpt] = useState<any>({ instagram: { reelsOnly: false }, youtube: { privacy: 'public' } });
  const [run, setRun] = useState<Run>(null);
  const [sends, setSends] = useState<Record<string, any>>({});  // Telegram / Email going out now (the share endpoint)
  const [err, setErr] = useState('');
  const [duration, setDuration] = useState(0);
  const [file, setFile] = useState<{ name: string; size: number; exported: number; stale: boolean } | null>(null);
  const [draft, setDraft] = useState<{ exported: number } | null>(null);  // a Quick check - shown, never published

  useEffect(() => {
    (async () => {
      const [pl, cur] = await Promise.all([api('/api/publish/platforms'), api(`/api/ep/${ep}/publish`)]);
      setPlatforms(pl);
      // (a project's title can carry a working tag - "(spiritual-4)", "(3)": not for the public)
      const clean = String(cur.title || ep).replace(/\s*\([ -~]*\)\s*$/, '').trim();
      setTitle(clean);
      setFile(cur.file || null);
      setDraft(cur.draft || null);
      const post = cur.post, last = JSON.parse(store.get('zc-publish') || '{}');
      setCaption(post?.caption ?? '');
      setYTitle(post?.title || clean);
      const picks: string[] = post?.platforms || last.platforms || [];
      setOn(Object.fromEntries(pl.map((p: Platform) => [p.id, p.ok && picks.includes(p.id)])));
      if (post?.options || last.options) setOpt((o: any) => ({ ...o, ...(last.options || {}), ...(post?.options || {}) }));
      if (cur.run) setRun(cur.run);
    })();
  }, [ep]);
  // a publish going on: follow it
  useEffect(() => {
    if (!run?.running) return;
    const t = setTimeout(async () => { const cur = await api(`/api/ep/${ep}/publish`); setRun(cur.run); }, 1200);
    return () => clearTimeout(t);
  }, [run]);
  // Telegram / Email going out: follow them
  useEffect(() => {
    const live = Object.keys(sends).filter((c) => sends[c]?.running);
    if (!live.length) return;
    const t = setTimeout(async () => {
      const next = { ...sends };
      for (const c of live) next[c] = await api(`/api/ep/${ep}/share/${c}`);
      setSends(next);
    }, 1200);
    return () => clearTimeout(t);
  }, [sends]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose]);

  const picked = useMemo(() => (platforms || []).filter((p) => on[p.id]), [platforms, on]);
  const chans = CHANNELS.filter((c) => ch[c.id]).map((c) => c.id);
  // one caption for every platform (X takes its first 280, without links - the server does it)
  const post = () => ({ platforms: picked.map((p) => p.id), caption, title: yTitle, options: { instagram: opt.instagram, youtube: opt.youtube } });
  const isStale = !!file?.stale;
  // an up-to-date full export goes out as is; otherwise the button exports first
  const exportFirst = !file || isStale || !!(draft && draft.exported > file.exported);
  const n = picked.length + chans.length;
  const go = async () => {
    setErr('');
    store.set('zc-publish', JSON.stringify({ platforms: post().platforms, options: opt }));
    store.set('zc-send-ch', JSON.stringify(ch));
    if (exportFirst) {
      if (picked.length) await api(`/api/ep/${ep}/publish`, { ...post(), afterExport: true });
      onExport(chans); onClose(); return;
    }
    for (const c of chans) {  // the file as is
      const j = await api(`/api/ep/${ep}/share`, { channel: c });
      setSends((s) => ({ ...s, [c]: j.error && !j.channel ? { running: false, ok: false, error: j.error, log: [] } : j }));
    }
    if (picked.length) {
      const r = await api(`/api/ep/${ep}/publish`, post());
      if (r.error) setErr(r.error); else setRun(r.run);
    }
  };
  const running = !!run?.running || Object.values(sends).some((s: any) => s?.running);
  const started = !!run || Object.keys(sends).length > 0;
  const when = (t: number) => { const d = new Date(t), today = new Date().toDateString() === d.toDateString(); return (today ? 'today ' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ') + d.toTimeString().slice(0, 5); };
  const len = duration ? `${Math.floor(duration / 60)}:${String(Math.round(duration % 60)).padStart(2, '0')}` : '';
  const xNote = on.x && (caption.length > 280 || /https?:\/\//.test(caption));

  const tile = (id: string, name: string, sel: boolean, toggle: () => void, disabled = false, st?: string) => (
    <button key={id} className={`pb-tile ${sel ? 'on' : ''} ${disabled ? 'off' : ''} ${st ? 'st-' + st : ''}`} disabled={disabled || started} onClick={toggle}
      title={disabled ? 'Not connected yet' : id === 'facebook' ? 'A Telegram reminder to share the Instagram Reel' : id === 'tiktok' ? 'To your TikTok drafts' : ''}>
      <Mark id={id} size={34} />
      <span className="pb-tile-n">{name}</span>
      {(sel || st) && <span className="pb-tick">{st === 'done' ? '✓' : st === 'failed' ? '!' : st === 'publishing' || st === 'running' ? <span className="pb-spin" /> : '✓'}</span>}
    </button>
  );
  const results: { id: string; name: string; state: string; text: any; url?: string | null }[] = [
    ...Object.entries(sends).map(([c, s]: any) => ({ id: c, name: c === 'email' ? 'Email' : 'Telegram', state: s.running ? 'publishing' : s.ok ? 'done' : 'failed',
      text: s.running ? (s.log?.at(-1) || 'sending…') : s.ok ? (s.log?.at(-1) || 'sent') : s.error })),
    ...Object.entries(run?.items || {}).map(([id, it]) => ({ id, name: (platforms || []).find((x) => x.id === id)?.name || id, state: it.state,
      url: it.state === 'done' ? it.url : null, text: it.state === 'done' ? it.note : it.state === 'failed' || it.state === 'skipped' ? it.error : it.log.at(-1) || 'waiting' })),
  ];

  return (
    <div className="pb" onMouseDown={(e) => { if (e.target === e.currentTarget && !running) onClose(); }}>
      <div className="pb-box">
        <div className="pb-h">
          <div className="pb-title">Send</div>
          <button className="pb-x" onClick={onClose} title="Close (Esc)">✕</button>
        </div>

        {/* the video, its caption, the phone test */}
        <div className="pb-row1">
          <div className="pb-thumb">
            {file || draft ? <video src={`/api/ep/${ep}/publish/video?v=${file?.exported || draft?.exported}`} muted autoPlay loop playsInline onLoadedMetadata={(e) => setDuration((e.target as HTMLVideoElement).duration || 0)} />
              : <span className="pb-thumb-t">no export yet</span>}
            {len && <span className="pb-len">{len}</span>}
          </div>
          <div className="pb-capbox">
            <div className="pb-l">Caption <span>{caption.length ? caption.length : ''}</span></div>
            <textarea className="pb-cap he" dir="auto" value={caption} disabled={started} placeholder="What goes under the video - text, #hashtags"
              onChange={(e) => setCaption(e.target.value)} />
            {canTest && <button className="pb-test" disabled={started} onClick={() => { onTest(); onClose(); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></svg>
              <span><b>Test on my phone</b><small>fast, low quality - to your Telegram</small></span></button>}
          </div>
        </div>

        <div className="pb-sec">Send the file</div>
        <div className="pb-tiles two">
          {CHANNELS.map((c) => tile(c.id, c.name, !!ch[c.id], () => setCh({ ...ch, [c.id]: !ch[c.id] }), false, sends[c.id] ? (sends[c.id].running ? 'running' : sends[c.id].ok ? 'done' : 'failed') : undefined))}
        </div>

        <div className="pb-sec">Publish</div>
        <div className="pb-tiles">
          {(platforms || []).map((p) => tile(p.id, p.name, !!on[p.id], () => setOn({ ...on, [p.id]: !on[p.id] }), !p.ok, run?.items[p.id]?.state))}
        </div>

        {/* the few options, only for what's picked */}
        {!started && (on.instagram || on.youtube || xNote) && (
          <div className="pb-opts">
            {on.instagram && <div className="pb-o"><span>Instagram</span>
              <select value={opt.instagram?.reelsOnly ? 'reels' : 'grid'} onChange={(e) => setOpt({ ...opt, instagram: { reelsOnly: e.target.value === 'reels' } })}>
                <option value="grid">Grid + Reels</option><option value="reels">Reels tab only</option></select></div>}
            {on.youtube && <div className="pb-o"><span>YouTube</span>
              <input className="he" dir="auto" value={yTitle} maxLength={100} placeholder="Title" onChange={(e) => setYTitle(e.target.value)} />
              <select value={opt.youtube?.privacy || 'public'} onChange={(e) => setOpt({ ...opt, youtube: { privacy: e.target.value } })}>
                <option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option></select></div>}
            {xNote && <div className="pb-o"><span>X</span><em className="pb-note">gets the caption {caption.length > 280 ? 'cut at 280 characters' : ''}{caption.length > 280 && /https?:\/\//.test(caption) ? ', ' : ''}{/https?:\/\//.test(caption) ? 'without its links' : ''}</em></div>}
          </div>)}

        {/* what's going on, with links */}
        {results.length > 0 && <div className="pb-results">
          {results.map((r) => <div key={r.id} className={`pb-res ${r.state}`}><Mark id={r.id} size={20} /><span className="pb-res-n">{r.name}</span>
            <span className="pb-res-t">{r.url ? <a href={r.url} target="_blank" rel="noreferrer">open ↗</a> : r.text}</span></div>)}
        </div>}

        {err && <div className="pb-err">{err}</div>}
        <div className="pb-foot">
          <div className="pb-file">{file && !exportFirst ? `Sends the export from ${when(file.exported)} as is` : file && isStale ? 'You changed the video since the last export - it exports again first'
            : draft && !file ? 'This is a quick test - the button makes the full-quality export first' : 'It exports the video first, then sends'}</div>
          {started && !running ? <button className="pb-go" onClick={onClose}>Done</button>
            : running ? <button className="pb-go ghost" onClick={onClose}>Sending… you can close this</button>
            : <button className="pb-go" onClick={go}>{n ? `${exportFirst ? 'Export & send' : 'Send'} to ${n}` : exportFirst ? 'Just export' : 'Pick where it goes'}</button>}
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
