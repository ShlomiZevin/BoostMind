// A file big, in a window over the editor: a video or a sound plays (with sound, seekable), a picture shows large.
// Media opens it from any file's picture; the "Who is this?" list from a take's. Everything about the file (marks,
// a note, putting it on the timeline) goes in this window - the panels stay as they are. Esc or a click outside closes.
import React, { useEffect } from 'react';
import './peek.css';

export function VideoPeek({ src, name, sub, kind = 'video', onClose, children, actions }: {
  src: string; name: string; sub?: string; kind?: string; onClose: () => void;
  children?: React.ReactNode;  // under the file: its marks / pickers
  actions?: React.ReactNode;   // buttons beside Close
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="vp" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`vp-box vp-${kind}`}>
        {kind === 'image' ? <div className="vp-media"><img src={src} alt="" /></div>
          : kind === 'audio' ? <div className="vp-snd"><div className="vp-ic">♪</div><audio src={src} controls autoPlay /></div>
          : <div className="vp-media"><video src={src} controls autoPlay playsInline /></div>}
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
  return (
    <button className="vp-th" title="Open it big" onClick={(e) => { e.stopPropagation(); onPlay(); }}>
      <img className={className} loading="lazy" src={src} alt="" /><span className="vp-play">▶</span>
    </button>
  );
}
