import type { Route } from '../types';
import { useStandaloneStopwatch } from '../hooks/useStandaloneStopwatch';
import { useAiTrainerPanel } from '../hooks/useAiTrainerPanel';
import { usePlaceContext } from './PlaceSwitcher';
import { PLACES } from '../places/registry';

/** Reusable gear icon that navigates to settings — used in every tab page's TopBar.
 *  Place-aware: the gear opens the settings of the place you are IN, so tapping
 *  it inside תזונה never bounces you back to אימונים. */
export function SettingsGearAction({ navigate }: { navigate: (r: Route) => void }) {
  const placeCtx = usePlaceContext();
  const target = placeCtx ? PLACES[placeCtx.place].settingsPage : 'settings';
  return (
    <button
      onClick={() => navigate({ page: target } as Route)}
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

/** Ask-the-trainer button — opens a general-purpose AI chat overlay.
 *  Emerald pill with sparkle + "AI" label so it clearly reads as an AI action,
 *  not another gray settings icon. Same spot on every tab page. */
export function AiTrainerAction() {
  const { open, openPanel } = useAiTrainerPanel();
  const pending = usePlaceContext()?.pendingByBucket['coach'] || 0;
  return (
    <button
      onClick={openPanel}
      data-tour="ai"
      aria-label="מאמן AI"
      title="מאמן AI"
      className={`relative h-10 px-3 rounded-full inline-flex items-center gap-1 font-bold text-[13px] transition-colors focus:outline-none ${
        open
          ? 'bg-emerald-500 text-white'
          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25'
      }`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
        <path d="M12 2.5c.3 0 .55.2.63.48l1.28 4.53a3 3 0 0 0 2.07 2.07l4.54 1.28a.66.66 0 0 1 0 1.27l-4.54 1.28a3 3 0 0 0-2.07 2.07l-1.28 4.54a.66.66 0 0 1-1.27 0l-1.28-4.54a3 3 0 0 0-2.07-2.07L3.47 12.13a.66.66 0 0 1 0-1.27l4.54-1.28A3 3 0 0 0 10.09 7.5l1.28-4.53c.08-.28.33-.47.63-.47Z"/>
      </svg>
      <span>AI</span>
      {pending > 0 && <PendingDot n={pending} tone="emerald" />}
    </button>
  );
}

/** Waiting-for-you marker. Sits on the coach's own button — the place control
 *  stays clean, and the badge only ever appears on the coach that raised it. */
function PendingDot({ n, tone }: { n: number; tone: 'emerald' | 'amber' }) {
  const ring = tone === 'emerald' ? 'bg-emerald-600' : 'bg-amber-500';
  return (
    <span className={`absolute -top-1 -left-1 min-w-[16px] h-4 px-1 rounded-full ${ring} text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-950`}>
      {n}
    </span>
  );
}

/** Combined actions for tab pages — AI trainer + stopwatch toggle + settings gear.
 *  Every tab page uses this so all three live in one predictable spot. */
export function TabActions({ navigate }: { navigate: (r: Route) => void }) {
  return (
    <>
      <AiTrainerAction />
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

/** Ask-the-food-coach button. Same shape and position as the trainer's AI pill
 *  in אימונים — one grammar across places, only the tint differs. */
export function FoodAiAction({ onClick }: { onClick: () => void }) {
  const pending = usePlaceContext()?.pendingByBucket['dietary'] || 0;
  return (
    <button
      onClick={onClick}
      data-tour="ai"
      aria-label="מאמן תזונה"
      title="מאמן תזונה"
      className="relative h-10 px-3 rounded-full inline-flex items-center gap-1 font-bold text-[13px] transition-colors bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 focus:outline-none"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
        <path d="M12 2.5c.3 0 .55.2.63.48l1.28 4.53a3 3 0 0 0 2.07 2.07l4.54 1.28a.66.66 0 0 1 0 1.27l-4.54 1.28a3 3 0 0 0-2.07 2.07l-1.28 4.54a.66.66 0 0 1-1.27 0l-1.28-4.54a3 3 0 0 0-2.07-2.07L3.47 12.13a.66.66 0 0 1 0-1.27l4.54-1.28A3 3 0 0 0 10.09 7.5l1.28-4.53c.08-.28.33-.47.63-.47Z"/>
      </svg>
      <span>AI</span>
      {pending > 0 && <PendingDot n={pending} tone="amber" />}
    </button>
  );
}
