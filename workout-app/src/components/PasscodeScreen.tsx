import { useState } from 'react';

type Props = {
  onUnlock: (passcode: string) => void;
};

export function PasscodeScreen({ onUnlock }: Props) {
  const [digits, setDigits] = useState('');

  function handleDigit(d: string) {
    const next = digits + d;
    if (next.length <= 4) {
      setDigits(next);
      if (next.length === 4) {
        onUnlock(next);
      }
    }
  }

  function handleDelete() {
    setDigits(d => d.slice(0, -1));
  }

  return (
    <div className="page-bg flex flex-col items-center justify-center p-4">
      <h1 className="text-xl font-bold mb-2">Workout Logger</h1>
      <p className="text-muted text-sm mb-8">Enter your 4-digit passcode</p>

      {/* Dots */}
      <div className="flex gap-3 mb-8">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all ${
              i < digits.length
                ? 'bg-emerald-500 scale-110'
                : 'dark:bg-slate-700 bg-slate-300'
            }`}
          />
        ))}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 max-w-[240px]">
        {['1','2','3','4','5','6','7','8','9','','0','del'].map(key => (
          key === '' ? <div key="empty" /> :
          key === 'del' ? (
            <button
              key="del"
              onClick={handleDelete}
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-muted text-sm active:opacity-50"
            >
              ←
            </button>
          ) : (
            <button
              key={key}
              onClick={() => handleDigit(key)}
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-medium dark:bg-slate-800 bg-slate-200 dark:hover:bg-slate-700 hover:bg-slate-300 active:bg-emerald-600 active:text-white transition-colors"
            >
              {key}
            </button>
          )
        ))}
      </div>
    </div>
  );
}
