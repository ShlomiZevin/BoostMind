// Send for a personal greeting (his ask, 2026-11-19 - render/greeting.mjs): a greeting is not a video of the resident's
// life, so this window has no socials and no Shlomiverse videos - only the greeting's own three steps, each his click:
// 1. make its private page (+ the video to his Telegram, for a story), 2. a test email to himself, 3. send it to the person.
import React, { useEffect, useState } from 'react';
import './publish.css';

const api = async (url: string, body?: any) =>
  (await fetch(url, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined)).json();

type G = { char: string; request?: string; for?: string; event?: string; date?: string };
type St = { gid?: string; url?: string; made?: number; tested?: number; sent?: number; pending?: boolean };
type Run = { step: string; running: boolean; ok?: boolean; error?: string; log: string[] } | null;

export function GreetingWindow({ ep, greeting, onExport, onClose }: { ep: string; greeting: G; onExport: (send: string[]) => void; onClose: () => void }) {
  const [st, setSt] = useState<St>({});
  const [run, setRun] = useState<Run>(null);
  const [file, setFile] = useState<{ exported: number; stale: boolean } | null>(null);
  const [err, setErr] = useState('');
  const load = async () => { const j = await api(`/api/ep/${ep}/greeting`); setSt(j.state || {}); setRun(j.run || null); setFile(j.file || null); return j; };
  useEffect(() => { load(); }, [ep]);
  useEffect(() => { if (!run?.running) return; const t = setTimeout(load, 1200); return () => clearTimeout(t); }, [run]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);

  const who = greeting.for || 'them';
  const busy = !!run?.running;
  const exportFirst = !file || file.stale;
  const newer = !!(file && st.made && file.exported > st.made + 2000);  // exported again since the page was made
  const when = (t?: number) => { if (!t) return ''; const d = new Date(t); return (new Date().toDateString() === d.toDateString() ? 'today ' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ') + d.toTimeString().slice(0, 5); };
  const go = async (step: string) => {
    setErr('');
    if (step === 'make' && exportFirst) { await api(`/api/ep/${ep}/greeting`, { step: 'make', afterExport: true }); onExport([]); onClose(); return; }
    const j = await api(`/api/ep/${ep}/greeting`, { step, ...(step === 'send' && st.sent ? { again: true } : {}) });
    if (j.error) setErr(j.error); else setRun(j.run);
  };
  const line = (n: number, title: string, sub: React.ReactNode, done: boolean, button: React.ReactNode) => (
    <div className={`gr-step ${done ? 'done' : ''}`}>
      <span className="gr-n">{done ? '✓' : n}</span>
      <div className="gr-t"><b>{title}</b><small>{sub}</small></div>
      {button}
    </div>
  );

  return (
    <div className="pb" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="pb-box">
        <div className="pb-h">
          <div className="pb-title">Send · personal greeting</div>
          <button className="pb-x" onClick={onClose} title="Close (Esc)">✕</button>
        </div>
        <div className="gr-what">
          <div className="pb-thumb">{file ? <video src={`/api/ep/${ep}/publish/video?v=${file.exported}`} muted autoPlay loop playsInline /> : <span className="pb-thumb-t">no export yet</span>}</div>
          <div>
            <div className="gr-for he" dir="rtl">{[`ל${who}`, greeting.event, greeting.date].filter(Boolean).join(' · ')}</div>
            <div className="gr-rule">A greeting goes to {who} only - its own private page on the Shlomiverse and an email. Never the socials, never the resident's videos or the chat.</div>
          </div>
        </div>

        <div className="gr-steps">
          {line(1, 'Make the greeting page + send it to my Telegram',
            st.url ? <>made {when(st.made)} · <a href={st.url} target="_blank" rel="noreferrer">open the page ↗</a>{newer ? ' · exported again since - make it again' : ''}</>
              : exportFirst ? (file ? 'You changed it since the export - it exports again first' : 'It exports the greeting first') : 'The page, and the video in your Telegram for a story',
            !!st.url && !newer,
            <button className="pb-go sm" disabled={busy} onClick={() => go('make')}>{exportFirst ? 'Export & make' : st.url ? 'Make again' : 'Make'}</button>)}
          {line(2, 'Test email to me', st.tested ? `sent to you ${when(st.tested)}` : 'See the email the way they will', !!st.tested,
            <button className="pb-go sm ghost" disabled={busy || !st.url} onClick={() => go('test')}>Test email</button>)}
          {line(3, `Send to ${who}`, st.sent ? `sent ${when(st.sent)}` : 'Only when you watched it and it is good - this sends the email to the person who asked', !!st.sent,
            <button className="pb-go sm" disabled={busy || !st.url || newer} onClick={() => go('send')}>{st.sent ? 'Send again' : `Send to ${who}`}</button>)}
        </div>

        {run && <div className="pb-results"><div className={`pb-res ${run.running ? 'publishing' : run.ok ? 'done' : 'failed'}`}>
          <span className="pb-res-n">{run.step === 'make' ? 'Page' : run.step === 'test' ? 'Test email' : `To ${who}`}</span>
          <span className="pb-res-t">{run.running ? run.log.at(-1) || 'working…' : run.ok ? run.log.at(-1) || 'done' : run.error}</span></div></div>}
        {err && <div className="pb-err">{err}</div>}
        <div className="pb-foot"><button className="pb-go ghost" onClick={onClose}>{busy ? 'Working… you can close this' : 'Close'}</button></div>
      </div>
    </div>
  );
}
