import { useState, useRef, useEffect } from 'react';
import { useCtx } from '../context/StoryboardContext';
import { SelectionBar } from './SelectionBar';

export function Topbar() {
  const {
    data, mode, dirty, saving, save, showComments, setShowComments,
    reviewerName, setReviewerName, versions, saveVersion, restoreVersion, setViewingLive, deleteVersion,
    onGoHome,
  } = useCtx();

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [versionOpen, setVersionOpen] = useState(false);
  const [versionNaming, setVersionNaming] = useState(false);
  const [versionNameInput, setVersionNameInput] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<string | null>(null);
  const versionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!versionOpen) return;
    const handler = (e: MouseEvent) => {
      if (versionRef.current && !versionRef.current.contains(e.target as Node)) {
        setVersionOpen(false);
        setVersionNaming(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [versionOpen]);

  function startEditName() {
    setNameDraft(reviewerName);
    setEditingName(true);
  }

  function confirmName() {
    if (nameDraft.trim()) setReviewerName(nameDraft.trim());
    setEditingName(false);
  }

  function handleSaveVersion() {
    if (!versionNameInput.trim()) return;
    saveVersion(versionNameInput.trim());
    setVersionNameInput('');
    setVersionNaming(false);
    setViewingVersion(null);
    setTimeout(() => save(), 300);
  }

  function goToLive() {
    setViewingVersion(null);
    setViewingLive(); // Re-enables Firestore sync, which will load live data
  }

  function copyReviewLink() {
    const params = new URLSearchParams(window.location.search);
    params.set('review', 'true');
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  // Current view label for the button
  const versionLabel = viewingVersion ? `📋 ${viewingVersion}` : '🟢 Live';

  return (
    <div className="topbar-sticky">
    <div className="topbar-inner">
      <div className="topbar-right">
        {mode === 'edit' && <button className="topbar-home" onClick={onGoHome} title="חזרה לרשימה">←</button>}
        <h1>{data.title}</h1>
        <span className="badge">{data.subtitle}</span>
        {mode === 'review' && <span className="badge review-badge">מצב תגובות</span>}
        {reviewerName ? (
          <span className="topbar-user">
            <span onClick={startEditName} title="לחץ לשנות שם">👤 {reviewerName} ✎</span>
            <button className="topbar-user-clear" onClick={() => setReviewerName('')} title="נתק שם">✕</button>
          </span>
        ) : mode === 'review' && (
          <button className="topbar-identify-btn" onClick={startEditName}>
            👤 <span className="identify-full">הזדהו לתגובות ואישור</span><span className="identify-short">הזדהו</span>
          </button>
        )}
      </div>
      <div className="topbar-actions">
        {dirty && mode === 'edit' && <span className="save-status">● שינויים לא שמורים</span>}
        <button
          className={`btn btn-outline ${showComments ? 'btn-active' : ''}`}
          onClick={() => setShowComments(!showComments)}
        >
          💬 {showComments ? 'הסתר' : 'הצג'}
        </button>
        <button className="btn btn-outline" onClick={() => window.print()}>🖨️</button>
        {mode === 'edit' && (
          <button className="btn btn-outline" onClick={copyReviewLink}>
            {linkCopied ? '✓ הועתק' : '🔗 לינק'}
          </button>
        )}

        {/* Version switcher */}
        <div className="version-dropdown" ref={versionRef}>
          <button
            className={`btn btn-outline ${versionOpen ? 'btn-active' : ''} ${viewingVersion ? 'btn-viewing' : ''}`}
            onClick={() => { setVersionOpen(!versionOpen); setVersionNaming(false); }}
          >
            {versionLabel}
          </button>

          {versionOpen && (
            <div className="vd-panel">
              <div className="vd-title">גרסאות</div>
              {/* Live option */}
              <div
                className={`vd-item vd-live ${!viewingVersion ? 'vd-active' : ''}`}
                onClick={() => { if (viewingVersion) goToLive(); setVersionOpen(false); }}
              >
                <div className="vd-item-info">
                  <span className="vd-item-name">🟢 Live</span>
                  <span className="vd-item-date">המצב הנוכחי השמור</span>
                </div>
              </div>

              {versions.length > 0 && <div className="vd-divider" />}

              {/* Version list */}
              {versions.length > 0 && (
                <div className="vd-list">
                  {versions.map(v => (
                    <div key={v.id} className={`vd-item ${viewingVersion === v.name ? 'vd-active' : ''}`}>
                      <div
                        className="vd-item-info"
                        onClick={() => {
                          restoreVersion(v.id);
                          setViewingVersion(v.name);
                          setVersionOpen(false);
                        }}
                      >
                        <span className="vd-item-name">{v.name}</span>
                        <span className="vd-item-date">{formatDate(v.createdAt)}</span>
                      </div>
                      {mode === 'edit' && (
                        <div className="vd-item-actions">
                          <button onClick={() => { deleteVersion(v.id); setTimeout(() => save(), 300); }}>✕</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Save new version */}
              {mode === 'edit' && (
                <>
                  <div className="vd-divider" />
                  {versionNaming ? (
                    <div className="vd-name-row">
                      <input
                        autoFocus
                        type="text"
                        value={versionNameInput}
                        onChange={e => setVersionNameInput(e.target.value)}
                        placeholder='למשל "לפני צילום"...'
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveVersion();
                          if (e.key === 'Escape') setVersionNaming(false);
                        }}
                      />
                      <button className="vd-confirm" disabled={!versionNameInput.trim()} onClick={handleSaveVersion}>שמור</button>
                    </div>
                  ) : (
                    <button className="vd-save-btn" onClick={() => setVersionNaming(true)}>
                      + שמור גרסה חדשה
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Save button */}
        {mode === 'edit' && (
          <button className={`btn btn-save ${saving ? 'saving' : ''}`} onClick={() => { save(); setViewingVersion(null); setViewingLive(); }}>
            {saving ? '⏳' : '💾'} שמירה
          </button>
        )}
      </div>

      {/* Edit name modal */}
      {editingName && (
        <div className="modal-overlay" onClick={() => setEditingName(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{reviewerName ? 'שנה שם' : 'בחר שם'}</h3>
            {(data.approvers || []).length > 0 && (
              <div className="modal-approver-picks">
                {data.approvers.map(a => (
                  <button
                    key={a}
                    className="modal-approver-btn"
                    onClick={() => { setReviewerName(a); setEditingName(false); }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}
            <input
              autoFocus
              type="text"
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              placeholder={(data.approvers || []).length > 0 ? 'או שם אחר...' : 'שם...'}
              onKeyDown={e => { if (e.key === 'Enter') confirmName(); }}
            />
            <div className="modal-buttons">
              <button className="btn btn-save" disabled={!nameDraft.trim()} onClick={confirmName}>שמור</button>
              <button className="btn btn-outline modal-cancel" onClick={() => setEditingName(false)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
    <SelectionBar />
    </div>
  );
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
