// Export the picked logo direction to the paths the editor, marketing and the site use. Switching = run with another letter.
//   node scripts/releases/naomi/logo/export.mjs B        (round 1: A|B|C, logo-options.jpg; round 2 from scratch: D|E|F, logo-options-2.jpg)
// -> zoomcut/episodes/_assets/naomi/logo/{logo.svg, logo.png, logo-white.svg, logo-white.png, mark.svg, mark.png,
//    mark-white.svg, mark-white.png, PICK.txt}  +  public/dr-naomi/brand/ (the site's copies)
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire('C:/workspace/BoostMind/techietech-api/package.json');
const sharp = require('sharp');
const ROOT = 'C:/workspace/BoostMind';
const pick = (process.argv[2] || 'B').toUpperCase();
const NAMES = { A: 'A - הקו הנקי (outline heart, 5 stage ticks, red needle)', B: 'B - החותם (solid burgundy heart seal, cream dial, red needle, gold ticks)', C: 'C - המד (fine heart line, gold half-gauge, burgundy needle)',
  D: 'D - ציפורה (round 2: a perched songbird - her name; Bellefair + Assistant; deep teal #1E4B4F)',
  E: 'E - הביצה והמחוג (round 2: an egg with the inner needle pointing to one o-clock; IBM Plex Sans Hebrew; clay #A4492F)',
  F: 'F - הבית (round 2: an arched door with the monogram נצ; Noto Serif Hebrew; aubergine #3A1D35)' };
// the app icon's square = the direction's dark colour (round 2 changed the palette; the site's own colours follow separately)
const ICON_BG = { A: '#6B1023', B: '#6B1023', C: '#6B1023', D: '#1E4B4F', E: '#6E2E1D', F: '#3A1D35' };
if (!NAMES[pick]) { console.log('unknown direction', pick, '- one of', Object.keys(NAMES).join('|')); process.exit(1); }
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
const icon = await sharp({ create: { width: 512, height: 512, channels: 4, background: ICON_BG[pick] } })
  .composite([{ input: await sharp(fs.readFileSync(path.join(src, `${pick}-mark-white.svg`)), { density: 600 }).resize({ width: 340 }).png().toBuffer(), gravity: 'center' }])
  .png().toBuffer();
fs.writeFileSync(path.join(dests[1], 'icon.png'), icon);
fs.writeFileSync(path.join(dests[0], 'PICK.txt'), `Picked: ${NAMES[pick]} - chosen by the site session 2026-11-22; options sheets scripts/releases/naomi/private/logo-options.jpg (A-C) + logo-options-2.jpg (D-F); switch = node scripts/releases/naomi/logo/export.mjs <A-F>\n`);
console.log('OK', pick, dests.join(' , '));
