// Put a file into the asset library with its labels, or label one that's there (his rule, 2026-11-02: everything a
// session makes for a video goes into the editor's assets right away, labelled with everything relevant).
//   node tools/library_add.mjs <file> --about "office wall, morning light, for Techy-Tech Zoom calls" --tags "office, bright, zoom, background" [--kind background|picture|icon|music|sound|video] [--project tzvika-1] [--series zoom]
//   node tools/library_add.mjs --label <id> --about "..." --tags "..."      (an item that went in without labels)
//   node tools/library_add.mjs --unlabelled                                  (the items still waiting for labels)
// The generators (tools/leonardo.mjs, tools/elevenlabs_music.mjs) do the first line themselves with the same flags.
import { addToLibrary, report, labelFlags, INDEX, LIB } from './library_lib.mjs';
import { readJson } from '../render/cloud/layout.mjs';
import path from 'node:path';

const argv = process.argv.slice(2);
if (argv[0] === '--unlabelled') {
  const xs = readJson(INDEX, { items: [] }).items.filter((x) => x.unlabelled);
  console.log(xs.length ? xs.map((x) => `${x.id}  ${x.file}${x.prompt ? '  - ' + x.prompt.slice(0, 80) : ''}`).join('\n') : 'every new item has its labels');
} else if (argv[0] === '--label') {
  const id = argv[1], { labels } = labelFlags(argv.slice(2));
  const it = readJson(INDEX, { items: [] }).items.find((x) => x.id === id);
  if (!it) { console.log('no item ' + id); process.exit(1); }
  console.log(report(await addToLibrary(path.join(LIB, it.file), labels)));
} else {
  const { labels, rest } = labelFlags(argv);
  if (!rest[0]) { console.log('node tools/library_add.mjs <file> --about "..." --tags "..." [--kind ...] [--project ...]'); process.exit(1); }
  console.log(report(await addToLibrary(rest[0], { ...labels, made: labels.made || 'by hand' })));
}
