import { useState, useRef, useEffect } from 'react';
import { Line } from '../types';
import { estimateLineDuration, formatDuration } from '../hooks/useTiming';
import { useCtx } from '../context/StoryboardContext';

interface Props {
  line: Line;
  sceneId: string;
}

export function Stopwatch({ line, sceneId }: Props) {
  const { data, updateLine } = useCtx();
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const startRef = useRef(0);

  const planned = estimateLineDuration(line, data.timing, data.columns, data.speakers);
  const actual = line.actualDuration;
  const hasActual = actual != null;

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  function start() {
    startRef.current = Date.now();
    setElapsed(0);
    setRunning(true);
    intervalRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 200);
  }

  function stop() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    const finalElapsed = Math.max(1, Math.floor((Date.now() - startRef.current) / 1000));
    setElapsed(finalElapsed);
    setRunning(false);
    updateLine(sceneId, line.id, { actualDuration: finalElapsed });
  }

  function clear() {
    updateLine(sceneId, line.id, { actualDuration: null } as any);
    setElapsed(0);
  }

  const diffClass = hasActual
    ? (actual! - planned > 2 ? 'over' : actual! - planned < -2 ? 'under' : 'ok')
    : '';

  return (
    <div className="sw-bar">
      <div className="sw-controls">
        {running ? (
          <button className="sw-btn sw-stop" onClick={stop}>⏹</button>
        ) : (
          <button className="sw-btn sw-start" onClick={start}>▶</button>
        )}
      </div>

      <span className="sw-planned-val">תכנון: {formatDuration(planned)}</span>

      <span className="sw-separator">|</span>

      <span className={`sw-actual-val ${diffClass}`}>
        {running ? (
          <span className="sw-running-val">{formatDuration(elapsed)}</span>
        ) : hasActual ? (
          <>{formatDuration(actual!)}</>
        ) : (
          <span className="sw-empty-val">—</span>
        )}
      </span>

      {hasActual && !running && (
        <button className="sw-clear-btn" onClick={clear} title="נקה מדידה">✕</button>
      )}
    </div>
  );
}
