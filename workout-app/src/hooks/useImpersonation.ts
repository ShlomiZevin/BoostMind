import { createContext, useContext } from 'react';

// Shared "am I in coach-viewing-trainee mode?" flag. Provided by the shell
// only when a coach is impersonating a trainee. Components anywhere in the
// tree can read it via `useImpersonation().isImpersonating` and hide or
// disable actions that only the trainee themselves should perform (log a
// set, log a meal, mark a session complete).

type ImpersonationContext = {
  isImpersonating: boolean;
  /** The coach's raw Firebase Auth uid (present only when impersonating). */
  coachAuthUid?: string | null;
  /** The trainee being viewed, for messaging. */
  traineeUid?: string | null;
  traineeEmail?: string | null;
  traineeName?: string | null;
};

const DEFAULT: ImpersonationContext = { isImpersonating: false };

export const ImpersonationCtx = createContext<ImpersonationContext>(DEFAULT);

export function useImpersonation(): ImpersonationContext {
  return useContext(ImpersonationCtx);
}
