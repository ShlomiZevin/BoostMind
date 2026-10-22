import React from 'react';
import { Composition } from 'remotion';
import { ZoomCall, EditProps } from './ZoomCall';
import { Layers, LayersProps } from './Layers';
import { ZoomChrome } from './builders/ZoomChrome';

const empty: EditProps = {
  fps: 30, width: 1080, height: 1920, durationInFrames: 90, title: 'Meeting', timerStart: 0, subtitles: true,
  participants: [], clips: {}, tiles: {}, shots: [], active: [], captions: [], events: [],
};
const emptyProject: LayersProps = { project: { format: 'sketch-studio/1', canvas: { w: 1080, h: 1920, fps: 30 }, duration: 90, assets: {}, layers: [] }, urls: {} };

export const Root: React.FC = () => (
  <>
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
    {/* every layered project (project.json) - the editor's preview and the export's graphics */}
    <Composition
      id="Layers"
      component={Layers}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={90}
      defaultProps={emptyProject}
      calculateMetadata={({ props }) => ({
        durationInFrames: props.frameMap ? props.frameMap.length : props.project.duration,
        fps: props.project.canvas.fps, width: props.project.canvas.w, height: props.project.canvas.h,
      })}
    />
    {/* the Zoom builder's window chrome (bars and icons), drawn once into a picture layer */}
    <Composition id="ZoomChrome" component={ZoomChrome} width={1080} height={1920} fps={30} durationInFrames={1} defaultProps={{ accent: '#2BD45E', ui: {} }} />
  </>
);
