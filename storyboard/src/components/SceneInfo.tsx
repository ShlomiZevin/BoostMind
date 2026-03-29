import { useCtx } from '../context/StoryboardContext';

export function SceneInfo() {
  const { data, mode, updateMeta } = useCtx();

  if (mode !== 'edit') {
    return (
      <div className="scene-info">
        <h2>{data.title}</h2>
        <div className="tagline">{data.subtitle}</div>
        <div className="setup">{data.description}</div>
      </div>
    );
  }

  return (
    <div className="scene-info">
      <input
        className="si-input si-title"
        value={data.title}
        onChange={e => updateMeta({ title: e.target.value })}
        placeholder="שם הסטוריבורד..."
      />
      <input
        className="si-input si-subtitle"
        value={data.subtitle}
        onChange={e => updateMeta({ subtitle: e.target.value })}
        placeholder="כותרת משנה..."
      />
      <textarea
        className="si-input si-description"
        value={data.description}
        onChange={e => updateMeta({ description: e.target.value })}
        placeholder="תיאור הסצנה..."
        rows={3}
      />
    </div>
  );
}
