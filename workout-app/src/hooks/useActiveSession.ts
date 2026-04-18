// Tracks active (incomplete) sessions in localStorage for bulletproof resume.
// Firestore query may be slow or miss data on cold start — this is the source of truth.

const STORAGE_KEY = 'workout-active-sessions';

type ActiveSessions = Record<string, { sessionId: string; day: number; timestamp: number }>;

function load(): ActiveSessions {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function save(data: ActiveSessions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function setActiveSession(day: number, sessionId: string) {
  const data = load();
  data[String(day)] = { sessionId, day, timestamp: Date.now() };
  save(data);
}

export function getActiveSession(day: number): string | null {
  const data = load();
  return data[String(day)]?.sessionId || null;
}

export function clearActiveSession(day: number) {
  const data = load();
  delete data[String(day)];
  save(data);
}
