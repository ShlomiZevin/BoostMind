import { useState, useMemo } from 'react';
import { useCtx } from '../context/StoryboardContext';
import { useTiming, formatDuration, estimateLineDuration, getLineActualOrPlanned } from '../hooks/useTiming';
import { Tooltip } from './Tooltip';

export function TimingBar() {
  const { data, mode, updateMeta, timingMode, setTimingMode } = useCtx();
  const { total, totalWords } = useTiming(data.scenes, data.timing, data.columns);
  const [open, setOpen] = useState(false);
  const timing = data.timing || { wordsPerSecond: 3, minDialogueSec: 1, minDirectionSec: 2 };

  // Calculate actual vs planned
  // Dialogue lines: only count if explicitly timed
  // Direction lines: always count (use planned if no actual)
  const timedStats = useMemo(() => {
    let actualSum = 0;
    let plannedForTimedSum = 0;
    let timedCount = 0;
    let hasAnyTimed = false;
    for (const scene of data.scenes) {
      for (const line of scene.lines) {
        const actual = getLineActualOrPlanned(line, data.timing, data.columns);
        if (actual > 0) {
          actualSum += actual;
          plannedForTimedSum += estimateLineDuration(line, data.timing, data.columns);
          timedCount++;
          if (line.actualDuration != null) hasAnyTimed = true;
        }
      }
    }
    if (!hasAnyTimed) return null;
    const gapPct = plannedForTimedSum > 0
      ? Math.round(((actualSum - plannedForTimedSum) / plannedForTimedSum) * 100)
      : 0;
    return { actualSum, plannedForTimedSum, timedCount, gapPct };
  }, [data.scenes, data.timing, data.columns]);

  function updateTiming(key: string, value: number) {
    updateMeta({ timing: { ...timing, [key]: value } } as any);
  }

  return (
    <div className={`timing-bar ${timingMode ? 'timing-active' : ''}`}>
      <div className="timing-bar-main">
        <div className="timing-totals">
          <Tooltip text="סה״כ מילים בתסריט">
            <span className="timing-total">
              📝 <strong>{totalWords}</strong> מילים
            </span>
          </Tooltip>
          <Tooltip text="סה״כ זמן מתוכנן">
            <span className="timing-total">
              ⏱ תכנון: <strong>{formatDuration(total)}</strong>
            </span>
          </Tooltip>
          {timedStats && (
            <span className={`timing-total timing-actual ${getActualClass(timedStats.gapPct)}`}>
              בפועל: <strong>{formatDuration(timedStats.actualSum)}</strong>
              <span className="timing-diff">
                / {formatDuration(timedStats.plannedForTimedSum)} תכנון <span dir="ltr">({timedStats.gapPct > 0 ? '+' : ''}{timedStats.gapPct}%)</span>
              </span>
              <span className="timing-diff-count">{timedStats.timedCount} שורות נמדדו</span>
            </span>
          )}
        </div>
        <div className="timing-bar-actions">
          {mode === 'edit' && (
            <>
              <button
                className={`timing-mode-btn ${timingMode ? 'active' : ''}`}
                onClick={() => setTimingMode(!timingMode)}
              >
                {timingMode ? '⏹ סיום מדידה' : '⏱ מצב מדידה'}
              </button>
              <button className="timing-settings-btn" onClick={() => setOpen(!open)}>
                ⚙️
              </button>
            </>
          )}
        </div>
      </div>

      {open && (
        <div className="timing-settings">
          <div className="ts-row">
            <label>מילים לשנייה (קצב דיבור)</label>
            <input
              type="number"
              value={timing.wordsPerSecond}
              onChange={e => updateTiming('wordsPerSecond', parseFloat(e.target.value) || 3)}
              min={1}
              max={10}
              step={0.5}
            />
          </div>
          <div className="ts-row">
            <label>מינימום לשורת דיאלוג (שניות)</label>
            <input
              type="number"
              value={timing.minDialogueSec}
              onChange={e => updateTiming('minDialogueSec', parseInt(e.target.value) || 1)}
              min={0}
              max={10}
            />
          </div>
          <div className="ts-row">
            <label>מינימום לשורת בימוי (שניות)</label>
            <input
              type="number"
              value={timing.minDirectionSec}
              onChange={e => updateTiming('minDirectionSec', parseInt(e.target.value) || 2)}
              min={0}
              max={10}
            />
          </div>
          <div className="ts-hint">לחץ על הזמן ליד כל שורה כדי לערוך ידנית</div>
        </div>
      )}
    </div>
  );
}

function getActualClass(gapPct: number): string {
  if (gapPct > 10) return 'over';
  if (gapPct < -10) return 'under';
  return 'ok';
}
