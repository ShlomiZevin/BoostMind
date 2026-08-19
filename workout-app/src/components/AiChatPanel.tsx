import { useEffect, useMemo, useRef, useState } from 'react';
import type { FreeSet, FreeSession } from '../types';
import type { MuscleGroup } from '../data/muscles';
import { MUSCLE_BY_ID, MUSCLE_CLASSES, ACTIVE_MUSCLES } from '../data/muscles';
import { type PersonalExercise } from '../data/exercisesDB';
import { CHAT_API_URL } from '../config/api';
import { useFirestore } from '../hooks/useFirestore';
import { compressImage } from '../hooks/usePhotos';
import type { UserProfile, ChatBucket, MealFlags, MealIngredient, MealMacros, MealType, PersonalMeal, MealLog, DietProfile } from '../types';

type Props = {
  uid: string;
  mode?: 'session' | 'naming' | 'onboarding' | 'trainer' | 'dietary';
  // Onboarding-mode: invoked when the AI emits a ready_to_build action.
  // Component owns the collected profile at that point; the parent triggers plan build.
  onReadyToBuild?: (profile: ActionReadyToBuild) => void;
  // Invoked whenever the AI emits an update_profile action — parent decides what to
  // do (usually: persist the patch to Firestore + refresh in-memory state).
  onProfilePatch?: (patch: Record<string, unknown>) => void;
  // Small inline CTA that renders below the initial assistant greeting and
  // auto-hides as soon as the user sends their first message. Used by
  // OnboardingScreen to expose a low-key "דלג לעכשיו" escape.
  earlySkipCta?: { label: string; onClick: () => void };
  // Explicit stable thread id — overrides the default (resume latest / new).
  // Used by OnboardingScreen to always land on the same "שיחת ההיכרות" thread
  // whether it's the user's first onboarding or a reopen of an existing chat.
  fixedThreadId?: string;
  // Session-mode props (defaults for naming mode)
  sessionMuscles?: MuscleGroup[];
  recentSets?: FreeSet[];
  onAddSet?: (partial: {
    muscle: MuscleGroup;
    exerciseName: string;
    en?: string;
    weight?: number;
    reps?: number;
    isHoldTime?: boolean;
  }) => Promise<void> | void;
  /** Alternative to onAddSet — saves suggested exercise to personal DB instead of a session. Used from the Exercises page's "הוסף עם AI" flow. */
  onAddToDb?: (partial: {
    muscle: MuscleGroup;
    exerciseName: string;
    en?: string;
    isHoldTime?: boolean;
  }) => Promise<void> | void;
  onRename?: (id: string, patch: { he?: string; en?: string; muscle?: MuscleGroup }) => Promise<void> | void;
  initialPrompt?: string;  // Auto-send this prompt when the panel opens (as if the user typed it)
  initialAssistantMessage?: string; // Seed the thread with a fake assistant greeting — no request to the server
  replaceContext?: { name: string; muscle: MuscleGroup }; // signal to the model + UI: user is REPLACING this exercise
  newThreadOnMount?: boolean;  // start a fresh conversation thread instead of resuming latest
  // Names of exercises currently in this session — either already logged (with sets)
  // or queued as plannedExercises. Used for BOTH:
  //   (a) Telling the AI so it knows what you're already doing today
  //   (b) Highlighting "already added" suggestion cards in blue instead of green
  currentSessionExercises?: Array<{ name: string; muscle: MuscleGroup; hasSets: boolean }>;
  // 'active' when the user is inside a live workout right now; 'planned' when editing a future plan.
  currentSessionStatus?: 'active' | 'planned';
  // YYYY-MM-DD the session is planned for — only meaningful when currentSessionStatus === 'planned'.
  currentSessionPlannedFor?: string;
  // Short summary of aerobic done in this session — e.g. "15 דק' ריצה, 20 דק' אופניים".
  currentSessionAerobicSummary?: string;
  // Trainer mode: planned upcoming sessions so the AI can answer "מה מתוכנן לי השבוע?".
  plannedSessions?: FreeSession[];
  // ─── Dietary mode ───
  personalMeals?: PersonalMeal[];
  todayMeals?: MealLog[];
  dietProfile?: DietProfile;
  todayBurn?: number;
  /** Approve a meal card → log it. */
  onAddMeal?: (m: MealDraft) => Promise<void> | void;
  /** Open the meal card in the manual editor instead of logging it as-is. */
  onEditMeal?: (m: MealDraft) => void;
  /** One-tap prompts above the input (e.g. your usual meals for this slot). */
  suggestionChips?: string[];
  onClose: () => void;
};

/** What a meal card hands back when you approve or edit it. */
export type MealDraft = {
  /** Set when the draft came from a chat card, so saving via the manual editor
   *  still marks that card as added. */
  actionRef?: { threadId: string; key: string };
  mealId?: string | null;
  he: string;
  mealType: MealType;
  calories: number;
  ingredients?: MealIngredient[];
  macros?: MealMacros;
  flags?: MealFlags;
};

type Msg = { role: 'user' | 'assistant'; content: string; ts: number; truncated?: boolean; image?: string };

type ActionSuggestExercise = {
  type: 'suggest_exercise';
  name: string;
  en?: string;
  muscle: string;
  isNew?: boolean;
  isHoldTime?: boolean;
  howTo?: string[];
};

type ActionRenameExercise = {
  type: 'rename_exercise';
  id: string;
  newHe: string;
  newEn?: string;
  muscle?: string;
};

type ActionQuickReplies = {
  type: 'quick_replies';
  options: string[];
};

// Emitted at end of onboarding; carries the profile the AI collected.
// The client uses it to enable the "בנה לי את התוכנית" button + kick off plan generation.
type ActionReadyToBuild = {
  type: 'ready_to_build';
  name?: string;
  level?: 'beginner' | 'intermediate' | 'advanced';
  goal?: 'mass' | 'cut' | 'strength' | 'health';
  daysPerWeek?: 2 | 3 | 4 | 5;
  focus?: string;
  focusMuscles?: string[];
  limitations?: string;
};

// Emitted whenever the AI learns / infers a profile field. The client persists
// the patch to Firestore immediately so state survives reloads and reads.
type ActionUpdateProfile = {
  type: 'update_profile';
  patch: Record<string, unknown>;
};

// Emitted when the AI proposes new weekly per-muscle set targets. Client
// persists via firestore.setWeeklyTargets. Only keys present in `targets`
// are updated — everything else keeps its current value.
type ActionSetWeeklyTargets = {
  type: 'set_weekly_targets';
  targets: Record<string, number>;
};

// A meal the coach surfaced mid-conversation. Rendered as an editable card
// inline in the chat — the "smart object" — without interrupting the talking.
type ActionSuggestMeal = {
  type: 'suggest_meal';
  mealId?: string | null;
  he: string;
  mealType?: MealType;
  calories: number;
  ingredients?: MealIngredient[];
  macros?: MealMacros;
  flags?: MealFlags;
  note?: string;
};

type ChatAction = ActionSuggestExercise | ActionRenameExercise | ActionQuickReplies | ActionReadyToBuild | ActionUpdateProfile | ActionSetWeeklyTargets | ActionSuggestMeal;

// Parse the response into a sequence of text chunks and action blocks so that
// action cards render inline where the model placed them, not clumped at the end.
type Chunk = { type: 'text'; text: string } | { type: 'action'; action: ChatAction };
function parseChunks(text: string): Chunk[] {
  const out: Chunk[] = [];
  const re = /```action\s*\n?([\s\S]*?)\n?```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(last, m.index).trim();
    if (before) out.push({ type: 'text', text: before });
    try {
      const parsed = JSON.parse(m[1]);
      if (parsed?.type === 'suggest_exercise' && parsed.name) {
        out.push({ type: 'action', action: parsed });
      } else if (parsed?.type === 'rename_exercise' && parsed.id && parsed.newHe) {
        out.push({ type: 'action', action: parsed });
      } else if (parsed?.type === 'quick_replies' && Array.isArray(parsed.options)) {
        out.push({ type: 'action', action: parsed });
      } else if (parsed?.type === 'ready_to_build') {
        out.push({ type: 'action', action: parsed });
      } else if (parsed?.type === 'update_profile' && parsed.patch && typeof parsed.patch === 'object') {
        out.push({ type: 'action', action: parsed });
      } else if (parsed?.type === 'set_weekly_targets' && parsed.targets && typeof parsed.targets === 'object') {
        out.push({ type: 'action', action: parsed });
      } else if (parsed?.type === 'suggest_meal' && parsed.he) {
        out.push({ type: 'action', action: parsed });
      }
    } catch { /* ignore malformed */ }
    last = m.index + m[0].length;
  }
  let tail = text.slice(last).trim();
  // If the model got cut mid-action-block, `tail` contains an unclosed ```action fragment
  // followed by broken JSON like `{"type":"suggest_exercise","na`. Strip anything from the
  // last ```action onward so the user doesn't see raw JSON scraps — the truncation warning
  // chip carries the "response was cut" signal instead.
  const lastOpen = tail.lastIndexOf('```action');
  if (lastOpen >= 0 && !tail.slice(lastOpen).includes('```', 9)) {
    tail = tail.slice(0, lastOpen).trim();
  }
  if (tail) out.push({ type: 'text', text: tail });
  return out.length > 0 ? out : [{ type: 'text', text: text.trim() }];
}

// True when the buffer ends inside an unclosed ```action fence — a card is
// mid-flight. parseChunks already hides the partial JSON; this drives the
// "מכין הצעה…" placeholder so a streaming reply doesn't look like it stalled.
function hasOpenAction(text: string): boolean {
  const lastOpen = text.lastIndexOf('```action');
  if (lastOpen < 0) return false;
  return !text.slice(lastOpen + '```action'.length).includes('```');
}

// Read the server's SSE stream, handing every text delta to `onDelta`.
// Resolves with the full text once the `done` event lands. Throws on `error`.
//
// Why raw fetch + a reader rather than EventSource: EventSource is GET-only and
// we need to POST a multi-KB body (history, exercise DB, optional image).
async function streamChat(
  url: string,
  body: unknown,
  onDelta: (chunk: string) => void,
): Promise<{ text: string; truncated: boolean }> {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({} as any));
    throw new Error(errBody.error || `HTTP ${resp.status}`);
  }
  if (!resp.body) throw new Error('no stream body');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let truncated = false;

  // SSE frames are separated by a blank line. Anything after the last blank
  // line is a partial frame — keep it in `buffer` for the next chunk.
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() || '';
    for (const frame of frames) {
      const evLine = frame.split('\n').find(l => l.startsWith('event: '));
      const dataLine = frame.split('\n').find(l => l.startsWith('data: '));
      if (!evLine || !dataLine) continue;
      const event = evLine.slice(7).trim();
      let payload: any;
      try { payload = JSON.parse(dataLine.slice(6)); } catch { continue; }
      if (event === 'delta' && typeof payload.t === 'string') {
        text += payload.t;
        onDelta(payload.t);
      } else if (event === 'done') {
        truncated = !!payload.truncated;
      } else if (event === 'error') {
        throw new Error(payload.message || 'stream error');
      }
    }
  }
  return { text, truncated };
}

// ─── The meal card ─────────────────────────────────────────────────
//
// A meal the coach mentioned, rendered inline in the conversation as something
// you can act on. It does not interrupt the chat and it does not become a form:
// the talking continues above and below it. Its own component so each card can
// hold the meal-type choice you make on it.

const MEAL_SLOTS: { id: MealType; he: string; emoji: string }[] = [
  { id: 'breakfast', he: 'בוקר', emoji: '🌅' },
  { id: 'lunch', he: 'צהריים', emoji: '🍽' },
  { id: 'dinner', he: 'ערב', emoji: '🌙' },
  { id: 'snack', he: 'נשנוש', emoji: '🥨' },
  { id: 'drink', he: 'שתייה', emoji: '☕' },
];

function MealActionCard({
  action, applied, onAdd, onEdit,
}: {
  action: ActionSuggestMeal;
  applied: boolean;
  onAdd: (draft: MealDraft) => void | Promise<void>;
  onEdit?: (draft: MealDraft) => void;
}) {
  const [slot, setSlot] = useState<MealType>(action.mealType || 'snack');
  const [busy, setBusy] = useState(false);

  const draft: MealDraft = {
    mealId: action.mealId ?? null,
    he: action.he,
    mealType: slot,
    calories: Math.max(0, Math.round(action.calories || 0)),
    ingredients: action.ingredients,
    macros: action.macros,
    flags: action.flags,
  };

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        applied
          ? 'border-emerald-500/40 dark:bg-emerald-950/20 bg-emerald-50/60'
          : 'border-amber-500/40 dark:bg-amber-950/20 bg-amber-50/70'
      }`}
      dir="rtl"
    >
      <div className="px-3 pt-2.5 pb-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-bold text-[14px]">
            {applied && <span className="text-emerald-600 dark:text-emerald-400 me-1">✓</span>}
            {action.he}
          </span>
          <span className="font-mono font-bold text-[14px] shrink-0" dir="ltr">{draft.calories}</span>
        </div>
        {action.note && <div className="text-[11px] text-muted mt-0.5">{action.note}</div>}

        {/* Ingredient breakdown — what justifies the number */}
        {action.ingredients && action.ingredients.length > 0 && (
          <div className="mt-2 space-y-0.5">
            {action.ingredients.slice(0, 8).map((ing, k) => (
              <div key={k} className="flex items-baseline justify-between text-[11px] text-muted">
                <span className="truncate">{ing.he}</span>
                <span className="font-mono shrink-0" dir="ltr">{ing.calories}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-1.5">
          {action.flags?.highSugar && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-500">🍬 עתיר סוכר</span>}
          {action.flags?.emptyCarbs && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-500">🍞 פחמימות ריקות</span>}
        </div>
      </div>

      {/* Added is a settled fact, not a button. It is persisted, so it still
          reads "added" after you close and reopen the conversation. */}
      {!applied ? (
        <>
          {/* Which slot this counts as — on the card, per turn. */}
          <div className="px-3 pb-2 flex flex-wrap gap-1">
            {MEAL_SLOTS.map(sl => (
              <button
                key={sl.id}
                onClick={() => setSlot(sl.id)}
                className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                  slot === sl.id
                    ? 'bg-amber-500 text-white'
                    : 'dark:bg-slate-800 bg-white text-muted'
                }`}
              >{sl.emoji} {sl.he}</button>
            ))}
          </div>
          <div className="flex border-t border-amber-500/30">
            <button
              onClick={async () => { if (busy) return; setBusy(true); try { await onAdd(draft); } finally { setBusy(false); } }}
              disabled={busy}
              className="flex-1 py-2.5 text-[12px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
            >{busy ? 'מוסיף…' : '+ הוסף להיום'}</button>
            {onEdit && (
              <button
                onClick={() => onEdit(draft)}
                className="px-4 py-2.5 text-[12px] font-semibold text-muted border-r border-amber-500/30 hover:bg-amber-500/10"
              >ערוך</button>
            )}
          </div>
        </>
      ) : (
        <div className="px-3 pb-2.5 pt-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
          נוסף ליומן היום
        </div>
      )}
    </div>
  );
}

type Thread = { id: string; title: string; ts: number; updatedAt?: number };

// UNIFIED coach history: onboarding, trainer, AND in-session AI chats all share
// the same "coach" bucket. Naming mode stays separate (different task).
// Mode only changes the SYSTEM PROMPT sent to the server per turn, not the
// thread archive — one continuous conversation the user can revisit from any
// entry point.
function bucketOf(mode: string): ChatBucket {
  if (mode === 'naming') return 'naming';
  // The food coach keeps its own history — the trainer never sees a meal chat
  // and vice versa.
  if (mode === 'dietary') return 'dietary';
  return 'coach';
}

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }
function fmtHour(ts: number): string {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Build a short title from the first user message: first ~4 words + " · HH:mm"
function computeThreadTitle(messages: Msg[], fallbackTs: number): string {
  const firstUser = messages.find(m => m.role === 'user');
  const hourLabel = fmtHour(firstUser?.ts ?? fallbackTs);
  if (!firstUser) return `שיחה · ${hourLabel}`;
  const words = firstUser.content.trim().split(/\s+/).slice(0, 4).join(' ');
  const trimmed = words.length > 28 ? words.slice(0, 28).trim() + '…' : words;
  return `${trimmed} · ${hourLabel}`;
}

// One-shot migration from the old localStorage keys → Firestore.
// Runs once per (uid, bucket) — subsequent mounts are a no-op.
async function migrateLocalStorageToFirestore(
  uid: string,
  bucket: ChatBucket,
  firestore: { upsertChatThread: (id: string, meta: any) => Promise<void>; addChatMessage: (threadId: string, msg: any) => Promise<string> },
): Promise<void> {
  // The food coach postdates localStorage chat storage — nothing to migrate.
  if (bucket === 'dietary') return;
  const migKey = `aichat:migrated-fs:${uid}:${bucket}`;
  if (localStorage.getItem(migKey) === '1') return;
  const legacyKeys = bucket === 'coach'
    ? [
        `aichat:threads:${uid}:coach`,
        `aichat:threads:${uid}:onboarding`,
        `aichat:threads:${uid}:trainer`,
        `aichat:threads:${uid}:session`,
      ]
    : [`aichat:threads:${uid}:naming`];
  const seen = new Set<string>();
  for (const key of legacyKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) continue;
      for (const t of arr) {
        if (!t?.id || seen.has(t.id)) continue;
        seen.add(t.id);
        const ts = Number(t.ts) || Date.now();
        const msgs: any[] = Array.isArray(t.messages) ? t.messages : [];
        const updatedAt = msgs.length > 0 ? (Number(msgs[msgs.length - 1]?.ts) || ts) : ts;
        await firestore.upsertChatThread(t.id, {
          id: t.id,
          title: String(t.title || `שיחה · ${fmtHour(ts)}`),
          ts, updatedAt, bucket,
        });
        for (const m of msgs) {
          const mts = Number(m?.ts);
          if (!m?.role || !m?.content || !Number.isFinite(mts)) continue;
          await firestore.addChatMessage(t.id, {
            role: m.role, content: String(m.content), ts: mts, truncated: !!m.truncated,
          });
        }
      }
      localStorage.removeItem(key);
    } catch { /* ignore, best effort */ }
  }
  try { localStorage.setItem(migKey, '1'); } catch { /* quota */ }
}

export function AiChatPanel({
  uid, mode = 'session', sessionMuscles = [], recentSets = [], onAddSet, onAddToDb, onRename, initialPrompt, initialAssistantMessage, replaceContext, newThreadOnMount, currentSessionExercises = [], currentSessionStatus, currentSessionPlannedFor, currentSessionAerobicSummary, plannedSessions = [], personalMeals = [], todayMeals = [], dietProfile, todayBurn, onAddMeal, onEditMeal, suggestionChips = [], onReadyToBuild, onProfilePatch, earlySkipCta, fixedThreadId, onClose,
}: Props) {
  const bucket = bucketOf(mode);
  const firestore = useFirestore(uid);
  // firestore is a fresh object per render but its methods are memoized on uid.
  // Depending on `firestore` directly in effects would re-subscribe every render
  // (same bug we hit for status: 'checking'). Use a ref so effects fire only
  // when their real deps change.
  const firestoreRef = useRef(firestore);
  firestoreRef.current = firestore;

  const [personalExercises, setPersonalExercises] = useState<PersonalExercise[]>([]);
  // Local snapshot of the user profile — refetched on mount + after each update_profile
  // action so the SERVER prompt always sees fresh state on the next turn.
  const [userProfile, setUserProfile] = useState<UserProfile>({});
  // Current weekly per-muscle targets — sent to the trainer so it can propose
  // sensible changes, and re-loaded after set_weekly_targets so we keep in sync.
  const [weeklyTargets, setWeeklyTargets] = useState<Record<string, number>>({});
  // Threads + messages come from Firestore realtime listeners — source of truth
  // is the DB, not the component. That's what lets a server-side write show up
  // even when the client tab closed mid-request.
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoaded, setThreadsLoaded] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string>('');
  const [input, setInput] = useState('');
  // Attached image (base64 data URL) waiting to be sent with the next message.
  // The user picks it via the paperclip button; preview renders above the input.
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [appliedActionIds, setAppliedActionIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [threadsMenuOpen, setThreadsMenuOpen] = useState(false);
  const autoSentRef = useRef(false);

  // ─── Streaming reply state ────────────────────────────────────
  // `streamingText` is the live, not-yet-persisted assistant reply. It renders
  // as a normal bubble while it grows, then clears when the Firestore listener
  // delivers the persisted message — so the answer never appears twice.
  // Deltas land per-token; batching them behind a ~60ms timer keeps React from
  // re-rendering the whole thread on every character.
  const [streamingText, setStreamingText] = useState('');
  const streamBufRef = useRef('');
  const streamTimerRef = useRef<number | null>(null);

  function pushDelta(chunk: string) {
    streamBufRef.current += chunk;
    if (streamTimerRef.current != null) return;
    streamTimerRef.current = window.setTimeout(() => {
      streamTimerRef.current = null;
      setStreamingText(streamBufRef.current);
    }, 60);
  }

  // Everything before the first action fence — i.e. the prose the user should
  // see. Any partial or complete ```action block stays hidden until the message
  // is final.
  const visibleStreamText = useMemo(() => {
    const cut = streamingText.indexOf('```');
    return (cut >= 0 ? streamingText.slice(0, cut) : streamingText).trimEnd();
  }, [streamingText]);

  function resetStream() {
    if (streamTimerRef.current != null) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    streamBufRef.current = '';
    setStreamingText('');
  }

  // Drop the pending timer if the panel unmounts mid-stream.
  useEffect(() => () => {
    if (streamTimerRef.current != null) clearTimeout(streamTimerRef.current);
  }, []);

  // ─── Migration: one-shot copy of legacy localStorage threads → Firestore ───
  useEffect(() => {
    if (!uid) return;
    void migrateLocalStorageToFirestore(uid, bucket, {
      upsertChatThread: (id, meta) => firestoreRef.current.upsertChatThread(id, meta),
      addChatMessage: (threadId, msg) => firestoreRef.current.addChatMessage(threadId, msg),
    });
  }, [uid, bucket]);

  // ─── Subscribe to threads (for the current bucket) ───
  useEffect(() => {
    if (!uid) return;
    const unsub = firestoreRef.current.subscribeToChatThreads(bucket, list => {
      setThreads(list.map(t => ({ id: t.id, title: t.title, ts: t.ts, updatedAt: t.updatedAt })));
      setThreadsLoaded(true);
    });
    return unsub;
  }, [uid, bucket]);

  // Only surface today's threads in the UI — older conversations still exist in
  // Firestore (nothing is deleted) but the history menu resets each morning so
  // it doesn't grow unbounded.
  const startOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [threadsLoaded]);
  const todayThreads = useMemo(
    // Defensive: fall back to updatedAt if ts is missing. Threads written by
    // the server prior to the updateMask fix may have lost their `ts` field,
    // and we still want them to surface today so no history goes dark.
    () => threads.filter(t => Math.max(t.ts || 0, t.updatedAt || 0) >= startOfToday),
    [threads, startOfToday],
  );

  // ─── Pick / create the active thread once threads have loaded ───
  //   The thread DOC is created lazily — on the first user message (sendWith)
  //   or on the greeting seed (initialAssistantMessage effect). Creating an
  //   empty doc on mount used to leave "ghost" threads that filled the newest
  //   slot in todayThreads, so a later open landed on a blank thread and the
  //   real history looked like it had disappeared.
  useEffect(() => {
    if (!threadsLoaded || activeId) return;
    if (fixedThreadId) {
      setActiveId(fixedThreadId);
      return;
    }
    if (newThreadOnMount || todayThreads.length === 0) {
      setActiveId(`t_${Date.now()}`);
      return;
    }
    setActiveId(todayThreads[0].id);
  }, [threadsLoaded, activeId, fixedThreadId, newThreadOnMount, todayThreads, bucket]);

  // fixedThreadId (onboarding) intentionally does NOT eager-create the doc —
  // the greeting-seed effect and/or the first send will create it with real
  // metadata (title, ts, bucket) so it shows up correctly in history.

  // Applied cards are persisted per thread — reopening the chat must not offer
  // to add something you already added.
  useEffect(() => {
    if (!uid || !activeId) return;
    let cancelled = false;
    firestoreRef.current.getAppliedActions(activeId)
      .then(set => { if (!cancelled) setAppliedActionIds(set); })
      .catch(() => { /* first run */ });
    return () => { cancelled = true; };
  }, [uid, activeId]);

  // ─── Subscribe to the active thread's messages ───
  useEffect(() => {
    if (!activeId) { setMessages([]); setMessagesLoaded(false); return; }
    setMessagesLoaded(false);
    const unsub = firestoreRef.current.subscribeToChatMessages(activeId, list => {
      setMessages(list.map(m => ({
        role: m.role, content: m.content, ts: m.ts, truncated: !!m.truncated, image: m.image,
      })));
      setMessagesLoaded(true);
    });
    return unsub;
  }, [activeId]);

  useEffect(() => {
    firestore.listPersonalExercises().then(setPersonalExercises);
    // Only trainer + onboarding modes actually use the profile — cheap to load anyway
    // and lets action-driven updates always start from fresh state.
    if (mode === 'onboarding' || mode === 'trainer') {
      firestore.getUserProfile().then(setUserProfile).catch(() => setUserProfile({}));
    }
  }, [uid, mode]);

  // Live subscribe to weekly targets in trainer mode. Two payoffs:
  //   1. Server prompt on next turn always sees the freshest goals.
  //   2. When the user approves a set_weekly_targets action, home/settings
  //      screens pick up the change through the same listener without reload.
  useEffect(() => {
    if (mode !== 'trainer' || !uid) return;
    const unsub = firestoreRef.current.subscribeToWeeklyTargets(t => setWeeklyTargets(t || {}));
    return unsub;
  }, [uid, mode]);

  // initialPrompt → populate the input as a DRAFT so the user can eyeball it
  // (or edit) before sending. Auto-send felt like the AI was speaking for the
  // user, and it burned a request every time the panel opened even if they
  // just wanted to browse.
  useEffect(() => {
    if (!initialPrompt || autoSentRef.current || !activeId) return;
    autoSentRef.current = true;
    const p = initialPrompt.trim();
    if (!p) return;
    setInput(p);
  }, [activeId, initialPrompt]);

  // initialAssistantMessage is LOCAL-ONLY — it renders as a greeting bubble
  // but doesn't create a Firestore thread on open. Only when the user sends
  // their first reply do we persist BOTH the greeting and the reply. Opening
  // the panel and closing without replying leaves nothing behind (no ghost
  // empty conv in history).

  function startNewConversation() {
    // Lazy — the thread doc is written by sendWith on the first user message.
    // Nothing is created in Firestore until there's actual content.
    setActiveId(`t_${Date.now()}`);
    setAppliedActionIds(new Set());
    setError(null);
    setInput('');
    setThreadsMenuOpen(false);
  }

  function switchToThread(id: string) {
    setActiveId(id);
    setAppliedActionIds(new Set());
    setError(null);
    setThreadsMenuOpen(false);
  }

  async function deleteThread(id: string) {
    await firestoreRef.current.deleteChatThread(id);
    if (id !== activeId) return;
    // History surfaces today's threads only — pick a same-day successor if one
    // exists; otherwise open a fresh conversation rather than jumping back to
    // yesterday's chat. Fresh conversations are lazy (no doc until first send).
    const remaining = todayThreads.filter(t => t.id !== id);
    setActiveId(remaining.length > 0 ? remaining[0].id : `t_${Date.now()}`);
  }

  function showToast(text: string) {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  }

  // Follow the conversation down as messages land AND as the live reply grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, streamingText]);

  // Compute lastUsedDays per exercise from recentSets (best effort in short list)
  const lastUsedDaysByEx = useMemo(() => {
    const m = new Map<string, number>();
    const now = Date.now();
    for (const s of recentSets) {
      if (!s.exerciseName) continue;
      const key = s.exerciseName.trim().toLowerCase();
      const days = Math.floor((now - s.timestamp) / 86_400_000);
      const prev = m.get(key);
      if (prev === undefined || days < prev) m.set(key, days);
    }
    return m;
  }, [recentSets]);

  async function send() {
    const text = input.trim();
    // An image alone is a valid message ("what's this exercise?" with just a photo).
    if ((!text && !pendingImage) || loading) return;
    const img = pendingImage;
    setInput('');
    setPendingImage(null);
    await sendWith(text, img || undefined);
  }

  // Attach an image from file/camera. Compressed client-side so the message
  // doc stays well under the Firestore 1MB per-doc ceiling.
  async function attachImage(file: File) {
    setAttaching(true);
    try {
      const dataUrl = await compressImage(file, 1024, 0.75);
      setPendingImage(dataUrl);
    } catch (e) {
      console.warn('image attach failed', e);
      showToast('שגיאה בטעינת התמונה');
    } finally {
      setAttaching(false);
    }
  }

  async function sendWith(text: string, image?: string) {
    if ((!text && !image) || loading || !activeId) return;
    const now = Date.now();
    const userMsg: Msg = { role: 'user' as const, content: text, ts: now, image };
    const nextMessages: Msg[] = [...messages, userMsg];

    // 1) On the FIRST user message ever in this thread, if the panel opened
    //    with a local-only greeting bubble (initialAssistantMessage), persist
    //    it now so history reflects what the user actually saw.
    // 2) Persist the user message. The realtime listener will echo both back
    //    into local state within a tick.
    // 3) Bump the thread title on the first user message so the sidebar
    //    reflects what the conversation is actually about.
    try {
      const isFirstMessage = messages.length === 0;
      if (isFirstMessage && initialAssistantMessage) {
        await firestoreRef.current.addChatMessage(activeId, {
          role: 'assistant', content: initialAssistantMessage, ts: now - 1,
        });
      }
      await firestoreRef.current.addChatMessage(activeId, {
        role: 'user', content: text, ts: now, image,
      });
      const activeMeta = threads.find(t => t.id === activeId);
      const isFirstUserMsg = !messages.some(m => m.role === 'user');
      await firestoreRef.current.upsertChatThread(activeId, {
        id: activeId,
        title: isFirstUserMsg ? computeThreadTitle([userMsg], activeMeta?.ts ?? now) : (activeMeta?.title || `שיחה · ${fmtHour(now)}`),
        ts: activeMeta?.ts ?? now,
        updatedAt: now,
        bucket,
      });
    } catch (e) {
      console.warn('user message persist failed', e);
    }
    setLoading(true);
    setError(null);

    // Personal exercise DB — send EVERYTHING (up to 300). The AI needs the full DB to answer
    // "give me something I haven't done lately" without inventing duplicates.
    // Every entry carries the exact last-used date so the AI can reason about recency
    // per-exercise even without the older sessions in the payload.
    const exPayload = personalExercises.slice(0, 300).map(e => {
      const days = lastUsedDaysByEx.get(e.he.toLowerCase());
      let lastUsed: string | null = null;
      if (days !== undefined) {
        const d = new Date(Date.now() - days * 86_400_000);
        const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        lastUsed = `${days}d · ${ymd}`;
      }
      return {
        id: e.id,
        he: e.he,
        en: e.en,
        defaultMuscle: e.defaultMuscle,
        // Server prints this field as-is — string OR null. Old server that expected a number
        // still works (template literal on a string is a no-op).
        lastUsedDays: lastUsed,
      };
    });
    // Sets: 8-day window (covers same-day-last-week + a day of slack), cap at 200. Newest first.
    // Cutting from 10d/400 down to 8d/200 roughly halves the prompt-size cost of the sets list
    // without losing the "what did I train last <this day>" signal.
    const cutoff = Date.now() - 8 * 86_400_000;
    const DOW_HE_SHORT = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const setsPayload = [...recentSets]
      .filter(s => s.timestamp >= cutoff)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 200)
      .map(s => {
        const d = new Date(s.timestamp);
        const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return {
          exerciseName: s.exerciseName,
          muscle: s.muscle,
          weight: s.weight,
          reps: s.reps,
          unit: s.unit,
          date: `${ymd} (${DOW_HE_SHORT[d.getDay()]})`,
        };
      });

    // Prepend today's date + day-of-week + the current-session state to the FIRST user message
    // before sending. Only affects wire payload — the UI still shows the user's original text.
    // This is how the model learns:
    //   • what day is "today"
    //   • which exercises are already queued for TODAY (planned + already-logged)
    //     so it doesn't propose something you already have.
    const today = new Date();
    const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const contextParts = [`היום ${DOW_HE_SHORT[today.getDay()]} ${todayYmd}`];
    // CRITICAL: tell the AI whether this chat is inside a live workout right now, or inside
    // a PLANNED session for a FUTURE date. Without this the model assumes it's talking about
    // today and gives wrong-day answers ("no plan for tomorrow — only today's session").
    if (currentSessionStatus === 'planned' && currentSessionPlannedFor) {
      const [py, pm, pd] = currentSessionPlannedFor.split('-').map(Number);
      const planDate = new Date(py, (pm || 1) - 1, pd || 1);
      const planDow = DOW_HE_SHORT[planDate.getDay()];
      const isToday = currentSessionPlannedFor === todayYmd;
      const isTomorrow = (planDate.getTime() - new Date(todayYmd + 'T00:00:00').getTime()) / 86_400_000 === 1;
      const relative = isToday ? ' (היום)' : isTomorrow ? ' (מחר)' : '';
      contextParts.push(`השיחה על אימון מתוכנן ליום ${planDow} ${currentSessionPlannedFor}${relative} — לא על היום. הצעות/הוספות נוגעות לתוכנית הזאת`);
    } else if (currentSessionStatus === 'active') {
      contextParts.push(`השיחה בתוך אימון חי (עכשיו)`);
    }
    if (currentSessionExercises.length > 0) {
      const inSession = currentSessionExercises
        .map(e => `${e.name} (${e.muscle}${e.hasSets ? ' · נרשם' : ' · מתוכנן'})`)
        .join('; ');
      const label = currentSessionStatus === 'planned' ? 'תרגילים בתוכנית הנוכחית' : 'תרגילים באימון הנוכחי';
      contextParts.push(`${label}: ${inSession}`);
    } else if (sessionMuscles.length > 0) {
      const label = currentSessionStatus === 'planned' ? 'פוקוס התוכנית' : 'פוקוס האימון';
      contextParts.push(`${label}: ${sessionMuscles.join(', ')}`);
    }
    if (currentSessionAerobicSummary) {
      contextParts.push(`אירובי בסשן: ${currentSessionAerobicSummary}`);
    }
    const todayLine = `[הקשר: ${contextParts.join(' | ')}]`;
    let firstUserSeen = false;
    // Wire messages: forward only the LAST user message's image. Historical
    // images are already persisted in Firestore for the UI, but re-sending
    // them every turn would bloat the payload and re-consume Vision quota
    // on the model side. If the user wants to reference an older image, they
    // re-attach it.
    const lastUserIdx = (() => {
      for (let i = nextMessages.length - 1; i >= 0; i--) {
        if (nextMessages[i].role === 'user') return i;
      }
      return -1;
    })();
    const wireMessages = nextMessages.map((m, i) => {
      const base: { role: string; content: string; image?: string } = { role: m.role, content: m.content };
      if (m.image && i === lastUserIdx) base.image = m.image;
      if (m.role === 'user' && !firstUserSeen) {
        firstUserSeen = true;
        base.content = `${todayLine}\n${m.content}`;
      }
      return base;
    });

    try {
      resetStream();
      const { text } = await streamChat(
        `${CHAT_API_URL.replace(/\/$/, '')}/api/chat`,
        {
          stream: true,
          uid,
          threadId: activeId,
          bucket,
          mode,
          messages: wireMessages,
          personalExercises: exPayload,
          recentSets: setsPayload,
          sessionMuscles,
          replaceContext,  // signals to the server this is a REPLACE flow
          // Only send profile for modes that use it — keeps other modes lean.
          userProfile: (mode === 'onboarding' || mode === 'trainer') ? userProfile : undefined,
          // Trainer mode: summarize upcoming planned sessions so the AI can
          // reference the actual schedule when the user asks about it.
          plannedSessions: mode === 'trainer'
            ? plannedSessions.slice(0, 20).map(s => ({
                plannedFor: s.plannedFor,
                muscleGroups: s.muscleGroups,
                exercises: (s.plannedExercises || []).map(e => ({ name: e.name, muscle: e.muscle })),
              }))
            : undefined,
          // Trainer mode: current per-muscle weekly targets + real weekly volume
          // for the past 4 weeks so the AI can propose sensible goal changes.
          weeklyTargets: mode === 'trainer' ? weeklyTargets : undefined,
          // Dietary mode: the meal library (so "the usual" resolves to an
          // existing entry instead of a duplicate), what's already been eaten
          // today, and the profile that sets the target.
          dietProfile: mode === 'dietary' ? dietProfile : undefined,
          todayBurn: mode === 'dietary' ? todayBurn : undefined,
          todayMeals: mode === 'dietary'
            ? todayMeals.map(m => ({ name: m.name, calories: m.calories }))
            : undefined,
          personalMeals: mode === 'dietary'
            ? personalMeals.slice(0, 200).map(m => ({
                id: m.id,
                he: m.he,
                calories: m.calories,
                // The breakdown travels too: it is what lets the coach say
                // "your usual, minus the pita" instead of re-inventing the dish.
                ingredients: (m.ingredients || []).slice(0, 12),
                lastUsedDays: m.lastUsedAt ? Math.floor((Date.now() - m.lastUsedAt) / 86_400_000) : null,
              }))
            : undefined,
          volumeHistory: mode === 'trainer' ? (() => {
            const startOfWeek = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate() - x.getDay()); return x.getTime(); };
            const now = new Date();
            const wStart = startOfWeek(now);
            const buckets: Record<string, Record<string, number>> = {
              'thisWeek': {},
              'lastWeek': {},
              '2WeeksAgo': {},
              '3WeeksAgo': {},
            };
            for (const s of recentSets) {
              if (!s.timestamp || (s.weight === 0 && s.reps === 0)) continue;
              const offsetWeeks = Math.floor((wStart - startOfWeek(new Date(s.timestamp))) / (7 * 86_400_000));
              const key = offsetWeeks === 0 ? 'thisWeek'
                : offsetWeeks === 1 ? 'lastWeek'
                : offsetWeeks === 2 ? '2WeeksAgo'
                : offsetWeeks === 3 ? '3WeeksAgo'
                : null;
              if (!key) continue;
              buckets[key][s.muscle] = (buckets[key][s.muscle] || 0) + 1;
            }
            return buckets;
          })() : undefined,
        },
        pushDelta,
      );
      // Server persisted the assistant message to Firestore — the messages
      // listener will push it into local state on the next tick, so we DON'T
      // append it here. That's the whole point of the new architecture: if the
      // tab closed before this line ran, the server still wrote the message
      // and it appears next time the user opens the chat.
      // (Silence unused warnings for the variables the old code used.)
      void nextMessages;

      // Auto-persist update_profile ONLY. Profile fields are lightweight
      // ("beginner", "3 days/week") and the user has already answered a
      // question when they surface, so silent persistence matches expectation.
      //
      // set_weekly_targets is DIFFERENT — it changes real numbers the user
      // stares at every day. Nothing gets written until the user taps the
      // approve button on the card. See handleApproveTargets below.
      if (mode === 'onboarding' || mode === 'trainer') {
        const chunks = parseChunks(text);
        const patches: Record<string, unknown> = {};
        for (const ch of chunks) {
          if (ch.type === 'action' && ch.action.type === 'update_profile') {
            Object.assign(patches, ch.action.patch);
          }
        }
        if (Object.keys(patches).length > 0) {
          try {
            const merged = await firestore.updateUserProfile(patches);
            setUserProfile(merged);
            if (onProfilePatch) onProfilePatch(patches);
          } catch (err) {
            console.warn('update_profile persist failed', err);
          }
        }
      }
    } catch (e: any) {
      setError(e?.message || String(e));
      // Any partial text the server managed to persist comes back through the
      // messages listener — drop the local bubble so it can't double-render.
      resetStream();
    } finally {
      setLoading(false);
    }
  }

  // The persisted assistant message has landed via the Firestore listener —
  // retire the local streaming bubble so the answer isn't shown twice.
  useEffect(() => {
    if (!streamingText) return;
    const last = messages[messages.length - 1];
    if (last && last.role === 'assistant') resetStream();
  }, [messages, streamingText]);

  // Keyed by message TIMESTAMP, not render index: the key has to survive a
  // reload, because it is now persisted.
  function actionKey(a: ChatAction, mi: number, ci: number): string {
    if (a.type === 'suggest_exercise') return `s:${mi}:${ci}:${a.name}`;
    if (a.type === 'rename_exercise') return `r:${mi}:${ci}:${a.id}`;
    if (a.type === 'quick_replies') return `q:${mi}:${ci}`;
    if (a.type === 'update_profile') return `u:${mi}:${ci}`;
    if (a.type === 'set_weekly_targets') return `w:${mi}:${ci}`;
    if (a.type === 'suggest_meal') return `m:${mi}:${ci}:${a.he}`;
    return `b:${mi}:${ci}`; // ready_to_build
  }

  async function handleApproveTargets(a: ActionSetWeeklyTargets, key: string) {
    // Clean, clamp, and normalize the AI's suggested numbers before writing.
    // Partial patches merge on top of current so muscles the AI didn't touch
    // keep their existing goal.
    const patches: Record<string, number> = {};
    for (const [k, v] of Object.entries(a.targets)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) patches[k] = Math.round(n);
    }
    if (Object.keys(patches).length === 0) return;
    try {
      const merged = { ...weeklyTargets, ...patches };
      await firestoreRef.current.setWeeklyTargets(merged as any);
      // Local state will refresh on its own via the subscribeToWeeklyTargets
      // listener, but set it here too so the card flips to "אושר" without
      // waiting for the round-trip.
      setWeeklyTargets(merged);
      setAppliedActionIds(prev => new Set(prev).add(key));
      showToast('✓ יעדים עודכנו');
    } catch (err) {
      console.warn('approve targets failed', err);
      showToast('שגיאה בעדכון יעדים');
    }
  }

  async function handleSuggestAction(a: ActionSuggestExercise, key: string) {
    if (!onAddSet && !onAddToDb) return;
    const muscle = ACTIVE_MUSCLES.find(m => m.id === a.muscle)?.id
      || (MUSCLE_BY_ID as any)[a.muscle]?.id;
    if (!muscle) return;
    // Resolve to existing personal exercise if one matches (avoid duplicates).
    const existing = personalExercises.find(e =>
      e.he === a.name ||
      e.he.toLowerCase() === a.name.toLowerCase() ||
      (e.aliases || []).some(al => al.toLowerCase() === a.name.toLowerCase())
    );
    const finalName = existing ? existing.he : a.name;
    const finalEn = existing?.en || a.en;
    if (onAddToDb && !onAddSet) {
      await onAddToDb({ muscle, exerciseName: finalName, en: finalEn, isHoldTime: a.isHoldTime });
      setAppliedActionIds(prev => new Set(prev).add(key));
      showToast(existing ? `✓ ${finalName} כבר קיים ב-DB` : `✓ ${finalName} נוסף לרשימה`);
      return;
    }
    if (onAddSet) {
      await onAddSet({ muscle, exerciseName: finalName, en: finalEn, isHoldTime: a.isHoldTime });
      setAppliedActionIds(prev => new Set(prev).add(key));
      showToast(replaceContext ? `⇄ הוחלף ל-${finalName}` : `✓ ${finalName} נוסף לאימון`);
    }
  }

  async function handleRenameAction(a: ActionRenameExercise, key: string) {
    const muscle = a.muscle
      ? (ACTIVE_MUSCLES.find(m => m.id === a.muscle)?.id || (MUSCLE_BY_ID as any)[a.muscle]?.id)
      : undefined;
    if (onRename) {
      await onRename(a.id, { he: a.newHe, en: a.newEn, muscle: muscle as MuscleGroup | undefined });
    } else {
      // Default: upsert directly through firestore
      const existing = personalExercises.find(e => e.id === a.id);
      if (existing) {
        await firestore.upsertPersonalExercise({
          ...existing,
          he: a.newHe.trim(),
          en: a.newEn?.trim() || existing.en,
          defaultMuscle: (muscle as MuscleGroup) || existing.defaultMuscle,
          aliases: Array.from(new Set([...(existing.aliases || []), existing.he].filter(Boolean))),
        });
        // Refresh local list so subsequent messages see the update
        setPersonalExercises(prev => prev.map(e => e.id === a.id ? {
          ...e,
          he: a.newHe.trim(),
          en: a.newEn?.trim() || e.en,
          defaultMuscle: (muscle as MuscleGroup) || e.defaultMuscle,
        } : e));
      }
    }
    setAppliedActionIds(prev => new Set(prev).add(key));
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overlay-solid overscroll-contain" style={{ height: '100dvh' }}>
      <div className="shrink-0 flex items-center justify-between p-3 border-b border-subtle dark:bg-slate-950 bg-white" dir="rtl">
        {/* Right (RTL start): title */}
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-500/10 dark:bg-emerald-400/10">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="text-emerald-600 dark:text-emerald-400" aria-hidden="true">
              <path d="M12 2.5c.3 0 .55.2.63.48l1.28 4.53a3 3 0 0 0 2.07 2.07l4.54 1.28a.66.66 0 0 1 0 1.27l-4.54 1.28a3 3 0 0 0-2.07 2.07l-1.28 4.54a.66.66 0 0 1-1.27 0l-1.28-4.54a3 3 0 0 0-2.07-2.07L3.47 12.13a.66.66 0 0 1 0-1.27l4.54-1.28A3 3 0 0 0 10.09 7.5l1.28-4.53c.08-.28.33-.47.63-.47Z"/>
            </svg>
          </span>
          <div className="text-right">
            <h2 className="font-bold text-base leading-tight">
              {mode === 'naming' ? 'מאמן שמות' : mode === 'dietary' ? 'מאמן תזונה' : 'מאמן AI'}
            </h2>
            {replaceContext && (
              <div className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight">
                מחליף את "{replaceContext.name}"
              </div>
            )}
          </div>
        </div>
        {/* Left (RTL end): actions */}
        <div className="flex items-center gap-2">
          {todayThreads.length > 0 && (
            <button
              onClick={() => setThreadsMenuOpen(v => !v)}
              aria-label="שיחות"
              className="w-10 h-10 rounded-full flex items-center justify-center text-muted dark:hover:bg-slate-800 hover:bg-slate-100 transition-colors relative"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="absolute -top-0.5 -right-0.5 bg-emerald-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center">
                {todayThreads.length}
              </span>
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={startNewConversation}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold
                         px-3 py-2 rounded-full
                         dark:bg-slate-800 bg-slate-100
                         dark:text-slate-200 text-slate-700
                         dark:hover:bg-slate-700 hover:bg-slate-200
                         transition-colors"
              style={{ WebkitTapHighlightColor: 'transparent' }}
              aria-label="שיחה חדשה"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20v-8m0 0V4m0 8H4m8 0h8" />
              </svg>
              <span>חדש</span>
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="סגור"
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted dark:hover:bg-slate-800 hover:bg-slate-100 transition-colors"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>
      </div>

      {toast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 bg-emerald-600 text-white text-sm px-4 py-2 rounded-full shadow-lg" dir="rtl">
          {toast}
        </div>
      )}

      {threadsMenuOpen && (
        <div className="absolute inset-x-0 top-[64px] z-20 mx-3">
          <div className="card !p-2 shadow-lg dark:!bg-slate-900 !bg-white" dir="rtl">
            <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-subtle">
              <span className="text-[10px] uppercase tracking-wider text-muted">שיחות היום</span>
              <button
                onClick={() => setThreadsMenuOpen(false)}
                className="text-[11px] text-muted hover:text-main"
              >סגור</button>
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {todayThreads.map(t => {
                const isActive = t.id === activeId;
                // Prefer the thread's start ts; fall back to updatedAt for
                // legacy threads whose metadata got clobbered by an older
                // server write (fixed since — see fsPatch merge flag).
                const anchorTs = t.ts || t.updatedAt || Date.now();
                const ageLabel = fmtHour(anchorTs);
                const title = t.title || `שיחה · ${fmtHour(anchorTs)}`;
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-2 rounded-lg px-2 py-2 ${
                      isActive ? 'dark:bg-emerald-950/40 bg-emerald-50 border border-emerald-500/30' : 'hover:bg-slate-500/5'
                    }`}
                  >
                    <button
                      onClick={() => switchToThread(t.id)}
                      className="flex-1 text-right min-w-0"
                    >
                      <div className="text-sm font-medium truncate">{title}</div>
                      <div className="text-[10px] text-muted mt-0.5">{ageLabel}</div>
                    </button>
                    <button
                      onClick={() => deleteThread(t.id)}
                      aria-label="מחק שיחה"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500/10 shrink-0"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
                      </svg>
                    </button>
                  </div>
                );
              })}
              {todayThreads.length === 0 && (
                <div className="text-center text-xs text-muted-most py-6">אין שיחות היום</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-xs text-muted-most" dir="rtl">
            {mode === 'naming' ? (
              <>
                <div className="mb-2">שאל על שמות של תרגילים, בקש שינוי שם, או בקש רוויזיה כללית:</div>
                <div className="space-y-1 text-[11px]">
                  <div>"תסקור את כל השמות ותציע שיפורים"</div>
                  <div>"תן שם טוב יותר ל"תרגיל X""</div>
                  <div>"אילו שמות חסרים לי אנגלית?"</div>
                  <div>"האם יש שמות כפולים או דומים מדי?"</div>
                </div>
              </>
            ) : mode === 'trainer' ? (
              <>
                <div className="mb-2">שאל את המאמן כל שאלה על אימונים, טכניקה, תזונה או תוכניות:</div>
                <div className="space-y-1 text-[11px]">
                  <div>"מה עדיף למסת חזה, לחיצה במכונה או משקולות?"</div>
                  <div>"כמה סטים לשבוע לכל שריר?"</div>
                  <div>"אני חסום בסקוואט — מה לעשות?"</div>
                  <div>"תן לי תוכנית ל-3 ימים לפוקוס גב וכתפיים"</div>
                </div>
              </>
            ) : mode === 'dietary' ? (
              <>
                <div className="mb-2">ספר מה אכלת, או שאל כל שאלה על תזונה:</div>
                <div className="space-y-1 text-[11px]">
                  <div>"אכלתי שקשוקה עם 2 פיתות וקפה הפוך"</div>
                  <div>"מה נשאר לי היום עד היעד?"</div>
                  <div>"בא לי משהו מתוק — מה הכי פחות יעלה לי?"</div>
                  <div>"תכין לי ארוחת ערב של 400 קלוריות"</div>
                </div>
              </>
            ) : mode === 'onboarding' ? (
              <div className="mb-2">כותב...</div>
            ) : (
              <>
                <div className="mb-2">תאר את התרגיל שעשית או בקש הצעה. דוגמאות:</div>
                <div className="space-y-1 text-[11px]">
                  <div>"עשיתי לחיצת כתפיים במכונה עם משקולת ליד"</div>
                  <div>"תן לי משהו לחזה עליון שלא עשיתי החודש"</div>
                  <div>"מה עשיתי בפעם הקודמת לגב?"</div>
                </div>
              </>
            )}
          </div>
        )}

        {(() => {
          // Prepend a LOCAL-only greeting bubble when the thread is empty and
          // the caller supplied one (naming AI, replace-context prompts, etc.).
          // The bubble looks identical to a real message but isn't in Firestore,
          // so closing without replying leaves no ghost thread behind.
          const showLocalGreeting = messagesLoaded && messages.length === 0 && !!initialAssistantMessage;
          const displayMessages: Msg[] = showLocalGreeting
            ? [{ role: 'assistant', content: initialAssistantMessage!, ts: Date.now() } as Msg, ...messages]
            : messages;
          return displayMessages;
        })().map((m, i) => {
          const chunks = m.role === 'assistant' ? parseChunks(m.content) : [{ type: 'text' as const, text: m.content }];
          const showTruncated = m.role === 'assistant' && m.truncated;
          return (
            <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-start' : 'items-end'}`}>
            <div className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm space-y-2 ${
                  m.role === 'user'
                    ? 'dark:bg-blue-900/50 bg-blue-100 text-blue-800 dark:text-blue-100 rounded-tl-sm'
                    : 'dark:bg-slate-800 bg-slate-100 rounded-tr-sm'
                }`}
                dir="rtl"
              >
                {m.image && (
                  <img
                    src={m.image}
                    alt=""
                    className="block rounded-lg max-w-full max-h-72 object-contain bg-black/10"
                    loading="lazy"
                  />
                )}
                {chunks.map((chunk, j) => {
                  if (chunk.type === 'text') {
                    return <div key={j} className="whitespace-pre-wrap text-right">{chunk.text}</div>;
                  }
                  const a = chunk.action;
                  const key = actionKey(a, m.ts, j);
                  const applied = appliedActionIds.has(key);

                  if (a.type === 'update_profile') {
                    // Silent — already persisted in sendWith. No UI chip, per user request.
                    return null;
                  }

                  if (a.type === 'set_weekly_targets') {
                    // Explicit approval card. Nothing is written to Firestore
                    // until the user taps the button — the AI can only PROPOSE.
                    // Also shows current → proposed so the user knows what they
                    // are actually accepting.
                    const entries = Object.entries(a.targets)
                      .filter(([, v]) => Number.isFinite(Number(v)) && Number(v) >= 0)
                      .map(([m, v]) => ({ m, next: Math.round(Number(v)), current: Number(weeklyTargets[m] || 0) }));
                    if (entries.length === 0) return null;
                    // Approve only for the last assistant message — old cards
                    // should read as a historical proposal, not an active CTA.
                    const isLastAssistant = i === messages.length - 1;
                    return (
                      <div key={j} className={`rounded-xl border px-3 py-2.5 text-right text-[11px] ${
                        applied
                          ? 'border-emerald-500/30 bg-emerald-500/5'
                          : 'border-amber-500/40 dark:bg-amber-950/20 bg-amber-50/60'
                      }`} dir="rtl">
                        <div className={`flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-widest mb-1.5 ${
                          applied ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
                        }`}>
                          {applied ? (
                            <>
                              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
                              <span>יעדים עודכנו</span>
                            </>
                          ) : (
                            <>
                              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20" /></svg>
                              <span>הצעה ליעדים שבועיים</span>
                            </>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {entries.map(({ m, next, current }) => {
                            const info = MUSCLE_BY_ID[m as MuscleGroup];
                            const c = info ? MUSCLE_CLASSES[info.color] : null;
                            const label = info?.he || m;
                            const changed = current !== next;
                            return (
                              <span key={m} className={`inline-flex items-baseline gap-1 text-[10px] px-1.5 py-0.5 rounded ${c ? `${c.bg} ${c.text}` : 'bg-slate-500/10 text-muted'}`}>
                                <span>{label}</span>
                                {changed && current > 0 && (
                                  <span className="text-[9px] opacity-60 line-through" dir="ltr">{current}</span>
                                )}
                                <span className="font-mono font-bold" dir="ltr">{next}</span>
                                <span className="text-[9px] opacity-70">/שבוע</span>
                              </span>
                            );
                          })}
                        </div>
                        {!applied && (
                          <button
                            onClick={() => { if (isLastAssistant) void handleApproveTargets(a, key); }}
                            disabled={!isLastAssistant}
                            className={`w-full py-2 rounded-lg text-[12px] font-bold ${
                              isLastAssistant
                                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                                : 'dark:bg-slate-800 bg-slate-200 text-muted opacity-60'
                            }`}
                          >{isLastAssistant ? '✓ אישור ועדכון היעדים' : '(הצעה ישנה)'}</button>
                        )}
                      </div>
                    );
                  }

                  if (a.type === 'quick_replies') {
                    // Chip row — tap a chip to auto-send it as the user's next reply.
                    // Only render for the LAST assistant message so old chips don't stay clickable.
                    const isLastAssistant = i === messages.length - 1;
                    if (!isLastAssistant) return null;
                    return (
                      <div key={j} className="flex flex-wrap gap-1.5 pt-1" dir="rtl">
                        {a.options.slice(0, 8).map((opt, k) => (
                          <button
                            key={k}
                            onClick={() => { if (!loading) void sendWith(opt); }}
                            disabled={loading}
                            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 disabled:opacity-50"
                          >{opt}</button>
                        ))}
                      </div>
                    );
                  }

                  if (a.type === 'ready_to_build') {
                    // Onboarding-only: prominent CTA that hands the profile back to the parent.
                    const isLastAssistant = i === messages.length - 1;
                    return (
                      <button
                        key={j}
                        onClick={() => { if (isLastAssistant && onReadyToBuild) onReadyToBuild(a); }}
                        disabled={!isLastAssistant || !onReadyToBuild || applied}
                        className={`w-full py-3 rounded-2xl font-bold text-sm inline-flex items-center justify-center gap-2 ${
                          !isLastAssistant || applied
                            ? 'dark:bg-emerald-900/40 bg-emerald-100 text-emerald-700 dark:text-emerald-300 opacity-60'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_3px_10px_-2px_rgba(16,185,129,0.5)]'
                        }`}
                        dir="rtl"
                      >
                        <span>{applied ? '✓ בונה...' : '✨ בנה לי את התוכנית'}</span>
                      </button>
                    );
                  }

                  if (a.type === 'suggest_exercise') {
                    const mus = MUSCLE_BY_ID[a.muscle as MuscleGroup];
                    const c = mus ? MUSCLE_CLASSES[mus.color] : null;
                    // Is this exercise ALREADY in today's session (planned or logged)?
                    // Different visual grammar so the AI's rehash doesn't look like a fresh addable card.
                    const nameKey = a.name.trim().toLowerCase();
                    const inSession = currentSessionExercises.some(e => e.name.trim().toLowerCase() === nameKey);
                    const inSessionEntry = inSession ? currentSessionExercises.find(e => e.name.trim().toLowerCase() === nameKey) : null;
                    const useBlue = inSession && !applied;
                    return (
                      <div
                        key={j}
                        className={`w-full rounded-xl border overflow-hidden ${
                          applied
                            ? 'dark:border-emerald-800 border-emerald-300 opacity-60'
                            : useBlue
                              ? 'dark:border-blue-800 border-blue-300 dark:bg-blue-950/40 bg-blue-50'
                              : 'dark:border-emerald-800 border-emerald-300 dark:bg-emerald-950/40 bg-emerald-50'
                        }`}
                        dir="rtl"
                      >
                        {/* Top row: name + status */}
                        <button
                          onClick={() => !applied && !useBlue && handleSuggestAction(a, key)}
                          disabled={applied || useBlue}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-right ${
                            !applied && !useBlue ? 'dark:hover:bg-emerald-900/50 hover:bg-emerald-100' : ''
                          }`}
                        >
                          <div className="text-right flex-1 min-w-0">
                            <div className="text-sm font-semibold">{a.name}</div>
                            {a.en && <div className="text-[10px] text-muted-most" dir="ltr">{a.en}</div>}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {c && mus && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}>{mus.he}</span>
                              )}
                              {a.isNew && !useBlue && <span className="text-[10px] text-amber-500">חדש</span>}
                            </div>
                          </div>
                          <span className={`text-[11px] font-semibold shrink-0 ${useBlue ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {applied
                              ? '✓ נוסף'
                              : useBlue
                                ? (inSessionEntry?.hasSets ? '✓ באימון' : '✓ בתוכנית')
                                : (replaceContext ? '⇄ החלף' : (onAddToDb && !onAddSet ? '+ הוסף למאגר' : '+ הוסף לאימון'))}
                          </span>
                        </button>
                        {/* How-to steps + Google-search link */}
                        {a.howTo && a.howTo.length > 0 && (
                          <div className="border-t dark:border-emerald-800/50 border-emerald-300/50 px-3 py-2 dark:bg-emerald-950/20 bg-emerald-50/60">
                            <ol className="text-[11px] text-right space-y-0.5 leading-snug list-decimal list-inside">
                              {a.howTo.slice(0, 4).map((step, k) => (
                                <li key={k} className="text-slate-700 dark:text-slate-200">{step}</li>
                              ))}
                            </ol>
                            {a.en && (
                              <a
                                href={`https://www.google.com/search?q=${encodeURIComponent(a.en + ' exercise')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-2 text-[10px] text-blue-500 dark:text-blue-400 hover:underline"
                                onClick={e => e.stopPropagation()}
                              >
                                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="11" cy="11" r="7" />
                                  <path d="M20 20l-3.5-3.5" />
                                </svg>
                                <span>חפש בגוגל</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (a.type === 'suggest_meal') {
                    return (
                      <MealActionCard
                        key={j}
                        action={a}
                        applied={applied}
                        onAdd={async (draft) => {
                          if (!onAddMeal) return;
                          await onAddMeal(draft);
                          setAppliedActionIds(prev => new Set(prev).add(key));
                          void firestoreRef.current.markActionApplied(activeId, key);
                          showToast('נוסף להיום');
                        }}
                        onEdit={onEditMeal ? (d) => onEditMeal({ ...d, actionRef: { threadId: activeId, key } }) : undefined}
                      />
                    );
                  }

                  // rename_exercise
                  const existing = personalExercises.find(e => e.id === (a as ActionRenameExercise).id);
                  const mus = MUSCLE_BY_ID[((a as ActionRenameExercise).muscle || existing?.defaultMuscle || 'chest') as MuscleGroup];
                  const c = mus ? MUSCLE_CLASSES[mus.color] : null;
                  return (
                    <button
                      key={j}
                      onClick={() => !applied && handleRenameAction(a, key)}
                      disabled={applied}
                      className={`w-full text-right px-3 py-2 rounded-xl border dark:border-blue-800 border-blue-300 ${
                        applied ? 'opacity-60' : 'dark:bg-blue-950/40 bg-blue-50 dark:hover:bg-blue-900/50 hover:bg-blue-100'
                      }`}
                      dir="rtl"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] text-blue-600 dark:text-blue-300 font-semibold">שינוי שם</span>
                        <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                          {applied ? '✓ יושם' : '✎ החל שינוי'}
                        </span>
                      </div>
                      {existing && (
                        <div className="text-[10px] text-muted-most line-through decoration-muted-most/60 mb-0.5">{existing.he}</div>
                      )}
                      <div className="text-sm font-semibold">{a.newHe}</div>
                      {a.newEn && <div className="text-[10px] text-muted" dir="ltr">{a.newEn}</div>}
                      {c && mus && (
                        <div className="mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}>{mus.he}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            {showTruncated && (
              <button
                onClick={() => sendWith('המשך')}
                className="mt-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40 hover:bg-amber-500/25"
                dir="rtl"
              >
                ⚠️ נחתך באמצע — לחץ להמשך
              </button>
            )}
            {/* Inline early-escape CTA — shows only under the greeting (last assistant
                bubble AND no user reply yet). Dismisses itself the moment the user
                sends anything, so it never lingers mid-conversation. */}
            {earlySkipCta && m.role === 'assistant' && i === messages.length - 1
              && !messages.some(mm => mm.role === 'user') && (
              <button
                onClick={earlySkipCta.onClick}
                className="mt-2 text-[11px] px-3 py-1.5 rounded-full dark:bg-slate-800 bg-slate-100 text-muted hover:text-main border border-subtle"
                dir="rtl"
              >
                {earlySkipCta.label}
              </button>
            )}
            </div>
          );
        })}

        {/* Live streaming reply — TEXT ONLY.
            Action blocks are deliberately invisible while the reply is still
            arriving: a half-formed proposal is noise, and a "ready" chip that
            precedes the actual card just makes the user wait twice. The real
            cards appear when the finished message lands. */}
        {streamingText && (
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-3 py-2 text-sm dark:bg-slate-800 bg-slate-100" dir="rtl">
              <span className="whitespace-pre-wrap text-right">{visibleStreamText}</span>
              <span className="inline-flex items-center gap-0.5 align-middle ms-1">
                <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '900ms' }} />
                <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '150ms', animationDuration: '900ms' }} />
                <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '300ms', animationDuration: '900ms' }} />
              </span>
            </div>
          </div>
        )}

        {(() => {
          // Dots reflect THIS thread's state only — never the global `loading`
          // flag, which used to leak across conversation switches (send on A,
          // switch to B → dots still showed on B). Instead: the last message
          // on the current thread is a user turn with no assistant reply yet.
          // A 90-second freshness window prevents an old unanswered user
          // message (e.g. server crash from a prior day) from showing dots
          // forever.
          // Once text starts streaming the dots give way to the live bubble.
          const lastMsg = messages[messages.length - 1];
          const pending = !streamingText && !!lastMsg && lastMsg.role === 'user' && (Date.now() - (lastMsg.ts || 0)) < 90_000;
          if (!pending) return null;
          return (
            <div className="flex justify-end">
              <div className="dark:bg-slate-800 bg-slate-100 rounded-2xl rounded-tr-sm px-4 py-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '900ms' }} />
                <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '150ms', animationDuration: '900ms' }} />
                <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '300ms', animationDuration: '900ms' }} />
              </div>
            </div>
          );
        })()}

        {error && (
          <div className="text-center text-xs text-red-500" dir="rtl">
            שגיאה: {error}
          </div>
        )}
      </div>

      <div className="shrink-0 p-4 border-t border-subtle dark:bg-slate-950 bg-white pb-[max(env(safe-area-inset-bottom),1rem)]">
        {/* One-tap prompts — in dietary mode these are your usual meals for this
            time of day. They send as a normal message, so the coach answers with
            a meal card and the conversation continues: quick access WITHOUT
            turning the chat into a list screen. */}
        {suggestionChips.length > 0 && !loading && (
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1" dir="rtl">
            {suggestionChips.slice(0, 5).map((c, i) => (
              <button
                key={i}
                onClick={() => void sendWith(c)}
                className="shrink-0 text-[11px] font-semibold px-2.5 py-1.5 rounded-full bg-amber-500/12 text-amber-700 dark:text-amber-300 whitespace-nowrap"
              >{c}</button>
            ))}
          </div>
        )}
        {/* Attached-image preview strip. Shows above the input; X to clear. */}
        {pendingImage && (
          <div className="mb-2 flex items-center gap-2" dir="rtl">
            <div className="relative shrink-0">
              <img src={pendingImage} alt="" className="w-16 h-16 rounded-lg object-cover border border-subtle" />
              <button
                onClick={() => setPendingImage(null)}
                aria-label="הסר תמונה"
                className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow"
              >×</button>
            </div>
            <div className="text-[11px] text-muted">תמונה מצורפת · כתוב שאלה או שלח כמו שזה</div>
          </div>
        )}
        <div className="flex gap-2 items-center" dir="rtl">
          {/* Hidden file input — the paperclip button triggers it. `capture`
              hints the mobile browser to offer camera as an option too. */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async e => {
              const f = e.target.files?.[0];
              if (f) await attachImage(f);
              // Clear so picking the same file again re-fires onChange.
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={attaching || loading}
            aria-label="צרף תמונה"
            title="צרף תמונה"
            className="shrink-0 w-11 h-11 rounded-xl inline-flex items-center justify-center dark:bg-slate-800 bg-slate-100 dark:hover:bg-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            {attaching ? (
              <span className="w-3 h-3 rounded-full bg-muted animate-pulse" />
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.49" />
              </svg>
            )}
          </button>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={pendingImage ? 'שאל על התמונה (או שלח בלי טקסט)' : 'תאר תרגיל או בקש הצעה...'}
            className="input-field flex-1 !text-right !text-sm !py-2.5"
            dir="rtl"
            /* No autoFocus — otherwise iOS Safari pops the keyboard and hides the header. User can tap the input themselves. */
          />
          <button
            onClick={send}
            disabled={loading || (!input.trim() && !pendingImage)}
            // Fixed geometry (min-width + height) so the button doesn't shrink
            // or shift when the disabled/enabled classes swap — only the
            // background + text color change between states.
            className={`shrink-0 min-w-[64px] h-11 px-5 rounded-xl font-semibold text-sm inline-flex items-center justify-center ${
              loading || (!input.trim() && !pendingImage)
                ? 'dark:bg-slate-800 dark:text-slate-500 bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >שלח</button>
        </div>
      </div>
    </div>
  );
}
