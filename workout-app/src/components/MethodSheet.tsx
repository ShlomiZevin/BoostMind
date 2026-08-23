import { METHOD } from '../data/method';
import type { PlaceId } from '../places/registry';

// "השיטה" — the place's method, shown to the user.
//
// A sheet rather than a screen: it is something you read once and come back to
// occasionally, not somewhere you navigate. Reached from that place's settings,
// and from the coach itself when someone asks what it goes by.
//
// The same principles are in the coach's system prompt (see data/method.ts), so
// what the user reads here is genuinely what the AI argues from.

const TINT: Record<PlaceId, { ring: string; text: string; dot: string }> = {
  exercise: {
    ring: 'border-emerald-500/40',
    text: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  food: {
    ring: 'border-amber-500/40',
    text: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
};

export function MethodSheet({ place, onClose }: { place: PlaceId; onClose: () => void }) {
  const m = METHOD[place];
  const t = TINT[place];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center dark:bg-black/70 bg-black/40"
      onClick={onClose}
    >
      <div
        className="overlay-solid w-full max-w-lg rounded-t-3xl sm:rounded-2xl border-t sm:border border-subtle
                   p-4 pb-[max(env(safe-area-inset-bottom),1rem)] max-h-[88dvh] overflow-y-auto"
        dir="rtl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="font-bold text-[17px]">{m.he}</h3>
          <button onClick={onClose} aria-label="סגור" className="text-muted text-2xl leading-none shrink-0">×</button>
        </div>

        {/* The whole philosophy in one line, before the list — most people read
            this and nothing else, and that has to be enough. */}
        <p className={`text-[14px] font-semibold leading-relaxed mb-4 ${t.text}`}>
          {m.essence}
        </p>

        <div className="space-y-3">
          {m.principles.map((p, i) => (
            <div key={i} className={`rounded-xl border ${t.ring} bg-subtle p-3`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.dot}`} />
                <div className="font-bold text-[14px]">{p.title}</div>
              </div>
              <p className="text-[13px] text-muted leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>

        <p className="text-[12px] text-muted-more leading-relaxed mt-4">
          המאמן של המקום הזה עובד לפי העקרונות האלה — אפשר לשאול אותו על כל אחד מהם,
          או לבקש ממנו להסביר למה הוא הציע משהו מסוים.
        </p>

        <button
          onClick={onClose}
          className="w-full mt-4 py-3 rounded-xl bg-subtle border border-subtle font-bold text-[14px]"
        >
          סגור
        </button>
      </div>
    </div>
  );
}
