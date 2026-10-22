// The Zoom window around the tiles - top bar (app name, End button, recording dot) and the bottom toolbar - as ONE
// transparent picture. The Zoom builder (pipeline/to_layers.py) renders it once into an image layer; the meeting
// title, the timer and the participant count are text layers on top (he edits them like any text).
// Same drawing as ZoomCall.tsx (the older Zoom screen).
import React from 'react';
import { AbsoluteFill } from 'remotion';

const TOP = 150, BAR = 1752;
const FONT = '"Segoe UI", "Arial", sans-serif';

const Icon: React.FC<{ d: React.ReactNode; label: string; color?: string }> = ({ d, label, color = '#fff' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 170, position: 'relative' }}>
    <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
    <div style={{ color: '#d0d0d0', fontSize: 25 }}>{label}</div>
  </div>
);

export const ZoomChrome: React.FC<{ accent?: string; ui?: Record<string, string> }> = ({ accent = '#2BD45E', ui = {} }) => {
  const t = (k: string, d: string) => ui[k] || d;
  return (
    <AbsoluteFill style={{ background: 'transparent', fontFamily: FONT, direction: 'rtl' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: TOP - 14, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '24px 30px 0', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 30, fontWeight: 600 }}>
          <svg width="34" height="34" viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3z" fill={accent} /></svg>
          <span>{t('app', 'Zoom')}</span>
        </div>
        <div />
        <div style={{ background: '#e02828', color: '#fff', fontSize: 28, fontWeight: 600, borderRadius: 10, padding: '10px 26px' }}>{t('end', 'סיום')}</div>
      </div>
      <div style={{ position: 'absolute', top: TOP - 16, right: 30, display: 'flex', alignItems: 'center', gap: 8,
        color: '#e0e0e0', fontSize: 22, zIndex: 5, transform: 'translateY(-50%)', opacity: 0.85 }}>
        <div style={{ width: 12, height: 12, borderRadius: 6, background: '#ff3b3b' }} />
        <span>{t('recording', 'מקליט...')}</span>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: BAR, bottom: 0, background: '#161616', borderTop: '1px solid #262626',
        display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', paddingTop: 22 }}>
        <Icon label={t('mute', 'השתקה')} d={<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4" /></>} />
        <Icon label={t('video', 'עצירת וידאו')} d={<><rect x="3" y="7" width="12" height="10" rx="2" /><path d="M15 11l6-3v8l-6-3" /></>} />
        <Icon label={t('share', 'שיתוף')} color={accent} d={<><rect x="3" y="5" width="18" height="13" rx="2" /><path d="M12 15V9M9 11.5L12 9l3 2.5" /></>} />
        <Icon label={t('participants', 'משתתפים')} d={<><circle cx="9" cy="9" r="3.2" /><path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5" /><circle cx="17" cy="9.5" r="2.4" /><path d="M16 14.6c2 .2 3.7 1.5 4.4 4" /></>} />
        <Icon label={t('more', 'עוד')} d={<><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>} />
      </div>
    </AbsoluteFill>
  );
};
