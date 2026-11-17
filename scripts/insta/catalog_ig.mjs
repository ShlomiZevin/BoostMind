// Every video in the verse with its Instagram link, for the archive (gallery.py): [{id, ig, cast, hidden}] as JSON.
// Read-only, straight from Firestore catalogVideos with this computer's Google login.
//   node scripts/insta/catalog_ig.mjs out.json
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../../techietech-api/package.json', import.meta.url));
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'boostmind-b052c' });
const s = await admin.firestore().collection('catalogVideos').select('ig', 'cast', 'hidden').get();
fs.writeFileSync(process.argv[2], JSON.stringify(s.docs.map((d) => ({ id: d.id, ig: d.get('ig') || null, cast: d.get('cast') || [], hidden: !!d.get('hidden') }))));
process.exit(0);
