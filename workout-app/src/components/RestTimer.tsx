type Props = {
  remaining: number;
  isRunning: boolean;
  onSkip: () => void;
  onAddTime: (s: number) => void;
  nextLabel: string;
  isDone: boolean;
};

export function RestTimer({ remaining, isRunning, onSkip, onAddTime, nextLabel, isDone }: Props) {
  if (!isRunning && !isDone) return null;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center dark:bg-slate-950/95 bg-white/95 backdrop-blur-sm transition-all ${
      remaining === 0 ? 'animate-pulse border-4 border-emerald-500' : ''
    }`}>
      <div className="text-muted text-sm mb-4 uppercase tracking-wider">Rest Timer</div>

      <div className={`text-8xl font-mono font-bold mb-8 tabular-nums ${
        remaining <= 5 && remaining > 0 ? 'text-red-500' :
        remaining === 0 ? 'text-emerald-500' : 'text-main'
      }`}>
        {display}
      </div>

      {remaining === 0 && (
        <div className="text-emerald-500 text-lg font-semibold mb-6">GO!</div>
      )}

      <div className="text-muted text-sm mb-8">
        Next: {nextLabel}
      </div>

      <div className="flex gap-4">
        <button onClick={onSkip} className="btn-secondary px-8">
          {remaining === 0 ? 'Continue' : 'Skip'}
        </button>
        {remaining > 0 && (
          <button onClick={() => onAddTime(30)} className="btn-secondary px-8">
            +30s
          </button>
        )}
      </div>
    </div>
  );
}
