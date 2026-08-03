import { useState, useEffect } from 'react';

type Props = {
  remaining: number;
  isRunning: boolean;
  onSkip: () => void;
  onAddTime: (s: number) => void;
  nextLabel: string;
  isDone: boolean;
};

export function RestTimer({ remaining, isRunning, onSkip, onAddTime, nextLabel, isDone }: Props) {
  const [minimized, setMinimized] = useState(true);

  // Always start minimized when a new timer starts
  useEffect(() => {
    if (isRunning) setMinimized(true);
  }, [isRunning]);

  // When timer hits zero — keep minimized (subtle green "ready" pill) so it doesn't
  // block a set the user is already logging. User can tap to dismiss.
  useEffect(() => {
    if (remaining === 0) setMinimized(true);
  }, [remaining]);

  if (!isRunning && !isDone) return null;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  if (minimized) {
    const urgent = remaining > 0 && remaining <= 5;
    const done = remaining === 0;
    return (
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[70]" dir="rtl">
        <div className={`flex items-center gap-2 rounded-full px-3 py-2 shadow-lg backdrop-blur border ${
          done
            ? 'bg-emerald-500 border-emerald-400 text-white'
            : urgent
              ? 'dark:bg-slate-900 bg-white border-red-500 ring-2 ring-red-500/40'
              : 'dark:bg-slate-900/95 bg-white/95 border-subtle'
        }`}>
          {done ? (
            <>
              <button
                onClick={onSkip}
                aria-label="קדימה!"
                className="flex items-center gap-1.5 font-semibold text-sm px-1"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path d="M5 12l5 5L20 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>קדימה!</span>
              </button>
              <button
                onClick={onSkip}
                aria-label="סגור"
                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/20"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setMinimized(false)}
                className="flex items-center gap-1.5"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <span className={`font-mono font-bold tabular-nums text-base ${urgent ? 'text-red-500' : 'text-main'}`}>
                  {display}
                </span>
                <span className="text-[10px] text-muted">מנוחה</span>
              </button>
              <span className="text-muted-most">·</span>
              <button onClick={() => onAddTime(30)} className="text-[10px] text-blue-500 hover:text-blue-400">+30 שנ'</button>
              <button onClick={onSkip} className="text-[10px] text-amber-500 hover:text-amber-400">דלג</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-[70] flex flex-col items-center justify-center dark:bg-slate-950/95 bg-white/95 backdrop-blur-sm transition-all`} dir="rtl">
      {/* Dismiss X — big tap target top-left */}
      <button
        onClick={() => setMinimized(true)}
        aria-label="מזער"
        className="absolute top-4 left-4 w-11 h-11 rounded-full flex items-center justify-center text-muted dark:hover:bg-slate-800 hover:bg-slate-100"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M6 6l12 12M6 18L18 6" />
        </svg>
      </button>

      <div className="text-muted text-sm mb-4">טיימר מנוחה</div>

      <div className={`text-8xl font-mono font-bold mb-8 tabular-nums ${
        remaining <= 5 && remaining > 0 ? 'text-red-500' : 'text-main'
      }`}>
        {display}
      </div>

      <div className="text-muted text-sm mb-8">
        הבא: {nextLabel}
      </div>

      <div className="flex gap-3 flex-wrap justify-center px-4">
        <button onClick={onSkip} className="btn-secondary px-6">דלג</button>
        <button onClick={() => onAddTime(30)} className="btn-secondary px-6">+30 שנ'</button>
        <button onClick={() => setMinimized(true)} className="btn-secondary px-6">מזער</button>
      </div>
    </div>
  );
}
