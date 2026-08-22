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
import { useTimer } from './hooks/useTimer';
import { useStandaloneStopwatch } from './hooks/useStandaloneStopwatch';
import { useAiTrainerPanel } from './hooks/useAiTrainerPanel';
import { AiChatPanel } from './components/AiChatPanel';
import { useChatNotifier } from './hooks/useChatNotifier';
import { FoodToday } from './components/FoodToday';
import { FoodHistory } from './components/FoodHistory';
import { FoodInsights } from './components/FoodInsights';
import { FoodMeals } from './components/FoodMeals';
import { FoodSettings } from './components/FoodSettings';
import { LogMealModal } from './components/LogMealModal';
import type { MealDraft } from './components/AiChatPanel';
import { FabFan, PlaceProvider, PlacesSheet } from './components/PlaceSwitcher';
import { FirstRunTour, TOUR_RESTART_EVENT, hasSeenTour } from './components/FirstRunTour';
import { TrialBanner, TrialExpired } from './components/TrialGate';
import { useTrial } from './hooks/useTrial';
import { waLink, type TrialState } from './config/access';

/** The account that owns this app. Never trial-gated, sees the admin surfaces. */
const OWNER_UID = 'user_6724';
import { ReportsPanel } from './components/ReportsPanel';
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
    case 'session': return `#/session/${route.sessionId}`;
    case 'session-view': return `#/session-view/${route.sessionId}`;
    case 'food-today': return '#/food/today';
    case 'food-history': return '#/food/history';
    case 'food-insights': return '#/food/insights';
    case 'food-meals': return '#/food/meals';
    case 'food-settings': return '#/food/settings';
  }
}

function AppShell({ uid, route, navigate, doLogout, trial }: {
  uid: string;
  route: Route;
  navigate: (r: Route) => void;
  doLogout: () => void;
  trial: TrialState;
}) {
  const firestore = useFirestore(uid);
  const [inProgress, setInProgress] = useState<FreeSessionType | null>(null);
  const [allSessions, setAllSessions] = useState<FreeSessionType[]>([]);
  const [showStart, setShowStart] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const isAdmin = uid === 'user_6724';

  // Admin-only double-click shortcut — opens the bug/feature reports panel from
  // anywhere in the app. Reason (rep_1787310001832_4jel): the entry buried in
  // Settings is easy to lose track of; catching double-clicks globally lets me
  // file a report the moment I see the thing, without leaving the screen.
  // Gated on isAdmin so no other user ever sees this shortcut.
  useEffect(() => {
    if (!isAdmin) return;
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
  }, [isAdmin]);

  const place = placeOf(route.page);
  const isTabPage = TAB_PAGES.has(route.page);

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
    firestore.getUserProfile().then(setProfile).catch(() => { /* new user */ });
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
  const [tourOpen, setTourOpen] = useState(() => !hasSeenTour(uid));
  // Replayed from Settings — go home first, since that is where the tour's
  // targets live.
  useEffect(() => {
    function onRestart() {
      navigate({ page: 'home' });
      setTourOpen(true);
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

  // "The coach answered" — fires when a reply lands with the panel closed.
  const { alert, pendingByBucket, dismiss, markAllSeen } = useChatNotifier(uid, { paused: aiPanelOpen || foodChatOpen });

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
    case 'food-today':
      content = <FoodToday uid={uid} navigate={navigate} onOpenChat={() => setFoodChatOpen(true)} refreshKey={mealRefresh} onAddMeal={() => setShowLogMeal(true)} />;
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
    <PlaceProvider value={{ place, openSheet: () => setSheetOpen(true), pendingByBucket }}>
      {/* Reserve room at the bottom so tab bar never overlaps content */}
      <div className={isTabPage ? 'pb-24' : ''}>
        {/* Only on tab pages: mid-workout or mid-meal is the wrong moment to be
            told about billing. It scrolls away with the content by design. */}
        {isTabPage && (
          <TrialBanner
            state={trial}
            onContact={() => window.open(
              waLink('היי שלומי, אני בתקופת ניסיון במצב ואשמח להמשיך.'),
              '_blank',
              'noopener',
            )}
          />
        )}
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

      {tourOpen && isTabPage && !showLogMeal && !foodChatOpen && !aiPanelOpen && (
        <FirstRunTour uid={uid} onDone={() => setTourOpen(false)} />
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
      {foodChatOpen && (
        <AiChatPanel
          uid={uid}
          mode="dietary"
          personalMeals={personalMeals}
          todayMeals={todayMeals}
          dietProfile={profile.diet}
          todayBurn={todayBurn}
          onAddMeal={addMealFromChat}
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
          onClose={() => { markAllSeen(); setFoodChatOpen(false); }}
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
      {aiPanelOpen && (
        <AiChatPanel
          uid={uid}
          mode="trainer"
          // Feed the trainer everything it needs to answer both "מה עשיתי השבוע?"
          // and "מה מתוכנן לי" questions. Sessions in allSessions are sorted
          // newest-first — take past 30 for history + all planned for schedule.
          recentSets={allSessions.slice(0, 30).flatMap(s => s.sets || [])}
          plannedSessions={allSessions.filter(s => s.status === 'planned')}
          onClose={() => { markAllSeen(); closeAiPanel(); }}
        />
      )}

      {/* "The coach answered" — the reply landed while you were elsewhere. */}
      {alert && isTabPage && (() => {
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

  if (!uid) {
    return <LoginScreen onLogin={login} />;
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
