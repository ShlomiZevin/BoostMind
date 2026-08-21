// Which Claude model every AI call in the app uses.
//
// Deliberately an OVERRIDE, not a setting with a default: when nothing is
// chosen this returns `undefined`, the field is omitted from the request, and
// the server falls back to exactly what it used before. Untouched === today.
//
// Mirrored into localStorage because request bodies are built synchronously in
// half a dozen places; Firestore is the source of truth so the choice follows
// the account rather than the device.

export type AiModelId = 'claude-opus-5' | 'claude-sonnet-5';

export const AI_MODELS: { id: AiModelId; label: string; note: string }[] = [
  {
    id: 'claude-opus-5',
    label: 'Opus 5',
    note: 'ברירת המחדל — הכי מדויק, הכי איטי ויקר',
  },
  {
    id: 'claude-sonnet-5',
    label: 'Sonnet 5',
    note: 'מהיר יותר, כ-40% זול יותר. לבדוק אם יורדת איכות',
  },
];

/** What the server uses when no override is sent. Kept here only so the UI can
 *  show which option is the current default — the server owns the real value. */
export const DEFAULT_AI_MODEL: AiModelId = 'claude-opus-5';

const KEY = 'aiModel';

function isValid(v: unknown): v is AiModelId {
  return v === 'claude-opus-5' || v === 'claude-sonnet-5';
}

/** Undefined = no override; the request omits `model` entirely. */
export function getAiModel(): AiModelId | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    return isValid(raw) ? raw : undefined;
  } catch {
    return undefined;
  }
}

export function cacheAiModel(v: AiModelId | undefined): void {
  try {
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  } catch { /* private mode */ }
}

export { isValid as isValidAiModel };
