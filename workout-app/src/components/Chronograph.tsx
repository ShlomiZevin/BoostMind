import { useEffect, useRef, useState } from 'react';

type Props = {
  sessionStartMs: number;
  // When set, the session is paused — elapsed freezes at pausedAtMs - sessionStartMs.
  // Undefined means the timer is running (or the session is fresh with no
  // meaningful start yet, in which case the caller can pass sessionStartMs = now).
  pausedAtMs?: number;
  restRemaining: number;
  restIsRunning: boolean;
  restIsDone: boolean;
  onRestSkip: () => void;
  onRestAdd: (s: number) => void;
  onRestStart: (seconds: number) => void;
  // Standalone mode: not tied to a session — starts on the stopwatch tab, exposes a close button.
  standalone?: boolean;
  onDismiss?: () => void;
};

type FocusMode = 'session' | 'rest' | 'stopwatch';
type Corner = 'tl' | 'tr' | 'bl' | 'br' | 'tm' | 'bm' | 'lm' | 'rm';

// Sizes are single-source-of-truth — both the coord math and the actual render read these.
const COMPACT_SIZE = 80;
const EXPANDED_SIZE = 200;

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

const CORNER_KEY = 'chronograph:corner';
const DEFAULT_REST_KEY = 'scoreboard:defaultRestSec';
function loadCorner(): Corner {
  try {
    const v = localStorage.getItem(CORNER_KEY);
    if (v === 'tl' || v === 'tr' || v === 'bl' || v === 'br' || v === 'tm' || v === 'bm' || v === 'lm' || v === 'rm') return v;
  } catch { /* ignore */ }
  return 'tr';
}
function saveCorner(c: Corner) { try { localStorage.setItem(CORNER_KEY, c); } catch { /* ignore */ } }

function loadDefaultRest(): number {
  try {
    const v = Number(localStorage.getItem(DEFAULT_REST_KEY));
    if (v >= 15 && v <= 600) return v;
  } catch { /* ignore */ }
  return 30;
}
function saveDefaultRest(v: number) { try { localStorage.setItem(DEFAULT_REST_KEY, String(v)); } catch { /* ignore */ } }

/**
 * Chronograph — a round "coach's stopwatch" that floats above the session.
 *
 * Compact (72×72): a single dark disc showing the primary clock (session by default).
 * Expanded (~240×240): full watch face with all three clocks + controls.
 *
 * Interaction:
 *   • Tap to expand / collapse
 *   • Drag to move — auto-snaps to the nearest corner on release
 *   • Auto-expands when rest timer starts or hits zero
 *   • Position persists across sessions (localStorage)
 */
export function Chronograph({
  sessionStartMs, pausedAtMs, restRemaining, restIsRunning, restIsDone, onRestSkip, onRestAdd, onRestStart,
  standalone, onDismiss,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [corner, setCorner] = useState<Corner>(() => loadCorner());
  const [now, setNow] = useState<number>(() => Date.now());
  const [focusMode, setFocusMode] = useState<FocusMode>(standalone ? 'stopwatch' : 'session');

  // Session pause
  const [sessionPaused, setSessionPaused] = useState(false);
  const [sessionPauseStartMs, setSessionPauseStartMs] = useState(0);
  const [sessionAccumPauseMs, setSessionAccumPauseMs] = useState(0);

  // Stopwatch
  const [swRunning, setSwRunning] = useState(false);
  const [swStartMs, setSwStartMs] = useState<number>(0);
  const [swAccumMs, setSwAccumMs] = useState<number>(0);

  // Default rest duration
  const [defaultRest, setDefaultRest] = useState<number>(() => loadDefaultRest());

  // Last duration actually started — used for the "replay" button when the timer ends,
  // so re-timing is one tap regardless of the current default.
  const [lastStartedSecs, setLastStartedSecs] = useState<number>(() => loadDefaultRest());

  // Drag state — { startX, startY, offsetX, offsetY, moved, pxSnapshot } during drag
  const dragRef = useRef<{
    startX: number; startY: number; startCoords: { x: number; y: number };
    moved: boolean; captured: boolean;
  } | null>(null);
  // Live absolute position (px from top-left) while dragging. Null = use corner.
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  // Auto-expand + scroll-to-top when rest events fire
  const lastRestState = useRef<{ running: boolean; done: boolean }>({ running: false, done: false });
  useEffect(() => {
    const prev = lastRestState.current;
    if ((restIsRunning && !prev.running)) {
      setExpanded(true);
      setFocusMode('rest');
      // Snapshot the duration that was just kicked off so the replay button can reuse it.
      if (restRemaining > 0) setLastStartedSecs(restRemaining);
    } else if (restIsDone && !prev.done) {
      setExpanded(true);
      setFocusMode('rest');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    lastRestState.current = { running: restIsRunning, done: restIsDone };
  }, [restIsRunning, restIsDone]);

  // Auto-dismiss done state when tab regains focus
  useEffect(() => {
    if (!restIsDone) return;
    function onVisible() {
      if (document.visibilityState === 'visible') { onRestSkip(); setExpanded(false); }
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [restIsDone, onRestSkip]);

  // Ticker
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), swRunning ? 50 : 1000);
    return () => clearInterval(id);
  }, [swRunning]);

  // If the session is paused at the store level (pausedAtMs from Firestore), the
  // elapsed clock freezes at pausedAtMs - sessionStartMs. Local Chronograph pause
  // (sessionPaused) still stacks on top of that in case the user pauses inside
  // the widget too.
  //
  // Special case: a "fresh" session pins pausedAtMs === sessionStartMs as a
  // sentinel so home tiles can render a "ready to start" label. Treat that
  // sentinel as LIVE — otherwise the widget shows 00:00 forever until the
  // user logs a first set (which is the bug the user hit: the clock only
  // started ticking after the first save, even though elapsed was correct).
  const isFreshSentinel = pausedAtMs != null && pausedAtMs === sessionStartMs;
  const effectiveNow = pausedAtMs != null && !isFreshSentinel ? pausedAtMs : now;
  const sessionRawElapsedMs = effectiveNow - sessionStartMs;
  const activePauseMs = sessionPaused ? (effectiveNow - sessionPauseStartMs) : 0;
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
    setSwRunning(false); setSwStartMs(0); setSwAccumMs(0);
  }
  function bumpDefaultRest(delta: number) {
    setDefaultRest(prev => {
      const next = Math.min(600, Math.max(15, prev + delta));
      saveDefaultRest(next);
      return next;
    });
  }
  function closeDone() { onRestSkip(); setExpanded(false); }

  // In EXPANDED view, the hero clock follows whatever tab the user picked (focusMode).
  // In COMPACT view we show all active clocks stacked (see the compact render below).
  const primaryMode: FocusMode = focusMode;

  // ────────────────────────────────────────────────────────────
  // Drag handling
  // ────────────────────────────────────────────────────────────
  function currentCoords(): { x: number; y: number } {
    if (dragPos) return dragPos;
    // Position based on corner. Values chosen to sit nicely above bottom action bar / below TopBar.
    const size = expanded ? EXPANDED_SIZE : COMPACT_SIZE;
    const margin = 16;
    const topInset = 80 + 44 /* safeArea approx */; // below TopBar
    const bottomInset = 120; // above tab bar / bottom actions
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // For mid-axis snaps, subtract half the widget size so the widget's CENTER (not its top-left corner)
    // lands on the middle of the axis.
    const midX = Math.round((vw - size) / 2);
    const midY = Math.round((vh - size) / 2);
    switch (corner) {
      case 'tl': return { x: margin, y: topInset };
      case 'tr': return { x: vw - size - margin, y: topInset };
      case 'bl': return { x: margin, y: vh - size - bottomInset };
      case 'br': return { x: vw - size - margin, y: vh - size - bottomInset };
      case 'tm': return { x: midX, y: topInset };
      case 'bm': return { x: midX, y: vh - size - bottomInset };
      case 'lm': return { x: margin, y: midY };
      case 'rm': return { x: vw - size - margin, y: midY };
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    const coords = currentCoords();
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      startCoords: coords,
      moved: false, captured: false,
    };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); dragRef.current.captured = true; } catch { /* ignore */ }
    e.preventDefault();
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) d.moved = true;
    if (d.moved) {
      setDragPos({ x: d.startCoords.x + dx, y: d.startCoords.y + dy });
    }
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.captured) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    if (!d) return;
    if (!d.moved) {
      // Tap in GO state (rest done) — dismiss the timer, whether compact or expanded.
      if (restIsDone) { onRestSkip(); setExpanded(false); return; }
      // Otherwise: tap toggles expand.
      setExpanded(v => !v);
      return;
    }
    // Snap to nearest anchor: 4 corners + top-mid + bottom-mid + left-mid + right-mid = 8 total.
    const size = expanded ? EXPANDED_SIZE : COMPACT_SIZE;
    if (!dragPos) return;
    const cx = dragPos.x + size / 2;
    const cy = dragPos.y + size / 2;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Horizontal & vertical zones: [0, 33%] near / (33%, 67%) mid / [67%, 100%] far
    const hZone: 'left' | 'mid' | 'right' =
      cx < vw / 3 ? 'left' : cx > (vw * 2) / 3 ? 'right' : 'mid';
    const vZone: 'top' | 'mid' | 'bottom' =
      cy < vh / 3 ? 'top' : cy > (vh * 2) / 3 ? 'bottom' : 'mid';
    let nextCorner: Corner;
    if (hZone === 'mid' && vZone === 'mid') {
      // Dead center — snap to the closest edge instead of hovering in the middle of the screen.
      const distTop = cy, distBottom = vh - cy, distLeft = cx, distRight = vw - cx;
      const minD = Math.min(distTop, distBottom, distLeft, distRight);
      nextCorner = minD === distTop ? 'tm' : minD === distBottom ? 'bm' : minD === distLeft ? 'lm' : 'rm';
    } else if (hZone === 'mid') {
      nextCorner = vZone === 'top' ? 'tm' : 'bm';
    } else if (vZone === 'mid') {
      nextCorner = hZone === 'left' ? 'lm' : 'rm';
    } else {
      nextCorner =
        vZone === 'top'
          ? (hZone === 'left' ? 'tl' : 'tr')
          : (hZone === 'left' ? 'bl' : 'br');
    }
    setCorner(nextCorner);
    saveCorner(nextCorner);
    setDragPos(null);
  }

  // ────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────
  const pos = currentCoords();
  const size = expanded ? EXPANDED_SIZE : COMPACT_SIZE;
  const restLabel = restIsDone ? 'GO!' : restIsRunning && restRemaining > 0 ? fmtHMS(restRemaining) : fmtHMS(defaultRest);
  const restUrgent = restIsRunning && restRemaining > 0 && restRemaining <= 5;

  const primaryValue =
    primaryMode === 'rest' ? restLabel :
    primaryMode === 'stopwatch' ? fmtHMSMs(swElapsedMs) :
    fmtHMS(sessionElapsedSec);
  const primaryTone =
    primaryMode === 'rest' && restIsDone ? 'text-emerald-300 animate-pulse' :
    primaryMode === 'rest' && restUrgent ? 'text-red-400' :
    primaryMode === 'stopwatch' && swRunning ? 'text-blue-300' :
    sessionPaused ? 'text-white/40' : 'text-emerald-300';

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="fixed z-50 select-none"
      style={{
        left: pos.x, top: pos.y,
        width: size, height: size,
        transition: dragRef.current ? 'none' : 'width 200ms ease, height 200ms ease, left 200ms ease, top 200ms ease',
        touchAction: 'none',
      }}
      dir="rtl"
    >
      {/* The watch — round with an emerald bezel + dark face */}
      <div
        className={`w-full h-full rounded-full shadow-2xl border-[3px] relative flex items-center justify-center
                    ${restIsDone ? 'border-emerald-400 bg-emerald-700' :
                       restUrgent ? 'border-red-500 bg-emerald-950' :
                       'border-emerald-500/50 bg-emerald-950'}`}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {!expanded ? (
          // COMPACT — session clock always shown (unless standalone), plus rest/stopwatch when active.
          <div className="text-center pointer-events-none flex flex-col items-center justify-center leading-none gap-0.5">
            {!standalone && (() => {
              const rest = restIsRunning || restIsDone;
              const sw = swRunning;
              const showN = 1 + (rest ? 1 : 0) + (sw ? 1 : 0);
              const sessionCls = showN === 1
                ? 'text-xl text-emerald-300'
                : `text-[13px] ${sessionPaused ? 'text-white/40' : 'text-emerald-300/80'}`;
              return (
                <div className={`font-scoreboard ${sessionCls}`}>{fmtHMS(sessionElapsedSec)}</div>
              );
            })()}
            {/* Rest — big center when active */}
            {(restIsRunning || restIsDone) && (
              <div className={`font-scoreboard text-lg ${
                restIsDone ? 'text-emerald-200 animate-pulse' :
                restUrgent ? 'text-red-400' : 'text-white'
              }`}>{restIsDone ? 'GO!' : fmtHMS(restRemaining)}</div>
            )}
            {/* Stopwatch */}
            {swRunning && (
              <div className="font-scoreboard text-[13px] text-blue-300">
                {fmtHMS(Math.floor(swElapsedMs / 1000))}
              </div>
            )}
            {/* Standalone idle state — show a small stopwatch icon so the widget isn't blank */}
            {standalone && !swRunning && !restIsRunning && !restIsDone && (
              <div className="text-emerald-300/70 text-xs">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
                  <circle cx="12" cy="13" r="8" />
                  <path d="M12 9v4l2 2" />
                  <path d="M10 2h4" />
                </svg>
              </div>
            )}
          </div>
        ) : (
          // EXPANDED — bigger buttons, better proportions
          <div className="w-full h-full flex flex-col items-center justify-between py-4 px-4 text-white relative">
            {/* Standalone close button — top-left corner of the disc (RTL: top-right visually) */}
            {standalone && onDismiss && (
              <button
                onClick={onDismiss}
                onPointerDown={e => e.stopPropagation()}
                aria-label="סגור סטופר"
                className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
                style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            )}
            {/* Mode selector at top */}
            <div className="flex gap-1">
              {!standalone && (
                <ModeChip active={focusMode === 'session'} onClick={() => setFocusMode('session')}>אימון</ModeChip>
              )}
              <ModeChip active={focusMode === 'rest'} onClick={() => setFocusMode('rest')}>טיימר</ModeChip>
              <ModeChip active={focusMode === 'stopwatch'} onClick={() => setFocusMode('stopwatch')}>סטופר</ModeChip>
            </div>

            {/* Hero clock */}
            <div className="text-center">
              <div className={`font-scoreboard text-[30px] leading-none tabular-nums ${primaryTone}`}>{primaryValue}</div>
              <div className="text-[9px] text-emerald-300/70 uppercase tracking-widest mt-1">
                {primaryMode === 'session' ? 'משך אימון' : primaryMode === 'rest' ? (restIsDone ? 'קדימה!' : restIsRunning ? 'ספירה לאחור' : 'ברירת מחדל') : 'שעון עצר'}
              </div>
            </div>

            {/* Controls per mode — bigger, better proportioned */}
            <div className="flex items-center gap-2 justify-center">
              {focusMode === 'session' && (
                <RoundBtn primary onClick={toggleSessionPause} aria-label={sessionPaused ? 'המשך' : 'השהה'}>
                  {sessionPaused
                    ? <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    : <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>}
                </RoundBtn>
              )}
              {focusMode === 'rest' && (
                restIsDone ? (
                  <>
                    <RoundBtn onClick={() => onRestStart(lastStartedSecs || defaultRest)} aria-label="הפעל שוב">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                    </RoundBtn>
                    <RoundBtn primary onClick={closeDone} aria-label="סגור">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
                    </RoundBtn>
                  </>
                ) : restIsRunning ? (
                  <>
                    <Pill onClick={() => onRestAdd(-15)}><span dir="ltr">−15</span></Pill>
                    <RoundBtn primary onClick={onRestSkip} aria-label="דלג / עצור">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
                    </RoundBtn>
                    <Pill onClick={() => onRestAdd(15)}><span dir="ltr">+15</span></Pill>
                  </>
                ) : (
                  <>
                    <Pill onClick={() => bumpDefaultRest(-15)}><span dir="ltr">−15</span></Pill>
                    <RoundBtn primary onClick={() => onRestStart(defaultRest)} aria-label="התחל טיימר">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    </RoundBtn>
                    <Pill onClick={() => bumpDefaultRest(15)}><span dir="ltr">+15</span></Pill>
                  </>
                )
              )}
              {focusMode === 'stopwatch' && (
                <>
                  <RoundBtn onClick={resetStopwatch} disabled={!swRunning && swElapsedMs === 0} aria-label="אפס">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" />
                    </svg>
                  </RoundBtn>
                  <RoundBtn primary onClick={toggleStopwatch} aria-label={swRunning ? 'עצור' : 'התחל'}>
                    {swRunning
                      ? <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
                      : <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}
                  </RoundBtn>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ModeChip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      onPointerDown={e => e.stopPropagation()}
      className={`text-[10px] font-semibold px-2 py-1 rounded-full transition-colors ${
        active ? 'bg-white text-emerald-900' : 'bg-white/10 text-white/70 hover:bg-white/20'
      }`}
      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
    >{children}</button>
  );
}
function Pill({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onPointerDown={e => e.stopPropagation()}
      className="text-xs font-semibold h-10 px-3 min-w-[44px] rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white transition-colors flex items-center justify-center"
      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
    >{children}</button>
  );
}
function RoundBtn({ children, onClick, disabled, primary, ...rest }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; primary?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onClick' | 'disabled'>) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onPointerDown={e => e.stopPropagation()}
      className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors disabled:opacity-30 shadow
        ${primary ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/40' : 'bg-white/15 hover:bg-white/25 text-white'}`}
      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
      {...rest}
    >{children}</button>
  );
}
