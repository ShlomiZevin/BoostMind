// Builder action "prepare": raw footage -> natural clips in Media, before any editing (tools/prepare_clips.py - his ask,
// 2026-11-26: "prepare the clips first"). A job like any other: one heavy job at a time, its log in the jobs list.
// body: { assets: [take ids] (default: every take), script: 'scripts/<id>.txt', markers: 'אקשן,קאט', dry: true }
export default async ({ id, body, runJob, pub }) => {
  const b = body || {};
  const cmd = ['tools/prepare_clips.py', `episodes/${id}`];
  if (Array.isArray(b.assets) && b.assets.length) cmd.push('--assets', b.assets.map(String).join(','));
  if (b.script) cmd.push('--script', String(b.script));
  if (b.markers) cmd.push('--markers', String(b.markers));
  if (b.dry) cmd.push('--dry');
  return pub(runJob(id, [], null, [], { kind: 'prepare', cmd }));
};
