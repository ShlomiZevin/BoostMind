import { useEffect, useMemo, useRef, useState } from 'react';
import type { FreeSet } from '../types';
import type { MuscleGroup } from '../data/muscles';
import { MUSCLE_BY_ID, MUSCLE_CLASSES, ACTIVE_MUSCLES } from '../data/muscles';
import { type PersonalExercise } from '../data/exercisesDB';
import { CHAT_API_URL } from '../config/api';
import { useFirestore } from '../hooks/useFirestore';

type Props = {
  uid: string;
  mode?: 'session' | 'naming';
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
  onClose: () => void;
};

type Msg = { role: 'user' | 'assistant'; content: string; ts: number };

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

type ChatAction = ActionSuggestExercise | ActionRenameExercise;

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
      }
    } catch { /* ignore malformed */ }
    last = m.index + m[0].length;
  }
  const tail = text.slice(last).trim();
  if (tail) out.push({ type: 'text', text: tail });
  return out.length > 0 ? out : [{ type: 'text', text: text.trim() }];
}

type Thread = { id: string; title: string; ts: number; messages: Msg[] };

const THREADS_KEY = (uid: string, mode: string) => `aichat:threads:${uid}:${mode}`;
// Legacy single-thread key — migrated once on first load.
const LEGACY_KEY = (uid: string, mode: string) => `aichat:history:${uid}:${mode}`;

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
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

function loadTodaysThreads(uid: string, mode: string): Thread[] {
  const cutoff = startOfToday();
  let threads: Thread[] = [];
  try {
    const raw = localStorage.getItem(THREADS_KEY(uid, mode));
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) threads = arr;
    }
  } catch { /* ignore */ }

  // One-time migration from the old single-thread key, if present and same-day.
  if (threads.length === 0) {
    try {
      const raw = localStorage.getItem(LEGACY_KEY(uid, mode));
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length > 0) {
          const legacyTs = arr[0]?.ts ?? Date.now();
          if (legacyTs >= cutoff) {
            const migrated: Thread = {
              id: `t_${legacyTs}`,
              ts: legacyTs,
              title: computeThreadTitle(arr as Msg[], legacyTs),
              messages: arr as Msg[],
            };
            threads = [migrated];
          }
          localStorage.removeItem(LEGACY_KEY(uid, mode));
        }
      }
    } catch { /* ignore */ }
  }

  // Only today's threads survive. Older ones silently drop.
  return threads
    .filter(t => t.ts >= cutoff)
    .map(t => ({ ...t, messages: (t.messages || []).slice(-50) }))
    .sort((a, b) => b.ts - a.ts);
}

function saveThreads(uid: string, mode: string, threads: Thread[]) {
  try {
    localStorage.setItem(THREADS_KEY(uid, mode), JSON.stringify(threads.slice(0, 20)));
  } catch { /* quota */ }
}

export function AiChatPanel({
  uid, mode = 'session', sessionMuscles = [], recentSets = [], onAddSet, onAddToDb, onRename, initialPrompt, initialAssistantMessage, replaceContext, newThreadOnMount, onClose,
}: Props) {
  const firestore = useFirestore(uid);
  const [personalExercises, setPersonalExercises] = useState<PersonalExercise[]>([]);
  const [threads, setThreads] = useState<Thread[]>(() => loadTodaysThreads(uid, mode));
  const [activeId, setActiveId] = useState<string>(() => {
    const existing = loadTodaysThreads(uid, mode);
    if (newThreadOnMount || existing.length === 0) {
      const t = Date.now();
      return `t_${t}`;
    }
    return existing[0].id;
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [appliedActionIds, setAppliedActionIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [threadsMenuOpen, setThreadsMenuOpen] = useState(false);
  const autoSentRef = useRef(false);

  // Ensure active thread exists in the array (creates it lazily on mount)
  useEffect(() => {
    setThreads(prev => {
      if (prev.some(t => t.id === activeId)) return prev;
      const now = Date.now();
      const fresh: Thread = { id: activeId, title: `שיחה · ${fmtHour(now)}`, ts: now, messages: [] };
      const next = [fresh, ...prev];
      saveThreads(uid, mode, next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const activeThread = threads.find(t => t.id === activeId);
  const messages = activeThread?.messages ?? [];

  function updateActiveMessages(next: Msg[]) {
    setThreads(prev => {
      const idx = prev.findIndex(t => t.id === activeId);
      const now = Date.now();
      const base: Thread = idx >= 0 ? prev[idx] : { id: activeId, title: `שיחה · ${fmtHour(now)}`, ts: now, messages: [] };
      const updated: Thread = {
        ...base,
        messages: next.slice(-50),
        title: computeThreadTitle(next, base.ts),
      };
      const list = idx >= 0
        ? prev.map(t => t.id === activeId ? updated : t)
        : [updated, ...prev];
      // Keep list sorted by ts desc
      const sorted = [...list].sort((a, b) => b.ts - a.ts);
      saveThreads(uid, mode, sorted);
      return sorted;
    });
  }

  useEffect(() => {
    firestore.listPersonalExercises().then(setPersonalExercises);
  }, [uid]);

  // Auto-send an initialPrompt when the panel opens (used by quick-action chips).
  useEffect(() => {
    if (!initialPrompt || autoSentRef.current) return;
    autoSentRef.current = true;
    const p = initialPrompt.trim();
    if (!p) return;
    setInput(p);
    setTimeout(() => { setInput(''); void sendWith(p); }, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seed the active thread with a fake assistant greeting (no server round-trip) — used to
  // prime the conversation with context without making the user look like they said something.
  useEffect(() => {
    if (!initialAssistantMessage || autoSentRef.current) return;
    autoSentRef.current = true;
    const cur = threads.find(t => t.id === activeId);
    if (cur && cur.messages.length > 0) return; // already has content
    updateActiveMessages([{ role: 'assistant', content: initialAssistantMessage, ts: Date.now() }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startNewConversation() {
    const t = Date.now();
    const newId = `t_${t}`;
    const fresh: Thread = { id: newId, title: `שיחה · ${fmtHour(t)}`, ts: t, messages: [] };
    setThreads(prev => {
      const next = [fresh, ...prev];
      saveThreads(uid, mode, next);
      return next;
    });
    setActiveId(newId);
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

  function deleteThread(id: string) {
    setThreads(prev => {
      const next = prev.filter(t => t.id !== id);
      saveThreads(uid, mode, next);
      // If we deleted the active one, pick the next available (or a fresh one)
      if (id === activeId) {
        if (next.length > 0) setActiveId(next[0].id);
        else {
          const now = Date.now();
          const newId = `t_${now}`;
          setActiveId(newId);
          return [{ id: newId, title: `שיחה · ${fmtHour(now)}`, ts: now, messages: [] }, ...next];
        }
      }
      return next;
    });
  }

  function showToast(text: string) {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

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
    if (!text || loading) return;
    setInput('');
    await sendWith(text);
  }

  async function sendWith(text: string) {
    if (!text || loading) return;
    const nextMessages: Msg[] = [...messages, { role: 'user' as const, content: text, ts: Date.now() }];
    updateActiveMessages(nextMessages);
    setLoading(true);
    setError(null);

    // Trim personal-exercise payload — include en in naming mode so AI can see gaps
    const exPayload = personalExercises.slice(0, 300).map(e => ({
      id: e.id,
      he: e.he,
      en: e.en,
      defaultMuscle: e.defaultMuscle,
      lastUsedDays: lastUsedDaysByEx.get(e.he.toLowerCase()),
    }));
    // Include everything from the last 10 days, newest first. Hard cap 400 as a safety net.
    const cutoff = Date.now() - 10 * 86_400_000;
    const setsPayload = [...recentSets]
      .filter(s => s.timestamp >= cutoff)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 400)
      .map(s => ({
        exerciseName: s.exerciseName,
        muscle: s.muscle,
        weight: s.weight,
        reps: s.reps,
        unit: s.unit,
        date: new Date(s.timestamp).toISOString().slice(0, 10),
      }));

    try {
      const resp = await fetch(`${CHAT_API_URL.replace(/\/$/, '')}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid,
          mode,
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
          personalExercises: exPayload,
          recentSets: setsPayload,
          sessionMuscles,
          replaceContext,  // signals to the server this is a REPLACE flow
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      updateActiveMessages([...nextMessages, { role: 'assistant' as const, content: data.text || '', ts: Date.now() }]);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  function actionKey(a: ChatAction, mi: number, ci: number): string {
    if (a.type === 'suggest_exercise') return `s:${mi}:${ci}:${a.name}`;
    return `r:${mi}:${ci}:${a.id}`;
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
              {mode === 'naming' ? 'מאמן שמות' : 'מאמן AI'}
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
          {threads.length > 1 && (
            <button
              onClick={() => setThreadsMenuOpen(v => !v)}
              aria-label="שיחות היום"
              className="w-10 h-10 rounded-full flex items-center justify-center text-muted dark:hover:bg-slate-800 hover:bg-slate-100 transition-colors relative"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="absolute -top-0.5 -right-0.5 bg-emerald-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center">
                {threads.length}
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
              {threads.map(t => {
                const isActive = t.id === activeId;
                const msgCount = t.messages.length;
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
                      <div className="text-sm font-medium truncate">{t.title}</div>
                      <div className="text-[10px] text-muted mt-0.5">{msgCount} הודעות</div>
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
              {threads.length === 0 && (
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

        {messages.map((m, i) => {
          const chunks = m.role === 'assistant' ? parseChunks(m.content) : [{ type: 'text' as const, text: m.content }];
          return (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm space-y-2 ${
                  m.role === 'user'
                    ? 'dark:bg-blue-900/50 bg-blue-100 text-blue-800 dark:text-blue-100 rounded-tl-sm'
                    : 'dark:bg-slate-800 bg-slate-100 rounded-tr-sm'
                }`}
                dir="rtl"
              >
                {chunks.map((chunk, j) => {
                  if (chunk.type === 'text') {
                    return <div key={j} className="whitespace-pre-wrap text-right">{chunk.text}</div>;
                  }
                  const a = chunk.action;
                  const key = actionKey(a, i, j);
                  const applied = appliedActionIds.has(key);

                  if (a.type === 'suggest_exercise') {
                    const mus = MUSCLE_BY_ID[a.muscle as MuscleGroup];
                    const c = mus ? MUSCLE_CLASSES[mus.color] : null;
                    return (
                      <div
                        key={j}
                        className={`w-full rounded-xl border dark:border-emerald-800 border-emerald-300 overflow-hidden ${
                          applied ? 'opacity-60' : 'dark:bg-emerald-950/40 bg-emerald-50'
                        }`}
                        dir="rtl"
                      >
                        {/* Top row: name + add button */}
                        <button
                          onClick={() => !applied && handleSuggestAction(a, key)}
                          disabled={applied}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-right ${!applied ? 'dark:hover:bg-emerald-900/50 hover:bg-emerald-100' : ''}`}
                        >
                          <div className="text-right flex-1 min-w-0">
                            <div className="text-sm font-semibold">{a.name}</div>
                            {a.en && <div className="text-[10px] text-muted-most" dir="ltr">{a.en}</div>}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {c && mus && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}>{mus.he}</span>
                              )}
                              {a.isNew && <span className="text-[10px] text-amber-500">חדש</span>}
                            </div>
                          </div>
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                            {applied ? '✓ נוסף' : (replaceContext ? '⇄ החלף' : (onAddToDb && !onAddSet ? '+ הוסף למאגר' : '+ הוסף לאימון'))}
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

                  // rename_exercise
                  const existing = personalExercises.find(e => e.id === a.id);
                  const mus = MUSCLE_BY_ID[(a.muscle || existing?.defaultMuscle || 'chest') as MuscleGroup];
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
          );
        })}

        {loading && (
          <div className="flex justify-end">
            <div className="dark:bg-slate-800 bg-slate-100 rounded-2xl rounded-tr-sm px-4 py-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '900ms' }} />
              <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '150ms', animationDuration: '900ms' }} />
              <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '300ms', animationDuration: '900ms' }} />
            </div>
          </div>
        )}

        {error && (
          <div className="text-center text-xs text-red-500" dir="rtl">
            שגיאה: {error}
          </div>
        )}
      </div>

      <div className="shrink-0 p-4 border-t border-subtle dark:bg-slate-950 bg-white pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className="flex gap-2" dir="rtl">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="תאר תרגיל או בקש הצעה..."
            className="input-field flex-1 !text-right !text-sm !py-2.5"
            dir="rtl"
            /* No autoFocus — otherwise iOS Safari pops the keyboard and hides the header. User can tap the input themselves. */
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className={`px-5 rounded-xl font-semibold text-sm ${
              loading || !input.trim() ? 'dark:bg-slate-800 dark:text-slate-600 bg-slate-200 text-slate-400' : 'btn-primary'
            }`}
          >שלח</button>
        </div>
      </div>
    </div>
  );
}
