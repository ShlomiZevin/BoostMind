# Dr. Naomi-Tzipora - marketing plan (release: the guest-podcast video + her site /dr-naomi)

Not committed until the release: it quotes the unreleased script. Files with her face / the script's lines stay in
`private/promo/` (out/ = the posters, verse-*.json = the verse stories, copy.json = every Hebrew word, sheet.jpg).
Rebuild: `node scripts/releases/naomi/promo/posters.js [name]` (art + copy from private/promo).

## His rule (2026-11-22): nothing is posted or announced before the video is out. Everything below starts on release day.

| When | Piece | Where | File |
|---|---|---|---|
| Release day, with the video | the video's poster | IG story + link sticker -> the video | `out/naomi-video-instagram.jpg` |
| Release day, with the video | the video itself | verse video story (`toVideos` per VRM - the video is already in the catalog = `videoId`) | the cut |
| Release day, alt to the clip | the video's poster as a picture story | verse story (boxes) | `out/naomi-video-verse.jpg` + `verse-video.json` |
| Release day, as the IG / TikTok post | the hook video | IG reel / TikTok | after the shoot (below) |
| Release day +3 h (the video's end card sends people to the site - it must be live by then) | site launch "גם אתר – זו לידה" | IG story + link sticker -> /dr-naomi; verse story button "לאתר" -> /dr-naomi/ | `out/naomi-site-instagram.jpg`, `out/naomi-site-verse.jpg` + `verse-site.json` |
| Day +1 | the program "מאונבורדינג לבונדינג" (the "after" story - the video's result as a B2B outcome) | IG story + link -> /dr-naomi#org (or the program's anchor) ; verse story optional | `out/naomi-org-instagram.jpg` |
| Day +2 or +3 | the book (first edition sold out, third edition soon, signed copies via the form) | IG story + link -> /dr-naomi#book | `out/naomi-book-instagram.jpg` |

- Instagram versions: top 250 px empty, the bottom quarter (y 1440-1920) empty for the link sticker.
- Verse stories: `preview.mjs` passed (no box on a face / on anything) on all three screens; post with `story.mjs --test` first,
  never on Shabbat, `everyone` only if he says so.
- To swap in once the site exists: its phone screenshot as `private/promo/site-shot.png` (390-wide page, top of the hero)
  -> rerun `posters.js site` (the phone now shows a stand-in of the hero built from site-copy.md).
- Facts to match with the site builder before posting: the program "12 שבועות · 2 מסלולים · מדד: הצלחת ביניים רגשית"
  (12 weeks is my number - the site's wins), the book "המהדורה הראשונה אזלה / בקרוב: המהדורה השלישית" (= site-copy.md).

## The hook video (after the shoot - the edit-video skill + the marketing skill's hook rules)
~25-30 s, ONE piece, no "שלומיוורס מציגים" intro, no music bed (his call for this video) - her voice carries it.
1. **Hook (0-3 s)**: a real moment from the cut, cut EXACTLY at the end of the last word (word timestamps):
   "...שהמנהלת שלו שלחה לו הודעה: ׳מה הסטטוס עם המשימה?׳" - the next sentence must not be heard starting.
2. **The hook card**: the manager's message as a big chat bubble ("מה הסטטוס עם המשימה?", 09:14 ✓✓ - the poster's
   bubble) pops in over her while the footage keeps playing, blurring and dimming behind it.
3. **The run (~15 s)**: back to sharp footage on the chain - anxiety attack, ChatGPT, HR complaint, resignation -
   "...את המשימה, אגב, הוא עדיין לא התחיל." (each beat a hard cut on the word, subtitles), then
   "אתם עשיתם לילד אונבורדינג. אבל איפה הבונדינג?" with the poster's headline card.
4. **Closure**: "אחרי שבועיים..." -> "׳אני לא יודע איך להתחיל את המשימה׳" (the bubble again, now from him) -> "...איך מבקשים
   מהעובד להתחיל לעבוד." -> the end card: her name band + "עכשיו בשלומיוורס" + shlomiverse.com/dr-naomi.
5. Check: a contact sheet of ~15 frames with the safe-zone lines (250 / 1660) before he sees it.
The term "אוטיזם תעסוקתי" stays inside the video only - never on a card, poster or caption.

## Instagram captions (Terra gpt-6.1-terra, picked + edited; no emoji)

**1. The video**
התארחתי בפודקאסט וסיפרתי על מקרה מחברת הייטק מוכרת מאוד.
עובד בן 24 קיבל מהמנהלת שלו הודעה אחת: ״מה הסטטוס עם המשימה?״
ואני שואלת: עשיתם לילד אונבורדינג. אבל איפה הבונדינג?
הסרטון המלא בקישור בסטורי.
#אונבורדינג #בונדינג #עובדיםצעירים #המחוגהפנימי

**2. The site**
גם אתר – זו לידה.
אחרי שנה וחצי של שקט, האתר החדש שלי באוויר: הקליניקה, השיטה, הספר והתוכנית לארגונים.
לקביעת מפגש רגשי ראשון – הקישור בסטורי.
#המחוגהפנימי #קליניקה #המחוגשבלב #דולהרגשית

**3. The book**
המהדורה הראשונה של ״המחוג שבלב״ אזלה, ורשימת ההמתנה למהדורה השנייה נסגרה.
בקרוב תיפתח ההרשמה למהדורה השלישית. אפשר כבר להשאיר פרטים באתר לעותק חתום בהקדשה אישית.
הקישור בסטורי.
#המחוגשבלב #המחוגהפנימי #ספרים #רגשות

**4. The program**
פיתחתי את ״מאונבורדינג לבונדינג״ – תוכנית החוסן הרגשי לארגונים.
מסלול בונדינג לעובדים הצעירים, ומסלול השהיית תגובה למנהלים.
אחרי שבועיים, עובד כתב למנהלת שלו: ״אני לא יודע איך להתחיל את המשימה.״ זו הצלחה אדירה.
לתיאום שיחת היכרות לארגונים – הקישור בסטורי.
#אונבורדינג #בונדינג #מנהלים #חוסןרגשי

## Push / bell lines (verse stories)
- video: התארחתי בפודקאסט ודיברתי על עובד שנבהל מהודעת סטטוס.
- site: האתר החדש שלי נולד. אני מזמינה אתכם להיכנס.
- book: אני מזמינה אתכם לבקש עותק חתום בהקדשה אישית.
- program: פיתחתי מסלול בונדינג לעובדים והשהיית תגובה למנהלים.

## Spend (each AI call under 5¢)
GPT Image 2.6 sunburst MEDIUM 1024x1536: podcast guest 4.9¢ · site "newborn phone" 3.5¢ · book desk 3.5¢ · org workshop 4.4¢
+ Terra copy ~1.5¢ = **~18¢**.
