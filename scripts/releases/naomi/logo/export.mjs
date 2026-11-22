// Export the picked logo direction to the paths the editor, marketing and the site use. Switching = run with another letter.
//   node scripts/releases/naomi/logo/export.mjs B
// -> zoomcut/episodes/_assets/naomi/logo/{logo.svg, logo.png, logo-white.svg, logo-white.png, mark.svg, mark.png,
//    mark-white.svg, mark-white.png, PICK.txt}  +  public/dr-naomi/brand/ (the site's copies)
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire('C:/workspace/BoostMind/techietech-api/package.json');
const sharp = require('sharp');
const ROOT = 'C:/workspace/BoostMind';
const pick = (process.argv[2] || 'B').toUpperCase();
const NAMES = { A: 'A - הקו הנקי (outline heart, 5 stage ticks, red needle)', B: 'B - החותם (solid burgundy heart seal, cream dial, red needle, gold ticks)', C: 'C - המד (fine heart line, gold half-gauge, burgundy needle)' };
const src = path.join(ROOT, 'scripts/releases/naomi/logo/out');
const dests = [path.join(ROOT, 'zoomcut/episodes/_assets/naomi/logo'), path.join(ROOT, 'public/dr-naomi/brand')];
for (const d of dests) fs.mkdirSync(d, { recursive: true });
const files = { 'logo': `${pick}-logo`, 'logo-white': `${pick}-logo-white`, 'mark': `${pick}-mark`, 'mark-white': `${pick}-mark-white` };
for (const [name, from] of Object.entries(files)) {
  const svg = fs.readFileSync(path.join(src, from + '.svg'));
  const width = name.startsWith('logo') ? 1600 : 1024;
  const png = await sharp(svg, { density: 600 }).resize({ width }).png().toBuffer();
  for (const d of dests) {
    fs.writeFileSync(path.join(d, name + '.svg'), svg);
    if (d === dests[0]) fs.writeFileSync(path.join(d, name + '.png'), png);   // the site uses the SVGs
  }
}
// the site's favicon / app icon: the white mark on a burgundy rounded square
const icon = await sharp({ create: { width: 512, height: 512, channels: 4, background: '#6B1023' } })
  .composite([{ input: await sharp(fs.readFileSync(path.join(src, `${pick}-mark-white.svg`)), { density: 600 }).resize({ width: 340 }).png().toBuffer(), gravity: 'center' }])
  .png().toBuffer();
fs.writeFileSync(path.join(dests[1], 'icon.png'), icon);
fs.writeFileSync(path.join(dests[0], 'PICK.txt'), `Picked: ${NAMES[pick]} - chosen by the site session 2026-11-22; options sheet scripts/releases/naomi/private/logo-options.jpg; switch = node scripts/releases/naomi/logo/export.mjs <A|B|C>\n`);
console.log('OK', pick, dests.join(' , '));
