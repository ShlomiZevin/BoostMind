import { useEffect, useRef } from 'react';

// Small in-app confirm dialog. Replaces browser `confirm()` — the native one
// looks like a warning ("boostmind-b052c.web.app says…") and breaks the RTL,
// dark-mode feel of the app (rep follow-up on the unpin flow). Same shape as
// the existing modal cards in Settings/OnboardingScreen so it doesn't feel
// like a new pattern.

type Tone = 'default' | 'danger';

type Props = {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open, title, body,
  confirmLabel = 'אישור',
  cancelLabel  = 'ביטול',
  tone = 'default',
  onConfirm, onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Escape cancels, Enter confirms — matches how the browser dialog behaved.
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); return; }
      if (e.key === 'Enter')  { e.preventDefault(); onConfirm(); return; }
    }
    window.addEventListener('keydown', onKey);
    // Focus the confirm button so keyboard users can press Enter immediately.
    confirmRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  const confirmCls = tone === 'danger'
    ? 'btn-primary bg-red-600 hover:bg-red-500 flex-1 py-2.5'
    : 'btn-primary flex-1 py-2.5';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center dark:bg-black/70 bg-black/40 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="card max-w-sm w-full text-right"
        dir="rtl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-bold text-base mb-1.5">{title}</h3>
        {body && <p className="text-sm text-muted mb-4 whitespace-pre-wrap leading-relaxed">{body}</p>}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="btn-secondary flex-1 py-2.5"
          >{cancelLabel}</button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={confirmCls}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
