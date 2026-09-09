import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, getCountFromServer, getDocs, orderBy, query, limit as fbLimit } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Route } from '../types';
import { AdminNav } from './AdminNav';
import { setUserAdmin, isAdminEmail } from '../config/admins';

// Desktop-only users management. Reads `users_index` directly — same
// obscurity-as-security posture as reports-admin (the URL is the secret).
// Emails are the primary label; displayName + uid drop to secondary.
//
// Enriched per-user with:
//   • LLM cost (USD) + call count — from ai_usage, last 30 days
//   • Training sessions count      — getCountFromServer on users/{uid}/freeSessions
//   • Meals count                  — getCountFromServer on users/{uid}/mealLogs
// This is the page Shlomi uses to monitor that nothing has exploded.

const OWNER_UID = 'user_6724';
const LLM_WINDOW_MS = 30 * 86_400_000; // 30 days
const AI_USAGE_CAP = 10_000;
const ENRICHMENT_CAP = 100;

type UserRow = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  firstSeenAt?: number;
  lastSeenAt?: number;
  signInCount?: number;
  firstReferrer?: string | null;
  firstUa?: string;
  // Runtime admin flag — toggled from this page via setUserAdmin().
  // Reflects the users_index doc's `isAdmin` field.
  isAdmin?: boolean;
};
type LlmStat = { cost: number; calls: number; inputTokens: number; outputTokens: number };
type Activity = { sessions: number | null; meals: number | null };

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }
function absDate(ts?: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
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
  if (d < 30) return `${d}d`;
  return `${Math.round(d / 30)}mo`;
}
function fmtUsd(v: number): string {
  if (v >= 100) return `$${v.toFixed(0)}`;
  if (v >= 10)  return `$${v.toFixed(1)}`;
  if (v >= 1)   return `$${v.toFixed(2)}`;
  if (v > 0)    return `$${v.toFixed(3)}`;
  return '$0';
}

type SortKey = 'firstSeen' | 'lastSeen' | 'signIns' | 'email' | 'llmCost' | 'sessions' | 'meals';

export function UsersAdminPage({ navigate }: { navigate: (r: Route) => void }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [llmByUid, setLlmByUid] = useState<Map<string, LlmStat>>(new Map());
  const [activityByUid, setActivityByUid] = useState<Map<string, Activity>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [llmLoaded, setLlmLoaded] = useState(false);
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('lastSeen');
  const [sortAsc, setSortAsc] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showOwner, setShowOwner] = useState(false);
  const abortRef = useRef(false);

  async function reload() {
    setLoaded(false);
    setLlmLoaded(false);
    try {
      const [usersSnap, aiSnap] = await Promise.all([
        getDocs(query(collection(db, 'users_index'), orderBy('firstSeenAt', 'desc'), fbLimit(500))),
        getDocs(query(collection(db, 'ai_usage'), orderBy('ts', 'desc'), fbLimit(AI_USAGE_CAP))),
      ]);
      if (abortRef.current) return;

      // Fold ai_usage by uid, capped to the last 30 days.
      const cutoff = Date.now() - LLM_WINDOW_MS;
      const byUid = new Map<string, LlmStat>();
      for (const d of aiSnap.docs) {
        const row = d.data() as any;
        if (typeof row.ts !== 'number' || row.ts < cutoff) continue;
        const key = row.uid || '(anon)';
        const prev = byUid.get(key) || { cost: 0, calls: 0, inputTokens: 0, outputTokens: 0 };
        prev.cost += Number(row.cost_usd) || 0;
        prev.calls += 1;
        prev.inputTokens += Number(row.input_tokens) || 0;
        prev.outputTokens += Number(row.output_tokens) || 0;
        byUid.set(key, prev);
      }
      const userList = usersSnap.docs.map(d => d.data() as UserRow);
      setUsers(userList);
      setLlmByUid(byUid);
      setLlmLoaded(true);
    } finally {
      if (!abortRef.current) setLoaded(true);
    }
  }
  useEffect(() => { abortRef.current = false; void reload(); return () => { abortRef.current = true; }; }, []);

  // Enrichment: sessions + meals count per user, one aggregation query each.
  // Fires after users load, capped so a huge user list doesn't hammer Firestore.
  useEffect(() => {
    if (!loaded || users.length === 0) return;
    let cancelled = false;
    const targets = users.slice(0, ENRICHMENT_CAP);
    Promise.all(targets.map(async u => {
      const [ss, ml] = await Promise.all([
        getCountFromServer(collection(db, 'users', u.uid, 'freeSessions')).catch(() => null),
        getCountFromServer(collection(db, 'users', u.uid, 'mealLogs')).catch(() => null),
      ]);
      return { uid: u.uid, sessions: ss ? ss.data().count : null, meals: ml ? ml.data().count : null };
    })).then(rows => {
      if (cancelled) return;
      const m = new Map<string, Activity>();
      rows.forEach(r => m.set(r.uid, { sessions: r.sessions, meals: r.meals }));
      setActivityByUid(m);
    });
    return () => { cancelled = true; };
  }, [loaded, users]);

  function showToast(t: string) {
    setToast(t);
    setTimeout(() => setToast(null), 1600);
  }
  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); showToast(`הועתק ${label}`); }
    catch { showToast('העתקה נכשלה'); }
  }

  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const list = users.filter(u => {
      if (!showOwner && u.uid === OWNER_UID) return false;
      if (!ql) return true;
      return `${u.email ?? ''} ${u.displayName ?? ''} ${u.uid} ${u.firstReferrer ?? ''}`.toLowerCase().includes(ql);
    });
    const llmCost = (uid: string) => llmByUid.get(uid)?.cost || 0;
    const sessionsN = (uid: string) => activityByUid.get(uid)?.sessions || 0;
    const mealsN = (uid: string) => activityByUid.get(uid)?.meals || 0;
    list.sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      switch (sortKey) {
        case 'email':     return dir * ((a.email || a.uid).localeCompare(b.email || b.uid));
        case 'signIns':   return dir * ((a.signInCount || 0) - (b.signInCount || 0));
        case 'firstSeen': return dir * ((a.firstSeenAt || 0) - (b.firstSeenAt || 0));
        case 'lastSeen':  return dir * ((a.lastSeenAt || a.firstSeenAt || 0) - (b.lastSeenAt || b.firstSeenAt || 0));
        case 'llmCost':   return dir * (llmCost(a.uid) - llmCost(b.uid));
        case 'sessions':  return dir * (sessionsN(a.uid) - sessionsN(b.uid));
        case 'meals':     return dir * (mealsN(a.uid) - mealsN(b.uid));
      }
    });
    return list;
  }, [users, q, sortKey, sortAsc, showOwner, llmByUid, activityByUid]);

  const stats = useMemo(() => {
    const real = users.filter(u => u.uid !== OWNER_UID);
    const today = Date.now() - 86_400_000;
    const week = Date.now() - 7 * 86_400_000;
    let totalCost = 0;
    let totalCalls = 0;
    let maxCost = 0;
    let maxCostUid: string | null = null;
    for (const u of real) {
      const s = llmByUid.get(u.uid);
      if (!s) continue;
      totalCost += s.cost;
      totalCalls += s.calls;
      if (s.cost > maxCost) { maxCost = s.cost; maxCostUid = u.uid; }
    }
    return {
      total: real.length,
      newToday: real.filter(u => (u.firstSeenAt || 0) >= today).length,
      activeToday: real.filter(u => (u.lastSeenAt || 0) >= today).length,
      activeWeek: real.filter(u => (u.lastSeenAt || 0) >= week).length,
      llmCost: totalCost,
      llmCalls: totalCalls,
      maxCost,
      maxCostUid,
    };
  }, [users, llmByUid]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortAsc(s => !s);
    else { setSortKey(k); setSortAsc(k === 'email'); }
  }

  // Cost color tier so a heavy user pops without needing to hunt the table.
  function costTone(usd: number): string {
    if (usd >= 5)   return 'text-red-500 font-bold';
    if (usd >= 1)   return 'text-amber-600 dark:text-amber-400 font-semibold';
    if (usd > 0)    return 'text-emerald-600 dark:text-emerald-400';
    return 'text-muted-most';
  }

  return (
    <div className="page-bg min-h-screen">
      {/* Mobile guard */}
      <div className="md:hidden fixed inset-0 flex items-center justify-center p-8 z-50 dark:bg-slate-950 bg-slate-50" dir="rtl">
        <div className="max-w-sm text-center space-y-3">
          <div className="text-4xl">🖥️</div>
          <div className="font-bold text-lg">משתמשים — לדסקטופ בלבד</div>
          <div className="text-sm text-muted">רשימת המשתמשים דחוסה מדי למובייל. פתח על מסך רחב.</div>
          <button onClick={() => navigate({ page: 'home' })} className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm">חזרה לבית</button>
        </div>
      </div>

      <div className="hidden md:block">
        <AdminNav current="users-admin" navigate={navigate} onReload={reload} />
      </div>
      <div className="hidden md:block max-w-7xl mx-auto p-6" dir="rtl">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">משתמשים</h1>
            <div className="text-xs text-muted mt-0.5">אימייל · אימונים · ארוחות · עלות AI · תדירות</div>
          </div>
          <div className="text-[10px] text-muted-most">חלון AI: 30 יום אחרונים · העשרה: עד {ENRICHMENT_CAP} משתמשים</div>
        </div>

        {/* Stat tiles — 6 across so LLM cost + calls sit next to the user counts */}
        <div className="grid grid-cols-6 gap-3 mb-4">
          <Stat label="משתמשים" value={stats.total} sub="ללא שלומי" tone="emerald" />
          <Stat label="חדשים היום" value={stats.newToday} tone="emerald" />
          <Stat label="פעילים השבוע" value={stats.activeWeek} tone="emerald" />
          <Stat
            label="עלות AI (30ד)"
            valueText={llmLoaded ? fmtUsd(stats.llmCost) : '…'}
            sub={stats.maxCost > 0 ? `שיא בודד: ${fmtUsd(stats.maxCost)}` : undefined}
            tone={stats.llmCost >= 20 ? 'red' : stats.llmCost >= 5 ? 'amber' : 'muted'}
          />
          <Stat label="קריאות AI" value={stats.llmCalls} tone="muted" />
          <Stat
            label="עלות ליוזר ממוצע"
            valueText={llmLoaded && stats.total > 0 ? fmtUsd(stats.llmCost / stats.total) : '…'}
            tone="muted"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-3">
          <label className="flex items-center gap-1.5 text-[11px] text-muted">
            <input type="checkbox" checked={showOwner} onChange={e => setShowOwner(e.target.checked)} />
            הצג גם את שלומי (מסונן כברירת מחדל)
          </label>
          <div className="flex-1" />
          <input
            type="search"
            placeholder="חיפוש: אימייל, שם, uid"
            value={q}
            onChange={e => setQ(e.target.value)}
            className="input-field !text-sm !py-1.5 !px-2.5 !w-64 !text-right"
            dir="rtl"
          />
        </div>

        {/* Table — fixed layout for stable column widths */}
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed" dir="rtl">
              <colgroup>
                <col style={{ width: '48px' }} />
                <col />
                <col style={{ width: '150px' }} />
                <col style={{ width: '84px' }} />
                <col style={{ width: '84px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '84px' }} />
                <col style={{ width: '84px' }} />
                <col style={{ width: '130px' }} />
              </colgroup>
              <thead className="dark:bg-slate-900 bg-slate-100 text-[10px] uppercase tracking-wider text-muted-most">
                <tr>
                  <th className="text-right px-3 py-2"></th>
                  <SortTh label="אימייל / שם" k="email" cur={sortKey} asc={sortAsc} onClick={toggleSort} align="right" />
                  <th className="text-right px-3 py-2">uid</th>
                  <SortTh label="🏋️ אימונים" k="sessions" cur={sortKey} asc={sortAsc} onClick={toggleSort} align="left" />
                  <SortTh label="🍽 ארוחות" k="meals" cur={sortKey} asc={sortAsc} onClick={toggleSort} align="left" />
                  <SortTh label="💸 AI (30ד)" k="llmCost" cur={sortKey} asc={sortAsc} onClick={toggleSort} align="left" />
                  <SortTh label="ראשונה" k="firstSeen" cur={sortKey} asc={sortAsc} onClick={toggleSort} align="left" />
                  <SortTh label="אחרונה" k="lastSeen" cur={sortKey} asc={sortAsc} onClick={toggleSort} align="left" />
                  <th className="text-right px-3 py-2">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {!loaded && <tr><td colSpan={9} className="text-center py-12 text-muted-most">טוען…</td></tr>}
                {loaded && shown.length === 0 && users.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-16">
                    <div className="text-sm font-semibold mb-1">אין עדיין רשומות ב-users_index</div>
                    <div className="text-[11px] text-muted-most max-w-md mx-auto leading-relaxed">
                      הרישום מתמלא רק כשמישהו מתחבר לאפליקציה. פתח דפדפן פרטי, התחבר עם חשבון Google כלשהו, ורענן פה — שורה תיווצר אוטומטית.
                    </div>
                  </td></tr>
                )}
                {loaded && shown.length === 0 && users.length > 0 && (
                  <tr><td colSpan={9} className="text-center py-12 text-muted-most">אין תוצאות שמתאימות לפילטרים.</td></tr>
                )}
                {shown.map((u, i) => {
                  const llm = llmByUid.get(u.uid);
                  const act = activityByUid.get(u.uid);
                  return (
                    <tr key={u.uid} className={`border-t border-subtle align-middle hover:bg-slate-500/[.04] ${i % 2 === 1 ? 'bg-slate-500/[.02]' : ''}`}>
                      <td className="px-3 py-2">
                        {u.photoURL
                          ? <img src={u.photoURL} className="w-8 h-8 rounded-full object-cover" alt="" />
                          : <div className="w-8 h-8 rounded-full bg-slate-500/15 flex items-center justify-center text-[11px] font-bold text-muted">{(u.email || u.displayName || '?').slice(0, 1).toUpperCase()}</div>}
                      </td>
                      <td className="px-3 py-2 text-right leading-tight overflow-hidden">
                        <div className="font-semibold text-sm truncate" dir="ltr" title={u.email || ''}>
                          {u.email || <span className="text-muted-most italic">— אין אימייל —</span>}
                        </div>
                        {u.displayName && <div className="text-[11px] text-muted truncate mt-0.5">{u.displayName}</div>}
                        <div className="text-[10px] text-muted-most mt-0.5" dir="ltr">
                          {u.signInCount || 1} כניסות
                          {u.firstReferrer ? ` · ${new URL(u.firstReferrer).hostname.replace(/^www\./, '')}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[10px] font-mono text-muted-most" dir="ltr" title={u.uid}>
                        <span className="truncate block">{u.uid.slice(0, 18)}{u.uid.length > 18 ? '…' : ''}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-sm" dir="ltr">
                        {act === undefined ? <span className="text-muted-most">…</span>
                          : act?.sessions == null ? <span className="text-muted-most">—</span>
                          : <span className={act.sessions > 0 ? 'text-emerald-500 font-semibold' : 'text-muted-most'}>{act.sessions}</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-sm" dir="ltr">
                        {act === undefined ? <span className="text-muted-most">…</span>
                          : act?.meals == null ? <span className="text-muted-most">—</span>
                          : <span className={act.meals > 0 ? 'text-amber-500 font-semibold' : 'text-muted-most'}>{act.meals}</span>}
                      </td>
                      <td className="px-3 py-2 text-right leading-tight" dir="ltr">
                        {!llmLoaded ? <span className="text-muted-most text-xs">…</span>
                          : llm ? (
                            <div>
                              <div className={`font-mono text-sm ${costTone(llm.cost)}`} title={`${llm.inputTokens.toLocaleString()} in / ${llm.outputTokens.toLocaleString()} out`}>
                                {fmtUsd(llm.cost)}
                              </div>
                              <div className="text-[10px] text-muted-most font-mono">{llm.calls} calls</div>
                            </div>
                          ) : <span className="text-muted-most text-xs font-mono">$0</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted" title={absDate(u.firstSeenAt)} dir="ltr">{relTime(u.firstSeenAt)}</td>
                      <td className="px-3 py-2 text-xs text-muted" title={absDate(u.lastSeenAt)} dir="ltr">{relTime(u.lastSeenAt)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 flex-wrap">
                          {u.email && (
                            <button onClick={() => copy(u.email!, 'אימייל')} className="text-[10px] font-semibold px-2 py-1 rounded border border-subtle hover:bg-slate-500/10" title="העתק אימייל">אימייל</button>
                          )}
                          <button onClick={() => copy(u.uid, 'uid')} className="text-[10px] font-semibold px-2 py-1 rounded border border-subtle hover:bg-slate-500/10" title={u.uid}>uid</button>
                          <AdminToggle
                            user={u}
                            onChange={(next) => setUsers(prev => prev.map(x => x.uid === u.uid ? { ...x, isAdmin: next } : x))}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-subtle text-[10px] text-muted-most flex items-center justify-between">
            <span>מציג {shown.length} מתוך {users.length}</span>
            <span>מקורות: users_index · ai_usage · users/*/freeSessions · users/*/mealLogs</span>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg" dir="rtl">
          {toast}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, valueText, sub, tone }: {
  label: string;
  value?: number;
  valueText?: string;
  sub?: string;
  tone: 'emerald' | 'amber' | 'red' | 'muted';
}) {
  const toneCls = tone === 'emerald' ? 'text-emerald-500'
    : tone === 'amber' ? 'text-amber-500'
    : tone === 'red' ? 'text-red-500'
    : 'text-main';
  return (
    <div className="card !p-3 text-right">
      <div className="text-[10px] uppercase tracking-wider text-muted-most">{label}</div>
      <div className={`text-xl font-bold font-mono mt-0.5 ${toneCls}`} dir="ltr">{valueText ?? value ?? 0}</div>
      {sub && <div className="text-[10px] text-muted-more mt-0.5">{sub}</div>}
    </div>
  );
}

function SortTh({ label, k, cur, asc, onClick, align }: {
  label: string; k: SortKey; cur: SortKey; asc: boolean;
  onClick: (k: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const active = cur === k;
  const alignCls = align === 'left' ? 'text-right' : 'text-right';
  return (
    <th className={`${alignCls} px-3 py-2 cursor-pointer select-none whitespace-nowrap`} onClick={() => onClick(k)}>
      <span className={active ? 'text-main' : ''}>{label}</span>
      <span className="ms-1 text-[8px]">{active ? (asc ? '▲' : '▼') : ''}</span>
    </th>
  );
}

// Grant / revoke admin on a user_index row. Founding admins (in the
// hardcoded ADMIN_EMAILS set) show as a locked "admin" pill — you can't
// revoke Shlomi or Sergio from the UI on purpose.
function AdminToggle({ user, onChange }: { user: UserRow; onChange: (isAdmin: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const hardcoded = isAdminEmail(user.email) && !user.isAdmin;
  // "isAdmin now" = either the runtime flag OR being in the hardcoded list.
  const isAdminNow = !!user.isAdmin || isAdminEmail(user.email);

  async function toggle() {
    if (hardcoded) return;
    setBusy(true); setErr(null);
    try {
      const next = !user.isAdmin;
      await setUserAdmin(user.uid, next);
      onChange(next);
    } catch (e: any) {
      setErr(e?.message || 'שגיאה');
    } finally {
      setBusy(false);
    }
  }

  if (hardcoded) {
    return (
      <span
        className="text-[10px] font-bold px-2 py-1 rounded border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
        title="Founding admin — hardcoded in config/admins.ts"
      >★ admin</span>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={err || (isAdminNow ? 'לחץ להסיר הרשאת admin' : 'הענק הרשאת admin')}
      className={`text-[10px] font-bold px-2 py-1 rounded border transition-colors disabled:opacity-40 ${
        isAdminNow
          ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/15'
          : 'border-subtle text-muted hover:text-main hover:bg-slate-500/10'
      }`}
    >
      {busy ? '…' : isAdminNow ? '★ admin' : '+ admin'}
    </button>
  );
}
