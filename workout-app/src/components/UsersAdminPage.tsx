import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, orderBy, query, limit as fbLimit } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Route } from '../types';
import { AdminNav } from './AdminNav';

// Desktop-only users management. Reads `users_index` directly — same
// obscurity-as-security posture as reports-admin (the URL is the secret).
// Emails are the primary label; displayName + uid drop to secondary.

const OWNER_UID = 'user_6724';

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
};

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

type SortKey = 'firstSeen' | 'lastSeen' | 'signIns' | 'email';

export function UsersAdminPage({ navigate }: { navigate: (r: Route) => void }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('lastSeen');
  const [sortAsc, setSortAsc] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showOwner, setShowOwner] = useState(false);
  const abortRef = useRef(false);

  async function reload() {
    setLoaded(false);
    try {
      const snap = await getDocs(query(collection(db, 'users_index'), orderBy('firstSeenAt', 'desc'), fbLimit(500)));
      if (abortRef.current) return;
      setUsers(snap.docs.map(d => d.data() as UserRow));
    } finally {
      if (!abortRef.current) setLoaded(true);
    }
  }
  useEffect(() => { abortRef.current = false; void reload(); return () => { abortRef.current = true; }; }, []);

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
    list.sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      switch (sortKey) {
        case 'email':     return dir * ((a.email || a.uid).localeCompare(b.email || b.uid));
        case 'signIns':   return dir * ((a.signInCount || 0) - (b.signInCount || 0));
        case 'firstSeen': return dir * ((a.firstSeenAt || 0) - (b.firstSeenAt || 0));
        case 'lastSeen':  return dir * ((a.lastSeenAt || a.firstSeenAt || 0) - (b.lastSeenAt || b.firstSeenAt || 0));
      }
    });
    return list;
  }, [users, q, sortKey, sortAsc, showOwner]);

  const counts = useMemo(() => {
    const withEmail = users.filter(u => u.email && u.uid !== OWNER_UID).length;
    const withoutEmail = users.filter(u => !u.email && u.uid !== OWNER_UID).length;
    const today = Date.now() - 86_400_000;
    const week = Date.now() - 7 * 86_400_000;
    const activeToday = users.filter(u => (u.lastSeenAt || 0) >= today && u.uid !== OWNER_UID).length;
    const activeWeek = users.filter(u => (u.lastSeenAt || 0) >= week && u.uid !== OWNER_UID).length;
    return { withEmail, withoutEmail, activeToday, activeWeek };
  }, [users]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortAsc(s => !s);
    else { setSortKey(k); setSortAsc(k === 'email'); }
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
      <div className="hidden md:block max-w-6xl mx-auto p-6" dir="rtl">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">משתמשים</h1>
          <div className="text-xs text-muted mt-0.5">אימייל · פעילות · תדירות · מקור</div>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="card !p-3 text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-most">סה״כ עם אימייל</div>
            <div className="text-2xl font-bold font-mono mt-0.5" dir="ltr">{counts.withEmail}</div>
          </div>
          <div className="card !p-3 text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-most">בלי אימייל</div>
            <div className="text-2xl font-bold font-mono mt-0.5" dir="ltr">{counts.withoutEmail}</div>
          </div>
          <div className="card !p-3 text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-most">פעילים היום</div>
            <div className="text-2xl font-bold font-mono mt-0.5 text-emerald-500" dir="ltr">{counts.activeToday}</div>
          </div>
          <div className="card !p-3 text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-most">פעילים השבוע</div>
            <div className="text-2xl font-bold font-mono mt-0.5 text-emerald-500" dir="ltr">{counts.activeWeek}</div>
          </div>
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
            placeholder="חיפוש: אימייל, שם, uid, מקור"
            value={q}
            onChange={e => setQ(e.target.value)}
            className="input-field !text-sm !py-1.5 !px-2.5 !w-64 !text-right"
            dir="rtl"
          />
        </div>

        {/* Table */}
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir="rtl">
              <thead className="dark:bg-slate-900 bg-slate-100 text-[10px] uppercase tracking-wider text-muted-most">
                <tr>
                  <th className="text-right px-3 py-2 w-8"></th>
                  <SortTh label="אימייל / שם" k="email" cur={sortKey} asc={sortAsc} onClick={toggleSort} />
                  <th className="text-right px-3 py-2 w-32">uid</th>
                  <SortTh label="ראשונה" k="firstSeen" cur={sortKey} asc={sortAsc} onClick={toggleSort} />
                  <SortTh label="אחרונה" k="lastSeen" cur={sortKey} asc={sortAsc} onClick={toggleSort} />
                  <SortTh label="כניסות" k="signIns" cur={sortKey} asc={sortAsc} onClick={toggleSort} />
                  <th className="text-right px-3 py-2">מקור</th>
                  <th className="text-right px-3 py-2 w-28">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {!loaded && <tr><td colSpan={8} className="text-center py-12 text-muted-most">טוען…</td></tr>}
                {loaded && shown.length === 0 && users.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-16">
                    <div className="text-sm font-semibold mb-1">אין עדיין רשומות ב-users_index</div>
                    <div className="text-[11px] text-muted-most max-w-md mx-auto leading-relaxed">
                      הרישום מתמלא רק כשמישהו מתחבר לאפליקציה. פתח דפדפן פרטי, התחבר עם חשבון Google כלשהו, ורענן פה — שורה תיווצר אוטומטית.
                    </div>
                  </td></tr>
                )}
                {loaded && shown.length === 0 && users.length > 0 && (
                  <tr><td colSpan={8} className="text-center py-12 text-muted-most">אין תוצאות שמתאימות לפילטרים.</td></tr>
                )}
                {shown.map((u, i) => (
                  <tr key={u.uid} className={`border-t border-subtle align-top hover:bg-slate-500/[.03] ${i % 2 === 1 ? 'bg-slate-500/[.02]' : ''}`}>
                    <td className="px-3 py-2">
                      {u.photoURL
                        ? <img src={u.photoURL} className="w-8 h-8 rounded-full object-cover" alt="" />
                        : <div className="w-8 h-8 rounded-full bg-slate-500/15 flex items-center justify-center text-[11px] font-bold text-muted">{(u.email || u.displayName || '?').slice(0, 1).toUpperCase()}</div>}
                    </td>
                    <td className="px-3 py-2 text-right leading-tight">
                      <div className="font-semibold text-sm" dir="ltr">{u.email || <span className="text-muted-most italic">— אין אימייל —</span>}</div>
                      {u.displayName && <div className="text-[11px] text-muted mt-0.5">{u.displayName}</div>}
                    </td>
                    <td className="px-3 py-2 text-[10px] font-mono text-muted-most" dir="ltr" title={u.uid}>
                      {u.uid.slice(0, 18)}{u.uid.length > 18 ? '…' : ''}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted" title={absDate(u.firstSeenAt)} dir="ltr">{relTime(u.firstSeenAt)}</td>
                    <td className="px-3 py-2 text-xs text-muted" title={absDate(u.lastSeenAt)} dir="ltr">{relTime(u.lastSeenAt)}</td>
                    <td className="px-3 py-2 text-xs font-mono text-muted" dir="ltr">{u.signInCount || 1}</td>
                    <td className="px-3 py-2 text-[11px] text-muted truncate max-w-[200px]" dir="ltr" title={u.firstReferrer || ''}>
                      {u.firstReferrer ? new URL(u.firstReferrer).hostname.replace(/^www\./, '') : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {u.email && (
                          <button onClick={() => copy(u.email!, 'אימייל')} className="text-[10px] font-semibold px-2 py-1 rounded border border-subtle hover:bg-slate-500/10" title="העתק אימייל">אימייל</button>
                        )}
                        <button onClick={() => copy(u.uid, 'uid')} className="text-[10px] font-semibold px-2 py-1 rounded border border-subtle hover:bg-slate-500/10" title={u.uid}>uid</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-subtle text-[10px] text-muted-most flex items-center justify-between">
            <span>מציג {shown.length} מתוך {users.length}</span>
            <span>מקור: users_index · טעון: 500 אחרונים</span>
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

function SortTh({ label, k, cur, asc, onClick }: { label: string; k: SortKey; cur: SortKey; asc: boolean; onClick: (k: SortKey) => void }) {
  const active = cur === k;
  return (
    <th className="text-right px-3 py-2 cursor-pointer select-none" onClick={() => onClick(k)}>
      <span className={active ? 'text-main' : ''}>{label}</span>
      <span className="ms-1 text-[8px]">{active ? (asc ? '▲' : '▼') : ''}</span>
    </th>
  );
}
