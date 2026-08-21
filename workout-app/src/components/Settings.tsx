import { useEffect, useRef, useState } from 'react';
import type { Route, UserProfile } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { TopBar } from './TopBar';
import { restartTour } from './FirstRunTour';
import { ReportsPanel } from './ReportsPanel';
import { AI_MODELS, DEFAULT_AI_MODEL, cacheAiModel, getAiModel, type AiModelId } from '../config/aiModel';
import { CloseAction } from './TopBarActions';
import { auth } from '../config/firebase';
import { useAuth } from '../hooks/useAuth';

// Goals editing lives in the Body tab now (see components/GoalsCard.tsx) so this
// screen is only for identity, appearance, and app-level toggles.

type Props = {
  uid: string;
  navigate: (route: Route) => void;
  onLogout: () => void;
};

export function Settings({ uid, navigate, onLogout }: Props) {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
  const [reportsOpen, setReportsOpen] = useState(false);
  const [aiModel, setAiModelState] = useState<AiModelId | undefined>(() => getAiModel());

  async function chooseModel(m: AiModelId) {
    // Selecting the default clears the override entirely, so the request goes
    // out exactly as it did before this setting existed.
    const override = m === DEFAULT_AI_MODEL ? null : m;
    setAiModelState(override || undefined);
    cacheAiModel(override || undefined);
    await firestoreRef.current.setAiModelPref(override);
  }
  const firestore = useFirestore(uid);
  const firestoreRef = useRef(firestore);
  firestoreRef.current = firestore;

  // Week-order preference (default: Saturday-first).
  const [weekOrder, setWeekOrderState] = useState<'saturday-first' | 'sunday-first'>('saturday-first');
  useEffect(() => {
    if (!uid) return;
    const unsub = firestoreRef.current.subscribeToWeekOrder(setWeekOrderState);
    return unsub;
  }, [uid]);

  async function saveWeekOrder(order: 'saturday-first' | 'sunday-first') {
    setWeekOrderState(order);
    await firestoreRef.current.setWeekOrder(order);
  }

  // Share the app link — uses the native Web Share sheet when available
  // (mobile Safari / Chrome), and falls back to copying to clipboard.
  async function shareApp() {
    const url = 'https://boostmind-b052c.web.app/workout-app/';
    const shareData = {
      title: 'מאמן אישי — Boost Workout',
      text: 'אימונים חכמים עם מאמן AI — מעקב סטים, אירובי, ויעדים שבועיים.',
      url,
    };
    try {
      if (typeof (navigator as any).share === 'function') {
        await (navigator as any).share(shareData);
        return;
      }
    } catch { /* user canceled — fall through to clipboard */ }
    try {
      await navigator.clipboard.writeText(url);
      alert('הקישור הועתק — שתפו אותו עם חברים');
    } catch {
      alert(`שתפו את הקישור: ${url}`);
    }
  }

  function toggleTheme() {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('bg-slate-950', 'text-slate-100');
      document.body.classList.add('bg-slate-50', 'text-slate-900');
      localStorage.setItem('workout-theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      document.body.classList.remove('bg-slate-50', 'text-slate-900');
      document.body.classList.add('bg-slate-950', 'text-slate-100');
      localStorage.setItem('workout-theme', 'dark');
      setIsDark(true);
    }
  }

  return (
    <div className="page-bg min-h-screen">
      <TopBar
        title="הגדרות"
        accent="brand"
        tint="amber"
        actions={<CloseAction navigate={navigate} />}
      />
      <div className="p-4 pb-4 max-w-lg mx-auto">

      <ProfileCard uid={uid} />

      <div className="card mb-4">
        <div className="flex items-center justify-between" dir="rtl">
          <div className="text-right">
            <div className="font-medium">מצב תצוגה</div>
            <div className="text-xs text-muted">חשוך / בהיר</div>
          </div>
          <button onClick={toggleTheme} className="btn-secondary px-4 py-2 text-sm">
            {isDark ? '☀️ בהיר' : '🌙 חשוך'}
          </button>
        </div>
      </div>

      {/* Owner-only. Gated on the same admin uid the exercise DB already uses,
          which shlomi@boostart.io resolves to via EMAIL_TO_UID. */}
      {firestore.isAdmin && (
        <div className="card mb-4 border border-emerald-500/30" dir="rtl">
          <div className="text-right mb-2">
            <div className="font-medium">מודל ה-AI</div>
            <div className="text-xs text-muted">חל על כל המאמנים וכל קריאות ה-AI באפליקציה</div>
          </div>
          <div className="space-y-1.5">
            {AI_MODELS.map(m => {
              const active = (aiModel || DEFAULT_AI_MODEL) === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => void chooseModel(m.id)}
                  className={`w-full text-right px-3 py-2.5 rounded-xl border transition-colors ${
                    active
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : 'border-subtle bg-subtle'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[14px]">{m.label}</span>
                    {m.id === DEFAULT_AI_MODEL && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-500/15 text-muted">ברירת מחדל</span>
                    )}
                    {active && <span className="text-emerald-600 dark:text-emerald-400 text-[13px] ms-auto">✓</span>}
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">{m.note}</div>
                </button>
              );
            })}
          </div>
          <div className="text-[10px] text-muted-more mt-2">
            {aiModel ? 'שינוי חל על השיחה הבאה. אפשר לחזור בכל רגע.' : 'לא נבחר מודל — נשלח בדיוק כמו קודם.'}
          </div>
        </div>
      )}

      {firestore.isAdmin && (
        <div className="card mb-4 border border-emerald-500/30">
          <div className="flex items-center justify-between" dir="rtl">
            <div className="text-right">
              <div className="font-medium">דיווחי באגים ופיצ׳רים</div>
              <div className="text-xs text-muted">רשום תוך כדי שימוש — במקום להעביר בוואטסאפ</div>
            </div>
            <button onClick={() => setReportsOpen(true)} className="btn-secondary px-4 py-2 text-sm">
              פתח
            </button>
          </div>
        </div>
      )}

      <div className="card mb-4">
        <div className="flex items-center justify-between" dir="rtl">
          <div className="text-right">
            <div className="font-medium">סיור קצר באפליקציה</div>
            <div className="text-xs text-muted">מעבר בין מקומות, המאמן, ולחיצה ארוכה</div>
          </div>
          <button onClick={() => restartTour(uid)} className="btn-secondary px-4 py-2 text-sm">
            הצג שוב
          </button>
        </div>
      </div>

      {/* Week order — Israeli default is Saturday-first; some users prefer
          Sunday-first. Rendered as a segmented pair for clarity. */}
      <div className="card mb-4">
        <div className="flex items-center justify-between gap-3" dir="rtl">
          <div className="text-right min-w-0">
            <div className="font-medium">סדר ימי השבוע בעמוד הבית</div>
            <div className="text-xs text-muted">שבת ראשון או ראשון ראשון</div>
          </div>
          <div className="inline-flex rounded-lg overflow-hidden border border-subtle shrink-0" role="tablist">
            <button
              onClick={() => saveWeekOrder('saturday-first')}
              className={`px-3 py-1.5 text-xs font-semibold ${
                weekOrder === 'saturday-first'
                  ? 'bg-blue-600 text-white'
                  : 'dark:bg-slate-800 bg-slate-100 text-muted hover:text-main'
              }`}
            >שבת → ראשון</button>
            <button
              onClick={() => saveWeekOrder('sunday-first')}
              className={`px-3 py-1.5 text-xs font-semibold ${
                weekOrder === 'sunday-first'
                  ? 'bg-blue-600 text-white'
                  : 'dark:bg-slate-800 bg-slate-100 text-muted hover:text-main'
              }`}
            >ראשון → שבת</button>
          </div>
        </div>
      </div>

      {/* Share the app — Web Share sheet on mobile, clipboard fallback elsewhere. */}
      <button
        onClick={shareApp}
        className="w-full card mb-4 dark:hover:bg-slate-800 hover:bg-slate-50"
        dir="rtl"
      >
        <div className="flex items-center justify-between">
          <div className="text-right flex-1 min-w-0">
            <div className="font-medium flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
                <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
              </svg>
              <span>שתף את האפליקציה</span>
            </div>
            <div className="text-xs text-muted">שלח קישור לחבר או לחברת אימונים</div>
          </div>
          <span className="text-muted text-lg">←</span>
        </div>
      </button>

      <button
        onClick={() => navigate({ page: 'exercises' })}
        className="w-full card mb-4 dark:hover:bg-slate-800 hover:bg-slate-50"
        dir="rtl"
      >
        <div className="flex items-center justify-between">
          <div className="text-right">
            <div className="font-medium">התרגילים שלי</div>
            <div className="text-xs text-muted">ניהול תרגילים, תמונות, שמות וכינויים</div>
          </div>
          <span className="text-muted text-lg">←</span>
        </div>
      </button>

      <button
        onClick={() => navigate({ page: 'install' })}
        className="w-full card mb-4 dark:hover:bg-slate-800 hover:bg-slate-50"
        dir="rtl"
      >
        <div className="flex items-center justify-between">
          <div className="text-right flex-1 min-w-0">
            <div className="font-medium flex items-center gap-2">
              <span>התקנה למסך הבית</span>
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-300 uppercase tracking-widest">PWA</span>
            </div>
            <div className="text-xs text-muted">הוראות ל-iPhone ול-Android — פותח כאפליקציה מלאה</div>
          </div>
          <span className="text-muted text-lg">←</span>
        </div>
      </button>

      {/* יעדים שבועיים moved to the גוף tab — the muscle-volume view lives there
          too, so goal-editing sits next to the chart it drives. */}
      <button
        onClick={() => navigate({ page: 'body' })}
        className="w-full card mb-4 dark:hover:bg-slate-800 hover:bg-slate-50"
        dir="rtl"
      >
        <div className="flex items-center justify-between">
          <div className="text-right flex-1 min-w-0">
            <div className="font-medium">יעדים שבועיים</div>
            <div className="text-xs text-muted">עברו לטאב "גוף" — לצד תצוגת הנפח לפי שריר</div>
          </div>
          <span className="text-muted text-lg">←</span>
        </div>
      </button>

      <ForgetMeCard onLogout={onLogout} />

      {reportsOpen && <ReportsPanel uid={uid} onClose={() => setReportsOpen(false)} />}

      <div className="card mb-4">
        <div className="flex items-center justify-between" dir="rtl">
          <div className="text-right">
            <div className="font-medium">החלף משתמש</div>
            <div className="text-xs text-muted">התנתק והכנס עם חשבון Google אחר</div>
          </div>
          <button onClick={onLogout} className="btn-secondary px-4 py-2 text-sm text-red-500">
            התנתק
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── Profile card ─────────────────────────────────────────────────
// Same fields the onboarding chat collects. User can edit directly here, OR
// keep chatting with the AI trainer which can also update these fields. The
// "פתח מחדש את שאלון האונבורדינג" button clears the completion flag and reloads
// so the onboarding gate re-triggers.
type Level = NonNullable<UserProfile['level']>;
type Goal  = NonNullable<UserProfile['goal']>;
const LEVEL_HE: Record<Level, string> = { beginner: 'מתחיל', intermediate: 'בינוני', advanced: 'מתקדם' };
const GOAL_HE:  Record<Goal,  string> = { mass: 'מסה', cut: 'חיטוב', strength: 'כוח', health: 'בריאות' };

function ProfileCard({ uid }: { uid: string }) {
  const firestore = useFirestore(uid);
  const [profile, setProfile] = useState<UserProfile>({});
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    firestore.getUserProfile().then(p => { setProfile(p); setLoaded(true); }).catch(() => setLoaded(true));
  }, [uid]);

  async function patch(p: Partial<UserProfile>) {
    const merged = await firestore.updateUserProfile(p);
    setProfile(merged);
  }

  async function reopenOnboarding() {
    // Two-step: (1) blow away the "completed" flag so the wizard is a candidate again,
    // (2) set forceOnboarding so shouldShowOnboarding returns true regardless of the
    // legacy "has any data" heuristic. Reload lets AuthedShell re-probe cleanly.
    await firestore.updateUserProfile({ onboardingCompletedAt: 0 as any, forceOnboarding: true });
    window.location.reload();
  }

  const filled: string[] = [];
  if (profile.name) filled.push(profile.name);
  if (profile.level) filled.push(LEVEL_HE[profile.level]);
  if (profile.goal) filled.push(GOAL_HE[profile.goal]);
  if (profile.daysPerWeek) filled.push(`${profile.daysPerWeek} ימים/שבוע`);

  return (
    <div className="card mb-4" dir="rtl">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between text-right"
      >
        <div>
          <div className="font-medium">פרופיל אישי</div>
          <div className="text-xs text-muted">
            {!loaded ? '...טוען' : filled.length > 0 ? filled.join(' · ') : 'עוד לא הוגדר — לחץ להגדרה או דבר עם המאמן'}
          </div>
        </div>
        <span className="text-muted text-lg">{expanded ? '▾' : '←'}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-[11px] font-medium dark:text-slate-300 text-slate-700 mb-1.5">שם</label>
            <input
              type="text"
              value={profile.name || ''}
              onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
              onBlur={e => patch({ name: e.target.value.trim() || undefined })}
              placeholder="—"
              className="input-field w-full !text-right"
              dir="rtl"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium dark:text-slate-300 text-slate-700 mb-1.5">רמה</label>
            <div className="flex gap-2">
              {(Object.keys(LEVEL_HE) as Level[]).map(k => (
                <button
                  key={k}
                  onClick={() => patch({ level: k })}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold ${
                    profile.level === k
                      ? 'bg-emerald-500 text-white'
                      : 'dark:bg-slate-800 bg-slate-100 text-main'
                  }`}
                >{LEVEL_HE[k]}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium dark:text-slate-300 text-slate-700 mb-1.5">מטרה</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(GOAL_HE) as Goal[]).map(k => (
                <button
                  key={k}
                  onClick={() => patch({ goal: k })}
                  className={`py-2 rounded-lg text-sm font-semibold ${
                    profile.goal === k
                      ? 'bg-emerald-500 text-white'
                      : 'dark:bg-slate-800 bg-slate-100 text-main'
                  }`}
                >{GOAL_HE[k]}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium dark:text-slate-300 text-slate-700 mb-1.5">ימים בשבוע</label>
            <div className="grid grid-cols-6 gap-2">
              {[2, 3, 4, 5, 6, 7].map(n => (
                <button
                  key={n}
                  onClick={() => patch({ daysPerWeek: n as 2 | 3 | 4 | 5 | 6 | 7 })}
                  className={`py-2 rounded-lg text-sm font-semibold ${
                    profile.daysPerWeek === n
                      ? 'bg-emerald-500 text-white'
                      : 'dark:bg-slate-800 bg-slate-100 text-main'
                  }`}
                >{n}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium dark:text-slate-300 text-slate-700 mb-1.5">מגבלות / פציעות</label>
            <textarea
              value={profile.limitations || ''}
              onChange={e => setProfile(p => ({ ...p, limitations: e.target.value }))}
              onBlur={e => patch({ limitations: e.target.value.trim() || undefined })}
              placeholder="אין"
              rows={2}
              className="w-full text-[13px] rounded-xl border border-subtle bg-transparent p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none text-right"
              dir="rtl"
            />
          </div>

          <div className="pt-3 border-t border-subtle">
            <button
              onClick={reopenOnboarding}
              className="w-full py-3 rounded-xl inline-flex items-center justify-center gap-2 font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_3px_10px_-2px_rgba(16,185,129,0.5)] transition-colors"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M12 2.5c.3 0 .55.2.63.48l1.28 4.53a3 3 0 0 0 2.07 2.07l4.54 1.28a.66.66 0 0 1 0 1.27l-4.54 1.28a3 3 0 0 0-2.07 2.07l-1.28 4.54a.66.66 0 0 1-1.27 0l-1.28-4.54a3 3 0 0 0-2.07-2.07L3.47 12.13a.66.66 0 0 1 0-1.27l4.54-1.28A3 3 0 0 0 10.09 7.5l1.28-4.53c.08-.28.33-.47.63-.47Z"/>
              </svg>
              <span>פתח את שיחת ההכרות עם המאמן</span>
            </button>
            <p className="text-[10px] text-muted-most text-center mt-2">
              המאמן AI יזכור שיחות קודמות ויכול גם לעדכן שדות פרופיל דרך שיחה חופשית
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── "שכח אותי" — destructive wipe + logout ────────────────────────
// Deletes every subcollection under users/{uid}/*, the profile doc, and any
// authAlias binding. Signs the user out and reloads to the login screen.
// Hard-guarded against wiping protected uids (see wipeAllUserData). Requires
// the user to TYPE their email to confirm — no accidental blast-radius.
function ForgetMeCard({ onLogout }: { onLogout: () => void }) {
  const { uid, rawAuthUid, email } = useAuth();
  const firestore = useFirestore(uid || '');
  const [expanded, setExpanded] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const matches = !!email && typed.trim().toLowerCase() === email.toLowerCase();

  async function forgetMe() {
    if (busy || !uid) return;
    if (!matches) { setErr('הקלד את המייל שלך במלואו כדי לאשר'); return; }
    setBusy(true); setErr(null);
    try {
      await firestore.wipeAllUserData(rawAuthUid);
      onLogout();
      // Sign-out is async but useAuth listens; force a reload to be safe so the
      // whole tree remounts against a clean state.
      setTimeout(() => window.location.reload(), 400);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setBusy(false);
    }
  }

  return (
    <div className="card mb-4 border border-red-500/30" dir="rtl">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between text-right"
      >
        <div>
          <div className="font-medium text-red-600 dark:text-red-400">שכח אותי (מחק חשבון)</div>
          <div className="text-xs text-muted">
            מוחק את כל הנתונים שלך ומתנתק. פעולה בלתי הפיכה.
          </div>
        </div>
        <span className="text-muted text-lg">{expanded ? '▾' : '←'}</span>
      </button>
      {expanded && (
        <div className="mt-4 space-y-3 text-right">
          <div className="text-[11px] text-muted bg-red-500/5 border border-red-500/20 rounded-lg p-3 leading-relaxed">
            <div className="font-bold text-red-600 dark:text-red-400 mb-1">⚠️ מחיקה מלאה</div>
            <div>ימחקו כל האימונים, התוכניות, הפרופיל, השיחות עם המאמן והתמונות שהעלית.</div>
            <div>לא ניתן לשחזר. מאגר התרגילים המשותף לא יושפע.</div>
          </div>
          <div className="text-[10px] text-muted-most bg-slate-500/5 rounded-lg p-2">
            <div>מייל: <span dir="ltr">{email || '(ללא)'}</span></div>
            <div>מזהה: <span dir="ltr" className="font-mono text-[10px]">{uid || '?'}</span></div>
          </div>
          <div>
            <label className="block text-[11px] font-medium dark:text-slate-300 text-slate-700 mb-1.5">
              כדי לאשר, הקלד את המייל שלך:
            </label>
            <input
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={email || ''}
              className="input-field w-full"
              dir="ltr"
              autoComplete="off"
            />
          </div>
          {err && <div className="text-xs text-red-500">{err}</div>}
          <button
            onClick={forgetMe}
            disabled={busy || !matches}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-colors ${
              matches && !busy
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'dark:bg-slate-800 dark:text-slate-600 bg-slate-200 text-slate-400'
            }`}
          >{busy ? '...מוחק' : 'מחק את החשבון ואת כל הנתונים והתנתק'}</button>
        </div>
      )}
    </div>
  );
}
