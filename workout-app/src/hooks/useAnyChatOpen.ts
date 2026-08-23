import { useEffect, useState } from 'react';

// Cross-component signal for "some chat panel is open somewhere in the app".
//
// Why: useChatNotifier lives in App.tsx and takes a `paused` flag so it won't
// fire a toast for the very chat the user is currently reading. The trainer
// panel + food-chat both live in App.tsx and their open states are trivially
// available there. FreeSession, though, hosts its OWN chat panel — and that
// state was never bubbled up, so replies landing in-session raised phantom
// "coach answered" toasts even though the user was already looking at it.
//
// This module is a tiny event-based counter (mirrors useAiTrainerPanel): a
// singleton int that any chat panel bumps up on mount and back down on
// unmount, plus a hook the App shell subscribes to for the boolean.
//
// Counter (not boolean) so nested / overlapping opens don't collapse each
// other prematurely — closing one panel while another is still open keeps
// the notifier paused.

const EVT = 'any-chat:changed';
let openCount = 0;

function bump(delta: number): void {
  openCount = Math.max(0, openCount + delta);
  window.dispatchEvent(new Event(EVT));
}

/** Any chat panel mounting should call this from an effect and use the
 *  returned function as cleanup. Idempotent per-caller thanks to React's
 *  effect semantics — mount adds one, unmount subtracts one. */
export function registerChatOpen(): () => void {
  bump(1);
  return () => bump(-1);
}

export function useAnyChatOpen(): boolean {
  const [c, setC] = useState<number>(() => openCount);
  useEffect(() => {
    const onChange = () => setC(openCount);
    window.addEventListener(EVT, onChange);
    return () => window.removeEventListener(EVT, onChange);
  }, []);
  return c > 0;
}
