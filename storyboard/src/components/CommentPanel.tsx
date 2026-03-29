import { useState, useRef, useEffect } from 'react';
import { useCtx } from '../context/StoryboardContext';

export function CommentPanel() {
  const {
    activeLineId, comments, addComment, resolveComment, deleteComment,
    reviewerName, mode, save,
  } = useCtx();
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const lineComments = activeLineId
    ? comments.filter(c => c.lineId === activeLineId).sort((a, b) => a.createdAt - b.createdAt)
    : [];

  const unresolvedComments = lineComments.filter(c => !c.resolved);
  const resolvedComments = lineComments.filter(c => c.resolved);

  useEffect(() => {
    if (activeLineId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeLineId]);

  if (!activeLineId) return null;

  function handleSubmit() {
    if (!input.trim()) return;
    const author = mode === 'review' ? reviewerName : 'שלומי';
    addComment(activeLineId!, '', author, input.trim());
    setInput('');
    // Auto-save comments
    setTimeout(() => save(), 100);
  }

  return (
    <div className="comment-panel">
      <div className="comment-panel-header">
        <h4>💬 תגובות</h4>
      </div>

      <div className="comment-list">
        {unresolvedComments.map(c => (
          <div key={c.id} className="comment-item">
            <div className="comment-meta">
              <span className="comment-author">{c.author}</span>
              <span className="comment-time">{formatTime(c.createdAt)}</span>
            </div>
            <div className="comment-text">{c.text}</div>
            <div className="comment-actions">
              {mode === 'edit' && (
                <>
                  <button onClick={() => resolveComment(c.id)}>✓ סומן</button>
                  <button onClick={() => deleteComment(c.id)}>✕ מחק</button>
                </>
              )}
            </div>
          </div>
        ))}

        {resolvedComments.length > 0 && (
          <details className="resolved-section">
            <summary>תגובות שטופלו ({resolvedComments.length})</summary>
            {resolvedComments.map(c => (
              <div key={c.id} className="comment-item resolved">
                <div className="comment-meta">
                  <span className="comment-author">{c.author}</span>
                </div>
                <div className="comment-text">{c.text}</div>
              </div>
            ))}
          </details>
        )}
      </div>

      <div className="comment-input-area">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={mode === 'review' ? `${reviewerName}, הוסף תגובה...` : 'הוסף תגובה...'}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
          }}
        />
        <button className="btn btn-save btn-small" onClick={handleSubmit} disabled={!input.trim()}>
          שלח
        </button>
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
