import { useMemo } from 'react';
import { Line, Scene, TimingConfig, ColumnConfig } from '../types';

const DEFAULT_TIMING: TimingConfig = {
  wordsPerSecond: 3,
  minDialogueSec: 1,
  minDirectionSec: 2,
};

const DEFAULT_COLUMNS: ColumnConfig[] = [{ id: 'text', name: 'טקסט', width: '1fr' }];

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function getLineWordCount(line: Line, columns?: ColumnConfig[]): number {
  // Direction lines don't count words
  if (line.type === 'direction') return 0;

  const cols = columns || [{ id: 'text', name: 'טקסט', width: '1fr' }];
  const texts: string[] = [];
  for (const col of cols) {
    if (col.id === 'text') {
      if (line.text) texts.push(line.text);
    } else {
      if (line.fields?.[col.id]) texts.push(line.fields[col.id]);
    }
  }
  return countWords(texts.join(' '));
}

export function getSceneWordCount(scene: Scene, columns?: ColumnConfig[]): number {
  return scene.lines.reduce((sum, line) => sum + getLineWordCount(line, columns), 0);
}

// For actual time: direction lines without actual timing use their planned time
export function getLineActualOrPlanned(line: Line, config?: TimingConfig, columns?: ColumnConfig[]): number {
  if (line.actualDuration != null) return line.actualDuration;
  if (line.type === 'direction') return estimateLineDuration(line, config, columns);
  return 0; // dialogue without actual = not timed yet
}

export function estimateLineDuration(line: Line, config?: TimingConfig, columns?: ColumnConfig[]): number {
  if (line.durationOverride != null) return line.durationOverride;

  const t = config || DEFAULT_TIMING;
  const cols = columns || DEFAULT_COLUMNS;

  // Only count words from active columns
  const texts: string[] = [];
  for (const col of cols) {
    if (col.id === 'text') {
      if (line.text) texts.push(line.text);
    } else {
      if (line.fields?.[col.id]) texts.push(line.fields[col.id]);
    }
  }

  const allText = texts.join(' ').trim();
  if (!allText) return line.type === 'direction' ? t.minDirectionSec : t.minDialogueSec;

  const words = countWords(allText);

  if (line.type === 'direction') {
    return Math.max(t.minDirectionSec, Math.ceil(words / t.wordsPerSecond));
  }

  return Math.max(t.minDialogueSec, Math.ceil(words / t.wordsPerSecond));
}

export function getSceneDuration(scene: Scene, config?: TimingConfig, columns?: ColumnConfig[]): number {
  return scene.lines.reduce((sum, line) => sum + estimateLineDuration(line, config, columns), 0);
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${m}:00`;
}

export function useTiming(scenes: Scene[], config?: TimingConfig, columns?: ColumnConfig[]) {
  return useMemo(() => {
    const c = config || DEFAULT_TIMING;
    const cols = columns || DEFAULT_COLUMNS;
    const sceneTimings = scenes.map(scene => ({
      id: scene.id,
      duration: getSceneDuration(scene, c, cols),
    }));
    const total = sceneTimings.reduce((sum, s) => sum + s.duration, 0);
    const totalWords = scenes.reduce((sum, s) => sum + getSceneWordCount(s, cols), 0);
    return { sceneTimings, total, totalWords };
  }, [scenes, config, columns]);
}
