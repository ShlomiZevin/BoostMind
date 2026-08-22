import { useEffect, useRef, useState } from 'react';
import type { Route } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { TopBar } from './TopBar';
import { CloseAction } from './TopBarActions';
import { restartTour } from './FirstRunTour';
import { ContactCard, TrialCard } from './TrialGate';
import { useTrial } from '../hooks/useTrial';
import { ReportsPanel } from './ReportsPanel';
import { AI_MODELS, DEFAULT_AI_MODEL, cacheAiModel, getAiModel, type AiModelId } from '../config/aiModel';
import { useAuth } from '../hooks/useAuth';
import { DietProfileCard } from './DietProfileCard';

type Props = { uid: string; navigate: (r: Route) => void; onLogout: () => void };

// Section header — same visual language as the אימונים settings page so the
// two places feel like the same screen with different content. Duplicated
// locally (not imported) because both settings files are edited concurrently
// and a shared module creates conflict risk today.
function SectionHeader({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div
      className={`text-[10px] font-bold text-muted-most uppercase tracking-widest px-1 ${first ? 'mb-2' : 'mb-2 mt-5'}`}
      dir="rtl"
    >
      {children}
    </div>
  );
}

// Food settings: same tail as the exercise settings (theme, install, tour,
// share, contact, admin, account). Only the top of the screen — פרופיל תזונה
// + המאכלים שלי — is domain-specific. Users bounce between places; the
// settings tail must match or every trip is a fresh discovery.
export function FoodSettings({ uid, navigate, onLogout }: Props) {
  const firestore = useFirestore(uid);
  const firestoreRef = useRef(firestore);
  firestoreRef.current = firestore;

  // ── Shared app-level state (matches Settings.tsx) ──────────
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
  const [reportsOpen, setReportsOpen] = useState(false);
  const [aiModel, setAiModelState] = useState<AiModelId | undefined>(() => getAiModel());
  const trial = useTrial(uid, uid === 'user_6724');

  async function chooseModel(m: AiModelId) {
    const override = m === DEFAULT_AI_MODEL ? null : m;
    setAiModelState(override || undefined);
    cacheAiModel(override || undefined);
    await firestoreRef.current.setAiModelPref(override);
  }

  async function shareApp() {
    const url = 'https://boostmind-b052c.web.app/matzav/';
    const shareData = {
      title: 'מצב',
      text: 'מצב - האימונים שלך, התזונה שלך, ו-AI שמכיר את שניהם.',
      url,
    };
    try {
      if (typeof (navigator as any).share === 'function') {
        await (navigator as any).share(shareData);
        return;
      }
    } catch { /* user canceled */ }
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
      <TopBar title="הגדרות תזונה" accent="brand" tint="amber" actions={<CloseAction navigate={navigate} />} />
      <div className="p-4 pb-4 max-w-lg mx-auto">

        {/* ─── פרופיל ─── */}
        <SectionHeader first>פרופיל</SectionHeader>
        <DietProfileCard uid={uid} />

        {/* ─── המאכלים שלי — domain-specific, right after profile ─── */}
        <SectionHeader>מאכלים</SectionHeader>
        <button
          onClick={() => navigate({ page: 'food-meals' })}
          className="w-full card mb-4 dark:hover:bg-slate-800 hover:bg-slate-50"
          dir="rtl"
        >
          <div className="flex items-center justify-between">
            <div className="text-right">
              <div className="font-medium">מאגר המאכלים שלי</div>
              <div className="text-xs text-muted">מאכלים אישיים שנשמרו לרישום מהיר</div>
            </div>
            <span className="text-muted text-lg">←</span>
          </div>
        </button>

        {/* ─── תצוגה — theme only (week order is a training thing) ─── */}
        <SectionHeader>תצוגה</SectionHeader>
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

        {/* ─── מדריך והתקנה ─── */}
        <SectionHeader>מדריך והתקנה</SectionHeader>
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

        <div className="card mb-4">
          <div className="flex items-center justify-between" dir="rtl">
            <div className="text-right">
              <div className="font-medium">סיור קצר באפליקציה</div>
              <div className="text-xs text-muted">מעבר בין מקומות, המאמן, התקנה ולחיצה ארוכה</div>
            </div>
            <button onClick={() => restartTour(uid)} className="btn-secondary px-4 py-2 text-sm">
              הצג שוב
            </button>
          </div>
        </div>

        {/* ─── שיתוף וקשר ─── */}
        <SectionHeader>שיתוף וקשר</SectionHeader>
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
                <span>מצב שיתוף</span>
              </div>
              <div className="text-xs text-muted">שלח קישור לחבר או לחברת אימונים</div>
            </div>
            <span className="text-muted text-lg">←</span>
          </div>
        </button>
        <ContactCard />

        {/* ─── מפתחים (אדמין בלבד) ─── */}
        {firestore.isAdmin && (
          <>
            <SectionHeader>מפתחים</SectionHeader>
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
          </>
        )}

        {/* ─── חשבון — trial + logout + destructive ─── */}
        <SectionHeader>חשבון</SectionHeader>
        {/* Renders nothing for owners / paid accounts. */}
        <TrialCard trial={trial} />
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

        <ForgetMeCard onLogout={onLogout} />

        {reportsOpen && <ReportsPanel uid={uid} onClose={() => setReportsOpen(false)} />}
      </div>
    </div>
  );
}

// ─── "שכח אותי" — destructive wipe + logout ────────────────────────
// Same behavior as in Settings.tsx. Duplicated for now to avoid a shared
// module while both settings pages are being edited concurrently.
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
