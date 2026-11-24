// Trip app MAP (his ask 2026-11-24, after ChatGPT drew a dark map of the trip's places): mockup first, build to approved.
// One image, three phone screens, built on the live app's look + his ChatGPT map screenshot. gpt-image-2.6-flare MEDIUM.
// node scripts/v2-design/trip-app-map.mjs <live app jpg> <chatgpt map png> <out jpg>
import fs from 'node:fs'
import { createRequire } from 'node:module'
const sharp = createRequire('c:/workspace/trip-planner/package.json')('sharp')
const [LIVE, REF, OUT] = process.argv.slice(2)
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find(l => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '')
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY')

const PROMPT = `Design for a PHONE-ONLY trip guide app. One flat image, landscape: THREE phone screens side by side, numbered
"1", "2", "3" above them. Hebrew right-to-left; spell every Hebrew word exactly as given.

Attached: (a) the app as it is live today - keep its visual language exactly: colours (trip green, the AI guide in indigo),
soft cards, line icons, the slim top bar ("שטרסבורג · 21–24 בדצמבר" with a small tree, a lightning button, a "⋯" button)
and the bottom bar with five tabs "בית", "התוכנית", the raised round robot guide "המדריך" in the centre, "מקומות", "ארנק";
(b) a map another assistant drew of the same trip - a dark city map where every place is a round dark badge with a small
coloured icon and its Hebrew name under it. We like that idea; make it ours, cleaner.

New feature: a MAP of the trip inside the "מקומות" tab (active tab), with a segmented switch at the top "רשימה / מפה"
(on "מפה"). The map fills the screen between the top bar and the bottom bar. On it: every place of the plan as a round
badge with an icon and its Hebrew name ("שוק כיכר ברוי", "כיכר קלבר", "הקתדרלה", "פטיט פראנס", "סכר ובן"), the hotel
as a distinct home badge ("Hôtel Diana Dauphine"), and the user's own position as a pulsing blue dot with a soft halo.
A row of day chips floating over the top of the map: "הכל", "ב׳ 21.12", "ג׳ 22.12", "ד׳ 23.12", "ה׳ 24.12". A round
"my location" button and a small "fit all" button at the side.

Screen 1 - light theme, chip "הכל" selected: a soft, light, quiet street map of Strasbourg's old town (river ring around
the centre), all the places and the hotel, the blue dot near the hotel.
Screen 2 - light theme, chip "ב׳ 21.12" selected: only that day's stops, numbered in time order 1-2-3-4 inside the
badges, joined by a dotted walking line in trip green; a bottom card opened for the tapped stop: "שוק כיכר ברוי",
"ב׳ 21.12 · 15:00", "12 דק׳ הליכה ממך", buttons "ניווט", "פרטי המקום", and an indigo "שאלו את המדריך".
Screen 3 - the same as screen 1 but in the app's dark theme, with a dark map like the attached one.

Clean, elegant, readable labels with a light halo so they never clash with streets. No other text.`

const f = new FormData()
f.append('model', 'gpt-image-2.6-flare'); f.append('prompt', PROMPT); f.append('size', '1536x1024')
f.append('quality', 'medium'); f.append('n', '1'); f.append('output_format', 'jpeg')
f.append('image[]', new Blob([await sharp(LIVE).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()], { type: 'image/jpeg' }), 'live-app.jpg')
f.append('image[]', new Blob([await sharp(REF).resize({ width: 900, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()], { type: 'image/jpeg' }), 'other-map.jpg')
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: f })
const j = await res.json()
if (!res.ok) { console.log('FAILED', res.status, j.error?.message); process.exit(1) }
// Kept at a size you can read the details at on a phone, JPEG 80%.
const out = await sharp(Buffer.from(j.data[0].b64_json, 'base64')).resize({ width: 1200 }).jpeg({ quality: 80, mozjpeg: true }).toBuffer()
fs.writeFileSync(OUT, out)
console.log('ok', Math.round(out.length / 1024) + ' KB', j.usage?.output_tokens)
