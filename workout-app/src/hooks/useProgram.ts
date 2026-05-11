import { useEffect, useState } from 'react';
import { PROGRAM } from '../data/program';
import { useFirestore } from './useFirestore';

export function getAutoWeek(startDateIso: string = PROGRAM.startDate): number {
  const now = new Date();
  const start = new Date(startDateIso);
  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.min(12, Math.floor(diffDays / 7) + 1));
}

// Returns YYYY-MM-DD for the local-calendar day of a timestamp (00:00 of that day)
function localDateIso(timestamp: number): string {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Resolves program start as: manual override > earliest completed session > hardcoded constant.
export function useProgramStart(uid: string | null): string {
  const [start, setStart] = useState<string>(PROGRAM.startDate);
  const { getSessions, getProgramStartOverride } = useFirestore(uid);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const override = await getProgramStartOverride();
        if (override) {
          if (!cancelled) setStart(override);
          return;
        }
        const sessions = await getSessions();
        const earliest = sessions
          .filter(s => s.completed)
          .reduce<number | null>((min, s) => {
            const t = s.completedAt || s.date;
            if (min === null || t < min) return t;
            return min;
          }, null);
        if (earliest != null && !cancelled) {
          setStart(localDateIso(earliest));
        }
      } catch {
        // keep default
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  return start;
}

export function useProgram(weekOverride?: number, programStartIso?: string) {
  const startIso = programStartIso || PROGRAM.startDate;
  const autoWeek = getAutoWeek(startIso);
  const weekNumber = weekOverride ?? autoWeek;

  const currentPhase = PROGRAM.phases.find(
    (p) => weekNumber >= p.weeks[0] && weekNumber <= p.weeks[1]
  ) || PROGRAM.phases[0];

  return {
    program: PROGRAM,
    weekNumber,
    autoWeek,
    phase: currentPhase,
    totalWeeks: 12,
    programStart: startIso,
  };
}
