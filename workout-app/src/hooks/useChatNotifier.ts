import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFirestore } from './useFirestore';
import type { ChatBucket, ChatThreadDoc } from '../types';

// "The coach answered" notification.
//
// The chat panel is a modal — you close it and go back to logging sets while the
// model is still writing. The server already persists the assistant reply to
// Firestore BEFORE responding, so the answer exists whether or not your tab was
// still listening. What was missing is the client half: something at app-shell
// level that notices the reply landed and tells you.
//
// This hook subscribes to the thread docs (not the messages — the server stamps
// `lastRole` / `lastAt` / `lastHasAction` on the thread precisely so one cheap
// listener per bucket is enough) and raises an alert for replies you haven't
// seen yet.

export type ChatAlert = {
  threadId: string;
  bucket: ChatBucket;
  title: string;
  ts: number;
  /** The reply carries a proposal awaiting approval — not just an answer. */
  hasAction: boolean;
};

// Buckets worth interrupting the user for. `naming` is a tool-ish side chat you
// only use while staring at the exercise DB, so it stays silent.
const WATCHED: ChatBucket[] = ['coach', 'dietary'];

function seenKey(uid: string): string { return `chatSeen:${uid}`; }

function readSeen(uid: string): number {
  try {
    const raw = localStorage.getItem(seenKey(uid));
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n)) return n;
  } catch { /* private mode / quota */ }
  // First run on this device: treat everything that already exists as seen, so
  // opening the app doesn't dump a week of old replies into a toast.
  const now = Date.now();
  try { localStorage.setItem(seenKey(uid), String(now)); } catch { /* ignore */ }
  return now;
}

function writeSeen(uid: string, ts: number): void {
  try { localStorage.setItem(seenKey(uid), String(ts)); } catch { /* ignore */ }
}

export function useChatNotifier(
  uid: string | null,
  opts: { paused?: boolean } = {},
): {
  alert: ChatAlert | null;
  pendingCount: number;
  /** Per-coach counts — the badge belongs on the coach it concerns, not on a
   *  shared control. */
  pendingByBucket: Record<string, number>;
  dismiss: () => void;
  markAllSeen: () => void;
} {
  const paused = !!opts.paused;
  const firestore = useFirestore(uid);
  const firestoreRef = useRef(firestore);
  firestoreRef.current = firestore;

  const [threadsByBucket, setThreadsByBucket] = useState<Record<string, ChatThreadDoc[]>>({});
  const [seenAt, setSeenAt] = useState<number>(() => (uid ? readSeen(uid) : Date.now()));
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Re-read the watermark when the account changes.
  useEffect(() => {
    if (!uid) return;
    setSeenAt(readSeen(uid));
    setDismissedIds(new Set());
    setThreadsByBucket({});
  }, [uid]);

  // One listener per watched bucket, merged by bucket key.
  useEffect(() => {
    if (!uid) return;
    const unsubs = WATCHED.map(bucket =>
      firestoreRef.current.subscribeToChatThreads(bucket, list => {
        setThreadsByBucket(prev => ({ ...prev, [bucket]: list }));
      }),
    );
    return () => { for (const u of unsubs) { try { u(); } catch { /* ignore */ } } };
  }, [uid]);

  // Unseen assistant replies, newest first. NOT filtered by `dismissedIds` —
  // dismissing hides the toast, it does not mark the reply as read.
  const unseen = useMemo<ChatAlert[]>(() => {
    const out: ChatAlert[] = [];
    for (const bucket of WATCHED) {
      for (const t of threadsByBucket[bucket] || []) {
        if (t.lastRole !== 'assistant') continue;
        const ts = t.lastAt || t.updatedAt || 0;
        if (ts <= seenAt) continue;
        out.push({
          threadId: t.id,
          bucket,
          title: t.title || 'שיחה',
          ts,
          hasAction: !!t.lastHasAction,
        });
      }
    }
    return out.sort((a, b) => b.ts - a.ts);
  }, [threadsByBucket, seenAt]);

  /** What the toast may show — dismissal applies here and here only. */
  const toastable = useMemo(
    () => unseen.filter(a => !dismissedIds.has(a.threadId)),
    [unseen, dismissedIds],
  );

  // While the panel is open the user is already looking at the answer — keep the
  // watermark moving so closing it doesn't immediately raise a stale alert.
  useEffect(() => {
    if (!uid || !paused || unseen.length === 0) return;
    const newest = unseen[0].ts;
    setSeenAt(newest);
    writeSeen(uid, newest);
  }, [uid, paused, unseen]);

  const markAllSeen = useCallback(() => {
    if (!uid) return;
    const now = Date.now();
    setSeenAt(now);
    writeSeen(uid, now);
    setDismissedIds(new Set());
  }, [uid]);

  // Dismissing hides the toast but deliberately does NOT advance the watermark:
  // an un-approved proposal should keep its badge until you actually open it.
  const dismiss = useCallback(() => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      for (const a of toastable) next.add(a.threadId);
      return next;
    });
  }, [toastable]);

  return {
    alert: paused ? null : (toastable[0] || null),
    // Counts every unapproved proposal, dismissed or not — the badge is the
    // thing that persists until you actually open the chat.
    pendingCount: unseen.filter(a => a.hasAction).length,
    pendingByBucket: unseen.filter(a => a.hasAction).reduce((acc, a) => {
      acc[a.bucket] = (acc[a.bucket] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    dismiss,
    markAllSeen,
  };
}
