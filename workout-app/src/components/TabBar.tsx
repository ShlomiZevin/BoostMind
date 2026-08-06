import type { Route } from '../types';

type TabId = 'home' | 'history' | 'body' | 'exercises' | 'settings';

type Props = {
  current: TabId;
  onNavigate: (r: Route) => void;
  hasInProgress: boolean;
  onFabClick: () => void;
};

function TabButton({
  active, label, icon, onClick,
}: {
  active: boolean;
  label: string;
  icon: JSX.Element;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] transition-colors ${
        active ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted hover:text-main'
      }`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <span className={`transition-transform ${active ? 'scale-105' : ''}`}>
        {icon}
      </span>
      <span className={`text-[10px] ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
    </button>
  );
}

// Simple, consistent line-icon set — always stroke-only, color controlled by parent.
function IconHome() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
    </svg>
  );
}
function IconHistory() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconDumbbell() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5v11M4 9v6M17.5 6.5v11M20 9v6M6.5 12h11" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
function IconBody() {
  // Simple torso/silhouette icon
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4.5" r="2.2" />
      <path d="M8 21v-6l-2-3V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4l-2 3v6" />
      <path d="M10 12h4" />
    </svg>
  );
}

export function TabBar({ current, onNavigate, hasInProgress, onFabClick }: Props) {
  return (
    <>
      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40
                   bg-white/95 dark:bg-slate-950/95 backdrop-blur
                   border-t dark:border-slate-800 border-slate-200
                   pb-[env(safe-area-inset-bottom)]"
        dir="rtl"
      >
        <div className="max-w-lg mx-auto flex items-stretch relative">
          <TabButton
            active={current === 'home'}
            label="בית"
            icon={<IconHome />}
            onClick={() => onNavigate({ page: 'home' })}
          />
          <TabButton
            active={current === 'history'}
            label="היסטוריה"
            icon={<IconHistory />}
            onClick={() => onNavigate({ page: 'history' })}
          />

          {/* FAB well — takes the middle slot */}
          <div className="w-16 shrink-0 relative flex justify-center">
            <button
              onClick={onFabClick}
              aria-label={hasInProgress ? 'המשך אימון' : 'התחל אימון'}
              className={`absolute -top-7 w-16 h-16 rounded-full flex items-center justify-center
                         text-white font-bold shadow-[0_8px_24px_-4px_rgba(16,185,129,0.5)]
                         transition-transform active:scale-95 hover:scale-105
                         ${hasInProgress
                           ? 'bg-emerald-500 ring-4 ring-emerald-500/25'
                           : 'bg-emerald-600 ring-4 ring-emerald-600/20'}`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {hasInProgress ? (
                <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              )}
              {hasInProgress && (
                <span className="absolute -top-0.5 -left-0.5 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400 ring-2 ring-white dark:ring-slate-950" />
                </span>
              )}
            </button>
          </div>

          <TabButton
            active={current === 'body'}
            label="גוף"
            icon={<IconBody />}
            onClick={() => onNavigate({ page: 'body' })}
          />
          <TabButton
            active={current === 'exercises'}
            label="תרגילים"
            icon={<IconDumbbell />}
            onClick={() => onNavigate({ page: 'exercises' })}
          />
        </div>
      </nav>
    </>
  );
}
