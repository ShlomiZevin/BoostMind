import { useMemo } from 'react';
import { useCtx } from '../context/StoryboardContext';
import { estimateLineDuration, formatDuration, getLineWordCount } from '../hooks/useTiming';

export function SelectionBar() {
  const { data, selectedLines, clearSelection, selectAll } = useCtx();

  const stats = useMemo(() => {
    if (selectedLines.size === 0) return null;

    let words = 0;
    let planned = 0;
    let actual = 0;
    let hasActual = false;
    const texts: string[] = [];

    for (const scene of data.scenes) {
      for (const line of scene.lines) {
        if (!selectedLines.has(line.id)) continue;
        words += getLineWordCount(line, data.columns);
        planned += estimateLineDuration(line, data.timing, data.columns);
        if (line.actualDuration != null) {
          actual += line.actualDuration;
          hasActual = true;
        }
        // Collect text for copy
        const allText = [line.text, ...Object.values(line.fields || {})]
          .filter(Boolean).join(' ').trim();
        if (allText) texts.push(allText);
      }
    }

    return { words, planned, actual, hasActual, texts };
  }, [selectedLines, data]);

  if (!stats) return null;

  function copyText() {
    if (!stats) return;
    navigator.clipboard.writeText(stats.texts.join('\n'));
  }

  function copyAll() {
    const allTexts: string[] = [];
    for (const scene of data.scenes) {
      allTexts.push(`--- ${scene.title} ---`);
      for (const line of scene.lines) {
        const text = [line.text, ...Object.values(line.fields || {})]
          .filter(Boolean).join(' ').trim();
        if (text) allTexts.push(text);
      }
      allTexts.push('');
    }
    navigator.clipboard.writeText(allTexts.join('\n'));
  }

  const totalLines = data.scenes.reduce((s, sc) => s + sc.lines.length, 0);
  const allSelected = selectedLines.size === totalLines;

  return (
    <div className="selection-bar">
      <div className="sb-right">
        <button className="sb-select-all" onClick={selectAll}>
          {allSelected ? '☑' : '☐'} הכל
        </button>
        <span className="sb-count">{selectedLines.size} שורות נבחרו</span>
        <button className="sb-clear" onClick={clearSelection}>✕</button>
      </div>
      <div className="sb-stats">
        <span className="sb-stat">📝 {stats.words} מילים</span>
        <span className="sb-stat">⏱ {formatDuration(stats.planned)} תכנון</span>
        {stats.hasActual && (
          <span className="sb-stat">⏱ {formatDuration(stats.actual)} בפועל</span>
        )}
      </div>
      <div className="sb-actions">
        <button className="sb-btn" onClick={copyText}>📋 העתק בחירה</button>
        <button className="sb-btn sb-btn-secondary" onClick={copyAll}>📋 העתק הכל</button>
      </div>
    </div>
  );
}
