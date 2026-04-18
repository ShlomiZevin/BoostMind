import { PROGRAM } from '../data/program';

export function getAutoWeek(): number {
  const now = new Date();
  const start = new Date(PROGRAM.startDate);
  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.min(12, Math.floor(diffDays / 7) + 1));
}

export function useProgram(weekOverride?: number) {
  const autoWeek = getAutoWeek();
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
  };
}
