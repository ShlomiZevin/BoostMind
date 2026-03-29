import { useState } from 'react';
import { useCtx } from '../context/StoryboardContext';

export function VersionPanel() {
  const { mode, versions, saveVersion, restoreVersion, deleteVersion, save } = useCtx();
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [nameInput, setNameInput] = useState('');

  if (mode !== 'edit') return null;

  function handleSave() {
    if (!nameInput.trim()) return;
    saveVersion(nameInput.trim());
    setNameInput('');
    setNaming(false);
    setTimeout(() => save(), 100);
  }

  function handleRestore(versionId: string, versionName: string) {
    if (!confirm(`לשחזר את "${versionName}"? המצב הנוכחי יוחלף.`)) return;
    restoreVersion(versionId);
  }

  return (
    <div className="version-panel">
      <button className="sm-toggle" onClick={() => setOpen(!open)}>
        📋 גרסאות {versions.length > 0 && `(${versions.length})`}
      </button>

      {open && (
        <div className="sm-panel vp-panel">
          {/* Save new version */}
          {naming ? (
            <div className="vp-name-input">
              <input
                autoFocus
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder='שם לגרסה, למשל "אחרי תיקוני וולט"...'
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') setNaming(false);
                }}
              />
              <button className="vp-save-btn" disabled={!nameInput.trim()} onClick={handleSave}>שמור</button>
              <button className="vp-cancel-btn" onClick={() => setNaming(false)}>ביטול</button>
            </div>
          ) : (
            <button className="vp-new-btn" onClick={() => setNaming(true)}>
              + שמור גרסה נוכחית
            </button>
          )}

          {/* Version list */}
          {versions.length === 0 ? (
            <div className="vp-empty">אין גרסאות שמורות</div>
          ) : (
            <div className="vp-list">
              {versions.map(v => (
                <div key={v.id} className="vp-item">
                  <div className="vp-item-info">
                    <span className="vp-item-name">{v.name}</span>
                    <span className="vp-item-date">{formatDate(v.createdAt)}</span>
                  </div>
                  <div className="vp-item-actions">
                    <button onClick={() => handleRestore(v.id, v.name)} title="שחזר">↩ שחזר</button>
                    <button onClick={() => deleteVersion(v.id)} title="מחק">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const hours = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month} ${hours}:${mins}`;
}
