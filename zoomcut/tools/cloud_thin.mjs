// Free this computer's space: scratch, and the heavy files of projects untouched for N days that the cloud holds
// identically (render/cloud/thin.mjs - the rules). The studio does the same by itself once a day.
//   node tools/cloud_thin.mjs [--days=7] [--only=<id>] [--dry]
import { thin } from '../render/cloud/thin.mjs';

const arg = (k) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3);
const jobs = await fetch('http://127.0.0.1:4747/api/jobs').then((r) => r.json()).catch(() => null);
const running = new Set([...(jobs?.running || []), ...(jobs?.busy || [])].map((j) => j.id || j));
await thin({ days: +(arg('days') ?? 7), only: arg('only') || null, dry: process.argv.includes('--dry'), busy: (id) => running.has(id) });
