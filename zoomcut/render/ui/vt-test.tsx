// A test bench for render/src/layers/VideoTrack.tsx (tools/flicker_test.mjs drives it): a project's video layers
// (with their backdrops) in a Remotion Player, the way the layered editor will play them. ?id=<project> (a "_" copy).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Player, PlayerRef } from '@remotion/player';
import { AbsoluteFill } from 'remotion';
import { VideoTrack } from '../src/layers/VideoTrack';
import { AudioTrack } from '../src/layers/AudioTrack';

const Comp: React.FC<any> = (p) => (
  <AbsoluteFill style={{ background: '#000' }}>
    {(p.project.layers || []).filter((l: any) => l.kind === 'video' && !l.hidden).map((l: any) => (
      <VideoTrack key={l.id} p={p} layer={l} backdrop={(p.project.layers || []).find((x: any) => x.kind === 'backdrop' && !x.hidden && x.props?.target === l.id)} />
    ))}
    {(p.project.layers || []).filter((l: any) => l.kind === 'audio').map((l: any) => <AudioTrack key={l.id} p={p} layer={l} />)}
  </AbsoluteFill>
);

function Bench() {
  const id = new URLSearchParams(location.search).get('id') || '_gl';
  const [d, setD] = useState<any>(null);
  const [playing, setPlaying] = useState(false);
  const player = useRef<PlayerRef>(null);
  useEffect(() => { fetch(`/api/p/${id}`).then((r) => r.json()).then(setD); }, []);
  useEffect(() => {
    const pl = player.current; if (!pl) return;
    const on = () => setPlaying(true), off = () => setPlaying(false);
    pl.addEventListener('play', on); pl.addEventListener('pause', off);
    (window as any).__vt = { seek: (f: number) => pl.seekTo(f), play: () => pl.play(), pause: () => pl.pause(), frame: () => pl.getCurrentFrame(), project: d?.project };
    return () => { pl.removeEventListener('play', on); pl.removeEventListener('pause', off); };
  }, [d]);
  // (until the studio sends prepared sources: each take's own sound, from the same media host)
  const urls = useMemo(() => {
    if (!d) return null;
    const host = String(Object.values(d.urls)[0] || '').split('/pm/')[0];
    const out = { ...d.urls };
    for (const [aid, a] of Object.entries<any>(d.project.assets)) if (a.audio && !out[`${aid}:audio`]) out[`${aid}:audio`] = `${host}/pm/${id}?p=${encodeURIComponent(a.audio)}`;
    return out;
  }, [d]);
  const props = useMemo(() => d && { project: d.project, urls, playing, playbackRate: 1 }, [d, urls, playing]);
  if (!props) return null;
  return <Player ref={player} component={Comp} inputProps={props} durationInFrames={d.project.duration} fps={d.project.canvas.fps}
    compositionWidth={d.project.canvas.w} compositionHeight={d.project.canvas.h} style={{ width: 540, height: 960 }} />;
}
createRoot(document.getElementById('root')!).render(<Bench />);
