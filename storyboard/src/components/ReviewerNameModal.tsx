import { useState } from 'react';
import { useCtx } from '../context/StoryboardContext';

export function ReviewerNameModal() {
  const { mode, reviewerName, setReviewerName } = useCtx();
  const [input, setInput] = useState('');

  if (mode !== 'review' || reviewerName) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>הזדהות לתגובות</h3>
        <p>מה השם שלך?</p>
        <input
          autoFocus
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="שם מלא"
          onKeyDown={e => {
            if (e.key === 'Enter' && input.trim()) setReviewerName(input.trim());
          }}
        />
        <button
          className="btn btn-save"
          disabled={!input.trim()}
          onClick={() => setReviewerName(input.trim())}
        >
          כניסה
        </button>
      </div>
    </div>
  );
}
