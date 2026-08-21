import { useEffect, useLayoutEffect, useState } from 'react';
import { PLACES, PLACE_ORDER } from '../places/registry';

// First run: you land inside אימונים and nothing tells you the rest exists.
// Three cards, once per user, pointing at the three things you would otherwise
// never discover — the place switcher, the coach, and the long-press.
//
// Deliberately not a feature tour: it names only what is invisible. Everything
// else in the app is a visible button and can be found by looking.

type Step = {
  /** data-tour attribute of the element to spotlight. */
  target: string;
  title: string;
  body: string;
  /** Show the actual place list inside the card — the switcher is the one
   *  step where naming the thing isn't enough; you need to see what's behind it. */
  showPlaces?: boolean;
};

const STEPS: Step[] = [
  {
    target: 'place',
    title: 'יש כאן יותר ממקום אחד',
    body: 'אימונים זה רק חלק. מכאן עוברים לתזונה — ובהמשך גם לנשימה. הכפתור הזה תמיד באותה פינה.',
    showPlaces: true,
  },
  {
    target: 'ai',
    title: 'לכל מקום יש מאמן',
    body: 'שיחה חופשית, לא טופס. הוא מכיר את ההיסטוריה שלך — ומה שהוא מציע אפשר לאשר בלחיצה.',
  },
  {
    target: 'fab',
    title: 'לחיצה ארוכה = פעולה במקום אחר',
    body: 'לחיצה רגילה עושה את מה שרלוונטי כאן. לחיצה ארוכה פותחת מניפה עם הפעולות המהירות של המקומות האחרים — בלי לצאת מכאן.',
  },
];

const KEY_PREFIX = 'tourSeen:';

export function hasSeenTour(uid: string): boolean {
  try { return localStorage.getItem(KEY_PREFIX + uid) === '1'; } catch { return true; }
}

function markSeen(uid: string): void {
  try { localStorage.setItem(KEY_PREFIX + uid, '1'); } catch { /* private mode */ }
}

/** Event the shell listens for, so Settings can replay the tour without a
 *  reload. Per-screen tours will reuse this same hook later. */
export const TOUR_RESTART_EVENT = 'tour:restart';

export function restartTour(uid: string): void {
  try { localStorage.removeItem(KEY_PREFIX + uid); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(TOUR_RESTART_EVENT));
}

type Rect = { top: number; left: number; width: number; height: number };

export function FirstRunTour({ uid, onDone }: { uid: string; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  // Stays false until the first target is found (or we give up waiting). A new
  // user finishes the onboarding chat and lands on a Home screen that is still
  // fetching — opening the tour over that shows a card pointing at nothing.
  const [settled, setSettled] = useState(false);
  const step = STEPS[i];

  // Measure the real element each step, and again on resize/rotate — a
  // hard-coded position would drift the moment anything about the bar changes.
  useLayoutEffect(() => {
    let tries = 0;
    let poll = 0;

    function measure(): boolean {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      setSettled(true);
      return true;
    }

    // Screens that fetch before rendering (Home returns a loading state first)
    // mount their top bar late, so a one-shot measurement finds nothing. Keep
    // looking for a couple of seconds, then give up gracefully.
    if (!measure()) {
      setRect(null);
      poll = window.setInterval(() => {
        tries += 1;
        if (measure() || tries > 30) {
          window.clearInterval(poll);
          // Give up gracefully: show the card without a spotlight rather than
          // hiding the tour forever.
          setSettled(true);
        }
      }, 100);
    }

    const onResize = () => { measure(); };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      if (poll) window.clearInterval(poll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [step.target]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') finish(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function finish() {
    markSeen(uid);
    onDone();
  }

  function next() {
    if (i < STEPS.length - 1) setI(i + 1); else finish();
  }

  function back() {
    if (i > 0) setI(i - 1);
  }

  // Wait for the screen underneath to actually exist before overlaying it.
  if (!settled) return null;

  const PAD = 8;
  const spot = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null;

  // Put the card on the opposite side of the screen from the target, so the
  // thing being explained is never covered by the explanation.
  const targetIsLow = rect ? rect.top > window.innerHeight / 2 : false;

  return (
    <div className="fixed inset-0 z-[80]" dir="rtl">
      {/* Scrim with a hole punched over the target. Four panels rather than a
          blend mode — reliable on every mobile browser. */}
      {spot ? (
        <>
          <div className="absolute inset-x-0 top-0 bg-black/75" style={{ height: Math.max(0, spot.top) }} onClick={next} />
          <div className="absolute inset-x-0 bg-black/75" style={{ top: spot.top + spot.height, bottom: 0 }} onClick={next} />
          <div className="absolute bg-black/75" style={{ top: spot.top, height: spot.height, left: 0, width: Math.max(0, spot.left) }} onClick={next} />
          <div className="absolute bg-black/75" style={{ top: spot.top, height: spot.height, left: spot.left + spot.width, right: 0 }} onClick={next} />
          <div
            className="absolute rounded-2xl ring-2 ring-white/90 pointer-events-none"
            style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/75" onClick={next} />
      )}

      <div
        className="absolute inset-x-0 px-4"
        style={targetIsLow ? { top: 'calc(env(safe-area-inset-top) + 24px)' } : { bottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        <div className="max-w-lg mx-auto overlay-solid rounded-2xl border border-subtle p-4 shadow-2xl">
          <div className="flex items-center gap-1.5 mb-2">
            {STEPS.map((_, k) => (
              <span
                key={k}
                className={`h-1 rounded-full transition-all ${k === i ? 'w-5 bg-emerald-500' : 'w-1.5 bg-slate-300 dark:bg-slate-700'}`}
              />
            ))}
          </div>
          <h3 className="font-bold text-[16px] mb-1">{step.title}</h3>
          <p className="text-[13px] text-muted leading-relaxed">{step.body}</p>
          {step.showPlaces && (
            <div className="flex gap-2 mt-3">
              {PLACE_ORDER.map(id => {
                const p = PLACES[id];
                return (
                  <span key={id} className="flex-1 flex items-center gap-2 rounded-xl border border-subtle bg-subtle px-2.5 py-2">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-slate-500/15 dark:border-slate-400/15">
                      {p.mark}
                    </span>
                    <span className="text-[12px] font-bold truncate">{p.he}</span>
                  </span>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-2 mt-4">
            <button onClick={finish} className="text-[13px] text-muted px-2 py-2">דלג</button>
            <span className="flex-1" />
            {i > 0 && (
              <button
                onClick={back}
                className="px-4 py-2.5 rounded-xl bg-subtle text-muted text-[13px] font-semibold"
              >חזור</button>
            )}
            <button onClick={next} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-[13px] font-bold">
              {i < STEPS.length - 1 ? 'הבא' : 'יאללה, בוא נתחיל'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
