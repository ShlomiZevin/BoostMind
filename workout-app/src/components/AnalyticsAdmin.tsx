import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, deleteDoc, doc, getCountFromServer, getDocs, orderBy, query, limit, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

// Owner's uid — filtered out of every count on this page so the launch
// dashboard reflects real users, not the person looking at it.
const OWNER_UID = 'user_6724';

// Launch-day admin dashboard. Reads two collections we write ourselves:
//   analytics_events   — every anonymous / authed page event
//   users_index/{uid}  — one row per registered user
//
// It is NOT Google Analytics. Every number on this page comes from a
// document written directly to your Firestore, from your users' devices,
// with no sampling and no external service in the middle — which is why
// the funnel steps mirror the SDK/HTML you actually wrote, and why the
// user list can be enriched with per-user usage counts from the app's
// own subcollections.
//
// Funnel is intentionally 3 steps, in the Hebrew reading order (right→left
// in an RTL grid, so `home` sits at the visual start and `register` at
// the visual end goal):
//     צפייה בבית  ←  כניסה  ←  הרשמה
// login_view is deliberately dropped from the primary display — it is
// the DOM mount of the login screen, not a decision; conflating it with
// "signed in" hid the real conversion.

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

type UserActivity = { sessions: number | null; meals: number | null };

// One row per Anthropic response, written by the Cloud Run server. Cost is
// pre-computed on write using MODEL_PRICING in server/index.js so the client
// never has to know how much a model costs.
type AiUsageRow = {
  uid?: string | null;
  model?: string | null;
  endpoint?: string;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  ts: number;
};

const DAY = 86_400_000;
const RANGES = [
  { key: '24h', he: '24 שעות', ms: DAY },
  { key: '7d',  he: '7 ימים',  ms: 7 * DAY },
  { key: '30d', he: '30 ימים', ms: 30 * DAY },
  { key: 'all', he: 'הכל',      ms: null as number | null },
] as const;
type RangeKey = typeof RANGES[number]['key'];

// A "unique" is one identity — the aliased Firebase uid if we already have
// it, otherwise the localStorage visitor id (survives sessions on the same
// device), otherwise the tab-scoped session id. So one person opening the
// site twice on the same phone counts once.
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
  //   flat=false — collapsible card, used inside Settings. Reads only fire
  //                after the user expands.
  //   flat=true  — full-page dashboard (see AdminPage). Always expanded.
  const [expanded, setExpanded] = useState(!!flat);
  const [range, setRange] = useState<RangeKey>('24h');
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [activity, setActivity] = useState<Map<string, UserActivity>>(new Map());
  const [aiUsage, setAiUsage] = useState<AiUsageRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastLoadAt, setLastLoadAt] = useState<number>(0);
  const loadedForRange = useRef<RangeKey | null>(null);

  async function load(force = false) {
    if (busy) return;
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
      const aiCol = collection(db, 'ai_usage');
      const aiQ = r.ms == null
        ? query(aiCol, orderBy('ts', 'desc'), limit(5000))
        : query(aiCol, where('ts', '>=', Date.now() - r.ms), orderBy('ts', 'desc'), limit(5000));

      const [evSnap, usrSnap, aiSnap] = await Promise.all([getDocs(evQ), getDocs(usrQ), getDocs(aiQ)]);
      setAiUsage(aiSnap.docs.map(d => d.data() as AiUsageRow));
      // Drop anything attributable to the owner. Anonymous events (no uid)
      // stay in — they're real visitors before sign-in.
      const evs: EventRow[] = evSnap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter(e => e.uid !== OWNER_UID);
      const usrs: UserRow[] = usrSnap.docs
        .map(d => ({ ...(d.data() as any) }))
        .filter(u => u.uid !== OWNER_UID);

      // One-shot cleanup: earlier builds wrote a users_index doc for the
      // owner (registration counted itself). Delete it if it's still there,
      // idempotent — a second run is a silent no-op. Same for stray owner
      // events (up to 500 per pass, plenty for a bootstrap wipe).
      void cleanupOwnerPollution(evSnap.docs, usrSnap.docs);

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

  // Enrich the user list with real usage — count of training sessions and
  // meal logs under users/{uid}/*. Uses Firestore's aggregation API so each
  // count is a single billed read regardless of how large the collection is.
  useEffect(() => {
    if (!users || users.length === 0) return;
    let cancelled = false;
    const CAP = 100;
    Promise.all(users.slice(0, CAP).map(async u => {
      const [ss, ml] = await Promise.all([
        getCountFromServer(collection(db, 'users', u.uid, 'freeSessions')).catch(() => null),
        getCountFromServer(collection(db, 'users', u.uid, 'mealLogs')).catch(() => null),
      ]);
      return {
        uid: u.uid,
        sessions: ss ? ss.data().count : null,
        meals: ml ? ml.data().count : null,
      };
    })).then(rows => {
      if (cancelled) return;
      const map = new Map<string, UserActivity>();
      rows.forEach(r => map.set(r.uid, { sessions: r.sessions, meals: r.meals }));
      setActivity(map);
    });
    return () => { cancelled = true; };
  }, [users]);

  useEffect(() => {
    if (expanded) void load();
  }, [expanded, range]);

  const stats = useMemo(() => {
    const all = events || [];
    const home = all.filter(e => e.type === 'home_view');
    const login = all.filter(e => e.type === 'login_view');
    const signIn = all.filter(e => e.type === 'sign_in');
    const register = all.filter(e => e.type === 'register');
    const homeUnique = countUnique(home);
    const registerUnique = countUnique(register);
    // Conversion is measured on uniques (one register per person, one home
    // view per device). Counting raw events would let a signed-in refresh
    // inflate the numerator.
    const conv = homeUnique > 0 ? Math.round((registerUnique / homeUnique) * 100) : null;
    return {
      home, login, signIn, register,
      homeUnique,
      loginUnique: countUnique(login),
      signInUnique: countUnique(signIn),
      registerUnique,
      conv,
    };
  }, [events]);

  const sources = useMemo(() => {
    const all = (events || []).filter(e => e.type === 'home_view');
    const counts = new Map<string, number>();
    for (const e of all) {
      // "direct" = no referrer, no utm — someone who typed the URL, opened
      // the installed PWA, or came from an app that strips referrer (Whatsapp,
      // Instagram in-app browser). Rendered in Hebrew below so it isn't a
      // mystery English word floating in the list.
      let src = e.utm_source
        || (e.referrer ? (() => {
          try { return new URL(e.referrer!).hostname.replace(/^www\./, ''); }
          catch { return 'ref'; }
        })() : 'direct');
      counts.set(src, (counts.get(src) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [events]);

  // Human-facing label for a source key. English/domain names stay as-is
  // (LTR); the special "direct" bucket becomes Hebrew "כניסה ישירה".
  function sourceLabel(src: string): { text: string; ltr: boolean } {
    if (src === 'direct') return { text: 'כניסה ישירה', ltr: false };
    return { text: src, ltr: true };
  }

  // LLM cost — total across everyone and top-10 users by spend. Cost
  // pre-computed server-side (see MODEL_PRICING in server/index.js) so a
  // client model / pricing drift never changes historical numbers.
  const llmTotals = useMemo(() => {
    const rows = aiUsage || [];
    let totalUsd = 0;
    let totalIn = 0;
    let totalOut = 0;
    const byUser = new Map<string, { cost: number; input: number; output: number; msgs: number }>();
    const byModel = new Map<string, { cost: number; msgs: number }>();
    for (const r of rows) {
      const c = r.cost_usd || 0;
      const i = r.input_tokens || 0;
      const o = r.output_tokens || 0;
      totalUsd += c; totalIn += i; totalOut += o;
      const u = r.uid || '(anonymous)';
      const bu = byUser.get(u) || { cost: 0, input: 0, output: 0, msgs: 0 };
      bu.cost += c; bu.input += i; bu.output += o; bu.msgs += 1;
      byUser.set(u, bu);
      const m = r.model || '(unknown)';
      const bm = byModel.get(m) || { cost: 0, msgs: 0 };
      bm.cost += c; bm.msgs += 1;
      byModel.set(m, bm);
    }
    const users = [...byUser.entries()].sort((a, b) => b[1].cost - a[1].cost).slice(0, 10);
    const models = [...byModel.entries()].sort((a, b) => b[1].cost - a[1].cost);
    return { totalUsd, totalIn, totalOut, msgs: rows.length, users, models };
  }, [aiUsage]);

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
              visits · registrations · funnel — לחץ להצגה
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
              {/* ─── The funnel ───────────────────────────────────
                  Three steps in Hebrew reading order (right → left):
                  צפייה בבית (start) ← כניסה ← הרשמה (goal).
                  Grid renders items in that order because the container
                  is dir="rtl", so JSX order is flipped visually. */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-muted-most mb-2">משפך שיווקי</div>
                <div className="grid grid-cols-3 gap-2">
                  <FunnelCell
                    label="צפייה בבית"
                    hint="פתחו את matzav.ai"
                    total={stats.home.length}
                    unique={stats.homeUnique}
                    tone="emerald"
                  />
                  <FunnelCell
                    label="כניסה"
                    hint="נכנסו עם Google"
                    total={stats.signIn.length}
                    unique={stats.signInUnique}
                    tone="violet"
                    showArrow
                  />
                  <FunnelCell
                    label="הרשמה"
                    hint="משתמשים חדשים"
                    total={stats.registerUnique}
                    unique={stats.registerUnique}
                    tone="amber"
                    highlight
                    showArrow
                  />
                </div>
                {stats.conv != null && (
                  <div className="text-[11px] text-muted text-center mt-2">
                    המרה מבית להרשמה{': '}
                    <span className="font-mono font-bold text-main">{stats.conv}%</span>
                  </div>
                )}
              </div>

              {/* Sources — RTL layout: source name on the right (start), bar
                  in the middle, count on the left (end). Bar itself uses
                  logical direction so the fill grows from the START edge in
                  RTL, which visually reads as "leading with the biggest bar
                  on the right", not left-anchored like a Western chart. */}
              {sources.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-muted-most mb-1.5">מקורות תנועה</div>
                  <div className="space-y-1.5">
                    {sources.map(([src, n]) => {
                      const max = Math.max(...sources.map(s => s[1]));
                      const pct = Math.round((n / max) * 100);
                      const label = sourceLabel(src);
                      return (
                        <div key={src} className="flex items-center gap-2.5 text-[12px]">
                          <span
                            className="w-28 shrink-0 truncate text-right"
                            dir={label.ltr ? 'ltr' : 'rtl'}
                          >
                            {label.text}
                          </span>
                          <div className="flex-1 h-2 rounded bg-subtle overflow-hidden relative">
                            {/* Absolute-positioned fill anchored to the RTL start
                                edge (physical right) so the bar grows from the
                                right in Hebrew reading direction. */}
                            <div
                              className="absolute inset-y-0 right-0 bg-emerald-500 rounded"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-mono font-bold w-8 tabular-nums text-left" dir="ltr">{n}</span>
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

              {/* LLM cost — total across everyone in this range, plus top
                  users and models. Numbers come from ai_usage; the server
                  logs one doc per Anthropic response with token counts
                  and pre-computed USD cost. */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-muted-most mb-1.5">עלות LLM</div>
                {(aiUsage?.length ?? 0) === 0 ? (
                  <div className="text-[12px] text-muted py-3 text-center">
                    אין עדיין נתונים בטווח הזה — יופיע לאחר קריאות AI מהשרת החדש
                  </div>
                ) : (
                  <div className="rounded-xl border border-subtle overflow-hidden">
                    <div className="grid grid-cols-3 gap-0 divide-x divide-subtle" dir="ltr">
                      <div className="p-3 text-center">
                        <div className="text-[9px] text-muted-more font-bold tracking-widest">TOTAL</div>
                        <div className="text-[18px] font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          ${llmTotals.totalUsd.toFixed(2)}
                        </div>
                      </div>
                      <div className="p-3 text-center">
                        <div className="text-[9px] text-muted-more font-bold tracking-widest">MSGS</div>
                        <div className="text-[18px] font-bold font-mono">{llmTotals.msgs}</div>
                      </div>
                      <div className="p-3 text-center">
                        <div className="text-[9px] text-muted-more font-bold tracking-widest">IN / OUT</div>
                        <div className="text-[13px] font-bold font-mono">
                          {Math.round(llmTotals.totalIn / 1000)}k / {Math.round(llmTotals.totalOut / 1000)}k
                        </div>
                      </div>
                    </div>

                    {llmTotals.models.length > 0 && (
                      <div className="border-t border-subtle px-3 py-2 flex flex-wrap gap-1.5">
                        {llmTotals.models.slice(0, 4).map(([m, s]) => (
                          <span key={m} className="text-[11px] px-2 py-1 rounded-full bg-subtle inline-flex items-baseline gap-1" dir="ltr">
                            <span className="font-mono">{m}</span>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">${s.cost.toFixed(2)}</span>
                            <span className="text-muted-more">· {s.msgs}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {llmTotals.users.length > 0 && (
                      <div className="border-t border-subtle">
                        <div className="text-[10px] text-muted-more font-semibold px-3 pt-2 pb-1">משתמשים לפי הוצאה</div>
                        {llmTotals.users.map(([uid, s], i) => (
                          <div key={uid} className={`flex items-center gap-2 px-3 py-1.5 text-[12px] ${i > 0 ? 'border-t border-subtle' : ''}`}>
                            <span className="flex-1 min-w-0 truncate" dir="ltr">
                              {uid === '(anonymous)' ? 'ללא uid' : uid}
                            </span>
                            <span className="font-mono text-muted-more">{s.msgs} msg</span>
                            <span className="font-mono font-bold w-16 text-left text-emerald-600 dark:text-emerald-400" dir="ltr">
                              ${s.cost.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Users who registered */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-muted-most mb-1.5">
                  משתמשים שנרשמו ({users?.length ?? 0})
                </div>
                {(users?.length ?? 0) === 0 ? (
                  <div className="text-[12px] text-muted py-3 text-center">אף אחד עוד לא נרשם</div>
                ) : (
                  <div className="rounded-xl border border-subtle overflow-hidden">
                    {(users || []).map((u, i) => {
                      const act = activity.get(u.uid);
                      return (
                        <div
                          key={u.uid}
                          className={`flex items-center gap-3 px-3 py-2.5 ${i > 0 ? 'border-t border-subtle' : ''}`}
                        >
                          {u.photoURL ? (
                            <img src={u.photoURL} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-subtle flex items-center justify-center text-muted text-sm font-bold shrink-0">
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
                            {/* Real usage — training sessions + meals from the
                                app's own subcollections, not from the events log. */}
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              <UsageChip
                                label="אימונים"
                                value={act?.sessions}
                                tone="emerald"
                              />
                              <UsageChip
                                label="ארוחות"
                                value={act?.meals}
                                tone="amber"
                              />
                            </div>
                          </div>
                          <div className="text-left shrink-0">
                            <div className="text-[11px] text-muted">{fmtWhen(u.firstSeenAt)}</div>
                            <div className="text-[10px] text-muted-more">
                              <span className="font-mono">{u.signInCount || 1}</span> כניסות
                            </div>
                          </div>
                        </div>
                      );
                    })}
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

// ─── Small building blocks ────────────────────────────────────────

function FunnelCell({
  label, hint, total, unique, tone, highlight, showArrow,
}: {
  label: string;
  hint?: string;
  total: number;
  unique: number;
  tone: 'emerald' | 'blue' | 'violet' | 'amber';
  highlight?: boolean;
  showArrow?: boolean;
}) {
  const toneCls =
    tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' :
    tone === 'blue'    ? 'text-blue-600 dark:text-blue-400' :
    tone === 'violet'  ? 'text-violet-600 dark:text-violet-400' :
                         'text-amber-600 dark:text-amber-400';
  return (
    <div className={`relative rounded-xl px-2 py-2.5 text-center ${
      highlight ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-subtle'
    }`}>
      {/* Funnel-flow arrow between cells. In an RTL container the previous
          cell is visually to the RIGHT of this one, so the arrow points ←
          (that direction reads as "coming from the previous step"). */}
      {showArrow && (
        <span aria-hidden="true" className="absolute top-1/2 -translate-y-1/2 -right-2 text-muted-most text-[13px] leading-none pointer-events-none select-none">
          ←
        </span>
      )}
      <div className={`text-[19px] font-bold font-mono ${toneCls}`} dir="ltr">{total}</div>
      <div className="text-[10px] text-muted mt-0.5">{label}</div>
      {hint && <div className="text-[9px] text-muted-more mt-0.5 truncate">{hint}</div>}
      {unique !== total && (
        <div className="text-[9px] text-muted-more mt-0.5" dir="ltr">
          {unique} unique
        </div>
      )}
    </div>
  );
}

// Backfill cleanup for the analytics collections. Nothing else does this —
// on first load the dashboard removes any lingering owner rows from earlier
// builds (before the client-side owner filter existed). Runs at most once
// per admin session; if the docs are already gone, the deletes 404 quietly.
let ownerCleanupDone = false;
async function cleanupOwnerPollution(
  eventDocs: { id: string; data: () => any }[],
  userDocs: { id: string; data: () => any }[],
): Promise<void> {
  if (ownerCleanupDone) return;
  ownerCleanupDone = true;
  try {
    const ownerUsr = userDocs.find(d => d.data()?.uid === OWNER_UID || d.id === OWNER_UID);
    if (ownerUsr) await deleteDoc(doc(db, 'users_index', OWNER_UID)).catch(() => {});

    const ownerEvents = eventDocs.filter(d => d.data()?.uid === OWNER_UID);
    if (ownerEvents.length === 0) return;
    // Firestore batches cap at 500 writes — plenty here.
    const batch = writeBatch(db);
    for (const d of ownerEvents.slice(0, 500)) {
      batch.delete(doc(db, 'analytics_events', d.id));
    }
    await batch.commit().catch(() => {});
  } catch { /* ignore — cleanup is best-effort */ }
}

function UsageChip({ label, value, tone }: { label: string; value: number | null | undefined; tone: 'emerald' | 'amber' }) {
  const toneCls = tone === 'emerald'
    ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
    : 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/20';
  const display = value == null ? '…' : value;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${toneCls}`}>
      <span className="font-mono font-bold tabular-nums">{display}</span>
      <span>{label}</span>
    </span>
  );
}
