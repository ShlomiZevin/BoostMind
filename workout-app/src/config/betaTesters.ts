// Emails that get "beta tester" powers on sign-in. Beta testers can file
// bug/feature reports from inside the app (the reports panel) and see the
// ones they themselves filed — but not other users' reports. Filed reports
// still land in Shlomi's shared reports collection so he can triage them
// alongside his own.
//
// Same pattern as COACHER_EMAILS: keep the roster in code, no Firestore
// writes needed. Add more emails here as beta testers come on board.

export const BETA_TESTER_EMAILS: ReadonlySet<string> = new Set([
  'nati123678@gmail.com',
]);

export function isBetaTesterEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return BETA_TESTER_EMAILS.has(email.toLowerCase());
}
