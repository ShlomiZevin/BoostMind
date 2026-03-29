import { useState, useCallback } from 'react';
import { useCtx } from '../context/StoryboardContext';
import { COLUMN_PRESETS } from '../config/defaultStoryboard';
import { useClickOutside } from '../hooks/useClickOutside';

export function ColumnManager() {
  const { data, mode, setColumns } = useCtx();
  const [open, setOpen] = useState(false);
  const [newColName, setNewColName] = useState('');
  const ref = useClickOutside(open, useCallback(() => setOpen(false), []));

  if (mode !== 'edit') return null;

  const columns = data.columns || [{ id: 'text', name: 'טקסט', width: '1fr' }];

  function addColumn() {
    if (!newColName.trim()) return;
    const id = newColName.trim().toLowerCase().replace(/\s+/g, '-');
    setColumns([...columns, { id, name: newColName.trim(), width: '1fr' }]);
    setNewColName('');
  }

  function removeColumn(colId: string) {
    if (columns.length <= 1) return;
    setColumns(columns.filter(c => c.id !== colId));
  }

  function applyPreset(presetIndex: number) {
    setColumns([...COLUMN_PRESETS[presetIndex].columns]);
  }

  return (
    <div className="column-manager" ref={ref}>
      <button className="sm-toggle" onClick={() => setOpen(!open)}>
        📊 עמודות ({columns.length})
      </button>

      {open && (
        <div className="sm-panel">
          {/* Presets */}
          <div className="cm-presets">
            <span className="cm-label">תבניות מוכנות:</span>
            <div className="cm-preset-list">
              {COLUMN_PRESETS.map((p, i) => (
                <button key={i} className="cm-preset-btn" onClick={() => applyPreset(i)}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Current columns */}
          <div className="cm-current">
            <span className="cm-label">עמודות נוכחיות:</span>
            <div className="sm-list">
              <div className="sm-item" style={{ opacity: 0.5 }}>
                <span className="sm-name">דובר</span>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>קבוע</span>
              </div>
              {columns.map(col => (
                <div key={col.id} className="sm-item">
                  <span className="sm-name">{col.name}</span>
                  {columns.length > 1 && (
                    <button className="sm-remove" onClick={() => removeColumn(col.id)}>✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add custom */}
          <div className="cm-add">
            <input
              type="text"
              value={newColName}
              onChange={e => setNewColName(e.target.value)}
              placeholder="שם עמודה חדשה..."
              onKeyDown={e => { if (e.key === 'Enter') addColumn(); }}
            />
            <button className="sm-add-btn" disabled={!newColName.trim()} onClick={addColumn}>
              + הוסף
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
