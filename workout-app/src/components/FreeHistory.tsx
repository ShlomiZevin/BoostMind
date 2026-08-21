import { useEffect, useMemo, useState } from 'react';
import type { Route, FreeSession } from '../types';
import { MUSCLE_BY_ID, MUSCLE_CLASSES, effectiveMuscles } from '../data/muscles';
import { useFirestore } from '../hooks/useFirestore';
import { TopBar } from './TopBar';
import { TabActions } from './TopBarActions';
import { MovePlanModal } from './MovePlanModal';

type Props = {
  uid: string;
  navigate: (route: Route) => void;
};

type RangeKey = '7d' | '30d' | 'last-week' | 'this-month' | 'last-month' | 'all';

const AEROBIC_ICON: Record<string, string> = {
  'ריצה': '🏃', 'אופניים': '🚴', 'חתירה': '🚣', 'הליכה': '🚶', 'אליפטיקל': '⚙',
};

const RANGES: Array<{ key: RangeKey; label: string }> = [
  { key: '7d',         label: '7 ימים' },
  { key: '30d',        label: '30 ימים' },
  { key: 'last-week',  label: 'שבוע שעבר' },
  { key: 'this-month', label: 'החודש' },
  { key: 'last-month', label: 'חודש שעבר' },
  { key: 'all',        label: 'הכל' },
];

function rangeBounds(key: RangeKey): { from: number; to: number } {
  const now = new Date();
  const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
  const startOfWeek = (d: Date) => { const o = new Date(d); o.setHours(0,0,0,0); o.setDate(o.getDate() - o.getDay()); return o; };
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  switch (key) {
    case '7d': {
      const from = new Date(midnight); from.setDate(from.getDate() - 6);
      return { from: from.getTime(), to: Number.POSITIVE_INFINITY };
    }
    case '30d': {
      const from = new Date(midnight); from.setDate(from.getDate() - 29);
      return { from: from.getTime(), to: Number.POSITIVE_INFINITY };
    }
    case 'last-week': {
      const thisWk = startOfWeek(now);
      const lastWk = new Date(thisWk); lastWk.setDate(lastWk.getDate() - 7);
      return { from: lastWk.getTime(), to: thisWk.getTime() };
    }
    case 'this-month': {
      const start = startOfMonth(now);
      return { from: start.getTime(), to: Number.POSITIVE_INFINITY };
    }
    case 'last-month': {
      const start = startOfMonth(now);
      const lastStart = new Date(start); lastStart.setMonth(lastStart.getMonth() - 1);
      return { from: lastStart.getTime(), to: start.getTime() };
    }
    case 'all':
    default:
      return { from: 0, to: Number.POSITIVE_INFINITY };
  }
}

type StatusFilter = 'completed' | 'planned' | 'all';
const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'completed', label: 'בוצעו' },
  { key: 'planned',   label: 'מתוכננים' },
  { key: 'all',       label: 'הכל' },
];

export function FreeHistory({ uid, navigate }: Props) {
  const firestore = useFirestore(uid);
  const [sessions, setSessions] = useState<FreeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>('last-week');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('completed');
  const [movePlanId, setMovePlanId] = useState<string | null>(null);
  const [dupSourceId, setDupSourceId] = useState<string | null>(null);

  const refresh = () => {
    firestore.getFreeSessions().then(s => {
      // All sessions loaded here; completed/planned filter is applied at render time.
      setSessions(s);
      setLoading(false);
    });
  };
  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    const { from, to } = rangeBounds(range);
    return sessions.filter(s => {
      if (statusFilter === 'completed' && s.status !== 'completed') return false;
      if (statusFilter === 'planned' && s.status !== 'planned') return false;
      // 'all' passes everything, but never show in-progress sessions here
      // (they belong on Home). Active sessions from the past should still show.
      if (statusFilter === 'all' && s.status === 'active') return false;
      const ts = s.completedAt || s.date;
      return ts >= from && ts < to;
    });
  }, [sessions, range, statusFilter]);

  return (
    <div className="page-bg min-h-screen">
      <TopBar
        title="היסטוריה"
        subtitle={filtered.length > 0 ? `${filtered.length} אימונים` : undefined}
        accent="brand"
        tint="blue"
        actions={<TabActions navigate={navigate} />}
      />
      <div className="px-4 pt-0 pb-4 max-w-lg mx-auto">

      {/* Sticky range picker — same visual language as the Body page */}
      <section className="mb-3" dir="rtl">
        <div className="sticky z-20 -mx-4 px-4 py-2.5 mb-2 backdrop-blur bg-gradient-to-b from-blue-50/95 to-white/85 dark:from-blue-950/40 dark:to-slate-950/90 border-b border-blue-500/20 shadow-[0_2px_10px_-6px_rgba(59,130,246,0.35)]" style={{ top: 'var(--top-bar-h)' }}>
          <div className="max-w-lg mx-auto flex items-baseline justify-between">
            <h2 className="inline-flex items-center gap-2 text-base font-bold">
              <span>טווח זמן</span>
              <span className="w-1 h-4 rounded-full bg-blue-500" />
            </h2>
            <span className="text-[10px] text-muted-most uppercase tracking-widest font-semibold">
              {filtered.length} אימונים
            </span>
          </div>
        </div>
        <div className="card !p-3 space-y-3">
          {/* Two visually distinct filter GROUPS so it's obvious they answer
              different questions:
                Status → segmented pill picker (compact, one-of-three)
                Range  → labeled chip grid (multiple time windows) */}
          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-muted mb-1.5">סוג</div>
            <div className="inline-flex w-full rounded-full p-0.5 bg-slate-100 dark:bg-slate-900 text-xs font-semibold">
              {STATUS_FILTERS.map(f => {
                const active = f.key === statusFilter;
                return (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key)}
                    className={`flex-1 text-center py-1.5 rounded-full transition-colors ${
                      active ? 'bg-blue-600 text-white shadow-sm' : 'text-muted hover:text-main'
                    }`}
                  >{f.label}</button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-muted mb-1.5">טווח זמן</div>
            <div className="grid grid-cols-2 gap-2">
              {RANGES.map(r => {
                const active = r.key === range;
                return (
                  <button
                    key={r.key}
                    onClick={() => setRange(r.key)}
                    className={`text-right text-xs px-3 py-2 rounded-lg border transition-colors ${
                      active
                        ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/50 font-semibold'
                        : 'dark:bg-slate-800/60 bg-slate-50 text-main border-transparent dark:hover:bg-slate-700 hover:bg-slate-100'
                    }`}
                    dir="rtl"
                  >{r.label}</button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {loading && <div className="text-muted text-center py-8">Loading...</div>}
      {!loading && filtered.length === 0 && (
        <div className="text-muted text-center py-8" dir="rtl">
          {sessions.length === 0 ? 'אין עדיין אימונים' : 'אין אימונים בטווח שנבחר'}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(s => {
          const isPlanned = s.status === 'planned';
          const d = new Date(s.completedAt || s.date);
          const dateStr = isPlanned && s.plannedFor
            ? s.plannedFor.split('-').reverse().join('/')
            : `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
          const dowStr = d.toLocaleDateString('he-IL', { weekday: 'short' });
          const realSets = s.sets.filter(x => x.weight > 0 || x.reps > 0);
          const setsPerMuscle = new Map<string, number>();
          for (const set of realSets) setsPerMuscle.set(set.muscle, (setsPerMuscle.get(set.muscle) || 0) + 1);
          const muscles = effectiveMuscles(s.muscleGroups, s.sets);
          const uniqExercises = isPlanned
            ? new Set((s.plannedExercises || []).map(e => e.name.toLowerCase())).size
            : new Set(realSets.map(x => (x.exerciseName || '').toLowerCase()).filter(Boolean)).size;
          const aerobicByType = new Map<string, number>();
          for (const e of s.aerobicEntries || []) aerobicByType.set(e.type, (aerobicByType.get(e.type) || 0) + (e.minutes || 0));
          const hasStrength = muscles.length > 0;
          const hasAerobic = aerobicByType.size > 0;
          return (
            <div
              key={s.id}
              className={`card text-right cursor-pointer dark:hover:bg-slate-800 hover:bg-slate-50 ${isPlanned ? 'border border-blue-500/30' : ''}`}
              dir="rtl"
              role="button"
              tabIndex={0}
              onClick={() => navigate(isPlanned ? { page: 'session', sessionId: s.id } : { page: 'session-view', sessionId: s.id })}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(isPlanned ? { page: 'session', sessionId: s.id } : { page: 'session-view', sessionId: s.id }); } }}
            >
              <div className="w-full text-right" dir="rtl">
                <div className="flex items-center justify-between mb-2" dir="rtl">
                  <div className="inline-flex items-center gap-1.5">
                    <span className="text-sm font-semibold">{dowStr}</span>
                    {isPlanned && (
                      <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300">מתוכנן</span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted font-mono" dir="ltr">{dateStr}</span>
                </div>
                {/* Strength / muscle chips — grouped in a labeled mini-panel so it's
                    visually distinct from the aerobic panel underneath. Same chip size. */}
                {hasStrength && (
                  <div className="relative mb-3 rounded-lg border border-slate-400/25 dark:border-slate-500/30 p-1.5 pt-3">
                    <span className="absolute -top-2 right-2 px-1.5 dark:bg-slate-900 bg-white text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">כח</span>
                    <div className="flex gap-1 flex-wrap justify-start" dir="rtl">
                      {muscles.map(id => {
                        const m = MUSCLE_BY_ID[id];
                        if (!m) return null;
                        const c = MUSCLE_CLASSES[m.color];
                        const count = setsPerMuscle.get(id) || 0;
                        return (
                          <span key={id} className={`text-[10px] px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}>
                            {m.he} {!isPlanned && <span className="font-mono opacity-70">· {count}</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                {hasAerobic && (
                  <div className="relative mb-1.5 rounded-lg border border-cyan-400/40 p-1.5 pt-3">
                    <span className="absolute -top-2 right-2 px-1.5 dark:bg-slate-900 bg-white text-[9px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">אירובי</span>
                    <div className="flex gap-1 flex-wrap justify-start" dir="rtl">
                      {Array.from(aerobicByType.entries()).map(([type, minutes]) => (
                        <span key={`aer-${type}`} className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500 text-white ring-1 ring-cyan-300/60 dark:ring-cyan-400/40 inline-flex items-center gap-1">
                          <span className="text-[11px] leading-none">{AEROBIC_ICON[type] || '❤'}</span>
                          <bdi>{type}</bdi> <span className="font-mono opacity-90">· {minutes}ד</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="text-xs text-muted text-right flex items-center gap-1.5 justify-end" dir="rtl">
                  <span className="font-mono font-semibold text-main">{uniqExercises}</span>
                  <span>תרגילים</span>
                  {!isPlanned && (
                    <>
                      <span className="text-muted-most">·</span>
                      <span className="font-mono font-semibold text-main">{realSets.length}</span>
                      <span>סטים</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex justify-end mt-2 pt-2 border-t border-subtle/60 gap-2">
                {isPlanned && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setMovePlanId(s.id); }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold
                               px-3 py-1.5 rounded-full
                               dark:bg-blue-900/40 bg-blue-100
                               text-blue-700 dark:text-blue-300
                               dark:hover:bg-blue-900/60 hover:bg-blue-200 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                    </svg>
                    <span>העבר לתאריך</span>
                  </button>
                )}
                {!isPlanned && (
                <button
                  onClick={(e) => { e.stopPropagation(); setDupSourceId(s.id); }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold
                             px-3 py-1.5 rounded-full
                             dark:bg-emerald-900/40 bg-emerald-100
                             text-emerald-700 dark:text-emerald-300
                             dark:hover:bg-emerald-900/60 hover:bg-emerald-200 transition-colors"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="12" height="12" rx="2" />
                    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                  </svg>
                  <span>שכפל אימון</span>
                </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {dupSourceId && (
        <DuplicateModal
          onClose={() => setDupSourceId(null)}
          onDuplicate={async (includeExercises) => {
            const src = dupSourceId;
            setDupSourceId(null);
            if (!src) return;
            const newId = await firestore.duplicateFreeSession(src, { includeExercises });
            if (newId) navigate({ page: 'session', sessionId: newId });
          }}
        />
      )}
      {movePlanId && (
        <MovePlanModal
          currentYmd={sessions.find(s => s.id === movePlanId)?.plannedFor}
          onCancel={() => setMovePlanId(null)}
          onMove={async (newYmd) => {
            await firestore.movePlannedSession(movePlanId, newYmd);
            setMovePlanId(null);
            refresh();
          }}
        />
      )}
      </div>
    </div>
  );
}

function DuplicateModal({ onClose, onDuplicate }: { onClose: () => void; onDuplicate: (includeExercises: boolean) => void }) {
  const [includeExercises, setIncludeExercises] = useState(true);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/50 p-4" onClick={onClose}>
      <div className="card max-w-sm w-full text-right" dir="rtl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-2 text-emerald-600 dark:text-emerald-400">שכפל אימון</h3>
        <p className="text-sm text-muted mb-4">מה להעתיק לאימון החדש?</p>
        <div className="space-y-2 mb-4">
          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg dark:bg-slate-800 bg-slate-100">
            <input type="radio" checked={!includeExercises} onChange={() => setIncludeExercises(false)} className="accent-emerald-500" />
            <div>
              <div className="text-sm font-semibold">רק שרירים</div>
              <div className="text-[11px] text-muted">אבחר בעצמי את התרגילים</div>
            </div>
          </label>
          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg dark:bg-slate-800 bg-slate-100">
            <input type="radio" checked={includeExercises} onChange={() => setIncludeExercises(true)} className="accent-emerald-500" />
            <div>
              <div className="text-sm font-semibold">שרירים + תרגילים</div>
              <div className="text-[11px] text-muted">כל התרגילים מהאימון מוזרמים כתוכנית</div>
            </div>
          </label>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">ביטול</button>
          <button onClick={() => onDuplicate(includeExercises)} className="btn-primary flex-1">שכפל</button>
        </div>
      </div>
    </div>
  );
}
