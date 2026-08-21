import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppReport, ReportKind, ReportPlaceTag, ReportStatus } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { compressImage } from '../hooks/usePhotos';

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
  { id: 'exercise', he: 'אימונים', tone: 'bg-emerald-500 text-white' },
  { id: 'food', he: 'תזונה', tone: 'bg-amber-500 text-white' },
  { id: 'general', he: 'כללי', tone: 'bg-slate-500 text-white' },
];

const STATUSES: { id: ReportStatus; he: string; cls: string }[] = [
  { id: 'open', he: 'פתוח', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  { id: 'in-progress', he: 'בטיפול', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  { id: 'done', he: 'הושלם', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  { id: 'wont-do', he: 'לא רלוונטי', cls: 'bg-slate-500/15 text-muted' },
];

const placeOf = (id: ReportPlaceTag) => PLACES.find(p => p.id === id)!;
const statusOf = (id: ReportStatus) => STATUSES.find(s => s.id === id) || STATUSES[0];

export function ReportsPanel({ uid, onClose }: { uid: string; onClose: () => void }) {
  useBodyScrollLock();
  const firestore = useFirestore(uid);
  const firestoreRef = useRef(firestore);
  firestoreRef.current = firestore;

  const [reports, setReports] = useState<AppReport[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<ReportStatus | 'all'>('open');
  const [composing, setComposing] = useState(false);

  // Compose state
  const [kind, setKind] = useState<ReportKind>('bug');
  const [place, setPlace] = useState<ReportPlaceTag>('general');
  const [text, setText] = useState('');
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function reload() {
    setReports(await firestoreRef.current.listReports());
    setLoaded(true);
  }

  useEffect(() => {
    let cancelled = false;
    firestoreRef.current.listReports()
      .then(r => { if (!cancelled) { setReports(r); setLoaded(true); } })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [uid]);

  const shown = useMemo(
    () => (filter === 'all' ? reports : reports.filter(r => r.status === filter)),
    [reports, filter],
  );

  const openCount = reports.filter(r => r.status === 'open').length;

  async function submit() {
    if (busy || !text.trim()) return;
    setBusy(true);
    try {
      await firestoreRef.current.addReport({
        kind, place, text: text.trim(),
        screenshotBase64: shot || undefined,
      });
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

  return (
    <div className="fixed inset-0 z-[75] flex flex-col overlay-solid">
      <div className="flex items-center justify-between p-4 border-b border-subtle" dir="rtl">
        <div>
          <h2 className="font-bold text-lg">דיווחים</h2>
          <div className="text-[11px] text-muted">{openCount} פתוחים · {reports.length} סה״כ</div>
        </div>
        <button onClick={onClose} aria-label="סגור" className="text-muted text-2xl leading-none">×</button>
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
            <ReportRow key={r.id} report={r} onSetStatus={setStatus} onSetPlace={changePlace} onDeleted={reload} uid={uid} />
          ))
        )}
      </div>
    </div>
  );
}

function ReportRow({
  report, uid, onSetStatus, onSetPlace, onDeleted,
}: {
  report: AppReport;
  uid: string;
  onSetStatus: (r: AppReport, s: ReportStatus) => void | Promise<void>;
  onSetPlace: (r: AppReport, p: ReportPlaceTag) => void | Promise<void>;
  onDeleted: () => void | Promise<void>;
}) {
  const firestore = useFirestore(uid);
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const p = placeOf(report.place);
  const st = statusOf(report.status);

  return (
    <div className="card py-0 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-start gap-2.5 py-3 text-right">
        <span className="text-base shrink-0 mt-0.5">{report.kind === 'bug' ? '🐞' : '✨'}</span>
        <div className="flex-1 min-w-0">
          <div className={`text-[13px] leading-snug ${open ? '' : 'line-clamp-2'}`}>{report.text}</div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${p.tone}`}>{p.he}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${st.cls}`}>{st.he}</span>
            <span className="text-[10px] text-muted-more">
              {new Date(report.createdAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
            </span>
            {report.screenshotBase64 && <span className="text-[10px] text-muted-more">📷</span>}
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-subtle py-3 space-y-3">
          {report.screenshotBase64 && (
            <img src={report.screenshotBase64} alt="" className="w-full rounded-lg border border-subtle" />
          )}
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
          {report.resolution && (
            <div className="text-[11px] text-muted bg-subtle rounded-lg p-2">{report.resolution}</div>
          )}
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
