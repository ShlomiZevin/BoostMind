import { useState, useEffect, useMemo, useRef } from 'react';
import type { Route, FreeSession as FreeSessionType, MealLog, PersonalMeal, UserProfile } from './types';
import { useAuth } from './hooks/useAuth';
import { useFirestore } from './hooks/useFirestore';
import { FreeHome } from './components/FreeHome';
import { FreeSession } from './components/FreeSession';
import { FreeHistory } from './components/FreeHistory';
import { Settings } from './components/Settings';
import { Exercises } from './components/Exercises';
import { Body } from './components/Body';
import { Install } from './components/Install';
import { LoginScreen } from './components/LoginScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { TabBar } from './components/TabBar';
import { StartSessionModal } from './components/StartSessionModal';
import { Chronograph } from './components/Chronograph';
import { LiveSessionBadge } from './components/LiveSessionBadge';
import { useTimer } from './hooks/useTimer';
import { useStandaloneStopwatch } from './hooks/useStandaloneStopwatch';
import { useAiTrainerPanel } from './hooks/useAiTrainerPanel';
import { AiChatPanel } from './components/AiChatPanel';
import { useChatNotifier } from './hooks/useChatNotifier';
import { useAnyChatOpen } from './hooks/useAnyChatOpen';
import { FoodToday } from './components/FoodToday';
import { FoodHistory } from './components/FoodHistory';
import { FoodInsights } from './components/FoodInsights';
import { FoodMeals } from './components/FoodMeals';
import { FoodSettings } from './components/FoodSettings';
import { LogMealModal } from './components/LogMealModal';
import type { MealDraft } from './components/AiChatPanel';
import {
  OPEN_ONBOARDING_CHAT_EVENT,
  foodOnboardingThreadId,
  trainerOnboardingThreadId,
  type OpenOnboardingChatDetail,
} from './components/AiChatPanel';
import { FabFan, PlaceProvider, PlacesSheet } from './components/PlaceSwitcher';
import { FirstRunTour, TOUR_RESTART_EVENT, hasSeenTour, type TourId } from './components/FirstRunTour';
import { TrialExpired, TrialStrip } from './components/TrialGate';
import { useTrial } from './hooks/useTrial';
import { STRIP_FROM_DAYS_USED, TRIAL_INDICATOR, TRIAL_STRIP_H, waLink, type TrialState } from './config/access';

/** The account that owns this app. Never trial-gated, sees the admin surfaces. */
const OWNER_UID = 'user_6724';
import { ReportsPanel } from './components/ReportsPanel';
import { AdminPage } from './components/AdminPage';
import { ReportsAdminPage } from './components/ReportsAdminPage';
import { UsersAdminPage } from './components/UsersAdminPage';
import { AdminDesktopPage } from './components/AdminDesktopPage';
import { CoachDashboard } from './components/CoachDashboard';
import { CoachInvitePage } from './components/CoachInvitePage';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './config/firebase';
import { ImpersonationCtx } from './hooks/useImpersonation';
import { isCoacherEmail } from './config/coaches';
import { isBetaTesterEmail } from './config/betaTesters';
import {
  PLACES, TAB_PAGES, entryPageFor, placeOf, rememberPage, type PlaceId,
} from './places/registry';
import type { QuickAction } from './places/registry';
import type { MuscleGroup } from './data/muscles';
import { ACTIVE_MUSCLES } from './data/muscles';
import { caloriesOn, estimateBurn, mealTypeForNow, pickMeals, startOfDay } from './data/diet';
import { cacheAiModel, isValidAiModel } from './config/aiModel';

// Hash → route. Page ids are unique across places, so the place is derived
// (placeOf) rather than encoded twice.
const FOOD_HASH: Record<string, Route['page']> = {
  '/food/today': 'food-today',
  '/food/history': 'food-history',
  '/food/insights': 'food-insights',
  '/food/meals': 'food-meals',
  '/food/settings': 'food-settings',
};

function parseHash(): Route {
  let hash = window.location.hash.slice(1);
  // Accept the explicit place-prefixed form for אימונים too, so #/exercise/home
  // and the legacy #/home are the same route. Old bookmarks keep working.
  hash = hash.replace(/^\/exercise(?=\/|$)/, '');
  const food = FOOD_HASH[hash];
  if (food) return { page: food } as Route;
  if (!hash || hash === '/' || hash === '/home') return { page: 'home' };
  if (hash === '/history') return { page: 'history' };
  if (hash === '/settings') return { page: 'settings' };
  if (hash === '/exercises') return { page: 'exercises' };
  if (hash === '/body') return { page: 'body' };
  if (hash === '/install') return { page: 'install' };
  if (hash === '/admin') return { page: 'admin' };
  if (hash === '/reports-admin') return { page: 'reports-admin' };
  if (hash === '/users-admin') return { page: 'users-admin' };
  if (hash === '/admin-desktop') return { page: 'admin-desktop' };
  if (hash === '/coach') return { page: 'coach' };
  if (hash.startsWith('/coach/view/')) {
    const traineeUid = hash.slice('/coach/view/'.length);
    if (traineeUid) return { page: 'coach-view', traineeUid };
  }
  if (hash.startsWith('/coach/invite/')) {
    const coachUid = hash.slice('/coach/invite/'.length);
    if (coachUid) return { page: 'coach-invite', coachUid };
  }
  if (hash.startsWith('/session-view/')) {
    return { page: 'session-view', sessionId: hash.split('/')[2] };
  }
  if (hash.startsWith('/session/')) {
    return { page: 'session', sessionId: hash.split('/')[2] };
  }
  return { page: 'home' };
}

function routeToHash(route: Route): string {
  switch (route.page) {
    case 'home': return '#/';
    case 'history': return '#/history';
    case 'settings': return '#/settings';
    case 'exercises': return '#/exercises';
    case 'body': return '#/body';
    case 'install': return '#/install';
    case 'admin': return '#/admin';
    case 'reports-admin': return '#/reports-admin';
    case 'users-admin': return '#/users-admin';
    case 'admin-desktop': return '#/admin-desktop';
    case 'coach': return '#/coach';
    case 'coach-view': return `#/coach/view/${route.traineeUid}`;
    case 'coach-invite': return `#/coach/invite/${route.coachUid}`;
    case 'session': return `#/session/${route.sessionId}`;
    case 'session-view': return `#/session-view/${route.sessionId}`;
    case 'food-today': return '#/food/today';
    case 'food-history': return '#/food/history';
    case 'food-insights': return '#/food/insights';
    case 'food-meals': return '#/food/meals';
    case 'food-settings': return '#/food/settings';
  }
}

function AppShell({ uid, route, navigate, doLogout, trial, impersonation }: {
  uid: string;
  route: Route;
  navigate: (r: Route) => void;
  doLogout: () => void;
  trial: TrialState;
  // When present, the app is being rendered as SOMEONE ELSE — a coach viewing
  // a trainee. `uid` is already the trainee's uid; this carries the extra
  // context (coach's own uid + trainee display info) so the shell can render
  // the "you are viewing as X" banner and hide the chat entry points.
  impersonation?: {
    coachAuthUid: string;
    traineeEmail?: string | null;
    traineeName?: string | null;
  };
}) {
  const firestore = useFirestore(uid);
  const isImpersonating = !!impersonation;
  const [inProgress, setInProgress] = useState<FreeSessionType | null>(null);
  const [allSessions, setAllSessions] = useState<FreeSessionType[]>([]);
  const [showStart, setShowStart] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  // Owner-only surfaces (admin dashboard, reports shortcut, model picker).
  // Both checks — the aliased app uid and the raw email — so that even if
  // EMAIL_TO_UID drifts, the gate keeps holding for shlomi@boostart.io only.
  const { email: authEmail, displayName } = useAuth();
  const isAdmin = uid === 'user_6724' || authEmail === 'shlomi@boostart.io';
  // Coaches AND beta testers get the double-click-anywhere reports shortcut —
  // filing bugs from wherever they saw them is the whole point of beta.
  // Admin/coacher/beta all reach the same panel (view is scoped inside).
  const canOpenReports = isAdmin || isCoacherEmail(authEmail) || isBetaTesterEmail(authEmail);

  // Double-click shortcut — opens the bug/feature reports panel from
  // anywhere in the app. Reason (rep_1787310001832_4jel): the entry buried in
  // Settings is easy to lose track of; catching double-clicks globally lets me
  // file a report the moment I see the thing, without leaving the screen.
  // Available to admins AND coaches (Sergio et al.).
  useEffect(() => {
    if (!canOpenReports) return;
    function onDblClick(e: MouseEvent) {
      // Skip when the double-click landed on an editable target — otherwise
      // double-clicking to select a word in an input would pop the modal.
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A') return;
        if (t.isContentEditable) return;
        if (t.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
      }
      setReportsOpen(true);
    }
    window.addEventListener('dblclick', onDblClick);
    return () => window.removeEventListener('dblclick', onDblClick);
  }, [canOpenReports]);

  const place = placeOf(route.page);
  const isTabPage = TAB_PAGES.has(route.page);

  // The strip is sticky ABOVE the top bar, so everything else that pins — the
  // top bar itself and every `top: var(--top-bar-h)` section header — has to
  // move down by its height. Publishing it as a CSS variable does that in one
  // place instead of at twelve call sites. 0px when there is no strip.
  // Dismissal is keyed to today's date, so closing the strip silences it for
  // the rest of the day and it returns tomorrow. Stored per uid so two accounts
  // on one device do not share the state.
  const todayKey = new Date().toLocaleDateString('en-CA');
  const dismissKey = `trialStripHidden:${uid}:${todayKey}`;
  const [stripHidden, setStripHidden] = useState(() => {
    try { return localStorage.getItem(dismissKey) === '1'; } catch { return false; }
  });
  function hideStripForToday() {
    try { localStorage.setItem(dismissKey, '1'); } catch { /* private mode */ }
    setStripHidden(true);
  }

  const showStrip =
    TRIAL_INDICATOR === 'strip'
    && trial.status === 'active'
    // Not in the first days: a countdown is noise to someone still working out
    // what the app is. The dot on the gear carries the reminder until then.
    && trial.daysUsed >= STRIP_FROM_DAYS_USED
    && !stripHidden;

  useEffect(() => {
    document.documentElement.style.setProperty('--trial-strip-h', showStrip ? `${TRIAL_STRIP_H}px` : '0px');
    return () => { document.documentElement.style.setProperty('--trial-strip-h', '0px'); };
  }, [showStrip]);

  // Pull the model override down once per session so request bodies — which are
  // built synchronously — can read it without an await.
  useEffect(() => {
    firestore.getAiModelPref()
      .then(v => cacheAiModel(isValidAiModel(v) ? v : undefined))
      .catch(() => { /* keep whatever is cached */ });
  }, [uid]);

  // Remember the last tab per place so switching back resumes where you were.
  useEffect(() => { rememberPage(route.page); }, [route.page]);

  // Poll for session state whenever route changes to a tab page.
  useEffect(() => {
    if (!isTabPage) return;
    (async () => {
      const list = await firestore.getFreeSessions();
      setAllSessions(list);
      // "In progress" means genuinely started — planned sessions are NOT in-progress
      // (they live only on Home until the user hits "התחל").
      setInProgress(list.find(s => s.status === 'active') || null);
    })();
  }, [route, uid]);

  // ─── Food ────────────────────────────────────────────────────────
  // Bumping this key is how a save anywhere (modal, quick action) tells the
  // food tabs to refetch.
  const [mealRefresh, setMealRefresh] = useState(0);
  const [showLogMeal, setShowLogMeal] = useState(false);
  const [mealDraft, setMealDraft] = useState<MealDraft | null>(null);
  const [foodChatOpen, setFoodChatOpen] = useState(false);
  const [todayMeals, setTodayMeals] = useState<MealLog[]>([]);
  const [personalMeals, setPersonalMeals] = useState<PersonalMeal[]>([]);
  const [profile, setProfile] = useState<UserProfile>({});
  // Guards the food-chat auto-open effect from firing before the profile has
  // actually loaded — otherwise a first-render race lets it open the panel
  // BEFORE profile.diet.foodOnboardingCompletedAt has a chance to arrive from
  // Firestore, so a returning user gets ambushed by the greeting on every
  // refresh (rep_1787562339376_nf2v).
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    if (!isTabPage) return;
    firestore.getMealLogs(startOfDay())
      .then(setTodayMeals)
      .catch(() => { /* nothing logged yet */ });
  }, [route, uid, mealRefresh]);

  // The coach needs the meal library and the profile. Only fetched once the
  // user is actually in תזונה or has opened the chat — אימונים pays nothing.
  useEffect(() => {
    if (place !== 'food' && !foodChatOpen) return;
    firestore.listPersonalMeals().then(setPersonalMeals).catch(() => { /* empty */ });
    firestore.getUserProfile()
      .then(p => { setProfile(p); setProfileLoaded(true); })
      .catch(() => { setProfileLoaded(true); /* new user, but we've probed */ });
  }, [place, foodChatOpen, uid, mealRefresh]);

  const todayBurn = useMemo(() => {
    const start = startOfDay();
    return estimateBurn(allSessions.filter(s => (s.completedAt || s.date) >= start), profile.diet?.weightKg);
  }, [allSessions, profile.diet?.weightKg]);

  async function addMealFromChat(d: MealDraft) {
    await firestore.logMeal({
      mealId: d.mealId,
      he: d.he,
      mealType: d.mealType,
      caloriesPerServing: d.calories,
      servings: 1,
      ingredients: d.ingredients,
      macros: d.macros,
      flags: d.flags,
    });
    setMealRefresh(k => k + 1);
  }

  // ─── Place switching ─────────────────────────────────────────────
  // One-time orientation. Only the three things you cannot discover by
  // looking: the place switcher, the coach, and the long-press.
  // `null` = no tour running. Which tour matters now that there are two: the
  // shell tour on first login, and a separate one the first time the user walks
  // into מצב תזונה, which has its own button, coach and numbers.
  const [tour, setTour] = useState<TourId | null>(() => (hasSeenTour(uid) ? null : 'shell'));

  // (removed) The old tourRanThisMount guard was too aggressive — it fired on
  // the first tour of the session and never reset, so after the shell tour
  // ran on first login, the food tour was permanently blocked in the same
  // mount. rep_1787562339376_nf2v surfaced this. Guarding on `tour !== null`
  // (below) is enough: a fresh mount that lands directly on a תזונה tab
  // still sees shell tour first (queued by useState initializer), and the
  // food tour effect exits early because a tour is already active.

  // Marker: the food coach's first-run "let's build a diet profile" chat is
  // active RIGHT NOW. Blocks the food tour from firing on top of the chat and
  // suppresses re-entries while the modal is up. Cleared once the user
  // either finishes the chat or taps "דלג לעכשיו".
  const [foodOnboardingActive, setFoodOnboardingActive] = useState(false);

  // First arrival at תזונה gets the coach, not the tabs. This mirrors what
  // happens on first login for אימונים (a full-screen chat) — a place with its
  // own numbers earns its own greeting so the user knows they can just talk
  // instead of hunting for buttons. Marked complete on close, so it fires
  // exactly once per user. The food tour then follows on the next entry.
  //
  // profileLoaded is load-bearing: without it, the first render on food-today
  // fires this effect before Firestore has answered, sees profile as {} and
  // opens the chat even for returning users (rep_1787562339376_nf2v).
  useEffect(() => {
    if (place !== 'food' || !isTabPage) return;
    if (foodOnboardingActive || foodChatOpen) return;
    if (!profileLoaded) return;
    if (profile.diet?.foodOnboardingCompletedAt) return;
    setFoodOnboardingActive(true);
    setFoodChatOpen(true);
  }, [place, isTabPage, profileLoaded, profile.diet?.foodOnboardingCompletedAt, foodOnboardingActive, foodChatOpen]);

  // Entering תזונה for the first time. Deliberately checked on every route
  // change rather than once on mount, because the user arrives here later —
  // days after the shell tour — via the place switcher or a quick action.
  useEffect(() => {
    if (place !== 'food' || !isTabPage) return;
    if (tour !== null) return;
    if (hasSeenTour(uid, 'food')) return;
    // The greeting-chat OWNS the first visit. Only after it closes does the
    // food tour get its turn — otherwise the user meets an overlay AND a coach
    // window at the same time and neither reads cleanly. Also gated on
    // profileLoaded: firing "!completedAt" before we know is a false positive.
    if (!profileLoaded) return;
    if (foodOnboardingActive || foodChatOpen) return;
    if (!profile.diet?.foodOnboardingCompletedAt) return;
    setTour('food');
  }, [place, isTabPage, uid, tour, profileLoaded, foodOnboardingActive, foodChatOpen, profile.diet?.foodOnboardingCompletedAt]);

  // Replayed from Settings. The shell tour's targets live on Home, so go there
  // first; a place tour is replayed wherever its own place is.
  useEffect(() => {
    function onRestart(e: Event) {
      const which = ((e as CustomEvent).detail?.tour as TourId) || 'shell';
      // Both replays are fired from a settings screen, which is not a tab page —
      // and the tour only renders on tab pages, where its targets live. So each
      // one navigates to its own home first, or the card would never appear.
      navigate({ page: which === 'food' ? 'food-today' : 'home' });
      setTour(which);
    }
    window.addEventListener(TOUR_RESTART_EVENT, onRestart);
    return () => window.removeEventListener(TOUR_RESTART_EVENT, onRestart);
  }, []);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [fanOpen, setFanOpen] = useState(false);

  function goToPlace(next: PlaceId) {
    setSheetOpen(false);
    setFanOpen(false);
    navigate({ page: entryPageFor(next) } as Route);
  }

  // Quick actions never leave the current place — the modal opens on top.
  function runQuickAction(a: QuickAction) {
    setSheetOpen(false);
    setFanOpen(false);
    if (isImpersonating) {
      // window.alert — scope has a local `alert` from useChatNotifier
      window.alert('אתה בתצוגה של המתאמן. אי אפשר לרשום עבורו — הפעולה שמורה למתאמן.');
      return;
    }
    if (a.id === 'food:add-meal') { setShowLogMeal(true); return; }
    if (a.id === 'exercise:start') { void handleFabClick(); return; }
  }

  const otherPlaceActions = useMemo(
    () => Object.values(PLACES).filter(p => p.id !== place).flatMap(p => p.quickActions),
    [place],
  );

  // Weekly-sets and suggestions for StartSessionModal
  const weeklySets = useMemo(() => {
    const weekStart = (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - d.getDay());
      return d.getTime();
    })();
    const counts: Partial<Record<MuscleGroup, number>> = {};
    for (const sess of allSessions) {
      if (sess.date < weekStart) continue;
      for (const set of sess.sets) counts[set.muscle] = (counts[set.muscle] || 0) + 1;
    }
    return counts;
  }, [allSessions]);

  const suggested = useMemo(() => {
    const sorted = ACTIVE_MUSCLES
      .map(m => ({ id: m.id, done: weeklySets[m.id] || 0 }))
      .sort((a, b) => a.done - b.done);
    return sorted.slice(0, 4).map(x => x.id);
  }, [weeklySets]);

  // Muscles trained EXACTLY 7 days ago (± 12h) — great "same day last week" cue
  const lastWeekMuscles = useMemo(() => {
    const now = new Date();
    const target = now.getTime() - 7 * 86_400_000;
    const window = 12 * 3600_000;
    const found = new Set<MuscleGroup>();
    for (const sess of allSessions) {
      if (Math.abs(sess.date - target) > window) continue;
      for (const s of sess.sets) {
        if (s.weight > 0 || s.reps > 0) found.add(s.muscle);
      }
    }
    return found;
  }, [allSessions]);

  // Muscles trained in the last 24-48h — heads up so you don't hit them again too soon
  const recentMuscles = useMemo(() => {
    const cutoff = Date.now() - 48 * 3600_000;
    const found = new Set<MuscleGroup>();
    for (const sess of allSessions) {
      if (sess.date < cutoff) continue;
      for (const s of sess.sets) {
        if (s.weight > 0 || s.reps > 0) found.add(s.muscle);
      }
    }
    return found;
  }, [allSessions]);

  // Timestamp of the MOST-RECENT real set per muscle across all history.
  const lastTrainedByMuscle = useMemo(() => {
    const map: Partial<Record<MuscleGroup, number>> = {};
    for (const sess of allSessions) {
      for (const s of sess.sets) {
        if (s.weight === 0 && s.reps === 0) continue;
        const ts = s.timestamp || sess.date;
        const prev = map[s.muscle];
        if (prev === undefined || ts > prev) map[s.muscle] = ts;
      }
    }
    return map;
  }, [allSessions]);

  // If a completed session for TODAY exists, offer to return to it rather than starting a new one.
  const todaysCompleted = useMemo(() => {
    const start = startOfDay();
    const end = start + 86_400_000;
    return allSessions.find(s => s.status === 'completed' && (s.completedAt || s.date) >= start && (s.completedAt || s.date) < end) || null;
  }, [allSessions]);
  const [sameDayPrompt, setSameDayPrompt] = useState(false);

  async function handleFabClick() {
    // Coach viewing trainee — the FAB is a trainee-only action (start a
    // session, log a meal). Toast + bail so the coach doesn't accidentally
    // log for the trainee.
    if (isImpersonating) {
      window.alert('אתה בתצוגה של המתאמן. פעולות שמתאמן עושה עליו לעשות בעצמו — אבל אתה יכול להוסיף לו תרגילים / ארוחות / תוכניות דרך המסכים הרגילים.');
      return;
    }
    // In תזונה the centre action logs a meal.
    if (place === 'food') { setShowLogMeal(true); return; }
    // Re-fetch before deciding. Local `inProgress` can be stale — e.g. Home just deleted the
    // active session and App's state hasn't been re-polled (poll is on route-change only).
    // Without this we'd navigate to a deleted session and hit "session not found".
    const list = await firestore.getFreeSessions();
    setAllSessions(list);
    const freshActive = list.find(s => s.status === 'active') || null;
    setInProgress(freshActive);
    if (freshActive) {
      navigate({ page: 'session', sessionId: freshActive.id });
      return;
    }
    const start = startOfDay();
    const end = start + 86_400_000;
    const freshDoneToday = list.find(s => s.status === 'completed' && (s.completedAt || s.date) >= start && (s.completedAt || s.date) < end) || null;
    if (freshDoneToday) {
      setSameDayPrompt(true);
      return;
    }
    setShowStart(true);
  }

  async function handleStart(muscles: MuscleGroup[]) {
    setShowStart(false);
    const id = await firestore.createFreeSession(muscles);
    navigate({ page: 'session', sessionId: id });
  }

  async function handleReturnToTodays() {
    if (!todaysCompleted) return;
    setSameDayPrompt(false);
    await firestore.reactivateFreeSession(todaysCompleted.id);
    navigate({ page: 'session', sessionId: todaysCompleted.id });
  }

  // Standalone stopwatch — controlled by the TopBar toggle. Auto-hides during live sessions
  // (FreeSession renders its own Chronograph then).
  const { open: stopwatchOpen, set: setStopwatchOpen } = useStandaloneStopwatch();
  const standaloneTimer = useTimer();
  const showStandaloneStopwatch = stopwatchOpen && !inProgress && isTabPage && place === 'exercise';

  // AI trainer panel — opened from the TopBar action on any tab page.
  const { open: aiPanelOpen, openPanel: openAiPanel, closePanel: closeAiPanel } = useAiTrainerPanel();

  // When the panel is opened via the "שיחת היכרות" shortcut (Settings), we pin
  // it to the canonical onboarding thread instead of the usual "latest today"
  // pick. Cleared on close so a subsequent normal open goes back to default.
  const [aiPanelFixedThread, setAiPanelFixedThread] = useState<string | null>(null);
  const [foodChatFixedThread, setFoodChatFixedThread] = useState<string | null>(null);
  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<OpenOnboardingChatDetail>).detail;
      const bucket = detail?.bucket;
      if (bucket === 'dietary') {
        setFoodChatFixedThread(foodOnboardingThreadId(uid));
        setFoodChatOpen(true);
        // Land the user on a food tab so context (todayMeals, dietProfile) is
        // fetched — the fetch effect is gated on `place === 'food'`.
        if (place !== 'food') navigate({ page: 'food-today' });
      } else {
        setAiPanelFixedThread(trainerOnboardingThreadId(uid));
        openAiPanel();
      }
    }
    window.addEventListener(OPEN_ONBOARDING_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ONBOARDING_CHAT_EVENT, onOpen);
  }, [uid, openAiPanel, place]);

  // "The coach answered" — fires when a reply lands with the panel closed.
  // Session-level chats (FreeSession.chatOpen) register into a shared signal
  // so THIS notifier can pause too — otherwise a reply landing while the
  // in-session chat is visible raises a phantom toast on top of the answer
  // the user is already reading (rep_1787479655949_jgp1).
  const anyChatOpen = useAnyChatOpen();
  const { alert, pendingByBucket, dismiss, markAllSeen } = useChatNotifier(uid, {
    paused: aiPanelOpen || foodChatOpen || anyChatOpen,
  });

  // Sitting in a conversation IS reading it. Mark on open as well as on close,
  // so an answer that arrives while you are looking at it never resurfaces as
  // a notification afterwards.
  useEffect(() => {
    if (aiPanelOpen || foodChatOpen) markAllSeen();
  }, [aiPanelOpen, foodChatOpen]);

  // Live status line per place on the sheet — the same number that place's
  // home screen shows, so the sheet is worth opening even without switching.
  function statusFor(p: PlaceId): string {
    if (p === 'exercise') {
      const weekStart = (() => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - d.getDay()); return d.getTime(); })();
      const n = allSessions.filter(s => s.status === 'completed' && s.date >= weekStart).length;
      return n > 0 ? `${n} אימונים השבוע` : 'אין אימונים השבוע';
    }
    const kcal = caloriesOn(todayMeals, startOfDay());
    return kcal > 0 ? `היום: ${kcal} קק״ל` : 'עוד לא רשמת היום';
  }

  let content: React.ReactNode = null;
  switch (route.page) {
    case 'home':
      content = <FreeHome uid={uid} navigate={navigate} onStartRequest={handleFabClick} />;
      break;
    case 'session':
      content = <FreeSession key={route.sessionId} uid={uid} sessionId={route.sessionId} navigate={navigate} />;
      break;
    case 'session-view':
      content = <FreeSession key={route.sessionId} uid={uid} sessionId={route.sessionId} navigate={navigate} historical />;
      break;
    case 'history':
      content = <FreeHistory uid={uid} navigate={navigate} />;
      break;
    case 'settings':
      content = <Settings uid={uid} navigate={navigate} onLogout={doLogout} />;
      break;
    case 'exercises':
      content = <Exercises uid={uid} navigate={navigate} />;
      break;
    case 'body':
      content = <Body uid={uid} navigate={navigate} />;
      break;
    case 'install':
      content = <Install navigate={navigate} />;
      break;
    case 'admin':
      // Admin-only launch dashboard. Non-admins hitting #/admin bounce home
      // rather than see an "access denied" screen — the URL simply doesn't
      // exist for them.
      content = isAdmin
        ? <AdminPage uid={uid} navigate={navigate} />
        : (navigate({ page: 'home' }), null);
      break;
    case 'reports-admin':
      // Deliberately NOT gated on isAdmin. The page always targets Shlomi's
      // reports collection (hardcoded inside), so it's harmless to anyone
      // else who happens to hit the URL — they'd just see his open list.
      // Kept private by not linking to it from anywhere shareable.
      content = <ReportsAdminPage navigate={navigate} />;
      break;
    case 'users-admin':
      content = <UsersAdminPage navigate={navigate} />;
      break;
    case 'admin-desktop':
      content = <AdminDesktopPage navigate={navigate} />;
      break;
    case 'food-today':
      content = <FoodToday uid={uid} navigate={navigate} onOpenChat={() => setFoodChatOpen(true)} refreshKey={mealRefresh} onAddMeal={() => {
        if (isImpersonating) { window.alert('אתה בתצוגה של המתאמן — לא ניתן לרשום ארוחה עבורו.'); return; }
        setShowLogMeal(true);
      }} />;
      break;
    case 'food-history':
      content = <FoodHistory uid={uid} navigate={navigate} onOpenChat={() => setFoodChatOpen(true)} refreshKey={mealRefresh} />;
      break;
    case 'food-insights':
      content = <FoodInsights uid={uid} navigate={navigate} onOpenChat={() => setFoodChatOpen(true)} refreshKey={mealRefresh} />;
      break;
    case 'food-meals':
      content = <FoodMeals uid={uid} navigate={navigate} onOpenChat={() => setFoodChatOpen(true)} refreshKey={mealRefresh} />;
      break;
    case 'food-settings':
      content = <FoodSettings uid={uid} navigate={navigate} onLogout={doLogout} />;
      break;
  }

  return (
    <ImpersonationCtx.Provider value={{
      isImpersonating,
      coachAuthUid: impersonation?.coachAuthUid,
      traineeUid: isImpersonating ? uid : null,
      traineeEmail: impersonation?.traineeEmail,
      traineeName: impersonation?.traineeName,
    }}>
    <PlaceProvider value={{
      place,
      openSheet: () => setSheetOpen(true),
      pendingByBucket,
      trial,
    }}>
      {/* Persistent impersonation banner. Sticks to the top so the coach
          can never forget which app they're touching. Amber to distinguish
          from anything else in the header. */}
      {isImpersonating && (
        <div className="sticky top-0 z-40 bg-amber-500 text-slate-900 text-[12px] font-bold py-2 px-3 flex items-center justify-between gap-2" dir="rtl">
          <span className="truncate">
            👁 אתה צופה במתאמן:{' '}
            <span className="font-mono" dir="ltr">
              {impersonation!.traineeEmail || impersonation!.traineeName || uid}
            </span>
            {' '}— שינויים שאתה עושה נשמרים אצלו
          </span>
          <button
            onClick={() => navigate({ page: 'coach' })}
            className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded bg-slate-900 text-white hover:bg-slate-800"
          >סגור תצוגה</button>
        </div>
      )}
      {showStrip && !isImpersonating && (
        <TrialStrip
          trial={trial}
          onDismiss={hideStripForToday}
          onContact={() => window.open(
            waLink('היי שלומי, אני בתקופת ניסיון במצב ואשמח להמשיך.'),
            '_blank', 'noopener',
          )}
        />
      )}

      {/* Reserve room at the bottom so tab bar never overlaps content */}
      <div className={isTabPage ? 'pb-24' : ''}>
        {content}
      </div>
      {isTabPage && (
        <TabBar
          current={route.page}
          place={place}
          onNavigate={navigate}
          hasInProgress={!!inProgress}
          onFabClick={handleFabClick}
          onFabLongPress={() => setFanOpen(true)}
        />
      )}

      {/* Live-session floating badge — visible when the user has an active
          session but is on some other screen. Tap to jump back. Suppressed
          on the session page itself (which shows its own Chronograph) and
          during impersonation (coach isn't the one training). */}
      {inProgress && route.page !== 'session' && !isImpersonating && (
        <LiveSessionBadge
          session={inProgress}
          onClick={() => navigate({ page: 'session', sessionId: inProgress.id })}
        />
      )}

      {/* Standalone stopwatch — floats globally; opened/closed via the TopBar toggle. */}
      {showStandaloneStopwatch && (
        <Chronograph
          standalone
          sessionStartMs={Date.now()}
          restRemaining={standaloneTimer.remaining}
          restIsRunning={standaloneTimer.isRunning}
          restIsDone={standaloneTimer.isDone}
          onRestSkip={standaloneTimer.skip}
          onRestAdd={standaloneTimer.addTime}
          onRestStart={(s) => standaloneTimer.start(s)}
          onDismiss={() => setStopwatchOpen(false)}
        />
      )}

      {/* Long-press fan — other places' quick actions, without leaving this one. */}
      {fanOpen && (
        <FabFan
          actions={otherPlaceActions}
          onPick={runQuickAction}
          onOpenSheet={() => { setFanOpen(false); setSheetOpen(true); }}
          onClose={() => setFanOpen(false)}
        />
      )}

      {tour && isTabPage && !showLogMeal && !foodChatOpen && !aiPanelOpen && (
        <FirstRunTour uid={uid} tour={tour} onDone={() => setTour(null)} />
      )}

      {sheetOpen && (
        <PlacesSheet
          current={place}
          onGo={goToPlace}
          statusFor={statusFor}
          onClose={() => setSheetOpen(false)}
        />
      )}

      {showLogMeal && (
        <LogMealModal
          uid={uid}
          initialDraft={mealDraft}
          onClose={() => {
            // Opened from the conversation → go back to the conversation.
            // Dropping the user on a blank "new meal" screen loses their place.
            const fromChat = !!mealDraft;
            setShowLogMeal(false);
            setMealDraft(null);
            if (fromChat) setFoodChatOpen(true);
          }}
          onSaved={() => setMealRefresh(k => k + 1)}
          onOpenChat={() => setFoodChatOpen(true)}
        />
      )}

      {/* The food coach — a real conversation, same panel as the trainer.
          Meal cards render inline; approving one logs it, editing one hands it
          to the manual modal. */}
      {foodChatOpen && !isImpersonating && (
        <AiChatPanel
          uid={uid}
          mode="dietary"
          /* When the panel is opened for the first-run greeting OR from the
             Settings "שיחת היכרות" shortcut, pin it to the canonical thread
             so it becomes a persistent pinned entry in history — the user
             can always come back to the same conversation. */
          fixedThreadId={(foodOnboardingActive || foodChatFixedThread) ? foodOnboardingThreadId(uid) : undefined}
          /* First-run only: a fixed greeting bubble and a low-key "דלג לעכשיו"
             chip beneath it — same shape as the trainer's OnboardingScreen.
             Once the user closes or skips the panel we mark it complete and
             the coach opens blank on every future visit. */
          initialAssistantMessage={foodOnboardingActive ? (
            displayName
              ? `היי ${displayName.split(' ')[0]}! ברוך/ה הבא/ה למאמן התזונה 🥗\n\nאני כאן כדי לעזור לך לתכנן ולעקוב אחרי מה שאתה אוכל — פשוט תגיד לי בשפה חופשית ואני אפרק את זה לרכיבים ולקלוריות.\n\nנתחיל מלבנות לך פרופיל קצר כדי שאדע לחשב לך יעד קלורי מדויק — משקל, גובה, גיל, רמת פעילות ומטרה. אפשר גם לדלג ולחזור לזה מתי שבא לך.`
              : `היי, ברוך/ה הבא/ה למאמן התזונה 🥗\n\nאני כאן כדי לעזור לך לתכנן ולעקוב אחרי מה שאתה אוכל — פשוט תגיד לי בשפה חופשית ואני אפרק את זה לרכיבים ולקלוריות.\n\nנתחיל מלבנות לך פרופיל קצר כדי שאדע לחשב לך יעד קלורי מדויק — משקל, גובה, גיל, רמת פעילות ומטרה. אפשר גם לדלג ולחזור לזה מתי שבא לך.`
          ) : undefined}
          earlySkipCta={foodOnboardingActive ? {
            label: 'דלג לעכשיו',
            onClick: () => {
              // Optimistic: patch local profile FIRST so the auto-open effect
              // (which watches profile.diet.foodOnboardingCompletedAt) can't
              // fire while the network round-trip is pending and reopen the
              // panel we just closed. Persist in the background.
              const stamp = Date.now();
              setProfile(p => ({ ...p, diet: { ...(p.diet || {}), foodOnboardingCompletedAt: stamp } }));
              setFoodOnboardingActive(false);
              setFoodChatFixedThread(null);
              markAllSeen();
              setFoodChatOpen(false);
              firestore.updateDietProfile({ foodOnboardingCompletedAt: stamp } as any)
                .then(setProfile)
                .catch(err => console.warn('food onboarding skip persist failed', err));
            },
          } : undefined}
          personalMeals={personalMeals}
          todayMeals={todayMeals}
          dietProfile={profile.diet}
          todayBurn={todayBurn}
          onAddMeal={addMealFromChat}
          /* Correcting a meal edits the TEMPLATE, so every future log of it is
             right too — that is the whole point of the action. Past logs keep
             the numbers they were recorded with; rewriting history would make
             yesterday's balance change under the user. */
          /* Editing TODAY'S entry, not the template. The two are different
             actions on purpose: correcting a recipe should not rewrite what you
             already ate, and eating three-quarters of something should not
             redefine the dish. */
          onUpdateMealLog={async (a) => {
            await firestore.updateMealLog(a.logId, {
              ...(a.he ? { name: a.he } : {}),
              calories: a.calories,
              ...(a.servings != null ? { servings: a.servings } : {}),
              ...(a.ingredients ? { ingredients: a.ingredients } : {}),
              ...(a.macros ? { macros: a.macros } : {}),
              ...(a.flags ? { flags: a.flags } : {}),
            } as any);
            setMealRefresh(k => k + 1);
          }}
          onRemoveMealLog={async (logId) => {
            await firestore.deleteMealLog(logId);
            setMealRefresh(k => k + 1);
          }}
          onUpdateMeal={async (a) => {
            const existing = personalMeals.find(m => m.id === a.mealId);
            await firestore.upsertPersonalMeal({
              ...(existing || { id: a.mealId, createdAt: Date.now() } as any),
              id: a.mealId,
              he: a.he,
              calories: a.calories,
              ingredients: a.ingredients,
              macros: a.macros,
              flags: a.flags,
              updatedAt: Date.now(),
            });
            setMealRefresh(k => k + 1);
          }}
          onDietProfilePatch={async (patch) => {
            const merged = await firestore.updateDietProfile(patch as any);
            setProfile(merged);
          }}
          onSetCalorieTarget={async (target) => {
            // Approving in chat is an explicit choice — pin it as manual so a
            // later weight edit doesn't silently recompute it away.
            const merged = await firestore.updateDietProfile({
              dailyCalorieTarget: target,
              dailyCalorieTargetManual: true,
            });
            setProfile(merged);
            setMealRefresh(k => k + 1);
          }}
          onEditMeal={(d) => { setMealDraft(d); setFoodChatOpen(false); setShowLogMeal(true); }}
          onClose={() => {
            // Optimistic close. Previously this awaited a Firestore write
            // BEFORE flipping foodChatOpen, so the auto-open effect (guarded
            // on profile.diet.foodOnboardingCompletedAt) would re-fire during
            // the round-trip and reopen the panel we just closed — the "X
            // needed to be pressed twice" bug. Now we patch local profile +
            // close synchronously, then persist in the background.
            //
            // ANY first close of the food coach counts as "you've been here"
            // — even when the panel was opened via the Settings shortcut
            // rather than the first-run flow. Otherwise a user who used the
            // shortcut before hitting a food tab would still be ambushed by
            // the first-run greeting on their next food visit.
            const alreadyMarked = !!profile.diet?.foodOnboardingCompletedAt;
            if (!alreadyMarked) {
              const stamp = Date.now();
              setProfile(p => ({ ...p, diet: { ...(p.diet || {}), foodOnboardingCompletedAt: stamp } }));
              firestore.updateDietProfile({ foodOnboardingCompletedAt: stamp } as any)
                .then(setProfile)
                .catch(err => console.warn('food onboarding close persist failed', err));
            }
            setFoodOnboardingActive(false);
            setFoodChatFixedThread(null);
            markAllSeen();
            setFoodChatOpen(false);
          }}
        />
      )}

      {showStart && (
        <StartSessionModal
          suggested={suggested}
          weeklySets={weeklySets}
          lastWeekMuscles={lastWeekMuscles}
          recentMuscles={recentMuscles}
          lastTrainedByMuscle={lastTrainedByMuscle}
          onClose={() => setShowStart(false)}
          onStart={handleStart}
        />
      )}
      {aiPanelOpen && !isImpersonating && (
        <AiChatPanel
          uid={uid}
          mode="trainer"
          // Settings "שיחת היכרות" shortcut pins the panel to the canonical
          // onboarding thread. Cleared on close so the next normal open goes
          // back to the default "latest today" behavior.
          fixedThreadId={aiPanelFixedThread || undefined}
          // Feed the trainer everything it needs to answer both "מה עשיתי השבוע?"
          // and "מה מתוכנן לי" questions. Sessions in allSessions are sorted
          // newest-first — take past 30 for history + all planned for schedule.
          recentSets={allSessions.slice(0, 30).flatMap(s => s.sets || [])}
          plannedSessions={allSessions.filter(s => s.status === 'planned')}
          onClose={() => { setAiPanelFixedThread(null); markAllSeen(); closeAiPanel(); }}
        />
      )}

      {/* "The coach answered" — the reply landed while you were elsewhere.
          Suppressed during impersonation: those are the TRAINEE'S chats and
          the coach should never see them. */}
      {alert && isTabPage && !isImpersonating && (() => {
        // The toast wears the colour of the place whose coach spoke, and says
        // which coach it was — two coaches means "המאמן ענה" alone is ambiguous.
        const isFood = alert.bucket === 'dietary';
        const coachName = isFood ? 'מאמן תזונה' : 'מאמן אימונים';
        const box = isFood
          ? 'dark:border-amber-800 border-amber-300 dark:bg-amber-950/90 bg-amber-50/95'
          : 'dark:border-emerald-800 border-emerald-300 dark:bg-emerald-950/90 bg-emerald-50/95';
        const icon = isFood ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300';
        const head = isFood ? 'text-amber-800 dark:text-amber-200' : 'text-emerald-800 dark:text-emerald-200';
        const sub = isFood ? 'text-amber-700/70 dark:text-amber-300/70' : 'text-emerald-700/70 dark:text-emerald-300/70';
        const cta = isFood ? 'bg-amber-500' : 'bg-emerald-600';
        return (
        <div className="fixed left-0 right-0 z-[45] px-4" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 84px)' }} dir="rtl">
          <div className={`max-w-lg mx-auto flex items-center gap-2 rounded-2xl px-3 py-2.5 shadow-lg border backdrop-blur ${box}`}>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${icon}`}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                <path d="M12 2.5c.3 0 .55.2.63.48l1.28 4.53a3 3 0 0 0 2.07 2.07l4.54 1.28a.66.66 0 0 1 0 1.27l-4.54 1.28a3 3 0 0 0-2.07 2.07l-1.28 4.54a.66.66 0 0 1-1.27 0l-1.28-4.54a3 3 0 0 0-2.07-2.07L3.47 12.13a.66.66 0 0 1 0-1.27l4.54-1.28A3 3 0 0 0 10.09 7.5l1.28-4.53c.08-.28.33-.47.63-.47Z" />
              </svg>
            </span>
            <div className="flex-1 min-w-0">
              <div className={`text-[13px] font-bold ${head}`}>
                {coachName} {alert.hasAction ? 'מחכה לאישור' : 'ענה'}
              </div>
              <div className={`text-[10px] truncate ${sub}`}>{alert.title}</div>
            </div>
            <button
              onClick={() => { markAllSeen(); if (isFood) setFoodChatOpen(true); else openAiPanel(); }}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-white text-[12px] font-bold ${cta}`}
            >פתח</button>
            <button onClick={dismiss} aria-label="סגור" className={`shrink-0 p-1 ${sub}`}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          </div>
        </div>
        );
      })()}

      {reportsOpen && <ReportsPanel uid={uid} onClose={() => setReportsOpen(false)} />}

      {sameDayPrompt && todaysCompleted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/50 p-4" onClick={() => setSameDayPrompt(false)}>
          <div className="card max-w-sm w-full text-right" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-emerald-600 dark:text-emerald-400 mb-2">כבר סיימת אימון היום</h3>
            <p className="text-sm text-muted mb-4">
              יש לך אימון שסיימת היום — {todaysCompleted.sets.filter(s => s.weight > 0 || s.reps > 0).length} סטים.
              נחזור אליו כדי להוסיף עוד?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setSameDayPrompt(false)} className="btn-secondary flex-1 py-3">ביטול</button>
              <button onClick={handleReturnToTodays} className="btn-primary flex-1 py-3">חזור לאימון</button>
            </div>
          </div>
        </div>
      )}
    </PlaceProvider>
    </ImpersonationCtx.Provider>
  );
}

export default function App() {
  const { uid, loading, displayName, email, login, logout: doLogout } = useAuth();
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (r: Route) => {
    window.location.hash = routeToHash(r);
  };

  // Wait for Firebase Auth to hydrate before deciding what to show — otherwise we'd
  // briefly flash the login screen on every reload even for signed-in users.
  if (loading) {
    return <div className="page-bg" />;
  }

  // Admin URLs bypass the login gate entirely — they target the owner's own
  // collections directly and are meant to be reachable from any device/session
  // without signing in. The URL is the secret.
  if (route.page === 'reports-admin') {
    return <ReportsAdminPage navigate={navigate} />;
  }
  if (route.page === 'users-admin') {
    return <UsersAdminPage navigate={navigate} />;
  }
  if (route.page === 'admin-desktop') {
    return <AdminDesktopPage navigate={navigate} />;
  }

  // Coach invite is PUBLIC — a trainee lands here from a shared link and
  // signs in there. The component owns its own auth state.
  if (route.page === 'coach-invite') {
    return <CoachInvitePage coachUid={route.coachUid} navigate={navigate} />;
  }

  if (!uid) {
    return <LoginScreen onLogin={login} />;
  }

  // Coach dashboard requires sign-in.
  if (route.page === 'coach') {
    return <CoachDashboard navigate={navigate} />;
  }
  // Coach impersonation view: mount AppShell with the trainee's uid.
  // AppShell + all its firestore reads run against the trainee's tree; the
  // shared banner + gated chat panels handle the UX side.
  if (route.page === 'coach-view') {
    return (
      <CoachImpersonationShell
        traineeUid={route.traineeUid}
        route={route}
        navigate={navigate}
        doLogout={doLogout}
      />
    );
  }

  return (
    <AuthedShell
      uid={uid}
      displayName={displayName}
      email={email}
      route={route}
      navigate={navigate}
      doLogout={doLogout}
    />
  );
}

// Coach impersonation: renders AppShell as the trainee, but stamps the shell
// with the coach's own auth uid so we know it's a view-through, not a real
// trainee session. Owns the trainee-metadata fetch so the banner shows a
// real name/email instead of a bare uid.
function CoachImpersonationShell({ traineeUid, route, navigate, doLogout }: {
  traineeUid: string;
  route: Route;
  navigate: (r: Route) => void;
  doLogout: () => void;
}) {
  const { rawAuthUid, loading } = useAuth();
  const trial = useTrial(traineeUid, true); // never gate the coach's view
  const [meta, setMeta] = useState<{ email?: string | null; name?: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users_index', traineeUid));
        if (cancelled) return;
        if (snap.exists()) {
          const d = snap.data() as any;
          setMeta({ email: d.email, name: d.displayName });
        } else {
          setMeta({});
        }
      } catch {
        if (!cancelled) setMeta({});
      }
    })();
    return () => { cancelled = true; };
  }, [traineeUid]);

  if (loading || !trial) return <div className="page-bg" />;
  if (!rawAuthUid) {
    // Not signed in — force login. On return, they'll land here again.
    return <LoginScreen onLogin={async () => {}} />;
  }

  return (
    <AppShell
      uid={traineeUid}
      route={route}
      navigate={navigate}
      doLogout={doLogout}
      trial={trial}
      impersonation={{
        coachAuthUid: rawAuthUid,
        traineeEmail: meta?.email,
        traineeName: meta?.name,
      }}
    />
  );
}

// Wraps AppShell with the trial gate → empty-account check → onboarding gate.
function AuthedShell({ uid, displayName, email, route, navigate, doLogout }: {
  uid: string;
  displayName: string | null;
  email: string | null;
  route: Route;
  navigate: (r: Route) => void;
  doLogout: () => void;
}) {
  const firestore = useFirestore(uid);
  // Owner is never gated — resolved synchronously, so this account never waits
  // on a Firestore read to get into its own app.
  const trial = useTrial(uid, uid === OWNER_UID);
  // 'checking' → probe hasn't returned yet; 'onboarding' → new user, show wizard;
  // 'ready' → normal app. We probe once per uid.
  const [status, setStatus] = useState<'checking' | 'onboarding' | 'ready'>('checking');
  // Stash firestore in a ref so the effect doesn't re-fire on every render.
  const firestoreRef = useRef(firestore);
  firestoreRef.current = firestore;

  useEffect(() => {
    let cancelled = false;
    firestoreRef.current.shouldShowOnboarding()
      .then(show => {
        if (cancelled) return;
        setStatus(show ? 'onboarding' : 'ready');
      })
      .catch(err => {
        console.warn('shouldShowOnboarding failed, defaulting to ready', err);
        if (!cancelled) setStatus('ready');
      });
    return () => { cancelled = true; };
  }, [uid]);

  if (status === 'checking' || !trial) {
    return <div className="page-bg" />;
  }

  // Ahead of onboarding: an account whose week is up should not be walked
  // through a wizard it cannot use at the end of.
  if (trial.status === 'expired') {
    return <TrialExpired email={email} onLogout={doLogout} />;
  }

  if (status === 'onboarding') {
    return (
      <OnboardingScreen
        uid={uid}
        displayName={displayName}
        navigate={navigate}
        onDone={() => setStatus('ready')}
      />
    );
  }

  return <AppShell uid={uid} route={route} navigate={navigate} doLogout={doLogout} trial={trial} />;
}
