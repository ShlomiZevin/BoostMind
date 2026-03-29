import { useRef, useCallback } from 'react';
import { Line, SpeakerConfig } from '../types';
import { useCtx } from '../context/StoryboardContext';
import { InlineComments } from './InlineComments';
import { TimingBadge } from './TimingBadge';
import { Stopwatch } from './Stopwatch';

interface Props {
  line: Line;
  sceneId: string;
  index: number;
  speakers: SpeakerConfig[];
  totalLines: number;
}

export function LineRow({ line, sceneId, index, speakers, totalLines }: Props) {
  const {
    data, mode, insertLine, deleteLine, cycleSpeaker, updateLineField,
    activeLineId, setActiveLineId, comments, showComments, timingMode,
    selectedLines, toggleSelectLine,
  } = useCtx();

  const columns = data.columns || [{ id: 'text', name: 'טקסט', width: '1fr' }];
  const isDirection = line.type === 'direction';
  const speaker = speakers.find(s => s.id === line.speaker) || speakers.find(s => s.id === 'direction');
  const lineComments = comments.filter(c => c.lineId === line.id && !c.resolved);
  const isActive = activeLineId === line.id;
  const isSelected = selectedLines.has(line.id);

  const speakerStyle = isDirection
    ? { color: '#E97316', background: '#FFF7ED' }
    : { color: speaker?.color || '#7C3AED', background: speaker?.bgColor || '#F5F0FF' };

  const gridCols = `24px 85px ${columns.map(c => c.width || '1fr').join(' ')}`;

  function getFieldValue(columnId: string, colIndex: number): string {
    if (columnId === 'text') return line.text || '';
    // For the first column, fall back to line.text (legacy data)
    if (colIndex === 0 && !line.fields?.[columnId] && line.text) return line.text;
    return line.fields?.[columnId] || '';
  }

  return (
    <>
      {mode === 'edit' && (
        <div className={`insert-between ${index === 0 ? 'first' : ''}`}>
          <button
            className="insert-between-btn"
            onClick={() => insertLine(sceneId, index)}
            title="הוסף שורה כאן"
          >+</button>
        </div>
      )}

      <div
        className={`line ${isDirection ? 'direction' : ''} ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
        data-line-id={line.id}
      >
        <div className="line-main" style={{ gridTemplateColumns: gridCols }}>
          {mode === 'edit' ? (
            <div className="line-checkbox" onClick={e => { e.stopPropagation(); toggleSelectLine(line.id); }}>
              {isSelected ? '☑' : '☐'}
            </div>
          ) : <div className="line-checkbox-placeholder" />}
          <div className="line-speaker-wrap" style={{ background: speakerStyle.background }}>
            <div
              className="line-speaker"
              style={speakerStyle}
              onClick={mode === 'edit' ? () => cycleSpeaker(sceneId, line.id) : undefined}
              title={mode === 'edit' ? 'לחץ להחלפת דובר' : undefined}
            >
              <div className="dot" style={{ background: speakerStyle.color }} />
              {isDirection ? 'בימוי' : speaker?.name || ''}
            </div>
            {!timingMode && (
              <div className="line-timing" onClick={e => e.stopPropagation()}>
                <TimingBadge line={line} sceneId={sceneId} />
              </div>
            )}
          </div>

          {columns.map((col, colIdx) => (
            <FieldCell
              key={col.id}
              value={getFieldValue(col.id, colIdx)}
              placeholder={col.name}
              editable={mode === 'edit'}
              isDirection={isDirection}
              onChange={(val) => updateLineField(sceneId, line.id, col.id, val)}
            />
          ))}

          {/* Always-visible comment counter */}
          {showComments && lineComments.length > 0 && (
            <button
              className="line-comment-badge"
              onClick={(e) => { e.stopPropagation(); setActiveLineId(isActive ? null : line.id); }}
              title="תגובות"
            >
              💬 {lineComments.length}
            </button>
          )}

          <div className="line-actions">
            {mode === 'edit' && totalLines > 1 && (
              <button className="line-btn" onClick={() => deleteLine(sceneId, line.id)} title="מחק">🗑️</button>
            )}
            {showComments && (
              <button
                className={`line-btn ${lineComments.length > 0 ? 'has-comments' : ''}`}
                onClick={(e) => { e.stopPropagation(); setActiveLineId(isActive ? null : line.id); }}
                title="תגובות"
              >
                💬
              </button>
            )}
          </div>
        </div>
        {timingMode && <Stopwatch line={line} sceneId={sceneId} />}
        {showComments && <InlineComments lineId={line.id} sceneId={sceneId} />}
      </div>
    </>
  );
}

// Editable cell for each column
function FieldCell({ value, placeholder, editable, isDirection, onChange }: {
  value: string;
  placeholder: string;
  editable: boolean;
  isDirection: boolean;
  onChange: (val: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleBlur = useCallback(() => {
    if (!ref.current) return;
    const newVal = ref.current.innerText.trim();
    if (newVal !== value) onChange(newVal);
  }, [value, onChange]);

  return (
    <div
      ref={ref}
      className={`line-field ${isDirection ? 'direction-text' : ''}`}
      contentEditable={editable}
      suppressContentEditableWarning
      data-placeholder={editable ? placeholder : ''}
      onBlur={handleBlur}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ref.current?.blur(); }
      }}
    >
      {value}
    </div>
  );
}
