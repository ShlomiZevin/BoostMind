// A bench for text styles (render/src/layers/styles.tsx): ?style=ticker&t=0,1,2&text=...  - one frame per t.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { TEXT_STYLES } from '../src/layers/styles';
const q = new URLSearchParams(location.search);
const S = TEXT_STYLES[q.get('style') || 'ticker'];
const it = JSON.parse(q.get('it') || '{}');
const text = q.get('text') || 'מבזק: הבורסה בירידות חדות · הדולר מזנק · מזג האוויר: חם';
createRoot(document.getElementById('root')!).render(<>{(q.get('t') || '0,1,2').split(',').map((t) =>
  <div className="f" key={t}><div style={{ position: 'absolute', top: 60, left: 0 }}><S.render it={it} text={text} fonts={{}} t={+t} /></div></div>)}</>);
