import { useEffect, useState } from 'react';
import type { Route } from '../types';
import { useFirestore } from '../hooks/useFirestore';
import { PARENT_INFO, musclesByParent, DEFAULT_WEEKLY_TARGETS } from '../data/muscles';
import type { MuscleGroup, MuscleParent } from '../data/muscles';
import { TopBar } from './TopBar';
import { CloseAction } from './TopBarActions';

type Props = {
  uid: string;
  navigate: (route: Route) => void;
  onLogout: () => void;
};

const PARENT_ORDER: MuscleParent[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];

export function Settings({ uid, navigate, onLogout }: Props) {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
  const firestore = useFirestore(uid);
  const [targets, setTargets] = useState<Record<MuscleGroup, number>>({ ...DEFAULT_WEEKLY_TARGETS });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    firestore.getWeeklyTargets().then(t => { setTargets(t); setLoaded(true); });
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

  async function changeTarget(id: MuscleGroup, delta: number) {
    const next = Math.max(0, (targets[id] || 0) + delta);
    const newTargets = { ...targets, [id]: next };
    setTargets(newTargets);
    await firestore.setWeeklyTargets(newTargets);
  }

  async function resetTargets() {
    setTargets({ ...DEFAULT_WEEKLY_TARGETS });
    await firestore.setWeeklyTargets(DEFAULT_WEEKLY_TARGETS);
  }

  return (
    <div className="page-bg min-h-screen">
      <TopBar
        title="הגדרות"
        accent="brand"
        tint="amber"
        actions={<CloseAction navigate={navigate} />}
      />
      <div className="p-4 pb-4 max-w-lg mx-auto">

      <div className="card mb-4">
        <div className="flex items-center justify-between" dir="rtl">
          <div className="text-right">
            <div className="font-medium">מצב תצוגה</div>
            <div className="text-xs text-muted">חשוך / בהיר</div>
          </div>
          <button onClick={toggleTheme} className="btn-secondary px-4 py-2 text-sm">
            {isDark ? '☀️ בהיר' : '🌙 חשוך'}
          </button>
        </div>
      </div>

      <button
        onClick={() => navigate({ page: 'exercises' })}
        className="w-full card mb-4 dark:hover:bg-slate-800 hover:bg-slate-50"
        dir="rtl"
      >
        <div className="flex items-center justify-between">
          <div className="text-right">
            <div className="font-medium">התרגילים שלי</div>
            <div className="text-xs text-muted">ניהול תרגילים, תמונות, שמות וכינויים</div>
          </div>
          <span className="text-muted text-lg">←</span>
        </div>
      </button>

      <div className="card mb-4">
        <div className="flex items-center justify-between mb-3" dir="rtl">
          <div className="text-right">
            <div className="font-medium">מטרות שבועיות</div>
            <div className="text-xs text-muted">כמה סטים לכל שריר בשבוע</div>
          </div>
          <button onClick={resetTargets} className="text-[11px] text-blue-500 dark:text-blue-400">איפוס לברירת מחדל</button>
        </div>
        {loaded && (
          <div className="space-y-4">
            {PARENT_ORDER.map(parent => {
              const info = PARENT_INFO[parent];
              const children = musclesByParent(parent);
              return (
                <div key={parent}>
                  <div className="text-xs font-semibold text-right mb-1.5 pb-1 border-b border-subtle" dir="rtl">
                    {info.he}
                  </div>
                  <div className="space-y-1">
                    {children.map(m => (
                      <div key={m.id} className="flex items-center justify-between py-1" dir="rtl">
                        <div className="text-sm">{m.he}</div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => changeTarget(m.id, -1)}
                            className="w-8 h-8 rounded-lg dark:bg-slate-800 bg-slate-200 text-muted text-lg leading-none"
                          >−</button>
                          <span className="font-mono text-sm w-8 text-center">{targets[m.id] || 0}</span>
                          <button
                            onClick={() => changeTarget(m.id, 1)}
                            className="w-8 h-8 rounded-lg dark:bg-slate-800 bg-slate-200 text-muted text-lg leading-none"
                          >+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card mb-4">
        <div className="flex items-center justify-between" dir="rtl">
          <div className="text-right">
            <div className="font-medium">החלף משתמש</div>
            <div className="text-xs text-muted">התנתק והכנס עם סיסמה אחרת</div>
          </div>
          <button onClick={onLogout} className="btn-secondary px-4 py-2 text-sm text-red-500">
            התנתק
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
