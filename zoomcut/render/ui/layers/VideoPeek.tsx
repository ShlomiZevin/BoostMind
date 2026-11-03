// A file big, in a window over the editor: a video or a sound plays (with sound, seekable), a picture shows large.
// Media opens it from any file's picture; the "Who is this?" list from a take's. Everything about the file (marks,
// a note, putting it on the timeline) goes in this window - the panels stay as they are. Esc or a click outside closes.
import React, { useEffect } from 'react';
import './peek.css';

export function VideoPeek({ src, name, sub, kind = 'video', start, end, text, onClose, children, actions }: {
  src: string; name: string; sub?: string; kind?: string; onClose: () => void;
  start?: number; end?: number;  // (a timeline clip: its piece of the file - it starts there and stops once at its end)
  text?: string;                 // kind 'text': words, shown big
  children?: React.ReactNode;  // under the file: its marks / pickers
  actions?: React.ReactNode;   // buttons beside Close
}) {
  // the window owns Esc and Space while it is open (caught first: Esc no longer also unpicks the clip behind it, Space
  // plays / pauses this file, not the video behind)
  const media = React.useRef<HTMLMediaElement | null>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); }
      else if (e.code === 'Space' && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) {
        e.stopImmediatePropagation(); e.preventDefault();
        const m = media.current; if (m) m.paused ? m.play() : m.pause();
      }
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onClose]);
  // a clip's piece: start at its first second, stop once where it ends (play again = the rest of the file)
  const piece = (e: React.SyntheticEvent<HTMLMediaElement>) => { if (start) e.currentTarget.currentTime = start; };
  const stopped = React.useRef(false);
  const atEnd = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    const m = e.currentTarget;
    if (end != null && !stopped.current && m.currentTime >= end) { stopped.current = true; m.pause(); }
  };
  return (
    <div className="vp" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`vp-box vp-${kind}`}>
        {kind === 'image' ? <div className="vp-media"><img src={src} alt="" /></div>
          : kind === 'text' ? <div className="vp-words he" dir="auto">{text}</div>
          : kind === 'audio' ? <div className="vp-snd"><div className="vp-ic">♪</div><audio ref={media as any} src={src} controls autoPlay onLoadedMetadata={piece} onTimeUpdate={atEnd} /></div>
          : <div className="vp-media"><video ref={media as any} src={src} controls autoPlay playsInline onLoadedMetadata={piece} onTimeUpdate={atEnd} /></div>}
        <div className="vp-side">
          <div className="vp-n"><div className="vp-name he">{name}</div>{sub && <div className="vp-sub">{sub}</div>}</div>
          {children}
          <div className="vp-bar">
            <div style={{ flex: 1 }} />
            {actions}
            <button className="btn ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// a file's picture that opens it big when clicked
export function PeekThumb({ src, onPlay, className = 'm-thumb' }: { src: string; onPlay: () => void; className?: string }) {
  const [bad, setBad] = React.useState(false);  // (no picture yet - a file still on its way: a quiet tile, never a broken image)
  return (
    <button className="vp-th" title="Open it big" onClick={(e) => { e.stopPropagation(); onPlay(); }}>
      {bad ? <span className={className + ' thumb-wait'} /> : <img className={className} loading="lazy" src={src} alt="" onError={() => setBad(true)} />}<span className="vp-play">▶</span>
    </button>
  );
}
