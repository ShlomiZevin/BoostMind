import { useEffect, useState } from 'react';
import type { FreeSession } from '../types';

// Small floating pill shown whenever the user has an active session but is
// looking at a different screen (Home history, Body, Food, Settings, etc).
// One tap jumps back into the session. Keeps the timer alive and visible
// across the whole app — leaving the session screen no longer feels like
// "abandoning" a workout (rep_1787730383527_ynqg).
//
// Sits above the tab bar / FAB. Never renders on the session screen itself
// (the FreeSession page shows its own Chronograph).

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }
function fmt(msTotal: number): string {
  if (msTotal < 0) msTotal = 0;
  const totalSec = Math.floor(msTotal / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(s)}`;
  return `${pad2(m)}:${pad2(s)}`;
}

export function LiveSessionBadge({
  session, onClick, restRemaining, restRunning, restDone,
}: {
  session: FreeSession;
  onClick: () => void;
  // Optional: rest timer state lifted from the session so the badge can show
  // the countdown while the user is on a different screen (rep_1787909040967_tv06).
  restRemaining?: number;
  restRunning?: boolean;
  restDone?: boolean;
}) {
  // Tick every second so the digits keep moving. Paused sessions freeze at
  // (pausedAt - date), so we still render but stop ticking.
  const [tick, setTick] = useState(0);
  const paused = session.pausedAt != null && session.pausedAt !== session.date;
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setTick(t => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [paused]);
  void tick;

  const end = paused ? (session.pausedAt as number) : Date.now();
  // Sentinel for a "fresh" session that never actually started ticking.
  const raw = end - session.date;
  const isFresh = session.pausedAt != null && session.pausedAt === session.date;
  const elapsed = isFresh ? 0 : raw;

  const label = fmt(elapsed);

  const showRest = !!restRunning && (restRemaining ?? 0) > 0;
  const showDone = !!restDone && !restRunning;

  return (
    <button
      onClick={onClick}
      className={`fixed left-4 z-40 flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full shadow-lg font-mono font-bold text-sm border transition-colors ${
        paused
          ? 'bg-slate-600 hover:bg-slate-500 text-white border-slate-500'
          : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
      }`}
      style={{
        // Sit just above the tab bar. Safe-area inset keeps us clear of the
        // iOS home indicator when the tab bar is hidden.
        bottom: 'calc(env(safe-area-inset-bottom) + 84px)',
        // Subtle pulse only when running — a still pill would look inert next
        // to the animated FAB, and users would miss the "you're still in a
        // workout" cue.
        boxShadow: paused
          ? '0 6px 20px -4px rgba(0,0,0,0.4)'
          : '0 6px 20px -4px rgba(16, 185, 129, 0.55)',
      }}
      aria-label="חזרה לאימון החי"
      title="חזרה לאימון החי"
      dir="ltr"
    >
      {/* Animated dot when running / static grey when paused */}
      <span className="relative flex h-2.5 w-2.5">
        {!paused && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-70 animate-ping" />
        )}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${paused ? 'bg-slate-300' : 'bg-white'}`} />
      </span>
      <span className="tabular-nums">{label}</span>
      {paused && <span className="text-[10px] opacity-80 ms-1">מושהה</span>}
      {/* Rest chip: countdown while running, "מנוחה סיימה" flash when done.
          Sits inside the same pill so the whole "you're mid-session" state
          reads at a glance without another floating element. */}
      {(showRest || showDone) && (
        <span
          className={`ms-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold border ${
            showDone
              ? 'bg-amber-400 text-slate-900 border-amber-300 animate-pulse'
              : 'bg-white/15 text-white border-white/25'
          }`}
        >
          {showDone
            ? <><span>⏰</span><span>מנוחה סיימה</span></>
            : <><span>⏱</span><span className="tabular-nums">{fmt((restRemaining ?? 0) * 1000)}</span></>}
        </span>
      )}
    </button>
  );
}
