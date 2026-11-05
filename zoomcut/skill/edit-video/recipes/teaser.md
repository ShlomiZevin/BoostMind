# A teaser / preview made of pictures (no footage) - and the Shlomiverse bookends on any video

The first: `balabusta-teaser` (בעלבוסטע, Hani's comic book, 2026-11-05 - he called it "perfect"). A still (a comic cover,
a poster) cut into layers and moved like a film, in the one editor, exported by the one exporter.

## The Shlomiverse bookends - every teaser and preview (his ask, 2026-11-05)
"שלומיוורס מציגים" before it and "רק בשלומיוורס" after it - the look of the first Shlomiverse teaser (deep space,
orange dust, stars, the glowing ringed planet), made as OUR assets:
- `episodes/_assets/shlomiverse/verse-presents.mp4` (5 s): we drift slowly through the dust; the logo circles slowly in
  3D (a Seedance 2.0 clip made from the real logo, `source/sd-presents.mp4`, laid in as light), locks on the exact logo
  with a flash + streak, and "מציגים" rises in the logo's own lettering (Heebo 900, warm white, orange glow - his pick;
  a metallic serif looked "like an old PowerPoint", a thin light weight "terrible").
- `episodes/_assets/shlomiverse/verse-only.mp4` (4.2 s): a fast rush through the dust towards a tiny glow that grows
  into the logo (a whoosh), the lock, then "רק בשלומיוורס" revealed by a white-orange light sweeping right to left.
- **No music in them** (his rule: the music must never start twice) - only the deep space whoosh and the shimmer. The
  video's own music starts when the video itself starts.
- **Never turn / spin the flat logo picture** ("stupid and ugly") - 3D motion of the logo comes from Seedance (made from
  the real logo picture) or from moving the camera through the space layers.
- **The space kit** (`_assets/shlomiverse/kit/`): space.png, galaxy.png, dust-a.png, dust-b.png (GPT Image 2.5, prompts
  in kit/prompts), stars-far/near.png, logo-light.png + logo-body.png (the real logo as light + its dark planet). 
  `kit/space.py` flies a camera through them with depth: `Space().frame(z)` - use it for any space shot (a teaser's
  opening, a title card). `source/render3.py` makes both clips from it.
- **Put them on a project:** `python tools/verse_bookends.py <project>` (studio running) - uploads both, moves every
  item later by the intro's length, adds the "Shlomiverse" picture + sound layers, the outro pinned to the end.
  `--replace` = a project that has them gets the current clips; `--muted`, `--no-intro`, `--no-outro`.
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
