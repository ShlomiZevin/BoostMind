import { useMemo, useState } from 'react';

type Props = {
  currentYmd?: string;                     // e.g. '2026-08-14'
  onCancel: () => void;
  onMove: (newYmd: string) => Promise<void>;
};

const DOW_HE_LONG = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// Simple date-picker modal for moving a planned session. Offers the next 21 days
// as tap targets (today + relative labels) plus a manual <input type=date> for
// picking something further out. Kept deliberately minimal — one purpose only.
export function MovePlanModal({ currentYmd, onCancel, onMove }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const upcoming = useMemo(() => {
    const out: Array<{ ymd: string; label: string; sub: string }> = [];
    const t = new Date(); t.setHours(0, 0, 0, 0);
    for (let i = 0; i < 21; i++) {
      const y = t.getFullYear();
      const m = String(t.getMonth() + 1).padStart(2, '0');
      const d = String(t.getDate()).padStart(2, '0');
      const ymd = `${y}-${m}-${d}`;
      const label = i === 0 ? 'היום' : i === 1 ? 'מחר' : DOW_HE_LONG[t.getDay()];
      const sub = `${t.getDate()}/${t.getMonth() + 1}`;
      out.push({ ymd, label, sub });
      t.setDate(t.getDate() + 1);
    }
    return out;
  }, []);

  async function pick(ymd: string) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await onMove(ymd);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/50 p-4" onClick={onCancel}>
      <div className="card max-w-md w-full text-right" dir="rtl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-base">העבר את התוכנית לתאריך אחר</h3>
          <button onClick={onCancel} className="text-muted text-2xl leading-none">×</button>
        </div>
        {currentYmd && (
          <div className="text-[11px] text-muted-most mb-3">
            תאריך נוכחי: <span dir="ltr" className="font-mono">{currentYmd}</span>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 mb-4 max-h-[45vh] overflow-y-auto">
          {upcoming.map(u => {
            const isCurrent = u.ymd === currentYmd;
            return (
              <button
                key={u.ymd}
                onClick={() => pick(u.ymd)}
                disabled={busy || isCurrent}
                className={`py-2.5 px-2 rounded-xl text-center transition-colors ${
                  isCurrent
                    ? 'dark:bg-slate-800 bg-slate-100 text-muted-most'
                    : 'dark:bg-slate-800 bg-slate-100 dark:hover:bg-emerald-950/40 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:text-emerald-300'
                }`}
              >
                <div className="text-[13px] font-semibold">{u.label}</div>
                <div className="text-[10px] text-muted mt-0.5">{u.sub}</div>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted shrink-0">או בחר תאריך:</label>
          <input
            type="date"
            defaultValue={currentYmd}
            disabled={busy}
            onChange={e => e.target.value && pick(e.target.value)}
            className="input-field flex-1 !py-2 !text-sm"
            dir="ltr"
          />
        </div>
        {err && <div className="text-xs text-red-500 mt-3 text-center">{err}</div>}
      </div>
    </div>
  );
}
