import { useState, useEffect, useCallback, useRef } from 'react';

export function useTimer() {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const hasAlerted = useRef(false);

  const start = useCallback((durationSeconds: number) => {
    const end = Date.now() + durationSeconds * 1000;
    setEndsAt(end);
    setRemaining(durationSeconds);
    setIsRunning(true);
    hasAlerted.current = false;
    // Request notification permission on first timer use (needs user gesture for iOS)
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
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
        // Beep via Web Audio API
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.value = 0.3;
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
          // Second beep
          setTimeout(() => {
            try {
              const osc2 = ctx.createOscillator();
              const gain2 = ctx.createGain();
              osc2.connect(gain2);
              gain2.connect(ctx.destination);
              osc2.frequency.value = 880;
              gain2.gain.value = 0.3;
              osc2.start();
              osc2.stop(ctx.currentTime + 0.3);
            } catch (_) {}
          }, 400);
        } catch (_) {}

        // Vibrate
        if (navigator.vibrate) {
          navigator.vibrate([500, 200, 500]);
        }

        // Push notification (works when phone locked / app backgrounded)
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Rest Over!', { body: 'Time for the next set', icon: '/workout-app/icon-192.svg', tag: 'rest-timer' });
        }

        setIsRunning(false);
      }
    };

    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [isRunning, endsAt]);

  return { remaining, isRunning, start, skip, addTime, isDone: !isRunning && endsAt !== null && remaining === 0 };
}
