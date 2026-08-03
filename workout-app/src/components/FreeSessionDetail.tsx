import { useEffect, useMemo, useState } from 'react';
import type { Route, FreeSession, FreeSet } from '../types';
import type { MuscleGroup } from '../data/muscles';
import { ACTIVE_MUSCLES, MUSCLE_BY_ID, MUSCLE_CLASSES, effectiveMuscles } from '../data/muscles';
import { useFirestore } from '../hooks/useFirestore';
import { LogSetModal } from './LogSetModal';
import { findPersonalByName, type PersonalExercise } from '../data/exercisesDB';
import { TopBar } from './TopBar';

type Props = {
  uid: string;
  sessionId: string;
  navigate: (route: Route) => void;
};

type ModalMode = { kind: 'add'; muscle?: MuscleGroup }
              | { kind: 'edit'; set: FreeSet }
              | { kind: 'dup'; set: FreeSet };

function toDateInput(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function fromDateInput(v: string, hour: number, min: number): number {
  const [y, mo, d] = v.split('-').map(Number);
  return new Date(y, mo - 1, d, hour, min).getTime();
}

export function FreeSessionDetail({ uid, sessionId, navigate }: Props) {
  const firestore = useFirestore(uid);
  const [session, setSession] = useState<FreeSession | null>(null);
  const [allPastSets, setAllPastSets] = useState<FreeSet[]>([]);
  const [personalExercises, setPersonalExercises] = useState<PersonalExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMuscles, setEditMuscles] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [confirmDeleteSetId, setConfirmDeleteSetId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [s, all, exs] = await Promise.all([
        firestore.getFreeSession(sessionId),
        firestore.getFreeSessions(),
        firestore.listPersonalExercises(),
      ]);
      setSession(s);
      setPersonalExercises(exs);
      const past: FreeSet[] = [];
      for (const sess of all) {
        if (sess.id === sessionId) continue;
        for (const set of sess.sets) past.push(set);
      }
      setAllPastSets(past);
      setLoading(false);
    })();
  }, [sessionId]);

  const setsByMuscle = useMemo(() => {
    const map = new Map<MuscleGroup, FreeSet[]>();
    if (!session) return map;
    for (const s of session.sets) {
      const arr = map.get(s.muscle) || [];
      arr.push(s);
      map.set(s.muscle, arr);
    }
    return map;
  }, [session]);

  async function handleDateChange(field: 'date' | 'completedAt', value: string) {
    if (!session) return;
    const old = field === 'date' ? session.date : session.completedAt;
    const oldDate = old ? new Date(old) : new Date();
    const newTs = fromDateInput(value, oldDate.getHours(), oldDate.getMinutes());
    await firestore.updateFreeSessionDates(session.id, { [field]: newTs });
    setSession({ ...session, [field]: newTs });
  }

  async function handleToggleMuscle(id: MuscleGroup) {
    if (!session) return;
    const has = session.muscleGroups.includes(id);
    const next = has ? session.muscleGroups.filter(m => m !== id) : [...session.muscleGroups, id];
    await firestore.updateFreeSessionMuscles(session.id, next);
    setSession({ ...session, muscleGroups: next });
  }

  async function handleSaveSet(partial: Omit<FreeSet, 'id' | 'timestamp'>, editingId?: string) {
    if (!session) return;
    let sessionMuscles = session.muscleGroups;
    if (!sessionMuscles.includes(partial.muscle)) {
      sessionMuscles = [...sessionMuscles, partial.muscle];
      await firestore.updateFreeSessionMuscles(session.id, sessionMuscles);
    }
    if (partial.exerciseName && partial.exerciseName.trim()) {
      await firestore.ensurePersonalExercise(partial.exerciseName.trim(), partial.muscle);
    }
    let newSets: FreeSet[];
    if (editingId) {
      newSets = session.sets.map(s => s.id === editingId
        ? { ...s, ...partial, id: s.id, timestamp: s.timestamp }
        : s);
    } else {
      const set: FreeSet = { ...partial, id: `s_${Date.now()}`, timestamp: Date.now() };
      newSets = [...session.sets, set];
    }
    await firestore.updateFreeSets(session.id, newSets);
    setSession({ ...session, muscleGroups: sessionMuscles, sets: newSets });
    setModal(null);
  }

  async function handleDeleteSet(setId: string) {
    if (!session) return;
    const newSets = session.sets.filter(s => s.id !== setId);
    await firestore.updateFreeSets(session.id, newSets);
    setSession({ ...session, sets: newSets });
  }

  async function handleDeleteSession() {
    if (!session) return;
    await firestore.deleteFreeSession(session.id);
    navigate({ page: 'history' });
  }

  if (loading) return <div className="page-bg flex items-center justify-center text-muted">Loading...</div>;
  if (!session) return <div className="page-bg flex items-center justify-center text-muted">Session not found</div>;

  const realSetCount = session.sets.filter(s => s.weight > 0 || s.reps > 0).length;
  const dateLabel = new Date(session.date).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });

  return (
    <div className="page-bg min-h-screen">
      <TopBar
        title="אימון"
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <span>{dateLabel}</span>
            <span className="text-muted-most">·</span>
            <span className="font-mono">{realSetCount} סטים</span>
          </span>
        }
        actions={
          <>
            <button
              onClick={() => setConfirmDelete(true)}
              aria-label="מחק אימון"
              className="w-9 h-9 rounded-full flex items-center justify-center text-red-500 hover:bg-red-500/10"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
              </svg>
            </button>
            <button
              onClick={() => navigate({ page: 'history' })}
              aria-label="חזור"
              className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:bg-slate-500/10"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          </>
        }
      />
      <div className="p-4 pb-24 max-w-lg mx-auto">
      {modal && (
        <LogSetModal
          uid={uid}
          sessionMuscles={session.muscleGroups}
          defaultMuscle={modal.kind === 'add' ? modal.muscle : undefined}
          allPastSets={allPastSets}
          editingSet={modal.kind === 'edit' ? modal.set : undefined}
          duplicateFrom={modal.kind === 'dup' ? modal.set : undefined}
          onClose={() => setModal(null)}
          onSave={handleSaveSet}
        />
      )}


      {/* Dates */}
      <div className="card mb-4 space-y-2" dir="rtl">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] text-muted uppercase tracking-wider">התחלה</span>
          <input
            type="date"
            value={toDateInput(session.date)}
            onChange={e => handleDateChange('date', e.target.value)}
            className="input-field !text-xs !py-1 !px-2 !w-auto"
          />
        </div>
        {session.completedAt && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] text-muted uppercase tracking-wider">סיום</span>
            <input
              type="date"
              value={toDateInput(session.completedAt)}
              onChange={e => handleDateChange('completedAt', e.target.value)}
              className="input-field !text-xs !py-1 !px-2 !w-auto"
            />
          </div>
        )}
      </div>

      {/* Muscles + edit */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-2" dir="rtl">
          <button onClick={() => setEditMuscles(v => !v)} className="text-[11px] text-blue-500 dark:text-blue-400">
            {editMuscles ? 'סיים' : 'ערוך'}
          </button>
          <div className="text-[10px] text-muted uppercase tracking-wider">קבוצות שריר</div>
        </div>
        {editMuscles ? (
          <div className="grid grid-cols-2 gap-1.5">
            {ACTIVE_MUSCLES.map(m => {
              const active = session.muscleGroups.includes(m.id);
              const c = MUSCLE_CLASSES[m.color];
              return (
                <button
                  key={m.id}
                  onClick={() => handleToggleMuscle(m.id)}
                  className={`text-right p-2 rounded-lg text-sm transition-colors ${active ? `${c.bg} ${c.text} ring-2 ${c.ring}` : 'dark:bg-slate-800 bg-slate-100 text-muted'}`}
                  dir="rtl"
                >
                  {m.he}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 justify-end" dir="rtl">
            {effectiveMuscles(session.muscleGroups, session.sets).map(id => {
              const m = MUSCLE_BY_ID[id];
              if (!m) return null;
              const c = MUSCLE_CLASSES[m.color];
              const count = session.sets.filter(s => s.muscle === id && (s.weight > 0 || s.reps > 0)).length;
              return (
                <span key={id} className={`text-xs px-2 py-1 rounded ${c.bg} ${c.text}`}>
                  {m.he} <span className="font-mono opacity-70">· {count}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Sets grouped by muscle → then by exercise */}
      {[...setsByMuscle.entries()].map(([muscleId, sets]) => {
        const m = MUSCLE_BY_ID[muscleId];
        if (!m) return null;
        const c = MUSCLE_CLASSES[m.color];
        // Sub-group by exercise name within this muscle
        const byExercise = new Map<string, FreeSet[]>();
        for (const s of sets) {
          const key = (s.exerciseName || '').toLowerCase();
          const arr = byExercise.get(key) || [];
          arr.push(s);
          byExercise.set(key, arr);
        }
        return (
          <div key={muscleId} className="card mb-3">
            <div className="flex items-center justify-between mb-3" dir="rtl">
              <button
                onClick={() => setModal({ kind: 'add', muscle: muscleId })}
                className="text-[11px] text-blue-500 dark:text-blue-400"
              >+ סט</button>
              <span className={`text-sm font-semibold ${c.text}`}>{m.he} · {sets.length}</span>
            </div>
            <div className="space-y-3">
              {[...byExercise.entries()].map(([key, groupSets]) => {
                const name = groupSets[0].exerciseName || '(ללא שם תרגיל)';
                const enName = groupSets[0].exerciseName ? findPersonalByName(personalExercises, groupSets[0].exerciseName)?.en : null;
                return (
                  <div key={key} className="border-t border-subtle/50 pt-2 first:border-t-0 first:pt-0">
                    <div className="flex items-center justify-between mb-1.5" dir="rtl">
                      <button
                        onClick={() => setModal({ kind: 'dup', set: groupSets[groupSets.length - 1] })}
                        className="text-[10px] text-blue-500 hover:text-blue-400"
                      >+ סט נוסף</button>
                      <div className="text-right">
                        <div className="text-xs font-semibold">{name}</div>
                        {enName && (
                          <div className="text-[10px] text-muted mt-0.5" dir="ltr" style={{ direction: 'ltr' }}>{enName}</div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {groupSets.map(s => {
                        const unit = s.unit || 'kg';
                        const isPlaceholder = s.weight === 0 && s.reps === 0;
                        return (
                          <div
                            key={s.id}
                            onClick={() => setModal({ kind: 'edit', set: s })}
                            className={`bg-subtle rounded px-2 py-1.5 cursor-pointer hover:opacity-90 ${isPlaceholder ? 'border border-dashed dark:border-amber-800 border-amber-300' : ''}`}
                            dir="rtl"
                          >
                            <div className="flex items-center justify-between text-xs font-mono">
                              <div className="text-right flex-1">
                                {isPlaceholder ? (
                                  <span className="text-amber-500">— להשלים —</span>
                                ) : (
                                  <span dir="ltr" className="inline-block">{s.weight}{unit} × {s.reps}</span>
                                )}
                              </div>
                              <div className="flex gap-2 text-[10px]">
                                <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteSetId(s.id); }} className="text-red-500 hover:text-red-400">מחק</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {session.sets.length === 0 && (
        <div className="text-muted text-center py-4 text-sm" dir="rtl">לא נרשמו סטים באימון הזה</div>
      )}

      {/* Fixed bottom: add set */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t dark:from-slate-950 dark:via-slate-950 from-slate-50 via-slate-50 to-transparent">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => setModal({ kind: 'add' })}
            className="btn-secondary w-full py-3 text-base font-semibold"
          >
            + הוסף סט לאימון הזה
          </button>
        </div>
      </div>

      {confirmDeleteSetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/50 p-4">
          <div className="card max-w-sm w-full text-right" dir="rtl">
            <h3 className="font-bold text-red-500 mb-2">מחק סט?</h3>
            <p className="text-sm text-muted mb-4">הסט יימחק מהאימון. לא ניתן לשחזר.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteSetId(null)} className="btn-secondary flex-1">ביטול</button>
              <button
                onClick={async () => {
                  const id = confirmDeleteSetId;
                  setConfirmDeleteSetId(null);
                  if (id) await handleDeleteSet(id);
                }}
                className="btn-primary flex-1 !bg-red-600 hover:!bg-red-500"
              >מחק</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/50 p-4">
          <div className="card max-w-sm w-full text-right" dir="rtl">
            <h3 className="font-bold text-red-500 mb-2">מחק אימון?</h3>
            <p className="text-sm text-muted mb-4">
              כל הסטים שנרשמו באימון הזה יימחקו. לא ניתן לשחזר.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary flex-1">ביטול</button>
              <button onClick={handleDeleteSession} className="btn-primary flex-1 !bg-red-600 hover:!bg-red-500">מחק</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
