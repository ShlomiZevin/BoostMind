import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { StoryboardConfig, Comment, ColumnConfig, Line, Version } from '../types';
import { defaultStoryboard } from '../config/defaultStoryboard';

const COLLECTION = 'storyboards';

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function useStoryboard(storyboardId: string) {
  const [data, setData] = useState<StoryboardConfig>(defaultStoryboard);
  const [comments, setComments] = useState<Comment[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const dataRef = useRef(data);
  const commentsRef = useRef(comments);
  const versionsRef = useRef(versions);
  const viewingVersionRef = useRef(false);

  dataRef.current = data;
  commentsRef.current = comments;
  versionsRef.current = versions;

  // Load from Firestore (with timeout fallback)
  useEffect(() => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        console.warn('Firestore timeout — using defaults');
        resolved = true;
        setLoaded(true);
      }
    }, 3000);

    const docRef = doc(db, COLLECTION, storyboardId);
    const unsub = onSnapshot(docRef, (snap) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
      }
      if (snap.exists()) {
        const d = snap.data();
        // Don't overwrite content when viewing a version snapshot
        if (!viewingVersionRef.current) {
          if (d.scenes) {
            setData(d as StoryboardConfig);
          }
          if (d.comments) {
            setComments(d.comments as Comment[]);
          }
        }
        // Always update versions list so dropdown stays current
        if (d.versions) {
          setVersions(d.versions as Version[]);
        }
      }
      setLoaded(true);
    }, (err) => {
      console.warn('Firestore error:', err);
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
      }
      setLoaded(true);
    });
    return () => { unsub(); clearTimeout(timeout); };
  }, [storyboardId]);

  // Save
  const save = useCallback(async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, COLLECTION, storyboardId), {
        ...dataRef.current,
        comments: commentsRef.current,
        versions: versionsRef.current,
        updatedAt: serverTimestamp(),
      });
      setDirty(false);
    } catch (err) {
      console.error('Save failed:', err);
    }
    setSaving(false);
  }, [storyboardId]);

  // Mutations
  const updateLine = useCallback((sceneId: string, lineId: string, updates: Partial<Line>) => {
    setData(prev => ({
      ...prev,
      scenes: prev.scenes.map(s =>
        s.id === sceneId
          ? { ...s, lines: s.lines.map(l => l.id === lineId ? { ...l, ...updates } : l) }
          : s
      ),
    }));
    setDirty(true);
  }, []);

  const insertLine = useCallback((sceneId: string, atIndex: number) => {
    const newLine = { id: `l_${generateId()}`, type: 'dialogue' as const, speaker: data.speakers[0]?.id, text: '' };
    setData(prev => clearLineApproval({
      ...prev,
      scenes: prev.scenes.map(s =>
        s.id === sceneId
          ? { ...s, lines: [...s.lines.slice(0, atIndex), newLine, ...s.lines.slice(atIndex)] }
          : s
      ),
    }, sceneId));
    setDirty(true);
    return newLine.id;
  }, [data.speakers]);

  const deleteLine = useCallback((sceneId: string, lineId: string) => {
    setData(prev => {
      const updated = {
      ...prev,
      scenes: prev.scenes.map(s =>
        s.id === sceneId && s.lines.length > 1
          ? { ...s, lines: s.lines.filter(l => l.id !== lineId) }
          : s
      ),
    };
      return clearLineApproval(updated, sceneId, lineId);
    });
    setDirty(true);
  }, []);

  // Cycle to next speaker
  const cycleSpeaker = useCallback((sceneId: string, lineId: string) => {
    setData(prev => {
      const speakers = prev.speakers;
      return {
        ...prev,
        scenes: prev.scenes.map(s =>
          s.id === sceneId
            ? {
                ...s,
                lines: s.lines.map(l => {
                  if (l.id !== lineId) return l;
                  const currentIdx = speakers.findIndex(sp => sp.id === (l.speaker || l.type));
                  const nextIdx = (currentIdx + 1) % speakers.length;
                  const next = speakers[nextIdx];
                  return { ...l, speaker: next.id, type: next.isDirection ? 'direction' as const : 'dialogue' as const };
                }),
              }
            : s
        ),
      };
    });
    setDirty(true);
  }, []);

  // Add a new speaker
  const addSpeaker = useCallback((name: string, color: string, bgColor: string) => {
    const id = name.toLowerCase().replace(/\s+/g, '-') + '_' + generateId().slice(0, 4);
    setData(prev => ({
      ...prev,
      speakers: [...prev.speakers, { id, name, color, bgColor }],
    }));
    setDirty(true);
  }, []);

  const toggleSpeakerDirection = useCallback((speakerId: string) => {
    setData(prev => {
      const speaker = prev.speakers.find(s => s.id === speakerId);
      if (!speaker) return prev;
      const newIsDirection = !speaker.isDirection;
      const newType = newIsDirection ? 'direction' as const : 'dialogue' as const;
      return {
        ...prev,
        speakers: prev.speakers.map(s =>
          s.id === speakerId ? { ...s, isDirection: newIsDirection } : s
        ),
        scenes: prev.scenes.map(s => ({
          ...s,
          lines: s.lines.map(l => {
            // Match by speaker id, or by legacy type-based assignment
            const matches = l.speaker === speakerId
              || (l.speaker === speaker.name)
              || (!l.speaker && speaker.isDirection && l.type === 'direction');
            return matches ? { ...l, speaker: speakerId, type: newType } : l;
          }),
        })),
      };
    });
    setDirty(true);
  }, []);

  const toggleSpeakerSilent = useCallback((speakerId: string) => {
    setData(prev => ({
      ...prev,
      speakers: prev.speakers.map(s =>
        s.id === speakerId ? { ...s, isSilent: !s.isSilent } : s
      ),
    }));
    setDirty(true);
  }, []);

  // Remove a speaker
  const removeSpeaker = useCallback((speakerId: string) => {
    setData(prev => ({
      ...prev,
      speakers: prev.speakers.filter(s => s.id !== speakerId),
    }));
    setDirty(true);
  }, []);

  const setColumns = useCallback((newColumns: ColumnConfig[]) => {
    setData(prev => {
      const oldColumns = prev.columns || [{ id: 'text', name: 'טקסט', width: '1fr' }];
      const firstOldColId = oldColumns[0]?.id || 'text';
      const firstNewColId = newColumns[0]?.id || 'text';

      // Migrate line data: move content from old first column to new first column
      const scenes = prev.scenes.map(s => ({
        ...s,
        lines: s.lines.map(l => {
          // Get the text from the old first column
          const oldFirstValue = firstOldColId === 'text' ? l.text : (l.fields?.[firstOldColId] || '');

          // If the new first column is different, migrate
          if (firstOldColId !== firstNewColId && oldFirstValue) {
            const newFields = { ...(l.fields || {}) };
            // Put old first col value into new first col
            if (firstNewColId === 'text') {
              return { ...l, text: oldFirstValue, fields: newFields };
            } else {
              newFields[firstNewColId] = oldFirstValue;
              return { ...l, fields: newFields };
            }
          }
          return l;
        }),
      }));

      return { ...prev, columns: newColumns, scenes };
    });
    setDirty(true);
  }, []);

  const updateMeta = useCallback((updates: Partial<StoryboardConfig>) => {
    setData(prev => ({ ...prev, ...updates }));
    setDirty(true);
  }, []);

  // Helper: clear approvals for a scene when edited
  function clearLineApproval(data: StoryboardConfig, sceneId: string, lineId?: string): StoryboardConfig {
    const approvals = { ...data.approvals };
    let changed = false;
    // Clear the specific line approval
    if (lineId && approvals[lineId]?.length) {
      delete approvals[lineId];
      changed = true;
    }
    // Clear scene-level approval (since a line changed, scene is no longer fully approved)
    if (approvals[sceneId]?.length) {
      delete approvals[sceneId];
      changed = true;
    }
    if (changed) {
      // Clear global approvals
      const globalApprovals = (data.globalApprovals || []).filter(name =>
        data.scenes.every(s => (approvals[s.id] || []).includes(name))
      );
      return { ...data, approvals, globalApprovals };
    }
    return data;
  }

  const updateLineField = useCallback((sceneId: string, lineId: string, columnId: string, value: string) => {
    setData(prev => {
      const updated = {
      ...prev,
      scenes: prev.scenes.map(s =>
        s.id === sceneId
          ? {
              ...s,
              lines: s.lines.map(l => {
                if (l.id !== lineId) return l;
                if (columnId === 'text') return { ...l, text: value };
                return { ...l, fields: { ...(l.fields || {}), [columnId]: value } };
              }),
            }
          : s
      ),
    };
      return clearLineApproval(updated, sceneId, lineId);
    });
    setDirty(true);
  }, []);

  const updateSceneTitle = useCallback((sceneId: string, title: string) => {
    setData(prev => ({
      ...prev,
      scenes: prev.scenes.map(s => s.id === sceneId ? { ...s, title } : s),
    }));
    setDirty(true);
  }, []);

  const toggleSceneHighlight = useCallback((sceneId: string) => {
    setData(prev => ({
      ...prev,
      scenes: prev.scenes.map(s => s.id === sceneId ? { ...s, highlight: !s.highlight } : s),
    }));
    setDirty(true);
  }, []);

  const addScene = useCallback((afterIndex: number) => {
    const newScene = {
      id: `s_${generateId()}`,
      title: 'סצנה חדשה',
      lines: [{ id: `l_${generateId()}`, type: 'dialogue' as const, speaker: data.speakers[0]?.id, text: '' }],
    };
    setData(prev => ({
      ...prev,
      scenes: [...prev.scenes.slice(0, afterIndex + 1), newScene, ...prev.scenes.slice(afterIndex + 1)],
    }));
    setDirty(true);
  }, [data.speakers]);

  const deleteScene = useCallback((sceneId: string) => {
    setData(prev => {
      if (prev.scenes.length <= 1) return prev;
      return { ...prev, scenes: prev.scenes.filter(s => s.id !== sceneId) };
    });
    setDirty(true);
  }, []);

  // Comments
  const addComment = useCallback((lineId: string, sceneId: string, author: string, text: string) => {
    const comment: Comment = {
      id: `c_${generateId()}`,
      lineId,
      sceneId,
      author,
      text,
      createdAt: Date.now(),
      resolved: false,
    };
    setComments(prev => [...prev, comment]);
    setDirty(true);
    return comment;
  }, []);

  const resolveComment = useCallback((commentId: string) => {
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, resolved: true } : c));
    setDirty(true);
  }, []);

  const deleteComment = useCallback((commentId: string) => {
    setComments(prev => prev.filter(c => c.id !== commentId));
    setDirty(true);
  }, []);

  // Approvals
  const approve = useCallback((key: string, approverName: string) => {
    setData(prev => {
      const approvals = { ...prev.approvals };
      const current = approvals[key] || [];
      if (!current.includes(approverName)) {
        approvals[key] = [...current, approverName];
      }
      // If approving a scene, also approve all its lines
      for (const scene of prev.scenes) {
        if (scene.id === key) {
          for (const line of scene.lines) {
            const lc = approvals[line.id] || [];
            if (!lc.includes(approverName)) approvals[line.id] = [...lc, approverName];
          }
        }
      }
      // Auto-approve scene if all its lines are now approved by this approver
      for (const scene of prev.scenes) {
        const allLinesApproved = scene.lines.every(l => {
          const la = approvals[l.id] || [];
          return la.includes(approverName);
        });
        if (allLinesApproved) {
          const sc = approvals[scene.id] || [];
          if (!sc.includes(approverName)) {
            approvals[scene.id] = [...sc, approverName];
          }
        }
      }
      // Auto global approve if all scenes approved
      const allScenesApproved = prev.scenes.every(s => (approvals[s.id] || []).includes(approverName));
      if (allScenesApproved) {
        const ga = [...(prev.globalApprovals || [])];
        if (!ga.includes(approverName)) ga.push(approverName);
        return { ...prev, approvals, globalApprovals: ga };
      }
      return { ...prev, approvals };
    });
    setDirty(true);
  }, []);

  const unapprove = useCallback((key: string, approverName: string) => {
    setData(prev => {
      const approvals = { ...prev.approvals };
      approvals[key] = (approvals[key] || []).filter(n => n !== approverName);
      // If unapproving a line, also unapprove its parent scene and global
      for (const scene of prev.scenes) {
        if (scene.lines.some(l => l.id === key)) {
          approvals[scene.id] = (approvals[scene.id] || []).filter(n => n !== approverName);
        }
      }
      const globalApprovals = (prev.globalApprovals || []).filter(n => n !== approverName);
      return { ...prev, approvals, globalApprovals };
    });
    setDirty(true);
  }, []);

  const approveAll = useCallback((approverName: string) => {
    setData(prev => {
      const globalApprovals = [...(prev.globalApprovals || [])];
      if (!globalApprovals.includes(approverName)) globalApprovals.push(approverName);
      const approvals = { ...prev.approvals };
      // Approve all scenes and all lines
      for (const scene of prev.scenes) {
        const sc = approvals[scene.id] || [];
        if (!sc.includes(approverName)) approvals[scene.id] = [...sc, approverName];
        for (const line of scene.lines) {
          const lc = approvals[line.id] || [];
          if (!lc.includes(approverName)) approvals[line.id] = [...lc, approverName];
        }
      }
      return { ...prev, approvals, globalApprovals };
    });
    setDirty(true);
  }, []);

  const unapproveAll = useCallback((approverName: string) => {
    setData(prev => {
      const globalApprovals = (prev.globalApprovals || []).filter(n => n !== approverName);
      const approvals = { ...prev.approvals };
      for (const key of Object.keys(approvals)) {
        approvals[key] = (approvals[key] || []).filter(n => n !== approverName);
      }
      return { ...prev, approvals, globalApprovals };
    });
    setDirty(true);
  }, []);

  // Versions
  const saveVersion = useCallback((name: string) => {
    const { id: _id, ...snapshot } = dataRef.current;
    const version: Version = {
      id: `v_${generateId()}`,
      name,
      createdAt: Date.now(),
      snapshot: snapshot as Omit<StoryboardConfig, 'id'>,
    };
    setVersions(prev => [version, ...prev]);
    setDirty(true);
  }, []);

  const restoreVersion = useCallback((versionId: string) => {
    const version = versionsRef.current.find(v => v.id === versionId);
    if (!version) return;
    viewingVersionRef.current = true;
    setData(prev => ({ ...prev, ...version.snapshot }));
    setDirty(true);
  }, []);

  const setViewingLive = useCallback(async () => {
    viewingVersionRef.current = false;
    // Re-fetch live data from Firestore
    try {
      const snap = await getDoc(doc(db, COLLECTION, storyboardId));
      if (snap.exists()) {
        const d = snap.data();
        if (d.scenes) setData(d as StoryboardConfig);
        if (d.comments) setComments(d.comments as Comment[]);
        if (d.versions) setVersions(d.versions as Version[]);
      }
      setDirty(false);
    } catch (err) {
      console.warn('Failed to reload live:', err);
    }
  }, [storyboardId]);

  const deleteVersion = useCallback((versionId: string) => {
    setVersions(prev => prev.filter(v => v.id !== versionId));
    setDirty(true);
  }, []);

  return {
    data,
    comments,
    saving,
    dirty,
    loaded,
    save,
    updateLine,
    updateMeta,
    updateLineField,
    setColumns,
    insertLine,
    deleteLine,
    cycleSpeaker,
    addSpeaker,
    toggleSpeakerDirection,
    toggleSpeakerSilent,
    removeSpeaker,
    updateSceneTitle,
    toggleSceneHighlight,
    addScene,
    deleteScene,
    approve,
    unapprove,
    approveAll,
    unapproveAll,
    addComment,
    resolveComment,
    deleteComment,
    versions,
    saveVersion,
    restoreVersion,
    setViewingLive,
    deleteVersion,
  };
}
