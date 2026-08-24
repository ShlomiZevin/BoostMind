import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppReport, ReportPlaceTag, ReportStatus, Route } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { AdminNav } from './AdminNav';

// Desktop-only reports management. Denser than ReportsPanel (which is a
// mobile-first modal) — a table with copy-text/copy-id, quick status changes,
// delete, filters, search, and stats. Bookmarkable at #/reports-admin.
//
// Reachable via Settings → מפתחים → the "ניהול משימות" card, or by typing
// the URL. Deliberately NOT locked to Shlomi's session — the reports uid
// below is hardcoded to the owner uid, so the link works regardless of who
// is signed in. Kept private by not surfacing it anywhere shareable.
// On mobile the page tells you it's desktop-only rather than trying to
// squeeze the table onto a phone.

// The reports source of truth. This page always targets Shlomi's collection,
// regardless of which account is signed in — the link is meant to be sharable
// (or bookmark-able) by Shlomi across sessions/devices without being an admin
// on the current login.
const REPORTS_UID = 'user_6724';

const STATUSES: { id: ReportStatus; he: string; cls: string; short: string }[] = [
  { id: 'open',        he: 'פתוח',       short: 'פתוח',    cls: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30' },
  { id: 'in-progress', he: 'בטיפול',     short: 'בטיפול',  cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
  { id: 'on-hold',     he: 'לא להתחיל',  short: 'המתנה',   cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30' },
  { id: 'done',        he: 'הושלם',      short: 'סגור',    cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  { id: 'wont-do',     he: 'לא רלוונטי', short: 'בוטל',    cls: 'bg-slate-500/15 text-muted border-subtle' },
];
const PLACES: { id: ReportPlaceTag; he: string; tone: string }[] = [
  { id: 'exercise',  he: 'אימונים', tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  { id: 'food',      he: 'תזונה',   tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  { id: 'marketing', he: 'מרקטינג', tone: 'bg-violet-500/15 text-violet-700 dark:text-violet-300' },
  { id: 'general',   he: 'כללי',    tone: 'bg-slate-500/15 text-muted' },
];

const statusOf = (id: ReportStatus) => STATUSES.find(s => s.id === id) || STATUSES[0];
const placeOf  = (id: ReportPlaceTag) => PLACES.find(p => p.id === id) || PLACES.find(p => p.id === 'general')!;

// Short "3d", "5h", "12m" relative labels so a table row stays compact.
function relTime(ts: number): string {
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

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }
function absDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function ReportsAdminPage({ navigate }: { navigate: (r: Route) => void }) {
  // Bind to the OWNER's reports specifically, not the signed-in user's own
  // reports collection. See REPORTS_UID note above.
  const firestore = useFirestore(REPORTS_UID);
  const firestoreRef = useRef(firestore);
  firestoreRef.current = firestore;

  const [reports, setReports] = useState<AppReport[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>('open');
  const [placeFilter, setPlaceFilter] = useState<ReportPlaceTag | 'all'>('all');
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);

  async function reload() {
    const list = await firestoreRef.current.listReports();
    setReports(list);
    setLoaded(true);
  }
  useEffect(() => { void reload(); }, []);

  function showToast(text: string) {
    setToast(text);
    setTimeout(() => setToast(null), 1600);
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`הועתק ${label}`);
    } catch {
      showToast('העתקה נכשלה');
    }
  }

  async function setStatus(r: AppReport, status: ReportStatus) {
    setBusyRow(r.id);
    try {
      await firestoreRef.current.updateReport(r.id, { status });
      setReports(prev => prev.map(x => x.id === r.id ? { ...x, status } : x));
    } finally {
      setBusyRow(null);
    }
  }

  async function setPlaceTag(r: AppReport, place: ReportPlaceTag) {
    setBusyRow(r.id);
    try {
      await firestoreRef.current.updateReport(r.id, { place });
      setReports(prev => prev.map(x => x.id === r.id ? { ...x, place } : x));
    } finally {
      setBusyRow(null);
    }
  }

  async function setKind(r: AppReport, kind: AppReport['kind']) {
    setBusyRow(r.id);
    try {
      await firestoreRef.current.updateReport(r.id, { kind });
      setReports(prev => prev.map(x => x.id === r.id ? { ...x, kind } : x));
    } finally {
      setBusyRow(null);
    }
  }

  async function saveText(r: AppReport, text: string) {
    const clean = text.trim();
    if (!clean || clean === r.text) return;
    setBusyRow(r.id);
    try {
      await firestoreRef.current.updateReport(r.id, { text: clean });
      setReports(prev => prev.map(x => x.id === r.id ? { ...x, text: clean } : x));
      showToast('הטקסט עודכן');
    } finally {
      setBusyRow(null);
    }
  }

  // Which row is currently in "edit text" mode + its draft value.
  const [editingText, setEditingText] = useState<{ id: string; draft: string } | null>(null);

  async function del(r: AppReport) {
    if (!confirm(`למחוק את המשימה #${r.num ?? '?'} לצמיתות?`)) return;
    setBusyRow(r.id);
    try {
      await firestoreRef.current.deleteReport(r.id);
      setReports(prev => prev.filter(x => x.id !== r.id));
      showToast('נמחק');
    } finally {
      setBusyRow(null);
    }
  }

  const shown = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    return reports.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (placeFilter !== 'all' && r.place !== placeFilter) return false;
      if (qLower && !`${r.num ?? ''} ${r.id} ${r.text}`.toLowerCase().includes(qLower)) return false;
      return true;
    });
  }, [reports, statusFilter, placeFilter, q]);

  const counts = useMemo(() => {
    const c = { open: 0, 'in-progress': 0, 'on-hold': 0, done: 0, 'wont-do': 0 } as Record<ReportStatus, number>;
    for (const r of reports) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [reports]);

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <div className="page-bg min-h-screen">
      {/* Desktop-only guard. The table is dense on purpose — on a phone it
          would be a mess. Ask the user to open it on a bigger screen instead
          of degrading to a mobile fallback. */}
      <div className="md:hidden fixed inset-0 flex items-center justify-center p-8 z-50 dark:bg-slate-950 bg-slate-50" dir="rtl">
        <div className="max-w-sm text-center space-y-3">
          <div className="text-4xl">🖥️</div>
          <div className="font-bold text-lg">דף ניהול משימות — לדסקטופ בלבד</div>
          <div className="text-sm text-muted">
            הדף הזה נבנה לניהול מהיר על מסך רחב עם עמודות, קיצורי דרך והעתקה.
            במובייל יש את דיווחי הבאגים הרגילים בהגדרות → מפתחים.
          </div>
          <button
            onClick={() => navigate({ page: 'home' })}
            className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm"
          >חזרה לבית</button>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:block">
        <AdminNav current="reports-admin" navigate={navigate} onReload={reload} />
      </div>
      <div className="hidden md:block max-w-6xl mx-auto p-6" dir="rtl">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">ניהול משימות</h1>
          <div className="text-xs text-muted mt-0.5">
            דיווחים שנשלחו מתוך האפליקציה — עריכה מהירה, סטטוס, ומחיקה.
          </div>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-5 gap-3 mb-4">
          {(['open', 'in-progress', 'on-hold', 'done', 'wont-do'] as ReportStatus[]).map(s => {
            const st = statusOf(s);
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(active ? 'all' : s)}
                className={`card !p-3 text-right border ${
                  active ? 'border-emerald-500/60 ring-1 ring-emerald-500/40' : 'border-subtle'
                } dark:hover:bg-slate-800/60 hover:bg-slate-50`}
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-most">{st.he}</div>
                <div className="text-2xl font-bold font-mono mt-0.5" dir="ltr">{counts[s] || 0}</div>
              </button>
            );
          })}
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-most">סטטוס:</span>
            {(['all', ...STATUSES.map(s => s.id)] as (ReportStatus | 'all')[]).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-[11px] font-semibold px-2 py-1 rounded-md border ${
                  statusFilter === s
                    ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-subtle text-muted hover:text-main'
                }`}
              >{s === 'all' ? 'הכל' : statusOf(s).short}</button>
            ))}
          </div>
          <div className="w-px h-6 bg-subtle mx-1" />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-most">מקום:</span>
            {(['all', ...PLACES.map(p => p.id)] as (ReportPlaceTag | 'all')[]).map(p => (
              <button
                key={p}
                onClick={() => setPlaceFilter(p)}
                className={`text-[11px] font-semibold px-2 py-1 rounded-md border ${
                  placeFilter === p
                    ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-subtle text-muted hover:text-main'
                }`}
              >{p === 'all' ? 'הכל' : placeOf(p).he}</button>
            ))}
          </div>
          <div className="flex-1" />
          <input
            type="search"
            placeholder="חיפוש: מספר, טקסט, id"
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
                  <th className="text-right px-3 py-2 w-12">#</th>
                  <th className="text-right px-3 py-2 w-24">סטטוס</th>
                  <th className="text-right px-3 py-2 w-20">מקום</th>
                  <th className="text-right px-3 py-2 w-14">סוג</th>
                  <th className="text-right px-3 py-2">טקסט</th>
                  <th className="text-right px-3 py-2 w-24">נוצר</th>
                  <th className="text-right px-3 py-2 w-44">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {!loaded && (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-most">טוען…</td></tr>
                )}
                {loaded && shown.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-most">אין משימות שמתאימות לפילטרים.</td></tr>
                )}
                {shown.map(r => {
                  const st = statusOf(r.status);
                  const pl = placeOf(r.place);
                  const isExp = expanded.has(r.id);
                  const preview = r.text.split('\n')[0].slice(0, 100);
                  const isMultiline = r.text.length > 100 || r.text.includes('\n');
                  const busy = busyRow === r.id;
                  return (
                    <tr key={r.id} className="border-t border-subtle align-top hover:bg-slate-500/[.03]">
                      <td className="px-3 py-2 font-mono text-xs text-muted-most" dir="ltr">
                        #{r.num ?? '?'}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={r.status}
                          onChange={e => void setStatus(r, e.target.value as ReportStatus)}
                          disabled={busy}
                          className={`text-[11px] font-semibold rounded border px-1.5 py-0.5 ${st.cls} disabled:opacity-50`}
                          dir="rtl"
                        >
                          {STATUSES.map(s => <option key={s.id} value={s.id}>{s.he}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={r.place}
                          onChange={e => void setPlaceTag(r, e.target.value as ReportPlaceTag)}
                          disabled={busy}
                          className={`text-[10px] font-semibold rounded px-1 py-0.5 border-0 ${pl.tone} disabled:opacity-50`}
                          dir="rtl"
                        >
                          {PLACES.map(p => <option key={p.id} value={p.id}>{p.he}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={r.kind}
                          onChange={e => void setKind(r, e.target.value as AppReport['kind'])}
                          disabled={busy}
                          className="text-xs bg-transparent border-0 text-muted disabled:opacity-50"
                          dir="rtl"
                          title={r.kind}
                        >
                          <option value="bug">🐞 באג</option>
                          <option value="feature">✨ פיצ׳ר</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right leading-relaxed">
                        {editingText?.id === r.id ? (
                          <div className="space-y-1">
                            <textarea
                              value={editingText.draft}
                              onChange={e => setEditingText({ id: r.id, draft: e.target.value })}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                  void saveText(r, editingText.draft);
                                  setEditingText(null);
                                }
                                if (e.key === 'Escape') setEditingText(null);
                              }}
                              autoFocus
                              rows={Math.max(3, editingText.draft.split('\n').length)}
                              className="w-full input-field !text-sm !py-2 !text-right resize-y"
                              dir="rtl"
                            />
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-most">
                              <button
                                onClick={() => { void saveText(r, editingText.draft); setEditingText(null); }}
                                className="px-2 py-0.5 rounded bg-emerald-600 text-white font-semibold"
                              >שמור</button>
                              <button
                                onClick={() => setEditingText(null)}
                                className="px-2 py-0.5 rounded border border-subtle"
                              >ביטול</button>
                              <span className="text-muted-most">Cmd/Ctrl+Enter · Esc</span>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="group cursor-text"
                            onDoubleClick={() => setEditingText({ id: r.id, draft: r.text })}
                            title="דאבל-קליק לעריכה"
                          >
                            <div className={`whitespace-pre-wrap ${isExp ? '' : 'line-clamp-2'}`}>{isExp ? r.text : preview}</div>
                            <div className="mt-1 flex items-center gap-2">
                              {isMultiline && (
                                <button
                                  onClick={() => toggleExpand(r.id)}
                                  className="text-[10px] text-emerald-600 dark:text-emerald-400"
                                >{isExp ? 'קפל' : 'הרחב'}</button>
                              )}
                              <button
                                onClick={() => setEditingText({ id: r.id, draft: r.text })}
                                className="text-[10px] text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                              >ערוך</button>
                            </div>
                            {r.resolution && (
                              <div className="mt-2 pt-2 border-t border-subtle text-[11px] text-muted">
                                <span className="font-bold text-muted-most">פתרון: </span>
                                <span className={isExp ? 'whitespace-pre-wrap' : 'line-clamp-1'}>{r.resolution}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted" title={absDate(r.createdAt)} dir="ltr">
                        {relTime(r.createdAt)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            onClick={() => copy(r.text, 'טקסט')}
                            className="text-[10px] font-semibold px-2 py-1 rounded border border-subtle hover:bg-slate-500/10"
                            title="העתק את הטקסט של המשימה"
                          >העתק טקסט</button>
                          <button
                            onClick={() => copy(r.id, `id (${r.id})`)}
                            className="text-[10px] font-semibold px-2 py-1 rounded border border-subtle hover:bg-slate-500/10"
                            title={r.id}
                          >העתק id</button>
                          {typeof r.num === 'number' && (
                            <button
                              onClick={() => copy(`#${r.num}`, `#${r.num}`)}
                              className="text-[10px] font-semibold px-2 py-1 rounded border border-subtle hover:bg-slate-500/10"
                              title={`העתק #${r.num}`}
                            >#</button>
                          )}
                          {r.screenshotBase64 && (
                            <a
                              href={r.screenshotBase64}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] font-semibold px-2 py-1 rounded border border-subtle hover:bg-slate-500/10 inline-flex items-center gap-1"
                              title="פתח את צילום המסך"
                            >📷</a>
                          )}
                          <button
                            onClick={() => void del(r)}
                            disabled={busy}
                            className="text-[10px] font-semibold px-2 py-1 rounded border border-red-500/40 text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                            title="מחק לצמיתות"
                          >מחק</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-subtle text-[10px] text-muted-most flex items-center justify-between">
            <span>מציג {shown.length} מתוך {reports.length}</span>
            <span>מאוחסן ב-Firestore · <span dir="ltr">users/{REPORTS_UID}/reports</span></span>
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
