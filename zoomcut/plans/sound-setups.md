# Sound setups ("perfect setups") - plan, not built yet

His ask (2026-11-03): one click that sets everything for a kind of sound - podcast, synagogue hall, office, someone
talking in the background, singer, and whatever our videos need. It works on whatever is picked (a whole row or
one clip). Sessions use it too (the skill), and he sees which setup they picked and adjusts it. When he changes a
setup's result he's asked once whether to save it as a setup. Setups are saved and every computer sees them (the cloud).

## What a setup is
A named bundle of settings: cleaning (off / mild / standard / strong / NN), the voice sliders (low cut, warmth,
boxiness, presence, de-ess, keep even, room, room size, PA), fun sound (sounds like, higher / lower, room, echo),
and loudness. A setup assumes its cleaning: Podcast is tuned on NN, so it sets NN too. If he changes the cleaning
afterwards, that counts as a change.

## What wins - one rule
Today: loudness adds up (row + clip), cleaning and voice style are row-only, and fun sound stacks (clip first, then row).
Stacking already hurts: haredit-3's "Hani on the phone" row has Phone on the row AND on 11 of its clips, so those
clips go through the phone filter twice.

The new rule: **the clip wins.** A setting a clip has of its own replaces the row's for that clip. A setting the clip
doesn't have comes from the row. **Loudness is the only one that adds up** (the row = the level of the whole voice,
the clip = a nudge on top).
- To do: cleaning and voice style per clip (today row-only) - a clip with its own cleaning plays that cleaning's file
  of the same take; a clip with its own voice style gets its own chain (only clips that have one - CPU).
- The export mirrors it (pipeline/voice_chain.py, layers_audio.py) - check with tools/voice_live_test.mjs.
- Old projects whose clip and row both have a fun sound: they'd change sound. Keep the old stacking for them
  (a project flag), or migrate (drop the duplicate where the clip repeats the row). Ask him.

## Where it shows
- Top of the sound panel: **Setup** - buttons, one per setup, plus "None". The panel works on what's picked (the
  row, or the clip). The picked setup is lit; after any change it reads "Podcast · changed".
- After a change: a small bar, once per change spree (not on every slider move): **Save as a new setup** / **Update
  "Podcast"** / **Just here**. A ? on Setup explains what wins.
- The timeline: a clip / row with its own setup shows the setup's name on hover (so he sees what the session chose).
- Design the panel with OpenAI as a UI/UX expert - what it must do, never how it looks.

## Saved
- Built-in setups in code (render/ui/setups.ts); his saved ones in the cloud: `studio/setups.json` in
  gs://shlomiverse-studio, merged like ideas / jobs (render/cloud/shared.mjs). Every computer reads them.
- On the project: `props.setup` / `item.setup` = `{ name, changed }` - only a label; the settings themselves are the
  ordinary props, so the export needs nothing new.
- An op `setup.apply {layer, item?, name}` that expands the setup server-side, so a session only names it.

## The setups
His list: Podcast, Synagogue hall, Office, Someone talking in the background, Singer.
From our videos (what was set by hand again and again):
| Setup | Seen in | What it was set to by hand |
|---|---|---|
| Phone call | haredit-1/2/3 (Hani's calls, ~45 clips) | Phone, pitch shifts |
| Speakerphone / PA | gym-2 (the gym's announcer, 10 clips) | Speakerphone + small room |
| Stage / keynote | yuval-1 | NN + stage, room 0.3, PA 0.3 |
| News studio | dorit-1 (and tadar-5 podcast, tadar-4 warm) | NN + news |
| Inner thought / echo | genz-1 (38 clips) | Dark echo + pitch |
| Trailer voice (big ending) | shlomiverse-features-b (Gilad's end line) | raw + room 0.5, size 3 |
| Synagogue hall | demokratovich-nechama (the rabbi) | NN + small room 0.15 |
| Office + someone in the background | tzvika-1 (office air; the colleague behind the cubicle) | room 0.35, size 0.6, +9 dB |
| Singer | zot-hani-karaoke (8 sung takes) | mild + room 0.38, size 2.2, speakerphone echo |
Music has no setups (it's loudness + "lower the voices"); add "Music under talking" only if he wants it.

## The skill
edit-video: each recipe names its setup (rabbi → Synagogue hall, keynote → Stage, anchor → News studio, Hani's calls
→ Phone call, Gen Z thoughts → Inner thought ...), applied with `setup.apply`; the report tells him which setup went
where.
