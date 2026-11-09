// How loved each resident is, for ציפציפ's draw (techietech-api/tz.js candidates(): his rule 2026-11-09 - "randomly choose
// characters, but give more weight to the loved ones"): the Instagram likes of every reel they're in (scripts/wiki/reels.json,
// kept by insta-to-verse) -> verseMeta/tz.love { id: likes }. Run again after a batch of reels; his admin login (gcloud ADC).
//   node scripts/verse/tz-love.cjs          print the table and write it
//   node scripts/verse/tz-love.cjs --dry    print only
const fs = require('fs');
const path = require('path');
const admin = require('../../techietech-api/node_modules/firebase-admin');

const reels = JSON.parse(fs.readFileSync(path.join(__dirname, '../wiki/reels.json'), 'utf8'));
const love = {};
for (const r of reels) for (const id of r.cast || []) love[id] = (love[id] || 0) + (r.likes || 0);
const top = Object.entries(love).sort((a, b) => b[1] - a[1]);
console.log(top.map(([id, n]) => `${id} ${n}`).join('\n'));
if (process.argv.includes('--dry')) process.exit(0);
admin.initializeApp({ projectId: 'boostmind-b052c' });
admin.firestore().collection('verseMeta').doc('tz').set({ love, loveAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
  .then(() => console.log(`\nverseMeta/tz.love: ${top.length} residents`)).catch((e) => { console.error(e.message); process.exit(1); });
