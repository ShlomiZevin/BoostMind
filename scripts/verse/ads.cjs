// The verse's sponsored banners ("ממומן" - techietech-api/ads.js, the site's verse/ads.js). One record per sponsor in
// Firestore `ads/<id>`, its pictures in the media bucket (ads/<id>/<name>-<hash>.jpg - a changed picture = a new address).
// The next sponsor = a new json here + `put`; no code, no deploy. Runs with his admin login (gcloud ADC).
//   node scripts/verse/ads.cjs put scripts/verse/ads/<id>.json   upload the pictures, write the record (live)
//   node scripts/verse/ads.cjs off <id> | on <id>                take it down / put it back
//   node scripts/verse/ads.cjs list                              what's up, where, and how many citizens took the coupon
// json: { id, sponsor, href, alt, places: ["home", "c/<character>"], order, wide: <file 4:1>, card: <file ~2:1 for phones>,
//         coupon: { code, title, line, fine, logo: <file>, pic: <file> } } - file paths are relative to the json, or ~/...
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('../../techietech-api/node_modules/firebase-admin');

admin.initializeApp({ projectId: 'boostmind-b052c' });
const db = admin.firestore(), bucket = admin.storage().bucket('shlomiverse-media');
const [, , cmd, arg] = process.argv;

async function upload(id, name, file) {
  const buf = fs.readFileSync(file), h = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
  const ext = path.extname(file).toLowerCase(), dest = `ads/${id}/${name}-${h}${ext}`;
  await bucket.file(dest).save(buf, { contentType: ext === '.png' ? 'image/png' : 'image/jpeg', metadata: { cacheControl: 'public, max-age=31536000' } });
  return `https://storage.googleapis.com/shlomiverse-media/${dest}`;
}

(async () => {
  if (cmd === 'put') {
    const j = JSON.parse(fs.readFileSync(arg, 'utf8')), dir = path.dirname(arg), at = (f) => (f.startsWith('~/') ? path.join(require('os').homedir(), f.slice(2)) : path.resolve(dir, f));
    if (!/^[a-z0-9-]+$/.test(j.id || '')) throw new Error('id: lowercase letters, digits, -');
    const rec = { sponsor: j.sponsor, href: j.href || '', alt: j.alt || '', places: j.places || ['home'], order: j.order || 0, live: true,
      wide: await upload(j.id, 'wide', at(j.wide)), card: await upload(j.id, 'card', at(j.card || j.wide)), t: admin.firestore.FieldValue.serverTimestamp() };
    if (j.coupon) {
      rec.coupon = { code: j.coupon.code, title: j.coupon.title || '', line: j.coupon.line || '', fine: j.coupon.fine || '',
        logo: j.coupon.logo ? await upload(j.id, 'logo', at(j.coupon.logo)) : '', pic: j.coupon.pic ? await upload(j.id, 'pic', at(j.coupon.pic)) : '' };
    }
    await db.collection('ads').doc(j.id).set(rec, { merge: true });
    console.log(`ad ${j.id} is live on ${rec.places.join(', ')} (the site shows it within a minute)`);
  } else if (cmd === 'off' || cmd === 'on') {
    await db.collection('ads').doc(arg).update({ live: cmd === 'on' });
    console.log(`ad ${arg} ${cmd === 'on' ? 'is back' : 'is down'}`);
  } else if (cmd === 'list') {
    for (const d of (await db.collection('ads').get()).docs) {
      const a = d.data();
      console.log(`${d.id}  ${a.live ? 'LIVE' : 'off '}  ${a.sponsor}  on ${(a.places || []).join(', ')}  coupons taken: ${a.took || 0}`);
    }
  } else console.log('put <json> | off <id> | on <id> | list');
})().catch((e) => { console.error(e.message); process.exit(1); });
