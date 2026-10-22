// An audio layer (a voice, sound effects, music): cleaning (RNNoise and the FFT ones - prepared in seconds by the studio,
// pipeline/layers_audio.py), the voice chain he tuned for the news anchor (sound.ts presets - live in the editor
// through AudioTrack, the same chain renders the export), level, and the selected clip's piece / gain / fades.
import React from 'react';
import { VOICE_PRESETS } from '../../sound';
import { InspectorProps, useSettings, Head, Sec, Row, Note, Seg, Chips, Slider, ToggleRow, ClipTiming, LayerState, ICON, fmt } from './controls';

const CLEAN: [string, string][] = [['off', 'Off'], ['mild', 'Mild'], ['strong', 'Strong'], ['nn', 'NN']];
const CLEAN_NOTE: Record<string, string> = {
  off: 'The recording as it is.',
  mild: 'A light noise filter (FFT) - hiss and room tone.',
  strong: 'A stronger FFT filter - noisy rooms; can thin the voice.',
  nn: 'RNNoise, the neural filter - takes out air-conditioner and fan hum and keeps the voice (the news-anchor fix).',
};
const PRESETS = Object.keys(VOICE_PRESETS);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const sdb = (v: number) => `${v > 0 ? '+' : ''}${v} dB`;
const pct0 = (v: number) => (v ? `${Math.round(v * 100)}%` : 'off');

export const AudioInspector: React.FC<InspectorProps> = (P) => {
  const { layer, item, send } = P;
  const S = useSettings(P);
  const props = layer.props || {};
  const voice = props.voice || null;  // null = no voice chain (sound effects, music)
  const v = (k: string, d: number) => voice?.[k] ?? d;
  const setVoice = (patch: any, commit = true) => S.layer({ voice: { ...(voice || { preset: 'natural', ...VOICE_PRESETS.natural }), ...patch, preset: patch.preset ?? 'custom' }, ...(patch.presence != null ? { presence: null } : {}) }, commit);
  const pickPreset = (k: string) => k === 'none' ? S.layer({ voice: null }) : S.layer({ voice: { preset: k, ...VOICE_PRESETS[k] }, presence: null });
  const hold = (on: boolean) => voice && send([{ op: 'layer.update', id: layer.id, props: { voice: { ...voice, bypass: on || null } } }], { commit: false });
  const clean = props.clean || 'off';
  return <div className="ins">
    <Head icon={ICON.audio} title={<>{layer.group ? `${layer.group} · ` : ''}{layer.name || 'Sound'}</>} sub={item ? `Clip ${item.id} · sound` : `Audio layer · ${layer.items?.length || 0} clips`} />
    {item && <>
      <ClipTiming P={P} source />
      <Sec title="This clip">
        <Slider label="Gain" v={item.gain ?? 1} min={0} max={2} step={0.01} def={1} fmt={fmt.db} onChange={(g, c) => S.item({ gain: g === 1 ? null : g }, c)} />
        <ToggleRow label="Soften a shout" on={!!item.soften} onChange={(on) => S.item({ soften: on || null })} />
      </Sec>
    </>}

    <Sec title="Cleaning" end={<span className="ins-state ok">{clean === 'nn' ? 'RNNoise' : clean === 'off' ? 'off' : 'FFT'}</span>}>
      <Seg options={CLEAN} value={clean} onPick={(c) => S.layer({ clean: c === 'off' ? null : c })} />
      <Note>{CLEAN_NOTE[clean]} Prepared by the studio in seconds; editor and export use the same file.</Note>
    </Sec>

    <Sec title="Voice" open={!!voice} end={<span className="ins-state">{voice ? cap(voice.preset || 'custom') : 'none'}</span>}>
      <Chips options={[['none', 'None'], ...PRESETS.map((k) => [k, cap(k)] as [string, string]), ...(voice?.preset === 'custom' ? [['custom', 'Custom'] as [string, string]] : [])]}
        value={voice ? voice.preset || 'custom' : 'none'} onPick={(k) => k !== 'custom' && pickPreset(k)} />
      {voice ? <>
        <Slider label="Boost" v={v('boost', 0)} min={-30} max={12} step={0.5} def={0} fmt={sdb} onChange={(x, c) => setVoice({ boost: x }, c)} />
        <Slider label="Low cut" v={v('lowcut', 60)} min={0} max={200} step={5} def={60} fmt={(x) => (x ? `${x} Hz` : 'off')} onChange={(x, c) => setVoice({ lowcut: x }, c)} />
        <Slider label="Warmth" v={v('warmth', 0)} min={-6} max={6} step={0.5} def={0} fmt={sdb} onChange={(x, c) => setVoice({ warmth: x }, c)} />
        <Slider label="Boxiness" v={v('box', 0)} min={-6} max={3} step={0.5} def={0} fmt={sdb} onChange={(x, c) => setVoice({ box: x }, c)} />
        <Slider label="Presence" v={v('presence', 0)} min={-3} max={8} step={0.5} def={0} fmt={sdb} onChange={(x, c) => setVoice({ presence: x }, c)} />
        <Slider label="Soft s's" v={v('deess', 0)} min={0} max={1} step={0.05} def={0} fmt={pct0} onChange={(x, c) => setVoice({ deess: x }, c)} />
        <Slider label="Compression" v={v('comp', 0)} min={0} max={1} step={0.05} def={0} fmt={pct0} onChange={(x, c) => setVoice({ comp: x }, c)} />
        <Slider label="Room" v={v('room', 0)} min={0} max={1} step={0.05} def={0} fmt={pct0} onChange={(x, c) => setVoice({ room: x }, c)} />
        {v('room', 0) > 0 && <Slider label="Room size" v={v('roomSize', 1.6)} min={0.4} max={3} step={0.1} def={1.6} fmt={(x) => `${x.toFixed(1)} s`} onChange={(x, c) => setVoice({ roomSize: x }, c)} />}
        <Slider label="PA echo" v={v('pa', 0)} min={0} max={1} step={0.05} def={0} fmt={pct0} onChange={(x, c) => setVoice({ pa: x }, c)} />
        <button className="btn" onPointerDown={() => hold(true)} onPointerUp={() => hold(false)} onPointerLeave={() => hold(false)}
          title="Hold while it plays: the voice without this chain">Hold: hear it untouched</button>
        <Note>Live while it plays - the export renders the same chain.</Note>
      </> : <>
        <Slider label="Clarity" v={props.presence ?? 0} min={-6} max={8} step={0.5} def={0} fmt={sdb} onChange={(x, c) => S.layer({ presence: x || null }, c)} />
        <Note>No voice chain - pick a preset for a voice (News is the anchor voice he liked).</Note>
      </>}
    </Sec>

    <Sec title="Level">
      <Slider label="Volume" v={props.volume ?? 1} min={0} max={2} step={0.01} def={1} fmt={fmt.db} onChange={(x, c) => S.layer({ volume: x }, c)} />
      <ToggleRow label="Even out speech level" on={props.level === 'speech'} onChange={(on) => S.layer({ level: on ? 'speech' : null })} />
      <Row label="Mix"><Note>The whole video goes to −14 LUFS with one gain; a limiter only catches the rare peak.</Note></Row>
    </Sec>
    <LayerState P={P} sound />
  </div>;
};
