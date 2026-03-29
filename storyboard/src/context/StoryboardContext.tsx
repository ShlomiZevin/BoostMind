import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useStoryboard } from '../hooks/useStoryboard';
import { ViewMode, StoryboardConfig, Comment, ColumnConfig, Line, Version } from '../types';

interface StoryboardContextValue {
  data: StoryboardConfig;
  comments: Comment[];
  mode: ViewMode;
  reviewerName: string;
  setReviewerName: (name: string) => void;
  saving: boolean;
  dirty: boolean;
  loaded: boolean;
  activeLineId: string | null;
  setActiveLineId: (id: string | null) => void;
  showComments: boolean;
  setShowComments: (v: boolean) => void;
  save: () => Promise<void>;
  updateMeta: (updates: Partial<StoryboardConfig>) => void;
  updateLine: (sceneId: string, lineId: string, updates: Partial<Line>) => void;
  updateLineField: (sceneId: string, lineId: string, columnId: string, value: string) => void;
  setColumns: (columns: ColumnConfig[]) => void;
  insertLine: (sceneId: string, atIndex: number) => string;
  deleteLine: (sceneId: string, lineId: string) => void;
  cycleSpeaker: (sceneId: string, lineId: string) => void;
  addSpeaker: (name: string, color: string, bgColor: string) => void;
  toggleSpeakerDirection: (speakerId: string) => void;
  removeSpeaker: (speakerId: string) => void;
  updateSceneTitle: (sceneId: string, title: string) => void;
  toggleSceneHighlight: (sceneId: string) => void;
  addScene: (afterIndex: number) => void;
  deleteScene: (sceneId: string) => void;
  addComment: (lineId: string, sceneId: string, author: string, text: string) => Comment;
  resolveComment: (commentId: string) => void;
  deleteComment: (commentId: string) => void;
  versions: Version[];
  saveVersion: (name: string) => void;
  restoreVersion: (versionId: string) => void;
  setViewingLive: () => void;
  deleteVersion: (versionId: string) => void;
  onGoHome: () => void;
  timingMode: boolean;
  setTimingMode: (v: boolean) => void;
  selectedLines: Set<string>;
  toggleSelectLine: (lineId: string) => void;
  selectScene: (sceneId: string) => void;
  clearSelection: () => void;
  selectAll: () => void;
}

const Ctx = createContext<StoryboardContextValue | null>(null);

export function useCtx() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('Missing StoryboardProvider');
  return ctx;
}

export function StoryboardProvider({ children, storyboardId, onGoHome }: { children: ReactNode; storyboardId: string; onGoHome: () => void }) {
  const sb = useStoryboard(storyboardId);
  const [mode, setMode] = useState<ViewMode>('edit');
  const [reviewerName, setReviewerNameState] = useState(() => localStorage.getItem('sb-reviewer-name') || '');

  function setReviewerName(name: string) {
    setReviewerNameState(name);
    if (name) localStorage.setItem('sb-reviewer-name', name);
    else localStorage.removeItem('sb-reviewer-name');
  }
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(true);
  const [timingMode, setTimingMode] = useState(false);
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());

  function toggleSelectLine(lineId: string) {
    setSelectedLines(prev => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }

  function selectScene(sceneId: string) {
    const scene = sb.data.scenes.find(s => s.id === sceneId);
    if (!scene) return;
    setSelectedLines(prev => {
      const next = new Set(prev);
      const allSelected = scene.lines.every(l => next.has(l.id));
      scene.lines.forEach(l => allSelected ? next.delete(l.id) : next.add(l.id));
      return next;
    });
  }

  function clearSelection() { setSelectedLines(new Set()); }

  function selectAll() {
    const all = new Set<string>();
    sb.data.scenes.forEach(s => s.lines.forEach(l => all.add(l.id)));
    setSelectedLines(prev => prev.size === all.size ? new Set() : all);
  }

  // URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('review') === 'true') setMode('review');
    if (params.get('name')) setReviewerName(params.get('name')!);
  }, []);

  // Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        sb.save();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sb.save]);

  return (
    <Ctx.Provider value={{
      ...sb, mode, reviewerName, setReviewerName,
      activeLineId, setActiveLineId,
      showComments, setShowComments, onGoHome,
      timingMode, setTimingMode,
      selectedLines, toggleSelectLine, selectScene, clearSelection, selectAll,
    }}>
      {children}
    </Ctx.Provider>
  );
}
