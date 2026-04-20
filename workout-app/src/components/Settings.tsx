import { useState } from 'react';
import type { Route } from '../types';

type Props = {
  navigate: (route: Route) => void;
  onLogout: () => void;
};

export function Settings({ navigate, onLogout }: Props) {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));

  function toggleTheme() {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('bg-slate-950', 'text-slate-100');
      document.body.classList.add('bg-slate-50', 'text-slate-900');
      localStorage.setItem('workout-theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      document.body.classList.remove('bg-slate-50', 'text-slate-900');
      document.body.classList.add('bg-slate-950', 'text-slate-100');
      localStorage.setItem('workout-theme', 'dark');
      setIsDark(true);
    }
  }

  return (
    <div className="page-bg p-4 pb-20 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate({ page: 'home' })} className="text-muted text-2xl">←</button>
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      <div className="card mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Theme</div>
            <div className="text-xs text-muted">Switch between dark and light mode</div>
          </div>
          <button onClick={toggleTheme} className="btn-secondary px-4 py-2 text-sm">
            {isDark ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </div>

      <div className="card mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Switch User</div>
            <div className="text-xs text-muted">Log out and enter a different passcode</div>
          </div>
          <button onClick={onLogout} className="btn-secondary px-4 py-2 text-sm text-red-500">
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
