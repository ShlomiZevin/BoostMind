// Builder action "eyes": eye contact for a layered project's takes, as a job (pipeline/eyes_layers.py).
// body: { mode: 'nvidia' | 'neural', strength, dy, nudge: 'x,y', assets: [ids], files: {asset: path}, seconds }
export default async ({ id, body, runJob, pub }) => {
  const b = body || {};
  const cmd = ['-m', 'pipeline.eyes_layers', `episodes/${id}`, '--mode', b.mode === 'neural' ? 'neural' : 'nvidia'];
  if (b.strength != null) cmd.push('--strength', String(+b.strength));
  if (b.dy != null) cmd.push('--dy', String(+b.dy));
  if (b.nudge) cmd.push(`--nudge=${String(b.nudge).replace(/[^\d.,-]/g, '')}`);
  if (Array.isArray(b.assets) && b.assets.length) cmd.push('--assets', b.assets.join(','));
  for (const [aid, f] of Object.entries(b.files || {})) cmd.push('--file', `${aid}=${f}`);
  if (b.seconds) cmd.push('--seconds', String(+b.seconds));
  return pub(runJob(id, [], null, [], { kind: 'eyes', cmd }));
};
