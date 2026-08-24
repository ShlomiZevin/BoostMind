import type { Route } from '../types';

// One nav bar shared across every admin page — dashboard, users, tasks —
// so a click never leaves the admin surface, and it's always obvious where
// you can jump to next.

type AdminPage = 'admin-desktop' | 'users-admin' | 'reports-admin';

const TABS: { id: AdminPage; label: string; color: string }[] = [
  { id: 'admin-desktop', label: '📊 דשבורד',  color: 'emerald' },
  { id: 'users-admin',   label: '👥 משתמשים', color: 'emerald' },
  { id: 'reports-admin', label: '✅ משימות',  color: 'blue' },
];

export function AdminNav({
  current, navigate, onReload, extraRight,
}: {
  current: AdminPage;
  navigate: (r: Route) => void;
  onReload?: () => void;
  extraRight?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-20 dark:bg-slate-950/95 bg-slate-50/95 backdrop-blur border-b border-subtle" dir="rtl">
      <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center gap-2">
        {/* Brand — click to go to app home */}
        <button
          onClick={() => navigate({ page: 'home' })}
          className="text-[11px] font-bold text-muted hover:text-main flex items-center gap-1.5 pe-3 border-e border-subtle"
          title="חזרה לאפליקציה"
        >
          <span>← לאפליקציה</span>
        </button>

        {/* Nav tabs */}
        <nav className="flex items-center gap-1">
          {TABS.map(t => {
            const active = t.id === current;
            return (
              <button
                key={t.id}
                onClick={() => navigate({ page: t.id } as Route)}
                className={`text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  active
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                    : 'text-muted hover:text-main border border-transparent hover:border-subtle'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="flex-1" />

        {extraRight}

        {onReload && (
          <button
            onClick={onReload}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-subtle text-muted hover:text-main dark:hover:bg-slate-800 hover:bg-slate-100"
            title="רענן נתונים"
          >רענן</button>
        )}
      </div>
    </div>
  );
}
