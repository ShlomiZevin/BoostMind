// Take the words out of parts of a story picture, so they can be real boxes instead (zoomcut/skill/verse-story):
// GPT Image 2.5 (OpenAI direct, MEDIUM) repaints ONLY the given areas as the scene behind the words; everything outside
// them is the original's own pixels, put back afterwards (a soft edge), so faces and the rest never change.
//   node scripts/stories/clean-words.mjs <in.jpg|png> <out.jpg> "x1,y1,x2,y2" ["x1,y1,x2,y2" ...]   (areas in % of the picture)
//   optional: --hint "what is behind the words, e.g. the white lace of the wedding dress"
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const hintAt = args.indexOf('--hint');
const hint = hintAt >= 0 ? args.splice(hintAt, 2)[1] : '';
const [src, out, ...areas] = args;
if (!src || !out || !areas.length) { console.error('usage: node clean-words.mjs in.jpg out.jpg "x1,y1,x2,y2" ... [--hint "..."]'); process.exit(1); }
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = process.env.OPENAI_API_KEY || envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');   // another computer: set OPENAI_API_KEY
const tmp = path.join(path.dirname(out), '.clean-' + Date.now());
fs.mkdirSync(tmp, { recursive: true });
const py = (code, ...a) => execFileSync('python', ['-I', '-c', code, ...a], { encoding: 'utf8' }).trim();

// the picture as PNG at a size the model takes (both sides a multiple of 16), and the mask: see-through = repaint
const size = py(`
import sys; from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB'); W, H = im.size
w, h = (W // 16) * 16, (H // 16) * 16
im.resize((w, h), Image.LANCZOS).save(sys.argv[2])
m = Image.new('RGBA', (w, h), (0, 0, 0, 255))
for a in sys.argv[3:]:
    x1, y1, x2, y2 = [float(v) for v in a.split(',')]
    m.paste((0, 0, 0, 0), (int(x1 / 100 * w), int(y1 / 100 * h), int(x2 / 100 * w), int(y2 / 100 * h)))
m.save(sys.argv[2].replace('.png', '-mask.png'))
print(f'{w}x{h}')`, src, path.join(tmp, 'in.png'), ...areas);

const prompt = `Remove every written word, letter and text panel inside the masked areas of this picture, and paint there only
what is naturally behind them${hint ? ' (' + hint + ')' : ''}: the same scene, light, colours, texture and style, seamless with
the rest. No text, no letters, no signs, no new objects, no people. Change nothing outside the masked areas.`;
const form = new FormData();
form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', prompt); form.append('size', size);
form.append('quality', 'medium'); form.append('n', '1'); form.append('output_format', 'png');
form.append('image[]', new Blob([fs.readFileSync(path.join(tmp, 'in.png'))], { type: 'image/png' }), 'in.png');
form.append('mask', new Blob([fs.readFileSync(path.join(tmp, 'in-mask.png'))], { type: 'image/png' }), 'mask.png');
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
const j = await res.json();
if (!res.ok) { console.error('FAILED', res.status, j.error?.message); process.exit(1); }
fs.writeFileSync(path.join(tmp, 'model.png'), Buffer.from(j.data[0].b64_json, 'base64'));

// only the areas come from the model; the rest is the original, with a soft edge between them
py(`
import sys; from PIL import Image, ImageFilter
orig = Image.open(sys.argv[1]).convert('RGB'); W, H = orig.size
gen = Image.open(sys.argv[2]).convert('RGB').resize((W, H), Image.LANCZOS)
m = Image.new('L', (W, H), 0)
for a in sys.argv[4:]:
    x1, y1, x2, y2 = [float(v) for v in a.split(',')]
    m.paste(255, (int(x1 / 100 * W), int(y1 / 100 * H), int(x2 / 100 * W), int(y2 / 100 * H)))
m = m.filter(ImageFilter.GaussianBlur(max(4, W // 200)))
Image.composite(gen, orig, m).save(sys.argv[3], quality=92)`, src, path.join(tmp, 'model.png'), out, ...areas);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('ok', out, j.usage ? `(${j.usage.total_tokens} tokens)` : '');
