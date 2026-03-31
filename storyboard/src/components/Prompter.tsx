import { useState, useEffect, useRef, useCallback } from 'react';
import { useCtx } from '../context/StoryboardContext';

interface PrompterSettings {
  fontSize: number;
  speed: number; // pixels per second
  dark: boolean;
  mirrored: boolean;
}

const DEFAULTS: PrompterSettings = {
  fontSize: 48,
  speed: 60,
  dark: true,
  mirrored: false,
};

export function Prompter({ onClose }: { onClose: () => void }) {
  const { data } = useCtx();
  const [settings, setSettings] = useState<PrompterSettings>(DEFAULTS);
  const [running, setRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  const scenes = data.scenes.map(scene => ({
    title: scene.title,
    lines: scene.lines.map(line => ({
      text: [line.text, ...Object.values(line.fields || {})].filter(Boolean).join(' ').trim(),
      isDirection: line.type === 'direction',
    })),
  }));

  const scroll = useCallback(() => {
    if (!scrollRef.current) return;
    const now = performance.now();
    const dt = (now - lastTimeRef.current) / 1000;
    lastTimeRef.current = now;
    scrollRef.current.scrollTop += settings.speed * dt;

    // Stop at bottom
    const el = scrollRef.current;
    if (el.scrollTop >= el.scrollHeight - el.clientHeight) {
      setRunning(false);
      return;
    }

    animRef.current = requestAnimationFrame(scroll);
  }, [settings.speed]);

  useEffect(() => {
    if (running) {
      lastTimeRef.current = performance.now();
      animRef.current = requestAnimationFrame(scroll);
    } else {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [running, scroll]);

  function togglePlay() {
    if (!running) setShowSettings(false);
    setRunning(!running);
  }

  function reset() {
    setRunning(false);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setShowSettings(true);
  }

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowUp') {
        if (running) {
          setSettings(s => ({ ...s, speed: Math.max(10, s.speed - 10) }));
        } else if (scrollRef.current) {
          scrollRef.current.scrollTop -= 80;
        }
      }
      if (e.key === 'ArrowDown') {
        if (running) {
          setSettings(s => ({ ...s, speed: s.speed + 10 }));
        } else if (scrollRef.current) {
          scrollRef.current.scrollTop += 80;
        }
      }
      if (e.key === '+' || e.key === '=') setSettings(s => ({ ...s, fontSize: s.fontSize + 4 }));
      if (e.key === '-') setSettings(s => ({ ...s, fontSize: Math.max(16, s.fontSize - 4) }));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [running]);

  const bg = settings.dark ? '#000' : '#fff';
  const fg = settings.dark ? '#fff' : '#000';
  const dimFg = settings.dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';

  return (
    <div className="prompter-overlay" style={{ background: bg, color: fg }}>
      {/* Settings panel */}
      {showSettings && (
        <div className="prompter-settings" onClick={e => e.stopPropagation()}>
          <h3 style={{ color: fg }}>הגדרות פרומפטר</h3>

          <div className="ps-row">
            <label>גודל גופן</label>
            <div className="ps-control">
              <button onClick={() => setSettings(s => ({ ...s, fontSize: Math.max(16, s.fontSize - 4) }))}>−</button>
              <span>{settings.fontSize}px</span>
              <button onClick={() => setSettings(s => ({ ...s, fontSize: s.fontSize + 4 }))}>+</button>
            </div>
          </div>

          <div className="ps-row">
            <label>מהירות גלילה</label>
            <div className="ps-control">
              <button onClick={() => setSettings(s => ({ ...s, speed: Math.max(10, s.speed - 10) }))}>−</button>
              <span>{settings.speed}px/s</span>
              <button onClick={() => setSettings(s => ({ ...s, speed: s.speed + 10 }))}>+</button>
            </div>
          </div>

          <div className="ps-row">
            <label>מצב</label>
            <div className="ps-toggle-group">
              <button
                className={settings.dark ? 'active' : ''}
                onClick={() => setSettings(s => ({ ...s, dark: true }))}
              >🌙 כהה</button>
              <button
                className={!settings.dark ? 'active' : ''}
                onClick={() => setSettings(s => ({ ...s, dark: false }))}
              >☀️ בהיר</button>
            </div>
          </div>

          <div className="ps-row">
            <label>שיקוף</label>
            <div className="ps-toggle-group">
              <button
                className={!settings.mirrored ? 'active' : ''}
                onClick={() => setSettings(s => ({ ...s, mirrored: false }))}
              >רגיל</button>
              <button
                className={settings.mirrored ? 'active' : ''}
                onClick={() => setSettings(s => ({ ...s, mirrored: true }))}
              >מראה</button>
            </div>
          </div>

          <div className="ps-hint" style={{ color: dimFg }}>
            Space = הפעלה/עצירה • ↑↓ = מהירות • +/- = גופן • Esc = יציאה
          </div>
        </div>
      )}

      {/* Scrolling text */}
      <div
        ref={scrollRef}
        className={`prompter-text ${running ? 'is-running' : ''}`}
        style={{
          fontSize: settings.fontSize,
          transform: settings.mirrored ? 'scaleX(-1)' : undefined,
        }}
        onClick={togglePlay}
      >
        <div className="prompter-spacer" />
        {scenes.map((scene, si) => (
          <div key={si} className="prompter-scene">
            <div className="prompter-scene-title" style={{ color: dimFg, fontSize: settings.fontSize * 0.5 }}>
              {scene.title}
            </div>
            {scene.lines.map((line, li) => (
              <div
                key={li}
                className={`prompter-line ${line.isDirection ? 'prompter-direction' : ''}`}
                style={line.isDirection ? { color: dimFg, fontSize: settings.fontSize * 0.7, fontStyle: 'italic' } : undefined}
              >
                {line.text}
              </div>
            ))}
          </div>
        ))}
        <div className="prompter-spacer" />
      </div>

      {/* Controls bar */}
      <div className="prompter-controls">
        <button className="pc-btn" onClick={onClose}>✕</button>
        <button className="pc-btn" onClick={reset}>⏮</button>
        <button className="pc-btn pc-play" onClick={togglePlay}>
          {running ? '⏸' : '▶'}
        </button>
        <button className="pc-btn" onClick={() => setShowSettings(!showSettings)}>⚙️</button>
        <span className="pc-speed" style={{ color: dimFg }}>{settings.speed}px/s</span>
      </div>
    </div>
  );
}
