import React from 'react';
import { Composition } from 'remotion';
import { ZoomCall, EditProps } from './ZoomCall';

const empty: EditProps = {
  fps: 30, width: 1080, height: 1920, durationInFrames: 90, title: 'Meeting', timerStart: 0, subtitles: true,
  participants: [], clips: {}, tiles: {}, shots: [], active: [], captions: [], events: [],
};

export const Root: React.FC = () => (
  <Composition
    id="ZoomCall"
    component={ZoomCall}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={90}
    defaultProps={empty}
    calculateMetadata={({ props }) => ({ durationInFrames: props.durationInFrames, fps: props.fps })}
  />
);
