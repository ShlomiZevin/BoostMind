// data/queens.json is the source of truth for the queens (and the Firestore seed later).
// This writes web/js/queens.js from it. Run after editing the JSON:  node scripts/build-queens.mjs
import fs from 'node:fs';
const root = new URL('..', import.meta.url);
const queens = JSON.parse(fs.readFileSync(new URL('data/queens.json', root), 'utf8'));
fs.writeFileSync(new URL('web/js/queens.js', root),
  '// Generated from data/queens.json by scripts/build-queens.mjs — do not edit by hand.\n' +
  'window.QUEENS = ' + JSON.stringify(queens, null, 2) + ';\n');
console.log(`web/js/queens.js <- ${queens.length} queens`);
