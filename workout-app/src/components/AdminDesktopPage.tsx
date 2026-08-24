import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, orderBy, query, limit as fbLimit } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { AppReport, Route } from '../types';
import { AI_MODELS, DEFAULT_AI_MODEL, cacheAiModel, getAiModel, type AiModelId } from '../config/aiModel';
import { useFirestore } from '../hooks/useFirestore';
import { AdminNav } from './AdminNav';

// Desktop admin landing. One page that pulls together users + tasks + activity
// + the AI model switch, with deep-links to the two dedicated pages
// (/reports-admin, /users-admin) when you need to work rather than watch.

const OWNER_UID = 'user_6724';
const REPORTS_UID = 'user_6724';

type UserRow = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  firstSeenAt?: number;
  lastSeenAt?: number;
  signInCount?: number;
  firstReferrer?: string | null;
};

type EventRow = {
  id: string;
  type: string;
  ts: number;
  uid?: string | null;
  email?: string | null;
  path?: string;
};

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }
function relTime(ts?: number): string {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60_000);
  if (m < 1) return 'עכשיו';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d`;
  return `${Math.round(d / 30)}mo`;
}
function absDate(ts?: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const EVENT_HE: Record<string, string> = {
  sign_in: 'כניסה',
  register: 'הרשמה',
  page: 'צפייה',
  login_view: 'מסך כניסה',
};
const EVENT_TONE: Record<string, string> = {
  register: 'text-emerald-500',
  sign_in:  'text-blue-500',
  page:     'text-muted',
  login_view: 'text-muted-most',
};

export function AdminDesktopPage({ navigate }: { navigate: (r: Route) => void }) {
  // Data
  const [users, setUsers] = useState<UserRow[]>([]);
  const [reports, setReports] = useState<AppReport[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  // AI model — reuse the same client + hook Settings uses, but hardcode the
  // uid to the owner's since this page is meant for cross-session admin.
  const firestore = useFirestore(REPORTS_UID);
  const firestoreRef = useRef(firestore);
  firestoreRef.current = firestore;
  const [aiModel, setAiModel] = useState<AiModelId | undefined>(() => getAiModel());
  async function chooseModel(m: AiModelId) {
    const override = m === DEFAULT_AI_MODEL ? null : m;
    setAiModel(override || undefined);
    cacheAiModel(override || undefined);
    try { await firestoreRef.current.setAiModelPref(override); } catch { /* ok */ }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [uSnap, rSnap, eSnap] = await Promise.all([
        getDocs(query(collection(db, 'users_index'), orderBy('firstSeenAt', 'desc'), fbLimit(500))),
        getDocs(collection(db, 'users', REPORTS_UID, 'reports')),
        getDocs(query(collection(db, 'analytics_events'), orderBy('ts', 'desc'), fbLimit(200))),
      ]);
      if (cancelled) return;
      setUsers(uSnap.docs.map(d => d.data() as UserRow));
      setReports(rSnap.docs.map(d => d.data() as AppReport).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      setEvents(eSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(e => typeof e.ts === 'number'));
      setLoaded(true);
    })().catch(() => setLoaded(true));
    return () => { cancelled = true; };
  }, []);

  // ── User stats ──
  const userStats = useMemo(() => {
    const real = users.filter(u => u.uid !== OWNER_UID);
    const today = Date.now() - 86_400_000;
    const week = Date.now() - 7 * 86_400_000;
    return {
      total: real.length,
      withEmail: real.filter(u => u.email).length,
      newToday: real.filter(u => (u.firstSeenAt || 0) >= today).length,
      activeToday: real.filter(u => (u.lastSeenAt || 0) >= today).length,
      activeWeek:  real.filter(u => (u.lastSeenAt || 0) >= week).length,
    };
  }, [users]);
  const recentUsers = useMemo(
    () => users.filter(u => u.uid !== OWNER_UID).slice(0, 8),
    [users],
  );

  // ── Report stats ──
  const reportStats = useMemo(() => {
    const c = { total: reports.length, open: 0, inProgress: 0, onHold: 0, done: 0 };
    for (const r of reports) {
      if (r.status === 'open') c.open++;
      else if (r.status === 'in-progress') c.inProgress++;
      else if (r.status === 'on-hold') c.onHold++;
      else if (r.status === 'done') c.done++;
    }
    return c;
  }, [reports]);
  const recentOpenReports = useMemo(
    () => reports.filter(r => r.status === 'open' || r.status === 'in-progress').slice(0, 8),
    [reports],
  );

  // ── Movement feed ──
  const movement = useMemo(
    () => events.filter(e => e.uid !== OWNER_UID && e.type !== 'login_view').slice(0, 30),
    [events],
  );

  return (
    <div className="page-bg min-h-screen">
      {/* Mobile guard — the whole point of this page is desktop density. */}
      <div className="md:hidden fixed inset-0 flex items-center justify-center p-8 z-50 dark:bg-slate-950 bg-slate-50" dir="rtl">
        <div className="max-w-sm text-center space-y-3">
          <div className="text-4xl">🖥️</div>
          <div className="font-bold text-lg">דשבורד — לדסקטופ בלבד</div>
          <div className="text-sm text-muted">
            למובייל יש את "דשבורד השקה" בהגדרות. הדף הזה נבנה למסך רחב.
          </div>
          <button onClick={() => navigate({ page: 'home' })} className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm">חזרה לבית</button>
        </div>
      </div>

      <div className="hidden md:block">
        <AdminNav current="admin-desktop" navigate={navigate} onReload={() => window.location.reload()} />
      </div>
      <div className="hidden md:block max-w-6xl mx-auto p-6" dir="rtl">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">דשבורד ניהול</h1>
          <div className="text-xs text-muted mt-0.5">משתמשים · משימות · תנועה · מודל AI</div>
        </div>

        {/* Top KPIs row */}
        <div className="grid grid-cols-6 gap-3 mb-5">
          <Kpi label="משתמשים" value={userStats.total} sub="ללא שלומי" tone="emerald" />
          <Kpi label="עם אימייל" value={userStats.withEmail} sub={`${userStats.total ? Math.round(100 * userStats.withEmail / userStats.total) : 0}%`} tone="emerald" />
          <Kpi label="חדשים היום" value={userStats.newToday} tone="emerald" />
          <Kpi label="פעילים השבוע" value={userStats.activeWeek} tone="emerald" />
          <Kpi label="משימות פתוחות" value={reportStats.open + reportStats.inProgress} sub={`${reportStats.open} פתוחות · ${reportStats.inProgress} בטיפול`} tone="blue" />
          <Kpi label="הושלמו" value={reportStats.done} tone="muted" />
        </div>

        {/* Two-column: Users + Tasks */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* USERS */}
          <div className="card !p-0 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-subtle flex items-center justify-between">
              <div className="font-bold text-sm">משתמשים אחרונים</div>
              <button onClick={() => navigate({ page: 'users-admin' })} className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">רשימה מלאה →</button>
            </div>
            <div>
              {!loaded && <div className="p-6 text-center text-muted-most text-sm">טוען…</div>}
              {loaded && recentUsers.length === 0 && <div className="p-6 text-center text-muted-most text-sm">אין משתמשים עדיין.</div>}
              {recentUsers.map((u, i) => (
                <div key={u.uid} className={`px-4 py-2 flex items-center gap-3 ${i > 0 ? 'border-t border-subtle' : ''}`} dir="rtl">
                  {u.photoURL
                    ? <img src={u.photoURL} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
                    : <div className="w-8 h-8 rounded-full bg-slate-500/15 flex items-center justify-center text-[11px] font-bold text-muted shrink-0">{(u.email || u.displayName || '?').slice(0, 1).toUpperCase()}</div>}
                  <div className="flex-1 min-w-0 text-right">
                    <div className="font-semibold text-sm truncate" dir="ltr">{u.email || <span className="text-muted italic">אין אימייל</span>}</div>
                    {u.displayName && <div className="text-[10px] text-muted truncate">{u.displayName}</div>}
                  </div>
                  <div className="text-left shrink-0 text-[11px] text-muted" title={absDate(u.firstSeenAt)}>
                    <div dir="ltr">{relTime(u.firstSeenAt)}</div>
                    <div className="text-[10px] text-muted-more" dir="ltr">{u.signInCount || 1} כניסות</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TASKS */}
          <div className="card !p-0 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-subtle flex items-center justify-between">
              <div className="font-bold text-sm">משימות פעילות</div>
              <button onClick={() => navigate({ page: 'reports-admin' })} className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline">כל המשימות →</button>
            </div>
            <div>
              {!loaded && <div className="p-6 text-center text-muted-most text-sm">טוען…</div>}
              {loaded && recentOpenReports.length === 0 && <div className="p-6 text-center text-muted-most text-sm">אין משימות פתוחות 🎉</div>}
              {recentOpenReports.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => navigate({ page: 'reports-admin' })}
                  className={`w-full px-4 py-2 flex items-center gap-3 text-right hover:bg-slate-500/[.03] ${i > 0 ? 'border-t border-subtle' : ''}`}
                  dir="rtl"
                >
                  <span className="font-mono text-[10px] text-muted-most w-8" dir="ltr">#{r.num ?? '?'}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                    r.status === 'open' ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  }`}>{r.status === 'open' ? 'פתוח' : 'בטיפול'}</span>
                  <span className="flex-1 min-w-0 text-sm truncate">{r.text.split('\n')[0]}</span>
                  <span className="text-[10px] text-muted-more shrink-0" dir="ltr" title={absDate(r.createdAt)}>{relTime(r.createdAt)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Movement + AI model side by side */}
        <div className="grid grid-cols-3 gap-4">
          {/* Movement feed (2/3) */}
          <div className="col-span-2 card !p-0 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-subtle flex items-center justify-between">
              <div className="font-bold text-sm">תנועה אחרונה</div>
              <div className="text-[10px] text-muted-most">{movement.length} אירועים</div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {!loaded && <div className="p-6 text-center text-muted-most text-sm">טוען…</div>}
              {loaded && movement.length === 0 && <div className="p-6 text-center text-muted-most text-sm">שקט לגמרי.</div>}
              {movement.map((e, i) => {
                const kind = EVENT_HE[e.type] || e.type;
                const tone = EVENT_TONE[e.type] || 'text-muted';
                const identity = e.email || e.uid || 'אנונימי';
                return (
                  <div key={e.id} className={`px-4 py-1.5 flex items-center gap-3 text-[12px] ${i > 0 ? 'border-t border-subtle' : ''}`} dir="rtl">
                    <span className={`font-semibold shrink-0 w-16 ${tone}`}>{kind}</span>
                    <span className="flex-1 min-w-0 truncate" dir="ltr">{identity}</span>
                    {e.path && <span className="text-[10px] text-muted-more shrink-0 max-w-[180px] truncate" dir="ltr" title={e.path}>{e.path}</span>}
                    <span className="text-[10px] text-muted-most shrink-0" dir="ltr" title={absDate(e.ts)}>{relTime(e.ts)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI model picker (1/3). Admin-only tuning point — not for regular
              users (their Settings page hides the entire מפתחים block already). */}
          <div className="card !p-0 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-subtle">
              <div className="font-bold text-sm">מודל AI</div>
              <div className="text-[10px] text-muted mt-0.5">חל על כל הקריאות מהאפליקציה</div>
            </div>
            <div className="p-3 space-y-1.5">
              {AI_MODELS.map(m => {
                const active = (aiModel || DEFAULT_AI_MODEL) === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => void chooseModel(m.id)}
                    className={`w-full text-right px-3 py-2.5 rounded-xl border transition-colors ${
                      active
                        ? 'border-emerald-500/50 bg-emerald-500/10'
                        : 'border-subtle hover:bg-slate-500/5'
                    }`}
                    dir="rtl"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[13px]">{m.label}</span>
                      {m.id === DEFAULT_AI_MODEL && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-500/15 text-muted">ברירת מחדל</span>
                      )}
                      {active && <span className="text-emerald-600 dark:text-emerald-400 text-[12px] ms-auto">✓</span>}
                    </div>
                    <div className="text-[10px] text-muted mt-0.5">{m.note}</div>
                  </button>
                );
              })}
              <div className="text-[10px] text-muted-more mt-2">
                {aiModel ? 'חל על השיחה הבאה. חוזר לברירת המחדל בלחיצה חוזרת.' : 'ברירת המחדל של השרת פעילה.'}
              </div>
            </div>
          </div>
        </div>

        <div className="text-[10px] text-muted-more text-center mt-4">
          מקורות: users_index · users/{REPORTS_UID}/reports · analytics_events
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone: 'emerald' | 'blue' | 'muted' }) {
  const toneCls = tone === 'emerald' ? 'text-emerald-500'
    : tone === 'blue' ? 'text-blue-500'
    : 'text-muted';
  return (
    <div className="card !p-3 text-right">
      <div className="text-[10px] uppercase tracking-wider text-muted-most">{label}</div>
      <div className={`text-2xl font-bold font-mono mt-0.5 ${toneCls}`} dir="ltr">{value}</div>
      {sub && <div className="text-[10px] text-muted-more mt-0.5">{sub}</div>}
    </div>
  );
}
