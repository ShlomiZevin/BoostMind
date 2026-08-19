// One anchor pill, used everywhere. Consolidates the visual language for
// "עוגן" so the exercise-DB list, the log-set modal, the picker, and the
// live-session cards all read the same way at a glance.
//
// Design choices:
//   • Naval-anchor SVG (Lucide-style) — a STAR reads as "favorite", which is
//     a different mental model. An anchor visually says "staple / grounded".
//   • Amber-500 as the accent — warm, techy, distinct from every other
//     accent already in the app (emerald = live/AI, blue = plan, red = danger).
//   • ON state: solid amber pill with white icon+text — impossible to miss.
//   • OFF state: transparent with amber border+icon — a subtle "opt in" cue.
//   • Sizes come from the `size` prop so the same look scales from the
//     tight session-card icons (xs) to the DB-list row action strip (sm).

type Size = 'xs' | 'sm' | 'md';

const SIZE: Record<Size, { pillPad: string; text: string; icon: number; gap: string }> = {
  xs: { pillPad: 'px-1.5 py-0.5', text: 'text-[9px]',  icon: 10, gap: 'gap-1' },
  sm: { pillPad: 'px-2 py-1',     text: 'text-[11px]', icon: 12, gap: 'gap-1' },
  md: { pillPad: 'px-2.5 py-1',   text: 'text-xs',     icon: 14, gap: 'gap-1.5' },
};

export function AnchorIcon({ size = 12, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="3" />
      <line x1="12" y1="22" x2="12" y2="8" />
      <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
    </svg>
  );
}

/**
 * Interactive anchor pill — tap toggles isAnchor. Same visual as AnchorBadge
 * but wired as a <button> with aria-pressed for a11y.
 */
export function AnchorToggle({
  active, onToggle, size = 'sm', label = 'עוגן', showLabel = true, className = '',
}: {
  active: boolean;
  onToggle: () => void;
  size?: Size;
  label?: string;
  showLabel?: boolean;
  className?: string;
}) {
  const s = SIZE[size];
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-pressed={active}
      aria-label={active ? `הסר עוגן` : `סמן כעוגן`}
      title={active ? 'הסר עוגן — יצא מרשימת העוגנים' : 'סמן כעוגן — יופיע ראשון בבחירה'}
      className={`inline-flex items-center ${s.gap} ${s.pillPad} ${s.text} font-semibold rounded-full border transition-colors shrink-0 ${
        active
          ? 'bg-amber-500 text-white border-amber-500 shadow-[0_0_10px_-2px_rgba(245,158,11,0.5)]'
          : 'text-amber-600 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/10'
      } ${className}`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <AnchorIcon size={s.icon} />
      {showLabel && <span>{label}</span>}
    </button>
  );
}

/**
 * Read-only anchor badge — no click, just a "this is an anchor" marker to
 * drop into an exercise card header. Same colors, no border animation.
 */
export function AnchorBadge({ size = 'xs', label = 'עוגן', className = '' }: {
  size?: Size; label?: string; className?: string;
}) {
  const s = SIZE[size];
  return (
    <span
      className={`inline-flex items-center ${s.gap} ${s.pillPad} ${s.text} font-semibold rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40 shrink-0 ${className}`}
      title="תרגיל עוגן"
    >
      <AnchorIcon size={s.icon} />
      <span>{label}</span>
    </span>
  );
}
