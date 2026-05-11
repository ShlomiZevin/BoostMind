import { useEffect, useState } from 'react';
import type { Route } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { useProgramStart, getAutoWeek } from '../hooks/useProgram';

type Props = {
  uid: string;
  navigate: (route: Route) => void;
  onLogout: () => void;
};

export function Settings({ uid, navigate, onLogout }: Props) {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
  const firestore = useFirestore(uid);
  const effectiveStart = useProgramStart(uid);
  const [override, setOverride] = useState<string | null>(null);
  const [overrideLoaded, setOverrideLoaded] = useState(false);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    firestore.getProgramStartOverride().then(v => {
      setOverride(v);
      setDraft(v || '');
      setOverrideLoaded(true);
    });
  }, [uid]);

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

  async function saveOverride() {
    const v = draft.trim() || null;
    await firestore.setProgramStartOverride(v);
    setOverride(v);
    setEditing(false);
  }

  async function clearOverride() {
    await firestore.setProgramStartOverride(null);
    setOverride(null);
    setDraft('');
    setEditing(false);
  }

  const previewWeek = getAutoWeek(draft || effectiveStart);

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
        <div className="font-medium mb-1">Program start date</div>
        <div className="text-xs text-muted mb-3">
          Controls which week the app considers "current". By default it's derived from your earliest finished session.
        </div>

        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted text-xs">Effective</span>
          <span className="font-mono">{effectiveStart} · W{getAutoWeek(effectiveStart)}</span>
        </div>

        {overrideLoaded && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted text-xs">Override</span>
            <span className="font-mono text-xs">
              {override ? <span className="text-amber-500">{override}</span> : <span className="text-muted-most">auto (none)</span>}
            </span>
          </div>
        )}

        {editing ? (
          <div className="mt-3 pt-3 border-t border-subtle space-y-2">
            <input
              type="date"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="input-field !text-sm !py-1.5 !px-2"
            />
            {draft && (
              <div className="text-[10px] text-muted">
                Today would be <span className="text-main font-mono">Week {previewWeek}</span>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setEditing(false); setDraft(override || ''); }} className="btn-secondary flex-1 !py-1.5 text-xs">Cancel</button>
              <button onClick={saveOverride} disabled={!draft} className={`btn-primary flex-1 !py-1.5 text-xs ${!draft ? 'opacity-50' : ''}`}>Save</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 mt-3">
            <button onClick={() => setEditing(true)} className="btn-secondary flex-1 !py-1.5 text-xs">
              {override ? 'Edit override' : 'Set override'}
            </button>
            {override && (
              <button onClick={clearOverride} className="btn-secondary !py-1.5 text-xs text-amber-500">
                Use auto
              </button>
            )}
          </div>
        )}
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
