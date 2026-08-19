import { useRef } from 'react';
import type { Route } from '../types';
import { PLACES, IconBolt, IconPlay, IconFork, type PlaceId } from '../places/registry';

type Props = {
  current: Route['page'];
  place: PlaceId;
  onNavigate: (r: Route) => void;
  hasInProgress: boolean;
  onFabClick: () => void;
  /** Long-press → quick actions of the OTHER places (see PlaceSwitcher). */
  onFabLongPress: () => void;
};

const TINT_ACTIVE: Record<string, string> = {
  emerald: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  blue: 'text-blue-600 dark:text-blue-400',
  violet: 'text-violet-600 dark:text-violet-400',
};

const TINT_FAB: Record<string, { base: string; live: string; shadow: string }> = {
  emerald: {
    base: 'bg-emerald-600 ring-4 ring-emerald-600/20',
    live: 'bg-emerald-500 ring-4 ring-emerald-500/25',
    shadow: 'shadow-[0_8px_24px_-4px_rgba(16,185,129,0.5)]',
  },
  amber: {
    base: 'bg-amber-500 ring-4 ring-amber-500/20',
    live: 'bg-amber-400 ring-4 ring-amber-400/25',
    shadow: 'shadow-[0_8px_24px_-4px_rgba(245,158,11,0.5)]',
  },
  blue: {
    base: 'bg-blue-600 ring-4 ring-blue-600/20',
    live: 'bg-blue-500 ring-4 ring-blue-500/25',
    shadow: 'shadow-[0_8px_24px_-4px_rgba(59,130,246,0.5)]',
  },
  violet: {
    base: 'bg-violet-600 ring-4 ring-violet-600/20',
    live: 'bg-violet-500 ring-4 ring-violet-500/25',
    shadow: 'shadow-[0_8px_24px_-4px_rgba(139,92,246,0.5)]',
  },
};

function TabButton({
  active, label, icon, onClick, tint,
}: {
  active: boolean;
  label: string;
  icon: JSX.Element;
  onClick: () => void;
  tint: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] transition-colors ${
        active ? TINT_ACTIVE[tint] : 'text-muted hover:text-main'
      }`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <span className={`transition-transform ${active ? 'scale-105' : ''}`}>{icon}</span>
      <span className={`text-[10px] ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
    </button>
  );
}

export function TabBar({ current, place, onNavigate, hasInProgress, onFabClick, onFabLongPress }: Props) {
  const cfg = PLACES[place];
  const fab = TINT_FAB[cfg.tint];
  const [t1, t2, t3, t4] = cfg.tabs;

  // Long-press: 350ms with the finger down fires the fan instead of the tap.
  // `fired` suppresses the click that would otherwise follow on release.
  const timerRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  function pressStart() {
    firedRef.current = false;
    timerRef.current = window.setTimeout(() => {
      firedRef.current = true;
      try { navigator.vibrate?.(12); } catch { /* unsupported */ }
      onFabLongPress();
    }, 350);
  }
  function pressCancel() {
    if (timerRef.current != null) { clearTimeout(timerRef.current); timerRef.current = null; }
  }

  const fabIcon = place === 'food'
    ? <IconFork />
    : hasInProgress ? <IconPlay /> : <IconBolt />;
  const fabLabel = place === 'food'
    ? 'הוסף ארוחה'
    : hasInProgress ? 'המשך אימון' : 'התחל אימון';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40
                 bg-white/95 dark:bg-slate-950/95 backdrop-blur
                 border-t dark:border-slate-800 border-slate-200
                 pb-[env(safe-area-inset-bottom)]"
      dir="rtl"
    >
      <div className="max-w-lg mx-auto flex items-stretch relative">
        <TabButton active={current === t1.page} label={t1.he} icon={t1.icon} tint={cfg.tint} onClick={() => onNavigate({ page: t1.page } as Route)} />
        <TabButton active={current === t2.page} label={t2.he} icon={t2.icon} tint={cfg.tint} onClick={() => onNavigate({ page: t2.page } as Route)} />

        {/* FAB well — takes the middle slot */}
        <div className="w-16 shrink-0 relative flex justify-center">
          <button
            onClick={() => { if (firedRef.current) { firedRef.current = false; return; } onFabClick(); }}
            onPointerDown={pressStart}
            onPointerUp={pressCancel}
            onPointerLeave={pressCancel}
            onPointerCancel={pressCancel}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={fabLabel}
            className={`absolute -top-7 w-16 h-16 rounded-full flex items-center justify-center
                       text-white font-bold ${fab.shadow} select-none touch-none
                       transition-transform active:scale-95 hover:scale-105
                       ${hasInProgress && place === 'exercise' ? fab.live : fab.base}`}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {fabIcon}
            {hasInProgress && place === 'exercise' && (
              <span className="absolute -top-0.5 -left-0.5 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400 ring-2 ring-white dark:ring-slate-950" />
              </span>
            )}
          </button>
        </div>

        <TabButton active={current === t3.page} label={t3.he} icon={t3.icon} tint={cfg.tint} onClick={() => onNavigate({ page: t3.page } as Route)} />
        <TabButton active={current === t4.page} label={t4.he} icon={t4.icon} tint={cfg.tint} onClick={() => onNavigate({ page: t4.page } as Route)} />
      </div>
    </nav>
  );
}
