import { useState, useRef, useEffect } from 'react';
import { useCtx } from '../context/StoryboardContext';

interface Props {
  lineId: string;
  sceneId: string;
}

export function InlineComments({ lineId, sceneId }: Props) {
  const {
    activeLineId, comments, addComment, resolveComment, deleteComment,
    reviewerName, setReviewerName, mode, save, data,
  } = useCtx();
  const [input, setInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const needsName = !reviewerName;

  const isOpen = activeLineId === lineId;
  const lineComments = comments
    .filter(c => c.lineId === lineId)
    .sort((a, b) => a.createdAt - b.createdAt);
  const unresolvedComments = lineComments.filter(c => !c.resolved);
  const resolvedComments = lineComments.filter(c => c.resolved);

  useEffect(() => {
    if (isOpen) {
      if (needsName && nameRef.current) nameRef.current.focus();
      else if (inputRef.current) inputRef.current.focus();
    }
  }, [isOpen, needsName]);

  // Highlight the parent line on comment hover
  function highlightLine(on: boolean) {
    const lineEl = document.querySelector(`[data-line-id="${lineId}"]`);
    if (lineEl) {
      if (on) lineEl.classList.add('comment-hover');
      else lineEl.classList.remove('comment-hover');
    }
  }

  if (!isOpen) return null;

  function handleSubmit() {
    if (!input.trim()) return;
    const author = reviewerName || 'אנונימי';
    addComment(lineId, sceneId, author, input.trim());
    setInput('');
    setTimeout(() => save(), 100);
  }

  return (
    <div
      className="inline-comments"
      onMouseEnter={() => highlightLine(true)}
      onMouseLeave={() => highlightLine(false)}
    >
      {unresolvedComments.map(c => (
        <div key={c.id} className="ic-item">
          <div className="ic-meta">
            <span className="ic-author">{c.author}</span>
            <span className="ic-time">{formatTime(c.createdAt)}</span>
          </div>
          <div className="ic-text">{c.text}</div>
          <div className="ic-actions">
            {mode === 'edit' && (
              <button onClick={() => { resolveComment(c.id); setTimeout(() => save(), 100); }}>✓ טופל</button>
            )}
            <button onClick={() => { deleteComment(c.id); setTimeout(() => save(), 100); }}>✕ מחק</button>
          </div>
        </div>
      ))}

      {resolvedComments.length > 0 && (
        <details className="ic-resolved">
          <summary>טופלו ({resolvedComments.length})</summary>
          {resolvedComments.map(c => (
            <div key={c.id} className="ic-item resolved">
              <div className="ic-meta">
                <span className="ic-author">{c.author}</span>
              </div>
              <div className="ic-text">{c.text}</div>
              <div className="ic-actions">
                <button onClick={() => { deleteComment(c.id); setTimeout(() => save(), 100); }}>✕ מחק</button>
              </div>
            </div>
          ))}
        </details>
      )}

      {needsName ? (
        <div className="ic-name-prompt">
          <span className="ic-name-label">מה השם שלך?</span>
          {(data.approvers || []).length > 0 && (
            <div className="ic-approver-buttons">
              {data.approvers.map(a => (
                <button key={a} className="ic-approver-btn" onClick={() => setReviewerName(a)}>{a}</button>
              ))}
            </div>
          )}
          <div className="ic-name-row">
            <input
              ref={nameRef}
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="או הקלד שם אחר..."
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (nameInput.trim()) setReviewerName(nameInput.trim());
                }
              }}
            />
            <button
              className="ic-send"
              disabled={!nameInput.trim()}
              onClick={() => setReviewerName(nameInput.trim())}
            >המשך</button>
          </div>
        </div>
      ) : (
        <div className="ic-input">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="תגובה... (Ctrl+Enter לשליחה)"
            rows={3}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSubmit(); }
            }}
          />
          <div className="ic-input-footer">
            <span className="ic-writing-as">💬 {reviewerName}</span>
            <button className="ic-send" onClick={handleSubmit} disabled={!input.trim()}>שלח</button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
