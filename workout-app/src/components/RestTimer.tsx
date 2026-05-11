import { useState, useEffect } from 'react';

type Props = {
  remaining: number;
  isRunning: boolean;
  onSkip: () => void;
  onAddTime: (s: number) => void;
  nextLabel: string;
  isDone: boolean;
};

export function RestTimer({ remaining, isRunning, onSkip, onAddTime, nextLabel, isDone }: Props) {
  const [minimized, setMinimized] = useState(false);

  // Reset to expanded each time a new timer starts
  useEffect(() => {
    if (isRunning) setMinimized(false);
  }, [isRunning]);

  // Pop back to fullscreen when timer hits zero so user sees the GO! cue
  useEffect(() => {
    if (remaining === 0) setMinimized(false);
  }, [remaining]);

  if (!isRunning && !isDone) return null;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  if (minimized && remaining > 0) {
    const urgent = remaining <= 5;
    return (
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-40">
        <div className={`flex items-center gap-2 dark:bg-slate-900 bg-white border border-subtle rounded-full px-3 py-1.5 shadow-lg ${urgent ? 'ring-2 ring-red-500' : ''}`}>
          <button
            onClick={() => setMinimized(false)}
            className="flex items-center gap-2"
          >
            <span className="text-[10px] text-muted uppercase tracking-wider">Rest</span>
            <span className={`font-mono font-bold tabular-nums text-base ${urgent ? 'text-red-500' : 'text-main'}`}>
              {display}
            </span>
          </button>
          <span className="text-muted-most">·</span>
          <button onClick={() => onAddTime(30)} className="text-[10px] text-blue-500 hover:text-blue-400">+30s</button>
          <button onClick={onSkip} className="text-[10px] text-amber-500 hover:text-amber-400">Skip</button>
        </div>
      </div>
    );
  }

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

      <div className="flex gap-3 flex-wrap justify-center px-4">
        <button onClick={onSkip} className="btn-secondary px-6">
          {remaining === 0 ? 'Continue' : 'Skip'}
        </button>
        {remaining > 0 && (
          <>
            <button onClick={() => onAddTime(30)} className="btn-secondary px-6">+30s</button>
            <button onClick={() => setMinimized(true)} className="btn-secondary px-6">Minimize</button>
          </>
        )}
      </div>
    </div>
  );
}
