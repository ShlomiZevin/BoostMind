import { useState, useEffect } from 'react';
import type { Exercise } from '../types';
import { searchExercises, type LibraryExercise } from '../data/exerciseLibrary';

type Props = {
  day: 1 | 2 | 3 | 4 | 5;
  recentExercises: Exercise[];
  onClose: () => void;
  onAdd: (ex: Exercise) => void;
};

export function QuickAddPanel({ day, recentExercises, onClose, onAdd }: Props) {
  const [nameHe, setNameHe] = useState('');
  const [name, setName] = useState('');
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10');
  const [isTimeBased, setIsTimeBased] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LibraryExercise[]>([]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      setSearchResults(searchExercises(searchQuery));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  function selectFromLibrary(lib: LibraryExercise) {
    setName(lib.name);
    setNameHe(lib.nameHe);
    setIsTimeBased(lib.isTimeBased);
    setSearchQuery('');
    setSearchResults([]);
  }

  function selectFromRecent(ex: Exercise) {
    setName(ex.name);
    setNameHe(ex.nameHe || '');
    setSets(String(ex.sets));
    if (ex.isTimeBased) {
      setIsTimeBased(true);
      setReps(String(ex.durationSeconds || 30));
    } else {
      setIsTimeBased(false);
      setReps(String(ex.reps || 10));
    }
  }

  function handleAdd() {
    const final = nameHe.trim() || name.trim();
    if (!final) return;
    const ex: Exercise = {
      id: `custom_d${day}_${Date.now()}`,
      name: name.trim() || final,
      nameHe: nameHe.trim() || undefined,
      sets: Number(sets) || 3,
      reps: isTimeBased ? null : (Number(reps) || 10),
      durationSeconds: isTimeBased ? (Number(reps) || 30) : undefined,
      isUnilateral: false,
      isTimeBased,
      startWeakSide: false,
    };
    onAdd(ex);
  }

  const canAdd = !!(nameHe.trim() || name.trim());

  return (
    <div className="fixed inset-0 z-50 flex flex-col overlay-solid">
      <div className="flex items-center justify-between p-4 border-b border-subtle">
        <h2 className="font-bold text-lg">הוספת תרגיל</h2>
        <button onClick={onClose} className="text-muted text-2xl">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Recent exercises — fastest path */}
        {recentExercises.length > 0 && (
          <div>
            <div className="text-[10px] text-muted mb-1.5 text-right" dir="rtl">לאחרונה</div>
            <div className="flex flex-wrap gap-1.5">
              {recentExercises.slice(0, 8).map((ex, i) => (
                <button
                  key={`${ex.id}-${i}`}
                  onClick={() => selectFromRecent(ex)}
                  className="text-xs dark:bg-slate-800 dark:text-slate-300 bg-slate-200 text-slate-700 px-2 py-1 rounded-lg dark:hover:bg-slate-700 hover:bg-slate-300"
                  dir="rtl"
                >
                  {ex.nameHe || ex.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Name input — Hebrew first, autofocus */}
        <div>
          <label className="block text-[10px] text-muted mb-1 text-right" dir="rtl">שם התרגיל</label>
          <input
            type="text"
            value={nameHe}
            onChange={e => setNameHe(e.target.value)}
            placeholder="שם בעברית"
            dir="rtl"
            autoFocus
            className="input-field !text-right !text-base !py-3"
          />
        </div>

        {/* Sets × reps/seconds */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-muted mb-1 text-right" dir="rtl">סטים</label>
            <input
              type="number"
              value={sets}
              onChange={e => setSets(e.target.value)}
              className="input-field !text-base !py-2.5"
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="block text-[10px] text-muted mb-1 text-right" dir="rtl">{isTimeBased ? 'שניות' : 'חזרות'}</label>
            <input
              type="number"
              value={reps}
              onChange={e => setReps(e.target.value)}
              className="input-field !text-base !py-2.5"
              inputMode="numeric"
            />
          </div>
        </div>

        {/* Time-based toggle */}
        <label className="flex items-center justify-end gap-2 text-sm" dir="rtl">
          <span>תרגיל זמן (שניות במקום חזרות)</span>
          <input
            type="checkbox"
            checked={isTimeBased}
            onChange={e => setIsTimeBased(e.target.checked)}
            className="rounded dark:bg-slate-800 dark:border-slate-600 bg-white border-slate-300"
          />
        </label>

        {/* Library quick-search */}
        <div className="border-t border-subtle pt-3">
          <label className="block text-[10px] text-muted mb-1 text-right" dir="rtl">או חפש בספריה (אנגלית)</label>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="bench press, squat..."
            className="input-field !text-sm"
          />
          {searchResults.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-subtle card !p-0">
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => selectFromLibrary(r)}
                  className="w-full text-left px-3 py-2 dark:hover:bg-slate-800 hover:bg-slate-100 border-b border-subtle/50 last:border-0"
                >
                  <div className="text-sm font-medium">{r.name}</div>
                  <div className="text-xs text-muted" dir="rtl">{r.nameHe} · {r.muscleHe}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add button */}
      <div className="p-4 border-t border-subtle">
        <button
          onClick={handleAdd}
          disabled={!canAdd}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-colors ${
            canAdd ? 'btn-primary' : 'dark:bg-slate-800 dark:text-slate-600 bg-slate-200 text-slate-400'
          }`}
        >
          הוסף ועבור לתרגיל
        </button>
      </div>
    </div>
  );
}
