import type { Route } from '../types';

// ─── Places ────────────────────────────────────────────────────────
//
// The app is a shell that hosts N places. Every place has the identical
// skeleton — TopBar, four tabs, one big centre action — and differs only in
// domain, colour, and what those five things do.
//
//   dashboard · past · [do it] · analytics · library
//
// A user who learned אימונים already knows תזונה. Adding a third place
// (נשימה) is one entry here plus its arm in AppShell's content switch — no
// chrome work.
//
// `place` is DERIVED from the page id rather than carried on the Route. Page
// ids are unique across places, so every existing `navigate({ page: 'home' })`
// call site keeps working untouched.

export type PlaceId = 'exercise' | 'food';

/** Matches TopBar's tint prop — accent colour IS the place identity. */
export type TintColor = 'emerald' | 'blue' | 'violet' | 'amber';

export type PlaceTab = {
  page: Route['page'];
  he: string;
  icon: JSX.Element;
};

export type QuickAction = {
  id: string;
  he: string;
  place: PlaceId;
  icon: JSX.Element;
};

export type Place = {
  id: PlaceId;
  he: string;
  /** The place's mark in the top bar: an abstract monoline glyph, not a
   *  pictogram. Quiet enough to sit next to a title without shouting. */
  mark: JSX.Element;
  /** One-line pitch on the places sheet. */
  tagline: string;
  tint: TintColor;
  icon: JSX.Element;
  defaultPage: Route['page'];
  /** Exactly four: two right of the FAB, two left. */
  tabs: [PlaceTab, PlaceTab, PlaceTab, PlaceTab];
  /** Page the settings gear opens within this place. */
  settingsPage: Route['page'];
  quickActions: QuickAction[];
};

// ─── Icons (stroke-only, same family as the TabBar set) ────────────

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
    </svg>
  );
}
function IconHistory() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconDumbbell() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5v11M4 9v6M17.5 6.5v11M20 9v6M6.5 12h11" />
    </svg>
  );
}
function IconBody() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4.5" r="2.2" />
      <path d="M8 21v-6l-2-3V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4l-2 3v6" />
      <path d="M10 12h4" />
    </svg>
  );
}
function IconPlate() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
    </svg>
  );
}
function IconSpark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20l6-6" />
      <path d="M14 4l1.4 3.6L19 9l-3.6 1.4L14 14l-1.4-3.6L9 9l3.6-1.4z" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}
function IconBook() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2z" />
      <path d="M9 3v18" />
    </svg>
  );
}
export function IconBolt() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
      <path d="M13 2 L4 14 h6 l-2 8 l10 -13 h-6 z" />
    </svg>
  );
}
export function IconPlay() {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
}
export function IconFork() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3v7a2 2 0 0 0 4 0V3M9 12v9" />
      <path d="M16 3c-1.5 1.5-2 3-2 5s.5 2.5 2 2.5h1V3z" />
      <path d="M17 10.5V21" />
    </svg>
  );
}

// ─── Place marks ───────────────────────────────────────────────────
// Abstract, monoline, one weight. Not emoji: emoji are loud, inconsistent
// across platforms, and read as decoration. These read as identity.

function MarkBar() {
  // Abstract bar-and-plates — a horizontal axis between two weights.
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M4 12h16" />
      <path d="M7 8.5v7M17 8.5v7" />
    </svg>
  );
}

function MarkPlate() {
  // Abstract plate — a ring with an inner arc, off-centre.
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5a4.5 4.5 0 0 1 0 9" />
    </svg>
  );
}

// ─── The registry ──────────────────────────────────────────────────

export const PLACES: Record<PlaceId, Place> = {
  exercise: {
    id: 'exercise',
    he: 'אימונים',
    mark: <MarkBar />,
    tagline: 'סטים, אירובי ויעדים שבועיים',
    tint: 'emerald',
    icon: <IconDumbbell />,
    defaultPage: 'home',
    settingsPage: 'settings',
    tabs: [
      { page: 'home', he: 'בית', icon: <IconHome /> },
      { page: 'history', he: 'היסטוריה', icon: <IconHistory /> },
      { page: 'body', he: 'גוף', icon: <IconBody /> },
      { page: 'exercises', he: 'תרגילים', icon: <IconDumbbell /> },
    ],
    quickActions: [
      { id: 'exercise:start', he: 'התחל אימון', place: 'exercise', icon: <IconBolt /> },
    ],
  },
  food: {
    id: 'food',
    he: 'תזונה',
    mark: <MarkPlate />,
    tagline: 'מאזן קלורי ושליטה בדחפים',
    tint: 'amber',
    icon: <IconPlate />,
    defaultPage: 'food-today',
    settingsPage: 'food-settings',
    tabs: [
      { page: 'food-today', he: 'היום', icon: <IconHome /> },
      { page: 'food-history', he: 'היסטוריה', icon: <IconHistory /> },
      { page: 'food-insights', he: 'קלוריות', icon: <IconChart /> },
      { page: 'food-meals', he: 'מאכלים', icon: <IconBook /> },
    ],
    // 'שאל את המאמן' lands with the dietary coach — no dead buttons until then.
    quickActions: [
      { id: 'food:add-meal', he: '+ ארוחה', place: 'food', icon: <IconFork /> },
    ],
  },
};

export const PLACE_ORDER: PlaceId[] = ['exercise', 'food'];

// Page → place. The single source of truth for which place a route belongs to.
const PAGE_PLACE: Partial<Record<Route['page'], PlaceId>> = {
  home: 'exercise',
  history: 'exercise',
  body: 'exercise',
  exercises: 'exercise',
  settings: 'exercise',
  session: 'exercise',
  'session-view': 'exercise',
  install: 'exercise',
  'food-today': 'food',
  'food-history': 'food',
  'food-insights': 'food',
  'food-meals': 'food',
  'food-settings': 'food',
};

export function placeOf(page: Route['page']): PlaceId {
  return PAGE_PLACE[page] || 'exercise';
}

/** Tab pages per place — these are the only pages that show chrome. */
export const TAB_PAGES = new Set<string>([
  ...PLACES.exercise.tabs.map(t => t.page),
  PLACES.exercise.settingsPage,
  ...PLACES.food.tabs.map(t => t.page),
  PLACES.food.settingsPage,
]);

// Where a place resumes when you switch back into it. Persisted so bouncing
// between places doesn't dump you on the dashboard every time.
function lastPageKey(place: PlaceId): string { return `place:lastPage:${place}`; }

export function rememberPage(page: Route['page']): void {
  const place = placeOf(page);
  const isTab = PLACES[place].tabs.some(t => t.page === page);
  if (!isTab) return;
  try { localStorage.setItem(lastPageKey(place), page); } catch { /* ignore */ }
}

export function entryPageFor(place: PlaceId): Route['page'] {
  try {
    const saved = localStorage.getItem(lastPageKey(place));
    if (saved && PLACES[place].tabs.some(t => t.page === saved)) {
      return saved as Route['page'];
    }
  } catch { /* ignore */ }
  return PLACES[place].defaultPage;
}
