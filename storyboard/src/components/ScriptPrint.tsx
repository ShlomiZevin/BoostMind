import { useCtx } from '../context/StoryboardContext';

export function ScriptPrint() {
  const { data } = useCtx();
  const speakers = data.speakers || [];

  function getSpeaker(line: { speaker?: string; type: string }) {
    if (line.type === 'direction') return { name: 'בימוי', color: '#E97316' };
    const s = speakers.find(sp => sp.id === line.speaker);
    return s ? { name: s.name, color: s.color } : { name: '', color: '#333' };
  }

  return (
    <div className="script-print">
      <table className="sp-table">
        <tbody>
          {data.scenes.map((scene) => (
            <>
              <tr key={`sh-${scene.id}`} className="sp-scene-row">
                <td colSpan={2}>&nbsp;</td>
              </tr>
              {scene.lines.map((line, li) => {
                const speaker = getSpeaker(line);
                const isDirection = line.type === 'direction' || speakers.find(s => s.id === line.speaker)?.isDirection;
                return (
                  <tr
                    key={line.id}
                    className={`sp-line ${isDirection ? 'sp-direction' : ''} ${li % 2 === 0 ? 'sp-even' : 'sp-odd'}`}
                  >
                    <td className="sp-speaker" style={{ color: speaker.color }}>
                      {speaker.name}
                    </td>
                    <td className="sp-text">
                      {line.text}
                      {line.fields && Object.values(line.fields).filter(Boolean).map((f, i) => (
                        <span key={i}> {f}</span>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
