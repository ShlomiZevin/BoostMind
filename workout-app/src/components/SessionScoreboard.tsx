import { useEffect, useRef, useState } from 'react';

type Props = {
  sessionStartMs: number;
  restRemaining: number;
  restIsRunning: boolean;
  restIsDone: boolean;
  onRestSkip: () => void;
  onRestAdd: (s: number) => void;
};

function pad2(n: number): string { return String(n).padStart(2, '0'); }
function fmtHMS(totalSec: number): string {
  if (totalSec < 0) totalSec = 0;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}
function fmtHMSMs(totalMs: number): string {
  if (totalMs < 0) totalMs = 0;
  const totalSec = Math.floor(totalMs / 1000);
  const cs = Math.floor((totalMs % 1000) / 10);
  return `${fmtHMS(totalSec)}.${pad2(cs)}`;
}

const DEFAULT_REST_KEY = 'scoreboard:defaultRestSec';
function loadDefaultRest(): number {
  try {
    const v = Number(localStorage.getItem(DEFAULT_REST_KEY));
    if (v >= 15 && v <= 600) return v;
  } catch { /* ignore */ }
  return 30;
}
function saveDefaultRest(v: number) {
  try { localStorage.setItem(DEFAULT_REST_KEY, String(v)); } catch { /* ignore */ }
}

/**
 * Session Scoreboard — an "add-on" tool that lives at the top of a live session.
 *
 * Collapsed (default): a slim horizontal bar showing just session duration + a
 *   pull-down hint. Tap anywhere to expand.
 * Expanded: full three-tool scoreboard with big scoreboard-style numbers + controls
 *   for session pause, rest timer (adjustable default), and stopwatch.
 *
 * Auto-expands when the rest timer starts or hits zero. Auto-dismisses "קדימה!" when
 * the tab regains focus. The drag handle swaps position: at bottom when open (push
 * back up) and at top when closed (pull down).
 */
export function SessionScoreboard({
  sessionStartMs, restRemaining, restIsRunning, restIsDone, onRestSkip, onRestAdd,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());

  // Session pause — local state; not persisted. Elapsed = (now - start) - accumulatedPauseMs
  const [sessionPaused, setSessionPaused] = useState(false);
  const [sessionPauseStartMs, setSessionPauseStartMs] = useState(0);
  const [sessionAccumPauseMs, setSessionAccumPauseMs] = useState(0);

  // Stopwatch — independent, for hold-time / free timing
  const [swRunning, setSwRunning] = useState(false);
  const [swStartMs, setSwStartMs] = useState<number>(0);
  const [swAccumMs, setSwAccumMs] = useState<number>(0);

  // Default rest duration — user-adjustable
  const [defaultRest, setDefaultRest] = useState<number>(() => loadDefaultRest());

  // Auto-open when the rest timer starts or hits zero — big visual cue.
  const lastRestState = useRef<{ running: boolean; done: boolean }>({ running: false, done: false });
  useEffect(() => {
    const prev = lastRestState.current;
    if ((restIsRunning && !prev.running) || (restIsDone && !prev.done)) {
      setExpanded(true);
    }
    lastRestState.current = { running: restIsRunning, done: restIsDone };
  }, [restIsRunning, restIsDone]);

  // Auto-dismiss the done state when the tab regains focus.
  useEffect(() => {
    if (!restIsDone) return;
    function onVisible() {
      if (document.visibilityState === 'visible') onRestSkip();
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [restIsDone, onRestSkip]);

  // Ticker — faster while stopwatch running so centiseconds update smoothly
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), swRunning ? 50 : 1000);
    return () => clearInterval(id);
  }, [swRunning]);

  const sessionRawElapsedMs = now - sessionStartMs;
  const activePauseMs = sessionPaused ? (now - sessionPauseStartMs) : 0;
  const sessionElapsedSec = Math.max(0, Math.floor((sessionRawElapsedMs - sessionAccumPauseMs - activePauseMs) / 1000));

  const swElapsedMs = swAccumMs + (swRunning ? (now - swStartMs) : 0);

  function toggleSessionPause() {
    if (sessionPaused) {
      setSessionAccumPauseMs(a => a + (Date.now() - sessionPauseStartMs));
      setSessionPaused(false);
    } else {
      setSessionPauseStartMs(Date.now());
      setSessionPaused(true);
    }
  }
  function toggleStopwatch() {
    if (swRunning) {
      setSwAccumMs(a => a + (Date.now() - swStartMs));
      setSwRunning(false);
    } else {
      setSwStartMs(Date.now());
      setSwRunning(true);
    }
  }
  function resetStopwatch() {
    setSwRunning(false);
    setSwStartMs(0);
    setSwAccumMs(0);
  }
  function bumpDefaultRest(delta: number) {
    setDefaultRest(prev => {
      const next = Math.min(600, Math.max(15, prev + delta));
      saveDefaultRest(next);
      return next;
    });
  }

  const swActive = swRunning || swElapsedMs > 0;
  const restLabel = restIsDone
    ? 'קדימה!'
    : restIsRunning && restRemaining > 0
      ? fmtHMS(restRemaining)
      : fmtHMS(defaultRest);
  const restToneCls = restIsDone
    ? 'text-emerald-400'
    : (restIsRunning && restRemaining > 0 && restRemaining <= 5)
      ? 'text-red-400'
      : (restIsRunning && restRemaining > 0)
        ? 'text-white'
        : 'text-white/50';

  // Interaction model:
  //   - CLOSED: tap or drag-down → open
  //   - OPEN:   drag-up → close (tap does nothing → no accidental close, no click-through)
  //   - Buttons inside always work (their own onPointerDown stopPropagation).
  const dragRef = useRef<{ startY: number; startExpanded: boolean; moved: boolean; captured: boolean } | null>(null);
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.closest('button, input')) return;
    dragRef.current = { startY: e.clientY, startExpanded: expanded, moved: false, captured: false };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); dragRef.current.captured = true; } catch { /* ignore */ }
    e.preventDefault();
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (Math.abs(dy) > 8) d.moved = true;
    if (!d.startExpanded && dy > 30) {
      setExpanded(true);
      dragRef.current = null;
    } else if (d.startExpanded && dy < -30) {
      setExpanded(false);
      dragRef.current = null;
    }
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.captured) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    if (!d) return;
    // Tap without drag: only OPEN (never close via tap — drag-up handles close).
    if (!d.moved && !d.startExpanded) setExpanded(true);
  }

  // When the rest timer hits zero, force-scroll to the top so the user actually SEES the "GO!"
  // even if they were scrolled down inside the session.
  useEffect(() => {
    if (restIsDone) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [restIsDone]);

  // Custom close for the done state — also collapse the scoreboard.
  function closeDone() {
    onRestSkip();
    setExpanded(false);
  }

  return (
    <div
      className="sticky -mx-4 mb-3 select-none z-40"
      style={{ top: 'var(--top-bar-h)' }}
      dir="rtl"
    >
      {/* Emerald-themed panel matching the app's live-session identity */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={`overflow-hidden shadow-lg border-b border-x cursor-grab active:cursor-grabbing transition-all touch-none
                    ${restIsDone
                      ? 'bg-emerald-700 border-emerald-500/50'
                      : 'bg-emerald-950 dark:bg-emerald-950 border-emerald-500/25'} rounded-b-2xl`}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {/* Collapsed: single tight row — always show session; show rest and stopwatch when active */}
        {!expanded && (
          <div className="flex items-center justify-between gap-3 px-3.5 py-2" dir="rtl">
            <div className="flex items-baseline gap-3 flex-wrap">
              {/* Session (always) */}
              <div className="inline-flex items-baseline gap-1.5 text-emerald-300">
                <IconClock />
                <span className={`font-scoreboard text-xl leading-none ${sessionPaused ? 'text-white/40' : 'text-emerald-300'}`}>
                  {fmtHMS(sessionElapsedSec)}
                </span>
              </div>
              {/* Rest (when running or just finished) */}
              {(restIsRunning || restIsDone) && (
                <div className={`inline-flex items-baseline gap-1.5 ${restIsDone ? 'text-emerald-300' : restRemaining <= 5 ? 'text-red-400' : 'text-white'}`}>
                  <IconRest />
                  <span className={`font-scoreboard text-xl leading-none ${restIsDone ? 'animate-pulse' : ''}`}>
                    {restIsDone ? 'GO!' : fmtHMS(restRemaining)}
                  </span>
                </div>
              )}
              {/* Stopwatch (only while running) */}
              {swRunning && (
                <div className="inline-flex items-baseline gap-1.5 text-blue-300">
                  <IconStopwatch />
                  <span className="font-scoreboard text-xl leading-none">
                    {fmtHMS(Math.floor(swElapsedMs / 1000))}
                  </span>
                </div>
              )}
            </div>
            <div className="text-[9px] text-emerald-300/60 flex items-center gap-0.5">
              <span>פתח</span>
              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
            </div>
          </div>
        )}

        {/* Expanded scoreboard */}
        {expanded && (
          <div className="grid grid-cols-3 gap-2 px-3 pt-3 pb-2">
            {/* Session — with pause */}
            <ScoreCell
              label="משך אימון"
              icon={<IconClock />}
              value={fmtHMS(sessionElapsedSec)}
              toneCls={sessionPaused ? 'text-white/40' : 'text-emerald-300'}
              controls={
                <ControlButton onClick={toggleSessionPause} aria-label={sessionPaused ? 'המשך' : 'השהה'}>
                  {sessionPaused ? '▶' : '❚❚'}
                </ControlButton>
              }
            />

            {/* Rest — with default-adjust and controls while running */}
            <ScoreCell
              label="טיימר"
              icon={<IconRest />}
              value={restLabel}
              toneCls={restToneCls}
              controls={
                restIsRunning && restRemaining > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <ControlButton onClick={() => onRestAdd(-15)} aria-label="הפחת 15 שניות">
                      <span dir="ltr">−15</span>
                    </ControlButton>
                    <ControlButton onClick={onRestSkip} aria-label="דלג">דלג</ControlButton>
                    <ControlButton onClick={() => onRestAdd(15)} aria-label="הוסף 15 שניות">
                      <span dir="ltr">+15</span>
                    </ControlButton>
                  </div>
                ) : restIsDone ? (
                  <ControlButton onClick={closeDone} aria-label="סגור">סגור</ControlButton>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <ControlButton onClick={() => bumpDefaultRest(-15)} aria-label="ברירת מחדל הפחת 15">
                      <span dir="ltr">−15</span>
                    </ControlButton>
                    <ControlButton onClick={() => bumpDefaultRest(15)} aria-label="ברירת מחדל הוסף 15">
                      <span dir="ltr">+15</span>
                    </ControlButton>
                  </div>
                )
              }
            />

            {/* Stopwatch */}
            <ScoreCell
              label="שעון עצר"
              icon={<IconStopwatch />}
              value={fmtHMSMs(swElapsedMs)}
              toneCls={swRunning ? 'text-blue-300' : 'text-white'}
              controls={
                <div className="flex items-center gap-2">
                  <IconOnlyButton onClick={resetStopwatch} disabled={!swActive} aria-label="אפס">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
                  </IconOnlyButton>
                  <IconOnlyButton onClick={toggleStopwatch} aria-label={swRunning ? 'עצור' : 'התחל'} primary>
                    {swRunning ? (
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    )}
                  </IconOnlyButton>
                </div>
              }
            />
          </div>
        )}

        {/* Bottom drag handle (visible when OPEN — "push me back up") */}
        {expanded && <DragHandle position="bottom" />}
      </div>
    </div>
  );
}

function DragHandle({ position }: { position: 'top' | 'bottom' }) {
  return (
    <div className={`flex justify-center ${position === 'top' ? 'py-1.5' : 'pt-1 pb-1.5'}`}>
      <span className="block w-10 h-1 rounded-full bg-white/30" />
    </div>
  );
}

function ScoreCell({
  label, icon, value, toneCls, controls,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  toneCls: string;
  controls: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="text-[9px] text-emerald-300/80 uppercase tracking-widest font-semibold flex items-center gap-1">
        <span>{label}</span>
        {icon}
      </div>
      <div className={`font-scoreboard text-2xl leading-none mt-1 ${toneCls}`}>{value}</div>
      <div className="mt-2 min-h-[26px] flex items-center justify-center">
        {controls}
      </div>
    </div>
  );
}

function ControlButton({
  children, onClick, disabled, ...rest
}: { children: React.ReactNode; onClick?: () => void; disabled?: boolean } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onClick' | 'disabled'>) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onPointerDown={e => e.stopPropagation()}
      className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors text-white"
      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
      {...rest}
    >
      {children}
    </button>
  );
}

function IconOnlyButton({
  children, onClick, disabled, primary, ...rest
}: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; primary?: boolean } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onClick' | 'disabled'>) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onPointerDown={e => e.stopPropagation()}
      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-30
        ${primary ? 'bg-emerald-500 hover:bg-emerald-400 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
      {...rest}
    >
      {children}
    </button>
  );
}

function IconClock({ size = 14 }: { size?: number } = {}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className=""><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  );
}
// Clearer rest icon — hourglass shape reads instantly as "rest / wait"
function IconRest({ size = 14 }: { size?: number } = {}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="">
      <path d="M6 2h12" />
      <path d="M6 22h12" />
      <path d="M6 2v5a6 6 0 0 0 12 0V2" />
      <path d="M6 22v-5a6 6 0 0 1 12 0v5" />
    </svg>
  );
}
function IconStopwatch({ size = 14 }: { size?: number } = {}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className=""><line x1="10" y1="2" x2="14" y2="2" /><line x1="12" y1="14" x2="15" y2="11" /><circle cx="12" cy="14" r="8" /></svg>
  );
}
