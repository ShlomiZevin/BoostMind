import { useEffect, useMemo, useRef, useState } from 'react';
import type { Route } from '../types';
import type { MuscleGroup, MuscleParent } from '../data/muscles';
import { ACTIVE_MUSCLES, MUSCLE_BY_ID, MUSCLE_CLASSES, PARENT_INFO, musclesByParent } from '../data/muscles';
import { type PersonalExercise, exerciseIdOf } from '../data/exercisesDB';
import { useFirestore } from '../hooks/useFirestore';
import { prepareMedia, exercisePhotoKey } from '../hooks/usePhotos';
import { CHAT_API_URL } from '../config/api';
import { AiChatPanel } from './AiChatPanel';
import { MigrateNames } from './MigrateNames';
import { TopBar } from './TopBar';
import { TabActions } from './TopBarActions';

type Props = {
  uid: string;
  navigate: (route: Route) => void;
};

const PARENT_ORDER: MuscleParent[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'aerobic'];

export function Exercises({ uid, navigate }: Props) {
  const firestore = useFirestore(uid);
  const [exercises, setExercises] = useState<PersonalExercise[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [editing, setEditing] = useState<PersonalExercise | null>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [namingChatOpen, setNamingChatOpen] = useState(false);
  const [migrateOpen, setMigrateOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [aiAddOpen, setAiAddOpen] = useState(false);
  const [historyStats, setHistoryStats] = useState<Map<string, { count: number; lastTs: number; sessionsCount: number }>>(new Map());
  const [defaultKeys, setDefaultKeys] = useState<Set<string>>(new Set());
  const isAdmin = uid === 'user_6724';

  async function refresh() {
    const [exs, ps, sessions, defs] = await Promise.all([
      firestore.listPersonalExercises(),
      firestore.getAllExercisePhotos(),
      firestore.getFreeSessions(),
      isAdmin ? firestore.listDefaultPhotoKeys() : Promise.resolve(new Set<string>()),
    ]);
    setExercises(exs);
    setPhotos(ps);
    setDefaultKeys(defs);
    // Compute per-exercise historical set count + last-used
    const stats = new Map<string, { count: number; lastTs: number; sessionsCount: number }>();
    const sessionSeenPer = new Map<string, Set<string>>();
    for (const sess of sessions) {
      for (const set of sess.sets) {
        if (!set.exerciseName) continue;
        if (set.weight === 0 && set.reps === 0) continue; // skip placeholders
        const key = set.exerciseName.trim().toLowerCase();
        const prev = stats.get(key);
        if (!prev) stats.set(key, { count: 1, lastTs: set.timestamp, sessionsCount: 0 });
        else {
          prev.count++;
          if (set.timestamp > prev.lastTs) prev.lastTs = set.timestamp;
        }
        let seen = sessionSeenPer.get(key);
        if (!seen) { seen = new Set(); sessionSeenPer.set(key, seen); }
        seen.add(sess.id);
      }
    }
    for (const [key, sess] of sessionSeenPer) {
      const s = stats.get(key);
      if (s) s.sessionsCount = sess.size;
    }
    setHistoryStats(stats);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [uid]);

  // Total stats — for the top summary
  const totalStats = useMemo(() => {
    let sets = 0, exercisesWithHistory = 0;
    for (const [, s] of historyStats) {
      sets += s.count;
      exercisesWithHistory++;
    }
    return { sets, exercisesWithHistory };
  }, [historyStats]);

  // No auto-migration. User explicitly imports or resets when they choose.

  const grouped = useMemo(() => {
    const map = new Map<MuscleParent, PersonalExercise[]>();
    for (const ex of exercises) {
      const m = MUSCLE_BY_ID[ex.defaultMuscle];
      if (!m) continue;
      const arr = map.get(m.parent) || [];
      arr.push(ex);
      map.set(m.parent, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.he.localeCompare(b.he, 'he'));
    return map;
  }, [exercises]);

  function photoFor(ex: PersonalExercise): string | null {
    const k = exercisePhotoKey(ex.he);
    return photos[k] || ex.photoBase64 || null;
  }

  async function runMigration() {
    setMigrating(true);
    try {
      await firestore.migratePersonalFromHistory();
      await refresh();
    } finally {
      setMigrating(false);
    }
  }

  return (
    <div className="page-bg min-h-screen">
      <TopBar
        title="התרגילים שלי"
        accent="brand"
        tint="violet"
        actions={<TabActions navigate={navigate} />}
      />

      {/* Floating add-exercise cluster — bottom-left, above the tab bar */}
      <div className="fixed bottom-24 left-4 z-40 flex flex-col-reverse gap-3" dir="ltr">
        <button
          onClick={() => setAddExerciseOpen(true)}
          aria-label="הוסף תרגיל ידנית"
          className="w-16 h-16 rounded-full flex items-center justify-center bg-violet-600 hover:bg-violet-500 text-white shadow-[0_8px_24px_-4px_rgba(139,92,246,0.55)] ring-4 ring-violet-500/20 transition-transform active:scale-95 hover:scale-105"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <button
          onClick={() => setAiAddOpen(true)}
          aria-label="הוסף עם AI"
          className="ai-orb-violet w-12 h-12 rounded-full flex items-center justify-center bg-violet-500 hover:bg-violet-400 text-white shadow-[0_6px_18px_-4px_rgba(139,92,246,0.65)] ring-2 ring-violet-400/25 transition-transform active:scale-95 hover:scale-105"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
            <path d="M12 2.5c.3 0 .55.2.63.48l1.28 4.53a3 3 0 0 0 2.07 2.07l4.54 1.28a.66.66 0 0 1 0 1.27l-4.54 1.28a3 3 0 0 0-2.07 2.07l-1.28 4.54a.66.66 0 0 1-1.27 0l-1.28-4.54a3 3 0 0 0-2.07-2.07L3.47 12.13a.66.66 0 0 1 0-1.27l4.54-1.28A3 3 0 0 0 10.09 7.5l1.28-4.53c.08-.28.33-.47.63-.47Z"/>
          </svg>
        </button>
      </div>
      <div className="px-4 pt-0 pb-4 max-w-lg mx-auto">

      {/* Summary strip — full-width, edge-to-edge, matches the "in-progress" banner style */}
      {!loading && exercises.length > 0 && (
        <div
          className="w-full -mx-4 mb-0 px-4 py-2 text-right
                     bg-gradient-to-l from-violet-500/10 via-violet-500/5 to-transparent
                     dark:from-violet-500/15 dark:via-violet-500/8
                     border-b dark:border-violet-500/25 border-violet-500/25"
          style={{ width: 'calc(100% + 2rem)' }}
          dir="rtl"
        >
          <div className="max-w-lg mx-auto flex items-baseline justify-between gap-2">
            <div className="text-[10px] text-violet-700/70 dark:text-violet-300/70 uppercase tracking-widest font-semibold">מאגר תרגילים</div>
            <div className="inline-flex items-baseline gap-2 shrink-0">
              <div className="inline-flex items-baseline gap-1">
                <span className="font-mono font-bold text-base text-violet-700 dark:text-violet-300 leading-none">{exercises.length}</span>
                <span className="text-[9px] text-violet-700/70 dark:text-violet-300/70">תרגילים</span>
              </div>
              <span className="text-muted-most">·</span>
              <div className="inline-flex items-baseline gap-1">
                <span className="font-mono font-bold text-base text-violet-700 dark:text-violet-300 leading-none">{totalStats.sets}</span>
                <span className="text-[9px] text-violet-700/70 dark:text-violet-300/70">סטים</span>
              </div>
              <span className="text-muted-most">·</span>
              <div className="inline-flex items-baseline gap-1">
                <span className="font-mono font-bold text-base text-violet-700 dark:text-violet-300 leading-none">{totalStats.exercisesWithHistory}</span>
                <span className="text-[9px] text-violet-700/70 dark:text-violet-300/70">היסטוריה</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="text-muted text-center py-8">Loading...</div>}

      {!loading && exercises.length === 0 && !migrating && (
        <div className="card text-center py-6 text-muted text-sm" dir="rtl">
          עדיין אין תרגילים ברשימה שלך. הם ייבנו לבד ברגע שתתחיל לרשום סטים.
        </div>
      )}

      {/* Solid add-exercise buttons — mirrored to the '+ אירובי' style, always visible so users
          don't have to hunt for the floating FAB. */}
      {!loading && (
        <div className="mt-3 mb-4 flex gap-2" dir="rtl">
          <button
            onClick={() => setAddExerciseOpen(true)}
            className="flex-1 py-3 rounded-xl border border-violet-500/40 bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40 text-sm font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            <span>הוסף תרגיל</span>
          </button>
          <button
            onClick={() => setAiAddOpen(true)}
            className="ai-orb-violet py-3 px-4 rounded-xl bg-violet-500 hover:bg-violet-400 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M12 2.5c.3 0 .55.2.63.48l1.28 4.53a3 3 0 0 0 2.07 2.07l4.54 1.28a.66.66 0 0 1 0 1.27l-4.54 1.28a3 3 0 0 0-2.07 2.07l-1.28 4.54a.66.66 0 0 1-1.27 0l-1.28-4.54a3 3 0 0 0-2.07-2.07L3.47 12.13a.66.66 0 0 1 0-1.27l4.54-1.28A3 3 0 0 0 10.09 7.5l1.28-4.53c.08-.28.33-.47.63-.47Z"/>
            </svg>
            <span>AI</span>
          </button>
        </div>
      )}

      {!loading && exercises.length > 0 && PARENT_ORDER.map(parent => {
        const kids = grouped.get(parent) || [];
        if (kids.length === 0) return null;
        const info = PARENT_INFO[parent];
        const parentClasses = MUSCLE_CLASSES[info.color];
        return (
          <section key={parent} className="mb-4" dir="rtl">
            <div className="sticky z-20 -mx-4 px-4 py-2.5 mb-2 backdrop-blur bg-gradient-to-b from-white/95 to-white/80 dark:from-slate-950/95 dark:to-slate-950/85 border-b border-subtle" style={{ top: 'var(--top-bar-h)' }}>
              <div className="max-w-lg mx-auto flex items-baseline justify-between">
                <h2 className="inline-flex items-center gap-2 text-base font-bold">
                  <span className={parentClasses.text}>{info.he}</span>
                  <span className={`w-1 h-4 rounded-full ${parentClasses.bar}`} />
                </h2>
                <span className="text-[10px] text-muted-most uppercase tracking-widest font-semibold">
                  {kids.length} תרגילים
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {kids.map(ex => {
                const m = MUSCLE_BY_ID[ex.defaultMuscle];
                if (!m) return null;
                const c = MUSCLE_CLASSES[m.color];
                const photo = photoFor(ex);
                return (
                  <div key={ex.id} className="card" dir="rtl">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 text-right min-w-0">
                        <div className="flex items-center gap-2 justify-start">
                          <span className="text-sm font-semibold truncate">{ex.he}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${c.bg} ${c.text}`}>{m.he}</span>
                        </div>
                        {ex.en && (
                          <div className="text-[10px] text-muted mt-0.5 truncate text-right" dir="ltr" style={{ direction: 'ltr' }}>
                            {ex.en}
                          </div>
                        )}
                        {(() => {
                          const stat = historyStats.get(ex.he.trim().toLowerCase());
                          if (!stat) {
                            return <div className="text-[10px] text-muted-most mt-1">אין עדיין סטים היסטוריים</div>;
                          }
                          const daysAgo = Math.max(0, Math.floor((Date.now() - stat.lastTs) / 86_400_000));
                          const timeAgo =
                            daysAgo === 0 ? 'היום' :
                            daysAgo === 1 ? 'אתמול' :
                            daysAgo < 7 ? `לפני ${daysAgo}י׳` :
                            daysAgo < 30 ? `לפני ${Math.floor(daysAgo / 7)}ש׳` :
                            `לפני ${Math.floor(daysAgo / 30)}ח׳`;
                          return (
                            <div className="text-[10px] text-muted mt-1 flex items-center gap-1.5 justify-end" dir="rtl">
                              <span className="font-mono font-semibold">{stat.count}</span>
                              <span>סטים</span>
                              <span className="text-muted-most">·</span>
                              <span className="font-mono">{stat.sessionsCount}</span>
                              <span>אימונים</span>
                              <span className="text-muted-most">·</span>
                              <span className="text-emerald-600 dark:text-emerald-400">{timeAgo}</span>
                            </div>
                          );
                        })()}
                        {ex.aliases && ex.aliases.length > 0 && (
                          <div className="text-[10px] text-muted-most mt-1 truncate">
                            כינויים: {ex.aliases.join(' · ')}
                          </div>
                        )}
                        {ex.notes && (
                          <div className="text-[10px] text-muted mt-1 truncate">{ex.notes}</div>
                        )}
                      </div>
                      {photo && (
                        <button
                          onClick={() => setLightbox({ src: photo, alt: ex.he })}
                          className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-transparent border-0 p-0"
                        >
                          {photo.startsWith('data:video/') || /\.(mp4|webm|mov)$/i.test(photo) ? (
                            <video src={photo} className="w-full h-full object-cover" muted playsInline autoPlay loop />
                          ) : (
                            <img src={photo} alt={ex.he} className="w-full h-full object-cover" />
                          )}
                        </button>
                      )}
                    </div>
                    <div className="flex gap-3 mt-2 justify-start text-[11px] items-center">
                      <button onClick={() => { setUploadFor(ex.he); fileInputRef.current?.click(); }} className="text-blue-500">
                        {photo ? 'החלף תמונה' : 'הוסף תמונה'}
                      </button>
                      {photo && (
                        <button
                          onClick={async () => {
                            await firestore.deleteExercisePhoto(ex.he);
                            setPhotos(p => { const n = { ...p }; delete n[exercisePhotoKey(ex.he)]; return n; });
                          }}
                          className="text-amber-500"
                        >מחק תמונה</button>
                      )}
                      {isAdmin && photo && (() => {
                        const key = exercisePhotoKey(ex.he);
                        const isDefault = defaultKeys.has(key);
                        return (
                          <button
                            onClick={async () => {
                              if (isDefault) {
                                await firestore.deleteDefaultExercisePhoto(ex.he);
                                setDefaultKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
                              } else {
                                await firestore.setDefaultExercisePhoto(ex.he, photo);
                                setDefaultKeys(prev => { const n = new Set(prev); n.add(key); return n; });
                              }
                            }}
                            title={isDefault ? 'הסר את התמונה כברירת מחדל לכולם' : 'הגדר תמונה זו כברירת מחדל לכולם'}
                            className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border ${
                              isDefault
                                ? 'bg-amber-500 text-white border-amber-500'
                                : 'text-amber-600 dark:text-amber-400 border-amber-500/40 hover:bg-amber-500/10'
                            }`}
                          >
                            <svg viewBox="0 0 24 24" width="11" height="11" fill={isDefault ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                            <span>default</span>
                          </button>
                        );
                      })()}
                      <button onClick={() => setEditing(ex)} className="text-blue-500">ערוך</button>
                      <button onClick={() => setConfirmDeleteId(ex.id)} className="text-red-500">מחק</button>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent((ex.en || ex.he) + ' exercise')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="חפש בגוגל"
                        className="ml-auto inline-flex items-center justify-center w-7 h-7 rounded-full dark:bg-slate-800 bg-slate-100 text-muted hover:text-main"
                        title="חיפוש בגוגל"
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="7" />
                          <path d="M20 20l-3.5-3.5" />
                        </svg>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Bulk migration modal */}
      {migrateOpen && (
        <MigrateNames
          uid={uid}
          exercises={exercises}
          onClose={() => setMigrateOpen(false)}
          onDone={refresh}
        />
      )}

      {/* Naming-mode chat panel */}
      {namingChatOpen && (
        <AiChatPanel
          uid={uid}
          mode="naming"
          onClose={() => setNamingChatOpen(false)}
          onRename={async (id, patch) => {
            const orig = exercises.find(e => e.id === id);
            if (!orig) return;
            const aliases = Array.from(new Set([...(orig.aliases || []), orig.he].filter(Boolean)));
            await firestore.upsertPersonalExercise({
              ...orig,
              he: patch.he?.trim() || orig.he,
              en: patch.en?.trim() || orig.en,
              defaultMuscle: patch.muscle || orig.defaultMuscle,
              aliases,
            });
            await refresh();
          }}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <EditExerciseModal
          exercise={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            await firestore.upsertPersonalExercise({ ...editing, ...patch });
            setEditing(null);
            refresh();
          }}
          onAiSuggest={async () => {
            const resp = await fetch(`${CHAT_API_URL.replace(/\/$/, '')}/api/rename-suggestions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                uid,
                exercises: [{
                  id: editing.id,
                  current: editing.he,
                  currentEn: editing.en,
                  muscle: editing.defaultMuscle,
                }],
              }),
            });
            if (!resp.ok) return null;
            const data = await resp.json();
            const s = (data.suggestions || [])[0];
            if (!s || !s.suggestedHe) return null;
            return { he: s.suggestedHe, en: s.suggestedEn, muscle: s.muscle };
          }}
        />
      )}

      {/* AI free-text add — user describes an exercise, AI matches to existing or creates a new one */}
      {aiAddOpen && (
        <AiChatPanel
          uid={uid}
          mode="naming"
          initialAssistantMessage={
            "היי! תאר לי תרגיל שאתה רוצה להוסיף למאגר — במלל חופשי, כמו שאתה רואה אותו בחדר כושר.\n\n" +
            "אני אבדוק קודם אם הוא כבר קיים אצלך ברשימה. אם כן — אגיד לך את השם המדויק. אם לא — אציע לך אותו עם שם עברי מובנה, שם אנגלי, קבוצת שריר, וצעדי ביצוע.\n\n" +
            "איזה תרגיל?"
          }
          newThreadOnMount
          onClose={() => { setAiAddOpen(false); refresh(); }}
          onAddToDb={async ({ exerciseName, muscle, en, isHoldTime }) => {
            await firestore.ensurePersonalExercise(exerciseName, muscle, en, isHoldTime);
          }}
        />
      )}

      {/* Add-new-exercise modal — reuses EditExerciseModal on a blank stub */}
      {addExerciseOpen && (
        <EditExerciseModal
          exercise={{
            id: '', he: '', en: '', defaultMuscle: 'chest',
            createdAt: Date.now(), updatedAt: Date.now(),
          }}
          onClose={() => setAddExerciseOpen(false)}
          onSave={async (patch) => {
            const he = (patch.he || '').trim();
            if (!he) return;
            const id = exerciseIdOf(he);
            if (!id) return;
            await firestore.upsertPersonalExercise({
              id,
              he,
              en: patch.en?.trim() || undefined,
              defaultMuscle: patch.defaultMuscle || 'chest',
              aliases: patch.aliases,
              notes: patch.notes,
              isHoldTime: patch.isHoldTime,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
            setAddExerciseOpen(false);
            refresh();
          }}
        />
      )}

      {/* Confirm reset all */}
      {confirmResetAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/50 p-4">
          <div className="card max-w-sm w-full text-right" dir="rtl">
            <h3 className="font-bold text-red-500 mb-2">למחוק את כל התרגילים?</h3>
            <p className="text-sm text-muted mb-4">
              כל {exercises.length} התרגילים ברשימה שלך יימחקו. הסטים בהיסטוריה לא ייגעו — הם ישארו שם עם השמות שלהם.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmResetAll(false)} className="btn-secondary flex-1">ביטול</button>
              <button
                onClick={async () => {
                  setConfirmResetAll(false);
                  for (const ex of exercises) {
                    await firestore.deletePersonalExercise(ex.id);
                  }
                  refresh();
                }}
                className="btn-primary flex-1 !bg-red-600 hover:!bg-red-500"
              >מחק הכל</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/50 p-4">
          <div className="card max-w-sm w-full text-right" dir="rtl">
            <h3 className="font-bold text-red-500 mb-2">מחק תרגיל?</h3>
            <p className="text-sm text-muted mb-4">
              המחיקה לא מוחקת סטים היסטוריים — הם ישארו בהיסטוריה, אבל התרגיל לא יופיע ברשימה שלך יותר.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="btn-secondary flex-1">ביטול</button>
              <button
                onClick={async () => {
                  await firestore.deletePersonalExercise(confirmDeleteId);
                  setConfirmDeleteId(null);
                  refresh();
                }}
                className="btn-primary flex-1 !bg-red-600 hover:!bg-red-500"
              >מחק</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for photo capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file || !uploadFor) { setUploadFor(null); return; }
          setUploading(true);
          try {
            const { dataUrl } = await prepareMedia(file);
            await firestore.saveExercisePhoto(uploadFor, dataUrl);
            setPhotos(p => ({ ...p, [exercisePhotoKey(uploadFor)]: dataUrl }));
          } catch (err: any) {
            alert(err?.message || 'שגיאה בהעלאה');
          } finally {
            setUploading(false);
            setUploadFor(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        }}
      />

      {/* Lightbox for image/video preview */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          {lightbox.src.startsWith('data:video/') || /\.(mp4|webm|mov)$/i.test(lightbox.src) ? (
            <video src={lightbox.src} className="max-w-full max-h-full rounded-lg" controls autoPlay loop />
          ) : (
            <img src={lightbox.src} alt={lightbox.alt} className="max-w-full max-h-full object-contain rounded-lg" />
          )}
        </div>
      )}

      {uploading && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 card !py-2 !px-4 text-xs" dir="rtl">
          מעלה תמונה...
        </div>
      )}
      </div>
    </div>
  );
}

function EditExerciseModal({
  exercise, onClose, onSave, onAiSuggest,
}: {
  exercise: PersonalExercise;
  onClose: () => void;
  onSave: (patch: Partial<PersonalExercise>) => void;
  onAiSuggest?: () => Promise<{ he: string; en?: string; muscle?: MuscleGroup } | null>;
}) {
  const [he, setHe] = useState(exercise.he);
  const [en, setEn] = useState(exercise.en || '');
  const [muscle, setMuscle] = useState<MuscleGroup>(exercise.defaultMuscle);
  const [aliasesText, setAliasesText] = useState((exercise.aliases || []).join(', '));
  const [notes, setNotes] = useState(exercise.notes || '');
  const [isHoldTime, setIsHoldTime] = useState<boolean>(!!exercise.isHoldTime);
  const [aiThinking, setAiThinking] = useState(false);

  async function runAiSuggest() {
    if (!onAiSuggest || aiThinking) return;
    setAiThinking(true);
    try {
      const r = await onAiSuggest();
      if (r) {
        if (r.he) setHe(r.he);
        if (r.en) setEn(r.en);
        if (r.muscle) setMuscle(r.muscle);
      }
    } finally {
      setAiThinking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overlay-solid">
      <div className="flex items-center justify-between p-4 border-b border-subtle" dir="rtl">
        <h2 className="font-bold text-lg">{exercise.id ? 'עריכת תרגיל' : 'תרגיל חדש'}</h2>
        <button onClick={onClose} aria-label="סגור" className="text-muted text-2xl leading-none">×</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5" dir="rtl">
            <label className="block text-[10px] text-muted text-right">שם עברי</label>
            {onAiSuggest && (
              <button
                onClick={runAiSuggest}
                disabled={aiThinking}
                className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full transition
                            ${aiThinking
                              ? 'dark:bg-emerald-950/40 bg-emerald-50 text-emerald-500'
                              : 'dark:bg-emerald-900/40 bg-emerald-100 text-emerald-700 dark:text-emerald-300 hover:brightness-105'}`}
                dir="rtl"
              >
                {aiThinking ? (
                  <>
                    <span>חושב</span>
                    <span className="inline-flex gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '900ms' }} />
                      <span className="w-1 h-1 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms', animationDuration: '900ms' }} />
                      <span className="w-1 h-1 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms', animationDuration: '900ms' }} />
                    </span>
                  </>
                ) : (
                  <>
                    <span>הצע שם</span>
                    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor" aria-hidden="true">
                      <path d="M12 2.5c.3 0 .55.2.63.48l1.28 4.53a3 3 0 0 0 2.07 2.07l4.54 1.28a.66.66 0 0 1 0 1.27l-4.54 1.28a3 3 0 0 0-2.07 2.07l-1.28 4.54a.66.66 0 0 1-1.27 0l-1.28-4.54a3 3 0 0 0-2.07-2.07L3.47 12.13a.66.66 0 0 1 0-1.27l4.54-1.28A3 3 0 0 0 10.09 7.5l1.28-4.53c.08-.28.33-.47.63-.47Z"/>
                    </svg>
                  </>
                )}
              </button>
            )}
          </div>
          <input value={he} onChange={e => setHe(e.target.value)} className="input-field !text-right !text-base !py-2.5" dir="rtl" />
        </div>
        <div>
          <label className="block text-[10px] text-muted mb-1 text-right" dir="rtl">English name</label>
          <input value={en} onChange={e => setEn(e.target.value)} className="input-field !text-left !text-sm !py-2" dir="ltr" placeholder="Barbell Bench Press — Medium Grip" />
        </div>
        <div>
          <label className="block text-[10px] text-muted mb-1 text-right" dir="rtl">שריר עיקרי</label>
          <div className="grid grid-cols-3 gap-1.5" dir="rtl">
            {/* Regular muscles + a distinct "אירובי" chip for cardio types */}
            {[...ACTIVE_MUSCLES, MUSCLE_BY_ID['aerobic']].map(m => {
              const c = MUSCLE_CLASSES[m.color];
              const active = m.id === muscle;
              return (
                <button
                  key={m.id}
                  onClick={() => setMuscle(m.id)}
                  className={`text-[11px] py-1.5 px-2 rounded ${active ? `${c.bg} ${c.text} ring-2 ${c.ring}` : 'dark:bg-slate-800 bg-slate-100 text-muted'}`}
                >{m.he}</button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="block text-[10px] text-muted mb-1 text-right" dir="rtl">כינויים (מופרדים בפסיק)</label>
          <input value={aliasesText} onChange={e => setAliasesText(e.target.value)} className="input-field !text-right !text-sm !py-2" dir="rtl" />
        </div>
        <div>
          <label className="block text-[10px] text-muted mb-1 text-right" dir="rtl">הערות</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="input-field !text-right !text-sm !py-2" dir="rtl" />
        </div>
        {/* Hold-time toggle */}
        <div className="card !p-3 !bg-transparent border dark:border-slate-800 border-slate-200" dir="rtl">
          <div className="flex items-start justify-between gap-3">
            <div className="text-right flex-1">
              <div className="text-sm font-semibold">תרגיל של זמן החזקה</div>
              <div className="text-[11px] text-muted mt-0.5">
                לתרגילים כמו פלאנק — במקום חזרות רושמים שניות של החזקה
              </div>
            </div>
            <button
              onClick={() => setIsHoldTime(v => !v)}
              role="switch"
              aria-checked={isHoldTime}
              className={`shrink-0 w-11 h-6 rounded-full relative transition-colors ${
                isHoldTime ? 'bg-emerald-500' : 'dark:bg-slate-700 bg-slate-300'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow ${
                  isHoldTime ? 'right-0.5' : 'right-[calc(100%-1.375rem)]'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
      <div className="p-4 border-t border-subtle">
        <button
          onClick={() => onSave({
            he: he.trim() || exercise.he,
            en: en.trim() || undefined,
            defaultMuscle: muscle,
            aliases: aliasesText.split(',').map(s => s.trim()).filter(Boolean),
            notes: notes.trim() || undefined,
            isHoldTime: isHoldTime || undefined,
          })}
          className="btn-primary w-full py-3 font-semibold"
        >שמור</button>
      </div>
    </div>
  );
}
