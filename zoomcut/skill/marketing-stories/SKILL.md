---
name: marketing-stories
description: Make the launch marketing for a new game / product of Shlomi's (Hani's playhouse "המשחקייה של חני", Plaxzy, any brand) - Instagram stories and posts designed by GPT image 2.5 (sunburst / flare) from REAL photos of the people + the product's own art, a read-aloud teaser video (narration + niggun ducked under it + sounds, stops on a cliffhanger) and a silent chapter video for a song. Use whenever he says marketing, promo, stories, סטוריז, posts, פוסטים, teaser, טיזר, launch, "tell people the game is up", or hands over a promo HANDOFF.
---

# marketing-stories - launch marketing from real people + real product art

Born on "יוסף מוקיר שבת" (Hani's playhouse, 2026-10-30). He: "now you are doing super great - remember how you did it".
**Talk to him short, in his language, and ask with clickable options.** He sits in front of the computer: show results
on screen (open the file / give the full path), don't push them to Telegram unless he asks.

## What wins (each line cost a round)
- **Let the image model DESIGN the story - don't stamp cut-outs on a template.** My hand-made HTML layout (photos
  pasted around text boxes) was "a mess, no logic". The fix: give gpt-image-2.5 all the pictures + the exact text and
  say what the story is FOR; it composes the scene and the Hebrew typography together. Sunburst and flare both do
  good Hebrew.
- **Real people, from real photos.** If you have no realistic photo of a person, ask him first. From one portrait you
  can generate more poses (`--ref` the portrait); show every new picture before building on it. People he gives you
  (photos he pastes) are used as-is, as references.
- **Modesty is the brand** (Haredi audience): calm, restrained poses - hands clasped, holding a phone / book / laptop,
  pointing low. **No raised arms or showy posing** ("she is Haredi, she can't be posing - לא צנועה"). Women modestly
  dressed, married women's hair covered; crowds = men only. Nobody's hands or fingers cut by the frame.
- **Keep it simple**: "a new game is up" + what the story is + how you play. Not clever, not joke-heavy. The host
  (Hani) is the centre of the brand and is never funny on purpose.
- **Say clearly why it's kosher** when it matters to the audience: who made it (a real-sounding credential), "music
  only (no women singing)", "no chat, no ads". He chose the wording himself - use his exact words, ask for names.
- **Never reveal the cliffhanger** in a teaser picture or video.
- Launch wording is "עלה עכשיו" / "עכשיו ב…" (not "בקרוב") once it's live; the product card on the site is released
  together with the promo, only when he says so.

## The stories (1088x1920 from the model; Instagram keeps ~15% at the bottom clear)
One prompt per story, written to a file (never Hebrew through the console). Say WHAT is needed, not how it looks:
1. A shared header: what the brand is, what the product is, who the people in the references are and what must stay
   exactly (faces, glasses, clothes), the modesty rule, "game art from the references is used as-is", "Hebrew spelled
   exactly, right-to-left", "text never covers faces", "keep the bottom 15% free of text".
2. Per story: its **purpose** (launch / suspense teaser / how you play / who made it / play now), which reference is
   which, and the **exact text** (label, headline, line, button).
Typical set: launch (host + cover + "עלה עכשיו!") · suspense (a story page before the twist + a question) · how you play
(real gameplay screenshots inside phones) · who made it (a family photo of the real people, names, kosher badges) ·
play now (host + product + button + "הקישור בביו").

```
. ~/.plaxzy/openai-env.sh        # OPENAI_API_KEY from gcloud secret (project plaxzy12); never print it
node tools/oai-image.js --model sunburst --size 1088x1920 --quality high \
  --prompt-file prompts/s1.txt --ref people/hani.png --ref art/cover.png --out out/story-1.png
```
Run the stories in parallel (`&` ... `wait`). Up to ~5 references work well.

**Then proofread every word at full size** (crop + zoom the headline). The model slips on single letters (it wrote
עכשין for עכשיו twice). Fix with an **edit pass on that same image**: ref = the image, prompt = "keep everything exactly,
change only <the word>: <what the letter must be and why it is wrong now>". That fixed it in one go where re-generating
didn't.

## Posts (1080x1350)
Ask whether he wants them at all ("למה צריך פוסטים?" - stories + the teaser may be enough). If yes, the same way
as the stories (prompt files + references), size 1024x1280-ish, then fit to 1080x1350.

## Cut-outs (when you DO need a person on its own, e.g. in a video)
`tools/cut.py` - for studio photos on a plain grey backdrop: backdrop = grey that is low-saturation and not dark,
connected to the edge, plus enclosed gaps (between a head covering and the neck - zoom in on the head, he checks
there). `--hole-top 0.35` keeps enclosed grey/white lower down (a laptop, a white shirt, tzitzit). Check on a coloured
background at full size around the head before using.

## The read-aloud teaser (1080x1920, with sound)
A page = HTML with `window.at(t)` (every layer set for second t), rendered frame by frame with Playwright, then the
sound mixed with ffmpeg (`tools/render-teaser.js` is the working example):
- intro with the host ("…מציגה:") → the book pages one by one: the page picture slowly zooming, the text with niqqud,
  the line being read highlighted (timing ≈ share of letters) → stop right on the cliffhanger line → an end card with
  the open question + "עכשיו ב…" + the host.
- Read only the first part of the story (he: "don't give everything").
- Sound: the product's own narration files, the brand's background niggun under everything and **ducked under the
  voice by a sidechain compressor** (smooth, no hand-made volume steps), the product's own sounds on the beats (page
  turn per page, wind on the wind line, a whoosh + win on the end card). Use several variants of a repeated sound.
- Keep the narration timings in ONE place (the page and the mixer share the same TL formula).
- Clip the page (`html,body{overflow:clip}` + `body{contain:paint}`): an RTL page that overflows renders shifted
  sideways in screenshots.
- Big file? Re-encode before upload (`-crf 23`).

## The silent chapter video (for a song he adds in Instagram)
~5 s per chapter (slow - 2.5 s was too fast), host in the intro and the end card, each chapter = page picture +
one caption + a phone with that page's game. No sound in the file.

## Housekeeping
- Anything made from a real person's face never goes into git (keep it in git-ignored folders); commit only your own
  scripts / pages.
- Write scripts with the Write tool (Git Bash eats backslashes in heredocs); Windows Python needs encoding="utf-8".
