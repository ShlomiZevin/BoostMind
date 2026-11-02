// An audio layer (a voice, sound effects, music). The panels' one order (design.md): what it is -> the main control ->
// shaping -> the clip in time -> the layer. Each thing ONCE (his note, 2026-11-02: "two voice filters, gain and volume
// - things need to make sense"):
//   Volume - how loud: the lane, this clip (relative), its fades, evening out speech; the rare ones under More;
//   Voice  - how it sounds as a voice: noise cleaning (prepared in seconds, pipeline/layers_audio.py), the voice style
//            (sound.ts presets - live through AudioTrack, the export renders the same chain), clarity, room; the
//            chain's fine knobs under More;
//   Effects - sound effects (render/ui/soundfx.ts): on this clip or on the whole lane, one set at a time;
//   Clip   - when: start, length, source, speed; Layer - name, shown / heard, own pace.
import React, { useState } from 'react';
import { VOICE_PRESETS } from '../../sound';
import { FILTERS } from '../../soundfx';
import { InspectorProps, useSettings, Head, Sec, More, Row, Note, Seg, Chips, Slider, ToggleRow, ClipTiming, LayerState, ICON, fmt } from './controls';

const CLEAN: [string, string][] = [['off', 'Off'], ['fft', 'Standard'], ['mild', 'Mild'], ['strong', 'Strong'], ['nn', 'NN']];
const CLEAN_NOTE: Record<string, string> = {
  off: 'The recording as it is.',
  fft: 'Steady hiss and room tone out (the one-camera default).',
  mild: 'A light filter - hiss and room tone.',
  strong: 'A stronger filter - noisy rooms; can thin the voice.',
  nn: 'RNNoise, the neural filter - air-conditioner and fan hum out, the voice kept (the news-anchor fix).',
};
const PRESETS = Object.keys(VOICE_PRESETS);
const fxPatch = (fx: any, patch: any) => { const n = { ...(fx || {}), ...patch }; for (const k of Object.keys(n)) if (n[k] == null) delete n[k]; return Object.keys(n).length ? n : null; };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const sdb = (v: number) => `${v > 0 ? '+' : ''}${v} dB`;
const pct0 = (v: number) => (v ? `${Math.round(v * 100)}%` : 'off');
const semis = (v: number) => `${v > 0 ? '+' : ''}${v} st`;

export const AudioInspector: React.FC<InspectorProps> = (P) => {
  const { layer, item, send } = P;
  const S = useSettings(P);
  const props = layer.props || {};
  const voice = props.voice || null;  // null = no voice chain (sound effects, music)
  const v = (k: string, d: number) => voice?.[k] ?? d;
  const setVoice = (patch: any, commit = true) => S.layer({ voice: { ...(voice || { preset: 'natural', ...VOICE_PRESETS.natural }), ...patch, preset: patch.preset ?? 'custom' } }, commit);
  const pickPreset = (k: string) => k === 'none' ? S.layer({ voice: null }) : S.layer({ voice: { preset: k, ...VOICE_PRESETS[k] } });
  const hold = (on: boolean) => voice && send([{ op: 'layer.update', id: layer.id, props: { voice: { ...voice, bypass: on || null } } }], { commit: false });
  const clean = props.clean || 'off';
  // effects: one set at a time - this clip's (a clip picked) or the whole lane's
  const [scope, setScope] = useState<'clip' | 'lane'>('clip');
  const onClip = !!item && scope === 'clip';
  const fx = (onClip ? item.fx : props.fx) || {};
  const setFx = (patch: any, c: boolean) => (onClip ? S.item({ fx: fxPatch(item.fx, patch) }, c) : S.layer({ fx: fxPatch(props.fx, patch) }, c));
  const dur = item ? item.dur / P.fps : 0;
  return <div className="ins">
    <Head icon={ICON.audio} title={<>{layer.group ? `${layer.group} · ` : ''}{layer.name || 'Sound'}</>} sub={item ? `Clip ${item.id} · sound` : `Audio layer · ${layer.items?.length || 0} clips`} />

    <Sec title="Volume">
      <Slider label={item ? 'Whole lane' : 'Volume'} v={props.volume ?? 1} min={0} max={2} step={0.01} def={1} fmt={fmt.db} onChange={(x, c) => S.layer({ volume: x }, c)} />
      {item && <>
        <Slider label="This clip" v={item.gain ?? 1} min={0} max={2} step={0.01} def={1} fmt={fmt.db} onChange={(g, c) => S.item({ gain: g === 1 ? null : g }, c)} />
        <Slider label="Fade in" v={item.fade_in ?? 0} min={0} max={Math.min(3, dur)} step={0.01} def={0} fmt={fmt.s} onChange={(x, c) => S.item({ fade_in: x || null }, c)} />
        <Slider label="Fade out" v={item.fade_out ?? 0} min={0} max={Math.min(3, dur)} step={0.01} def={0} fmt={fmt.s} onChange={(x, c) => S.item({ fade_out: x || null }, c)} />
      </>}
      <ToggleRow label="Even out speech level" on={props.level === 'speech'} onChange={(on) => S.layer({ level: on ? 'speech' : null })} />
      <More label="Under other sounds, and the ending">
        {item && <Slider label="Lowers the voice while it plays" v={-(item.duck || 0)} min={0} max={24} step={0.5} def={0} fmt={(x) => (x ? `−${x} dB` : 'off')}
          onChange={(x, c) => S.item({ duck: x ? -x : null }, c)} />}
        <Slider label="Rise at the end" v={props.lift?.db || 0} min={0} max={14} step={0.5} def={0} fmt={(x) => (x ? `+${x} dB after the last word` : 'off')}
          onChange={(x, c) => S.layer({ lift: x ? { fade: 1.2, of: 'subs', ...(props.lift || {}), db: x } : null }, c)} />
        {props.lift?.db ? <Slider label="Rise over" v={props.lift.fade ?? 1.2} min={0.2} max={4} step={0.1} def={1.2} fmt={(x) => `${x.toFixed(1)} s`}
          onChange={(x, c) => S.layer({ lift: { ...props.lift, fade: x } }, c)} /> : null}
        <Note>The whole video goes to −14 LUFS with one gain at export; a limiter only catches the rare peak.</Note>
      </More>
    </Sec>

    <Sec title="Voice" end={<span className="ins-state">{voice ? cap(voice.preset || 'custom') : clean !== 'off' ? 'cleaned' : 'as recorded'}</span>}>
      <Row label="Noise"><Chips options={CLEAN} value={clean} onPick={(c) => S.layer({ clean: c === 'off' ? null : c })} /></Row>
      <Note>{CLEAN_NOTE[clean] || ''} Switching is instant; the export uses the same file.</Note>
      <Row label="Voice style"><Chips options={[['none', 'None'], ...PRESETS.map((k) => [k, cap(k)] as [string, string]), ...(voice?.preset === 'custom' ? [['custom', 'Custom'] as [string, string]] : [])]}
        value={voice ? voice.preset || 'custom' : 'none'} onPick={(k) => k !== 'custom' && pickPreset(k)} /></Row>
      {voice
        ? <Slider label="Clarity" v={v('presence', 0)} min={-3} max={8} step={0.5} def={0} fmt={sdb} onChange={(x, c) => setVoice({ presence: x }, c)} />
        : <Slider label="Clarity" v={props.presence ?? 0} min={-6} max={8} step={0.5} def={0} fmt={sdb} onChange={(x, c) => S.layer({ presence: x || null }, c)} />}
      {voice && <>
        <Slider label="Room" v={v('room', 0)} min={0} max={1} step={0.05} def={0} fmt={pct0} onChange={(x, c) => setVoice({ room: x }, c)} />
        {v('room', 0) > 0 && <Slider label="Room size" v={v('roomSize', 1.6)} min={0.4} max={3} step={0.1} def={1.6} fmt={(x) => `${x.toFixed(1)} s`} onChange={(x, c) => setVoice({ roomSize: x }, c)} />}
        <More label="Fine-tune the voice">
          <Slider label="Low cut" v={v('lowcut', 60)} min={0} max={200} step={5} def={60} fmt={(x) => (x ? `${x} Hz` : 'off')} onChange={(x, c) => setVoice({ lowcut: x }, c)} />
          <Slider label="Warmth" v={v('warmth', 0)} min={-6} max={6} step={0.5} def={0} fmt={sdb} onChange={(x, c) => setVoice({ warmth: x }, c)} />
          <Slider label="Boxiness" v={v('box', 0)} min={-6} max={3} step={0.5} def={0} fmt={sdb} onChange={(x, c) => setVoice({ box: x }, c)} />
          <Slider label="Soft s's" v={v('deess', 0)} min={0} max={1} step={0.05} def={0} fmt={pct0} onChange={(x, c) => setVoice({ deess: x }, c)} />
          <Slider label="Compression" v={v('comp', 0)} min={0} max={1} step={0.05} def={0} fmt={pct0} onChange={(x, c) => setVoice({ comp: x }, c)} />
          <Slider label="PA echo" v={v('pa', 0)} min={0} max={1} step={0.05} def={0} fmt={pct0} onChange={(x, c) => setVoice({ pa: x }, c)} />
        </More>
        <button className="btn" onPointerDown={() => hold(true)} onPointerUp={() => hold(false)} onPointerLeave={() => hold(false)}
          title="Hold while it plays: the voice without the voice style">Hold: hear it untouched</button>
      </>}
    </Sec>

    <Sec title="Effects" open={!!(item?.fx || props.fx || item?.soften)} end={<span className="ins-state ok">live</span>}>
      {item && <Row label="On"><Seg options={[['clip', 'This clip'], ['lane', 'Whole lane']]} value={scope} onPick={(x) => setScope(x as 'clip' | 'lane')} /></Row>}
      <Slider label="Pitch" v={fx.pitch || 0} min={-12} max={12} step={0.5} def={0} fmt={semis} onChange={(x, c) => setFx({ pitch: x || null }, c)} />
      <Row label="Sounds like"><Chips options={[['', 'Itself'], ...Object.entries(FILTERS).map(([k, x]) => [k, x.label] as [string, string])]} value={fx.filter || ''}
        onPick={(k) => setFx({ filter: k || null }, true)} /></Row>
      {fx.filter === 'echo' && <Slider label="Echo" v={fx.echo ?? 1} min={0} max={2} step={0.05} def={1} fmt={(x) => `${Math.round(x * 100)}%`} onChange={(x, c) => setFx({ echo: x }, c)} />}
      {(onClip || !voice || !!fx.room) && <>
        <Slider label="Room" v={fx.room || 0} min={0} max={1} step={0.05} def={0} fmt={pct0} onChange={(x, c) => setFx({ room: x || null }, c)} />
        {(fx.room || 0) > 0 && <Slider label="Room size" v={fx.roomSize ?? 1.6} min={0.4} max={3} step={0.1} def={1.6} fmt={(x) => `${x.toFixed(1)} s`} onChange={(x, c) => setFx({ roomSize: x }, c)} />}
      </>}
      {onClip && <ToggleRow label="Soften a shout" on={!!item.soften} onChange={(on) => S.item({ soften: on || null })} />}
      <Note>Pitch keeps the timing; the clip's speed (Clip, below) moves both, like a tape.</Note>
    </Sec>

    <ClipTiming P={P} source speedCtl fades={false} />
    <LayerState P={P} sound>
      <ToggleRow label="Keep its own pace (not sped up with the video)" on={!!props.own_pace} onChange={(on) => S.layer({ own_pace: on || null })} />
    </LayerState>
  </div>;
};
