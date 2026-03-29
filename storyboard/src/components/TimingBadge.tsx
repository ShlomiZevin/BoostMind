import { useState, useRef, useEffect } from 'react';
import { Line } from '../types';
import { estimateLineDuration, formatDuration, getLineWordCount } from '../hooks/useTiming';
import { useCtx } from '../context/StoryboardContext';
import { Tooltip } from './Tooltip';

interface Props {
  line: Line;
  sceneId: string;
}

export function TimingBadge({ line, sceneId }: Props) {
  const { mode, data, updateLine } = useCtx();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const duration = estimateLineDuration(line, data.timing, data.columns);
  const isOverridden = line.durationOverride != null;

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  function startEdit() {
    if (mode !== 'edit') return;
    setDraft(String(duration));
    setEditing(true);
  }

  function confirm() {
    const val = parseInt(draft, 10);
    if (!isNaN(val) && val > 0) {
      updateLine(sceneId, line.id, { durationOverride: val });
    }
    setEditing(false);
  }

  function reset() {
    updateLine(sceneId, line.id, { durationOverride: null });
    setEditing(false);
  }

  if (editing) {
    return (
      <span className="timing-edit" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); confirm(); }
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={confirm}
          min={1}
        />
        {isOverridden && (
          <button className="timing-reset" onMouseDown={e => { e.preventDefault(); reset(); }} title="חזור לאוטומטי">↺</button>
        )}
      </span>
    );
  }

  const actual = line.actualDuration;
  const hasActual = actual != null;
  const diff = hasActual ? actual! - duration : 0;
  const diffClass = hasActual
    ? (diff > 2 ? 'over' : diff < -2 ? 'under' : 'ok')
    : '';

  const words = getLineWordCount(line, data.columns);

  const plannedTooltip = isOverridden
    ? `זמן מתוכנן (ידני): ${duration} שניות`
    : `זמן מתוכנן: ${duration} שניות`;

  const actualTooltip = hasActual
    ? `\u200Eזמן בפועל: ${actual}s (הפרש: \u200E${diff > 0 ? '+' : ''}${diff}s)`
    : '';

  return (
    <span className="timing-badge-wrap">
      {line.type !== 'direction' && (
        <Tooltip text={`${words} מילים בשורה`}>
          <span className="timing-words">{words}w</span>
        </Tooltip>
      )}
      <Tooltip text={plannedTooltip}>
        <span
          className={`timing-badge ${isOverridden ? 'manual' : ''}`}
          onClick={e => { e.stopPropagation(); startEdit(); }}
        >
          {formatDuration(duration)}
        </span>
      </Tooltip>
      {hasActual && (
        <Tooltip text={actualTooltip}>
          <span className={`timing-badge-actual ${diffClass}`}>
            {formatDuration(actual!)}
          </span>
        </Tooltip>
      )}
    </span>
  );
}
