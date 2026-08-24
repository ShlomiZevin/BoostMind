import { useEffect, useState } from 'react';
import { logEvent } from '../utils/analytics';

type Props = {
  onLogin: () => Promise<void>;
};

/**
 * The way in to Wholos.
 *
 * Visual brief: the same DNA as the home page — deep, quiet surface, ambient
 * light that hints at both modes (green = מצב אימון on one side, amber =
 * מצב תזונה on the other, brand violet between them), and one precise card.
 * Nothing here is decoration for its own sake: the two lights ARE the product's
 * two live modes, and the mark is the app's own.
 *
 * The auth flow itself is untouched — one Google button, one handler.
 */
export function LoginScreen({ onLogin }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Launch analytics — fires once per session on mount. The helper dedups so
  // a re-render from busy/err state doesn't double-count.
  useEffect(() => { void logEvent('login_view'); }, []);

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
    <div className="login-page" dir="rtl">
      {/* Ambient light — מצב אימון, מצב תזונה, and the shell between them.
          Desktop only past a whisper; on mobile it stays almost invisible. */}
      <div className="login-amb" aria-hidden="true" />
      <div className="login-grain" aria-hidden="true" />

      <div className="login-inner">
        <div className="login-card">

          {/* Mark + wordmark read as one lockup, sharing one violet glow. */}
          <div className="login-lockup" style={{ animationDelay: '40ms' }}>
            <div className="login-mark">
              <svg viewBox="0 0 64 64" width="50" height="50" fill="currentColor" stroke="currentColor" aria-hidden="true">
                <circle cx="32" cy="32" r="27" fill="none" strokeWidth="4.5" />
                <path d="M5 32 C14 23 23 23 32 32 C41 41 50 41 59 32 A27 27 0 0 1 5 32 Z" />
              </svg>
            </div>
            <h1 className="login-title">Wholos</h1>
          </div>

          <p className="login-sub" style={{ animationDelay: '180ms' }}>
            אימונים, תזונה ו-AI שמסתכל על היום שלך כתמונה אחת.
          </p>

          <p className="login-sub2" style={{ animationDelay: '220ms' }}>
            מכיר את האימונים, הארוחות והיעדים שלך.
          </p>

          <div className="login-modes" style={{ animationDelay: '270ms' }}>
            <span><i style={{ background: '#10b981' }} />מצב אימון</span>
            <span><i style={{ background: '#f59e0b' }} />מצב תזונה</span>
          </div>

          {/* A glimpse of the product rather than an onboarding panel: the one
              thing the coach actually gets asked. It stands alone on purpose —
              an answer line here only repeated login-sub2 a few millimetres above. */}
          <div className="login-ai" style={{ animationDelay: '330ms' }}>
            <span className="q">״מה כדאי לי לעשות היום?״</span>
          </div>

          <button
            onClick={handleClick}
            disabled={busy}
            className="login-btn"
            style={{ WebkitTapHighlightColor: 'transparent', animationDelay: '390ms' }}
          >
            <svg width="19" height="19" viewBox="0 0 20 20" aria-hidden="true">
              <path fill="#4285F4" d="M19.6 10.23c0-.68-.06-1.36-.18-2.02H10v3.83h5.4a4.6 4.6 0 0 1-2 3.03v2.5h3.24c1.9-1.75 3-4.33 3-7.34z"/>
              <path fill="#34A853" d="M10 20c2.7 0 4.98-.9 6.64-2.43l-3.24-2.5c-.9.6-2.05.96-3.4.96-2.6 0-4.82-1.76-5.6-4.13H1.05v2.6A10 10 0 0 0 10 20z"/>
              <path fill="#FBBC05" d="M4.4 11.9a6.02 6.02 0 0 1 0-3.82V5.48H1.05a10.02 10.02 0 0 0 0 9.04L4.4 11.9z"/>
              <path fill="#EA4335" d="M10 3.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87A10 10 0 0 0 1.05 5.48L4.4 8.08C5.18 5.72 7.4 3.96 10 3.96z"/>
            </svg>
            <span>{busy ? '...מתחבר' : 'המשך עם Google'}</span>
          </button>

          {err && <div className="login-err">{err}</div>}

        </div>
      </div>
    </div>
  );
}
