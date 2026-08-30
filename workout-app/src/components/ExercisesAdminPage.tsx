import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { isDbManagerEmail } from '../config/dbManagers';
import { isCoacherEmail } from '../config/coaches';
import { MUSCLES, PARENT_INFO, type MuscleGroup, type MuscleParent } from '../data/muscles';
import { exerciseIdOf, type PersonalExercise } from '../data/exercisesDB';
import { AdminNav } from './AdminNav';
import type { Route } from '../types';
import { CHAT_API_URL } from '../config/api';

// Desktop-only global + per-trainee exercise DB manager. Two modes:
//   scope.kind === 'global'   → writes the top-level `exercises` collection
//                                (every user is affected — red UI + confirm)
//   scope.kind === 'trainee'  → writes only that trainee's tree
//                                (personalExercises / exerciseOverrides / hidden)
// Sergio is both coacher AND db-manager. The sticky banner makes the scope
// obvious at every moment; each write path snapshots scope at modal-open
// time so a mid-edit switch can't misroute a save.

const MUSCLE_BY_ID = new Map(MUSCLES.map(m => [m.id, m]));
const PARENT_ORDER: MuscleParent[] = ['chest','back','shoulders','arms','legs','core','aerobic'];

function shortMuscleLabel(id: MuscleGroup): string {
  return MUSCLE_BY_ID.get(id)?.he || id;
}
function parentOf(id: MuscleGroup): MuscleParent | null {
  return MUSCLE_BY_ID.get(id)?.parent || null;
}

// Distinct muscle-parent tints for the badge — subtle, not gradient-y.
const PARENT_BADGE_TONE: Record<MuscleParent, string> = {
  chest:     'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
  back:      'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  shoulders: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  arms:      'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20',
  legs:      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  core:      'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25',
  aerobic:   'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
};

// ─── Scope model ──────────────────────────────────────────────────
type Scope =
  | { kind: 'global' }
  | { kind: 'trainee'; uid: string; name: string };

type TraineeRow = { uid: string; email?: string | null; displayName?: string | null };

function scopesEqual(a: Scope, b: Scope): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'global') return true;
  return a.uid === (b as any).uid;
}

// ─── Row + source badge ───────────────────────────────────────────
type Source = 'global' | 'personal' | 'override';
type Row = PersonalExercise & { source: Source };

// ─── Loaders ──────────────────────────────────────────────────────

async function loadGlobal(): Promise<Row[]> {
  const snap = await getDocs(collection(db, 'exercises'));
  return snap.docs.map(d => ({ ...(d.data() as any), id: d.id, source: 'global' as Source }))
    .sort((a, b) => (a.he || '').localeCompare(b.he || '', 'he'));
}

async function loadForTrainee(uid: string): Promise<Row[]> {
  const [gSnap, pSnap, ovSnap, hSnap] = await Promise.all([
    getDocs(collection(db, 'exercises')),
    getDocs(collection(db, 'users', uid, 'personalExercises')),
    getDocs(collection(db, 'users', uid, 'exerciseOverrides')),
    getDocs(collection(db, 'users', uid, 'hiddenPersonalExercises')),
  ]);
  const hidden = new Set(hSnap.docs.map(d => d.id));
  const overrides = new Map(ovSnap.docs.map(d => [d.id, d.data() as Partial<PersonalExercise>]));
  const out: Row[] = [];
  const seen = new Set<string>();
  for (const d of gSnap.docs) {
    const raw = d.data() as PersonalExercise;
    if (hidden.has(raw.id)) continue;
    const ov = overrides.get(raw.id);
    if (ov) out.push({ ...(raw as any), ...ov, id: raw.id, source: 'override' as Source });
    else    out.push({ ...(raw as any), id: raw.id, source: 'global' as Source });
    seen.add(raw.id);
  }
  for (const d of pSnap.docs) {
    const p = d.data() as PersonalExercise;
    if (hidden.has(p.id) || seen.has(p.id)) continue;
    out.push({ ...(p as any), id: p.id, source: 'personal' as Source });
  }
  return out.sort((a, b) => (a.he || '').localeCompare(b.he || '', 'he'));
}

// ─── Writers ──────────────────────────────────────────────────────

function cleanForWrite(ex: any): any {
  const { source: _drop, ...rest } = ex;
  void _drop;
  const clean: any = { ...rest, updatedAt: Date.now() };
  Object.keys(clean).forEach(k => { if (clean[k] === undefined) delete clean[k]; });
  return clean;
}

async function saveGlobal(next: PersonalExercise) {
  await setDoc(doc(db, 'exercises', next.id), cleanForWrite(next), { merge: true });
}

async function saveForTrainee(traineeUid: string, next: PersonalExercise, prevSource: Source | 'new') {
  if (prevSource === 'new' || prevSource === 'personal') {
    await setDoc(doc(db, 'users', traineeUid, 'personalExercises', next.id), cleanForWrite(next), { merge: true });
    return;
  }
  const [globalSnap, ovSnap] = await Promise.all([
    getDoc(doc(db, 'exercises', next.id)),
    getDoc(doc(db, 'users', traineeUid, 'exerciseOverrides', next.id)),
  ]);
  if (!globalSnap.exists()) {
    await setDoc(doc(db, 'users', traineeUid, 'personalExercises', next.id), cleanForWrite(next), { merge: true });
    return;
  }
  const base = globalSnap.data() as PersonalExercise;
  const diff: any = { updatedAt: Date.now() };
  for (const k of ['he','en','defaultMuscle','aliases','isHoldTime','notes','videoUrl','howTo','photoBase64'] as const) {
    const cur = (next as any)[k];
    const b = (base as any)[k];
    if (cur !== undefined && JSON.stringify(cur) !== JSON.stringify(b)) diff[k] = cur;
  }
  const prevOv = ovSnap.exists() ? (ovSnap.data() as any) : null;
  if (prevOv && prevOv.isAnchor !== undefined) diff.isAnchor = prevOv.isAnchor;
  Object.keys(diff).forEach(k => { if (diff[k] === undefined) delete diff[k]; });
  await setDoc(doc(db, 'users', traineeUid, 'exerciseOverrides', next.id), diff);
}

async function deleteGlobal(id: string) {
  await deleteDoc(doc(db, 'exercises', id));
}

async function deleteForTrainee(traineeUid: string, id: string, source: Source) {
  if (source === 'personal') {
    await deleteDoc(doc(db, 'users', traineeUid, 'personalExercises', id));
    return;
  }
  await setDoc(doc(db, 'users', traineeUid, 'hiddenPersonalExercises', id), { id, hiddenAt: Date.now() });
  try { await deleteDoc(doc(db, 'users', traineeUid, 'exerciseOverrides', id)); } catch { /* ok */ }
}

// ─── Confirm dialog (in-app) ──────────────────────────────────────

type Confirm = {
  title: string;
  body: React.ReactNode;
  danger?: boolean;   // red styling
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
};

function ConfirmDialog({ confirm, onClose }: { confirm: Confirm; onClose: () => void }) {
  const danger = !!confirm.danger;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="card max-w-sm w-full text-right shadow-xl"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        <h3 className={`font-bold text-lg mb-3 ${danger ? 'text-rose-600 dark:text-rose-400' : ''}`}>
          {confirm.title}
        </h3>
        <div className="text-sm text-muted mb-5 leading-relaxed">
          {confirm.body}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            {confirm.cancelLabel || 'ביטול'}
          </button>
          <button
            onClick={() => { confirm.onConfirm(); onClose(); }}
            className={`btn-primary flex-1 ${danger ? '!bg-rose-600 hover:!bg-rose-500' : ''}`}
          >
            {confirm.confirmLabel || 'אישור'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────

export function ExercisesAdminPage({ navigate }: { navigate: (r: Route) => void }) {
  const email = auth.currentUser?.email || '';
  const canGlobal = isDbManagerEmail(email);
  const authUid = auth.currentUser?.uid || '';

  const [trainees, setTrainees] = useState<TraineeRow[]>([]);
  const [traineesLoaded, setTraineesLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!authUid) return;
      try {
        const snap = await getDocs(collection(db, 'users_index'));
        if (cancelled) return;
        const list: TraineeRow[] = [];
        for (const d of snap.docs) {
          const data = d.data() as any;
          if (data?.coachUid === authUid) {
            list.push({ uid: d.id, email: data.email, displayName: data.displayName });
          }
        }
        setTrainees(list.sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '')));
      } catch { /* ok */ }
      setTraineesLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [authUid]);

  const [scope, setScope] = useState<Scope | null>(null);
  useEffect(() => {
    if (!traineesLoaded || scope) return;
    if (trainees.length > 0) {
      const t = trainees[0];
      setScope({ kind: 'trainee', uid: t.uid, name: t.displayName || t.email || t.uid });
    }
  }, [traineesLoaded, trainees, scope]);

  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState('');
  const [parentFilter, setParentFilter] = useState<MuscleParent | 'all'>('all');

  // `prefill` on an 'edit' session is only used to override the initial values
  // of the modal — happens when the AI panel hands off a merged proposal via
  // "ערוך תחילה". Absent for plain row edits.
  type ModalSession =
    | { kind: 'edit'; scope: Scope; row: Row | 'new'; prefill?: PersonalExercise }
    | { kind: 'ai'; scope: Scope };
  const [session, setSession] = useState<ModalSession | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  // Chat history per scope. Lifted here so closing the panel doesn't wipe
  // the conversation — reopening resumes exactly where you left off. Only
  // "שיחה חדשה" (or a scope switch) starts a fresh thread.
  const [chatByScope, setChatByScope] = useState<ChatByScope>(new Map());

  function getChatFor(s: Scope): ChatMsg[] {
    const key = scopeKey(s);
    const existing = chatByScope.get(key);
    if (existing && existing.length > 0) return existing;
    return [makeGreeting(s)];
  }

  function setChatFor(s: Scope, updater: React.SetStateAction<ChatMsg[]>) {
    setChatByScope(prev => {
      const key = scopeKey(s);
      const current = prev.get(key) ?? [makeGreeting(s)];
      const next = typeof updater === 'function' ? (updater as (m: ChatMsg[]) => ChatMsg[])(current) : updater;
      const map = new Map(prev);
      map.set(key, next);
      return map;
    });
  }

  function resetChatFor(s: Scope) {
    setChatByScope(prev => {
      const key = scopeKey(s);
      const map = new Map(prev);
      map.set(key, [makeGreeting(s)]);
      return map;
    });
  }

  const reload = useCallback(async () => {
    if (!scope) return;
    setLoaded(false);
    const list = scope.kind === 'global' ? await loadGlobal() : await loadForTrainee(scope.uid);
    setRows(list);
    setLoaded(true);
  }, [scope]);

  useEffect(() => { reload(); }, [reload]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const kept = rows.filter(r => {
      if (parentFilter !== 'all' && parentOf(r.defaultMuscle) !== parentFilter) return false;
      if (!needle) return true;
      return (r.he || '').toLowerCase().includes(needle)
        || (r.en || '').toLowerCase().includes(needle)
        || r.id.toLowerCase().includes(needle)
        || (r.aliases || []).some(a => a.toLowerCase().includes(needle));
    });
    // On "all" — group visually by parent muscle (parent order → Hebrew name).
    // On a single-group filter — plain alphabetical since every row shares
    // the same parent anyway.
    if (parentFilter === 'all') {
      return kept.slice().sort((a, b) => {
        const pa = parentOf(a.defaultMuscle);
        const pb = parentOf(b.defaultMuscle);
        const ia = pa ? PARENT_ORDER.indexOf(pa) : 999;
        const ib = pb ? PARENT_ORDER.indexOf(pb) : 999;
        if (ia !== ib) return ia - ib;
        return (a.he || '').localeCompare(b.he || '', 'he');
      });
    }
    return kept;
  }, [rows, q, parentFilter]);

  const perParentCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const p = parentOf(r.defaultMuscle) || 'other';
      map.set(p, (map.get(p) || 0) + 1);
    }
    return map;
  }, [rows]);

  // ─── Save flow ──────────────────────────────────────────────────
  async function performSave(next: PersonalExercise, prevRow: Row | 'new', targetScope: Scope) {
    if (targetScope.kind === 'global') {
      await saveGlobal(next);
    } else {
      await saveForTrainee(targetScope.uid, next, prevRow === 'new' ? 'new' : prevRow.source);
    }
    setSession(null);
    if (scope && scopesEqual(scope, targetScope)) await reload();
  }

  function requestSave(next: PersonalExercise, prevRow: Row | 'new', targetScope: Scope) {
    if (targetScope.kind === 'global') {
      setConfirm({
        title: 'שמירה למאגר המשותף',
        danger: true,
        body: (
          <>
            <div className="mb-2">
              עדכון של <b className="text-main">"{next.he}"</b> יחול על <b className="text-main">כל המשתמשים באפליקציה</b>.
            </div>
            <div className="text-[12px] text-muted-more">היסטוריית אימונים לא תשתנה — רק תגי השרירים, השם והוידאו יתעדכנו.</div>
          </>
        ),
        confirmLabel: 'שמור לכולם',
        onConfirm: () => { void performSave(next, prevRow, targetScope); },
      });
    } else {
      // Trainee scope — no confirm, just save.
      void performSave(next, prevRow, targetScope);
    }
  }

  function requestRemove(row: Row) {
    if (!scope) return;
    if (scope.kind === 'global') {
      setConfirm({
        title: 'מחיקה מהמאגר המשותף',
        danger: true,
        body: (
          <>
            <div className="mb-2">
              <b className="text-main">"{row.he}"</b> יימחק מהמאגר לכל המשתמשים.
            </div>
            <div className="text-[12px] text-muted-more">היסטוריית אימונים לא תיפגע, אבל השחזור לא טריוויאלי.</div>
          </>
        ),
        confirmLabel: 'מחק לכולם',
        onConfirm: async () => { await deleteGlobal(row.id); await reload(); },
      });
    } else {
      setConfirm({
        title: 'הסתרת תרגיל',
        body: (
          <>
            להסתיר את <b className="text-main">"{row.he}"</b> עבור <b className="text-main">{scope.name}</b>?
            <div className="text-[12px] text-muted-more mt-1">שאר המשתמשים לא מושפעים.</div>
          </>
        ),
        confirmLabel: 'הסתר',
        onConfirm: async () => { await deleteForTrainee(scope.uid, row.id, row.source); await reload(); },
      });
    }
  }

  function requestScopeSwitchToGlobal() {
    setConfirm({
      title: 'מעבר למאגר המשותף',
      danger: true,
      body: (
        <>
          במצב זה כל שינוי חל על <b className="text-main">כל המשתמשים באפליקציה</b>.
          <div className="text-[12px] text-muted-more mt-1">אפשר לחזור למתאמן ספציפי בכל רגע מהבחירה בבאנר.</div>
        </>
      ),
      confirmLabel: 'כן, למאגר המשותף',
      onConfirm: () => setScope({ kind: 'global' }),
    });
  }

  function startNew() {
    if (!scope) return;
    setSession({ kind: 'edit', scope, row: 'new' });
  }

  // ─── Empty / loading fallback ───────────────────────────────────
  if (!scope) {
    return (
      <div className="page-bg">
        <AdminNav current="exercises-admin" navigate={navigate} />
        <div className="max-w-2xl mx-auto p-6" dir="rtl">
          {!traineesLoaded ? (
            <div className="p-12 text-center text-muted-most text-sm">טוען…</div>
          ) : (
            <div className="card">
              <div className="font-bold mb-2">אין מתאמנים משויכים</div>
              <div className="text-sm text-muted mb-4">
                {canGlobal
                  ? 'אפשר לגשת ישירות למאגר המשותף של כל המשתמשים.'
                  : 'צריך לשייך מתאמנים דרך מסך המאמן.'}
              </div>
              {canGlobal && (
                <button
                  onClick={requestScopeSwitchToGlobal}
                  className="btn-primary !bg-rose-600 hover:!bg-rose-500"
                >
                  🌐 עבור למאגר המשותף
                </button>
              )}
            </div>
          )}
        </div>
        {confirm && <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />}
      </div>
    );
  }

  const isGlobal = scope.kind === 'global';

  return (
    <div className="page-bg">
      <AdminNav
        current="exercises-admin"
        navigate={navigate}
        onReload={reload}
        extraRight={(
          <button
            onClick={() => scope && setSession({ kind: 'ai', scope })}
            className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/40 hover:bg-violet-500/25 transition-colors"
            title="שאל את ה-AI"
          >
            🤖 AI Assist
          </button>
        )}
      />

      {/* Scope banner — red for global, blue for trainee */}
      <ScopeBanner
        scope={scope}
        canGlobal={canGlobal}
        trainees={trainees}
        onPickTrainee={t => setScope({ kind: 'trainee', uid: t.uid, name: t.displayName || t.email || t.uid })}
        onSwitchToGlobal={requestScopeSwitchToGlobal}
      />

      <div className="max-w-6xl mx-auto px-6 py-6" dir="rtl">
        {/* Title + primary action */}
        <div className="flex items-end justify-between mb-5 gap-4">
          <div>
            <h1 className="text-2xl font-bold leading-tight">
              {isGlobal ? 'מאגר תרגילים משותף' : `תרגילים של ${scope.name}`}
            </h1>
            <div className="text-[12px] text-muted mt-1">
              {rows.length} תרגילים · {isGlobal
                ? 'שינוי חל על כל המשתמשים באפליקציה'
                : 'שינוי נשמר רק עבור המתאמן'}
            </div>
          </div>
          <button
            onClick={startNew}
            className={`text-sm font-bold px-4 py-2.5 rounded-xl text-white transition-colors ${
              isGlobal ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            + תרגיל חדש
          </button>
        </div>

        {/* Filters — search + clickable muscle-group pills */}
        <div className="space-y-3 mb-5">
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="חיפוש בעברית או באנגלית…"
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-subtle bg-transparent dark:bg-slate-900/40 focus:border-emerald-500 outline-none transition-colors"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setParentFilter('all')}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                parentFilter === 'all'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                  : 'border-subtle text-muted hover:text-main hover:bg-slate-500/10'
              }`}
            >
              הכל <span className="opacity-60">({rows.length})</span>
            </button>
            {PARENT_ORDER.map(p => {
              const n = perParentCount.get(p) || 0;
              if (!n) return null;
              const active = parentFilter === p;
              const tone = PARENT_BADGE_TONE[p];
              return (
                <button
                  key={p}
                  onClick={() => setParentFilter(p)}
                  className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                    active ? tone : 'border-subtle text-muted hover:text-main hover:bg-slate-500/10'
                  }`}
                >
                  {PARENT_INFO[p].he} <span className="opacity-60">({n})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        <div className="card !p-0 overflow-hidden">
          {!loaded && <div className="p-12 text-center text-muted-most text-sm">טוען…</div>}
          {loaded && filtered.length === 0 && (
            <div className="p-12 text-center text-muted-most text-sm">
              {q ? 'אין תוצאות לחיפוש' : 'אין תרגילים בסינון הנוכחי'}
            </div>
          )}
          {loaded && filtered.length > 0 && (
            <table className="w-full text-sm table-fixed" dir="rtl">
              <colgroup>
                <col style={{ width: '44px' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '130px' }} />
                {scope.kind === 'trainee' && <col style={{ width: '80px' }} />}
                <col style={{ width: '160px' }} />
              </colgroup>
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-most border-b border-subtle dark:bg-slate-900/40 bg-slate-50">
                  <th className="text-right px-4 py-3 font-semibold"></th>
                  <th className="text-right px-4 py-3 font-semibold">שם (עברית)</th>
                  <th className="text-right px-4 py-3 font-semibold">Name (English)</th>
                  <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">שריר ראשי</th>
                  {scope.kind === 'trainee' && (
                    <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">מקור</th>
                  )}
                  <th className="text-right px-4 py-3 font-semibold">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const parent = parentOf(r.defaultMuscle);
                  const badgeTone = parent ? PARENT_BADGE_TONE[parent] : 'bg-slate-500/10 text-muted border-subtle';
                  return (
                    <tr
                      key={r.id}
                      className={`transition-colors hover:bg-slate-500/[.04] dark:hover:bg-slate-800/40 ${
                        i > 0 ? 'border-t border-subtle' : ''
                      }`}
                      title={`id: ${r.id}`}
                    >
                      <td className="px-4 py-3 align-middle">
                        <span className="text-lg">
                          {r.isHoldTime ? '⏱️' : parent === 'aerobic' ? '🏃' : '💪'}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="font-semibold text-main text-[14px] leading-tight truncate">{r.he}</div>
                      </td>
                      <td className="px-4 py-3 align-middle" dir="ltr">
                        {r.en
                          ? <div className="font-semibold text-main text-[14px] leading-tight truncate">{r.en}</div>
                          : <span className="text-muted-most">—</span>}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span className={`inline-block whitespace-nowrap text-[11px] font-semibold px-2 py-1 rounded-full border ${badgeTone}`}>
                          {shortMuscleLabel(r.defaultMuscle)}
                        </span>
                      </td>
                      {scope.kind === 'trainee' && (
                        <td className="px-4 py-3 align-middle">
                          <SourceBadge source={r.source} />
                        </td>
                      )}
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSession({ kind: 'edit', scope, row: r })}
                            className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-subtle text-muted hover:text-main hover:bg-slate-500/10 transition-colors"
                          >ערוך</button>
                          <button
                            onClick={() => requestRemove(r)}
                            className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >{isGlobal ? 'מחק' : 'הסתר'}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {session?.kind === 'edit' && (
        <EditExerciseModal
          scope={session.scope}
          exercise={session.prefill
            ? ({ ...(session.row === 'new' ? emptyExercise() : session.row), ...session.prefill, source: session.row === 'new' ? 'personal' : (session.row as Row).source } as Row)
            : (session.row === 'new' ? emptyExercise() : session.row)}
          isNew={session.row === 'new'}
          existingIds={new Set(rows.map(r => r.id))}
          onCancel={() => setSession(null)}
          onSave={next => requestSave(next, session.row, session.scope)}
        />
      )}

      {session?.kind === 'ai' && (
        <AiAssistPanel
          scope={session.scope}
          exercises={rows}
          messages={getChatFor(session.scope)}
          setMessages={updater => setChatFor(session.scope, updater)}
          onNewConversation={() => resetChatFor(session.scope)}
          onClose={() => setSession(null)}
          onApply={(next, prev) => requestSave(next, prev, session.scope)}
          onOpenEditor={(row, prefill) => {
            setSession({ kind: 'edit', scope: session.scope, row, prefill });
          }}
        />
      )}

      {confirm && <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

function emptyExercise(): Row {
  return {
    id: '',
    he: '',
    en: '',
    defaultMuscle: 'chest',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: 'personal',
  } as Row;
}

// ─── Scope banner ─────────────────────────────────────────────────

function ScopeBanner({
  scope, canGlobal, trainees, onPickTrainee, onSwitchToGlobal,
}: {
  scope: Scope;
  canGlobal: boolean;
  trainees: TraineeRow[];
  onPickTrainee: (t: TraineeRow) => void;
  onSwitchToGlobal: () => void;
}) {
  const isGlobal = scope.kind === 'global';
  return (
    <div
      className={`sticky top-[46px] z-10 border-b ${
        isGlobal
          ? 'bg-rose-500/10 border-rose-500/40'
          : 'bg-blue-500/[.06] border-blue-500/30'
      }`}
      dir="rtl"
    >
      <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center gap-3 text-[12px]">
        <span className="text-xl leading-none">{isGlobal ? '🌐' : '👤'}</span>
        <div className={`font-bold ${isGlobal ? 'text-rose-700 dark:text-rose-300' : 'text-blue-700 dark:text-blue-300'}`}>
          {isGlobal
            ? 'אתה עובד על המאגר המשותף — משפיע על כל המשתמשים'
            : `אתה עובד עבור: ${scope.name}`}
        </div>
        <div className="flex-1" />
        <select
          value={isGlobal ? '__global__' : scope.uid}
          onChange={e => {
            const v = e.target.value;
            if (v === '__global__') { onSwitchToGlobal(); return; }
            const t = trainees.find(x => x.uid === v);
            if (t) onPickTrainee(t);
          }}
          className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg border bg-transparent dark:bg-slate-900/60 transition-colors ${
            isGlobal ? 'border-rose-500/40 text-rose-700 dark:text-rose-300' : 'border-subtle'
          }`}
        >
          {trainees.map(t => (
            <option key={t.uid} value={t.uid}>👤 {t.displayName || t.email || t.uid}</option>
          ))}
          {canGlobal && <option value="__global__">🌐 מאגר משותף (כולם)</option>}
        </select>
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: Source }) {
  if (source === 'global')  return <span className="inline-block whitespace-nowrap text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-500/10 text-muted border border-subtle">משותף</span>;
  if (source === 'override') return <span className="inline-block whitespace-nowrap text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">שונה</span>;
  return <span className="inline-block whitespace-nowrap text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">אישי</span>;
}

// ─── Edit modal ───────────────────────────────────────────────────

function EditExerciseModal({
  scope, exercise, isNew, existingIds, onCancel, onSave,
}: {
  scope: Scope;
  exercise: Row;
  isNew: boolean;
  existingIds: Set<string>;
  onCancel: () => void;
  onSave: (ex: PersonalExercise) => void;
}) {
  const [he, setHe] = useState(exercise.he || '');
  const [en, setEn] = useState(exercise.en || '');
  const [defaultMuscle, setDefaultMuscle] = useState<MuscleGroup>(exercise.defaultMuscle);
  const [notes, setNotes] = useState(exercise.notes || '');
  const [videoUrl, setVideoUrl] = useState(exercise.videoUrl || '');
  const [photoBase64, setPhotoBase64] = useState<string | undefined>(exercise.photoBase64);
  const [howToSteps, setHowToSteps] = useState<string[]>(
    exercise.howTo && exercise.howTo.length ? exercise.howTo.slice() : ['']
  );
  const [isHoldTime, setIsHoldTime] = useState(!!exercise.isHoldTime);
  const [aliases, setAliases] = useState((exercise.aliases || []).join(', '));
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);

  const derivedId = useMemo(() => isNew ? exerciseIdOf(he) : exercise.id, [he, isNew, exercise.id]);
  const idConflict = isNew && derivedId && existingIds.has(derivedId);
  const canSave = he.trim() && defaultMuscle && !idConflict;

  async function onPickImage(file: File | null) {
    if (!file) return;
    setMediaError(null); setMediaBusy(true);
    try {
      const { isVideoFile, compressImage } = await import('../hooks/usePhotos');
      if (isVideoFile(file)) {
        // The trainee-side ExerciseVideo player only understands YouTube /
        // Vimeo / direct .mp4 URLs — not inline data URLs. Uploading a video
        // file would save fine but render as a broken "open link" in the
        // trainee's view. Push the coach toward a hosted URL instead.
        setMediaError('קובץ וידאו לא נתמך כרגע. הדבק קישור מיוטיוב, ווימאו, או mp4 ישיר בשדה למטה.');
        return;
      }
      const dataUrl = await compressImage(file, 640, 0.72);
      setPhotoBase64(dataUrl);
    } catch (e: any) {
      setMediaError(e?.message || 'שגיאה בטעינת הקובץ');
    } finally {
      setMediaBusy(false);
    }
  }

  function save() {
    if (!canSave) return;
    onSave({
      id: derivedId,
      he: he.trim(),
      en: en.trim() || undefined,
      defaultMuscle,
      notes: notes.trim() || undefined,
      videoUrl: videoUrl.trim() || undefined,
      photoBase64: photoBase64 || undefined,
      howTo: howToSteps.map(s => s.trim()).filter(Boolean),
      isHoldTime: isHoldTime || undefined,
      aliases: aliases.split(',').map(s => s.trim()).filter(Boolean),
      createdAt: exercise.createdAt || Date.now(),
      updatedAt: Date.now(),
    });
  }

  function addStep() { setHowToSteps(s => [...s, '']); }
  function updateStep(i: number, v: string) { setHowToSteps(s => s.map((x, k) => k === i ? v : x)); }
  function removeStep(i: number) { setHowToSteps(s => s.length > 1 ? s.filter((_, k) => k !== i) : ['']); }

  const isGlobal = scope.kind === 'global';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/50 p-4 overflow-y-auto"
      onClick={onCancel}
    >
      <div
        className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl !p-0"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-subtle">
          <div>
            <div className="text-[11px] text-muted-most font-semibold uppercase tracking-wider">
              {isNew ? 'תרגיל חדש' : 'עריכה'}
            </div>
            <h2 className="text-lg font-bold mt-0.5">
              {isNew ? 'הוספת תרגיל' : exercise.he}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="text-2xl text-muted hover:text-main leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-500/10"
            aria-label="סגור"
          >×</button>
        </div>

        {/* Scope indicator */}
        <div className={`px-6 py-3 border-b ${
          isGlobal
            ? 'bg-rose-500/[.06] border-rose-500/30 text-rose-700 dark:text-rose-300'
            : 'bg-blue-500/[.04] border-blue-500/20 text-blue-700 dark:text-blue-300'
        }`}>
          <div className="text-[12px] font-semibold flex items-center gap-2">
            <span className="text-base">{isGlobal ? '🌐' : '👤'}</span>
            <span>
              {isGlobal
                ? 'שמירה תחול על כל המשתמשים'
                : `שמירה תחול על: ${scope.kind === 'trainee' ? scope.name : ''}`}
            </span>
          </div>
        </div>

        {/* Fields */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="שם בעברית" required>
              <input type="text" value={he} onChange={e => setHe(e.target.value)} className={inputCls} placeholder="לדוגמה: פולאובר" />
            </Field>
            <Field label="שם באנגלית">
              <input type="text" value={en} onChange={e => setEn(e.target.value)} className={inputCls} dir="ltr" placeholder="Pullover" />
            </Field>
          </div>

          {idConflict && (
            <div className="text-[11px] text-rose-500 font-semibold flex items-center gap-1">
              ⚠️ קיים כבר תרגיל בשם זהה — בחר שם אחר
            </div>
          )}

          <Field label="שריר ראשי" required>
            <MusclePicker value={defaultMuscle} onChange={setDefaultMuscle} />
          </Field>

          <Field label="שמות נוספים" hint="מופרדים בפסיק — משמשים לחיפוש. לדוגמה: פולאובר, סקווטים">
            <input type="text" value={aliases} onChange={e => setAliases(e.target.value)} className={inputCls} placeholder="פולאובר משקולת, פולאובר משוכב" />
          </Field>

          {/* Image upload */}
          <div>
            <label className="flex items-baseline gap-1.5 text-[11px] font-semibold text-muted mb-1.5">
              <span>תמונה</span>
              <span className="text-muted-most font-normal">— מוצגת בכרטיס התרגיל, נדחסת אוטומטית</span>
            </label>
            <div className="rounded-xl border border-subtle bg-slate-500/[.03] p-3">
              <div className="flex items-center gap-3">
                {photoBase64 ? (
                  <img src={photoBase64} alt="preview" className="w-20 h-20 rounded-lg object-cover border border-subtle shrink-0" />
                ) : (
                  <div className="w-20 h-20 rounded-lg border border-dashed border-subtle flex items-center justify-center text-2xl text-muted-most shrink-0">🖼️</div>
                )}
                <div className="flex-1 flex items-center gap-2 flex-wrap">
                  <label className="text-[11px] font-semibold px-3 py-2 rounded-lg border border-subtle cursor-pointer hover:bg-slate-500/10 transition-colors">
                    {mediaBusy ? 'טוען…' : (photoBase64 ? 'החלף תמונה' : 'העלה תמונה')}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={mediaBusy}
                      onChange={e => { const f = e.target.files?.[0]; if (f) void onPickImage(f); e.target.value = ''; }}
                    />
                  </label>
                  {photoBase64 && (
                    <button
                      onClick={() => setPhotoBase64(undefined)}
                      className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline"
                    >הסר</button>
                  )}
                </div>
              </div>
              {mediaError && (
                <div className="text-[11px] text-rose-500 mt-2">{mediaError}</div>
              )}
            </div>
          </div>

          {/* Video URL — YouTube / Vimeo / direct .mp4 */}
          <Field
            label="קישור לוידאו"
            hint="יוטיוב, ווימאו, או קובץ mp4 ישיר — נטמע בעמוד התרגיל. העלאת קובץ וידאו לא נתמכת."
          >
            <input
              type="url"
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/…  |  https://vimeo.com/…  |  https://…/clip.mp4"
              className={inputCls}
              dir="ltr"
            />
            {videoUrl && (
              <div className="text-[10px] text-muted-most mt-1">
                {/(?:youtu\.be|youtube\.com)/.test(videoUrl) ? '✓ יוטיוב — יוטמע בנגן'
                  : /vimeo\.com/.test(videoUrl) ? '✓ ווימאו — יוטמע בנגן'
                  : /\.(mp4|webm|mov)(\?|$)/i.test(videoUrl) ? '✓ קובץ ישיר — יוטמע כנגן HTML5'
                  : '⚠️ מקור לא מזוהה — יוצג כקישור "פתח וידאו"'}
              </div>
            )}
          </Field>

          <Field label="הערות">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className={inputCls + ' min-h-[70px]'} placeholder="הערות פנימיות, טיפים וכו׳ (אופציונלי)" />
          </Field>

          {/* HowTo — one input per step so the coach never has to type the
              numbers and the visual makes clear each row is one step. */}
          <div>
            <label className="flex items-baseline gap-1.5 text-[11px] font-semibold text-muted mb-1.5">
              <span>שלבי ביצוע</span>
              <span className="text-muted-most font-normal">— אל תוסיף מספרים, הם ימוספרו אוטומטית</span>
            </label>
            <div className="rounded-xl border border-subtle bg-slate-500/[.03] p-2 space-y-1.5">
              {howToSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex items-center justify-center shrink-0 mt-1">
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    value={step}
                    onChange={e => updateStep(i, e.target.value)}
                    placeholder={i === 0 ? 'עמוד ישר, אחוז במוט…' : 'המשך…'}
                    className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-subtle bg-transparent dark:bg-slate-900/60 outline-none focus:border-emerald-500"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (i === howToSteps.length - 1) addStep();
                      }
                    }}
                  />
                  <button
                    onClick={() => removeStep(i)}
                    className="w-7 h-7 rounded-full text-muted-most hover:text-rose-500 hover:bg-rose-500/10 text-lg leading-none mt-0.5"
                    title="הסר שלב"
                    aria-label="הסר שלב"
                  >×</button>
                </div>
              ))}
              <button
                onClick={addStep}
                className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline mt-1"
              >+ הוסף שלב</button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isHoldTime} onChange={e => setIsHoldTime(e.target.checked)} className="w-4 h-4 rounded" />
            <span>תרגיל זמן (שניות במקום חזרות)</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-subtle dark:bg-slate-900/40 bg-slate-50">
          <button onClick={onCancel} className="btn-secondary !py-2 !px-4 !text-sm">ביטול</button>
          <button
            onClick={save}
            disabled={!canSave}
            className={`btn-primary !py-2 !px-4 !text-sm !rounded-xl disabled:opacity-40 disabled:cursor-not-allowed ${
              isGlobal ? '!bg-rose-600 hover:!bg-rose-500' : ''
            }`}
          >
            {isNew ? 'צור' : 'שמור'} {isGlobal ? '· לכולם' : `· ל-${scope.kind === 'trainee' ? scope.name : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2.5 text-sm rounded-xl border border-subtle bg-transparent dark:bg-slate-900/60 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors';

// Two-level muscle picker: parent-group tabs on top, specific muscles below.
// Beats a native <select> for four reasons:
//   • Everything visible in one glance — no dropdown to open.
//   • Parent tabs colored the same as the table badges, so muscle→group is
//     immediately readable.
//   • Handles the aerobic edge case cleanly: aerobic is its own parent AND
//     its own leaf, so the tab click auto-selects it without a chip row.
//   • Selecting an exercise whose defaultMuscle is 'aerobic' (or any legacy
//     value) actually reflects on the picker, instead of the native <select>
//     falling back to its first option because the option wasn't rendered.
function MusclePicker({
  value, onChange,
}: {
  value: MuscleGroup;
  onChange: (m: MuscleGroup) => void;
}) {
  const activeParent = MUSCLE_BY_ID.get(value)?.parent ?? 'chest';
  return (
    <div className="rounded-xl border border-subtle bg-slate-500/[.03] p-2 space-y-2">
      {/* Parent-group tabs */}
      <div className="flex flex-wrap gap-1">
        {PARENT_ORDER.map(p => {
          const active = p === activeParent;
          const tone = PARENT_BADGE_TONE[p];
          // Aerobic parent = aerobic leaf. Clicking it selects aerobic
          // directly instead of parking on the tab without a leaf choice.
          const onClick = () => {
            if (p === 'aerobic') { onChange('aerobic'); return; }
            if (p === activeParent) return;
            // Switching parent: pick the first non-legacy leaf of that group
            // so the value never gets stuck on the OLD parent.
            const first = MUSCLES.find(m => m.parent === p && !m.legacy);
            if (first) onChange(first.id);
          };
          return (
            <button
              key={p}
              onClick={onClick}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                active ? tone : 'border-subtle text-muted hover:text-main hover:bg-slate-500/10'
              }`}
            >
              {PARENT_INFO[p].he}
            </button>
          );
        })}
      </div>

      {/* Leaf muscles for the active parent. Aerobic has no leaves — its
          selection is the tab itself, so we skip this row entirely. */}
      {activeParent !== 'aerobic' && (
        <div className="flex flex-wrap gap-1 pt-2 border-t border-subtle/60">
          {MUSCLES
            .filter(m => m.parent === activeParent && !m.legacy)
            .map(m => {
              const active = m.id === value;
              return (
                <button
                  key={m.id}
                  onClick={() => onChange(m.id)}
                  className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                      : 'border-subtle text-muted hover:text-main hover:bg-slate-500/10'
                  }`}
                >
                  {m.he}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-baseline gap-1.5 text-[11px] font-semibold text-muted mb-1.5">
        <span>{label}</span>
        {required && <span className="text-rose-500">*</span>}
        {hint && <span className="text-muted-most font-normal">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

// ─── AI assist panel — CONVERSATIONAL ─────────────────────────────
// Multi-turn chat. Each user turn is sent with the full prior conversation.
// The assistant reply is either plain text ("clarify: which pullover?") or a
// PROPOSAL — a structured patch that renders inline as an actionable card
// with three buttons: ערוך (open the full editor pre-filled), דחה (log it
// and continue), אשר (write it now). After apply/edit-approve the panel
// stays open and posts a system message ("✓ בוצע") so Sergio can keep
// working the same catalog without reopening the panel.

type AiProposal = {
  id: string;
  mode: 'new' | 'update';
  reasoning: string;
  patch: Partial<PersonalExercise>;
};

type ChatMsg =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'assistant'; kind: 'text'; text: string }
  | { id: number; role: 'assistant'; kind: 'proposal'; proposal: AiProposal; status: 'pending' | 'applied' | 'rejected' | 'edited' }
  | { id: number; role: 'system'; text: string };

// A chat conversation, keyed by scope so switching scopes doesn't leak
// context between trainees. Lifted to the parent so the panel can be
// closed + reopened without losing history — only "שיחה חדשה" clears it.
type ChatByScope = Map<string, ChatMsg[]>;

let __msgSeq = 0;
function nextMsgId(): number { return ++__msgSeq; }

function scopeKey(s: Scope): string { return s.kind === 'global' ? '__global__' : `trainee:${s.uid}`; }
function makeGreeting(scope: Scope): ChatMsg {
  return {
    id: nextMsgId(),
    role: 'assistant',
    kind: 'text',
    text: scope.kind === 'global'
      ? 'שלום. אני העוזר לניהול המאגר המשותף. מה לתקן / להוסיף?'
      : `שלום. אני עוזר לך לנהל את התרגילים של ${scope.name}. מה נעשה?`,
  };
}

const REVIEW_URL = `${CHAT_API_URL}/api/exercise-review`;

function AiAssistPanel({
  scope, exercises, messages, setMessages, onNewConversation, onClose, onApply, onOpenEditor,
}: {
  scope: Scope;
  exercises: Row[];
  messages: ChatMsg[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMsg[]>>;
  onNewConversation: () => void;
  onClose: () => void;
  onApply: (ex: PersonalExercise, prev: Row | 'new') => void;
  onOpenEditor: (row: Row | 'new', prefill: PersonalExercise) => void;
}) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, loading]);

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    setError(null);
    setInput('');
    const userMsg: ChatMsg = { id: nextMsgId(), role: 'user', text: q };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);
    try {
      const convo = nextMessages
        .filter(m => m.role === 'user' || (m.role === 'assistant' && m.kind === 'text'))
        .map(m => ({
          role: m.role,
          content: m.role === 'user' ? m.text : (m as any).text,
        }));
      const res = await fetch(REVIEW_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: convo,
          exercises: exercises.map(e => ({
            id: e.id, he: e.he, en: e.en, defaultMuscle: e.defaultMuscle,
          })),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.type === 'text') {
        setMessages(m => [...m, { id: nextMsgId(), role: 'assistant', kind: 'text', text: String(data.text || '') }]);
      } else if (data.type === 'proposal') {
        const idStr = String(data.id || '');
        const mode: 'new' | 'update' = data.mode === 'new' || idStr === '__new__' ? 'new' : 'update';
        setMessages(m => [...m, {
          id: nextMsgId(),
          role: 'assistant',
          kind: 'proposal',
          status: 'pending',
          proposal: {
            id: idStr,
            mode,
            reasoning: String(data.reasoning || ''),
            patch: data.patch || {},
          },
        }]);
      } else {
        throw new Error('תשובה לא צפויה');
      }
    } catch (e: any) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  function markProposalStatus(msgId: number, status: 'applied' | 'rejected' | 'edited') {
    setMessages(m => m.map(x => x.id === msgId && x.role === 'assistant' && x.kind === 'proposal' ? { ...x, status } : x));
  }

  function pushSystem(text: string) {
    setMessages(m => [...m, { id: nextMsgId(), role: 'system', text }]);
  }

  function buildNextFromProposal(proposal: AiProposal): { next: PersonalExercise; prev: Row | 'new' } | null {
    if (proposal.mode === 'new' || proposal.id === '__new__') {
      const patch = proposal.patch || {};
      const he = String(patch.he || '').trim();
      if (!he || !patch.defaultMuscle) {
        setError('הצעה חדשה — חסרים he או defaultMuscle');
        return null;
      }
      const newId = exerciseIdOf(he);
      // Catch collision: an existing exercise with the same slug is already
      // in the catalog. Push a system message to the chat and refuse — the
      // coach can then ask the AI to update instead of adding a duplicate.
      if (exercises.some(e => e.id === newId)) {
        pushSystem(`התרגיל "${he}" כבר קיים במאגר. שאל את ה-AI לעדכן אותו במקום להוסיף חדש.`);
        return null;
      }
      const next: PersonalExercise = {
        id: newId,
        he,
        en: patch.en || undefined,
        defaultMuscle: patch.defaultMuscle as MuscleGroup,
        notes: patch.notes || undefined,
        videoUrl: patch.videoUrl || undefined,
        aliases: patch.aliases || undefined,
        howTo: patch.howTo || undefined,
        isHoldTime: patch.isHoldTime || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      return { next, prev: 'new' };
    }
    if (!proposal.id) {
      setError('ה-AI לא זיהה תרגיל מהמאגר');
      return null;
    }
    const target = exercises.find(e => e.id === proposal.id);
    if (!target) {
      setError(`תרגיל ${proposal.id} לא נמצא במאגר הנוכחי`);
      return null;
    }
    const { source: _drop, ...targetClean } = target;
    void _drop;
    const next: PersonalExercise = {
      ...(targetClean as PersonalExercise),
      ...proposal.patch,
      id: target.id,
      updatedAt: Date.now(),
    };
    return { next, prev: target };
  }

  function approveProposal(msgId: number, proposal: AiProposal) {
    const built = buildNextFromProposal(proposal);
    if (!built) return;
    onApply(built.next, built.prev);
    markProposalStatus(msgId, 'applied');
    pushSystem(`✓ ${proposal.id === '__new__' ? 'נוסף' : 'עודכן'}: ${built.next.he}`);
  }

  function editProposal(msgId: number, proposal: AiProposal) {
    const built = buildNextFromProposal(proposal);
    if (!built) return;
    // Hand off to the shared EditExerciseModal — pre-filled with the proposal
    // merged over the target row. On save that modal fires the same
    // requestSave path so scope-confirms still apply.
    // NOTE: onOpenEditor replaces the current modal session with an 'edit'
    // one, so we do NOT call onClose() here — that would race and null out
    // the session immediately after we set it.
    markProposalStatus(msgId, 'edited');
    onOpenEditor(built.prev, built.next);
  }

  function rejectProposal(msgId: number) {
    markProposalStatus(msgId, 'rejected');
    pushSystem('דחית את ההצעה. תגיד לי מה לתקן וננסה שוב.');
  }

  const isGlobal = scope.kind === 'global';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl flex flex-col shadow-xl !p-0"
        style={{ height: 'min(85vh, 720px)' }}
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-subtle shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center text-xl shrink-0">🤖</div>
            <div>
              <h2 className="text-lg font-bold leading-tight">עוזר AI לניהול מאגר</h2>
              <div className="text-[11px] text-muted-most mt-0.5">שאל בשפה חופשית, ההצעות מופיעות בצ׳אט</div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => {
                if (messages.length <= 1) return;
                onNewConversation();
              }}
              disabled={messages.length <= 1}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-subtle text-muted hover:text-main hover:bg-slate-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
              title="התחל שיחה חדשה"
            >
              שיחה חדשה
            </button>
            <button
              onClick={onClose}
              className="text-2xl text-muted hover:text-main leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-500/10"
              title="סגור"
            >×</button>
          </div>
        </div>

        {/* Scope indicator */}
        <div className={`px-6 py-2.5 border-b shrink-0 ${
          isGlobal
            ? 'bg-rose-500/[.08] border-rose-500/30 text-rose-700 dark:text-rose-300'
            : 'bg-blue-500/[.06] border-blue-500/20 text-blue-700 dark:text-blue-300'
        }`}>
          <div className="text-[12px] font-semibold flex items-center gap-2">
            <span className="text-base">{isGlobal ? '🌐' : '👤'}</span>
            <span>
              {isGlobal
                ? 'כל אישור משנה את המאגר לכל המשתמשים'
                : `שינויים חלים על: ${scope.kind === 'trainee' ? scope.name : ''}`}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map(m => (
            <MessageBubble
              key={m.id}
              msg={m}
              isGlobal={isGlobal}
              scopeName={scope.kind === 'trainee' ? scope.name : ''}
              exerciseById={new Map(exercises.map(e => [e.id, e]))}
              onApprove={p => approveProposal(m.id, p)}
              onEdit={p => editProposal(m.id, p)}
              onReject={() => rejectProposal(m.id)}
            />
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-bl-md bg-slate-500/10 text-muted text-sm">
                <TypingDots />
              </div>
            </div>
          )}
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-600 dark:text-rose-400">
              שגיאה: {error}
            </div>
          )}
        </div>

        {/* Suggestion chips (only until the first user turn) */}
        {messages.filter(m => m.role === 'user').length === 0 && (
          <div className="px-4 pb-2 shrink-0">
            <div className="flex flex-wrap gap-1.5">
              <ExampleChip onClick={() => setInput('פולאובר צריך להיות שריר גב, לא חזה')}>פולאובר → גב</ExampleChip>
              <ExampleChip onClick={() => setInput('דדליפט - השריר הראשי הוא ישבן')}>דדליפט → ישבן</ExampleChip>
              <ExampleChip onClick={() => setInput('הוסף תרגיל: הרמת חזה בכיסא רומי לגב תחתון')}>הוסף Roman Chair</ExampleChip>
            </div>
          </div>
        )}

        {/* Composer */}
        <div className="border-t border-subtle p-3 shrink-0 dark:bg-slate-900/40 bg-slate-50">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="שאל בעברית או אנגלית… (Enter לשליחה, Shift+Enter לשורה חדשה)"
              rows={1}
              className={inputCls + ' resize-none min-h-[44px] max-h-[160px]'}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="text-sm font-bold px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              שלח
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Chat message bubble ──────────────────────────────────────────

function MessageBubble({
  msg, isGlobal, scopeName, exerciseById, onApprove, onEdit, onReject,
}: {
  msg: ChatMsg;
  isGlobal: boolean;
  scopeName: string;
  exerciseById: Map<string, Row>;
  onApprove: (p: AiProposal) => void;
  onEdit: (p: AiProposal) => void;
  onReject: () => void;
}) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-br-md bg-violet-600 text-white text-sm whitespace-pre-wrap break-words">
          {msg.text}
        </div>
      </div>
    );
  }
  if (msg.role === 'system') {
    return (
      <div className="flex justify-center">
        <div className="text-[11px] text-muted-most px-2 py-1 rounded-full bg-slate-500/[.06]">
          {msg.text}
        </div>
      </div>
    );
  }
  if (msg.kind === 'text') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-bl-md dark:bg-slate-800 bg-slate-100 text-sm whitespace-pre-wrap break-words">
          {msg.text}
        </div>
      </div>
    );
  }
  // Proposal card
  const p = msg.proposal;
  const isNew = p.mode === 'new' || p.id === '__new__';
  const target = isNew ? null : exerciseById.get(p.id);
  const cardTone = isGlobal
    ? 'bg-rose-500/[.05] border-rose-500/30'
    : 'bg-emerald-500/[.05] border-emerald-500/30';
  const badgeTone = isGlobal ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400';
  const done = msg.status !== 'pending';
  const doneLabel: Record<Exclude<typeof msg.status, 'pending'>, string> = {
    applied: '✓ הוחל',
    edited: '✎ נערך והוחל',
    rejected: '✕ נדחה',
  };

  return (
    <div className="flex justify-start">
      <div className={`max-w-[92%] w-full rounded-2xl rounded-bl-md border p-4 ${cardTone} ${done ? 'opacity-60' : ''}`}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
            isNew ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
          }`}>
            {isNew ? '＋ תרגיל חדש' : '✎ עדכון בלבד'}
          </span>
          {target && (
            <span className="text-[12px] font-semibold text-main truncate">{target.he}</span>
          )}
          {done && (
            <span className={`ms-auto text-[10px] font-bold ${badgeTone}`}>
              {doneLabel[msg.status as Exclude<typeof msg.status, 'pending'>]}
            </span>
          )}
        </div>

        {p.reasoning && (
          <div className="text-[12px] text-main mb-3 leading-relaxed">{p.reasoning}</div>
        )}

        {/* Body — full for new, patch-diff for update */}
        {isNew
          ? <FullExerciseCard patch={p.patch} />
          : <PatchDiffCard patch={p.patch} target={target || undefined} />}

        {!done && (
          <div className="flex items-center gap-1.5 justify-end mt-3 pt-3 border-t border-subtle/60">
            <button
              onClick={onReject}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-subtle text-muted hover:text-main hover:bg-slate-500/10"
            >דחה</button>
            <button
              onClick={() => onEdit(p)}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-subtle text-main hover:bg-slate-500/10"
            >ערוך תחילה</button>
            <button
              onClick={() => onApprove(p)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-lg text-white ${
                isGlobal ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {isGlobal ? 'אשר · לכולם' : `אשר · ל-${scopeName}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Proposal body — new exercise (full box, all fields) ──────────

function FullExerciseCard({ patch }: { patch: Partial<PersonalExercise> }) {
  const he = patch.he || '';
  const en = patch.en || '';
  const muscle = patch.defaultMuscle as MuscleGroup | undefined;
  const parent = muscle ? parentOf(muscle) : null;
  const badgeTone = parent ? PARENT_BADGE_TONE[parent] : 'bg-slate-500/10 text-muted border-subtle';
  const aliases = patch.aliases || [];
  const howTo = patch.howTo || [];

  return (
    <div className="space-y-3 text-[12px]">
      {/* Names */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="dark:bg-slate-950/40 bg-white/70 rounded-lg px-3 py-2 border border-subtle">
          <div className="text-[10px] font-semibold text-muted-most mb-0.5">שם בעברית</div>
          <div className="font-bold text-main truncate">{he || '—'}</div>
        </div>
        <div className="dark:bg-slate-950/40 bg-white/70 rounded-lg px-3 py-2 border border-subtle" dir="ltr">
          <div className="text-[10px] font-semibold text-muted-most mb-0.5">English name</div>
          <div className="font-bold text-main truncate">{en || '—'}</div>
        </div>
      </div>

      {/* Muscle */}
      {muscle && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-muted-most">שריר ראשי:</span>
          <span className={`inline-block whitespace-nowrap text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badgeTone}`}>
            {shortMuscleLabel(muscle)}
          </span>
          {patch.isHoldTime && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
              תרגיל זמן ⏱
            </span>
          )}
        </div>
      )}

      {/* Aliases */}
      {aliases.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-muted-most mb-1">שמות נוספים</div>
          <div className="flex flex-wrap gap-1">
            {aliases.map((a, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 rounded-full border border-subtle bg-slate-500/[.06] text-main">{a}</span>
            ))}
          </div>
        </div>
      )}

      {/* HowTo steps */}
      {howTo.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-muted-most mb-1.5">שלבי ביצוע</div>
          <ol className="space-y-1.5">
            {howTo.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-main leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {patch.notes && (
        <div>
          <div className="text-[10px] font-semibold text-muted-most mb-1">הערות</div>
          <div className="text-main leading-relaxed">{patch.notes}</div>
        </div>
      )}
    </div>
  );
}

// ─── Proposal body — update (only changed fields) ─────────────────

function PatchDiffCard({ patch, target }: { patch: Partial<PersonalExercise>; target?: Row }) {
  const rows = Object.entries(patch).filter(([k]) => k !== 'howTo' || (Array.isArray(patch.howTo) && patch.howTo.length > 0));
  if (rows.length === 0) {
    return <div className="text-[12px] text-muted-most italic">אין שדות לשנות</div>;
  }
  return (
    <div className="space-y-1.5 text-[12px]">
      {rows.map(([k, v]) => {
        const before = target ? (target as any)[k] : undefined;
        const displayNew = k === 'defaultMuscle' && typeof v === 'string'
          ? shortMuscleLabel(v as MuscleGroup)
          : Array.isArray(v) ? v.join(k === 'howTo' ? '\n' : ', ')
          : typeof v === 'boolean' ? (v ? 'כן' : 'לא')
          : String(v || '');
        const displayOld = k === 'defaultMuscle' && typeof before === 'string'
          ? shortMuscleLabel(before as MuscleGroup)
          : Array.isArray(before) ? before.join(', ')
          : typeof before === 'boolean' ? (before ? 'כן' : 'לא')
          : before ? String(before) : '';
        const label = HE_FIELD_LABEL[k] || k;
        return (
          <div key={k} className="dark:bg-slate-950/40 bg-white/70 rounded-lg px-3 py-2 border border-subtle">
            <div className="text-[10px] font-semibold text-muted-most mb-1">{label}</div>
            {displayOld && (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-muted-most shrink-0">היה:</span>
                <span className="text-muted line-through truncate">{displayOld}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-emerald-600 dark:text-emerald-400 shrink-0">→</span>
              <span className="font-bold text-main whitespace-pre-wrap break-words">{displayNew}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const HE_FIELD_LABEL: Record<string, string> = {
  he: 'שם בעברית',
  en: 'שם באנגלית',
  defaultMuscle: 'שריר ראשי',
  aliases: 'שמות נוספים',
  howTo: 'שלבי ביצוע',
  notes: 'הערות',
  videoUrl: 'קישור לוידאו',
  isHoldTime: 'תרגיל זמן',
};

function TypingDots() {
  // Container is dir=rtl so DOM order 1→2→3 renders right→left visually.
  // Dots go LEFT→RIGHT: the leftmost dot pulses FIRST, walking IN toward the
  // "חושב" label. Reads as "the thought is arriving at the word", not
  // "spreading away from it".
  return (
    <span className="inline-flex items-center gap-1.5" aria-label="חושב" dir="rtl">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">חושב</span>
      <span className="w-2 h-2 rounded-full bg-slate-500 dark:bg-slate-400 animate-bounce" style={{ animationDelay: '240ms' }} />
      <span className="w-2 h-2 rounded-full bg-slate-500 dark:bg-slate-400 animate-bounce" style={{ animationDelay: '120ms' }} />
      <span className="w-2 h-2 rounded-full bg-slate-500 dark:bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
    </span>
  );
}

function ExampleChip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="text-[11px] px-2 py-1 rounded-full border border-subtle text-muted hover:text-main hover:bg-slate-500/10 transition-colors"
    >
      {children}
    </button>
  );
}

// ─── Access gate ──────────────────────────────────────────────────
export function canOpenExercisesAdmin(): boolean {
  const email = auth.currentUser?.email;
  return isDbManagerEmail(email) || isCoacherEmail(email);
}
