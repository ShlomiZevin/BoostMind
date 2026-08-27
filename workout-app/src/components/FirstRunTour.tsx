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

const SHELL_STEPS: Step[] = [
  {
    target: 'place',
    title: 'הלוגו הירוק בפינה הוא הכפתור למעבר בין המקומות',
    body: 'Wholos זו אפליקציה אחת עם כמה מקומות. עכשיו אתה בתוך מצב אימון, ולחיצה על הלוגו בפינה פותחת את הרשימה ומעבירה גם למצב תזונה (ובהמשך גם נשימה, שינה ועוד). הכפתור הזה תמיד באותה פינה — אל תפספס.',
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
  {
    target: 'settings',
    title: 'התקנה, ואיך מדברים איתנו',
    body: 'ההגדרות פה למעלה. בפנים יש "התקנה למסך הבית" עם הוראות ל-iPhone ול-Android — פעם אחת, ו-Wholos נפתחת אצלך כמו כל אפליקציה. שם גם "צור קשר": אם משהו נתקע, לא ברור, או שיש לך רעיון — כותבים לנו ישירות בוואטסאפ או במייל.',
  },
];

/** Entering מצב תזונה for the first time is its own first run: the place has
 *  its own button, its own coach and its own numbers, and none of that is
 *  explained by the shell tour the user saw on day one. Same rule as the shell
 *  tour — name only what is invisible, three cards, once. */
const FOOD_STEPS: Step[] = [
  {
    target: 'fab',
    title: 'כפתור אחד, ארוחה נכנסת',
    body: 'לחיצה פותחת רישום ארוחה — ידנית מהמאגר שלך, או בשיחה. אומרים ״אכלתי פיתה עם חביתה״ והמערכת מפרקת את זה לרכיבים ולקלוריות.',
  },
  {
    target: 'ai',
    title: 'המאמן התזונתי',
    body: 'הוא רואה מה אכלת היום, באיזו שעה, ומה נשרף באימון. אפשר לשאול אותו מה נשאר לך להיום, מה לאכול בערב, או לבקש שיתאים לך את היעד.',
  },
  {
    target: 'tab-food-insights',
    title: 'כאן רואים את הגירעון',
    body: 'קלוריות מראה את המגמה לאורך זמן — כמה נאכל, כמה נשרף, וכמה גירעון הצטבר. שם גם מגדירים את פרופיל התזונה ואת היעד היומי.',
  },
];

export type TourId = 'shell' | 'food';

const TOURS: Record<TourId, Step[]> = { shell: SHELL_STEPS, food: FOOD_STEPS };

// Bumped when the install step was added so existing users see the tour once
// more and pick up the new card. Keeping the string as `tourSeen:v2:` makes
// each future addition a one-character change here.
const KEY_PREFIX = 'tourSeen:v2:';

/** Shell keeps the bare key it has always used, so an account that already
 *  finished that tour is not shown it again just because tours became plural. */
function keyFor(uid: string, tour: TourId): string {
  return tour === 'shell' ? KEY_PREFIX + uid : `${KEY_PREFIX}${uid}:${tour}`;
}

export function hasSeenTour(uid: string, tour: TourId = 'shell'): boolean {
  try { return localStorage.getItem(keyFor(uid, tour)) === '1'; } catch { return true; }
}

function markSeen(uid: string, tour: TourId): void {
  try { localStorage.setItem(keyFor(uid, tour), '1'); } catch { /* private mode */ }
}

/** Event the shell listens for, so Settings can replay the tour without a
 *  reload. Per-screen tours will reuse this same hook later. */
export const TOUR_RESTART_EVENT = 'tour:restart';

export function restartTour(uid: string, tour: TourId = 'shell'): void {
  try { localStorage.removeItem(keyFor(uid, tour)); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(TOUR_RESTART_EVENT, { detail: { tour } }));
}

type Rect = { top: number; left: number; width: number; height: number };

export function FirstRunTour({ uid, tour = 'shell', onDone }: { uid: string; tour?: TourId; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  // Stays false until the first target is found (or we give up waiting). A new
  // user finishes the onboarding chat and lands on a Home screen that is still
  // fetching — opening the tour over that shows a card pointing at nothing.
  const [settled, setSettled] = useState(false);
  const steps = TOURS[tour];
  const step = steps[i];

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
    markSeen(uid, tour);
    onDone();
  }

  function next() {
    if (i < steps.length - 1) setI(i + 1); else finish();
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
      {/* Scrim with a rounded hole punched over the target. Single element
          with a huge box-shadow spread — the shadow follows the border-radius
          so the hole itself is rounded, not just an inner ring hanging inside
          a square gap. Previously used 4 flat rectangles + a rounded ring,
          which showed the darkened corners peeking through and looked like
          two overlapping shapes. */}
      {spot ? (
        <>
          <div className="absolute inset-0" onClick={next} />
          <div
            className="absolute rounded-2xl ring-2 ring-white/90 pointer-events-none"
            style={{
              top: spot.top,
              left: spot.left,
              width: spot.width,
              height: spot.height,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.75)',
            }}
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
            {steps.map((_, k) => (
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
              {i < steps.length - 1 ? 'הבא' : 'יאללה, בוא נתחיל'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
