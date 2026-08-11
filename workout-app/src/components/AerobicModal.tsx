import { useEffect, useState } from 'react';
import type { AerobicEntry, AerobicType } from '../types';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useFirestore } from '../hooks/useFirestore';
import type { PersonalExercise } from '../data/exercisesDB';

type Props = {
  uid: string;
  editing?: AerobicEntry;
  onClose: () => void;
  onSave: (entry: Omit<AerobicEntry, 'id' | 'timestamp'>, editingId?: string) => void;
};

// Small icon lookup for the 5 seeded types (matched by their Hebrew name).
// Unknown types render with a neutral dot — no icon required.
const ICON_BY_HE: Record<string, string> = {
  'ריצה': '🏃',
  'אופניים': '🚴',
  'חתירה': '🚣',
  'הליכה': '🚶',
  'אליפטיקל': '⚙',
};
function iconFor(type: string): string {
  return ICON_BY_HE[type] || '·';
}

export function AerobicModal({ uid, editing, onClose, onSave }: Props) {
  useBodyScrollLock();
  const firestore = useFirestore(uid);
  const [types, setTypes] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [type, setType] = useState<AerobicType>(editing?.type || '');
  const [minutes, setMinutes] = useState<string>(String(editing?.minutes ?? 30));
  const [km, setKm] = useState<string>(editing?.km != null ? String(editing.km) : '');
  const [avgHr, setAvgHr] = useState<string>(editing?.avgHr != null ? String(editing.avgHr) : '');
  const [notes, setNotes] = useState<string>(editing?.notes || '');

  // Load the aerobic type list from personalExercises where defaultMuscle='aerobic'.
  // Include the editing entry's current type even if the exercise was deleted from the DB,
  // so the picker still shows the current selection.
  useEffect(() => {
    firestore.listPersonalExercises().then((all: PersonalExercise[]) => {
      const names = all
        .filter(e => e.defaultMuscle === 'aerobic')
        .map(e => e.he.trim())
        .filter(Boolean);
      const unique = Array.from(new Set(names));
      if (editing?.type && !unique.includes(editing.type)) unique.push(editing.type);
      unique.sort((a, b) => a.localeCompare(b, 'he'));
      setTypes(unique);
      if (!editing && !type && unique.length > 0) setType(unique[0]);
      setLoaded(true);
    });
  }, [uid]);

  const canSave = !!type && Number(minutes) > 0;

  function bumpMinutes(delta: number) {
    setMinutes(prev => String(Math.max(1, (Number(prev) || 0) + delta)));
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overlay-solid">
      <div className="flex flex-row-reverse items-center justify-between p-4 border-b border-subtle">
        <h2 className="font-bold text-lg" dir="rtl">{editing ? 'עריכת אירובי' : 'אימון אירובי'}</h2>
        <button onClick={onClose} className="text-muted text-2xl">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5" dir="rtl">
        {/* Type chips — sourced from the Exercises DB (muscle='aerobic') */}
        <div>
          <div className="text-[11px] font-medium dark:text-slate-300 text-slate-700 mb-1.5">סוג</div>
          {!loaded ? (
            <div className="text-xs text-muted-most py-4 text-center">טוען…</div>
          ) : types.length === 0 ? (
            <div className="rounded-xl border border-dashed border-subtle p-4 text-center text-xs text-muted">
              עדיין אין סוגי אירובי במאגר.
              <br />
              <span className="text-[11px]">הוסף דרך מסך התרגילים (בחר "אירובי" כשריר).</span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {types.map(t => {
                const active = type === t;
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                      active
                        ? 'bg-cyan-500 text-white'
                        : 'dark:bg-slate-800 bg-slate-100 text-main dark:hover:bg-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span className="text-base">{iconFor(t)}</span>
                    <span className="truncate">{t}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Minutes stepper (required) */}
        <div>
          <label className="block text-[11px] font-medium dark:text-slate-300 text-slate-700 mb-1.5">משך בדקות</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => bumpMinutes(-5)}
              className="w-11 h-11 rounded-xl dark:bg-slate-800 bg-slate-200 text-muted text-xl leading-none"
            >−</button>
            <input
              type="text"
              inputMode="numeric"
              value={minutes}
              onChange={e => { const v = e.target.value; if (v === '' || /^[0-9]+$/.test(v)) setMinutes(v); }}
              onFocus={e => e.currentTarget.select()}
              className="input-field !text-2xl !py-3 flex-1 !text-center"
            />
            <button
              onClick={() => bumpMinutes(+5)}
              className="w-11 h-11 rounded-xl dark:bg-slate-800 bg-slate-200 text-muted text-xl leading-none"
            >+</button>
          </div>
        </div>

        {/* Optional km + avg HR */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium dark:text-slate-300 text-slate-700 mb-1.5">ק"מ (אופציונלי)</label>
            <input
              type="text"
              inputMode="decimal"
              value={km}
              onChange={e => { const v = e.target.value; if (v === '' || /^[0-9]*\.?[0-9]*$/.test(v)) setKm(v); }}
              onFocus={e => e.currentTarget.select()}
              placeholder="—"
              className="input-field !text-lg !py-3 !text-center"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium dark:text-slate-300 text-slate-700 mb-1.5">דופק ממוצע</label>
            <input
              type="text"
              inputMode="numeric"
              value={avgHr}
              onChange={e => { const v = e.target.value; if (v === '' || /^[0-9]+$/.test(v)) setAvgHr(v); }}
              onFocus={e => e.currentTarget.select()}
              placeholder="—"
              className="input-field !text-lg !py-3 !text-center"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium dark:text-slate-300 text-slate-700 mb-1.5">הערות</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="מסלול, קצב, איך היה..."
            className="w-full text-[13px] rounded-xl border border-subtle bg-transparent p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 resize-none"
          />
        </div>
      </div>

      <div className="p-4 border-t border-subtle">
        <button
          onClick={() => canSave && onSave({
            type, minutes: Number(minutes),
            km: km ? Number(km) : undefined,
            avgHr: avgHr ? Number(avgHr) : undefined,
            notes: notes.trim() || undefined,
          }, editing?.id)}
          disabled={!canSave}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-colors ${
            canSave
              ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
              : 'dark:bg-slate-800 dark:text-slate-600 bg-slate-200 text-slate-400'
          }`}
        >{editing ? 'עדכן' : 'שמור'}</button>
      </div>
    </div>
  );
}
