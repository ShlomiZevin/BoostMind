// Trip app share card, "From" joke (his ask 2026-11-24): the Strasbourg cover turned disturbing - the series "From"
// mood (a town you cannot leave, a bottle tree, a far lighthouse, stones on the windows) - original art, no show
// characters. Plus a Terra consult for the Hebrew joke lines (facts only, unanchored).
// node scripts/v2-design/trip-share-from.mjs <cover image> <out dir>
import fs from 'node:fs'
import path from 'node:path'
const [COVER, OUT] = process.argv.slice(2)
fs.mkdirSync(OUT, { recursive: true })
const envKey = (file, name) => fs.readFileSync(file, 'utf8').split(/\r?\n/).find(l => l.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '')
const OAI = envKey('C:/workspace/BoostMind/scripts/design.env', 'OPENAI_API_KEY')

const IMAGE_PROMPT = `Repaint the attached picture (a cosy Strasbourg Christmas market at dusk, cathedral behind) as its unsettling,
broken twin - the same place, the same composition, but something is deeply wrong. Deep night, low fog, the market empty
and abandoned, some string lights dead and some flickering a sickly yellow, the stalls shuttered. In the foreground, where
the Christmas tree stood, a bare dead tree hung with dozens of empty glass bottles that catch a cold light. Far behind the
cathedral, through the fog, the thin beam of a distant lighthouse that should not be there. Small smooth stones placed on
every window sill. Windows dark, a few curtains half open. One tiny far silhouette standing still at the end of the street,
too far to see any face. Cold, desaturated blue-grey palette with sick warm accents, film grain, quiet dread - eerie, not
gory, no blood, no monsters shown. Keep the middle band of the picture calmer and darker so white words can sit on it.
No text, no letters, no logos anywhere. Original artwork.`

const TERRA_BRIEF = `We are a couple in our 40s from Israel flying to Strasbourg for the Christmas markets, 21-24 December 2026.
We have a trip app; when we share the trip link, WhatsApp shows a preview card. We want the whole share to be a joke on
the TV series "From" (MGM+). Facts about the series: a town in middle America that traps everyone who enters - every road
leads back into town; at night creatures in human form come out, smile, knock and ask to be let in; smooth stone
talismans on the windows keep them out; a "bottle tree" in the woods works as a passage, and through it Tabitha reaches
a lighthouse; the Boy in White appears to her; Victor has lived in the town since he was a child and knows more than
anyone; the children of the town's past were sacrificed and their bones lie under the bottle tree; the residents hope
that freeing the children frees everyone. The joke he wants: "we're going through the bottle tree to save the children
in the lighthouse, with Victor."

Write in natural, funny, spoken Israeli Hebrew (not translated-sounding), short. Give 3 different full sets. Each set:
1. title on the picture (max 4 words)
2. second line on the picture (max 8 words, include 21–24 בדצמבר)
3. bottom line on the picture (max 7 words)
4. link description under the preview (1-2 sentences, max 200 characters)
5. the WhatsApp message that goes with the link (1-2 lines, ends with a colon before the link)
No emoji except at most one in the WhatsApp message. No "מעריצים". Plain text, numbered.`

const [img, terra] = await Promise.all([
  (async () => {
    const f = new FormData()
    f.append('model', 'gpt-image-2.6-flare'); f.append('prompt', IMAGE_PROMPT); f.append('size', '1536x1024')
    f.append('quality', 'medium'); f.append('n', '1'); f.append('output_format', 'jpeg')
    f.append('image[]', new Blob([fs.readFileSync(COVER)], { type: 'image/jpeg' }), 'cover.jpg')
    const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: `Bearer ${OAI}` }, body: f })
    const j = await res.json()
    if (!res.ok) return `image FAILED ${res.status} ${j.error?.message}`
    fs.writeFileSync(path.join(OUT, 'from-card.jpg'), Buffer.from(j.data[0].b64_json, 'base64'))
    return `image ok ${j.usage?.output_tokens}`
  })(),
  (async () => {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { authorization: `Bearer ${OAI}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-6.1-terra', messages: [{ role: 'user', content: TERRA_BRIEF }] }),
    })
    const j = await res.json()
    if (!res.ok) return `terra FAILED ${res.status} ${j.error?.message}`
    fs.writeFileSync(path.join(OUT, 'terra.txt'), j.choices[0].message.content)
    return 'terra ok\n' + j.choices[0].message.content
  })(),
])
console.log(img + '\n' + terra)
