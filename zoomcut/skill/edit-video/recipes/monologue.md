# Recipe: monologue - one person talking to camera (rabbi, guru podcast, news anchor, keynote) - engine `lesson.py`

One speaker, takes in order (`IMG_*.MP4`), usually no script file: transcribe, captions per take (`== <take>` blocks,
corrected by hand - the recogniser garbles Aramaic / wordplay), let `lesson.py` cut, place and subtitle. If he keeps a
script in the Reader (episode.json `"script"`), subtitles remake from it (only the on-camera lines, ad-libs as said).

## In the one editor (layers) - from 2026-10-22
Analyze (`lesson.py --preview`, the editor's Analyze button) ends by writing `project.json` through
`pipeline/to_layers_solo.py`: lesson.py still decides the cut, the subtitles and the timing, and the editor shows the
result as layers (format: `layers.md`). The layers are Set, Person, one layer per film effect, Opening, the texts and
overlays, Other side, Subtitles, Voice, Sounds (one per lane), Inserts and Music. A rebuild merges, so his edits in
the editor stay.
- **He always drags a cut's edges** to pull back the real footage before or after it. He asked for this five times
  and it must work on every piece of every video. In the one editor:
  - an edge of a Person or Voice clip goes to lesson.py as that take's cut edge (`cut.edges`, `/api/ep/<id>/trim`);
  - the take is re-cut in ~4 s: picture, voice and subtitles together, and everything after it shifts;
  - the drag stays on screen meanwhile.
  This works because every video item points at the WHOLE take (`in` = where the piece starts in it): never give a
  layer a file cut down to the piece, or there is nothing to pull back.
- **Live in the editor** (an op or the inspector, no rebuild):
  - the clips (trim / move, the whole take behind each cut);
  - the Person layer: `eyes` (Original / Looking at the lens), `look` (warm, smooth, colour);
  - the Voice layer: `voice` (preset `news` = the anchor voice he loved) and `clean` (`nn` = RNNoise, for AC / fan hum; re-prepared in seconds);
  - every layer's volume, every item's gain and fades;
  - the effect layers;
  - the texts and overlays: words, style, position, time;
  - the subtitles' words and style.
- **Still lesson.py's** (change episode.json, then Analyze again):
  - the cut itself: pauses, joins, slow motion, `sequence`, inserts;
  - word-anchored sounds and overlays, and each sound's filter / pitch / tempo / room;
  - music duck / lift;
  - the set: background, blur, dim, sign, plaque;
  - cut-out quality (`matte_engine`, `matte_cut`, keep desk);
  - the old baked `grade`.
- **Eye contact:** the Picture inspector's "Make eye contact" (a job: NVIDIA + blink blend, v6 if it fails, or his CapCut
  file), or `eye_contact` in episode.json before Analyze, as before.
- Never change the tool for one video's look (`layers.md`): fill layers; a missing look is tool work, generic.

## The base he signed off on ("demokratovich-elections", the rabbi lesson)
- **Rhythm:** cut every pause > 0.25 s; each join starts 0.18 s on top of the last word; a take ends where the voice
  after its last word stops (keeps a held last word, drops a phone thud after a gap).
- **Sounds under his speech, never pauses:** a ring from ~2 s before he reacts until he answers; the other side of a
  call mumbling (pitch 1.2, phone EQ) - only when he is mostly quiet; when he talks non-stop see `offscreen-voice.md`.
- Title = gold Stam on a ~45% black box; subtitles yellow Stam with black outline (letter-spacing - the outline fuses
  "זו"). Speed 1.2× is his choice. Cut-out "quality" engine only when hands go up against a white wall.
- A re-take of a passage in a new file: episode.json `"sequence"` (take segments in edit order) - cut the old take at a
  sentence boundary before it and resume after it. Two takes that overlap: `end_at` on take 1 before the repeated words.
- **His rule for re-takes that overlap** (tadar-5): every take plays from its own start; when its last sentence(s)
  open the next take too, cut it in the gap before them and use the NEXT take's version. Find the overlaps in the
  transcripts first, then `"sequence": [{"take", "to"}, ..., {"take"}]`.

## Series "demokratovich" - the rabbi who believes in democracy, the court and the ballot (since 2026-10-16)
- **His faith is democracy, not Torah** (his words, 2026-10-23: "it should be more about law and order and democracy
  and less about halakha... he believes only in democracy"). The FORM is religious (בית מדרש, honorifics, שו״ת, a
  weekly shiur, donations); the CONTENT is מגילת העצמאות, חוקי היסוד, השופטים, בג״ץ, הפרדת רשויות, the ballot. No
  Torah, blessings, prayers or Shabbat in what we write ("בברכת הדמוקרטיה ושלטון החוק", not "התורה והמשפט"); his own
  lines from the takes stay as he said them. His follow-up the same day: "instead of בית המדרש - בית המשפט"; the Rashi
  script stays ("it was funny - that is where the line is thick, like they are super fanatic but about democracy"):
  the Declaration and the daily rulings in Rashi, like a page of Gemara.
- The set, the plaque "בית המדרש ״שערי בג״ץ״", gold Stam title, yellow Stam subtitles, speed 1.2: the elections video
  above. A new video = "+ New video" from `demokratovich-elections`.
- **His site: https://boostmind-b052c.web.app/demokratovich/** (`public/demokratovich/`, on the bio hub) - קהילת
  ״שערי בג״ץ״ and its עמותה ״קופת הקולות״ (ע״ר - "registration under appeal"). A lame community-shul site: בס״ד + a
  real Hebrew date, זמני הקלפי, a Rashi-script הלכה יומית from his lines, נוסח תפילה, marquee, events, a donation pop-up.
  Two CTAs, both emailed to him (siteLead `demokratovich`): **שאל את הרב** (a question for the next שו״ת video - real
  questions = material) and **a donation pledge** where even the donation is democratic: tiers 3.25 ₪ "אחוז החסימה",
  61 "רוב קואליציוני", 120 "כנסת שלמה" (+ the red string "שמירה מפני סקרים"), 260 "הקדשת סעיף בחוקה (לכשתיכתב)",
  15/month "הרכב מורחב"; the board votes on each donation, a rejected one can be appealed to the court. Images:
  Leonardo portrait from his frame, the emblem (scales on a ballot box), the ballot-box procession (תמונת AI), the
  amulet. A new video: its 540p copy into `public/demokratovich/v/` and replace the "בקרוב" tile.
- **demokratovich-shut** (2026-10-23, waiting for footage in `Downloads\דמוקרטוביץ-שות`): the rabbi answering his
  audience's questions. Media ready: `demokratovich-poster.jpg` (end poster "יש לך שאלה לרב? / האתר באוויר • הלינק
  בביו"), his portrait, the emblem. Script 2026-10-23 (Reader id `demokratovich-shut`, הרב + שואל): a pilpul (לך־לך,
  ״בנימין זאב יטרף״, ״זאב ערבות״ → אל תקרי ערבות אלא ערבים, ״וגר זאב עם כבש... גדי״ → גדי + ערבים) then three
  audience questions. Prepared as overlays tied to his words (episode.json, `_todo` for after Analyze):
  - the verses on the empty scroll sticker at the TOP (y 250, over the plaque) with their real sources in Stam;
  - stickers in the band over the parochet, beside his head (y 680-1000; his head starts ~1000 at person y 450):
    Leonardo wolf / peaceable-kingdom animals / gavel (sunburst, mint, cut out - an enclosed mint patch needs a
    colour pass), and HTML stickers (crisp Hebrew): ערבות struck → ערבים, a kashrut-style "סוקר כשר למהדרין /
    בהשגחת בג״ץ" stamp, the ballot slip "דרך / ישר", the 3.25% threshold chart + "שוטה ופתק בידו!" stamp;
  - each question as a `question` card (navy, "שאלות הציבור לכבוד הרב") at the top until its answer ends;
  - polaroid "קהילת שערי בג״ץ באוויר! / הלינק בביו" at the pilpul → questions turn; blinking CTA "יש לך שאלה
    לרב? / הלינק בביו" over the last question; the poster on "ומעכב את הגאולה".
  Assets: `_assets/demokratovich/shut/`; stories in `Downloads\דמוקרטוביץ-שות\demokratovich-shut-story-*.jpg`.
  Done 2026-10-23 (footage `Downloads\drop\שות בחירות`, opening = his take 3): his notes, all kept -
  - plaque "בית משפט קטן ״שערי בג״ץ״" (same plate / angle, only the words); no לך לך card; hook from frame 0
    (`start` 0 + `until: "image"` = up to the first sticker); ticker y 1700, under the subtitles;
  - the questions are HIS voice notes (`media/q1-3.m4a`) played over the start of the answer take, where he sits
    listening (an edge on the take's start, not a frozen frame); each ends on its last word ("מה דינו" must be heard)
    and the answer starts right after it; `captions` on each sound = the question's subtitles, white, at his height
    (`captions_other`); levels: questions ~1 dB under him (gains 6.0 / 5.9 / 5.6), Voice layer `level: "speech"`
    (never on the Sounds layer - it stacked on the gains, +10 dB);
  - real politicians as the goat gag, never a face: a cartoon devil in a suit with a name badge "ביבי", the goat in
    an IDF general's uniform with "גדי"; "בעל נזר הצדק" = an 18th-century judge portrait in a yeshiva-style oval frame,
    plaque "זש״ל (זכר שופט לברכה)"; the קופת הקולות charity box (a ballot box) + a donation ticker in the site's voice;
  - the end hold goes AFTER the last word's tail (measure it - "הגאולה" was cut at 17.95, its tail ran to 18.1).
- **demokratovich-songs** (2026-10-23, `Downloads\drop\שירי בחירות`, one take per song): the medley of election
  songs. Set `_assets/demokratovich/synagogue-frames.jpg` (Leonardo flare, a 2:3 shot made for the 9:16 frame: the ark,
  a blank bronze plaque between two EMPTY gold frames) - Bennett / Eisenkot as the Kohen Gadol painted into the frames
  with `sign` (quads found by the frames' dark interiors), plaque text on the plaque's middle band. The "רק" niggun is
  split in two (`sequence` `to` / `from` at its one clean break, 14.6 s): part 1 opens, part 2 comes before the finale
  "עוד ישמע" (his "0:47"). Titles = the RABBI's versions of the songs ("♪ טוב להודות לבג״ץ ♪"), never the real songs'
  names. The ballot slip of Bennett's list (real: letters רק, "ביחד בראשות נפתלי בנט", CEC 27.9.2026) as an HTML
  sticker + "לא ביבי!" in red marker (Karantina) beside it. ElevenLabs choir under every song. Singing = speed 1 (he
  chose 1.3 himself); subtitles by hand (`captions_from: file`; the recogniser hears רק as רצח; add missing ones by op).
  Next time: a set with pictures painted in (`sign`) gets `bg_blur` ~0.5, not the default 2.2 - the High Priest
  portraits came out soft in his export ("the background image is not that clear"); make such a set at 2x (upscale).
- **Saved for a later video** (he: "we need them for later", 2026-10-23): Bennett and Gadi Eisenkot as the Kohen
  Gadol (Leonardo flare portraits from their Wikipedia photos, two each - he liked both): `_assets/demokratovich/
  priests/{bennett,eisenkot}-high-priest-{a,b}.jpg` (git-ignored - real people, his use only). In a video: the
  "תמונת AI" tag; add the path to the project's `media` to see it in the editor.
- **demokratovich-yamim-noraim** (2026-10-25, `Downloads\drop\תפילות בחירות`, Reader id `demokratovich-yamim-noraim`):
  the rabbi sings the High Holiday prayers his way (אבינו שופטנו, וכל מאמינים, זכרנו למנדטים, אחינו כל גוש השינוי, קדיש
  דמוקרטוביץ) on the bimah. One take per passage; 2DEA55EA = a shorter re-take of אחינו, BF935942 has the whole passage.
  He sings "ואמרו: כדין!" (not the script's "כחוק") - subtitles and the stamp follow him. His notes, all kept:
  - **The portraits must be sharp and big** ("don't make them pixelized or blur... make them very seen"): a holiday set
    `_assets/demokratovich/rosh-hashana/set.jpg` (Leonardo flare: white parochet, garlands of white roses + pomegranates
    over two big empty gold frames), upscaled to 2x; `bg_blur` 0, `bg_dim` false; `sign` painted from the 1024 px
    originals (`priests/*-rosh-hashana.png`, tight crop hat-to-breastplate), light 1.0, shadow 0. He: "looks like a real
    shul doing Yamim Noraim prayers". Small "תמונת AI" tags inside each frame's corner.
  - **Raise him:** these iPhone takes sit low in his camera frame (head top ~1/3 down) - person y 90 (not 450) puts the
    head top at ~770-850, under the titles (y 662) that sit between the frames and his head. Set it on the Person
    layer's props AND each item by op (props are never overwritten by a rebuild).
  - **Stickers = holiday x elections jokes, never just holiday** (his words): a ballot box shaped like a sukkah, the
    "רק / ביחד" slip dipped in honey, a pomegranate full of "דרך" ballot slips ("פתקים כרימון - מעולה"), Arabs holding
    willows ("ערבים וערבות" like a Sukkot greeting card - NOT the struck-out ערבות→ערבים gag), the gavel, ספר המדגמים,
    the 50-55 seats chart. A sticker whose word comes before another sticker's in the same take loses its tie
    (the search moves on) - pin it by time.
  - **Hook big and over the top:** "פוב: הגאון הרב דמוקרטוביץ שליט״א / בתפילות מרוממות נפש ומעוררות לב / לרגל הימים
    הנוראים – ימי הבחירות", gold Stam size 58, 0-6 s, then the prayer titles.
  - **The end card is already rising during the last line** ("ואמרו", fade 1.5) and the "כדין!" stamp lands on it
    (its own layer above End card, on the photo's corner - not on his face). New card `rosh-hashana/poster.jpg`: his
    portrait in a kittel + tallit (flare from rabbi.jpg), "שנה טובה ודמוקרטית!", red "מגבית הימים הנוראים / קופת הקולות •
    הלינק בביו"; stories in `Downloads\דמוקרטוביץ-ימים-נוראים\`.
  - **Crowd "can be very weak, the main thing is the rabbi":** all 8 HE voices per take, scored, 4-8 kept; gains
    close 0.12 / mid 0.11 / far 0.09 = 12-15 dB under him. ~21.7k credits.
  - **Don't export while he is listening in the editor** ("why do I hear noises while it is exported?"): the export
    takes the CPU and the editor's playback crackles (the file was clean). Say before exporting.
- **Sticker with words on it (a badge, a label):** write the words on the square Leonardo image (HTML over the jpg,
  screenshot), THEN cut it out - cutting first and squeezing the cut-out back into a square stretched two of them.

## Series "tadar" - spiritual-guru podcast parody (white bob wig, podcast mic), from 2026-10-17
- `lesson.py new episodes/tadar-N --from tadar-2 --input "<folder>" --takes IMG_xxxx.MP4 --script <reader id>`.
- Set `_assets/tadar/studio.jpg` (warm podcast studio), music `_assets/tadar/music.mp3` at 0.3, voice "podcast", eye
  contact on, grade warm 0.07 / sat 1.1, clean white Assistant subtitles, person y 200.
- The mic in front of him: `"keep": {"<take>": {"boxes": [[x0,y0,x1,y1]]}}` (fractions) keeps it from the real footage.
  On tadar-4 (black top + mic) RVM dropped the torso and the mic - MediaPipe "fast" kept everything: matte 4 s with
  both engines and look at the body before choosing.
- Follower question card: overlay `style: "question"` {text, label, y, w, size, accent}, timed by `from_words` (a list
  of alternatives: the question read aloud, else the answer's first words), stays until the next question.
- **She "explains" with stickers** (tadar-5 / spiritual-3, 2026-10-21 - his idea: it should look like she put effort
  into her video): Leonardo die-cut stickers in `_assets/tadar/spiritual-3/` (pills, a mosaic with a red X, a peak at
  sunrise, a glitter handwritten פ with an inward spiral, soil with a rising light, a head made of particles), each an
  image overlay with `"pop": true` (springs in, shrinks away - Entrance in its panel) around her head at y ~230-650,
  timed by her words. A quoted verse = an empty scroll sticker + her exact words as text on it (Stam, black, no box)
  with the source under them ("(בראשית ב׳, ז׳)") - her (wrong) version, the real source: that gap is the joke; the
  card sits over the mic, below her chin.
- **Her logo** (logo_2_morningstar, round, transparent PNG) hangs on the woven wall circle via `"sign"` (quad
  [[443,62],[631,67],[631,303],[443,308]] in studio.jpg = the hoop squashed for the wall's angle, right side a touch
  shorter). Centred behind her the wig hid the name, so the room is framed with the hoop beside her head:
  `bg` zoom 1.45, x 315, y 432 (crystals + salt lamps fill the left). Stickers on the right pop over it - fine.
- Footage 3 (2026-10-21): light-blue top against a white wall - MediaPipe "fast" held fine; the real mic stays.
- **spiritual-4 - elections** (script 2026-10-23, Reader id `spiritual-4`, footage to come): prepared in
  `_assets/tadar/spiritual-4/` - ballot box with a third eye (opening), the verse on the spiritual-3 scroll with
  "(דברים י״ב, ה׳)" under her ״אשר יבחר אדושם אלוהיכם מכל שבטיכם״ (real verse - about the Temple's place, not
  elections: that gap is the joke), dove out of a cage (בחירה חופשית), star infinity (תודעת האינסוף), the HTML
  sticker "ב + חירות = בחירות" (`bchirut.png`), collective heads (the punchline). End card `poster.jpg` (her portrait
  holding a glowing ballot envelope, "התודעה כבר בחרה בך 💜", "✨ לקביעת טיפול אצלי ✨ / הלינק בביו") and the
  stories in `Downloads\תדרyelet-bchirot-story-*.jpg`. Poster HTML templates: the end card / story layout of
  tadar-5 (logo top, tilted polaroid, gold WordArt line, dashed link box below).
- **Her site: https://boostmind-b052c.web.app/ayelet/** (`public/ayelet/`, on the bio hub). Deliberately 2009: a
  real `<marquee>`, WordArt glow, beveled buttons, guestbook, angel visitor counter, harp music button, the stickers
  floating. Sections from the scripts: videos, workshop "מעבר לתדר", treatments + prices, Q&A, מילון התודעה, her
  misquoted verses on the scroll sticker. A new tadar video: put its export in `public/ayelet/v/` and replace the
  "בקרוב" tile; new etymologies / questions go in the dictionary / Q&A. In the video: ticker "האתר החדש שלי
  באוויר!! הלינק בביו" + a blinking gold box over the mic (y 1170) for the last ~15 s.
- **End card** (he loved it, 2026-10-21): her Leonardo studio portrait (flare, from his profile photo) as a polaroid
  on a 1080x1920 card in the site's look + logo + "האתר שלי באוויר!! / הלינק בביו" - made as HTML, shot with headless
  Chrome at 1080x1920, saved to the project's `media/poster.jpg`. In the video: `"inserts": [{take: <last>, at: <just
  before the last piece ends>, seconds: 4.5}]` holds her last frame, a full-frame image overlay (`poster: true`) starts
  at the hold's timeline second (edit.json: the hold item's frame / 30), ticker and CTA end just before it, and
  `music.lift` {db 8, fade 1.2} swells the harp once she stops. The card starts dissolving in WHILE she says her last
  line (~1.7 s before the last word ends, fade_in 1.5 - he wants them still hearing her, nobody waiting), the hold
  after her last word is only 3 s, the last 0.5 s fade to black.
- **Most viewers never reach the end:** the same portrait also pops in mid-video as a small polaroid sticker
  (`media/polaroid.png`, "האתר שלי באוויר!! / הלינק בביו") in the first gap between stickers, ~15 s in, on the side
  away from the wall logo, ~5 s.

## Series "dorit" - Dorit Mercury, senior astrologer & numerologist from Ra'anana (from 2026-10-25)
- **Her own idea, never another character's look** (his words, 2026-10-25: "don't copy. We need to come with our own
  idea for this project. Just have a look"). Ayelet = soft die-cut pastel stickers; Dorit = a bossy aunt running her
  own **"election studio of the sky"**: TV-pundit framing (a "🔮 מבזק אסטרולוגי" strip at the top, a lower third
  "דורית מרקורי | אסטרולוגית ונומרולוגית בכירה"), **tarot cards** for every point, red rubber stamps ("סיים.",
  "חד־משמעית"), yellow post-its in marker, a starburst "אירוע נדיר!!!" with the real fact as the asterisk ("*בערך כל
  36 שנה" - the gap is the joke, like Ayelet's verse sources).
- **Tarot, not cartoons** ("the cartoon characters are not good. It should be more like tarot cards style"):
  Rider-Waite ink + watercolour (sunburst, 1024x1536, mint around the card, blank banner + cartouche) - cut out
  (`cutout_logo.py`), then the Hebrew title + number written on the banner in HTML (`_assets/dorit/tarot/titles.py`,
  `shoot.mjs`). The politicians she talks about get their own card from their real photo (SKILL.md → Leonardo):
  נתניהו = Justice (Libra scales), גדי איזנקוט = a king between a bull and a goat in a beret, בנט = The Emperor (rams),
  לפיד = Scorpio; the Bennett + Lapid "marriage" = both cards under a red X + "לא מאושר / אפילו לא בקפריסין".
- **Her studio is permanent, each video's pictures are layers on it** (his words: "needs to have her studio
  background... any character I do several videos... on her studio a map or something, which is an additional
  layer"): `_assets/dorit/studio.jpg` (flare 1024x1536: a RIDICULOUS kitsch purple-gold living-room "TV studio" -
  LED strip, tinsel, ring light, leopard tablecloth, hamsa, CRT TV - he rejected a tasteful one: "looks serious, like a
  painter") with a frontal BLANK board; bg zoom 1 → the board is x 280 y 268 553x480 on the frame. This video's chart
  (`video/wallmap.png`, her marker on a natal wheel) = an image overlay `behind: true` there (lane "ov.behind", between
  Set and Person). `bg_blur` 0.8 so the room reads.
- **Her profile picture is a bad selfie she took herself** ("blur because she doesn't know what she do with the camera"):
  `_assets/dorit/selfie.jpg` (flare portrait 0.6 from his frame: from below, motion blur, flash, thumb in the corner) -
  the character page, the polaroid, the end card, the stories, the site. The newspaper-ad portrait (`portrait.jpg`) is
  for the site's "בתקשורת" clipping.
- Look: yellow Assistant subtitles (#ffe14a), gold hook / CTA boxes, purple-starry end card; voice preset `news` +
  RNNoise; music = MYSTERIOUS, in the stars - "4 - stars mystery" (Eleven Music: choir, crystal bells,
  cosmic drone, no beat) at 0.06; he rejected the cheesy election-night keyboard: "a bit upbeat funny happy, I want it
  astrological mysterious in the stars" (2026-10-25). Options 4-6 in Media; speed 1.2.
- **dorit-1** (script 2026-10-25, Reader id `dorit-1`, footage to come in `Downloads\דורית-בחירות`): all 32 overlays tied
  to her words (script v2 2026-10-25: she opens holding her printed book - the 3D book sticker on "ומחברת" ..
  "בפברואר"; the card pull: "מה אומרים הקלפים?", Seven of Swords + red X on "לא", Four of Cups + X on "לא משנה", the
  Wheel big in the middle on "יצא גלגל המזל"; the recogniser heard "רב־המכר" as "רבהם אחר" - anchor on plain words) in episode.json (cards L x 24 / R x 696, y 300, 360-380 wide - beside her head), the "סיים." stamp lands
  on the Netanyahu card, the polaroid during the bull-vs-goat card, blinking CTA from "התחזית שלי", end card on "לא
  תהיה פה". Tested on a hidden TTS take before the footage. `_todo` = the end-card hold + fade to black after Analyze.
  Stories `Downloads\דורית-בחירות\dorit-1-story-{instagram,tiktok}.jpg`. Site: /dorit/.
- **Her own deck "טארוט מרקורי"** (his idea, 2026-10-25: "her own tarot that she printed... look like the real one, but
  her version"): the cards she pulls on camera (Four of Cups in her hand, Seven of Swords, the Wheel) are the SAME card
  on screen and in his hand - Rider-Waite art with a purple-gold border, HER face on the main figure (flare portrait
  0.8 from `portrait.jpg`; the Wheel's sphinx has her face), "טארוט מרקורי" on top, her logo, "© ד. מרקורי"; a card
  back (`deck/final/back.png`). `deck/titles.py`, `deck/print.py` → `Downloads\דורית-בחירות	arot-print\טארוט-מרקורי`.
- **dorit-1 became a LIVE** (his call, 2026-10-25: "פוב: הגעת לסוף הפיד ללייב נומרולוגית... seems like a live with hearts
  emojis and some questions - don't put too much"): hook "פוב: גללת עד סוף הפיד / ונתקעת בלייב של נומרולוגית 🔮" big
  (66, light, y 470, 0-5.8 s); the TV pieces out (strip, lower third, ticker, CTA box); three layers of our own added
  by ops (`_assets/dorit/live/make.py`, `live_ops` in the session): **Live – screen** (top bar with her selfie avatar +
  LIVE + a viewer count that climbs 1,204 → 2,317 → 3,862, the pinned comment = the CTA, the comment bar), **Live –
  comments** (6, each right after the line it reacts to, 4 s), **Live – hearts** (bursts rising with item `anim`, one
  at a time, every 5-7 s). The builder passes only pop / blink, so moving pictures go in as our own layers by op.
- **A prop held up in his hand (a tarot card, the book) = `matte_engine: "body"`** (hybrid first - it still punched
  holes in the book and the quality model dropped the mic; body = quality head + BOTH engines combined below the chin kept
  the whole book and card. Compare with `ImageChops.lighter(quality, fast)` on frames before choosing) (dorit-1, 2026-10-25, his note:
  "1:24 she shows the cards - but the cards are being cut by the cut algo"): MediaPipe "fast" dropped the card and the
  hand at the frame's edge; RVM "quality" kept both (tested on a 6 s clip of that moment, `lesson.matte(clip, out,
  engine)` - fast 3 s, quality 10 s); Any video where he holds something up: body from the first Analyze.
- **Props he prints and sticks on real objects** (2026-10-25): her self-printed giveaway book "אני אמרתי את זה כבר
  בפברואר" (`_assets/dorit/book/cover.html`, shot at 2x → `book/print.py`: 14x21 cm + 6x9 inch JPGs and A4 PDFs, 300
  dpi, cut line) - on the site as a 3D CSS book (spine on the right, Hebrew binding) with a free-copy request; the
  tarot cards at playing-card size 63x88 mm and tarot size 70x120 mm (`tarot/print.py`, A4 PDFs). All in
  `Downloads\דורית-בחירות\{book-print,tarot-print}`. Print at 100% / "actual size", never "fit to page".

## Series "news" - anchor parody (curly red wig), news-1 2026-10-18, "almost perfect"
- Set `_assets/news/studio.jpg` (world-map wall); anchor `person` scale 1.12, x 230, y 200; `cut.silence: false`.
- Opening = a layer: `"intro_video"` (Seedance clip, interpolated 24→30 fps or it stutters, ~1 s, dissolving over the
  live anchor - never a frozen frame) + `"intro_sound"` (his N12 music from its first hit, 7.46 s in). Hook within 1 s.
- Story pictures: overlay `style: image, behind: true` on the screen (x105 y352 870x490), timed to his words;
  `tag: "תמונת AI"` on realistic AI people. Lower third `style: band` "region | headline" at y 1500; ticker 1775;
  hook in the strip above the screen (y 262) for ~4.5 s.
- Voice "news" + `"denoise": {"rnn": "models/rnnoise/cb.rnnn"}` (took his AC hum away - he loved it); grade `smooth` 0.6.
- Never realistic images of real politicians at invented events; his own images stay out of git
  (`_assets/news/.gitignore`).

## Series "yuval" - conference keynote in ENGLISH (Harari parody, "Homo Useless"), yuval-1 2026-10-20
- `"language": "en"` (the Hebrew model TRANSLATES English speech); English subtitles run left to right by themselves.
- Voice preset **stage** (close mic + the hall's PA: big tail + `pa` slap echo slider) + bed `_assets/yuval/room.mp3`
  at 0.35. **Voice Pitch** slider (rubberband, formants kept): he mimics high voices; +1.5 st was the start.
- Audience ADMIRES him - amazed, never laughter, never a falling "ohh". Build crowd reactions as a stack (3-4 generated
  gasps, each pitch-shifted 0.94-1.04 and offset 0-60 ms, short echo, -14 LUFS - `crowd-gasp-stack.mp3`, "great").
  Applause during his last words; the video ends exactly on his last word (`cut.after_last_word` 0.1).
- Set: on-stage view with NO audience seats; the slide BAKED into the set photo (an image overlay doesn't follow the
  bg zoom); content where his head is not. Final `set5.jpg`: the photo's own screen edges, bg zoom 1.15 y 144, one big
  book on the right, BOOK LAUNCH tag + WORLD PREMIERE title + a made-up QR on the left. `bg_blur` 0.8.
  Now `set6.jpg`: the same, saved at 2x with a REAL QR to the book page (segno, error L) - it decodes from a still
  frame even at half size. Make sets with small detail at 2x (bg_place covers the frame the same way).
- **Never the real person's name** (he does not want to be sued): the character is **Yuval Know All Harari** (Hebrew
  hook: his own "יובל (כסא) נוח הררי" - keep his wording). No real book titles (Sapiens / Homo Deus), and no
  "parody" anywhere - it plays as a real author with a similar name.
- **Something outside the video (a site, a product) needs a loud CTA** - viewers don't leave TikTok, and a QR can't
  be scanned on the phone they watch on. The hook hands its top slot to a gold CTA box for the last ~5 s ("הספר
  באמת קיים 😳 / הלינק בביו ⬆️"); the bio hub (/links/) gets a button; caption + pinned comment carry the URL.
  Overlay start/end are timeline seconds (before speed); `--still` takes output seconds.
- The book site: `public/homo-useless/` (boostmind-b052c.web.app/homo-useless) - publisher-style page, pre-order
  opens a joke (nothing collected).

## Series "crypto" - crypto-guru parody ("the coin that will go up yesterday"), crypto-1 2026-10-21
- Set `_assets/crypto/set.jpg` (night penthouse, trading monitors, gold bull, cash) at bg zoom 1.12 y -60; trap bed
  `music.mp3` (he REJECTED it - he brings an energetic TikTok track). Effects he wants: ka-ching on every "95.4", a bill
  counter under counting lines, money raining on the last big number. Rejected (`rejected/`): the Leonardo riser, coins,
  scratch. Each hit's ATTACK (not the file start) on the recogniser's start of the word - `start_offset` = -attack;
  hits ~5 dB under his voice, beds ~10 dB under. Mixkit (mixkit.co, free license) for real library sounds.
- "Much stronger, pro": every money moment is a STACK - a real recorded ka-ching (Pixabay `px-*`) + a bass hit under
  it (gain ~0.3 - the bass files are hot) + a sticker popping in beside his face (`stickers/kaching.png`, `counter.png`;
  Leonardo on flat magenta, keyed by magenta-ness); the finale adds a boom, pouring coins and `bill.png` raining down.
  Hits ~level with his voice in mean, beds a few dB under. Pixabay sounds: real Chrome (Cloudflare), press play on each
  search result and catch the mp3 request (free license, no credit needed). He rejects AI-generated effects.
- A soft last word under the voice threshold gets cut ("שלשום"): measure the tail and add a `cut.edges` drag.
- **His site: /hindsight/** (`public/hindsight/`) - HINDSIGHT VIP, his closed signals group (the name = in hindsight).
  A $1M crypto funnel played straight: the suit portraits (Leonardo portrait from his frames; no magazine logos - it
  drew a real Forbes cover once), the video's market panel live (`market.js` = a copy of market_anim.js), tiers, the
  guarantee "if the coin didn't go up, I didn't recommend it", toasts "joined yesterday". Collects nothing. A new
  video export goes to `public/hindsight/v/week-1.mp4` (gitignored) and its section appears by itself. In the video:
  a ticker line + blinking gold CTA (y 1250) "HINDSIGHT VIP באוויר / הלינק בביו" for the last ~11 s.
- His wall had a black hexagon panel touching his hair: no matte engine drops it (hair is as flat and dark) - left.
- The coin line = a **Market panel** (`style: market`) timed by `from_words` "קחו למשל את" .. "ביום אחד"; `draw` 3.4
  holds the chart so the peak + the "ההמלצה יצאה" pin land on his "95.4" (with the ka-ching) - the pin after the rise is
  the joke. His footage is a close handheld selfie: the panel goes on TOP (y 150 w 780, over the hook), never over his
  face; person y 160. Hook (his words): "אף אחד: / נהור (ציון) מינוף:" the whole video.
- Anchor sounds to the recogniser's words (`start_word` / `end_word`), not `at`; its times run ~0.15 s early - check
  the energy. A first word timed before the clip start is not "heard" for overlays: anchor on the next words.
- Ticker of coins "up yesterday"; lower third "VIP | הקהילה הסגורה". His real name only as he writes it in the hook.

## Eye contact (he called it perfect, 2026-10-17)
**Only when the video needs it** (his words, 2026-10-25, haredit-1: "no need for eye contact in this video... I don't
want it to run when not needed"). **The KEY's presence runs it**: any `"eye_contact"` in episode.json - even
`{"on": false}` - makes Analyze prepare both versions (~2 min per 90 s take, NVIDIA). Not needed (she talks to people
around her, looks at a screen, a sketch that isn't a talk to the lens) = **no `eye_contact` key at all**; a project made
`--from` an earlier one inherits it - delete it before the first Analyze. Ask yourself before every Analyze.
Default for a talking-to-camera video: `"eye_contact": {"on": true}` = NVIDIA Maxine + our blink handling
(`tools/eyes_nvidia.py`, key NVIDIA_API_KEY in zoomcut/.env, ~2 min per 90 s take); falls back to v6 by itself if NVIDIA
fails. A CapCut export next to the take (`<take>*eye*.mp4` or `"file"`) still wins. Off when he looks at a screen /
someone else (`offscreen-voice.md`).
