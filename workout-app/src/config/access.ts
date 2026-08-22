// Who may keep using מצב, and how they reach Shlomi.
//
// A new account gets a free week. After that the app stops and offers a way to
// ask for more. Contact details are NOT part of that gate — they are exported
// separately and shown in Settings at all times, because "how do I reach a
// human" must never be something you have to get locked out to discover.
//
// Nothing here trusts the client for enforcement; this is a product gate on a
// single-operator app, not a security boundary. The Firestore rules are open by
// design and anyone determined can edit their own profile doc. That is fine —
// the point is to end a trial politely, not to defend against its owner.

export const TRIAL_DAYS = 7;

export const CONTACT = {
  /** As written to a human. */
  phone: '054-5567213',
  /** E.164 without the +, which is what wa.me expects. */
  whatsapp: '972545567213',
  email: 'shlomi@boostart.io',
};

export const DAY_MS = 24 * 60 * 60 * 1000;

/** A wa.me deep link with the message pre-filled. */
export function waLink(text: string): string {
  return `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`;
}

export function mailLink(subject: string): string {
  return `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}`;
}

export type TrialStatus =
  /** Owner, or someone explicitly granted open access — never gated. */
  | 'exempt'
  /** Inside the free week. */
  | 'active'
  /** Week is up. */
  | 'expired';

export type TrialState = {
  status: TrialStatus;
  /** Whole days still available, rounded up. 0 once expired. */
  daysLeft: number;
  /** When access ends. 0 for exempt accounts. */
  endsAt: number;
};

/** Fields the gate reads off users/{uid}/profile/main. All optional — an old
 *  account that predates the trial simply has none of them. */
export type AccessFields = {
  /** Stamped once, the first time the account is seen after this shipped. */
  trialStartedAt?: number;
  /** Manual override: set true in Firestore to give someone permanent access
   *  without a deploy. */
  trialExempt?: boolean;
  /** Manual override: epoch ms to extend access to a specific date. */
  accessUntil?: number;
};

/**
 * Decide where an account stands.
 *
 * `isOwner` is passed in rather than read from a uid list here so this file
 * stays free of identity concerns and can be unit-reasoned about on its own.
 */
export function trialStateOf(
  fields: AccessFields | null | undefined,
  isOwner: boolean,
  now: number = Date.now(),
): TrialState {
  if (isOwner || fields?.trialExempt) {
    return { status: 'exempt', daysLeft: 0, endsAt: 0 };
  }

  // A manual extension wins over the trial window whenever it is the later date.
  const trialEnd = (fields?.trialStartedAt ?? now) + TRIAL_DAYS * DAY_MS;
  const endsAt = Math.max(trialEnd, fields?.accessUntil ?? 0);

  if (now >= endsAt) return { status: 'expired', daysLeft: 0, endsAt };

  // Round up: with 20 hours left you have "1 day", not "0".
  const daysLeft = Math.max(1, Math.ceil((endsAt - now) / DAY_MS));
  return { status: 'active', daysLeft, endsAt };
}

/** "נותרו 3 ימים" / "נותר יום אחד" — Hebrew needs the singular form. */
export function daysLeftLabel(daysLeft: number): string {
  if (daysLeft <= 1) return 'נותר יום אחרון';
  if (daysLeft === 2) return 'נותרו יומיים';
  return `נותרו ${daysLeft} ימים`;
}
