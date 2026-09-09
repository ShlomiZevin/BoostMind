import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppReport, ReportComment, ReportKind, ReportPlaceTag, ReportStatus } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { compressImage } from '../hooks/usePhotos';
import { useAuth } from '../hooks/useAuth';
import { isBetaTesterEmail } from '../config/betaTesters';
import { isCoacherEmail } from '../config/coaches';
import { isAdminEmail } from '../config/admins';

// Capture notes in the app, while you are looking at the thing.
//
// The point is the round trip: instead of writing findings into WhatsApp and
// re-typing them into a session later, they land in Firestore where a session
// reads them directly. `place` and `status` exist for that reader — they are
// what let it answer "what is still open in תזונה" without being told.

const KINDS: { id: ReportKind; he: string; icon: string }[] = [
  { id: 'bug', he: 'באג', icon: '🐞' },
  { id: 'feature', he: 'פיצ׳ר', icon: '✨' },
];

const PLACES: { id: ReportPlaceTag; he: string; tone: string }[] = [
  { id: 'exercise',  he: 'אימונים', tone: 'bg-emerald-500 text-white' },
  { id: 'food',      he: 'תזונה',   tone: 'bg-amber-500 text-white' },
  { id: 'marketing', he: 'מרקטינג', tone: 'bg-violet-500 text-white' },
  { id: 'general',   he: 'כללי',    tone: 'bg-slate-500 text-white' },
];

const STATUSES: { id: ReportStatus; he: string; cls: string }[] = [
  { id: 'open',        he: 'פתוח',       cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  { id: 'in-progress', he: 'בטיפול',     cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  { id: 'on-hold',     he: 'לא להתחיל',  cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  { id: 'done',        he: 'הושלם',      cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  { id: 'wont-do',     he: 'לא רלוונטי', cls: 'bg-slate-500/15 text-muted' },
];

const placeOf = (id: ReportPlaceTag) => PLACES.find(p => p.id === id)!;
const statusOf = (id: ReportStatus) => STATUSES.find(s => s.id === id) || STATUSES[0];

export function ReportsPanel({ uid, onClose }: { uid: string; onClose: () => void }) {
  useBodyScrollLock();
  const firestore = useFirestore(uid);
  const firestoreRef = useRef(firestore);
  firestoreRef.current = firestore;

  // Who's viewing determines what they see. Admin/coacher = the full list
  // (triage view). Beta tester = ONLY their own submissions (the list they
  // filed themselves). Everyone else shouldn't have this panel open at all
  // — the trigger is gated in App/Settings.
  const { email: authEmail } = useAuth();
  const isAdmin = uid === 'user_6724' || isAdminEmail(authEmail);
  const isBeta = isBetaTesterEmail(authEmail);
  const isCoach = isCoacherEmail(authEmail);
  // Only Shlomi + coaches see everyone's reports; beta testers see their own.
  const viewAll = isAdmin || isCoach;

  const [reports, setReports] = useState<AppReport[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<ReportStatus | 'all'>('open');
  const [composing, setComposing] = useState(false);
  // Reports are written from the phone but resolved by a Claude session on the
  // desktop, so the list goes stale while the panel sits open. There is no
  // pull-to-refresh here (the panel is a fixed overlay, not a scroll container
  // that owns the gesture), hence an explicit button.
  const [refreshing, setRefreshing] = useState(false);

  // Compose state
  const [kind, setKind] = useState<ReportKind>('bug');
  const [place, setPlace] = useState<ReportPlaceTag>('general');
  const [text, setText] = useState('');
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function reload() {
    const list = await firestoreRef.current.listReports();
    setReports(await ensureSequentialNums(list));
    setLoaded(true);
  }

  // Backfill #NUM on any doc that predates the field. Runs at most once per
  // mount and does nothing if every report already has a num. Assigns based
  // on createdAt order (oldest = #1) so the numbering feels intuitive.
  async function ensureSequentialNums(list: AppReport[]): Promise<AppReport[]> {
    const missing = list.some(r => typeof r.num !== 'number');
    if (!missing) return list;
    const oldestFirst = [...list].sort((a, b) => a.createdAt - b.createdAt);
    let n = 0;
    const patched: AppReport[] = [];
    const writes: Promise<void>[] = [];
    for (const r of oldestFirst) {
      if (typeof r.num === 'number') {
        if (r.num > n) n = r.num;
        patched.push(r);
        continue;
      }
      n += 1;
      const withNum = { ...r, num: n };
      patched.push(withNum);
      writes.push(firestoreRef.current.updateReport(r.id, { num: n }).catch(() => {}));
    }
    await Promise.allSettled(writes);
    // Return in the original (newest-first) sort order that listReports gave us.
    const byId = new Map(patched.map(r => [r.id, r] as const));
    return list.map(r => byId.get(r.id) || r);
  }

  useEffect(() => {
    let cancelled = false;
    firestoreRef.current.listReports()
      .then(async r => {
        const withNums = await ensureSequentialNums(r);
        if (!cancelled) { setReports(withNums); setLoaded(true); }
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [uid]);

  // Beta testers see ONLY the reports they filed themselves — matched by
  // authorEmail (falls back to authorUid). Admin + coaches see everything.
  // The all reports live in one shared collection, so filtering here is what
  // makes the panel personal without moving data around.
  const mine = useMemo(() => {
    if (viewAll) return reports;
    return reports.filter(r =>
      (r.authorEmail && authEmail && r.authorEmail.toLowerCase() === authEmail.toLowerCase())
      || (r.authorUid && r.authorUid === uid)
    );
  }, [reports, viewAll, authEmail, uid]);
  const shown = useMemo(
    () => (filter === 'all' ? mine : mine.filter(r => r.status === filter)),
    [mine, filter],
  );

  const openCount = mine.filter(r => r.status === 'open').length;

  async function submit() {
    if (busy || !text.trim()) return;
    setBusy(true);
    try {
      // Stamp the author so beta-tester reports are attributable in the
      // shared collection. Admin/Shlomi submissions also carry his email
      // for consistency, but the filter above never restricts him.
      await firestoreRef.current.addReport({
        kind, place, text: text.trim(),
        screenshotBase64: shot || undefined,
      }, { uid, email: authEmail });
      setText(''); setShot(null); setComposing(false);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(r: AppReport, status: ReportStatus) {
    await firestoreRef.current.updateReport(r.id, { status });
    setReports(prev => prev.map(x => (x.id === r.id ? { ...x, status } : x)));
  }

  async function changePlace(r: AppReport, next: ReportPlaceTag) {
    await firestoreRef.current.updateReport(r.id, { place: next });
    setReports(prev => prev.map(x => (x.id === r.id ? { ...x, place: next } : x)));
  }

  // Editing an existing report — text + kind (bug/feature). Same pattern as
  // status/place so the row already has the mental model: chips for the kind,
  // a textarea with an explicit save button for the free-form text (blur is
  // ambiguous — the user might tap "cancel" and expect the field to revert).
  async function changeKind(r: AppReport, kind: ReportKind) {
    await firestoreRef.current.updateReport(r.id, { kind });
    setReports(prev => prev.map(x => (x.id === r.id ? { ...x, kind } : x)));
  }
  async function changeText(r: AppReport, text: string) {
    const clean = text.trim();
    if (!clean) return;
    await firestoreRef.current.updateReport(r.id, { text: clean });
    setReports(prev => prev.map(x => (x.id === r.id ? { ...x, text: clean } : x)));
  }

  return (
    <div className="fixed inset-0 z-[75] flex flex-col overlay-solid">
      <div className="flex items-center justify-between p-4 border-b border-subtle" dir="rtl">
        <div>
          <h2 className="font-bold text-lg flex items-center gap-2">
            <span>דיווחים</span>
            {/* Beta tester badge — tells the tester this is their scoped view.
                Only shows when the viewer is a tester AND not also an admin. */}
            {isBeta && !isAdmin && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/40 uppercase tracking-wider"
                title="אתה בטא-טסטר — רואה את הדיווחים שאתה שלחת"
              >
                בטא
              </span>
            )}
          </h2>
          <div className="text-[11px] text-muted">
            {openCount} פתוחים · {mine.length} {viewAll ? 'סה״כ' : 'שלי'}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={async () => {
              if (refreshing) return;
              setRefreshing(true);
              try { await reload(); } finally { setRefreshing(false); }
            }}
            aria-label="רענן"
            title="רענן"
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted dark:hover:bg-slate-800 hover:bg-slate-100 transition-colors disabled:opacity-50"
            disabled={refreshing}
          >
            <svg
              viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={refreshing ? 'animate-spin' : ''}
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
          <button onClick={onClose} aria-label="סגור" className="text-muted text-2xl leading-none w-10 h-10 flex items-center justify-center">×</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3" dir="rtl">
        {composing ? (
          <div className="card space-y-3">
            <div className="flex gap-1.5">
              {KINDS.map(k => (
                <button
                  key={k.id}
                  onClick={() => setKind(k.id)}
                  className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold ${
                    kind === k.id ? 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-subtle text-muted'
                  }`}
                >{k.icon} {k.he}</button>
              ))}
            </div>

            <div>
              <div className="text-[12px] text-muted mb-1.5">איפה</div>
              <div className="flex gap-1.5">
                {PLACES.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPlace(p.id)}
                    className={`flex-1 py-2 rounded-lg text-[12px] font-bold ${
                      place === p.id ? p.tone : 'bg-subtle text-muted'
                    }`}
                  >{p.he}</button>
                ))}
              </div>
            </div>

            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={5}
              autoFocus
              placeholder={kind === 'bug' ? 'מה קרה, ומה ציפית שיקרה?' : 'מה היית רוצה שיהיה כאן?'}
              className="w-full bg-subtle rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none"
            />

            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async e => {
                  const f = e.target.files?.[0];
                  if (f) { try { setShot(await compressImage(f, 1200, 0.7)); } catch { /* ignore */ } }
                  e.currentTarget.value = '';
                }}
              />
              <button onClick={() => fileRef.current?.click()} className="btn-secondary px-3 py-2 text-[12px]">
                📷 צילום מסך
              </button>
              {shot && (
                <div className="relative">
                  <img src={shot} alt="" className="w-12 h-12 rounded-lg object-cover border border-subtle" />
                  <button
                    onClick={() => setShot(null)}
                    className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs"
                  >×</button>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setComposing(false); setText(''); setShot(null); }} className="btn-secondary flex-1 py-2.5">
                ביטול
              </button>
              <button
                onClick={() => void submit()}
                disabled={busy || !text.trim()}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-40"
              >{busy ? 'שומר…' : 'שמור דיווח'}</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setComposing(true)}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-[14px]"
          >+ דיווח חדש</button>
        )}

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {([{ id: 'all' as const, he: 'הכול' }, ...STATUSES]).map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as ReportStatus | 'all')}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold ${
                filter === f.id ? 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-subtle text-muted'
              }`}
            >{f.he}</button>
          ))}
        </div>

        {!loaded ? (
          <div className="text-[12px] text-muted py-8 text-center">טוען…</div>
        ) : shown.length === 0 ? (
          <div className="card text-center py-10 text-[13px] text-muted">אין דיווחים בסטטוס הזה</div>
        ) : (
          shown.map(r => (
            <ReportRow key={r.id} report={r} onSetStatus={setStatus} onSetPlace={changePlace} onSetKind={changeKind} onSetText={changeText} onDeleted={reload} uid={uid} />
          ))
        )}
      </div>
    </div>
  );
}

function ReportRow({
  report, uid, onSetStatus, onSetPlace, onSetKind, onSetText, onDeleted,
}: {
  report: AppReport;
  uid: string;
  onSetStatus: (r: AppReport, s: ReportStatus) => void | Promise<void>;
  onSetPlace: (r: AppReport, p: ReportPlaceTag) => void | Promise<void>;
  onSetKind: (r: AppReport, k: ReportKind) => void | Promise<void>;
  onSetText: (r: AppReport, text: string) => void | Promise<void>;
  onDeleted: () => void | Promise<void>;
}) {
  const firestore = useFirestore(uid);
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Text editing — draft state so the user can revise freely before committing.
  // Kept out of the parent's report list until the user clicks "שמור".
  const [editingText, setEditingText] = useState(false);
  const [textDraft, setTextDraft] = useState(report.text);
  useEffect(() => { setTextDraft(report.text); }, [report.text]);
  const p = placeOf(report.place);
  const st = statusOf(report.status);

  return (
    <div className="card py-0 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-start gap-2.5 py-3 text-right">
        {/* Memorable sequential #NUM — the whole point is "handle task 42"
            works from memory (rep_1787499531519_juo2 sister-ask). Falls
            back to the kind emoji only if a doc pre-dates the field AND
            the backfill hasn't landed yet (should never happen after the
            first admin panel open). */}
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            if (typeof report.num === 'number') {
              navigator.clipboard.writeText(String(report.num)).catch(() => {});
            }
          }}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && typeof report.num === 'number') {
              e.stopPropagation();
              navigator.clipboard.writeText(String(report.num)).catch(() => {});
            }
          }}
          title={typeof report.num === 'number' ? `העתק מזהה #${report.num}` : ''}
          className="shrink-0 min-w-[36px] h-6 px-1.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-subtle inline-flex items-baseline justify-center gap-0.5 mt-0.5 cursor-pointer hover:border-emerald-500/40"
          dir="ltr"
        >
          {typeof report.num === 'number' ? (
            <>
              <span className="text-[10px] text-muted-more font-bold leading-none">#</span>
              <span className="text-[13px] font-bold font-mono leading-none tabular-nums text-main">{report.num}</span>
            </>
          ) : (
            <span className="text-base leading-none">{report.kind === 'bug' ? '🐞' : '✨'}</span>
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div dir="auto" className={`text-[13px] leading-snug ${open ? '' : 'line-clamp-2'}`}>{report.text}</div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-[12px] leading-none">{report.kind === 'bug' ? '🐞' : '✨'}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${p.tone}`}>{p.he}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${st.cls}`}>{st.he}</span>
            <span className="text-[10px] text-muted-more">
              {new Date(report.createdAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
            </span>
            {report.screenshotBase64 && <span className="text-[10px] text-muted-more">📷</span>}
            {/* Thread marker — lets a task carrying a written answer be spotted
                from the list without opening every row. Violet because that is
                the AI/shell colour everywhere else in the app. */}
            {!!report.comments?.length && (
              <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 inline-flex items-center gap-0.5">
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-3.9-.8L3 21l1.9-4.6A8.4 8.4 0 0 1 3 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 9 8.4z" />
                </svg>
                {report.comments.length}
              </span>
            )}
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-subtle py-3 space-y-3">
          {report.screenshotBase64 && (
            <img src={report.screenshotBase64} alt="" className="w-full rounded-lg border border-subtle" />
          )}

          {/* Editable text — the report body itself. Draft-then-commit
              (rep_1787488188098_sj3a); blur doesn't auto-save because the
              user may open editing to check the raw text and back out. */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[10px] text-muted-more font-semibold">טקסט</div>
              {!editingText && (
                <button
                  onClick={() => { setTextDraft(report.text); setEditingText(true); }}
                  className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold"
                >ערוך</button>
              )}
            </div>
            {editingText ? (
              <>
                <textarea
                  value={textDraft}
                  onChange={e => setTextDraft(e.target.value)}
                  rows={4}
                  className="w-full text-[13px] rounded-lg border border-subtle bg-transparent p-2 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none text-right"
                  dir="rtl"
                />
                <div className="flex gap-2 mt-1.5">
                  <button
                    onClick={() => { setTextDraft(report.text); setEditingText(false); }}
                    className="btn-secondary flex-1 py-1.5 text-[12px]"
                  >בטל</button>
                  <button
                    onClick={async () => {
                      if (!textDraft.trim()) return;
                      await onSetText(report, textDraft);
                      setEditingText(false);
                    }}
                    disabled={!textDraft.trim() || textDraft.trim() === report.text}
                    className={`flex-1 py-1.5 rounded-xl text-[12px] font-bold ${
                      textDraft.trim() && textDraft.trim() !== report.text
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                        : 'bg-subtle text-muted'
                    }`}
                  >שמור</button>
                </div>
              </>
            ) : (
              <BidiText text={report.text} className="text-[13px] leading-snug" />
            )}
          </div>

          {/* Kind — same chip pattern as סטטוס/אזור, keeps the interaction
              consistent across the three editable fields. */}
          <div>
            <div className="text-[10px] text-muted-more font-semibold mb-1.5">סוג</div>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map(k => (
                <button
                  key={k.id}
                  onClick={() => void onSetKind(report, k.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${
                    report.kind === k.id
                      ? 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900 ring-1 ring-current'
                      : 'bg-subtle text-muted'
                  }`}
                >{k.icon} {k.he}</button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-muted-more font-semibold mb-1.5">סטטוס</div>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map(s => (
                <button
                  key={s.id}
                  onClick={() => void onSetStatus(report, s.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${
                    report.status === s.id ? s.cls + ' ring-1 ring-current' : 'bg-subtle text-muted'
                  }`}
                >{s.he}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-more font-semibold mb-1.5">אזור</div>
            <div className="flex flex-wrap gap-1.5">
              {PLACES.map(p2 => (
                <button
                  key={p2.id}
                  onClick={() => void onSetPlace(report, p2.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${
                    report.place === p2.id ? p2.tone + ' ring-1 ring-current' : 'bg-subtle text-muted'
                  }`}
                >{p2.he}</button>
              ))}
            </div>
          </div>
          {/* The thread. Sits above מה תוקן because it is the live
              conversation about the task, where the resolution is its epitaph. */}
          <CommentsThread report={report} uid={uid} />

          {/* Resolution: collapsed by default so Shlomi doesn't see a wall
              of my technical explanation every time he expands a task
              (rep_1787499531519_juo2). Tap "מה תוקן" to read it. */}
          {report.resolution && <ResolutionCollapsible text={report.resolution} />}
          {/* Long doc id — kept for reference, tucked in the footer as tiny
              muted mono so it doesn't compete with #NUM. Tap to copy. */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span
              role="button"
              tabIndex={0}
              onClick={() => navigator.clipboard.writeText(report.id).catch(() => {})}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigator.clipboard.writeText(report.id).catch(() => {}); }}
              title="העתק מזהה מלא"
              className="text-[9px] font-mono text-muted-more hover:text-main cursor-pointer truncate"
              dir="ltr"
            >
              {report.id}
            </span>
          </div>
          {confirmDelete ? (
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary flex-1 py-2 text-[12px]">ביטול</button>
              <button
                onClick={async () => { await firestore.deleteReport(report.id); await onDeleted(); }}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white font-bold text-[12px]"
              >מחק</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-[11px] text-muted-more">מחק דיווח</button>
          )}
        </div>
      )}
    </div>
  );
}

// Small collapsible block for the "what was fixed" note left by whoever
// closed the report. Kept collapsed by default so opening a task doesn't
// dump a wall of technical explanation on the user (rep_1787499531519_juo2).
function ResolutionCollapsible({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between text-right text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 py-1"
      >
        <span className="inline-flex items-center gap-1">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span>מה תוקן</span>
        </span>
        <span className="text-muted-more">{open ? '▾' : '←'}</span>
      </button>
      {open && (
        <BidiText text={text} className="text-[11px] text-muted bg-subtle rounded-lg p-2 leading-relaxed" />
      )}
    </div>
  );
}


// ─── The thread ───────────────────────────────────────────────────
//
// Two-way notes on a task. Shlomi writes direction from the app; a Claude
// session writes findings back over REST. It exists because reading a long
// answer in a terminal over AnyDesk is genuinely hard — the phone is the
// comfortable screen, so the answer has to arrive there.
//
// Shown expanded rather than behind a toggle: unlike מה תוקן, which is an
// appendix you consult, the thread IS the reason you opened the task. Long
// notes are clamped individually instead (see CommentBubble), so a wall of
// text still never lands in one go.

function CommentsThread({ report, uid }: { report: AppReport; uid: string }) {
  const firestore = useFirestore(uid);
  // Local copy so a newly sent note appears instantly. The panel's list state
  // is only refreshed on reload(), and waiting for that to echo a message you
  // just typed reads as the send having failed.
  const [items, setItems] = useState<ReportComment[]>(report.comments || []);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  useEffect(() => { setItems(report.comments || []); }, [report.comments]);

  const ordered = useMemo(
    () => [...items].sort((a, b) => a.ts - b.ts),
    [items],
  );

  async function send() {
    if (sending || !draft.trim()) return;
    setSending(true);
    try {
      const added = await firestore.addReportComment(report.id, 'shlomi', draft);
      if (added) {
        setItems(prev => [...prev, added]);
        setDraft('');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-violet-600 dark:text-violet-400" aria-hidden="true">
          <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-3.9-.8L3 21l1.9-4.6A8.4 8.4 0 0 1 3 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 9 8.4z" />
        </svg>
        <span className="text-[10px] font-semibold text-violet-700 dark:text-violet-400">
          תגובות{ordered.length ? ` · ${ordered.length}` : ''}
        </span>
      </div>

      {ordered.length > 0 && (
        <div className="space-y-2 mb-2">
          {ordered.map(c => <CommentBubble key={c.id} comment={c} />)}
        </div>
      )}

      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        rows={2}
        placeholder="כתוב ל-Claude — כיוון, שאלה או החלטה"
        className="w-full text-[13px] rounded-lg border border-subtle bg-transparent p-2 focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none text-right"
        dir="rtl"
      />
      <button
        onClick={() => void send()}
        disabled={sending || !draft.trim()}
        className={`w-full mt-1.5 py-2 rounded-xl text-[12px] font-bold ${
          draft.trim() && !sending
            ? 'bg-violet-600 text-white hover:bg-violet-500'
            : 'bg-subtle text-muted'
        }`}
      >{sending ? 'שולח…' : 'שלח תגובה'}</button>
    </div>
  );
}

// One note. Claude wears the violet the app already uses for the AI and the
// shell; Shlomi's own notes stay neutral so the two are never confused at a
// glance.
//
// Anything past CLAMP characters is clipped with a "קרא הכול" — a written
// answer can run to several screens, and the thread has to stay scannable
// when it holds five of them.
const CLAMP = 320;

function CommentBubble({ comment }: { comment: ReportComment }) {
  const [expanded, setExpanded] = useState(false);
  const isClaude = comment.author === 'claude';
  const long = comment.text.length > CLAMP;
  const body = long && !expanded ? comment.text.slice(0, CLAMP).trimEnd() + '…' : comment.text;

  return (
    <div
      className={`rounded-lg p-2.5 border ${
        isClaude
          ? 'border-violet-500/25 bg-violet-500/5 dark:bg-violet-500/10'
          : 'border-subtle bg-subtle'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className={`text-[10px] font-bold ${isClaude ? 'text-violet-700 dark:text-violet-300' : 'text-muted'}`}>
          {isClaude ? 'Claude' : 'שלומי'}
        </span>
        <span className="text-[9px] text-muted-more">
          {new Date(comment.ts).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
          {' · '}
          {new Date(comment.ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <BidiText text={body} className="text-[13px] leading-relaxed" />
      {long && (
        <button
          onClick={() => setExpanded(v => !v)}
          className={`mt-1.5 text-[11px] font-semibold ${isClaude ? 'text-violet-600 dark:text-violet-400' : 'text-muted'}`}
        >{expanded ? 'הצג פחות' : 'קרא הכול'}</button>
      )}
    </div>
  );
}


// ─── Bilingual body text ──────────────────────────────────────────
//
// The panel lives inside dir="rtl", which is right for Hebrew and wrong for
// everything else: an English line inherits RTL and its full stops, colons and
// numbered prefixes jump to the wrong end of the line.
//
// A single dir="auto" on the whole block is not enough either — it resolves ONE
// direction from the first strong character in the text, so a report that opens
// in English renders its Hebrew paragraphs LTR, and vice versa.
//
// So: split on newlines and let each paragraph resolve its own direction. A
// Hebrew line stays RTL, an English line goes LTR, and a mixed report reads
// correctly throughout. Blank lines become spacers, which is what
// whitespace-pre-wrap was doing for us before.
export function BidiText({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n');
  return (
    <div className={className}>
      {lines.map((line, i) =>
        line.trim() === ''
          ? <div key={i} className="h-2.5" aria-hidden="true" />
          : <div key={i} dir="auto" className="break-words">{line}</div>,
      )}
    </div>
  );
}
