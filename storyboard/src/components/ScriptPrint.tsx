import { useCtx } from '../context/StoryboardContext';
import { Line, SpeakerConfig } from '../types';

function getVisibleLines(scenes: { lines: Line[] }[], speakers: SpeakerConfig[]) {
  return scenes.flatMap(scene =>
    scene.lines.filter(line => {
      if (line.type === 'direction') return false;
      const s = speakers.find(sp => sp.id === line.speaker);
      if (s?.isDirection) return false;
      return true;
    })
  );
}

function getSpeaker(speakers: SpeakerConfig[], line: { speaker?: string }) {
  const s = speakers.find(sp => sp.id === line.speaker);
  return s ? { name: s.name, color: s.color } : { name: '', color: '#333' };
}

export function ScriptPrint({ mode }: { mode: 'all' | 'by-speaker' }) {
  const { data } = useCtx();
  const speakers = data.speakers || [];
  const allLines = getVisibleLines(data.scenes, speakers);

  if (mode === 'by-speaker') {
    // Group lines by speaker, maintain order of first appearance
    const speakerOrder: string[] = [];
    for (const line of allLines) {
      const sid = line.speaker || '';
      if (!speakerOrder.includes(sid)) speakerOrder.push(sid);
    }

    return (
      <div className="script-print">
        {speakerOrder.map((sid, si) => {
          const speakerLines = allLines.filter(l => l.speaker === sid);
          const speaker = getSpeaker(speakers, { speaker: sid });
          return (
            <div key={sid} className={`sp-speaker-section ${si > 0 ? 'sp-page-break' : ''}`}>
              <div className="sp-speaker-header" style={{ color: speaker.color }}>
                {speaker.name}
              </div>
              <table className="sp-table">
                <tbody>
                  {speakerLines.map((line, i) => (
                    <tr key={line.id} className={`sp-line ${i % 2 === 0 ? 'sp-even' : 'sp-odd'}`}>
                      <td className="sp-text">
                        {line.text}
                        {line.fields && Object.values(line.fields).filter(Boolean).map((f, j) => (
                          <span key={j}> {f}</span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="script-print">
      <table className="sp-table">
        <tbody>
          {allLines.map((line, i) => {
            const speaker = getSpeaker(speakers, line);
            const isSilent = speakers.find(s => s.id === line.speaker)?.isSilent;
            return (
              <tr key={line.id} className={`sp-line ${i % 2 === 0 ? 'sp-even' : 'sp-odd'} ${isSilent ? 'sp-silent' : ''}`}>
                <td className="sp-speaker" style={{ color: speaker.color }}>{speaker.name}</td>
                <td className="sp-text">
                  {line.text}
                  {line.fields && Object.values(line.fields).filter(Boolean).map((f, j) => (
                    <span key={j}> {f}</span>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
