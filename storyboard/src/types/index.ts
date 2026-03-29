export interface Comment {
  id: string;
  lineId: string;
  sceneId: string;
  author: string;
  text: string;
  createdAt: number;
  resolved: boolean;
}

export interface ColumnConfig {
  id: string;
  name: string;
  width?: string; // e.g. '1fr', '2fr'
}

export interface Line {
  id: string;
  type: 'dialogue' | 'direction';
  speaker?: string;
  text: string; // backward compat — first column
  fields?: Record<string, string>; // additional columns keyed by column id
  durationOverride?: number | null; // manual override in seconds
  actualDuration?: number | null;   // stopwatch recorded seconds
}

export interface Scene {
  id: string;
  title: string;
  highlight?: boolean;
  lines: Line[];
}

export interface ColumnPreset {
  name: string;
  columns: ColumnConfig[];
}

export interface TimingConfig {
  wordsPerSecond: number;     // speech rate (default 3)
  minDialogueSec: number;     // minimum for dialogue lines (default 1)
  minDirectionSec: number;    // minimum for direction lines (default 2)
}

export interface StoryboardConfig {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  speakers: SpeakerConfig[];
  columns: ColumnConfig[];
  timing: TimingConfig;
  scenes: Scene[];
}

export interface SpeakerConfig {
  id: string;
  name: string;
  color: string;
  bgColor: string;
  isDirection?: boolean;
}

export interface Version {
  id: string;
  name: string;
  createdAt: number;
  snapshot: Omit<StoryboardConfig, 'id'>;
}

export type ViewMode = 'edit' | 'review';
