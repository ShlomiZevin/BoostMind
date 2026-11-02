// The ready sticker pack (his ask, 2026-11-02): the characters' classic lines as WhatsApp stickers on the site (GPT Image
// 2.5), each from the frame where the line is said. The look is HIS reference (sticker-style.jpg, "I rather have the
// stickers looking like this"): an illustrated comic portrait with black ink lines, a thick white die-cut border, the line in
// big white letters with a heavy black outline across the bottom.
//   node scripts/v2-design/sticker-pack.mjs [only-id ...]   ->  v2/site/verse/pack/<id>.webp + pack.json
// Frames: the takes in Downloads\drop (the studio's word transcripts give the second) and the reels in scripts/insta/work.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const OUT = 'C:/workspace/BoostMind/v2/site/verse/pack';
const D = 'C:/Users/shazbak/Downloads/drop';
const R = 'C:/workspace/BoostMind/scripts/insta/work';
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '');
const OAI = envKey('C:/workspace/aspect/aspect-agent-server/.env', 'OPENAI_API_KEY');

// id, character, the line (as in the canon - Hani's Ashkenazi "פילאי פלואים"), the take, the second, crop (top % to drop: a
// reel's burned-in caption)
const PACK = [
  ['hani-pilei', 'hani', 'פילאי פלואים', `${D}/חני - 3/E1137148-9F48-4710-9A6E-EBD7C5944C07.mp4`, 8.08],
  ['hani-nes', 'hani', 'נס בתוך נס', `${D}/חני - 3/648399CD-0EB9-4E67-AC85-44915272A25A.mp4`, 24.2],
  ['hani-chasdei', 'hani', 'חסדי השם', `${D}/חני - 3/648399CD-0EB9-4E67-AC85-44915272A25A.mp4`, 5.08],
  ['hani-siata', 'hani', 'סייעתא דשמיא', `${D}/חני - 3/648399CD-0EB9-4E67-AC85-44915272A25A.mp4`, 24.8],   // the filtered takes only (the raw ones show stubble)
  ['hani-besorot', 'hani', 'בשורות טובות', `${D}/חני - 3/648399CD-0EB9-4E67-AC85-44915272A25A.mp4`, 4.18],
  ['yotam-beseder', 'yotam', 'זה בסדר, זה בסדר', `${R}/18455216959136322/video.mp4`, 11.6, 22],
  ['gilad-business', 'gilad', 'אותי מעניין מה הביזנס', `${D}/Zoom/2953F9F4-C9E5-4F04-9784-B28ECD45BD89.mp4`, 66.01],
  ['gilad-takshiv', 'gilad', 'תקשיב, תקשיב, תקשיב', `${D}/Zoom/839A8301-E833-49A8-9724-6FFA1A8CA905.mp4`, 25.3],
  ['yaniv-ortho', 'yaniv', 'יש לי אישור מאורתופד', `${R}/18107191474972491/video.mp4`, 50.17, 28],   // the broken security guy
  ['yaniv-serious', 'yaniv', 'אני רציני איתך', `${R}/18093288425053068/video.mp4`, 23.18, 28],
];

const STYLE = 'C:/workspace/BoostMind/scripts/v2-design/sticker-style.jpg';
const PROMPT = (text) => `Make one die-cut WhatsApp sticker of the person in the FIRST image (a frame from a comedy video), drawn
in exactly the style of the SECOND image (the style reference - copy its look, not its person or its words):
- an illustrated comic / vector portrait: clean bold black ink outlines, flat cel-shaded colour with a few soft tones, fine
  line detail on the face (stubble, wrinkles) - not a photo, not a 3D render;
- the person EXACTLY as in the first image: the same face, expression, hair or wig, head covering, glasses and clothes - a
  faithful, instantly recognisable likeness of this exact person, never a different or prettier one. Head and shoulders,
  cut out from the background, the expression as strong as in the frame;
- a thick clean white border around the whole sticker (the person and the lettering together, one silhouette), a very
  subtle shadow;
- across the bottom, overlapping the shoulders, big bold Hebrew letters (right-to-left, correctly spelled, every letter
  exact) that say: "${text}" - white letters with a heavy black outline, like the reference; nothing else written.
Transparent background around the sticker. No watermark, no logo.`;

fs.mkdirSync(OUT, { recursive: true });
const tmp = path.join(process.env.TEMP, 'pack');
fs.mkdirSync(tmp, { recursive: true });
const only = process.argv.slice(2);
const listFile = path.join(OUT, 'pack.json');
const list = fs.existsSync(listFile) ? JSON.parse(fs.readFileSync(listFile, 'utf8')) : [];
for (const [id, char, text, src, t, cropTop = 0] of PACK) {
  if (only.length && !only.includes(id)) continue;
  const frame = path.join(tmp, id + '.jpg');
  const vf = cropTop ? `crop=iw:ih*${(100 - cropTop) / 100}:0:ih*${cropTop / 100},scale=-2:1280` : 'scale=-2:1280';
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', src, '-frames:v', '1', '-vf', vf, '-q:v', '2', frame]);
  const form = new FormData();
  form.append('model', 'gpt-image-2.5-sunburst'); form.append('prompt', PROMPT(text)); form.append('size', '1024x1024');
  form.append('quality', process.env.Q || 'medium'); form.append('background', 'transparent'); form.append('output_format', 'webp'); form.append('n', '1');
  form.append('image[]', new Blob([fs.readFileSync(frame)], { type: 'image/jpeg' }), 'frame.jpg');
  form.append('image[]', new Blob([fs.readFileSync(STYLE)], { type: 'image/jpeg' }), 'style.jpg');
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: form });
  const j = await res.json();
  if (!res.ok) { console.log('FAILED', id, res.status, j.error?.message); continue; }
  const full = path.join(tmp, id + '-full.webp');
  fs.writeFileSync(full, Buffer.from(j.data[0].b64_json, 'base64'));
  // the site gets WhatsApp's own size (512) and a grid thumbnail (240) - the 1024 original is ~700 KB
  execFileSync('python', ['-c', `from PIL import Image; im = Image.open(r'${full}').convert('RGBA'); im.resize((512, 512), Image.LANCZOS).save(r'${path.join(OUT, id + '.webp')}', 'WEBP', quality=88, method=6); im.resize((240, 240), Image.LANCZOS).save(r'${path.join(OUT, id + '-s.webp')}', 'WEBP', quality=82, method=6)`]);
  const row = { id, char, text, img: `/verse/pack/${id}.webp`, thumb: `/verse/pack/${id}-s.webp` };
  const i = list.findIndex((x) => x.id === id);
  if (i >= 0) list[i] = row; else list.push(row);
  console.log('ok', id, j.usage ? `in ${j.usage.input_tokens} out ${j.usage.output_tokens}` : '');
}
list.sort((a, b) => PACK.findIndex((p) => p[0] === a.id) - PACK.findIndex((p) => p[0] === b.id));
fs.writeFileSync(listFile, JSON.stringify(list, null, 1));
