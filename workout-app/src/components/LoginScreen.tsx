import { useState } from 'react';

type Props = {
  onLogin: () => Promise<void>;
};

export function LoginScreen({ onLogin }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await onLogin();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-bg flex flex-col items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-sm text-center space-y-6">
        <div>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 mb-4">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" className="text-emerald-500" aria-hidden="true">
              <path d="M6.5 6.5h3v11h-3zM14.5 6.5h3v11h-3zM10 10h4v4h-4z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-1">מאמן אישי</h1>
          <p className="text-muted text-sm">התחבר כדי להתחיל</p>
        </div>

        <button
          onClick={handleClick}
          disabled={busy}
          className="w-full py-3.5 rounded-2xl font-semibold text-sm inline-flex items-center justify-center gap-3 bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 disabled:opacity-60 transition-colors shadow-sm"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path fill="#4285F4" d="M19.6 10.23c0-.68-.06-1.36-.18-2.02H10v3.83h5.4a4.6 4.6 0 0 1-2 3.03v2.5h3.24c1.9-1.75 3-4.33 3-7.34z"/>
            <path fill="#34A853" d="M10 20c2.7 0 4.98-.9 6.64-2.43l-3.24-2.5c-.9.6-2.05.96-3.4.96-2.6 0-4.82-1.76-5.6-4.13H1.05v2.6A10 10 0 0 0 10 20z"/>
            <path fill="#FBBC05" d="M4.4 11.9a6.02 6.02 0 0 1 0-3.82V5.48H1.05a10.02 10.02 0 0 0 0 9.04L4.4 11.9z"/>
            <path fill="#EA4335" d="M10 3.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87A10 10 0 0 0 1.05 5.48L4.4 8.08C5.18 5.72 7.4 3.96 10 3.96z"/>
          </svg>
          <span>{busy ? '...מתחבר' : 'המשך עם Google'}</span>
        </button>

        {err && (
          <div className="text-xs text-red-500 text-center">{err}</div>
        )}

        <p className="text-[11px] text-muted-most leading-relaxed pt-4">
          המידע שלך נשמר פרטי לחשבון שלך.
          <br />
          שיחות עם ה-AI ומידע אימונים נגישים רק לך.
        </p>
      </div>
    </div>
  );
}
