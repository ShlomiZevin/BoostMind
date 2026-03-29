import { useState } from 'react';
import { Scene, SpeakerConfig } from '../types';
import { LineRow } from './LineRow';
import { useCtx } from '../context/StoryboardContext';
import { getSceneDuration, formatDuration, getSceneWordCount, getLineActualOrPlanned } from '../hooks/useTiming';
import { Tooltip } from './Tooltip';

interface Props {
  scene: Scene;
  index: number;
  speakers: SpeakerConfig[];
  totalScenes: number;
}

export function SceneGroup({ scene, index, speakers, totalScenes }: Props) {
  const { data, mode, insertLine, updateSceneTitle, toggleSceneHighlight, addScene, deleteScene, selectScene, selectedLines } = useCtx();
  const [deleteModal, setDeleteModal] = useState(false);
  const columns = data.columns || [{ id: 'text', name: 'טקסט', width: '1fr' }];
  const gridCols = `24px 85px ${columns.map(c => c.width || '1fr').join(' ')}`;
  const allSceneSelected = scene.lines.length > 0 && scene.lines.every(l => selectedLines.has(l.id));
  const sceneDuration = getSceneDuration(scene, data.timing, data.columns);
  const sceneWords = getSceneWordCount(scene, data.columns);
  const sceneActual = scene.lines.reduce((sum, l) => sum + getLineActualOrPlanned(l, data.timing, data.columns), 0);
  const hasAnyActual = scene.lines.some(l => l.actualDuration != null);

  return (
    <>
      <div className={`scene-group ${scene.highlight ? 'highlight' : ''}`}>
        <div className="scene-group-header">
          <div className={`scene-group-number ${scene.highlight ? 'wolt' : ''}`}>{index + 1}</div>
          {scene.highlight && <span className="highlight-badge">⭐ סצנה מרכזית</span>}
          {mode === 'edit' ? (
            <>
              <input
                className="scene-title-input"
                value={scene.title}
                onChange={e => updateSceneTitle(scene.id, e.target.value)}
              />
              <div className="scene-header-actions">
                <button
                  className={`sh-btn ${scene.highlight ? 'active' : ''}`}
                  onClick={() => toggleSceneHighlight(scene.id)}
                  title={scene.highlight ? 'הסר הדגשה' : 'סמן כסצנה מרכזית'}
                >
                  ⭐
                </button>
                {totalScenes > 1 && (
                  <button
                    className="sh-btn danger"
                    onClick={() => setDeleteModal(true)}
                    title="מחק סצנה"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="scene-group-title">{scene.title}</div>
          )}
          <span className="scene-stats">
            <Tooltip text={`${sceneWords} מילים בסצנה`}>
              <span className="scene-words">{sceneWords}w</span>
            </Tooltip>
            <Tooltip text={`זמן מתוכנן: ${sceneDuration} שניות`}>
              <span className="scene-duration">{formatDuration(sceneDuration)}</span>
            </Tooltip>
            {hasAnyActual && (
              <Tooltip text={`\u200Eזמן בפועל: ${sceneActual} שניות (הפרש: \u200E${sceneActual - sceneDuration > 0 ? '+' : ''}${sceneActual - sceneDuration}s)`}>
                <span className={`scene-actual ${sceneActual - sceneDuration > 2 ? 'over' : sceneActual - sceneDuration < -2 ? 'under' : 'ok'}`}>
                  {formatDuration(sceneActual)}
                </span>
              </Tooltip>
            )}
          </span>
        </div>
        <div className="lines-container">
          <div className="col-headers" style={{ gridTemplateColumns: gridCols }}>
            {mode === 'edit' ? (
              <span className="col-header-check" onClick={() => selectScene(scene.id)}>
                {allSceneSelected ? '☑' : '☐'}
              </span>
            ) : <span />}
            <span>דובר</span>
            {columns.length > 1 && columns.map(col => <span key={col.id}>{col.name}</span>)}
          </div>
          {scene.lines.map((line, li) => (
            <LineRow
              key={line.id}
              line={line}
              sceneId={scene.id}
              index={li}
              speakers={speakers}
              totalLines={scene.lines.length}
            />
          ))}
          {mode === 'edit' && (
            <div className="add-line" onClick={() => insertLine(scene.id, scene.lines.length)}>
              + הוסף שורה
            </div>
          )}
        </div>
      </div>

      {/* Add scene button between scenes */}
      {mode === 'edit' && (
        <div className="add-scene" onClick={() => addScene(index)}>
          + הוסף סצנה
        </div>
      )}

      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>מחיקת סצנה</h3>
            <p>למחוק את <strong>"{scene.title}"</strong>?</p>
            <div className="modal-buttons">
              <button className="btn btn-danger" onClick={() => { deleteScene(scene.id); setDeleteModal(false); }}>🗑️ מחק</button>
              <button className="btn btn-outline modal-cancel" onClick={() => setDeleteModal(false)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
