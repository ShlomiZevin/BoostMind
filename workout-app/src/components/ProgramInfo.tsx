import type { Route } from '../types';
import { PROGRAM } from '../data/program';

type Props = {
  navigate: (route: Route) => void;
};

export function ProgramInfo({ navigate }: Props) {
  return (
    <div className="page-bg p-4 pb-20 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate({ page: 'home' })} className="text-muted text-2xl">←</button>
        <h1 className="text-xl font-bold">Program Info</h1>
      </div>

      {/* Phases */}
      <div className="card mb-4">
        <h2 className="font-semibold text-emerald-500 dark:text-emerald-400 mb-3">Phases</h2>
        <div className="space-y-2">
          {PROGRAM.phases.map(p => (
            <div key={p.phase} className="flex justify-between text-sm">
              <span className="font-medium">Phase {p.phase} — Weeks {p.weeks[0]}–{p.weeks[1]}</span>
              <span className="text-muted">Tempo {p.tempo} · Rest {p.restSeconds}s</span>
            </div>
          ))}
        </div>
      </div>

      {/* Unilateral protocol */}
      <div className="card mb-4 dark:border-amber-800/50 border-amber-200">
        <h2 className="font-semibold text-amber-500 dark:text-amber-400 mb-2">Unilateral Protocol</h2>
        <ol className="text-sm text-muted space-y-1 list-decimal list-inside">
          <li>Start with <strong className="text-main">LEFT</strong> (weak side)</li>
          <li>Do as many reps as left can at RIR 1-2</li>
          <li>Match that rep count on right</li>
          <li>Don't go heavier on right to compensate</li>
        </ol>
      </div>

      {/* Days */}
      {PROGRAM.days.map(day => (
        <div key={day.day} className="card mb-4">
          <h2 className="font-semibold text-emerald-500 dark:text-emerald-400 mb-1">
            Day {day.day} — {day.title}
          </h2>
          {day.titleHe && (
            <p className="text-xs text-muted mb-3" dir="rtl">{day.titleHe}</p>
          )}
          <div className="space-y-2">
            {day.exercises.map((ex, i) => (
              <div key={ex.id} className="flex items-start gap-2 text-sm">
                <span className="text-muted-most font-mono w-5 shrink-0">{i + 1}.</span>
                <div className="flex-1">
                  <div className="font-medium">{ex.name}</div>
                  {ex.nameHe && (
                    <div className="text-xs text-muted" dir="rtl">{ex.nameHe}</div>
                  )}
                  {ex.muscle && (
                    <div className="text-xs text-emerald-600 dark:text-emerald-600">{ex.muscle}{ex.muscleHe ? ` · ${ex.muscleHe}` : ''}</div>
                  )}
                  {ex.notes && <div className="text-xs text-amber-600 mt-0.5">{ex.notes}</div>}
                </div>
                <div className="text-right shrink-0 text-muted">
                  <div className="font-mono text-xs">
                    {ex.sets}×{ex.isTimeBased ? `${ex.durationSeconds}s` : ex.reps}
                  </div>
                  {ex.isUnilateral && (
                    <span className="badge bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-[10px] mt-0.5">UNI</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
