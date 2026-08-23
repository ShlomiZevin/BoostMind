import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, orderBy, query, limit, where } from 'firebase/firestore';
import { db } from '../config/firebase';

// Launch-day admin dashboard. Reads:
//   analytics_events — every page view / sign-in / register
//   users_index      — one row per registered user (see utils/analytics.ts)
//
// The two things you need at launch:
//   1. A funnel — how many people saw the home page, how many reached the
//      login screen, how many actually signed up. Bad conversion at any step
//      tells you where to look.
//   2. A list of who registered — name/email/first-seen, so you can reach out
//      to individuals when someone signs up.
//
// Deliberately lightweight — one collapsible card that lives in Settings
// under מפתחים. Reads happen only when the card is expanded so it costs
// nothing on the normal render path.

type EventRow = {
  id: string;
  type: string;
  ts: number;
  visitor?: string;
  session?: string;
  uid?: string | null;
  email?: string | null;
  path?: string;
  referrer?: string | null;
  ua?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

type UserRow = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  firstSeenAt?: number;
  lastSeenAt?: number;
  signInCount?: number;
  firstUa?: string;
  firstReferrer?: string | null;
};

const DAY = 86_400_000;
const RANGES = [
  { key: '24h', he: '24 שעות', ms: DAY },
  { key: '7d',  he: '7 ימים',  ms: 7 * DAY },
  { key: '30d', he: '30 ימים', ms: 30 * DAY },
  { key: 'all', he: 'הכל',      ms: null as number | null },
] as const;
type RangeKey = typeof RANGES[number]['key'];

// Count "uniques" = distinct visitor OR uid (uid preferred once we have one),
// so the same person opening the app twice in a session isn't double-counted.
function countUnique(events: EventRow[]): number {
  const seen = new Set<string>();
  for (const e of events) {
    seen.add(e.uid || e.visitor || e.session || e.id);
  }
  return seen.size;
}

function fmtWhen(ts?: number): string {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'עכשיו';
  if (diff < 60 * 60_000) return `לפני ${Math.round(diff / 60_000)} דק'`;
  if (diff < 24 * 60 * 60_000) return `לפני ${Math.round(diff / (60 * 60_000))} שע'`;
  if (diff < 7 * DAY) return `לפני ${Math.round(diff / DAY)} ימים`;
  return new Date(ts).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

export function AnalyticsAdmin({ flat }: { flat?: boolean } = {}) {
  // Two modes:
  //   flat=false (default) — collapsible card, used inside Settings. Reads
  //   only fire when the user expands the card.
  //   flat=true            — full-page dashboard (see AdminPage). Always
  //   expanded, no card chrome around it.
  const [expanded, setExpanded] = useState(!!flat);
  const [range, setRange] = useState<RangeKey>('24h');
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastLoadAt, setLastLoadAt] = useState<number>(0);
  const loadedForRange = useRef<RangeKey | null>(null);

  async function load(force = false) {
    if (busy) return;
    // Cache in-memory for 30s within the same range unless the user hits refresh.
    if (!force && loadedForRange.current === range && Date.now() - lastLoadAt < 30_000) return;
    setBusy(true);
    setErr(null);
    try {
      const r = RANGES.find(x => x.key === range)!;
      const evCol = collection(db, 'analytics_events');
      const evQ = r.ms == null
        ? query(evCol, orderBy('ts', 'desc'), limit(2000))
        : query(evCol, where('ts', '>=', Date.now() - r.ms), orderBy('ts', 'desc'), limit(2000));
      const usrQ = query(collection(db, 'users_index'), orderBy('firstSeenAt', 'desc'), limit(200));

      const [evSnap, usrSnap] = await Promise.all([getDocs(evQ), getDocs(usrQ)]);
      const evs: EventRow[] = evSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const usrs: UserRow[] = usrSnap.docs.map(d => ({ ...(d.data() as any) }));
      setEvents(evs);
      setUsers(usrs);
      loadedForRange.current = range;
      setLastLoadAt(Date.now());
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  // Fetch on first expand and whenever the range changes while expanded.
  useEffect(() => {
    if (expanded) void load();
  }, [expanded, range]);

  const stats = useMemo(() => {
    const all = events || [];
    const home = all.filter(e => e.type === 'home_view');
    const login = all.filter(e => e.type === 'login_view');
    const signIn = all.filter(e => e.type === 'sign_in');
    const register = all.filter(e => e.type === 'register');
    // Conversion rate: registrations / home visits. Only meaningful when
    // enough home views exist, but even a tiny 2/3 tells us the funnel is alive.
    const conv = home.length > 0 ? Math.round((register.length / home.length) * 100) : null;
    return {
      home,
      login,
      signIn,
      register,
      homeUnique: countUnique(home),
      loginUnique: countUnique(login),
      signInUnique: countUnique(signIn),
      registerUnique: countUnique(register),
      conv,
    };
  }, [events]);

  // UTM / referrer breakdown for home views — where visitors came from. Only
  // the top handful; long tail collapses into "אחר".
  const sources = useMemo(() => {
    const all = (events || []).filter(e => e.type === 'home_view');
    const counts = new Map<string, number>();
    for (const e of all) {
      let src = e.utm_source
        || (e.referrer ? (() => {
          try { return new URL(e.referrer!).hostname.replace(/^www\./, ''); }
          catch { return 'ref'; }
        })() : 'direct');
      counts.set(src, (counts.get(src) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [events]);

  const platforms = useMemo(() => {
    const all = (events || []).filter(e => e.type === 'home_view');
    const counts = new Map<string, number>();
    for (const e of all) {
      counts.set(e.ua || '?', (counts.get(e.ua || '?') || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [events]);

  return (
    <div className={flat ? 'space-y-4' : 'card mb-4 border border-emerald-500/30'} dir="rtl">
      {!flat && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-between text-right"
        >
          <div>
            <div className="font-medium">אנליטיקה של השקה</div>
            <div className="text-xs text-muted">
              visits · signups · funnel — לחץ להצגה
            </div>
          </div>
          <span className="text-muted text-lg">{expanded ? '▾' : '←'}</span>
        </button>
      )}

      {expanded && (
        <div className={flat ? 'space-y-4' : 'mt-4 space-y-4'}>
          {/* Range picker */}
          <div className="flex gap-1.5">
            {RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`flex-1 py-1.5 rounded-lg text-[12px] font-bold ${
                  range === r.key
                    ? 'bg-emerald-500 text-white'
                    : 'bg-subtle text-muted'
                }`}
              >{r.he}</button>
            ))}
            <button
              onClick={() => void load(true)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-bold bg-subtle text-muted"
              title="רענן"
              disabled={busy}
            >
              {busy ? '...' : '⟳'}
            </button>
          </div>

          {err && <div className="text-xs text-red-500">{err}</div>}

          {events == null && !err ? (
            <div className="text-[12px] text-muted py-4 text-center">טוען…</div>
          ) : (
            <>
              {/* Funnel — the main story of the launch. */}
              <div className="grid grid-cols-4 gap-2">
                <FunnelCell label="בית" total={stats.home.length} unique={stats.homeUnique} tone="emerald" />
                <FunnelCell label="Login" total={stats.login.length} unique={stats.loginUnique} tone="blue" />
                <FunnelCell label="כניסות" total={stats.signIn.length} unique={stats.signInUnique} tone="violet" />
                <FunnelCell label="הרשמות" total={stats.register.length} unique={stats.registerUnique} tone="amber" highlight />
              </div>

              {stats.conv != null && (
                <div className="text-[11px] text-muted text-center">
                  {' '}המרה מבית להרשמה{': '}
                  <span className="font-mono font-bold text-main">{stats.conv}%</span>
                </div>
              )}

              {/* Sources */}
              {sources.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-muted-most mb-1.5">מקורות תנועה</div>
                  <div className="space-y-1">
                    {sources.map(([src, n]) => {
                      const max = Math.max(...sources.map(s => s[1]));
                      const pct = Math.round((n / max) * 100);
                      return (
                        <div key={src} className="flex items-center gap-2 text-[12px]">
                          <span className="w-24 shrink-0 truncate" dir="ltr">{src}</span>
                          <div className="flex-1 h-2 rounded bg-subtle overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-mono font-bold w-8 text-left">{n}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Platforms */}
              {platforms.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-muted-most mb-1.5">פלטפורמות</div>
                  <div className="flex flex-wrap gap-1.5">
                    {platforms.map(([p, n]) => (
                      <span key={p} className="text-[11px] px-2 py-1 rounded-full bg-subtle" dir="ltr">
                        {p} · <span className="font-mono font-bold">{n}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent registrations */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-muted-most mb-1.5">
                  הרשמות אחרונות ({users?.length ?? 0})
                </div>
                {(users?.length ?? 0) === 0 ? (
                  <div className="text-[12px] text-muted py-3 text-center">אף אחד עוד לא נרשם</div>
                ) : (
                  <div className="rounded-xl border border-subtle overflow-hidden">
                    {(users || []).map((u, i) => (
                      <div
                        key={u.uid}
                        className={`flex items-center gap-3 px-3 py-2.5 ${i > 0 ? 'border-t border-subtle' : ''}`}
                      >
                        {u.photoURL ? (
                          <img src={u.photoURL} alt="" className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-subtle flex items-center justify-center text-muted text-sm font-bold">
                            {(u.displayName || u.email || '?').slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0 text-right">
                          <div className="font-bold text-[13px] truncate">
                            {u.displayName || u.email || u.uid}
                          </div>
                          <div className="text-[11px] text-muted truncate" dir="ltr">
                            {u.email || u.uid}
                          </div>
                        </div>
                        <div className="text-left shrink-0">
                          <div className="text-[11px] text-muted">{fmtWhen(u.firstSeenAt)}</div>
                          <div className="text-[10px] text-muted-more">
                            <span className="font-mono">{u.signInCount || 1}</span> כניסות
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-[10px] text-muted-more text-center">
                עודכן לאחרונה{' '}{fmtWhen(lastLoadAt)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FunnelCell({
  label, total, unique, tone, highlight,
}: {
  label: string;
  total: number;
  unique: number;
  tone: 'emerald' | 'blue' | 'violet' | 'amber';
  highlight?: boolean;
}) {
  const toneCls =
    tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' :
    tone === 'blue'    ? 'text-blue-600 dark:text-blue-400' :
    tone === 'violet'  ? 'text-violet-600 dark:text-violet-400' :
                         'text-amber-600 dark:text-amber-400';
  return (
    <div className={`rounded-xl px-2 py-2.5 text-center ${
      highlight ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-subtle'
    }`}>
      <div className={`text-[19px] font-bold font-mono ${toneCls}`} dir="ltr">{total}</div>
      <div className="text-[10px] text-muted mt-0.5">{label}</div>
      {unique !== total && (
        <div className="text-[9px] text-muted-more mt-0.5" dir="ltr">
          {unique} unique
        </div>
      )}
    </div>
  );
}
