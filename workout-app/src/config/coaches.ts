// Emails that should auto-promote to `role: 'coacher'` on sign-in. Keeps the
// coach roster in code so a new coach onboarding doesn't require a manual
// Firestore write — they just sign in and the app upserts their role.
//
// If the number of coaches ever grows past a handful, move this to a Firestore
// `coaches` collection managed from the admin dashboard.

export const COACHER_EMAILS: ReadonlySet<string> = new Set([
  'sergiokatz78@gmail.com',
  'shlomi@boostart.io', // shlomi is also a coach for his own testing
]);

export function isCoacherEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return COACHER_EMAILS.has(email.toLowerCase());
}

// Pre-bound trainee → coach relationships, applied on sign-in when the
// trainee has no coachUid set yet. Value is the coach's RAW Firebase Auth
// uid (not the aliased app uid) — that's what Firestore rules compare
// against `request.auth.uid`.
//
// Handy for internal testing / demos where you want a fixed relationship
// without asking the trainee to click an invite link.
export const PRESET_TRAINEES: Record<string, string> = {
  // shazbak (test account) is bound to shlomi as coach
  'shazbak@gmail.com': 'rJLlCV393shl7njhzWZmoaE15Yp2',
};

export function presetCoachUidFor(email: string | null | undefined): string | null {
  if (!email) return null;
  return PRESET_TRAINEES[email.toLowerCase()] || null;
}
