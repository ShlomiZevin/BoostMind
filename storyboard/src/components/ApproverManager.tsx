import { useState, useCallback } from 'react';
import { useCtx } from '../context/StoryboardContext';
import { useClickOutside } from '../hooks/useClickOutside';

export function ApproverManager() {
  const { data, mode, updateMeta } = useCtx();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const ref = useClickOutside(open, useCallback(() => setOpen(false), []));

  if (mode !== 'edit') return null;

  const approvers = data.approvers || [];

  function addApprover() {
    if (!name.trim() || approvers.includes(name.trim())) return;
    updateMeta({ approvers: [...approvers, name.trim()] } as any);
    setName('');
  }

  function removeApprover(n: string) {
    updateMeta({ approvers: approvers.filter(a => a !== n) } as any);
  }

  return (
    <div className="approver-manager" ref={ref}>
      <button className="sm-toggle" onClick={() => setOpen(!open)}>
        ✅ מאשרים ({approvers.length})
      </button>

      {open && (
        <div className="sm-panel">
          {approvers.length > 0 ? (
            <div className="sm-list">
              {approvers.map(a => (
                <div key={a} className="sm-item">
                  <span className="sm-name">{a}</span>
                  <button className="sm-remove" onClick={() => removeApprover(a)}>✕</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="am-empty">הוסף מאשרים כדי להפעיל תהליך אישור</div>
          )}
          <div className="sm-add" style={{ marginTop: 10 }}>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="שם מאשר..."
              onKeyDown={e => { if (e.key === 'Enter') addApprover(); }}
            />
            <button className="sm-add-btn" disabled={!name.trim()} onClick={addApprover}>
              + הוסף
            </button>
          </div>
          <div className="sm-hint">מאשרים יראו כפתור "אשר" ליד כל סצנה במצב תגובות</div>
        </div>
      )}
    </div>
  );
}
