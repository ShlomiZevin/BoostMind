import type { Route } from '../types';

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
