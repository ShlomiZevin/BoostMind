// Builder action "faceswap" (a beta): another face on a layered project's takes, as a job (pipeline/face_layers.py).
// body: { image: <picture asset id>, assets: [ids], blend: 'a' | 'c', seconds }
export default async ({ id, dir, body, runJob, pub }) => {
  const b = body || {};
  if (!b.image) return { error: 'Pick the face picture first' };
  const cmd = ['-m', 'pipeline.face_layers', dir, '--image', String(b.image), '--blend', b.blend === 'c' ? 'c' : 'a'];
  if (Array.isArray(b.assets) && b.assets.length) cmd.push('--assets', b.assets.join(','));
  if (b.seconds) cmd.push('--seconds', String(+b.seconds));
  return pub(runJob(id, [], null, [], { kind: 'faceswap', cmd }));
};
