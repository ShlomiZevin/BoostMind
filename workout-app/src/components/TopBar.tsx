import type { ReactNode } from 'react';

type TintColor = 'emerald' | 'blue' | 'violet' | 'amber';

type Props = {
  title: string;
  subtitle?: ReactNode;
  /** Rendered on the LEFT (RTL end) — usually action buttons. */
  actions?: ReactNode;
  /** Compact stat pill(s) rendered between title and actions (e.g., session set count). */
  center?: ReactNode;
  /** Optional accent style. `live` = active-session emerald tint. `brand` = subtle tab tint (paired with `tint`). */
  accent?: 'live' | 'brand' | null;
  /** Color of the accent bar + subtle wash when accent='brand'. Defaults to 'emerald'. */
  tint?: TintColor;
};

const TINT_STYLES: Record<TintColor, {
  bgLight: string;
  bgDark: string;
  border: string;
  shadow: string;
  bar: string;
}> = {
  emerald: {
    bgLight: 'from-emerald-50/95 to-white/85',
    bgDark:  'dark:from-emerald-950/40 dark:to-slate-950/90',
    border:  'border-emerald-500/20',
    shadow:  'shadow-[0_2px_10px_-6px_rgba(16,185,129,0.35)]',
    bar:     'bg-emerald-500',
  },
  blue: {
    bgLight: 'from-blue-50/95 to-white/85',
    bgDark:  'dark:from-blue-950/40 dark:to-slate-950/90',
    border:  'border-blue-500/20',
    shadow:  'shadow-[0_2px_10px_-6px_rgba(59,130,246,0.35)]',
    bar:     'bg-blue-500',
  },
  violet: {
    bgLight: 'from-violet-50/95 to-white/85',
    bgDark:  'dark:from-violet-950/40 dark:to-slate-950/90',
    border:  'border-violet-500/20',
    shadow:  'shadow-[0_2px_10px_-6px_rgba(139,92,246,0.35)]',
    bar:     'bg-violet-500',
  },
  amber: {
    bgLight: 'from-amber-50/95 to-white/85',
    bgDark:  'dark:from-amber-950/40 dark:to-slate-950/90',
    border:  'border-amber-500/20',
    shadow:  'shadow-[0_2px_10px_-6px_rgba(245,158,11,0.35)]',
    bar:     'bg-amber-500',
  },
};

export function TopBar({ title, subtitle, actions, center, accent, tint = 'emerald' }: Props) {
  const isLive = accent === 'live';
  const isBrand = accent === 'brand';
  const t = TINT_STYLES[tint];
  return (
    <header
      className={`sticky top-0 z-30
                  backdrop-blur-lg border-b
                  pt-[env(safe-area-inset-top)]
                  ${isLive
                    ? 'bg-emerald-50/95 dark:bg-emerald-950/70 border-emerald-500/25 shadow-[0_1px_0_0_rgba(16,185,129,0.15)]'
                    : isBrand
                      ? `bg-gradient-to-b ${t.bgLight} ${t.bgDark} ${t.border} ${t.shadow}`
                      : 'bg-white/90 dark:bg-slate-950/90 dark:border-slate-800/80 border-slate-200/80 shadow-[0_1px_0_0_rgba(0,0,0,0.03)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.03)]'}`}
      dir="rtl"
    >
      <div className="max-w-lg mx-auto flex items-center gap-3 px-4 min-h-[64px] py-2.5">
        {/* Right (RTL start): title + subtitle with accent bar */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Left-edge accent bar — brand identity, color per page */}
          {!isLive && <span className={`w-1 h-8 rounded-full ${t.bar} shrink-0`} />}
          <div className="text-right min-w-0 flex-1">
            <h1 className={`font-bold leading-tight truncate ${isLive ? 'text-lg text-emerald-700 dark:text-emerald-200' : 'text-xl text-main'}`}>
              {title}
            </h1>
            {subtitle && (
              <div className={`leading-tight mt-0.5 truncate ${isLive ? 'text-[11px] text-emerald-700/70 dark:text-emerald-300/80' : 'text-xs text-muted'}`}>
                {subtitle}
              </div>
            )}
          </div>
        </div>
        {/* Middle: compact stat pill */}
        {center && (
          <div className="shrink-0 flex items-center">
            {center}
          </div>
        )}
        {/* Left (RTL end): action buttons */}
        {actions && (
          <div className="shrink-0 flex items-center gap-1">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
