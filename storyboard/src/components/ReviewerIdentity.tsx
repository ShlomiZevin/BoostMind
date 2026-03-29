import { useState } from 'react';
import { useCtx } from '../context/StoryboardContext';

export function ReviewerIdentity() {
  const { mode, reviewerName, setReviewerName, data } = useCtx();
  const [nameInput, setNameInput] = useState('');
  const [dismissed, setDismissed] = useState(false);

  if (mode !== 'review' || reviewerName || dismissed) return null;

  const approvers = data.approvers || [];

  return (
    <div className="reviewer-identity">
      <div className="ri-content">
        <p>בחרו שם כדי להגיב ולאשר</p>
        {approvers.length > 0 && (
          <div className="ri-approvers">
            {approvers.map(a => (
              <button key={a} className="ri-approver-btn" onClick={() => setReviewerName(a)}>
                {a}
              </button>
            ))}
          </div>
        )}
        <div className="ri-custom">
          <input
            type="text"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            placeholder={approvers.length > 0 ? 'או שם אחר...' : 'השם שלך...'}
            onKeyDown={e => {
              if (e.key === 'Enter' && nameInput.trim()) {
                e.preventDefault();
                setReviewerName(nameInput.trim());
              }
            }}
          />
          <button
            className="ri-submit"
            disabled={!nameInput.trim()}
            onClick={() => setReviewerName(nameInput.trim())}
          >
            המשך
          </button>
        </div>
        <button className="ri-skip" onClick={() => setDismissed(true)}>
          דלג, רק צפייה
        </button>
      </div>
    </div>
  );
}
