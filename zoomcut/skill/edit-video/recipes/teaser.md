# A teaser / preview made of pictures (no footage) - and the Shlomiverse bookends on any video

The first: `balabusta-teaser` (בעלבוסטע, Hani's comic book, 2026-11-05 - he called it "perfect"). A still (a comic cover,
a poster) cut into layers and moved like a film, in the one editor, exported by the one exporter.

## The Shlomiverse bookends - every teaser and preview (his ask, 2026-11-05)
"שלומיוורס מציגים" before it and "רק בשלומיוורס" after it. They are made from **the first Shlomiverse teaser's own
circle** (his rule - "if you find the original, use it"): the Seedance clips of the real logo from 2 Nov
(`source/sd-2-pullback-far-mini.mp4`, `source/sd-1-pullback-mini.mp4`) played BACKWARDS - the planet turning and
growing out of space until it lands exactly on the logo frame (`source/frame-logo.jpg`), locked with a flash + streak.
- `episodes/_assets/shlomiverse/verse-presents.mp4` (1.8 s): the end of the circle in HALF A SECOND, the lock, "מציגים"
  rises in the logo's own lettering (Heebo 900 warm white + orange glow - his pick; serif metal = "old PowerPoint").
- `episodes/_assets/shlomiverse/verse-only.mp4` (2.4 s): the end of the circle in half a second (a whoosh), the lock,
  "רק בשלומיוורס" revealed by a white-orange light sweeping right to left.
- **The circle in pieces, for any edit** (`_assets/shlomiverse/kit/`): `circle-full.mp4` (galaxy -> planet -> logo,
  ~10 s), `circle-half.mp4` (the planet turning and growing, 5 s), `circle-end.mp4` (just the end of the turn, 1.5 s);
  each ends exactly on the logo frame. Speed them up / cut them for a quick start or end.
- His rules: FAST - an intro or outro is half a second of motion, then the words; one continuous film - the video's
  MUSIC starts on the very first frame (under the intro) and runs to the end, never twice; no music inside the
  bookends (only whoosh + shimmer); never spin the flat logo picture; no made-up space that doesn't match the original
  (a v3 built from new space pictures looked "terrible" and its dust ended in a visible edge).
- Music from the first frame with a hit that must land on a moment: slow the part before the hit (rubberband) so the hit
  lands there, starting where the track is already full (balabusta: sv-music 1.3-15.3 s at tempo 0.859 -> hit at 16.3).
- **The green "הסכמות" card** after "רק בשלומיוורס" (his ask - like the green card before a film trailer, made Haredi:
  "מכתבי ברכה והסכמה", the video "נבדק ונמצא כשר למהדרין לכל בני הבית", five rabbis' approvals, "ועל זה באעה"ח"):
  `_assets/shlomiverse/verse-haskamot.mp4` (4 s): a sefer's ornamented green page (gold arch + crown, made with GPT Image 2.5 WITHOUT any text - `source/haskamot/frame.png`, p-frame.txt), the exact words set on it in gold / cream by `source/haskamot/card.html` (shot.mjs -> PNG -> clip). Every word stays inside the plain green (y 300-1740, x 165-915 - measured from the frame), spread evenly; never on the ornaments (his note). The rabbis
  and yeshivas are INVENTED (written with Terra - gpt-5.6-terra, his rule for Hebrew copy - checked not to be real people) - never put a real rabbi's name on it.
- **The hand-over from the intro to the video** (his note: "looks like two different stuff"): a warm white flash
  (`verse.flash`, a #fff1dc shape peaking on the cut) - the logo fades into light and the first shot appears through it.
  The intro's sound = one deep cinematic hit on the logo's lock (`source/px-kick-hit.mp3`) + a soft shimmer; the music
  starts from its OWN beginning (its natural swell), stretched only as much as its hit needs to land on the reveal.
- **Sound variety** (his note: the same whoosh three times "you can sense it too much"): the intro = a blink (the first
  teaser's own ting + shimmer, `source/sfx-ting.mp3`), the video's own moments = their hits, the deep space whoosh ONCE
  - in the outro.
- **Put them on a project:** `python tools/verse_bookends.py <project>` (studio running): uploads both, moves every
  item later by the intro's length, adds the "Shlomiverse" picture + sound layers, the outro pinned to the end; then
  move the music item to frame 0. `--haskamot` adds the green card at the very end; `--replace` swaps in remade clips; `--muted`, `--no-intro`, `--no-outro`. An audio item already on frame 0 (the music) stays there.
- Remake: `source/render4.py` (python render4.py; `python render4.py cuts` writes the circle pieces). The space kit
  (`kit/space.py` + its pictures) stays as a tool for a space shot, not for the bookends.
- `episodes/_assets` travels by the studio's cloud sync, not git (CLAUDE.md "The studio online").

## Making the teaser (what worked, his notes)
1. **Layers from the still** with the image model (gpt-image-2.5 sunburst, `--ref` the still): the scene WITHOUT the hero
   and the words (a clean plate), the hero alone on flat green, the words alone on flat green; key the green
   (C:/workspace/hani-games/balabusta/teaser/build_layers.py). Every layer a full-canvas PNG in its place - they line up.
   Need the hero's full body (the camera climbs her)? A pass that completes her below, matched on a shared detail.
2. **Motion as layers** (teaser/motion.py writes them all through the ops): one "camera" (zoom + look-at) moves every
   layer, the background with less travel (depth). The editor's `anim` keys are linear - write eased moves as dense keys.
   `--only=<layer ids>` replaces just those layers and keeps his hand edits.
3. **His rules for it**: the hero is revealed only at the END (the WOW: one fast burst out to the whole still, on the
   music's big hit); before that, close and tense - the background first without her, she DROPS IN (never a fade-in),
   the camera climbs her. Modest framing for a Haredi woman - never the chest. Real animation where something moves
   (her head covering: a 12-frame ripple, the cloth only, never the shoulder with it). A holy light = turning rays + a
   breathing glow behind her; NO sparkles ("stupid"). Every element of the still lands with its own hit.
4. **Sound**: music FULL from the first second (no fade-in); slow the part before its big hit (rubberband, same pitch)
   so the hit lands on the reveal. NO riser ("pain to the ear"). Whooshes = the deep space whoosh of the second
   Shlomiverse trailer (`gs://shlomiverse-studio/projects/shlomiverse-features/media/sfx-whoosh.wav`), pitched apart. The
   last hit = a real produced cinematic boom (`_assets/crypto/px-boom-05.mp3`); generated hits there were "terrible".
5. **Two versions**: one with the music (the site / a Shlomiverse video story), one for Instagram with the sound effects
   only - no music (he adds a licensed theme there). The same layers; the Instagram project gets the effect layers only.
6. He watches in the editor; export only when he asks (a draft to Telegram for approval, then both full). Telegram
   videos go with width / height / duration (else a vertical video shows stretched).
