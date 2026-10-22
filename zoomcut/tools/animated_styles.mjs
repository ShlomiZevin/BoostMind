// Which text / subtitle styles move by themselves every frame - read from the style registry itself
// (render/src/layers/styles.tsx: `animated: true`), so the export never freezes a new animated style.
//   node tools/animated_styles.mjs   -> ["ticker", "thought", ...]   (the export caches it per styles' mtimes)
import { build } from '../render/node_modules/esbuild/lib/main.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(ROOT, 'render', `.zc-styles-${process.pid}.mjs`);  // (inside render/: react and remotion resolve from its node_modules)
await build({
  stdin: { contents: "export { TEXT_STYLES, SUB_STYLES } from './styles';", resolveDir: path.join(ROOT, 'render', 'src', 'layers'), loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error', jsx: 'automatic',
  nodePaths: [path.join(ROOT, 'render', 'node_modules')],
  external: ['react', 'react/jsx-runtime', 'remotion', '@remotion/*'],
});
try {
  const m = await import(pathToFileURL(out).href);
  const names = Object.entries({ ...m.TEXT_STYLES, ...m.SUB_STYLES }).filter(([, s]) => s && s.animated).map(([k]) => k);
  process.stdout.write(JSON.stringify(names));
} finally {
  fs.rmSync(out, { force: true });
}
