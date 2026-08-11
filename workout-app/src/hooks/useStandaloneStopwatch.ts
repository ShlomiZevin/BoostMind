import { useEffect, useState } from 'react';

// Global on/off for the standalone Chronograph. Lives in localStorage so it survives reloads,
// and syncs across components in the same tab via a custom event (localStorage's own storage
// event only fires cross-tab).
const KEY = 'stopwatch:standaloneOpen';
const EVT = 'stopwatch:changed';

function readOpen(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function useStandaloneStopwatch() {
  const [open, setOpen] = useState<boolean>(readOpen);

  useEffect(() => {
    const onChange = () => setOpen(readOpen());
    window.addEventListener(EVT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  function toggle() {
    const next = !readOpen();
    try { localStorage.setItem(KEY, next ? '1' : '0'); } catch { /* ignore */ }
    window.dispatchEvent(new Event(EVT));
  }
  function set(next: boolean) {
    try { localStorage.setItem(KEY, next ? '1' : '0'); } catch { /* ignore */ }
    window.dispatchEvent(new Event(EVT));
  }

  return { open, toggle, set };
}
