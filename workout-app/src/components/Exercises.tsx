import { useEffect, useMemo, useRef, useState } from 'react';
import type { Route } from '../types';
import type { MuscleGroup, MuscleParent } from '../data/muscles';
import { ACTIVE_MUSCLES, MUSCLE_BY_ID, MUSCLE_CLASSES, PARENT_INFO, musclesByParent } from '../data/muscles';
import { type PersonalExercise } from '../data/exercisesDB';
import { useFirestore } from '../hooks/useFirestore';
import { prepareMedia, exercisePhotoKey } from '../hooks/usePhotos';
import { CHAT_API_URL } from '../config/api';
import { AiChatPanel } from './AiChatPanel';
import { MigrateNames } from './MigrateNames';
import { TopBar } from './TopBar';

type Props = {
  uid: string;
  navigate: (route: Route) => void;
};

const PARENT_ORDER: MuscleParent[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];

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
  const [historyStats, setHistoryStats] = useState<Map<string, { count: number; lastTs: number; sessionsCount: number }>>(new Map());

  async function refresh() {
    const [exs, ps, sessions] = await Promise.all([
      firestore.listPersonalExercises(),
      firestore.getAllExercisePhotos(),
      firestore.getFreeSessions(),
    ]);
    setExercises(exs);
    setPhotos(ps);
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
        subtitle={exercises.length > 0 ? `${exercises.length} תרגילים` : undefined}
        accent="brand"
        tint="violet"
      />
      <div className="p-4 pb-4 max-w-lg mx-auto">

      {/* Top summary — proof that history is being logged */}
      {!loading && exercises.length > 0 && (
        <div className="card mb-4 text-right" dir="rtl">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[10px] text-muted-most uppercase tracking-widest font-semibold">היסטוריה</div>
            <div className="text-right">
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">{totalStats.sets}</span>
              <span className="text-xs text-muted mr-1.5">סטים נרשמו</span>
              <span className="text-muted-most mx-2">·</span>
              <span className="font-mono font-semibold">{totalStats.exercisesWithHistory}</span>
              <span className="text-xs text-muted mr-1.5">תרגילים עם היסטוריה</span>
            </div>
          </div>
        </div>
      )}

      {/* Action toolbar */}
      {!loading && (
        <div className="card mb-4 space-y-2" dir="rtl">
          <div className="text-[10px] text-muted-most text-right">פעולות</div>
          <div className="flex flex-wrap gap-2 justify-start">
            <button
              onClick={() => setMigrateOpen(true)}
              disabled={exercises.length === 0}
              className="text-[11px] btn-secondary !py-1.5 !px-3 disabled:opacity-50 text-emerald-600 dark:text-emerald-400"
            >
              ✨ AI: השלם ותקן שמות
            </button>
            <button
              onClick={() => setNamingChatOpen(true)}
              disabled={exercises.length === 0}
              className="text-[11px] btn-secondary !py-1.5 !px-3 disabled:opacity-50 text-violet-600 dark:text-violet-400"
            >
              ✎ שאל AI על שמות
            </button>
            <button
              onClick={() => setConfirmResetAll(true)}
              disabled={exercises.length === 0}
              className="text-[11px] btn-secondary !py-1.5 !px-3 disabled:opacity-50 text-red-500"
            >
              מחק הכל
            </button>
          </div>
        </div>
      )}

      {loading && <div className="text-muted text-center py-8">Loading...</div>}

      {!loading && exercises.length === 0 && !migrating && (
        <div className="card text-center py-6 text-muted text-sm" dir="rtl">
          עדיין אין תרגילים ברשימה שלך. הם ייבנו לבד ברגע שתתחיל לרשום סטים.
        </div>
      )}

      {!loading && exercises.length > 0 && PARENT_ORDER.map(parent => {
        const kids = grouped.get(parent) || [];
        if (kids.length === 0) return null;
        const info = PARENT_INFO[parent];
        return (
          <div key={parent} className="mb-4">
            <div className="text-right text-sm font-bold mb-2 pr-1" dir="rtl">
              {info.he} <span className="text-muted-most font-normal">({kids.length})</span>
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
          </div>
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
      <div className="flex flex-row-reverse items-center justify-between p-4 border-b border-subtle">
        <h2 className="font-bold text-lg" dir="rtl">עריכת תרגיל</h2>
        <button onClick={onClose} className="text-muted text-2xl">×</button>
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
            {ACTIVE_MUSCLES.map(m => {
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
      </div>
      <div className="p-4 border-t border-subtle">
        <button
          onClick={() => onSave({
            he: he.trim() || exercise.he,
            en: en.trim() || undefined,
            defaultMuscle: muscle,
            aliases: aliasesText.split(',').map(s => s.trim()).filter(Boolean),
            notes: notes.trim() || undefined,
          })}
          className="btn-primary w-full py-3 font-semibold"
        >שמור</button>
      </div>
    </div>
  );
}
