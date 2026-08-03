import { useEffect, useMemo, useState } from 'react';
import type { PersonalExercise } from '../data/exercisesDB';
import type { MuscleGroup } from '../data/muscles';
import { MUSCLE_BY_ID } from '../data/muscles';
import { useFirestore } from '../hooks/useFirestore';
import { CHAT_API_URL } from '../config/api';

type Suggestion = {
  id: string;
  suggestedHe: string;
  suggestedEn?: string;
  muscle?: MuscleGroup;
  reason?: string;
};

type Row = {
  id: string;
  orig: PersonalExercise;
  sug: Suggestion;
  needs: { he: boolean; en: boolean; muscle: boolean };
  selected: boolean;
};

type Props = {
  uid: string;
  exercises: PersonalExercise[];
  onClose: () => void;
  onDone: () => void;
};

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function MigrateNames({ uid, exercises, onClose, onDone }: Props) {
  const firestore = useFirestore(uid);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const CHUNK = 40;
        const all: Suggestion[] = [];
        for (let i = 0; i < exercises.length; i += CHUNK) {
          const chunk = exercises.slice(i, i + CHUNK);
          const resp = await fetch(`${CHAT_API_URL.replace(/\/$/, '')}/api/rename-suggestions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uid,
              exercises: chunk.map(e => ({
                id: e.id,
                current: e.he,
                currentEn: e.en || '',
                muscle: e.defaultMuscle,
              })),
            }),
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const data = await resp.json();
          if (Array.isArray(data.suggestions)) all.push(...data.suggestions);
        }
        if (cancelled) return;

        const byId = new Map(exercises.map(e => [e.id, e]));
        const built: Row[] = [];
        for (const s of all) {
          const orig = byId.get(s.id);
          if (!orig || !s.suggestedHe) continue;
          const heChanged = normalizeName(orig.he) !== normalizeName(s.suggestedHe);
          const enMissing = !orig.en || orig.en.trim() === '';
          const enChanged = !!s.suggestedEn && normalizeName(orig.en || '') !== normalizeName(s.suggestedEn);
          const muscleChanged = !!s.muscle && s.muscle !== orig.defaultMuscle;
          if (!heChanged && !enMissing && !enChanged && !muscleChanged) continue;
          built.push({
            id: s.id,
            orig,
            sug: s,
            needs: { he: heChanged, en: enMissing || enChanged, muscle: muscleChanged },
            selected: true,
          });
        }
        setRows(built);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'שגיאה');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uid, exercises]);

  const selectedCount = useMemo(() => rows.filter(r => r.selected).length, [rows]);

  function toggle(id: string) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
  }

  function selectAll(sel: boolean) {
    setRows(rs => rs.map(r => ({ ...r, selected: sel })));
  }

  async function applySelected() {
    const chosen = rows.filter(r => r.selected);
    if (chosen.length === 0) return;
    setApplying(true);
    setProgress({ done: 0, total: chosen.length });
    try {
      for (let i = 0; i < chosen.length; i++) {
        const r = chosen[i];
        const nextHe = r.needs.he ? r.sug.suggestedHe : r.orig.he;
        const nextEn = r.needs.en && r.sug.suggestedEn ? r.sug.suggestedEn : r.orig.en;
        const nextMuscle = r.needs.muscle && r.sug.muscle ? r.sug.muscle : r.orig.defaultMuscle;
        const aliases = r.needs.he
          ? Array.from(new Set([...(r.orig.aliases || []), r.orig.he].filter(Boolean)))
          : r.orig.aliases;
        await firestore.upsertPersonalExercise({
          ...r.orig,
          he: nextHe,
          en: nextEn,
          defaultMuscle: nextMuscle,
          aliases,
        });
        setProgress({ done: i + 1, total: chosen.length });
      }
      onDone();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'שגיאה בעדכון');
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overlay-solid">
      <div className="flex items-center justify-between p-4 border-b border-subtle" dir="rtl">
        <div className="text-right">
          <h2 className="font-bold text-lg">מיגרציה חכמה של שמות</h2>
          <p className="text-[11px] text-muted mt-0.5">
            {loading ? 'AI סורק את התרגילים...' :
             error ? '' :
             rows.length === 0 ? 'הכל נראה תקין — אין מה להשלים.' :
             `${rows.length} תרגילים צריכים תשומת לב · נבחרו ${selectedCount}`}
          </p>
        </div>
        <button onClick={onClose} className="text-muted text-2xl">×</button>
      </div>

      {!loading && !error && rows.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-subtle" dir="rtl">
          <button onClick={() => selectAll(true)} className="text-[11px] text-blue-500">בחר הכל</button>
          <button onClick={() => selectAll(false)} className="text-[11px] text-muted">נקה בחירה</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading && (
          <div className="text-center py-12 text-muted text-sm" dir="rtl">
            שולח את התרגילים ל-AI... זה יכול לקחת עד דקה.
          </div>
        )}

        {error && (
          <div className="card text-right" dir="rtl">
            <div className="text-red-500 text-sm font-semibold mb-1">שגיאה</div>
            <div className="text-xs text-muted">{error}</div>
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="text-center py-12 text-muted text-sm" dir="rtl">
            כל התרגילים כבר עם שמות טובים ובאנגלית. אין מה למגר.
          </div>
        )}

        {!loading && !error && rows.map(r => {
          const m = MUSCLE_BY_ID[r.orig.defaultMuscle];
          const newM = r.sug.muscle ? MUSCLE_BY_ID[r.sug.muscle] : m;
          return (
            <div
              key={r.id}
              className={`card !p-3 cursor-pointer transition ${r.selected ? 'ring-1 ring-blue-500/60' : 'opacity-60'}`}
              onClick={() => toggle(r.id)}
              dir="rtl"
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={r.selected}
                  onChange={() => toggle(r.id)}
                  onClick={e => e.stopPropagation()}
                  className="mt-1 shrink-0 accent-blue-500"
                />
                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* Hebrew */}
                  {r.needs.he ? (
                    <div className="text-right">
                      <div className="text-[9px] text-muted-most">שם עברי</div>
                      <div className="flex items-center gap-2 text-sm justify-end flex-wrap">
                        <span className="text-muted line-through">{r.orig.he}</span>
                        <span className="text-muted-most">←</span>
                        <span className="font-semibold">{r.sug.suggestedHe}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm font-semibold text-right">{r.orig.he}</div>
                  )}

                  {/* English */}
                  {r.needs.en && (
                    <div className="text-right">
                      <div className="text-[9px] text-muted-most">אנגלית</div>
                      <div className="flex items-center gap-2 text-[12px] justify-end flex-wrap" dir="ltr" style={{ direction: 'ltr' }}>
                        {r.orig.en ? (
                          <>
                            <span className="text-muted line-through">{r.orig.en}</span>
                            <span className="text-muted-most">→</span>
                          </>
                        ) : (
                          <span className="text-amber-500 text-[10px]">חסר</span>
                        )}
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{r.sug.suggestedEn}</span>
                      </div>
                    </div>
                  )}

                  {/* Muscle */}
                  {r.needs.muscle && newM && m && (
                    <div className="text-right">
                      <div className="text-[9px] text-muted-most">שריר</div>
                      <div className="flex items-center gap-2 text-[11px] justify-end">
                        <span className="text-muted line-through">{m.he}</span>
                        <span className="text-muted-most">←</span>
                        <span className="font-semibold">{newM.he}</span>
                      </div>
                    </div>
                  )}

                  {r.sug.reason && (
                    <div className="text-[10px] text-muted-most text-right italic">{r.sug.reason}</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && !error && rows.length > 0 && (
        <div className="p-4 border-t border-subtle" dir="rtl">
          <button
            onClick={applySelected}
            disabled={selectedCount === 0 || applying}
            className="btn-primary w-full py-3 font-semibold disabled:opacity-50"
          >
            {applying
              ? `מחיל... ${progress.done}/${progress.total}`
              : `החל את הנבחרים (${selectedCount})`}
          </button>
        </div>
      )}
    </div>
  );
}
