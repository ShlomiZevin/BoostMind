import { useEffect, useState } from 'react';

// Session-scoped signal — DELIBERATELY not persisted. Opening the trainer panel is
// an ephemeral UI act; on reload the app should always land on Home clean.
// Multiple components subscribe (button + panel host) via a custom event.
const EVT = 'ai-trainer:changed';
let current = false;

function read(): boolean { return current; }
function write(next: boolean) {
  current = next;
  window.dispatchEvent(new Event(EVT));
}

export function useAiTrainerPanel() {
  const [open, setOpen] = useState<boolean>(read);
  useEffect(() => {
    const onChange = () => setOpen(read());
    window.addEventListener(EVT, onChange);
    return () => window.removeEventListener(EVT, onChange);
  }, []);
  return {
    open,
    openPanel: () => write(true),
    closePanel: () => write(false),
    toggle: () => write(!read()),
  };
}
