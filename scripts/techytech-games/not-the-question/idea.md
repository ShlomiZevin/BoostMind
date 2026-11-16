# לא זו השאלה - Techy-Tech game (Daniel)

## His words (2026-11-16)
"read this script from the shlomiverse - and lets prepare a game called לא זו השאלה. you need to try to answer super
clear questions but you cant, cause when you answer the super clear answer you are being rejected with 'this is not the
question' (though of course it was)". Script: "טקי-טק | זאת לא השאלה" (Amir, Ofer, Daniel - the POC / reading images /
the invoice sum / "we'll bring an outside consultant" / "we'll send you an invite" / Daniel removed).

## Decisions
- Mechanic: **Helix Jump** (his pick of 3: Helix / Flappy / Stack). "Let's get down to the details" = falling down a
  tower of questions.
- The player is Daniel: his face on a round video-call avatar that bounces down the pole. Drag left/right turns the tower.
- Every ring = one question from Amir or Ofer (from the script and their profiles), shown in the top strip with their
  painted tiles. The gaps in the ring carry answers:
  - the CLEAR answer ("כן, אפשרי", "מוסיפים שלב", "כן, הסכום") = a trap gap: falling in it = "זאת לא השאלה" (+ Ofer:
    "חד משמעית"), a strike, Daniel bounces back up;
  - the vague buzzword gaps ("נרד לפרטים", "איך אנחנו מסתכלים על זה", "נביא יועץ חיצוני") = the way down;
  - red slices = interruption, a strike on touch.
- 3 strikes = "טוב דניאל, אנחנו נשלח לך זימון" + "הוסר מהפגישה" (red tile, like every episode's end). Score = depth
  (rings passed) - "עמק". Every 10 rings a "level" (POC -> invoice -> outside consultant) and it gets faster.
- Daily records (VerseFrame.score, unit "קומות פירוט"?), seeded daily tower.
- Look: concept art/concept.png (painted, glossy, Techy-Tech office behind, real 3D tower in three.js, painted tiles in
  the strip). Sounds: ElevenLabs bounce variants, fall whoosh, rejection buzzer, "removed" tone, office music bed;
  Amir's "זאת לא השאלה" from the real video if it exists, else ElevenLabs voice.
- Lives: public/techytech-games/not-the-question/ (draft until he says release).

## Tutorial steps
1. You are Daniel - brought into the meeting "to give a professional opinion".
2. Goal: get down into the details - fall as deep as you can.
3. Drag to turn the tower (try it).
4. The question is in the strip up top; each gap has an answer.
5. The clear, correct answer = "זאת לא השאלה" (strike). Fall through the vague ones (try it).
6. Red = interruption. 3 strikes and you're removed from the meeting.
7. Ready?
