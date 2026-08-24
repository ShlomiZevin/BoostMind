import { useEffect, useRef, useState } from 'react';
import { CHAT_API_URL } from '../config/api';

// מאיה — the marketing assistant, admin-only, inside the app rather than as a
// separate tool. Claude runs the conversation with the full brand brief; when
// phrasing or an image is wanted it emits an ```action``` block, which renders
// as a card you run explicitly. Same pattern as the food coach's meal cards:
// nothing is generated behind your back, and a 40s Leonardo call never blocks
// the thread.

const API = CHAT_API_URL.replace(/\/$/, '');

type Msg = { role: 'user' | 'assistant'; content: string; ts: number };
type PhraseOpt = { h1?: string; sub?: string; cta?: string; why?: string };
type Action =
  | { type: 'phrase'; brief: string; constraints?: string }
  | { type: 'image'; prompt: string; ratio?: string };

const KEY = 'maya-thread-v1';

/** Split a reply into prose and action blocks so cards render where Claude put them. */
function parse(text: string): Array<{ t: 'text'; v: string } | { t: 'act'; v: Action }> {
  const out: Array<{ t: 'text'; v: string } | { t: 'act'; v: Action }> = [];
  const re = /```action\s*\n?([\s\S]*?)\n?```/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const before = text.slice(last, m.index).trim();
    if (before) out.push({ t: 'text', v: before });
    try { out.push({ t: 'act', v: JSON.parse(m[1]) }); } catch { /* ignore malformed */ }
    last = m.index + m[0].length;
  }
  const tail = text.slice(last).trim();
  if (tail) out.push({ t: 'text', v: tail });
  return out;
}

export function MarketingChat({ uid }: { uid: string }) {
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(msgs.slice(-40))); } catch { /* quota */ }
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, busy]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content: t, ts: Date.now() }];
    setMsgs(next);
    setInput('');
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`${API}/api/marketing/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, messages: next.map(m => ({ role: m.role, content: m.content })) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.detail || j?.error || `שגיאה ${r.status}`);
      setMsgs(m => [...m, { role: 'assistant', content: j.text || '', ts: Date.now() }]);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const STARTERS = [
    'מה חסר לנו בסט הקריאייטיבים?',
    'תני לי שלוש פתיחות לסטורי על החיבור בין אימון לתזונה',
    'איזה קריאייטיב הכי חלש ולמה',
  ];

  return (
    <div className="flex flex-col" dir="rtl">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-xl grid place-items-center text-white text-sm font-black shrink-0"
             style={{ background: '#5b4bc4' }}>מ</div>
        <div className="flex-1">
          <div className="font-bold text-main leading-tight">מאיה</div>
          <div className="text-[11px] text-muted">מכירה את המותג, המוצר והבריף</div>
        </div>
        {msgs.length > 0 && (
          <button
            onClick={() => { if (confirm('לנקות את השיחה?')) { setMsgs([]); localStorage.removeItem(KEY); } }}
            className="text-[11px] text-muted hover:text-main px-2 py-1 rounded-lg border border-subtle"
          >נקה</button>
        )}
      </div>

      <div className="space-y-3 min-h-[240px]">
        {msgs.length === 0 && (
          <div className="space-y-2">
            <div className="text-sm text-muted">
              שאלי אותה על קריאייטיבים, ניסוח או כיוון. היא תיעזר ב-GPT לניסוח וב-Leonardo לתמונות.
            </div>
            {STARTERS.map(s => (
              <button key={s} onClick={() => send(s)}
                className="block w-full text-right text-[13px] px-3 py-2 rounded-xl border border-subtle
                           dark:bg-slate-900/60 bg-white text-muted hover:text-main transition-colors">
                {s}
              </button>
            ))}
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            {m.role === 'user' ? (
              <div className="max-w-[88%] rounded-2xl rounded-tl-sm px-3 py-2 text-sm
                              dark:bg-blue-900/50 bg-blue-100 dark:text-blue-100 text-blue-800 font-medium">
                {m.content}
              </div>
            ) : (
              <div className="max-w-[92%] w-full space-y-2">
                {parse(m.content).map((chunk, k) =>
                  chunk.t === 'text' ? (
                    <div key={k} className="rounded-2xl rounded-tr-sm px-3 py-2 text-sm whitespace-pre-wrap
                                            dark:bg-slate-800 bg-slate-100 text-main">
                      {chunk.v}
                    </div>
                  ) : (
                    <ActionCard key={k} uid={uid} action={chunk.v} />
                  ),
                )}
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div className="flex justify-end">
            <div className="rounded-2xl rounded-tr-sm px-4 py-3 dark:bg-slate-800 bg-slate-100 flex gap-1.5">
              {[0, 150, 300].map(d => (
                <span key={d} className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce"
                      style={{ animationDelay: `${d}ms`, animationDuration: '900ms' }} />
              ))}
            </div>
          </div>
        )}
        {err && <div className="text-xs text-red-500">{err}</div>}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={e => { e.preventDefault(); send(input); }}
        className="sticky bottom-0 pt-3 mt-3 border-t border-subtle dark:bg-slate-950 bg-slate-50"
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="מה צריך?"
            className="flex-1 input-field !text-right !text-base !font-sans"
            dir="rtl"
          />
          <button type="submit" disabled={busy || !input.trim()}
            className="btn-primary !px-5 !py-3 !text-base disabled:opacity-40">שלח</button>
        </div>
      </form>
    </div>
  );
}

/** A card Claude proposed. Nothing runs until you press the button. */
function ActionCard({ uid, action }: { uid: string; action: Action }) {
  const [state, setState] = useState<'idle' | 'run' | 'done' | 'err'>('idle');
  const [opts, setOpts] = useState<PhraseOpt[]>([]);
  const [img, setImg] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  async function run() {
    setState('run'); setMsg('');
    try {
      if (action.type === 'phrase') {
        const r = await fetch(`${API}/api/marketing/phrase`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid, brief: action.brief, constraints: action.constraints || '' }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.detail || j?.error);
        setOpts(j.options || []); setState('done');
      } else {
        const r = await fetch(`${API}/api/marketing/image`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid, prompt: action.prompt, ratio: action.ratio || '9:16' }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.note || j?.detail || j?.error);
        setImg(j.url); setState('done');
      }
    } catch (e: any) {
      setMsg(e?.message || String(e)); setState('err');
    }
  }

  const isPhrase = action.type === 'phrase';
  const tint = isPhrase ? '#34d399' : '#fbbf24';

  return (
    <div className="rounded-2xl border overflow-hidden"
         style={{ borderColor: `${tint}66`, background: `${tint}0f` }}>
      <div className="px-3 pt-2.5 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ background: `${tint}22`, color: tint }}>
            {isPhrase ? 'ניסוח · GPT' : 'תמונה · Leonardo'}
          </span>
        </div>
        <div className="text-[13px] text-main leading-relaxed">
          {isPhrase ? action.brief : action.prompt}
        </div>
        {isPhrase && action.constraints && (
          <div className="text-[11px] text-muted mt-1">{action.constraints}</div>
        )}
      </div>

      {state === 'done' && isPhrase && (
        <div className="px-3 pb-3 space-y-2">
          {opts.map((o, i) => (
            <div key={i} className="rounded-xl p-2.5 dark:bg-slate-900/70 bg-white border border-subtle">
              {o.h1 && <div className="font-bold text-main text-[15px]">{o.h1.replace(/<br>/g, ' ')}</div>}
              {o.sub && <div className="text-[13px] text-muted mt-0.5">{o.sub}</div>}
              {o.cta && <div className="text-[12px] font-bold mt-1" style={{ color: tint }}>{o.cta} ←</div>}
              {o.why && <div className="text-[11px] text-muted-more mt-1.5 pt-1.5 border-t border-subtle">{o.why}</div>}
            </div>
          ))}
          {opts.length === 0 && <div className="text-[12px] text-muted">לא חזרו אפשרויות.</div>}
        </div>
      )}

      {state === 'done' && !isPhrase && img && (
        <a href={img} target="_blank" rel="noopener" className="block px-3 pb-3">
          <img src={img} alt="" className="w-full rounded-xl border border-subtle" />
        </a>
      )}

      {state === 'err' && <div className="px-3 pb-2 text-[12px] text-red-500">{msg}</div>}

      {state !== 'done' && (
        <button onClick={run} disabled={state === 'run'}
          className="w-full py-2.5 text-[12px] font-bold border-t disabled:opacity-60"
          style={{ borderColor: `${tint}44`, color: tint }}>
          {state === 'run'
            ? (isPhrase ? 'מנסח…' : 'מייצר תמונה… עד דקה')
            : (isPhrase ? 'בקש ניסוח מ-GPT' : 'ייצר תמונה')}
        </button>
      )}
    </div>
  );
}
