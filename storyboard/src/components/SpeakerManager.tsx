import { useState, useCallback } from 'react';
import { useCtx } from '../context/StoryboardContext';
import { useClickOutside } from '../hooks/useClickOutside';

const PRESET_COLORS = [
  { color: '#7C3AED', bg: '#F5F0FF' },
  { color: '#E97316', bg: '#FFF7ED' },
  { color: '#0EA5E9', bg: '#F0F9FF' },
  { color: '#10B981', bg: '#ECFDF5' },
  { color: '#EF4444', bg: '#FEF2F2' },
  { color: '#EC4899', bg: '#FDF2F8' },
  { color: '#6366F1', bg: '#EEF2FF' },
  { color: '#8B5CF6', bg: '#F5F3FF' },
];

export function SpeakerManager() {
  const { data, mode, addSpeaker, toggleSpeakerDirection, toggleSpeakerSilent, removeSpeaker } = useCtx();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(0);
  const ref = useClickOutside(open, useCallback(() => setOpen(false), []));

  if (mode !== 'edit') return null;

  return (
    <div className="speaker-manager" ref={ref}>
      <button className="sm-toggle" onClick={() => setOpen(!open)}>
        🎭 דוברים ({data.speakers.length})
      </button>

      {open && (
        <div className="sm-panel">
          <div className="sm-list">
            {data.speakers.map(s => (
              <div key={s.id} className="sm-item">
                <div className="sm-dot" style={{ background: s.color }} />
                <span className="sm-name">{s.name}</span>
                <button
                  className={`sm-direction-toggle ${s.isDirection ? 'active' : ''}`}
                  onClick={() => toggleSpeakerDirection(s.id)}
                  title={s.isDirection ? 'סומן כבימוי' : 'סמן כבימוי'}
                >
                  🎬
                </button>
                <button
                  className={`sm-direction-toggle ${s.isSilent ? 'active' : ''}`}
                  onClick={() => toggleSpeakerSilent(s.id)}
                  title={s.isSilent ? 'סומן כשקט (לא נשמע)' : 'סמן כשקט (ייחוס בלבד)'}
                >
                  🔇
                </button>
                {data.speakers.length > 1 && (
                  <button className="sm-remove" onClick={() => removeSpeaker(s.id)}>✕</button>
                )}
              </div>
            ))}
          </div>
          <div className="sm-add">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="שם דובר חדש..."
              onKeyDown={e => {
                if (e.key === 'Enter' && name.trim()) {
                  const c = PRESET_COLORS[selectedColor];
                  addSpeaker(name.trim(), c.color, c.bg);
                  setName('');
                  setSelectedColor((selectedColor + 1) % PRESET_COLORS.length);
                }
              }}
            />
            <div className="sm-colors">
              {PRESET_COLORS.map((c, i) => (
                <button
                  key={i}
                  className={`sm-color-btn ${i === selectedColor ? 'selected' : ''}`}
                  style={{ background: c.color }}
                  onClick={() => setSelectedColor(i)}
                />
              ))}
            </div>
            <button
              className="sm-add-btn"
              disabled={!name.trim()}
              onClick={() => {
                const c = PRESET_COLORS[selectedColor];
                addSpeaker(name.trim(), c.color, c.bg);
                setName('');
                setSelectedColor((selectedColor + 1) % PRESET_COLORS.length);
              }}
            >
              + הוסף
            </button>
          </div>
          <div className="sm-hint">לחץ על שם הדובר בשורה כדי להחליף בין הדוברים</div>
        </div>
      )}
    </div>
  );
}
