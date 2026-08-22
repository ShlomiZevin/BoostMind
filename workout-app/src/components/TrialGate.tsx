import { CONTACT, daysLeftLabel, mailLink, waLink, type TrialState } from '../config/access';

// The trial surface, in three pieces:
//   ContactActions — WhatsApp + mail, used by everything below and by Settings.
//   TrialBanner    — a quiet strip while the week is running.
//   TrialExpired   — the stop, once it is up.
//
// Contact is its own export on purpose: Settings shows it to everyone, always,
// so reaching a human is never something you have to be blocked to find.

const WA_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-[18px] h-[18px]">
    <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.08-.3-.15-1.26-.47-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z"/>
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm0 18.02h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.23 8.23 0 0 1 8.24 8.24c0 4.54-3.7 8.23-8.24 8.23z"/>
  </svg>
);

const MAIL_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-[18px] h-[18px]">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </svg>
);

/** The two ways to reach Shlomi. `message` seeds the WhatsApp text so he knows
 *  what the person is writing about before he opens it. */
export function ContactActions({ message, compact }: { message: string; compact?: boolean }) {
  const size = compact ? 'px-3 py-2 text-[12px]' : 'px-4 py-3 text-[13.5px]';
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={waLink(message)}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 rounded-xl font-bold bg-emerald-600 text-white active:scale-[.99] transition ${size}`}
      >
        {WA_ICON}
        <span>וואטסאפ {CONTACT.phone}</span>
      </a>
      <a
        href={mailLink('מצב — בקשת המשך ליווי')}
        className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 rounded-xl font-bold border border-subtle bg-subtle text-muted active:scale-[.99] transition ${size}`}
      >
        {MAIL_ICON}
        <span dir="ltr">{CONTACT.email}</span>
      </a>
    </div>
  );
}

/** Always-present contact block for Settings — pure "reach a human" surface.
 *  Trial status used to live inside this card; that mixed billing with support
 *  and made the trial hard to find. It moved to `TrialCard`, which now lives
 *  under חשבון where it belongs. Prop signature kept for compatibility. */
export function ContactCard(_props?: { trial?: TrialState | null }) {
  return (
    <div className="card mb-4" dir="rtl">
      <div className="font-medium mb-1">צור קשר</div>
      <div className="text-xs text-muted mb-3">
        שאלה, בקשה או משהו שנשבר — אפשר לכתוב ישירות.
      </div>
      <ContactActions message="היי שלומי, זה לגבי מצב — " />
    </div>
  );
}

/** Trial status card for the חשבון section of Settings. Renders nothing when
 *  the account is not on a trial (owner and paid accounts), so both settings
 *  pages can render it unconditionally without an empty slot. */
export function TrialCard({ trial }: { trial?: TrialState | null }) {
  if (!trial || trial.status !== 'active') return null;
  const urgent = trial.daysLeft <= 2;
  return (
    <div
      className={`card mb-4 ${urgent ? 'border border-amber-500/40' : ''}`}
      dir="rtl"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-right">
          <div className="font-medium flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${urgent ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <span>תקופת ניסיון</span>
          </div>
          <div className={`text-xs ${urgent ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-muted'}`}>
            {daysLeftLabel(trial.daysLeft)}
          </div>
        </div>
        <a
          href={waLink(`היי שלומי, רוצה להמשיך אחרי הניסיון.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary px-4 py-2 text-sm shrink-0"
        >המשך ליווי</a>
      </div>
    </div>
  );
}

/** Below this, the banner appears. Above it, the trial is visible only in
 *  Settings — a countdown you can do nothing useful about is just nagging. */
const NOTICE_FROM_DAYS_LEFT = 3;

/**
 * Shown at the top of the app only near the end of the free week.
 *
 * It used to appear on every tab page for all seven days, which read as a
 * permanent billing strip over a product you had only just started using. It
 * now stays quiet until the last three days, when the information is actually
 * actionable; before that the state lives in Settings, where you go to look for
 * it. It also scrolls away with the content rather than pinning.
 */
export function TrialBanner({ state, onContact }: { state: TrialState; onContact: () => void }) {
  if (state.status !== 'active') return null;
  if (state.daysLeft > NOTICE_FROM_DAYS_LEFT) return null;
  const urgent = state.daysLeft <= 2;

  return (
    <div dir="rtl" className="px-4 pt-3">
      <div
        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${
          urgent
            ? 'border-amber-500/40 bg-amber-500/10'
            : 'border-subtle bg-subtle'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${urgent ? 'bg-amber-500' : 'bg-emerald-500'}`} />
        <span className="text-[12px] font-bold">תקופת ניסיון</span>
        <span className={`text-[12px] font-semibold ${urgent ? 'text-amber-600 dark:text-amber-400' : 'text-muted'}`}>
          {daysLeftLabel(state.daysLeft)}
        </span>
        <span className="flex-1" />
        <button
          onClick={onContact}
          className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400 px-1"
        >
          המשך ליווי
        </button>
      </div>
    </div>
  );
}

/**
 * The stop. Deliberately not a paywall with a price — the ask is a conversation,
 * so the whole screen is the two contact buttons.
 *
 * `email` is echoed back because the first thing Shlomi needs when someone
 * writes is to know which account they are.
 */
export function TrialExpired({ email, onLogout }: { email: string | null; onLogout: () => void }) {
  const message = `היי שלומי, סיימתי את שבוע הניסיון במצב${email ? ` (${email})` : ''} ואשמח להמשיך.`;

  return (
    <div className="login-page" dir="rtl">
      <div className="login-amb" aria-hidden="true" />
      <div className="login-grain" aria-hidden="true" />

      <div className="login-inner">
        <div className="login-card">
          <div className="login-lockup" style={{ animationDelay: '40ms' }}>
            <div className="login-mark">
              <svg viewBox="0 0 64 64" width="50" height="50" fill="currentColor" stroke="currentColor" aria-hidden="true">
                <circle cx="32" cy="32" r="27" fill="none" strokeWidth="4.5" />
                <path d="M5 32 C14 23 23 23 32 32 C41 41 50 41 59 32 A27 27 0 0 1 5 32 Z" />
              </svg>
            </div>
            <h1 className="login-title">מצב</h1>
          </div>

          <p className="login-sub" style={{ animationDelay: '180ms' }}>
            שבוע הניסיון הסתיים.
          </p>
          <p className="login-sub2" style={{ animationDelay: '220ms' }}>
            הנתונים שלך שמורים. כדי להמשיך — נדבר.
          </p>

          <div className="mt-6" style={{ animationDelay: '300ms' }}>
            <ContactActions message={message} />
          </div>

          {email && (
            <div className="mt-5 text-[11px] text-muted" dir="ltr">{email}</div>
          )}

          <button
            onClick={onLogout}
            className="mt-3 text-[12px] text-muted underline underline-offset-2"
          >
            התנתק
          </button>
        </div>
      </div>
    </div>
  );
}
