import { useEffect } from 'react';

// Lock the background page's scroll while a fullscreen modal is open — otherwise the underlying
// exercise list scrolls behind the overlay (visible scroll bars, jittery iOS bounce, etc).
// Restores the previous overflow value on unmount so nested modals stack cleanly.
export function useBodyScrollLock() {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
}
