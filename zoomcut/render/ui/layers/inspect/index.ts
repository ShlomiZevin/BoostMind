// The inspector for each layer kind (contract with LayersEditor: InspectorProps in ./controls; styles: ../tokens.css).
import type React from 'react';
import '../tokens.css';
import type { InspectorProps } from './controls';
import { VideoInspector } from './video';
import { AudioInspector } from './audio';
import { TextInspector, SubtitlesInspector } from './text';
import { ImageInspector, BackdropInspector, ShapeInspector, EffectInspector } from './picture';

export type { InspectorProps };

export const INSPECTORS: Record<string, React.FC<InspectorProps>> = {
  video: VideoInspector,
  backdrop: BackdropInspector,
  image: ImageInspector,
  text: TextInspector,
  subtitles: SubtitlesInspector,
  shape: ShapeInspector,
  audio: AudioInspector,
  effect: EffectInspector,
};
