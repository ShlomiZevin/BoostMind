import { useState, useEffect, useCallback, useRef } from 'react';

export function useTimer() {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const hasAlerted = useRef(false);
  // iOS Safari (incl. PWAs) blocks AudioContext until it's created inside a user gesture and
  // resumed. Create it once on `start()` — which IS a user gesture — and reuse it later when
  // the chime fires from a setInterval callback (which isn't a user gesture on its own).
  const audioCtxRef = useRef<AudioContext | null>(null);

  const start = useCallback((durationSeconds: number) => {
    const end = Date.now() + durationSeconds * 1000;
    setEndsAt(end);
    setRemaining(durationSeconds);
    setIsRunning(true);
    hasAlerted.current = false;
    // Prime audio while we still have the gesture. Some iOS versions also need a silent tone
    // played immediately to fully unlock the audio pipeline; do that too.
    try {
      if (!audioCtxRef.current) {
        const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (Ctor) audioCtxRef.current = new Ctor();
      }
      const ctx = audioCtxRef.current;
      if (ctx) {
        if (ctx.state === 'suspended') ctx.resume().catch(() => { /* ignore */ });
        // Silent unlock ping — 1 sample at zero gain. Enough for iOS to enable playback.
        const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
      }
    } catch { /* audio unavailable — timer still runs, just silent */ }
  }, []);

  const skip = useCallback(() => {
    setEndsAt(null);
    setRemaining(0);
    setIsRunning(false);
  }, []);

  const addTime = useCallback((seconds: number) => {
    setEndsAt(prev => prev ? prev + seconds * 1000 : null);
  }, []);

  useEffect(() => {
    if (!isRunning || !endsAt) return;

    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0 && !hasAlerted.current) {
        hasAlerted.current = true;
        // Pleasant three-note "done" chime — C5 → E5 → G5 (major triad).
        // Reuse the AudioContext unlocked during start() so iOS actually plays it.
        try {
          let ctx = audioCtxRef.current;
          if (!ctx) {
            const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (Ctor) { ctx = new Ctor(); audioCtxRef.current = ctx; }
          }
          if (!ctx) throw new Error('no audio');
          if (ctx.state === 'suspended') ctx.resume().catch(() => { /* ignore */ });
          const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
          const start = ctx.currentTime + 0.02;
          const noteDur = 0.55;
          const stagger = 0.14;
          notes.forEach((freq, i) => {
            const t0 = start + i * stagger;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t0);
            // Soft envelope: quick attack, exponential decay → bell-like.
            gain.gain.setValueAtTime(0.0001, t0);
            gain.gain.exponentialRampToValueAtTime(0.28, t0 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + noteDur);
            osc.connect(gain).connect(ctx.destination);
            osc.start(t0);
            osc.stop(t0 + noteDur + 0.05);
          });
          // Keep the context alive for the next timer — don't close.
        } catch (_) { /* audio unavailable — no-op */ }

        // Vibrate — short pattern, matches the chime rhythm.
        if (navigator.vibrate) {
          navigator.vibrate([80, 60, 80, 60, 160]);
        }

        // Notifications intentionally removed — unreliable on iOS PWA when backgrounded;
        // in-app beep + vibrate cover the case where the app is visible.

        setIsRunning(false);
      }
    };

    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [isRunning, endsAt]);

  return { remaining, isRunning, start, skip, addTime, isDone: !isRunning && endsAt !== null && remaining === 0 };
}
