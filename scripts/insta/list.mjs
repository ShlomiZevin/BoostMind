// Every post on his Instagram with its numbers - read-only, the first step of Instagram -> Shlomiverse.
//   node scripts/insta/list.mjs [out.json] [--views]
// Uses the Sketch Studio Instagram key (zoomcut/.env, IG_TOKEN / IG_USER_ID - the same one Publish posts with).
// --views also asks each reel's insights for its plays (one call per reel; needs the insights permission).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, 'zoomcut/.env'), 'utf8').split(/\r?\n/)
  .map((l) => l.match(/^([A-Z_0-9]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const G = 'https://graph.instagram.com/v23.0', T = env.IG_TOKEN;
const out = process.argv.slice(2).find((a) => !a.startsWith('--')) || path.join(ROOT, 'scripts/insta/work/media.json');
const wantViews = process.argv.includes('--views');

const get = async (url) => {
  const r = await (await fetch(url)).json();
  if (r.error) throw new Error(`${r.error.code} ${r.error.message}`);
  return r;
};

const fields = 'id,media_type,media_product_type,caption,permalink,timestamp,like_count,comments_count,thumbnail_url';
let url = `${G}/${env.IG_USER_ID}/media?fields=${fields}&limit=100&access_token=${T}`;
const media = [];
while (url) {
  const page = await get(url);
  media.push(...page.data);
  url = page.paging?.next;
  process.stdout.write(`\r${media.length} posts`);
}
console.log();

if (wantViews) {
  const reels = media.filter((m) => m.media_type === 'VIDEO');
  let i = 0, failed = 0;
  for (const m of reels) {
    try {
      const r = await get(`${G}/${m.id}/insights?metric=views,reach,saved,shares&access_token=${T}`);
      for (const x of r.data) m[x.name] = x.values?.[0]?.value ?? x.total_value?.value;
    } catch (e) {
      m.insights_error = e.message;
      if (++failed === 3 && i < 3) { console.log('insights refused:', e.message); break; }
    }
    process.stdout.write(`\rviews ${++i}/${reels.length}`);
  }
  console.log();
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(media, null, 1));
console.log('wrote', out);
