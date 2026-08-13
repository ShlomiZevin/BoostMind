import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { Route, FreeSession as FreeSessionType, FreeSet, PlannedExercise, SupersetPair, AerobicEntry } from '../types';
import type { MuscleGroup } from '../data/muscles';
import { MUSCLE_BY_ID, MUSCLE_CLASSES } from '../data/muscles';
import { useFirestore } from '../hooks/useFirestore';
import { useTimer } from '../hooks/useTimer';
import { LogSetModal } from './LogSetModal';
import { AiChatPanel } from './AiChatPanel';
import { AerobicModal } from './AerobicModal';
import { MovePlanModal } from './MovePlanModal';
import { findPersonalByName, exerciseIdOf, type PersonalExercise } from '../data/exercisesDB';
import { TopBar } from './TopBar';
import { Chronograph } from './Chronograph';
import aiCoachIcon from '../assets/ai-coach.png';

type Props = {
  uid: string;
  sessionId: string;
  navigate: (route: Route) => void;
  historical?: boolean;   // when true: viewing/editing a past session (no rest timer, no AI chat)
};

const DEFAULT_REST_SECONDS = 30;
function getUserDefaultRest(): number {
  try {
    const v = Number(localStorage.getItem('scoreboard:defaultRestSec'));
    if (v >= 15 && v <= 600) return v;
  } catch { /* ignore */ }
  return DEFAULT_REST_SECONDS;
}

type ModalMode = { kind: 'add'; muscle?: MuscleGroup; exerciseName?: string }
              | { kind: 'edit'; set: FreeSet }
              | { kind: 'dup'; set: FreeSet }
              | { kind: 'pick' }
              | { kind: 'replace'; oldName: string; muscle: MuscleGroup };

// Superset color palette — one color per unique ss id in a session, chosen from this rotating set.
type SsColor = { border: string; badgeBg: string; badgeText: string; stripe: string; label: string };
const SS_PALETTE: SsColor[] = [
  { border: 'border-indigo-500', badgeBg: 'bg-indigo-500/15', badgeText: 'text-indigo-700 dark:text-indigo-300', stripe: 'bg-indigo-500', label: 'A' },
  { border: 'border-purple-500', badgeBg: 'bg-purple-500/15', badgeText: 'text-purple-700 dark:text-purple-300', stripe: 'bg-purple-500', label: 'B' },
  { border: 'border-pink-500', badgeBg: 'bg-pink-500/15', badgeText: 'text-pink-700 dark:text-pink-300', stripe: 'bg-pink-500', label: 'C' },
  { border: 'border-teal-500', badgeBg: 'bg-teal-500/15', badgeText: 'text-teal-700 dark:text-teal-300', stripe: 'bg-teal-500', label: 'D' },
  { border: 'border-orange-500', badgeBg: 'bg-orange-500/15', badgeText: 'text-orange-700 dark:text-orange-300', stripe: 'bg-orange-500', label: 'E' },
];
function newSsId(): string { return `ss_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`; }
function pairKey(a: string, b: string): string { return a < b ? `${a}__${b}` : `${b}__${a}`; }

export function FreeSession({ uid, sessionId, navigate, historical }: Props) {
  const firestore = useFirestore(uid);
  const timer = useTimer();

  const [session, setSession] = useState<FreeSessionType | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [allPastSets, setAllPastSets] = useState<FreeSet[]>([]);
  const [personalExercises, setPersonalExercises] = useState<PersonalExercise[]>([]);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInitialPrompt, setChatInitialPrompt] = useState<string | undefined>(undefined);
  const [chatReplaceCtx, setChatReplaceCtx] = useState<{ name: string; muscle: MuscleGroup } | undefined>(undefined);
  const [chatNewThread, setChatNewThread] = useState(false);
  const chatKeyRef = useRef(0);
  const [confirmDeleteSetId, setConfirmDeleteSetId] = useState<string | null>(null);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState(false);
  // Superset state
  const [supersetPairs, setSupersetPairs] = useState<SupersetPair[]>([]);
  // Inline link mode — user tapped 🔗 on this exercise, other cards show "+ קשר" so the user
  // picks a partner by tapping. sourceSsId = existing group id when extending, else null (new).
  const [linkFrom, setLinkFrom] = useState<{ sourceName: string; sourceSsId: string | null } | null>(null);
  const [hiddenPairSuggestions, setHiddenPairSuggestions] = useState<Set<string>>(new Set());

  async function completeLinkTo(targetName: string) {
    if (!linkFrom) return;
    const source = linkFrom.sourceName;
    setLinkFrom(null);
    await linkExercises(source, targetName);
  }
  // Aerobic state
  const [aerobicModal, setAerobicModal] = useState<{ editing?: AerobicEntry } | null>(null);
  const [movePlanOpen, setMovePlanOpen] = useState(false);
  const [confirmDeleteAerobicId, setConfirmDeleteAerobicId] = useState<string | null>(null);
  // Set to true when the finish-session prompt is asking about aerobic — if user hits "add" we
  // reopen the aerobic modal and re-open the finish prompt afterward.
  const [addAerobicFromFinish, setAddAerobicFromFinish] = useState(false);

  useEffect(() => {
    (async () => {
      const [s, all, exs, pairs] = await Promise.all([
        firestore.getFreeSession(sessionId),
        firestore.getFreeSessions(),
        firestore.listPersonalExercises(),
        firestore.listSupersetPairs(),
      ]);
      setSession(s);
      setPersonalExercises(exs);
      setSupersetPairs(pairs);
      const past: FreeSet[] = [];
      for (const sess of all) {
        if (sess.id === sessionId) continue;
        for (const set of sess.sets) past.push(set);
      }
      setAllPastSets(past);
      setLoading(false);
      // If Home queued the AI-per-day flow, open the chat empty — user types their own prompt.
      try {
        if (sessionStorage.getItem('ai:openOnLoad')) {
          sessionStorage.removeItem('ai:openOnLoad');
          setChatInitialPrompt(undefined);
          setChatNewThread(true);
          chatKeyRef.current += 1;
          setChatOpen(true);
        }
      } catch { /* ignore */ }
    })();
  }, [sessionId]);

  const setsByMuscle = useMemo(() => {
    const map = new Map<MuscleGroup, FreeSet[]>();
    if (!session) return map;
    for (const s of session.sets) {
      const arr = map.get(s.muscle) || [];
      arr.push(s);
      map.set(s.muscle, arr);
    }
    return map;
  }, [session]);

  // Group sets by (muscle, exerciseName) — same exercise stacks into one card.
  // Newest group first; sets within a group are chronological.
  type SetGroup = { muscle: MuscleGroup; exerciseName: string; sets: FreeSet[]; latestTs: number };
  const groupedSets = useMemo<SetGroup[]>(() => {
    if (!session) return [];
    const groups = new Map<string, SetGroup>();
    for (const s of session.sets) {
      const key = `${s.muscle}::${(s.exerciseName || '').toLowerCase()}`;
      let g = groups.get(key);
      if (!g) {
        g = { muscle: s.muscle, exerciseName: s.exerciseName || '', sets: [], latestTs: 0 };
        groups.set(key, g);
      }
      g.sets.push(s);
      if (s.timestamp > g.latestTs) g.latestTs = s.timestamp;
    }
    const arr = Array.from(groups.values());
    arr.forEach(g => g.sets.sort((a, b) => a.timestamp - b.timestamp));
    // Effective ranking timestamp: for groups in a superset, use the MAX latestTs across ALL
    // members of that superset. That way, when any member gets a new set, the whole group
    // moves together to the top — never leaves behind its partners.
    const ssMaxTs = new Map<string, number>();
    for (const g of arr) {
      const ss = g.sets.find(s => s.supersetGroup)?.supersetGroup;
      if (!ss) continue;
      const prev = ssMaxTs.get(ss) || 0;
      if (g.latestTs > prev) ssMaxTs.set(ss, g.latestTs);
    }
    const rankTs = (g: SetGroup) => {
      const ss = g.sets.find(s => s.supersetGroup)?.supersetGroup;
      return ss ? (ssMaxTs.get(ss) || g.latestTs) : g.latestTs;
    };
    arr.sort((a, b) => rankTs(b) - rankTs(a));
    // Move each superset partner to sit immediately after the first group of its superset,
    // ordered by supersetOrder (the user's explicit link order). Fallback to arr order.
    const seenSs = new Set<string>();
    const out: SetGroup[] = [];
    const orderOf = (g: SetGroup) => g.sets.find(s => typeof s.supersetOrder === 'number')?.supersetOrder ?? 9999;
    for (const g of arr) {
      const gSs = (g.sets.find(s => s.supersetGroup) || {}).supersetGroup;
      if (!gSs || seenSs.has(gSs)) { out.push(g); if (gSs) seenSs.add(gSs); continue; }
      seenSs.add(gSs);
      const members = arr.filter(p => (p.sets.find(s => s.supersetGroup) || {}).supersetGroup === gSs);
      members.sort((a, b) => orderOf(a) - orderOf(b));
      for (const m of members) out.push(m);
    }
    // Filter out duplicates (partners we already appended)
    const seen = new Set<SetGroup>();
    return out.filter(g => { if (seen.has(g)) return false; seen.add(g); return true; });
  }, [session]);

  // Assign a stable palette color to each unique superset id encountered in this session.
  // First-seen id gets palette[0] (indigo, label 'A'), next gets palette[1], etc.
  // Counts BOTH logged groups AND planned entries so plan-time links share the same colors.
  const ssColorById = useMemo(() => {
    const map = new Map<string, SsColor>();
    if (!session) return map;
    let idx = 0;
    const seen = new Set<string>();
    const consider = (ss?: string) => {
      if (!ss || seen.has(ss)) return;
      seen.add(ss);
      map.set(ss, SS_PALETTE[idx % SS_PALETTE.length]);
      idx++;
    };
    for (const g of groupedSets) consider(g.sets.find(s => s.supersetGroup)?.supersetGroup);
    for (const p of (session.plannedExercises || [])) consider(p.supersetGroup);
    return map;
  }, [groupedSets, session]);

  // Group id → count of linked exercises → used for "1/2" badge.
  // Includes planned entries that don't have logged sets yet.
  const ssMemberCount = useMemo(() => {
    const c = new Map<string, number>();
    if (!session) return c;
    const loggedNames = new Set<string>();
    for (const g of groupedSets) {
      const ss = g.sets.find(s => s.supersetGroup)?.supersetGroup;
      if (ss) c.set(ss, (c.get(ss) || 0) + 1);
      if (g.exerciseName) loggedNames.add(g.exerciseName.trim().toLowerCase());
    }
    for (const p of (session.plannedExercises || [])) {
      if (!p.supersetGroup) continue;
      // Only count planned entries that DON'T also have logged sets (avoid double-counting).
      if (loggedNames.has(p.name.trim().toLowerCase())) continue;
      c.set(p.supersetGroup, (c.get(p.supersetGroup) || 0) + 1);
    }
    return c;
  }, [groupedSets, session]);

  async function handleAddPlannedExercise(name: string, muscle: MuscleGroup, en?: string, isHoldTime?: boolean) {
    if (!session) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    // Resolve to canonical personal exercise (avoids duplicates)
    const ensured = await firestore.ensurePersonalExercise(trimmed, muscle, en, isHoldTime);
    const canonical = ensured?.he || trimmed;
    const finalMuscle = ensured?.defaultMuscle || muscle;
    // Add muscle to focus
    let sessionMuscles = session.muscleGroups;
    if (!sessionMuscles.includes(finalMuscle)) {
      sessionMuscles = [...sessionMuscles, finalMuscle];
      await firestore.updateFreeSessionMuscles(session.id, sessionMuscles);
    }
    // Update planned list (skip if already planned or already logged)
    const nameKey = canonical.toLowerCase();
    const alreadyLogged = session.sets.some(s => (s.exerciseName || '').toLowerCase() === nameKey);
    const alreadyPlanned = (session.plannedExercises || []).some(p => p.name.toLowerCase() === nameKey);
    let newPlanned = session.plannedExercises || [];
    if (!alreadyLogged && !alreadyPlanned) {
      newPlanned = [...newPlanned, { name: canonical, muscle: finalMuscle, addedAt: Date.now() }];
      await firestore.updatePlannedExercises(session.id, newPlanned);
    }
    // Refresh personal cache in case new entry was created
    const exs = await firestore.listPersonalExercises();
    setPersonalExercises(exs);
    setSession({ ...session, muscleGroups: sessionMuscles, plannedExercises: newPlanned });
  }

  async function handleRemovePlanned(name: string) {
    if (!session) return;
    const newPlanned = (session.plannedExercises || []).filter(p => p.name.toLowerCase() !== name.toLowerCase());
    await firestore.updatePlannedExercises(session.id, newPlanned);
    setSession({ ...session, plannedExercises: newPlanned });
  }

  async function handleSaveSet(partial: Omit<FreeSet, 'id' | 'timestamp'>, editingId?: string) {
    if (!session) return;

    // Auto-add muscle to session focus if new
    let sessionMuscles = session.muscleGroups;
    if (!sessionMuscles.includes(partial.muscle)) {
      sessionMuscles = [...sessionMuscles, partial.muscle];
      await firestore.updateFreeSessionMuscles(session.id, sessionMuscles);
    }

    // Auto-create a personal exercise entry when a new name shows up
    if (partial.exerciseName && partial.exerciseName.trim()) {
      await firestore.ensurePersonalExercise(partial.exerciseName.trim(), partial.muscle);
    }

    // Remove from planned list if it was there (now becomes a real logged exercise)
    let newPlanned = session.plannedExercises || [];
    if (partial.exerciseName) {
      const nameKey = partial.exerciseName.trim().toLowerCase();
      const before = newPlanned.length;
      newPlanned = newPlanned.filter(p => p.name.toLowerCase() !== nameKey);
      if (newPlanned.length !== before) {
        await firestore.updatePlannedExercises(session.id, newPlanned);
      }
    }

    const oldSet = editingId ? session.sets.find(s => s.id === editingId) : null;
    const wasPlaceholder = !!oldSet && oldSet.weight === 0 && oldSet.reps === 0;
    const isPlaceholderNow = partial.weight === 0 && partial.reps === 0;

    let newSets: FreeSet[];
    if (editingId) {
      newSets = session.sets.map(s => s.id === editingId
        ? { ...s, ...partial, id: s.id, timestamp: s.timestamp }
        : s);
      await firestore.updateFreeSets(session.id, newSets);
    } else {
      // If this new set is for an exercise that was planned as part of a superset, inherit that
      // superset group id so the first logged set lands inside the planned superset visually.
      let inheritedSs: string | undefined;
      if (partial.exerciseName) {
        const nameLc = partial.exerciseName.trim().toLowerCase();
        const planned = (session.plannedExercises || []).find(p => p.name.trim().toLowerCase() === nameLc);
        if (planned?.supersetGroup) inheritedSs = planned.supersetGroup;
      }
      const set: FreeSet = {
        ...partial,
        id: `s_${Date.now()}`,
        timestamp: Date.now(),
        ...(inheritedSs ? { supersetGroup: inheritedSs } : {}),
      };
      newSets = [...session.sets, set];
      await firestore.logFreeSet(session.id, set);
    }

    setSession({ ...session, muscleGroups: sessionMuscles, sets: newSets, plannedExercises: newPlanned });
    setModal(null);

    // Start timer when: new real set OR completing a placeholder into a real set.
    // BUT if this exercise is in a superset, only start the timer when EVERY member of the
    // superset has caught up to the same round-count (or higher). Rest belongs at round-end.
    let shouldStartTimer = !isPlaceholderNow && (!editingId || wasPlaceholder);
    if (shouldStartTimer && partial.exerciseName) {
      const nameLc = partial.exerciseName.trim().toLowerCase();
      // Find the ss id of the exercise we just logged (may be inherited from planned).
      const ssId = newSets.find(s => (s.exerciseName || '').trim().toLowerCase() === nameLc)?.supersetGroup
        || newPlanned.find(p => p.name.trim().toLowerCase() === nameLc)?.supersetGroup;
      if (ssId) {
        // Collect all distinct exercise names in this superset (sets + planned).
        const memberNames = new Set<string>();
        for (const s of newSets) if (s.supersetGroup === ssId && s.exerciseName) memberNames.add(s.exerciseName.trim().toLowerCase());
        for (const p of newPlanned) if (p.supersetGroup === ssId) memberNames.add(p.name.trim().toLowerCase());
        if (memberNames.size >= 2) {
          const realSetCountFor = (nm: string) =>
            newSets.filter(s => (s.exerciseName || '').trim().toLowerCase() === nm && (s.weight > 0 || s.reps > 0)).length;
          const counts = [...memberNames].map(realSetCountFor);
          const minCount = Math.min(...counts);
          const allEqual = counts.every(c => c === counts[0]);
          // Round complete only when every member has the same non-zero count.
          // (i.e. the set we just logged brought the "slowest" member up to match everyone else.)
          if (!(allEqual && minCount > 0)) shouldStartTimer = false;
        }
      }
    }
    if (shouldStartTimer) {
      timer.start(getUserDefaultRest());
      // Jump to top so the user sees the just-saved set + the scoreboard.
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function openChatWith(
    prompt?: string,
    replaceCtx?: { name: string; muscle: MuscleGroup },
    startFresh?: boolean,
  ) {
    setChatInitialPrompt(prompt);
    setChatReplaceCtx(replaceCtx);
    setChatNewThread(!!startFresh);
    chatKeyRef.current += 1;
    setChatOpen(true);
  }

  async function handleReplacePlanned(oldName: string, newName: string, muscle: MuscleGroup, en?: string, isHoldTime?: boolean) {
    if (!session) return;
    const nameKey = oldName.toLowerCase();
    // Safety: real sets logged → don't replace, fall back to add.
    const hasSets = session.sets.some(s => (s.exerciseName || '').toLowerCase() === nameKey);
    if (hasSets) {
      await handleAddPlannedExercise(newName, muscle, en, isHoldTime);
      return;
    }
    // Resolve new exercise to canonical (avoids duplicates)
    const trimmed = newName.trim();
    if (!trimmed) return;
    const ensured = await firestore.ensurePersonalExercise(trimmed, muscle, en, isHoldTime);
    const canonical = ensured?.he || trimmed;
    const finalMuscle = ensured?.defaultMuscle || muscle;

    // Add new muscle to focus if needed
    let sessionMuscles = session.muscleGroups;
    if (!sessionMuscles.includes(finalMuscle)) {
      sessionMuscles = [...sessionMuscles, finalMuscle];
      await firestore.updateFreeSessionMuscles(session.id, sessionMuscles);
    }

    // Atomic: build final planned list in one write.
    const withoutOld = (session.plannedExercises || []).filter(p => p.name.toLowerCase() !== nameKey);
    const alreadyPlanned = withoutOld.some(p => p.name.toLowerCase() === canonical.toLowerCase());
    const finalPlanned = alreadyPlanned
      ? withoutOld
      : [...withoutOld, { name: canonical, muscle: finalMuscle, addedAt: Date.now() }];
    await firestore.updatePlannedExercises(session.id, finalPlanned);

    const exs = await firestore.listPersonalExercises();
    setPersonalExercises(exs);
    setSession({ ...session, muscleGroups: sessionMuscles, plannedExercises: finalPlanned });
  }

  // ─── Aerobic entries ───────────────────────────────────────────
  async function handleSaveAerobic(partial: Omit<AerobicEntry, 'id' | 'timestamp'>, editingId?: string) {
    if (!session) return;
    const list = session.aerobicEntries || [];
    let next: AerobicEntry[];
    if (editingId) {
      next = list.map(e => e.id === editingId ? { ...e, ...partial, id: e.id, timestamp: e.timestamp } : e);
    } else {
      const entry: AerobicEntry = { ...partial, id: `a_${Date.now()}`, timestamp: Date.now() };
      next = [...list, entry];
    }
    await firestore.setAerobicEntries(session.id, next);
    setSession({ ...session, aerobicEntries: next });
    setAerobicModal(null);
    // If we opened this from the finish flow, reopen the finish prompt so user can continue.
    if (addAerobicFromFinish) {
      setAddAerobicFromFinish(false);
      setConfirmFinish(true);
    }
  }
  async function handleDeleteAerobic(entryId: string) {
    if (!session) return;
    const next = (session.aerobicEntries || []).filter(e => e.id !== entryId);
    await firestore.setAerobicEntries(session.id, next);
    setSession({ ...session, aerobicEntries: next });
  }

  async function handleDeleteSet(setId: string) {
    if (!session) return;
    const deletedSet = session.sets.find(s => s.id === setId);
    const newSets = session.sets.filter(s => s.id !== setId);
    // If deleting this set removed the LAST set of that exercise, we DON'T want the exercise
    // itself to disappear from the card list — a deleted set shouldn't erase the whole entry.
    // Convert the exercise back to a planned entry so it stays visible.
    let newPlanned = session.plannedExercises || [];
    if (deletedSet?.exerciseName) {
      const nameLc = deletedSet.exerciseName.trim().toLowerCase();
      const stillHasSets = newSets.some(s => (s.exerciseName || '').trim().toLowerCase() === nameLc);
      const alreadyPlanned = newPlanned.some(p => p.name.trim().toLowerCase() === nameLc);
      if (!stillHasSets && !alreadyPlanned) {
        newPlanned = [
          ...newPlanned,
          {
            name: deletedSet.exerciseName,
            muscle: deletedSet.muscle,
            addedAt: Date.now(),
            ...(deletedSet.supersetGroup ? { supersetGroup: deletedSet.supersetGroup } : {}),
          },
        ];
        await firestore.updatePlannedExercises(session.id, newPlanned);
      }
    }
    await firestore.updateFreeSets(session.id, newSets);
    setSession({ ...session, sets: newSets, plannedExercises: newPlanned });
  }

  // ─── Superset link / unlink ───────────────────────────────────────
  // Get the current superset id of a group's sets, if any.
  function groupSsId(g: { sets: FreeSet[] }): string | null {
    return g.sets.find(s => s.supersetGroup)?.supersetGroup || null;
  }

  // Apply a superset id + order to an exercise across BOTH sets and planned entries (by name).
  function applySsIdToExercise(sets: FreeSet[], planned: PlannedExercise[], nameLc: string, ssId: string, order?: number) {
    const newSets = sets.map(s => (s.exerciseName || '').trim().toLowerCase() === nameLc
      ? { ...s, supersetGroup: ssId, ...(order != null ? { supersetOrder: order } : {}) } : s);
    const newPlanned = planned.map(p => p.name.trim().toLowerCase() === nameLc
      ? { ...p, supersetGroup: ssId, ...(order != null ? { supersetOrder: order } : {}) } : p);
    return { newSets, newPlanned };
  }

  // Highest supersetOrder currently in the group (across sets + planned). Defaults to 0.
  function maxOrderInSs(sets: FreeSet[], planned: PlannedExercise[], ssId: string): number {
    let m = 0;
    for (const s of sets) if (s.supersetGroup === ssId && typeof s.supersetOrder === 'number') m = Math.max(m, s.supersetOrder);
    for (const p of planned) if (p.supersetGroup === ssId && typeof p.supersetOrder === 'number') m = Math.max(m, p.supersetOrder);
    return m;
  }
  // Current supersetOrder of an exercise (by name) in a given ss group, or null if unset.
  function orderOfExercise(sets: FreeSet[], planned: PlannedExercise[], ssId: string, nameLc: string): number | null {
    for (const s of sets) if (s.supersetGroup === ssId && (s.exerciseName || '').trim().toLowerCase() === nameLc && typeof s.supersetOrder === 'number') return s.supersetOrder;
    for (const p of planned) if (p.supersetGroup === ssId && p.name.trim().toLowerCase() === nameLc && typeof p.supersetOrder === 'number') return p.supersetOrder;
    return null;
  }

  // The one and only "link" primitive. Handles:
  //   • fresh source + fresh target → new ss id, both get it
  //   • fresh source + existing-in-group target → source joins target's group
  //   • existing-source + fresh target → target joins source's group
  //   • existing-source (same group as target) → no-op
  async function linkExercises(sourceName: string, targetName: string) {
    if (!session || sourceName.trim().toLowerCase() === targetName.trim().toLowerCase()) return;
    const src = sourceName.trim().toLowerCase();
    const tgt = targetName.trim().toLowerCase();
    const findSs = (name: string): string | null => {
      const inSets = session.sets.find(s => (s.exerciseName || '').trim().toLowerCase() === name);
      if (inSets?.supersetGroup) return inSets.supersetGroup;
      const inPlanned = (session.plannedExercises || []).find(p => p.name.trim().toLowerCase() === name);
      return inPlanned?.supersetGroup || null;
    };
    const srcSs = findSs(src);
    const tgtSs = findSs(tgt);
    if (srcSs && tgtSs && srcSs === tgtSs) return; // already linked

    // Decide which id to keep: prefer any existing (target first, then source), else new.
    const ssId = tgtSs || srcSs || newSsId();

    let sets = session.sets;
    let planned = session.plannedExercises || [];
    // Compute order for source: keep existing if any; else it becomes #1.
    const srcExistingOrder = orderOfExercise(sets, planned, ssId, src);
    const srcOrder = srcExistingOrder ?? (maxOrderInSs(sets, planned, ssId) + 1);
    ({ newSets: sets, newPlanned: planned } = applySsIdToExercise(sets, planned, src, ssId, srcOrder));
    // Target: keep existing if it was already in group; else appended after everyone else.
    const tgtExistingOrder = orderOfExercise(sets, planned, ssId, tgt);
    const tgtOrder = tgtExistingOrder ?? (maxOrderInSs(sets, planned, ssId) + 1);
    ({ newSets: sets, newPlanned: planned } = applySsIdToExercise(sets, planned, tgt, ssId, tgtOrder));

    await firestore.updateFreeSets(session.id, sets);
    await firestore.updatePlannedExercises(session.id, planned);
    setSession({ ...session, sets, plannedExercises: planned });

    // Record pair(s): new/joined exercise with all other members of the group.
    const partnerId = exerciseIdOf(targetName);
    const memberIds = new Set<string>();
    for (const s of sets) {
      if (s.supersetGroup === ssId && s.exerciseName) {
        const id = exerciseIdOf(s.exerciseName);
        if (id && id !== partnerId) memberIds.add(id);
      }
    }
    for (const p of planned) {
      if (p.supersetGroup === ssId) {
        const id = exerciseIdOf(p.name);
        if (id && id !== partnerId) memberIds.add(id);
      }
    }
    if (partnerId) {
      for (const otherId of memberIds) await firestore.recordSupersetPair(partnerId, otherId);
      const pairs = await firestore.listSupersetPairs();
      setSupersetPairs(pairs);
    }
  }

  // Strip a supersetGroup id from EVERY set + planned entry that carries it. Used to auto-clean
  // when a superset shrinks to a single member (no such thing as a superset of 1).
  function stripSsId(sets: FreeSet[], planned: PlannedExercise[], ssId: string) {
    const newSets = sets.map(s => {
      if (s.supersetGroup !== ssId) return s;
      const { supersetGroup: _, ...rest } = s;
      return rest as FreeSet;
    });
    const newPlanned = planned.map(p => {
      if (p.supersetGroup !== ssId) return p;
      const { supersetGroup: _, ...rest } = p;
      return rest as PlannedExercise;
    });
    return { sets: newSets, planned: newPlanned };
  }
  // Count how many distinct exercises the given ssId currently spans (sets + planned combined).
  function ssMemberCountIn(sets: FreeSet[], planned: PlannedExercise[], ssId: string): number {
    const names = new Set<string>();
    for (const s of sets) if (s.supersetGroup === ssId && s.exerciseName) names.add(s.exerciseName.trim().toLowerCase());
    for (const p of planned) if (p.supersetGroup === ssId) names.add(p.name.trim().toLowerCase());
    return names.size;
  }

  // Unlink a single exercise from its group (removes supersetGroup only from that exercise's items).
  // If the group had 2 members, the OTHER one is auto-unlinked too (no such thing as a superset of 1).
  async function unlinkExercise(name: string) {
    if (!session) return;
    const lc = name.trim().toLowerCase();
    const targetSet = session.sets.find(s => (s.exerciseName || '').trim().toLowerCase() === lc);
    const targetPlanned = (session.plannedExercises || []).find(p => p.name.trim().toLowerCase() === lc);
    const ssId = targetSet?.supersetGroup || targetPlanned?.supersetGroup;
    let sets = session.sets.map(s => {
      if ((s.exerciseName || '').trim().toLowerCase() !== lc) return s;
      const { supersetGroup: _, ...rest } = s;
      return rest as FreeSet;
    });
    let planned = (session.plannedExercises || []).map(p => {
      if (p.name.trim().toLowerCase() !== lc) return p;
      const { supersetGroup: _, ...rest } = p;
      return rest as PlannedExercise;
    });
    // If only 1 member remains in that ss, strip it too — no lone-wolf supersets.
    if (ssId && ssMemberCountIn(sets, planned, ssId) < 2) {
      ({ sets, planned } = stripSsId(sets, planned, ssId));
    }
    await firestore.updateFreeSets(session.id, sets);
    await firestore.updatePlannedExercises(session.id, planned);
    setSession({ ...session, sets, plannedExercises: planned });
  }

  // Move an exercise up or down within its superset — swaps supersetOrder with the neighbor.
  async function reorderInSuperset(exerciseName: string, direction: 'up' | 'down') {
    if (!session) return;
    const lc = exerciseName.trim().toLowerCase();
    const setMatch = session.sets.find(s => (s.exerciseName || '').trim().toLowerCase() === lc);
    const plannedMatch = (session.plannedExercises || []).find(p => p.name.trim().toLowerCase() === lc);
    const ssId = setMatch?.supersetGroup || plannedMatch?.supersetGroup;
    if (!ssId) return;
    const myOrder = orderOfExercise(session.sets, session.plannedExercises || [], ssId, lc);
    if (myOrder == null) return;
    // Find the neighbor at the adjacent order position.
    const target = direction === 'up' ? myOrder - 1 : myOrder + 1;
    // Gather all members (name → order)
    const members: Array<{ name: string; order: number }> = [];
    const seenNames = new Set<string>();
    for (const s of session.sets) {
      if (s.supersetGroup !== ssId || !s.exerciseName || typeof s.supersetOrder !== 'number') continue;
      const nm = s.exerciseName.trim();
      if (seenNames.has(nm.toLowerCase())) continue;
      seenNames.add(nm.toLowerCase());
      members.push({ name: nm, order: s.supersetOrder });
    }
    for (const p of (session.plannedExercises || [])) {
      if (p.supersetGroup !== ssId || typeof p.supersetOrder !== 'number') continue;
      const nm = p.name.trim();
      if (seenNames.has(nm.toLowerCase())) continue;
      seenNames.add(nm.toLowerCase());
      members.push({ name: nm, order: p.supersetOrder });
    }
    const neighbor = members.find(m => m.order === target);
    if (!neighbor) return;
    // Swap: my order → target; neighbor's order → myOrder
    let sets = session.sets;
    let planned = session.plannedExercises || [];
    ({ newSets: sets, newPlanned: planned } = applySsIdToExercise(sets, planned, lc, ssId, target));
    ({ newSets: sets, newPlanned: planned } = applySsIdToExercise(sets, planned, neighbor.name.trim().toLowerCase(), ssId, myOrder));
    await firestore.updateFreeSets(session.id, sets);
    await firestore.updatePlannedExercises(session.id, planned);
    setSession({ ...session, sets, plannedExercises: planned });
  }

  // Unlink an ENTIRE superset (removes ss id from every set/planned entry that carries it).
  async function unlinkWholeSuperset(ssId: string) {
    if (!session) return;
    const sets = session.sets.map(s => {
      if (s.supersetGroup !== ssId) return s;
      const { supersetGroup: _, ...rest } = s;
      return rest as FreeSet;
    });
    const planned = (session.plannedExercises || []).map(p => {
      if (p.supersetGroup !== ssId) return p;
      const { supersetGroup: _, ...rest } = p;
      return rest as PlannedExercise;
    });
    await firestore.updateFreeSets(session.id, sets);
    await firestore.updatePlannedExercises(session.id, planned);
    setSession({ ...session, sets, plannedExercises: planned });
  }
  // (Old link-mode handlers replaced by linkExercises + SupersetPickerModal above.)

  // For a given exercise (by id), find known partner ids that are NOT already in this session —
  // and that the pair was recorded from a PAST session, not a link the user just made now.
  // "In session" counts both logged sets AND planned entries, so adding a partner (which
  // creates a planned entry) makes the suggestion disappear immediately.
  function partnersForExercise(exId: string): string[] {
    if (!exId || !session) return [];
    const inSession = new Set<string>();
    for (const g of groupedSets) {
      const id = exerciseIdOf(g.exerciseName);
      if (id) inSession.add(id);
    }
    for (const p of (session.plannedExercises || [])) {
      const id = exerciseIdOf(p.name);
      if (id) inSession.add(id);
    }
    return supersetPairs
      .filter(p => !p.hidden && (p.ids[0] === exId || p.ids[1] === exId))
      // Skip pairs that ONLY became a pair from a link inside this session (no prior history).
      // Rule: count > 1  OR  lastTs older than this session's start.
      .filter(p => (p.count || 0) > 1 || (session && p.lastTs && p.lastTs < session.date))
      .map(p => p.ids[0] === exId ? p.ids[1] : p.ids[0])
      .filter(otherId => !inSession.has(otherId) && !hiddenPairSuggestions.has(pairKey(exId, otherId)));
  }
  async function hidePairPermanently(a: string, b: string) {
    await firestore.hideSupersetPair(a, b);
    setHiddenPairSuggestions(prev => { const n = new Set(prev); n.add(pairKey(a, b)); return n; });
    const pairs = await firestore.listSupersetPairs();
    setSupersetPairs(pairs);
  }
  async function addSuggestedPartner(newExName: string, newExMuscle: MuscleGroup, sourceExId: string, partnerExId: string) {
    // Add as planned exercise, then link the two into a NEW superset group.
    await handleAddPlannedExercise(newExName, newExMuscle);
    // After add, find both sets/planned in updated session; give them a shared ss id.
    // Fetch fresh session state to have accurate sets.
    const fresh = await firestore.getFreeSession(session!.id);
    if (!fresh) return;
    const ssId = newSsId();
    const partnerNameLower = newExName.trim().toLowerCase();
    // Find sourceExercise sets and partner sets
    const newSets = fresh.sets.map(s => {
      const idOfSet = s.exerciseName ? exerciseIdOf(s.exerciseName) : '';
      if (idOfSet === sourceExId || idOfSet === partnerExId) {
        return { ...s, supersetGroup: s.supersetGroup || ssId };
      }
      return s;
    });
    // Also apply to any planned entries that share a name (they don't have sets, so we just record
    // the pair — visual grouping only kicks in once at least one set is logged).
    await firestore.updateFreeSets(fresh.id, newSets);
    await firestore.recordSupersetPair(sourceExId, partnerExId);
    setSession({ ...fresh, sets: newSets });
    const pairs = await firestore.listSupersetPairs();
    setSupersetPairs(pairs);
    void partnerNameLower;
  }

  async function handleFinish() {
    if (!session) return;
    await firestore.completeFreeSession(session.id);
    navigate({ page: 'home' });
  }

  async function handleAbandon() {
    // Session always stays alive when user just exits. To delete, use the trash button.
    // Empty state (only focus muscles picked, no sets/exercises yet) is a valid in-progress state —
    // user might come back to it after checking home / history / etc.
    navigate({ page: 'home' });
  }

  async function handleDeleteSession() {
    if (!session) return;
    await firestore.deleteFreeSession(session.id);
    navigate({ page: 'home' });
  }

  async function handleStartPlanned() {
    if (!session) return;
    const targetId = await firestore.startPlannedSession(session.id);
    if (targetId && targetId === session.id) {
      // reload the fresh doc so status/date update
      const fresh = await firestore.getFreeSession(session.id);
      if (fresh) setSession(fresh);
    } else if (targetId) {
      // startPlannedSession refused (another active exists) → go to that active one
      navigate({ page: 'session', sessionId: targetId });
    }
  }

  if (loading) return <div className="page-bg flex items-center justify-center text-muted">Loading...</div>;
  if (!session) {
    // Session no longer exists (deleted from Home, expired link, etc.) — bounce back to home
    // instead of showing a dead-end message.
    if (window.history.length > 1) window.history.back();
    else navigate({ page: 'home' });
    return <div className="page-bg flex items-center justify-center text-muted">...</div>;
  }

  // Planning mode: session hasn't been started yet. Same UI as a live session — just no log-set,
  // no chronograph, no delete-set (there's nothing to delete). Add-exercise + edit-muscles still work.
  const planning = session.status === 'planned';
  const plannedForLabel = session.plannedFor
    ? new Date(session.plannedFor + 'T00:00:00').toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' })
    : null;

  const realSetCount = session.sets.filter(s => s.weight > 0 || s.reps > 0).length;
  const exerciseCount = groupedSets.length + (session.plannedExercises || []).filter(p => !session.sets.some(s => (s.exerciseName || '').toLowerCase() === p.name.toLowerCase())).length;
  const dateLabel = new Date(session.date).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });

  // Historical-view helpers
  function toDateInput(ts: number): string {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function toTimeInput(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  function combineDateTime(dateStr: string, timeStr: string): number {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const [hh, mm] = timeStr.split(':').map(Number);
    return new Date(y, mo - 1, d, hh || 0, mm || 0).getTime();
  }
  function formatDuration(ms: number): string {
    if (ms <= 0) return '—';
    const totalMin = Math.round(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) return `${h} שעות ${m ? ` ${m} דקות` : ''}`.trim();
    return `${m} דקות`;
  }
  // Edit session date (keeps existing start-hour). Also snaps completedAt onto the new date.
  async function handleEditSessionDate(newDateStr: string) {
    if (!session) return;
    const newStart = combineDateTime(newDateStr, toTimeInput(session.date));
    const updates: { date: number; completedAt?: number } = { date: newStart };
    if (session.completedAt != null) {
      updates.completedAt = combineDateTime(newDateStr, toTimeInput(session.completedAt));
    }
    await firestore.updateFreeSessionDates(session.id, updates);
    setSession({ ...session, ...updates });
  }
  async function handleEditStartTime(timeStr: string) {
    if (!session) return;
    const newStart = combineDateTime(toDateInput(session.date), timeStr);
    await firestore.updateFreeSessionDates(session.id, { date: newStart });
    setSession({ ...session, date: newStart });
  }
  async function handleEditEndTime(timeStr: string) {
    if (!session) return;
    const baseDate = session.completedAt ?? session.date;
    const newEnd = combineDateTime(toDateInput(baseDate), timeStr);
    await firestore.updateFreeSessionDates(session.id, { completedAt: newEnd });
    setSession({ ...session, completedAt: newEnd });
  }
  const sessionDurationMs = session && session.completedAt ? (session.completedAt - session.date) : 0;
  const durationLabel = sessionDurationMs > 0 ? formatDuration(sessionDurationMs) : null;

  return (
    <div className="page-bg min-h-screen">
      <TopBar
        title={planning ? 'תכנון אימון' : historical ? 'אימון' : 'אימון בתהליך'}
        accent={planning || historical ? 'brand' : 'live'}
        tint={planning ? 'blue' : historical ? 'blue' : undefined}
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <span>{planning && plannedForLabel ? plannedForLabel : dateLabel}</span>
            <span className="text-muted-most">·</span>
            <span className="font-mono">{exerciseCount} תרגילים</span>
            {!planning && (
              <>
                <span className="text-muted-most">·</span>
                <span className="font-mono">{realSetCount} סטים</span>
              </>
            )}
          </span>
        }
        actions={
          <>
            {planning && (
              <button
                onClick={handleStartPlanned}
                className="inline-flex items-center gap-1.5 text-xs font-semibold
                           px-3 py-1.5 rounded-full
                           bg-blue-600 hover:bg-blue-500 text-white
                           transition-colors"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span>התחל</span>
              </button>
            )}
            {!historical && !planning && (
              <button
                onClick={() => setConfirmFinish(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold
                           px-3 py-1.5 rounded-full
                           bg-emerald-600 hover:bg-emerald-500 text-white
                           transition-colors"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5L20 7" />
                </svg>
                <span>סיים</span>
              </button>
            )}
            <button
              onClick={() => setConfirmDeleteSession(true)}
              aria-label="מחק אימון"
              className="w-9 h-9 rounded-full flex items-center justify-center text-red-500 hover:bg-red-500/10"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
              </svg>
            </button>
            <button
              onClick={() => {
                // Return to wherever the user came from (home / history / etc).
                // history.back() is the most reliable way to preserve context.
                if (window.history.length > 1) window.history.back();
                else navigate({ page: 'home' });
              }}
              aria-label="חזור"
              className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:bg-slate-500/10"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          </>
        }
      />
      <div className="px-4 pt-0 pb-32 max-w-lg mx-auto">
      {!historical && !planning && (
        <Chronograph
          sessionStartMs={session.date}
          restRemaining={timer.remaining}
          restIsRunning={timer.isRunning}
          restIsDone={timer.isDone}
          onRestSkip={timer.skip}
          onRestAdd={timer.addTime}
          onRestStart={(secs) => timer.start(secs)}
        />
      )}

      {/* Planned-mode strip — subtle blue tint. The "התחל" CTA lives in the TopBar itself,
          so this is just a quiet contextual label matching the historical strip pattern. */}
      {planning && (
        <div
          className="w-full -mx-4 mb-0 px-4 py-1.5 text-right
                     bg-blue-500/8 dark:bg-blue-500/12
                     border-b dark:border-blue-500/20 border-blue-500/20"
          style={{ width: 'calc(100% + 2rem)' }}
          dir="rtl"
        >
          <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>תוכנית ל{plannedForLabel}</span>
            </div>
            {/* Compact icon-only move-plan button — the date is already shown in
                the same strip ("תוכנית ל{X}"), so a full "העבר לתאריך" label would
                repeat information. Calendar-with-arrow glyph + a11y label suffices. */}
            <button
              onClick={() => setMovePlanOpen(true)}
              aria-label="העבר את התוכנית לתאריך אחר"
              title="העבר את התוכנית לתאריך אחר"
              className="inline-flex items-center justify-center w-8 h-8 rounded-full dark:bg-blue-950/40 bg-blue-100 text-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/60 hover:bg-blue-200 transition-colors"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="14" height="16" rx="2" />
                <line x1="14" y1="2" x2="14" y2="6" />
                <line x1="7" y1="2" x2="7" y2="6" />
                <line x1="3" y1="10" x2="17" y2="10" />
                <path d="M15 15l6-3-6-3" />
                <line x1="21" y1="12" x2="10" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {historical && (
        <div
          className="w-full -mx-4 mb-0 px-4 py-2.5 text-right
                     bg-gradient-to-l from-blue-500/10 via-blue-500/5 to-transparent
                     dark:from-blue-500/15 dark:via-blue-500/8
                     border-b dark:border-blue-500/25 border-blue-500/25"
          style={{ width: 'calc(100% + 2rem)' }}
          dir="rtl"
        >
          <div className="max-w-lg mx-auto">
            {durationLabel && (
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-[10px] text-blue-700/70 dark:text-blue-300/70 uppercase tracking-widest font-semibold">משך אימון</div>
                <div className="font-mono font-bold text-base text-blue-700 dark:text-blue-300">{durationLabel}</div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <DateField
                label="תאריך"
                value={toDateInput(session.date)}
                display={new Date(session.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                onChange={handleEditSessionDate}
              />
              <TimeField
                label="שעת התחלה"
                value={toTimeInput(session.date)}
                onChange={handleEditStartTime}
              />
              <TimeField
                label="שעת סיום"
                value={session.completedAt != null ? toTimeInput(session.completedAt) : ''}
                onChange={handleEditEndTime}
                disabled={session.completedAt == null}
              />
            </div>
          </div>
        </div>
      )}

      {!historical && chatOpen && (() => {
        // Merge sets-based exercises + planned-only exercises into one list for the AI.
        const seen = new Set<string>();
        const currentSessionExercises: Array<{ name: string; muscle: MuscleGroup; hasSets: boolean }> = [];
        for (const g of groupedSets) {
          if (!g.exerciseName) continue;
          const key = g.exerciseName.trim().toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          currentSessionExercises.push({ name: g.exerciseName, muscle: g.muscle, hasSets: true });
        }
        for (const p of (session.plannedExercises || [])) {
          const key = p.name.trim().toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          currentSessionExercises.push({ name: p.name, muscle: p.muscle, hasSets: false });
        }
        return (
        <AiChatPanel
          key={chatKeyRef.current}
          uid={uid}
          sessionMuscles={session.muscleGroups}
          recentSets={[...allPastSets, ...session.sets]}
          // Only auto-send a prompt when the caller explicitly provided one.
          // Replace flow no longer auto-sends — user opens the chat, sees the
          // context banner at the top (via replaceContext) + a passive greeting,
          // then asks for what they want. Feels less pushy.
          initialPrompt={chatInitialPrompt}
          initialAssistantMessage={
            !chatInitialPrompt && chatReplaceCtx
              ? `אני יכול להציע לך חלופה ל־"${chatReplaceCtx.name}". תכתוב לי מה בא לך — למשל "משהו יותר קל", "עם מכונה", "בלי משקולות" — ואני אציע.`
              : undefined
          }
          replaceContext={chatReplaceCtx}
          newThreadOnMount={chatNewThread}
          currentSessionExercises={currentSessionExercises}
          currentSessionStatus={session.status === 'planned' ? 'planned' : 'active'}
          currentSessionPlannedFor={session.plannedFor}
          currentSessionAerobicSummary={(session.aerobicEntries || []).length > 0
            ? (session.aerobicEntries || [])
                .map(e => `${e.minutes} דק' ${e.type}`)
                .join(', ')
            : undefined}
          onClose={() => setChatOpen(false)}
          onAddSet={async (partial) => {
            if (chatReplaceCtx) {
              await handleReplacePlanned(chatReplaceCtx.name, partial.exerciseName, partial.muscle, partial.en, partial.isHoldTime);
              // After the first replace picked, drop out of replace mode so more suggestions become adds.
              setChatReplaceCtx(undefined);
            } else {
              await handleAddPlannedExercise(partial.exerciseName, partial.muscle, partial.en, partial.isHoldTime);
            }
          }}
        />
        );
      })()}

      {modal && (
        <LogSetModal
          uid={uid}
          sessionMuscles={session.muscleGroups}
          defaultMuscle={modal.kind === 'add' ? modal.muscle : undefined}
          allPastSets={allPastSets}
          editingSet={modal.kind === 'edit' ? modal.set : undefined}
          sessionId={session.id}
          duplicateFrom={
            modal.kind === 'dup' ? modal.set :
            modal.kind === 'add' && modal.exerciseName
              ? { id: 'seed', muscle: (modal.muscle || 'chest') as MuscleGroup, weight: 0, reps: 0, exerciseName: modal.exerciseName, timestamp: Date.now() }
              : undefined
          }
          saveMode={
            planning ? 'exercise' :                                         // planning: no sets exist, always exercise-only
            modal.kind === 'pick' ? 'exercise' :                           // "+ תרגיל" button → save-exercise only
            modal.kind === 'replace' ? 'exercise' :                        // manual replace → pick new exercise, no set fields
            modal.kind === 'add' && modal.muscle && !modal.exerciseName ? 'dual' :  // muscle-tile click → both
            'set'                                                           // "+ סט" and normal set flows → save-set only
          }
          replacingName={modal.kind === 'replace' ? modal.oldName : undefined}
          onClose={() => setModal(null)}
          onSave={handleSaveSet}
          onPickOnly={async (name, muscle, en, isHoldTime) => {
            if (modal.kind === 'replace') {
              await handleReplacePlanned(modal.oldName, name, muscle, en, isHoldTime);
              setModal(null);
            } else {
              await handleAddPlannedExercise(name, muscle, en, isHoldTime);
            }
          }}
        />
      )}


      {/* Floating AI coach — clearly labelled "AI" pill so it never reads as a
          generic settings icon. Same visual grammar as the home-page trainer button. */}
      {!historical && <button
        onClick={() => openChatWith()}
        aria-label="מאמן AI"
        className="fixed bottom-32 left-4 z-30 h-11 px-3.5 rounded-full inline-flex items-center gap-1.5
                   bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm
                   shadow-[0_6px_20px_-4px_rgba(16,185,129,0.6)] backdrop-blur-md
                   transition-transform active:scale-95"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
          <path d="M12 2.5c.3 0 .55.2.63.48l1.28 4.53a3 3 0 0 0 2.07 2.07l4.54 1.28a.66.66 0 0 1 0 1.27l-4.54 1.28a3 3 0 0 0-2.07 2.07l-1.28 4.54a.66.66 0 0 1-1.27 0l-1.28-4.54a3 3 0 0 0-2.07-2.07L3.47 12.13a.66.66 0 0 1 0-1.27l4.54-1.28A3 3 0 0 0 10.09 7.5l1.28-4.53c.08-.28.33-.47.63-.47Z"/>
        </svg>
        <span>AI</span>
      </button>}

      {/* ═══ Section: בפוקוס ═══ */}
      <section className="mb-6" dir="rtl">
        <div className="sticky z-20 -mx-4 px-4 py-2.5 mb-2 backdrop-blur bg-gradient-to-b from-rose-50/95 to-white/85 dark:from-rose-950/40 dark:to-slate-950/90 border-b border-rose-500/20 shadow-[0_2px_10px_-6px_rgba(244,63,94,0.35)]" style={{ top: 'var(--top-bar-h)' }}>
          <div className="max-w-lg mx-auto flex items-baseline justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 text-base font-bold">
              <span>בפוקוס</span>
              <span className="w-1 h-4 rounded-full bg-rose-500" />
            </h2>
            <span className="text-[10px] text-muted-most uppercase tracking-widest font-semibold flex items-center gap-1 flex-wrap justify-end">
              <span className="font-mono">{session.muscleGroups.length}</span><span>שרירים</span>
              <span className="text-muted-most">·</span>
              <span className="font-mono">{exerciseCount}</span><span>תרגילים</span>
              <span className="text-muted-most">·</span>
              <span className="font-mono">{realSetCount}</span><span>סטים</span>
            </span>
          </div>
        </div>
        <div className="card !p-3">
          <div className="grid grid-cols-2 gap-2" dir="rtl">
            {session.muscleGroups.map(id => {
              const m = MUSCLE_BY_ID[id];
              if (!m) return null;
              const c = MUSCLE_CLASSES[m.color];
              const sets = setsByMuscle.get(id) || [];
              const realSets = sets.filter(s => s.weight > 0 || s.reps > 0).length;
              // Count unique exercises: from logged sets + from planned that map to this muscle
              const uniqLogged = new Set(sets.map(s => (s.exerciseName || '').toLowerCase()).filter(Boolean));
              const plannedForMuscle = (session.plannedExercises || []).filter(p =>
                p.muscle === id && !uniqLogged.has(p.name.toLowerCase())
              );
              const exCount = uniqLogged.size + plannedForMuscle.length;
              return (
                <button
                  key={id}
                  onClick={() => setModal({ kind: 'add', muscle: id })}
                  className={`text-right p-3 rounded-xl ${c.bg} ${c.text}`}
                  dir="rtl"
                >
                  <div className="text-base font-semibold">{m.he}</div>
                  <div className="text-xs opacity-80 mt-0.5">
                    {exCount} תרגילים · {realSets} סטים
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ Section: תרגילים באימון ═══ */}
      {(groupedSets.length > 0 || (session.plannedExercises || []).length > 0) && (
        <section className="mb-4" dir="rtl">
          <div className="sticky z-20 -mx-4 px-4 py-2.5 mb-2 backdrop-blur bg-gradient-to-b from-blue-50/95 to-white/85 dark:from-blue-950/40 dark:to-slate-950/90 border-b border-blue-500/20 shadow-[0_2px_10px_-6px_rgba(59,130,246,0.35)]" style={{ top: 'var(--top-bar-h)' }}>
            <div className="max-w-lg mx-auto flex items-baseline justify-between gap-2">
              <h2 className="inline-flex items-center gap-2 text-base font-bold">
                <span>תרגילים באימון</span>
                <span className="w-1 h-4 rounded-full bg-blue-500" />
              </h2>
              <span className="text-[10px] text-muted-most uppercase tracking-widest font-semibold flex items-center gap-1 flex-wrap justify-end">
                <span className="font-mono">{session.muscleGroups.length}</span><span>שרירים</span>
                <span className="text-muted-most">·</span>
                <span className="font-mono">{exerciseCount}</span><span>תרגילים</span>
                <span className="text-muted-most">·</span>
                <span className="font-mono">{realSetCount}</span><span>סטים</span>
              </span>
            </div>
          </div>

          {/* 1) Exercises with logged sets — TOP */}
          {groupedSets.map((g, gi) => {
            const m = MUSCLE_BY_ID[g.muscle];
            if (!m) return null;
            const c = MUSCLE_CLASSES[m.color];
            const displayName = g.exerciseName || '(ללא שם תרגיל)';
            const enName = g.exerciseName ? findPersonalByName(personalExercises, g.exerciseName)?.en : null;
            const realSetCount = g.sets.filter(s => s.weight > 0 || s.reps > 0).length;
            // Superset info + neighbors so we can render a "shared container" via header/footer strips
            const ssId = groupSsId(g);
            const ssColor = ssId ? ssColorById.get(ssId) : null;
            const ssTotal = ssId ? (ssMemberCount.get(ssId) || 1) : 0;
            const ssIdx = ssId
              ? groupedSets.filter(x => groupSsId(x) === ssId).indexOf(g) + 1
              : 0;
            const prevSsId = gi > 0 ? groupSsId(groupedSets[gi - 1]) : null;
            const nextSsId = gi < groupedSets.length - 1 ? groupSsId(groupedSets[gi + 1]) : null;
            const isFirstInSs = !!ssId && ssId !== prevSsId;
            const isLastInSs = !!ssId && ssId !== nextSsId;
            const exId = g.exerciseName ? exerciseIdOf(g.exerciseName) : '';
            const partnerIds = exId ? partnersForExercise(exId) : [];
            const inSuperset = !!ssId;
            const cardKey = `${g.muscle}::${g.exerciseName.toLowerCase()}`;
            return (
              <Fragment key={cardKey}>
                {/* Superset header — appears above the first card in the group */}
                {isFirstInSs && ssColor && (
                  <div className={`px-3 py-1.5 rounded-t-2xl border-2 border-b-0 ${ssColor.border} ${ssColor.badgeBg} flex items-center justify-between`} dir="rtl">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${ssColor.badgeText}`}>
                      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                      <span>
                        <span>סופרסט </span>
                        <bdi>{ssColor.label}</bdi>
                        <span> · </span>
                        <bdi>{ssTotal}</bdi>
                        <span> תרגילים</span>
                      </span>
                    </span>
                    <button
                      onClick={() => unlinkWholeSuperset(ssId!)}
                      className={`text-[10px] font-semibold ${ssColor.badgeText} opacity-70 hover:opacity-100`}
                    >בטל קישור</button>
                  </div>
                )}
              {(() => {
                const isSource = linkFrom && linkFrom.sourceName.trim().toLowerCase() === g.exerciseName.trim().toLowerCase();
                const isSameSs = linkFrom && ssId && ssId === linkFrom.sourceSsId;
                const isCandidate = !!linkFrom && !isSource && !isSameSs;
                const linkRing = isCandidate
                  ? 'ring-2 ring-indigo-500'
                  : linkFrom ? 'opacity-50' : '';
                return (
              <div
                className={`card relative ${linkRing} ${
                  inSuperset && ssColor
                    ? `border-2 ${ssColor.border} rounded-t-none border-t-0 ${
                        isLastInSs ? 'mb-3' : 'rounded-b-none border-b-0 mb-0'
                      }`
                    : 'mb-3'
                }`}
                dir="rtl"
              >
                {/* Candidate overlay — captures the whole card as one big link target without
                    changing any inner layout or triggering per-set/per-button click handlers. */}
                {isCandidate && (
                  <button
                    onClick={() => completeLinkTo(g.exerciseName)}
                    aria-label={`קשר עם ${g.exerciseName}`}
                    className="absolute inset-0 z-10 rounded-2xl cursor-pointer bg-transparent"
                  />
                )}
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="text-right flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-base font-bold leading-tight">{displayName}</div>
                      {inSuperset && (
                        <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${ssColor?.badgeBg} ${ssColor?.badgeText}`} title="מיקום בתוך הסופרסט">
                          <span>{ssIdx}/{ssTotal}</span>
                        </span>
                      )}
                    </div>
                    {enName && (
                      <div className="text-[11px] text-muted mt-0.5 text-right" dir="ltr" style={{ direction: 'ltr' }}>{enName}</div>
                    )}
                  </div>
                  {/* Top-left corner: muscle chip · set count + link/unlink button */}
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {/* Icons stay identical regardless of link mode — no layout shift when linking */}
                    <div className="flex items-center gap-1">
                      {ssId && !isFirstInSs && (
                        <button
                          onClick={() => reorderInSuperset(g.exerciseName, 'up')}
                          title="הזז למעלה בסופרסט"
                          className="text-[10px] w-5 h-5 rounded-full flex items-center justify-center text-muted hover:text-indigo-500"
                        >↑</button>
                      )}
                      {ssId && !isLastInSs && (
                        <button
                          onClick={() => reorderInSuperset(g.exerciseName, 'down')}
                          title="הזז למטה בסופרסט"
                          className="text-[10px] w-5 h-5 rounded-full flex items-center justify-center text-muted hover:text-indigo-500"
                        >↓</button>
                      )}
                      <button
                        onClick={() => setLinkFrom({ sourceName: g.exerciseName, sourceSsId: ssId })}
                        title={ssId ? 'הוסף עוד תרגיל לסופרסט' : 'חבר עם תרגיל אחר לסופרסט'}
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${ssId ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted hover:text-indigo-500'}`}
                      >
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                      </button>
                      {ssId && (
                        <button
                          onClick={() => unlinkExercise(g.exerciseName)}
                          title="הסר תרגיל זה מהסופרסט"
                          className="text-[10px] px-1.5 py-0.5 rounded-full text-muted hover:text-red-500"
                        >
                          {/* Broken-chain (unlink) icon — clearly reads as "detach from superset" */}
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-.12-7.07 5 5 0 0 0-6.95 0l-1.72 1.71" />
                            <path d="M5.17 11.75l-1.71 1.71a5 5 0 0 0 .12 7.07 5 5 0 0 0 6.95 0l1.71-1.71" />
                            <line x1="8" y1="2" x2="8" y2="5" />
                            <line x1="2" y1="8" x2="5" y2="8" />
                            <line x1="16" y1="19" x2="16" y2="22" />
                            <line x1="19" y1="16" x2="22" y2="16" />
                          </svg>
                        </button>
                      )}
                      <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full ${c.bg} ${c.text}`}>
                        <span>{m.he}</span>
                        <span className="opacity-70 font-mono">· {realSetCount}</span>
                      </span>
                    </div>
                    {findPersonalByName(personalExercises, g.exerciseName)?.isHoldTime && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded dark:bg-slate-800 bg-slate-100 text-muted-most">⏱ החזקה</span>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {g.sets.map(s => {
                    const unit = s.unit || 'kg';
                    const isPlaceholder = s.weight === 0 && s.reps === 0;
                    const isHold = !!findPersonalByName(personalExercises, g.exerciseName)?.isHoldTime;
                    return (
                      <div
                        key={s.id}
                        onClick={() => setModal({ kind: 'edit', set: s })}
                        className={`flex items-center justify-between gap-3 rounded-lg px-3 py-3 bg-subtle cursor-pointer active:opacity-80 min-h-[44px] ${isPlaceholder ? 'border border-dashed dark:border-amber-700 border-amber-300' : ''}`}
                        dir="rtl"
                      >
                        <div className="font-mono text-base flex-1 text-right">
                          {isPlaceholder ? (
                            <span className="text-amber-500 text-sm">— להשלים —</span>
                          ) : isHold ? (
                            <span dir="ltr" className="inline-block font-bold">
                              {s.reps}<span className="text-xs text-muted mr-0.5">שנ'</span>
                              {s.weight > 0 && (<> · {s.weight}<span className="text-xs text-muted">{unit}</span></>)}
                            </span>
                          ) : (
                            <span dir="ltr" className="inline-block font-bold">{s.weight}<span className="text-xs text-muted mr-0.5">{unit}</span> × {s.reps}</span>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteSetId(s.id); }}
                          aria-label="מחק סט"
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500/10"
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-subtle/60" dir="rtl">
                  <button
                    onClick={() => setModal({ kind: 'dup', set: g.sets[g.sets.length - 1] })}
                    className="flex-1 py-2.5 text-sm font-semibold rounded-xl border-2 dark:border-emerald-500/60 border-emerald-500 text-emerald-600 dark:text-emerald-400 dark:hover:bg-emerald-500/10 hover:bg-emerald-500/5 transition-colors"
                  >+ סט נוסף</button>
                  <button
                    onClick={() => openChatWith(
                      `תציע לי תרגיל נוסף/משלים ל"${displayName}" (${m.he}), משהו שיוסיף לאימון של היום.`,
                      undefined,
                      true, // start fresh chat
                    )}
                    className="inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 font-bold text-xs"
                    aria-label="הוסף עוד עם AI"
                    title="הוסף עוד עם AI"
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
                      <path d="M12 2.5c.3 0 .55.2.63.48l1.28 4.53a3 3 0 0 0 2.07 2.07l4.54 1.28a.66.66 0 0 1 0 1.27l-4.54 1.28a3 3 0 0 0-2.07 2.07l-1.28 4.54a.66.66 0 0 1-1.27 0l-1.28-4.54a3 3 0 0 0-2.07-2.07L3.47 12.13a.66.66 0 0 1 0-1.27l4.54-1.28A3 3 0 0 0 10.09 7.5l1.28-4.53c.08-.28.33-.47.63-.47Z"/>
                    </svg>
                    <span>AI</span>
                  </button>
                </div>
                {/* Partner suggestions — small dashed card per known-but-not-in-session partner */}
                {partnerIds.length > 0 && partnerIds.slice(0, 2).map(pid => {
                  const partnerEx = personalExercises.find(e => e.id === pid);
                  if (!partnerEx) return null;
                  const pmus = MUSCLE_BY_ID[partnerEx.defaultMuscle];
                  if (!pmus) return null;
                  const pKey = pairKey(exId, pid);
                  const pair = supersetPairs.find(p => p.id === pKey);
                  // If the SOURCE exercise is already in a superset, adding this
                  // partner will grow that group — not create a fresh 2-member one.
                  // Show the correct target size so the user isn't misled by "×2".
                  const resultingSize = inSuperset ? ssTotal + 1 : 2;
                  return (
                    <div
                      key={`sug:${pid}`}
                      className="mt-2 rounded-xl border border-dashed border-indigo-500/40 dark:bg-indigo-950/20 bg-indigo-50/50 px-3 py-2 flex items-center justify-between gap-2 text-[11px]"
                      dir="rtl"
                    >
                      <div className="min-w-0 flex-1 text-right">
                        <div className="text-indigo-700 dark:text-indigo-300">
                          <span className="opacity-70">
                            {inSuperset ? 'לצרף לסופרסט הקיים:' : 'בעבר סופרסט עם:'}
                          </span>{' '}
                          <span className="font-semibold">{partnerEx.he}</span>
                          {inSuperset
                            ? <span className="opacity-60"> · יהיה ×{resultingSize}</span>
                            : (pair && pair.count > 1 && <span className="opacity-60"> · בעבר ×{pair.count}</span>)}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-1">
                        <button
                          onClick={() => addSuggestedPartner(partnerEx.he, partnerEx.defaultMuscle, exId, pid)}
                          className="text-[10px] font-semibold px-2 py-1 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white"
                        >+ הוסף גם</button>
                        <button
                          onClick={() => hidePairPermanently(exId, pid)}
                          aria-label="אל תציע שוב"
                          title="אל תציע שוב"
                          className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-red-500 hover:bg-red-500/10 text-base leading-none"
                        >✕</button>
                      </div>
                    </div>
                  );
                })}
                {/* Notes + difficulty rating — quiet, expandable */}
                <ExerciseInline uid={uid} exerciseName={g.exerciseName} sessionId={session.id} />
              </div>
                );
              })()}
              </Fragment>
            );
          })}

          {/* 2) Planned exercises — BELOW. Reorder so superset members are always adjacent
                 (mirror of what reorderForSupersets does for logged groups). */}
          {(() => {
            const raw = (session.plannedExercises || [])
              .filter(p => !session.sets.some(s => (s.exerciseName || '').toLowerCase() === p.name.toLowerCase()));
            // Which supersetGroups have at least one LOGGED member? Planned members
            // sharing those groups should render at the TOP of the planned section
            // so the whole superset stays visually together after the user logs any
            // one of them. (True inline interleaving would require refactoring the
            // planned card into a shared component — this is the light version.)
            const loggedSs = new Set<string>();
            for (const g of groupedSets) {
              const ss = groupSsId(g);
              if (ss) loggedSs.add(ss);
            }
            const seenSs = new Set<string>();
            const plannedList: typeof raw = [];
            // First pass: planned members that belong to a superset already logged.
            for (const p of raw) {
              const ss = p.supersetGroup;
              if (!ss || !loggedSs.has(ss) || seenSs.has(ss)) continue;
              seenSs.add(ss);
              const members = raw.filter(q => q.supersetGroup === ss);
              members.sort((a, b) => (a.supersetOrder ?? 9999) - (b.supersetOrder ?? 9999));
              for (const mm of members) plannedList.push(mm);
            }
            // Second pass: everything else, preserving user-visible ordering.
            for (const p of raw) {
              const ss = p.supersetGroup;
              if (!ss || seenSs.has(ss)) { plannedList.push(p); if (ss) seenSs.add(ss); continue; }
              seenSs.add(ss);
              const members = raw.filter(q => q.supersetGroup === ss);
              members.sort((a, b) => (a.supersetOrder ?? 9999) - (b.supersetOrder ?? 9999));
              for (const mm of members) plannedList.push(mm);
            }
            // Dedupe (partners we already appended)
            const seenP = new Set<typeof raw[number]>();
            const dedup: typeof raw = [];
            for (const x of plannedList) { if (!seenP.has(x)) { dedup.push(x); seenP.add(x); } }
            return dedup.map((p, pi) => {
              const attachedToLoggedSs = !!p.supersetGroup && loggedSs.has(p.supersetGroup);
              const m = MUSCLE_BY_ID[p.muscle];
              if (!m) return null;
              const c = MUSCLE_CLASSES[m.color];
              const enName = findPersonalByName(personalExercises, p.name)?.en;
              // Superset info for planned card — shares the color palette with logged cards.
              const pSs = p.supersetGroup || null;
              const pSsColor = pSs ? ssColorById.get(pSs) : null;
              const pSsTotal = pSs ? (ssMemberCount.get(pSs) || 1) : 0;
              // Position within superset — count both planned entries and logged groups.
              const pSsIdx = pSs ? (() => {
                let idx = 0;
                for (const g of groupedSets) {
                  if (groupSsId(g) === pSs) idx++;
                }
                for (const other of (session.plannedExercises || [])) {
                  if (other.supersetGroup === pSs) {
                    idx++;
                    if (other.name.trim().toLowerCase() === p.name.trim().toLowerCase()) break;
                  }
                }
                return idx;
              })() : 0;
              const pExId = exerciseIdOf(p.name);
              const pPartnerIds = pExId ? partnersForExercise(pExId) : [];
              const inSuperset = !!pSs;
              const prevPSs = pi > 0 ? dedup[pi - 1].supersetGroup : null;
              const nextPSs = pi < dedup.length - 1 ? dedup[pi + 1].supersetGroup : null;
              const isFirstInSs = !!pSs && pSs !== prevPSs;
              const isLastInSs = !!pSs && pSs !== nextPSs;
              const pTotal = pSs
                ? dedup.filter(x => x.supersetGroup === pSs).length
                  + groupedSets.filter(x => groupSsId(x) === pSs).length
                : 0;
              return (
                <Fragment key={`planned::${p.name.toLowerCase()}`}>
                  {isFirstInSs && pSsColor && (
                    <div className={`px-3 py-1.5 rounded-t-2xl border-2 border-b-0 ${pSsColor.border} ${pSsColor.badgeBg} flex items-center justify-between`} dir="rtl">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${pSsColor.badgeText}`}>
                        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                        <span>
                          <span>סופרסט </span>
                          <bdi>{pSsColor.label}</bdi>
                          <span> · </span>
                          <bdi>{pTotal}</bdi>
                          <span> תרגילים</span>
                        </span>
                      </span>
                      <button
                        onClick={() => unlinkWholeSuperset(pSs!)}
                        className={`text-[10px] font-semibold ${pSsColor.badgeText} opacity-70 hover:opacity-100`}
                      >בטל קישור</button>
                    </div>
                  )}
                {(() => {
                  const isSource = linkFrom && linkFrom.sourceName.trim().toLowerCase() === p.name.trim().toLowerCase();
                  const isSameSs = linkFrom && pSs && pSs === linkFrom.sourceSsId;
                  const isCandidate = !!linkFrom && !isSource && !isSameSs;
                  const linkRing = isCandidate
                    ? 'ring-2 ring-indigo-500'
                    : linkFrom ? 'opacity-50' : '';
                  return (
                <div
                  className={`card relative border-dashed border-2 dark:border-slate-700 border-slate-300 ${linkRing} ${
                    inSuperset && pSsColor
                      ? `!border-solid ${pSsColor.border} rounded-t-none border-t-0 ${
                          isLastInSs ? 'mb-3' : 'rounded-b-none border-b-0 mb-0'
                        }`
                      : 'mb-3'
                  }`}
                  dir="rtl"
                >
                  {isCandidate && (
                    <button
                      onClick={() => completeLinkTo(p.name)}
                      aria-label={`קשר עם ${p.name}`}
                      className="absolute inset-0 z-10 rounded-2xl cursor-pointer bg-transparent"
                    />
                  )}
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="text-right flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-base font-bold leading-tight">{p.name}</div>
                        {inSuperset && pSsColor && (
                          <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${pSsColor.badgeBg} ${pSsColor.badgeText}`} title="מיקום בתוך הסופרסט">
                            <span>{pSsIdx}/{pSsTotal}</span>
                          </span>
                        )}
                        {attachedToLoggedSs && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30" title="שאר הסופרסט כבר נרשם">
                            המשך של הסופרסט למעלה
                          </span>
                        )}
                      </div>
                      {enName && (
                        <div className="text-[11px] text-muted mt-0.5 text-right" dir="ltr" style={{ direction: 'ltr' }}>{enName}</div>
                      )}
                    </div>
                    <div className="shrink-0 flex items-center gap-1">
                      {pSs && !isFirstInSs && (
                        <button
                          onClick={() => reorderInSuperset(p.name, 'up')}
                          title="הזז למעלה בסופרסט"
                          className="text-[10px] w-5 h-5 rounded-full flex items-center justify-center text-muted hover:text-indigo-500"
                        >↑</button>
                      )}
                      {pSs && !isLastInSs && (
                        <button
                          onClick={() => reorderInSuperset(p.name, 'down')}
                          title="הזז למטה בסופרסט"
                          className="text-[10px] w-5 h-5 rounded-full flex items-center justify-center text-muted hover:text-indigo-500"
                        >↓</button>
                      )}
                      <button
                        onClick={() => setLinkFrom({ sourceName: p.name, sourceSsId: pSs })}
                        title={pSs ? 'הוסף עוד תרגיל לסופרסט' : 'חבר עם תרגיל אחר לסופרסט'}
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${pSs ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted hover:text-indigo-500'}`}
                      >
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                      </button>
                      {pSs && (
                        <button
                          onClick={() => unlinkExercise(p.name)}
                          title="הסר תרגיל זה מהסופרסט"
                          className="text-[10px] px-1.5 py-0.5 rounded-full text-muted hover:text-red-500"
                        >
                          {/* Broken-chain (unlink) icon — clearly reads as "detach from superset" */}
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-.12-7.07 5 5 0 0 0-6.95 0l-1.72 1.71" />
                            <path d="M5.17 11.75l-1.71 1.71a5 5 0 0 0 .12 7.07 5 5 0 0 0 6.95 0l1.71-1.71" />
                            <line x1="8" y1="2" x2="8" y2="5" />
                            <line x1="2" y1="8" x2="5" y2="8" />
                            <line x1="16" y1="19" x2="16" y2="22" />
                            <line x1="19" y1="16" x2="22" y2="16" />
                          </svg>
                        </button>
                      )}
                      <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full ${c.bg} ${c.text} opacity-80`}>
                        <span>{m.he}</span>
                        <span className="opacity-70 font-mono">· 0</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-subtle/60" dir="rtl">
                    {!planning && (
                      <button
                        onClick={() => setModal({ kind: 'add', muscle: p.muscle, exerciseName: p.name })}
                        className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                      >+ רשום סט</button>
                    )}
                    <button
                      onClick={() => setModal({ kind: 'replace', oldName: p.name, muscle: p.muscle })}
                      className="inline-flex items-center justify-center py-2.5 px-3 rounded-xl dark:bg-slate-800 bg-slate-100 dark:hover:bg-slate-700 hover:bg-slate-200 font-semibold text-xs text-main"
                      title="החלף ידנית"
                    >החלף</button>
                    <button
                      onClick={() => openChatWith(
                        undefined,  // no auto-sent prompt — chat opens with a passive header
                        { name: p.name, muscle: p.muscle },
                        true, // start fresh chat
                      )}
                      className="inline-flex items-center justify-center gap-1 py-2.5 px-3 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 font-bold text-xs"
                      aria-label="הצע חלופה עם AI"
                      title="הצע חלופה עם AI"
                    >
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
                        <path d="M12 2.5c.3 0 .55.2.63.48l1.28 4.53a3 3 0 0 0 2.07 2.07l4.54 1.28a.66.66 0 0 1 0 1.27l-4.54 1.28a3 3 0 0 0-2.07 2.07l-1.28 4.54a.66.66 0 0 1-1.27 0l-1.28-4.54a3 3 0 0 0-2.07-2.07L3.47 12.13a.66.66 0 0 1 0-1.27l4.54-1.28A3 3 0 0 0 10.09 7.5l1.28-4.53c.08-.28.33-.47.63-.47Z"/>
                      </svg>
                      <span>AI</span>
                    </button>
                    <button
                      onClick={() => handleRemovePlanned(p.name)}
                      className="btn-secondary !py-2.5 !px-3 text-sm text-red-500"
                    >הסר</button>
                  </div>
                  {/* Partner suggestions on planned cards too */}
                  {pPartnerIds.length > 0 && pPartnerIds.slice(0, 2).map(pid => {
                    const partnerEx = personalExercises.find(e => e.id === pid);
                    if (!partnerEx) return null;
                    const pKey = pairKey(pExId, pid);
                    const pair = supersetPairs.find(pp => pp.id === pKey);
                    return (
                      <div
                        key={`sug:${pid}`}
                        className="mt-2 rounded-xl border border-dashed border-indigo-500/40 dark:bg-indigo-950/20 bg-indigo-50/50 px-3 py-2 flex items-center justify-between gap-2 text-[11px]"
                        dir="rtl"
                      >
                        <div className="min-w-0 flex-1 text-right">
                          <div className="text-indigo-700 dark:text-indigo-300">
                            <span className="opacity-70">בעבר סופרסט עם:</span>{' '}
                            <span className="font-semibold">{partnerEx.he}</span>
                            {pair && pair.count > 1 && <span className="opacity-60"> · ×{pair.count}</span>}
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-1">
                          <button
                            onClick={() => addSuggestedPartner(partnerEx.he, partnerEx.defaultMuscle, pExId, pid)}
                            className="text-[10px] font-semibold px-2 py-1 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white"
                          >+ הוסף גם</button>
                          <button
                            onClick={() => hidePairPermanently(pExId, pid)}
                            aria-label="אל תציע שוב"
                            title="אל תציע שוב"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-red-500 hover:bg-red-500/10 text-base leading-none"
                          >✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                  );
                })()}
                </Fragment>
              );
            });
          })()}
        </section>
      )}

      {/* Inline "+ הוסף תרגיל" — mirrors the "+ הוסף אירובי" button style. Makes adding
          another exercise discoverable at the end of the list, not only via the bottom bar. */}
      {!historical && (
        <div className="mb-4" dir="rtl">
          <button
            onClick={() => setModal({ kind: 'pick' })}
            className="w-full py-3 rounded-xl border border-dashed border-violet-500/40 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 text-sm font-semibold"
          >+ {planning ? 'הוסף תרגיל לתוכנית' : 'הוסף תרגיל'}</button>
        </div>
      )}

      {/* ═══ Section: אירובי ═══ — sits BELOW all muscle exercise cards. Available in all
              modes: live (edit), planning ("אירובי מתוכנן"), historical (fully editable, same as exercises). */}
      <AerobicSection
        entries={session.aerobicEntries || []}
        planning={planning}
        readOnly={false}
        onAdd={() => setAerobicModal({})}
        onEdit={(e) => setAerobicModal({ editing: e })}
        onDelete={(id) => setConfirmDeleteAerobicId(id)}
      />

      {/* Floating link-mode banner — hovers ABOVE the bottom action bar so activating link mode
          doesn't reflow the exercise list under the user's finger. */}
      {!historical && linkFrom && (
        <div className="fixed bottom-24 left-4 right-4 z-40 max-w-lg mx-auto" dir="rtl">
          <div className="rounded-xl px-3 py-2.5 bg-indigo-600 text-white shadow-[0_8px_28px_-6px_rgba(79,70,229,0.6)] flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold leading-tight">בחר תרגיל לחיבור לסופרסט</div>
              <div className="text-[11px] opacity-90 leading-tight mt-0.5 truncate">
                לחץ על תרגיל אחר כדי לחבר אותו עם <strong>{linkFrom.sourceName}</strong> — תעשה אותם אחד אחרי השני בלי הפסקה
              </div>
            </div>
            <button
              onClick={() => setLinkFrom(null)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30 shrink-0"
            >ביטול</button>
          </div>
        </div>
      )}

      {/* Fixed bottom action bar */}
      {!historical && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t dark:from-slate-950 dark:via-slate-950 from-slate-50 via-slate-50 to-transparent" dir="rtl">
          {/* DOM order (RTL): [סט → תרגיל → אירובי]. Primary CTA on the right where
              the eye starts, then secondary "+ תרגיל", then "+ אירובי" trails. */}
          <div className="max-w-lg mx-auto flex gap-2">
            {planning ? (
              <>
                <button
                  onClick={() => setModal({ kind: 'pick' })}
                  className="btn-primary !bg-blue-600 hover:!bg-blue-500 flex-1 py-5 text-xl font-semibold"
                >
                  + תרגיל לתוכנית
                </button>
                <button
                  onClick={() => setAerobicModal({})}
                  className="py-4 px-3 text-sm font-semibold shrink-0 rounded-xl border border-cyan-500/40 bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40"
                  title="הוסף אירובי לתוכנית"
                >+ אירובי</button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setModal({ kind: 'add' })}
                  className="btn-primary flex-1 py-5 text-xl font-semibold"
                >
                  + סט
                </button>
                <button
                  onClick={() => setModal({ kind: 'pick' })}
                  className="btn-secondary py-4 px-3 text-sm font-semibold shrink-0"
                >+ תרגיל</button>
                <button
                  onClick={() => setAerobicModal({})}
                  className="py-4 px-3 text-sm font-semibold shrink-0 rounded-xl border border-cyan-500/40 bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40"
                  title="הוסף אירובי"
                >+ אירובי</button>
              </>
            )}
          </div>
        </div>
      )}

      {aerobicModal && (
        <AerobicModal
          uid={uid}
          editing={aerobicModal.editing}
          onClose={() => { setAerobicModal(null); if (addAerobicFromFinish) { setAddAerobicFromFinish(false); setConfirmFinish(true); } }}
          onSave={handleSaveAerobic}
        />
      )}

      {movePlanOpen && session && (
        <MovePlanModal
          currentYmd={session.plannedFor}
          onCancel={() => setMovePlanOpen(false)}
          onMove={async (newYmd) => {
            await firestore.movePlannedSession(session.id, newYmd);
            const [y, m, d] = newYmd.split('-').map(Number);
            const midnight = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0).getTime();
            setSession({ ...session, plannedFor: newYmd, date: midnight });
            setMovePlanOpen(false);
          }}
        />
      )}


      {confirmDeleteAerobicId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/50 p-4">
          <div className="card max-w-sm w-full text-right" dir="rtl">
            <h3 className="font-bold text-red-500 mb-2">מחק אירובי?</h3>
            <p className="text-sm text-muted mb-4">הרישום יימחק. לא ניתן לשחזר.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteAerobicId(null)} className="btn-secondary flex-1">ביטול</button>
              <button
                onClick={async () => {
                  const id = confirmDeleteAerobicId;
                  setConfirmDeleteAerobicId(null);
                  if (id) await handleDeleteAerobic(id);
                }}
                className="btn-primary flex-1 !bg-red-600 hover:!bg-red-500"
              >מחק</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteSetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/50 p-4">
          <div className="card max-w-sm w-full text-right" dir="rtl">
            <h3 className="font-bold text-red-500 mb-2">מחק סט?</h3>
            <p className="text-sm text-muted mb-4">
              הסט יימחק מהאימון הזה. לא ניתן לשחזר.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteSetId(null)} className="btn-secondary flex-1">ביטול</button>
              <button
                onClick={async () => {
                  const id = confirmDeleteSetId;
                  setConfirmDeleteSetId(null);
                  if (id) await handleDeleteSet(id);
                }}
                className="btn-primary flex-1 !bg-red-600 hover:!bg-red-500"
              >מחק</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/50 p-4">
          <div className="card max-w-sm w-full text-right" dir="rtl">
            <h3 className="font-bold text-red-500 mb-2">מחק את האימון?</h3>
            <p className="text-sm text-muted mb-4">
              האימון יימחק לגמרי, כולל כל הסטים והתרגילים המתוכננים. לא ניתן לשחזר.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteSession(false)} className="btn-secondary flex-1">ביטול</button>
              <button
                onClick={async () => {
                  setConfirmDeleteSession(false);
                  await handleDeleteSession();
                }}
                className="btn-primary flex-1 !bg-red-600 hover:!bg-red-500"
              >מחק</button>
            </div>
          </div>
        </div>
      )}

      {confirmFinish && (() => {
        const realSets = session.sets.filter(s => s.weight > 0 || s.reps > 0).length;
        const hasAerobic = (session.aerobicEntries || []).length > 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center dark:bg-black/80 bg-black/50 p-4">
            <div className="card max-w-sm w-full text-right" dir="rtl">
              <h3 className="font-bold text-emerald-500 mb-2">סיים אימון?</h3>
              <p className="text-sm text-muted mb-3">
                רשמת {realSets} סטים{hasAerobic ? ' + אירובי' : ''}. אחרי הסיום האימון עובר להיסטוריה.
              </p>
              {!hasAerobic ? (
                <>
                  <div className="mb-4 flex items-start gap-2 rounded-xl px-3 py-2.5 bg-cyan-500/10 border border-cyan-500/30 text-[12px] text-cyan-800 dark:text-cyan-200">
                    <span className="shrink-0">🏃</span>
                    <span className="flex-1">עשית גם אימון אירובי?</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => { setConfirmFinish(false); setAddAerobicFromFinish(true); setAerobicModal({}); }}
                      className="py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                    >כן — הוסף אירובי</button>
                    <div className="flex gap-3">
                      <button onClick={() => setConfirmFinish(false)} className="btn-secondary flex-1">ביטול</button>
                      <button onClick={handleFinish} className="btn-primary flex-1">לא — סיים</button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex gap-3">
                  <button onClick={() => setConfirmFinish(false)} className="btn-secondary flex-1">ביטול</button>
                  <button onClick={handleFinish} className="btn-primary flex-1">סיים</button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
      </div>
    </div>
  );
}

// Compact date field — shows a formatted display, hides the native picker behind it.
// The <input type="date"> covers the whole element (opacity-0) so tapping it opens the
// system picker without the picker chrome overflowing.
function DateField({
  label, value, display, onChange,
}: {
  label: string; value: string; display: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] text-muted mb-1 text-right">{label}</label>
      <div className="relative">
        <div className="input-field !text-sm !py-2.5 !px-2 !text-center font-mono pointer-events-none">
          {display}
        </div>
        <input
          type="date"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
}

// Same idea for time.
function TimeField({
  label, value, onChange, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] text-muted mb-1 text-right">{label}</label>
      <div className="relative">
        <div className={`input-field !text-sm !py-2.5 !px-2 !text-center font-mono pointer-events-none ${disabled ? 'opacity-50' : ''}`}>
          {value || '—'}
        </div>
        <input
          type="time"
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}

// ─── Per-exercise notes + difficulty ────────────────────────────
// Quiet strip at the bottom of each exercise card. Shows the last-session difficulty as
// a subtle pill, lets the user rate THIS session, and expand a small notes textarea.
type Difficulty = 'too-easy' | 'easy' | 'ok' | 'hard';
const DIFF_LABEL: Record<Difficulty, string> = {
  'too-easy': 'קל מדי', easy: 'קל', ok: 'בסדר', hard: 'קשה',
};
const DIFF_COLOR: Record<Difficulty, string> = {
  'too-easy': 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/40',
  easy: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40',
  ok: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40',
  hard: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40',
};

export function ExerciseInline({ uid, exerciseName, sessionId }: { uid: string; exerciseName: string; sessionId: string }) {
  const firestore = useFirestore(uid);
  const exId = useMemo(() => exerciseIdOf(exerciseName), [exerciseName]);
  const [note, setNote] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [thisDiff, setThisDiff] = useState<Difficulty | null>(null); // rating for THIS session
  const [lastDiff, setLastDiff] = useState<Difficulty | null>(null); // rating from the previous (different) session
  const [loaded, setLoaded] = useState(false);
  const saveNoteTimer = useRef<any>(null);

  useEffect(() => {
    if (!exId) { setLoaded(true); return; }
    Promise.all([
      firestore.getExerciseNote(exId),
      firestore.getExerciseDifficultyForSession(exId, sessionId),
      firestore.getExerciseDifficulty(exId), // overall most-recent — may be this session or an older one
    ]).then(([n, thisSess, mostRecent]) => {
      setNote(n || '');
      if (thisSess?.difficulty) setThisDiff(thisSess.difficulty as Difficulty);
      // Show "last time" pill only if the most-recent rating is from a DIFFERENT session
      if (mostRecent?.difficulty && !thisSess) setLastDiff(mostRecent.difficulty as Difficulty);
      setLoaded(true);
    });
  }, [exId, sessionId]);

  function commitNote(v: string) {
    setNote(v);
    if (!exId) return;
    if (saveNoteTimer.current) clearTimeout(saveNoteTimer.current);
    saveNoteTimer.current = setTimeout(() => { firestore.saveExerciseNote(exId, v); }, 400);
  }

  async function rate(d: Difficulty) {
    if (!exId) return;
    // Tap the already-selected chip → clear the rating.
    if (thisDiff === d) {
      setThisDiff(null);
      await firestore.deleteExerciseDifficulty(exId, sessionId);
    } else {
      setThisDiff(d);
      await firestore.saveExerciseDifficulty(exId, sessionId, d, false);
    }
  }

  if (!loaded || !exId) return null;

  return (
    <div className="mt-2 pt-2 border-t border-subtle/40 space-y-1.5" dir="rtl">
      {/* Header row: last-difficulty pill (only when nothing rated this session) + note toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {lastDiff && !thisDiff && (
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${DIFF_COLOR[lastDiff]}`} title="פעם קודמת">
              פעם קודמת: {DIFF_LABEL[lastDiff]}
            </span>
          )}
        </div>
        {/* Always rendered so the header layout doesn't jump between read/edit modes. */}
        <button
          onClick={() => setEditingNote(v => !v)}
          className={`inline-flex items-center gap-1 text-[10px] transition-colors ${
            editingNote ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted hover:text-main'
          }`}
          title={editingNote ? 'סיים עריכה' : (note ? 'ערוך הערה' : 'הוסף הערה')}
        >
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          <span>{editingNote ? 'סיים' : (note ? 'ערוך הערה' : '+ הערה')}</span>
        </button>
      </div>

      {/* Difficulty chips — gentle selected state, click again to unselect */}
      <div className="flex flex-wrap gap-1">
        {(Object.keys(DIFF_LABEL) as Difficulty[]).map(d => {
          const active = thisDiff === d;
          return (
            <button
              key={d}
              onClick={() => rate(d)}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                active ? DIFF_COLOR[d] : 'border-subtle text-muted hover:text-main'
              }`}
              title={active ? 'לחץ שוב לביטול' : undefined}
            >{DIFF_LABEL[d]}</button>
          );
        })}
      </div>

      {/* Note — reading mode is clean text; editing mode is a textarea */}
      {editingNote ? (
        // No onBlur — we rely on the header "סיים" button, so tapping the button doesn't
        // race with a blur that would flip editingNote before the click handler runs.
        // The note itself is autosaved on typing (debounced).
        <textarea
          value={note}
          onChange={(e) => commitNote(e.target.value)}
          autoFocus
          rows={2}
          placeholder="הערה אישית לתרגיל (טכניקה, זווית, טיפ...)"
          className="w-full text-[12px] rounded-lg border border-emerald-500/30 dark:bg-slate-900/40 bg-white p-2 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
        />
      ) : note ? (
        <button
          onClick={() => setEditingNote(true)}
          className="w-full text-right text-[12px] text-slate-600 dark:text-slate-300 italic leading-snug px-0.5 py-0.5"
          title="לחץ לעריכה"
        >
          <span className="text-muted-most not-italic ml-1">"</span>
          {note}
          <span className="text-muted-most not-italic mr-1">"</span>
        </button>
      ) : null}
    </div>
  );
}

// ─── Aerobic section — lives BELOW all muscle exercise cards ───────────
// Types are free-form Hebrew names (loaded from the exercises DB). We keep a small icon map
// for the 5 seeded defaults; unknown types fall back to a neutral dot.
const AEROBIC_ICON_BY_HE: Record<string, string> = {
  'ריצה': '🏃', 'אופניים': '🚴', 'חתירה': '🚣', 'הליכה': '🚶', 'אליפטיקל': '⚙',
};
function aerobicIcon(t: string): string { return AEROBIC_ICON_BY_HE[t] || '·'; }
function aerobicLabel(t: string): string { return t; }

function AerobicSection({ entries, planning, readOnly, onAdd, onEdit, onDelete }: {
  entries: AerobicEntry[];
  planning?: boolean;
  readOnly?: boolean;
  onAdd: () => void;
  onEdit: (e: AerobicEntry) => void;
  onDelete: (id: string) => void;
}) {
  const totalMin = entries.reduce((s, e) => s + (e.minutes || 0), 0);
  const label = planning ? 'אירובי מתוכנן' : 'אירובי';
  return (
    <section className="mb-4" dir="rtl">
      {/* Divider strip — always present so the boundary between muscle and cardio is obvious */}
      <div className="relative my-4 flex items-center gap-3">
        <div className="flex-1 h-px bg-gradient-to-l from-transparent via-cyan-500/40 to-cyan-500/40" />
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-cyan-700 dark:text-cyan-300 uppercase tracking-widest">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M13.5 5.5c1.4 0 2.5-1.1 2.5-2.5S14.9.5 13.5.5 11 1.6 11 3s1.1 2.5 2.5 2.5zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/></svg>
          <span>{label}{totalMin > 0 ? ` · ${totalMin} דק'` : ''}</span>
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-cyan-500/40" />
      </div>

      {entries.length === 0 && !readOnly ? (
        <button
          onClick={onAdd}
          className="w-full py-3 rounded-xl border border-dashed border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10 text-sm font-semibold"
        >+ {planning ? 'הוסף אירובי לתוכנית' : 'הוסף אימון אירובי'}</button>
      ) : entries.length === 0 && readOnly ? null : (
        <div className="space-y-3">
          {entries.map(e => (
            /* Structured like an exercise card: title + English on top, cyan "muscle-style"
               chip beside it, duration/metrics under, and a bottom-border row with the
               red trash button — same shape and delete placement the exercise cards use. */
            <div key={e.id} className="card mb-0 relative" dir="rtl">
              <button
                onClick={() => !readOnly && onEdit(e)}
                disabled={readOnly}
                className={`w-full text-right ${readOnly ? 'cursor-default' : ''}`}
                dir="rtl"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="text-right flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg leading-none">{aerobicIcon(e.type)}</span>
                      <div className="text-base font-bold leading-tight">{aerobicLabel(e.type)}</div>
                    </div>
                    {e.notes && (
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 text-right italic leading-snug">"{e.notes}"</div>
                    )}
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300">
                    <span>אירובי</span>
                  </span>
                </div>
                <div className="flex items-baseline gap-3" dir="rtl">
                  <div className="inline-flex items-baseline gap-1">
                    <span className="font-mono font-bold text-lg text-cyan-700 dark:text-cyan-300">{e.minutes}</span>
                    <span className="text-[10px] text-muted">דק'</span>
                  </div>
                  {e.km != null && (
                    <div className="inline-flex items-baseline gap-1">
                      <span className="font-mono font-bold text-lg text-cyan-700 dark:text-cyan-300">{e.km}</span>
                      <span className="text-[10px] text-muted">ק"מ</span>
                    </div>
                  )}
                  {e.avgHr != null && (
                    <div className="inline-flex items-baseline gap-1">
                      <span className="font-mono font-bold text-sm text-cyan-700 dark:text-cyan-300">♥ {e.avgHr}</span>
                    </div>
                  )}
                </div>
              </button>
              {!readOnly && (
                <div className="flex justify-end mt-3 pt-3 border-t border-subtle/60">
                  <button
                    onClick={(ev) => { ev.stopPropagation(); onDelete(e.id); }}
                    aria-label="מחק"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-red-500 hover:bg-red-500/10"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
          {!readOnly && (
            <button
              onClick={onAdd}
              className="w-full py-2 rounded-xl border border-dashed border-cyan-500/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10 text-xs font-semibold"
            >+ עוד אירובי</button>
          )}
        </div>
      )}
    </section>
  );
}
