import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { PLACES, PLACE_ORDER, type PlaceId, type QuickAction } from '../places/registry';

// Switching between places, two ways:
//
//   • PlacePill  — visible, labelled, always in the same spot (TopBar start).
//                  Tap → PlacesSheet. Also answers "where am I?" on every screen.
//   • FAB long-press — fast, hidden. Pucks fan up from the FAB, one per other
//                  place's primary quick action. Slide onto one and release.
//
// Mental model: tap = act here, long-press = act elsewhere. Firing a quick
// action does NOT leave the current place — the modal opens on top of it.

type PlaceCtx = {
  place: PlaceId;
  openSheet: () => void;
  /** Unapproved proposals per chat bucket. The badge sits on the coach it
   *  concerns (its AI button), never on the shared place control. */
  pendingByBucket: Record<string, number>;
};

const PlaceContext = createContext<PlaceCtx | null>(null);

export function PlaceProvider({ value, children }: { value: PlaceCtx; children: React.ReactNode }) {
  return <PlaceContext.Provider value={value}>{children}</PlaceContext.Provider>;
}

export function usePlaceContext(): PlaceCtx | null {
  return useContext(PlaceContext);
}

const TINT_PILL: Record<string, string> = {
  emerald: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20',
  amber: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20',
  blue: 'bg-blue-500/12 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20',
  violet: 'bg-violet-500/12 text-violet-700 dark:text-violet-300 hover:bg-violet-500/20',
};

const TINT_SOLID: Record<string, string> = {
  emerald: 'bg-emerald-600',
  amber: 'bg-amber-500',
  blue: 'bg-blue-600',
  violet: 'bg-violet-600',
  slate: 'bg-slate-600',
};

const TINT_RING: Record<string, string> = {
  emerald: 'bg-emerald-500/12 ring-emerald-500/35 active:bg-emerald-500/25',
  amber: 'bg-amber-500/12 ring-amber-500/35 active:bg-amber-500/25',
  blue: 'bg-blue-500/12 ring-blue-500/35 active:bg-blue-500/25',
  violet: 'bg-violet-500/12 ring-violet-500/35 active:bg-violet-500/25',
};

const TINT_MARK: Record<string, string> = {
  emerald: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  blue: 'text-blue-600 dark:text-blue-400',
  violet: 'text-violet-600 dark:text-violet-400',
};

const TINT_UNDERLINE: Record<string, string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  blue: 'bg-blue-500',
  violet: 'bg-violet-500',
};

/** Sits where the TopBar's accent bar used to. Same spot on every tab page.
 *
 *  Deliberately quiet: a neutral surface, an abstract monoline mark, and a
 *  tinted underline. No emoji (loud, platform-inconsistent, reads as
 *  decoration) and no caret — a caret next to a title looks like a form
 *  control. The underline is the affordance: it reads as the active item in a
 *  set, which is exactly what a place is. */
export function PlacePill() {
  const ctx = usePlaceContext();
  if (!ctx) return null;
  const place = PLACES[ctx.place];
  return (
    <button
      onClick={ctx.openSheet}
      aria-haspopup="menu"
      aria-label={`מקום נוכחי: ${place.he} — החלף מקום`}
      title={place.he}
      className="relative shrink-0 w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden
                 border border-slate-500/15 dark:border-slate-400/15
                 bg-slate-500/[0.06] dark:bg-slate-400/[0.07]
                 active:bg-slate-500/15 dark:active:bg-slate-400/15 transition-colors"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <span className={TINT_MARK[place.tint]}>{place.mark}</span>
      {/* The affordance — an active-item underline, not an arrow. */}
      <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-[2.5px] w-5 rounded-full ${TINT_UNDERLINE[place.tint]}`} />
    </button>
  );
}

// ─── Places sheet ──────────────────────────────────────────────────

/** A place picker and nothing else.
 *
 *  Operations deliberately do NOT live here. Mixing "go somewhere" with "do
 *  something" made every row ambiguous — you couldn't tell whether tapping it
 *  moved you or acted on you. Actions belong to the long-press fan; this list
 *  answers exactly one question, so it can stay a plain, calm selection. */
export function PlacesSheet({
  current, onGo, statusFor, onClose,
}: {
  current: PlaceId;
  onGo: (place: PlaceId) => void;
  /** Live one-liner per place — the same number that place's home shows. */
  statusFor: (place: PlaceId) => string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] dark:bg-black/60 bg-black/30" onClick={onClose}>
      <div
        className="absolute right-0 left-0 mx-auto max-w-lg px-3 place-menu"
        style={{ top: 'calc(var(--top-bar-h) + 6px)' }}
        dir="rtl"
        onClick={e => e.stopPropagation()}
      >
       <div className="overlay-solid rounded-2xl border border-subtle shadow-2xl p-3">
        <div className="text-[11px] font-semibold text-muted mb-2 px-1">עבור אל</div>
        <div className="rounded-2xl border border-subtle overflow-hidden">
          {PLACE_ORDER.map((id, i) => {
            const p = PLACES[id];
            const isCurrent = id === current;
            return (
              <button
                key={id}
                onClick={() => { if (!isCurrent) onGo(id); else onClose(); }}
                className={`w-full flex items-center gap-3 px-3 py-3.5 text-right transition-colors ${
                  i > 0 ? 'border-t border-subtle' : ''
                } ${isCurrent ? 'bg-subtle' : 'active:bg-subtle'}`}
              >
                {/* Same mark as the top-bar button, so the row and the thing you
                    tapped are visibly the same object. */}
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-slate-500/15 dark:border-slate-400/15 bg-slate-500/[0.06] dark:bg-slate-400/[0.07] ${TINT_MARK[p.tint]}`}>
                  {p.mark}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-[15px]">{p.he}</span>
                  <span className="block text-[11px] text-muted truncate">{statusFor(id) || p.tagline}</span>
                </span>
                {isCurrent && (
                  <span className={`shrink-0 ${TINT_MARK[p.tint]}`}>
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
       </div>
      </div>
    </div>
  );
}

// ─── FAB long-press fan ────────────────────────────────────────────

/** Pucks arc up from the FAB — one per OTHER place's quick action, plus an
 *  escape hatch into the full sheet. Slide-and-release fires; releasing without
 *  moving leaves them up as ordinary tap targets. */
export function FabFan({
  actions, onPick, onOpenSheet, onClose,
}: {
  actions: QuickAction[];
  onPick: (a: QuickAction) => void;
  onOpenSheet: () => void;
  onClose: () => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const hoverRef = useRef<string | null>(null);
  hoverRef.current = hover;

  // Slide-to-choose: track the finger across the scrim and fire whatever puck
  // it is over when it lifts. Pointer events cover touch and mouse alike.
  useEffect(() => {
    function pick(x: number, y: number): string | null {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      return el?.closest<HTMLElement>('[data-puck]')?.dataset.puck || null;
    }
    function onMove(e: PointerEvent) { setHover(pick(e.clientX, e.clientY)); }
    function onUp(e: PointerEvent) {
      const id = pick(e.clientX, e.clientY) ?? hoverRef.current;
      if (id === '__sheet__') { onOpenSheet(); return; }
      const found = actions.find(a => a.id === id);
      if (found) onPick(found);
      // No puck under the finger → leave the fan open as tap targets.
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [actions, onPick, onOpenSheet]);

  // Strict, deterministic order: every place's quick actions in PLACE_ORDER,
  // then "all places" always last. Same sequence every time you open it, so the
  // gesture becomes muscle memory instead of a lookup.
  const ordered = PLACE_ORDER
    .flatMap(pid => actions.filter(a => a.place === pid))
    .map(a => ({ id: a.id, he: a.he, icon: a.icon, tint: PLACES[a.place].tint, action: a as QuickAction | null }));
  // No "all places" escape hatch here: switching place already has one clear
  // home (the top-bar control), and a second route made the fan ambiguous —
  // half navigation, half action. The fan is quick actions, full stop.
  const items = ordered;

  // Uniform circular pucks on an even, symmetric arc, label underneath.
  //
  // Geometry matters more than styling here. The origin is the FAB's CENTRE and
  // the radius clears it with room to spare (FAB r=32 + puck r=27 = 59 minimum),
  // so the fan opens clearly ABOVE the button instead of sitting on top of it.
  // The arc stays narrow so the pucks read as "up from here", not "beside it".
  const n = items.length;
  const R = 168;
  const SPAN = Math.min(76, 38 * (n - 1)); // narrow arc → canopy, not a sideways spread
  const angleAt = (i: number) => (n === 1 ? -90 : -90 + SPAN / 2 - (SPAN / (n - 1)) * i);

  return (
    <div className="fixed inset-0 z-[55] dark:bg-black/70 bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      {/* Origin = FAB centre: tab row (56) − FAB rise (28) + half FAB (32). */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 60px)' }}>
        {items.map((it, i) => {
          // i=0 sits at the RIGHT end of the arc — RTL reading order.
          const rad = (angleAt(i) * Math.PI) / 180;
          const dx = Math.cos(rad) * R;
          const dy = Math.sin(rad) * R;
          const active = hover === it.id;
          const isSheet = it.id === '__sheet__';
          return (
            <button
              key={it.id}
              data-puck={it.id}
              onClick={(e) => {
                e.stopPropagation();
                if (it.action) onPick(it.action); else onOpenSheet();
              }}
              className="absolute flex flex-col items-center gap-1.5 fan-puck"
              style={{
                transform: `translate(calc(-50% + ${dx}px), calc(50% + ${dy}px))`,
                animationDelay: `${i * 40}ms`,
              }}
            >
              <span
                className={`w-[54px] h-[54px] rounded-full flex items-center justify-center text-white shadow-xl transition-transform ${
                  isSheet ? 'bg-slate-600' : TINT_SOLID[it.tint]
                } ${active ? 'scale-110 ring-4 ring-white/40' : ''}`}
              >
                {it.icon
                  ? <span className="[&>svg]:w-6 [&>svg]:h-6">{it.icon}</span>
                  : <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
                      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
                      <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
                    </svg>}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-bold whitespace-nowrap">
                {it.he}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
