import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, getCountFromServer, getDocs, orderBy, query, limit as fbLimit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../hooks/useAuth';
import type { Route } from '../types';
import { isCoacherEmail } from '../config/coaches';

// Coach dashboard. Lists every trainee whose profile points at the current
// signed-in coach (`coachUid == request.auth.uid`) and gives a quick "today"
// snapshot per row + a click-to-impersonate action.

type TraineeRow = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  coachAcceptedAt?: number;
  lastSeenAt?: number;
};

type Today = {
  sessionsToday: number | null;
  mealsToday: number | null;
  sessionsTotal: number | null;
  mealsTotal: number | null;
};

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }
function startOfLocalDay(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function relTime(ts?: number): string {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60_000);
  if (m < 1) return 'עכשיו';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}
function absDate(ts?: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

export function CoachDashboard({ navigate }: { navigate: (r: Route) => void }) {
  const { rawAuthUid, email, loading } = useAuth();
  const allowedCoach = isCoacherEmail(email);
  const [trainees, setTrainees] = useState<TraineeRow[]>([]);
  const [todayByUid, setTodayByUid] = useState<Map<string, Today>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState('');
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const abortRef = useRef(false);

  const inviteUrl = rawAuthUid
    ? `${window.location.origin}${window.location.pathname}#/coach/invite/${rawAuthUid}`
    : '';

  async function copyInvite() {
    try { await navigator.clipboard.writeText(inviteUrl); setCopyToast('הועתק'); setTimeout(() => setCopyToast(null), 1600); }
    catch { setCopyToast('העתקה נכשלה'); setTimeout(() => setCopyToast(null), 1600); }
  }

  async function reload() {
    if (!rawAuthUid) return;
    setLoaded(false);
    try {
      // Query users_index for anyone whose coachUid matches this coach. The
      // dashboard mirrors coachUid to users_index on accept so we can query
      // without walking every profile doc.
      const snap = await getDocs(query(collection(db, 'users_index'), orderBy('coachAcceptedAt', 'desc'), fbLimit(500)));
      if (abortRef.current) return;
      const list = snap.docs
        .map(d => d.data() as any)
        .filter(u => u.coachUid === rawAuthUid);
      setTrainees(list);
    } finally {
      if (!abortRef.current) setLoaded(true);
    }
  }
  useEffect(() => { abortRef.current = false; if (rawAuthUid) void reload(); return () => { abortRef.current = true; }; }, [rawAuthUid]);

  // Enrich each trainee with "today" counts + totals. Aggregation queries so
  // each is a single billed read.
  useEffect(() => {
    if (trainees.length === 0) return;
    let cancelled = false;
    const startToday = startOfLocalDay();
    Promise.all(trainees.slice(0, 100).map(async u => {
      const sessionsCol = collection(db, 'users', u.uid, 'freeSessions');
      const mealsCol = collection(db, 'users', u.uid, 'mealLogs');
      const [ss, ml, sTot, mTot] = await Promise.all([
        // Firestore aggregation with a where filter — count sessions logged today.
        // Falls back to null on any error (no data yet, missing index, etc.)
        (async () => {
          try {
            const { where, query } = await import('firebase/firestore');
            const q = query(sessionsCol, where('date', '>=', startToday));
            const c = await getCountFromServer(q);
            return c.data().count;
          } catch { return null; }
        })(),
        (async () => {
          try {
            const { where, query } = await import('firebase/firestore');
            const q = query(mealsCol, where('timestamp', '>=', startToday));
            const c = await getCountFromServer(q);
            return c.data().count;
          } catch { return null; }
        })(),
        getCountFromServer(sessionsCol).then(c => c.data().count).catch(() => null),
        getCountFromServer(mealsCol).then(c => c.data().count).catch(() => null),
      ]);
      return { uid: u.uid, sessionsToday: ss, mealsToday: ml, sessionsTotal: sTot, mealsTotal: mTot };
    })).then(rows => {
      if (cancelled) return;
      const m = new Map<string, Today>();
      rows.forEach(r => m.set(r.uid, { sessionsToday: r.sessionsToday, mealsToday: r.mealsToday, sessionsTotal: r.sessionsTotal, mealsTotal: r.mealsTotal }));
      setTodayByUid(m);
    });
    return () => { cancelled = true; };
  }, [trainees]);

  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return trainees;
    return trainees.filter(u => `${u.email ?? ''} ${u.displayName ?? ''} ${u.uid}`.toLowerCase().includes(ql));
  }, [trainees, q]);

  if (loading) {
    return <div className="page-bg min-h-screen" />;
  }
  if (!rawAuthUid) {
    return (
      <div className="page-bg min-h-screen flex items-center justify-center p-6" dir="rtl">
        <div className="text-center max-w-sm space-y-3">
          <div className="text-4xl">🔒</div>
          <div className="font-bold">חסר חיבור</div>
          <button onClick={() => navigate({ page: 'home' })} className="btn-primary px-4 py-2 text-sm">חזרה לאפליקציה</button>
        </div>
      </div>
    );
  }
  // Coacher-only route: any signed-in non-coacher account bounces home.
  if (!allowedCoach) {
    return (
      <div className="page-bg min-h-screen flex items-center justify-center p-6" dir="rtl">
        <div className="text-center max-w-sm space-y-3">
          <div className="text-4xl">🚫</div>
          <div className="font-bold">הדף הזה למאמנים בלבד</div>
          <button onClick={() => navigate({ page: 'home' })} className="btn-primary px-4 py-2 text-sm">חזרה לאפליקציה</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-bg min-h-screen" dir="rtl">
      {/* Header + invite. RTL layout — in `flex` with `dir="rtl"`, the FIRST
          child sits at the visual RIGHT. So back button first, then title,
          then refresh on the far left (visual end). */}
      <div className="sticky top-0 z-20 dark:bg-slate-950/95 bg-slate-50/95 backdrop-blur border-b border-subtle">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-bold">דשבורד מאמן</div>
          </div>
          <button
            onClick={() => navigate({ page: 'home' })}
            className="text-[11px] font-bold text-muted hover:text-main"
          >חזרה לאפליקציה ←</button>
          <button
            onClick={reload}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-subtle text-muted hover:text-main"
          >רענן</button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        {/* Invite card */}
        <div className="card mb-5 border border-emerald-500/30">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="font-bold text-sm">קישור הזמנה למתאמנים</div>
            <button onClick={copyInvite} className="btn-primary px-3 py-1.5 text-xs shrink-0">
              {copyToast || 'העתק'}
            </button>
          </div>
          <div className="dark:bg-slate-900 bg-slate-100 rounded-lg px-3 py-2 text-[11px] font-mono truncate" dir="ltr">
            {inviteUrl}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Stat label="סה״כ מתאמנים" value={trainees.length} tone="emerald" />
          <Stat
            label="פעילים היום"
            value={Array.from(todayByUid.values()).filter(t => (t.sessionsToday || 0) + (t.mealsToday || 0) > 0).length}
            tone="emerald"
          />
          <Stat
            label="אימונים היום"
            value={Array.from(todayByUid.values()).reduce((a, t) => a + (t.sessionsToday || 0), 0)}
            tone="muted"
          />
          <Stat
            label="ארוחות היום"
            value={Array.from(todayByUid.values()).reduce((a, t) => a + (t.mealsToday || 0), 0)}
            tone="muted"
          />
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 mb-3">
          <input
            type="search"
            placeholder="חיפוש: אימייל, שם"
            value={q}
            onChange={e => setQ(e.target.value)}
            className="input-field !text-sm !py-1.5 !px-2.5 !w-64 !text-right"
            dir="rtl"
          />
          <div className="flex-1" />
          <div className="text-[10px] text-muted-most">מציג {shown.length} מתוך {trainees.length}</div>
        </div>

        {/* Trainees list — card grid on desktop, stack on mobile */}
        {!loaded && <div className="text-center text-muted py-10 text-sm">טוען…</div>}
        {loaded && trainees.length === 0 && (
          <div className="card text-center py-10 text-sm text-muted-most space-y-2">
            <div className="font-semibold text-main">עדיין אין לך מתאמנים</div>
            <div>שלח את קישור ההזמנה למעלה. כשהמתאמן יתחבר דרכו הוא יופיע כאן.</div>
          </div>
        )}
        {loaded && trainees.length > 0 && (
          <div className="grid gap-3">
            {shown.map(u => {
              const t = todayByUid.get(u.uid);
              const active = (t?.sessionsToday || 0) + (t?.mealsToday || 0) > 0;
              return (
                <div key={u.uid} className={`card !p-3 flex flex-wrap items-center gap-3 border ${active ? 'border-emerald-500/40' : 'border-subtle'}`}>
                  {u.photoURL
                    ? <img src={u.photoURL} className="w-11 h-11 rounded-full object-cover shrink-0" alt="" />
                    : <div className="w-11 h-11 rounded-full bg-slate-500/15 flex items-center justify-center text-sm font-bold text-muted shrink-0">{(u.email || u.displayName || '?').slice(0,1).toUpperCase()}</div>}
                  <div className="flex-1 min-w-[160px]">
                    <div className="font-bold text-sm truncate" dir="ltr">{u.email || '(אין אימייל)'}</div>
                    {u.displayName && <div className="text-[11px] text-muted truncate">{u.displayName}</div>}
                    <div className="text-[10px] text-muted-most mt-0.5" dir="ltr">
                      התחבר: {absDate(u.coachAcceptedAt)} · נראה לאחרונה: {relTime(u.lastSeenAt)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px] shrink-0">
                    <TodayChip label="🏋️" today={t?.sessionsToday} total={t?.sessionsTotal} tone="emerald" />
                    <TodayChip label="🍽" today={t?.mealsToday} total={t?.mealsTotal} tone="amber" />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => navigate({ page: 'coach-view', traineeUid: u.uid })}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                    >פתח כמתאמן</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'muted' }) {
  const cls = tone === 'emerald' ? 'text-emerald-500' : 'text-main';
  return (
    <div className="card !p-3 text-right">
      <div className="text-[10px] uppercase tracking-wider text-muted-most">{label}</div>
      <div className={`text-2xl font-bold font-mono mt-0.5 ${cls}`} dir="ltr">{value}</div>
    </div>
  );
}

function TodayChip({ label, today, total, tone }: { label: string; today?: number | null; total?: number | null; tone: 'emerald' | 'amber' }) {
  const t = today ?? 0;
  const bg = t > 0
    ? (tone === 'emerald' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300')
    : 'bg-slate-500/10 text-muted';
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-mono ${bg}`}>
      <span>{label}</span>
      <span className="font-bold">{today == null ? '…' : today}</span>
      {total != null && total > 0 && <span className="text-[9px] opacity-70">/ {total}</span>}
    </div>
  );
}
