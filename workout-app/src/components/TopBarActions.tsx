import type { Route } from '../types';
import { useStandaloneStopwatch } from '../hooks/useStandaloneStopwatch';

/** Reusable gear icon that navigates to settings — used in every tab page's TopBar. */
export function SettingsGearAction({ navigate }: { navigate: (r: Route) => void }) {
  return (
    <button
      onClick={() => navigate({ page: 'settings' })}
      aria-label="הגדרות"
      className="w-10 h-10 rounded-full flex items-center justify-center text-muted dark:hover:bg-slate-800 hover:bg-slate-100 transition-colors"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  );
}

/** Stopwatch toggle — sits next to the settings gear on every tab page.
 *  Reads/writes the shared standalone-stopwatch state directly. */
export function StopwatchToggleAction() {
  const { open, toggle } = useStandaloneStopwatch();
  return (
    <button
      // Blur immediately so the button doesn't hang in a "focused" gray state after tapping
      // to close — user should only see two states: none / active.
      onClick={(e) => { toggle(); (e.currentTarget as HTMLButtonElement).blur(); }}
      aria-label={open ? 'הסתר סטופר' : 'הצג סטופר'}
      title={open ? 'הסתר סטופר' : 'הצג סטופר'}
      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors focus:outline-none ${
        open
          ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/15'
          : 'text-muted'
      }`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2 2" />
        <path d="M10 2h4" />
      </svg>
    </button>
  );
}

/** Combined actions for tab pages — stopwatch toggle + settings gear.
 *  Every tab page uses this so both live in one predictable spot. */
export function TabActions({ navigate }: { navigate: (r: Route) => void }) {
  return (
    <>
      <StopwatchToggleAction />
      <SettingsGearAction navigate={navigate} />
    </>
  );
}

/** × close action for the Settings page — pops back to the previous tab, or home. */
export function CloseAction({ navigate }: { navigate: (r: Route) => void }) {
  return (
    <button
      onClick={() => {
        // Prefer real back-navigation so we return to whichever tab you came from.
        if (window.history.length > 1) {
          window.history.back();
        } else {
          navigate({ page: 'home' });
        }
      }}
      aria-label="סגור"
      className="w-10 h-10 rounded-full flex items-center justify-center text-muted dark:hover:bg-slate-800 hover:bg-slate-100 transition-colors"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M6 6l12 12M6 18L18 6" />
      </svg>
    </button>
  );
}
