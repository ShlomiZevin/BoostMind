import { useMemo } from 'react';
import { useCtx } from '../context/StoryboardContext';

export function ApprovalBar() {
  const { data, mode, reviewerName, approveAll, unapproveAll, save } = useCtx();
  if (!reviewerName && mode === 'review') return null;

  const approvers = data.approvers || [];
  if (approvers.length === 0) return null;

  const totalScenes = data.scenes.length;
  const approvals = data.approvals || {};
  const globalApprovals = data.globalApprovals || [];

  // Calculate approval progress
  const stats = useMemo(() => {
    let fullyApproved = 0;
    for (const scene of data.scenes) {
      const sceneApprovals = approvals[scene.id] || [];
      if (approvers.every(a => sceneApprovals.includes(a))) fullyApproved++;
    }
    const pct = totalScenes > 0 ? Math.round((fullyApproved / totalScenes) * 100) : 0;
    return { fullyApproved, pct };
  }, [data.scenes, approvals, approvers, totalScenes]);

  const isApprover = approvers.includes(reviewerName);
  const iApproved = globalApprovals.includes(reviewerName);

  function handleApproveAll() {
    if (iApproved) {
      unapproveAll(reviewerName);
    } else {
      approveAll(reviewerName);
    }
    setTimeout(() => save(), 300);
  }

  return (
    <div className={`approval-bar ${stats.pct === 100 ? 'fully-approved' : ''}`}>
      <div className="ab-progress">
        <div className="ab-progress-bar" style={{ width: `${stats.pct}%` }} />
      </div>
      <div className="ab-content">
        <div className="ab-status">
          <span className="ab-pct">{stats.pct}%</span>
          <span className="ab-text">
            {stats.pct === 100 ? '✅ מאושר לצילום' : `${stats.fullyApproved}/${totalScenes} סצנות מאושרות`}
          </span>
        </div>
        <div className="ab-approvers">
          {approvers.map(name => {
            const approvedAll = globalApprovals.includes(name);
            const approvedCount = data.scenes.filter(s => (approvals[s.id] || []).includes(name)).length;
            return (
              <span key={name} className={`ab-approver ${approvedAll ? 'done' : approvedCount > 0 ? 'partial' : ''}`}>
                {approvedAll ? '✓' : approvedCount > 0 ? `${approvedCount}/${totalScenes}` : '○'} {name}
              </span>
            );
          })}
        </div>
        {isApprover && mode === 'review' && (
          <button className={`ab-approve-btn ${iApproved ? 'approved' : ''}`} onClick={handleApproveAll}>
            {iApproved ? '↩ בטל אישור כללי' : '✓ אשר הכל'}
          </button>
        )}
      </div>
    </div>
  );
}
