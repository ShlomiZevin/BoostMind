// Emails that get write access to the GLOBAL exercise DB (top-level
// `exercises` collection). Same pattern as COACHER_EMAILS / BETA_TESTER_EMAILS:
// hardcoded roster, no Firestore round-trip, no deploy needed to add — just
// push a code change.
//
// A DB manager can edit any exercise for EVERY user via the desktop admin
// page (#/exercises-admin). Regular users' edits still fork off as personal
// overrides — only DB managers write to the shared source of truth.

export const DB_MANAGER_EMAILS: ReadonlySet<string> = new Set([
  'shlomi@boostart.io',
  'sergiokatz78@gmail.com',
]);

export function isDbManagerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return DB_MANAGER_EMAILS.has(email.toLowerCase());
}
