TASK: REVISE the existing document below. It is already approved in style and structure. Apply ONLY the required changes listed here, keep every other sentence, section, table and the exact output format unchanged, and return the FULL revised document.

REQUIRED CHANGES
1. Remove every mention of Aspect, Lybi, Builder / Builder 2.0, Alfred, Codex, "הפלטפורמה שלנו בייצור", "פלטפורמה יצרנית", and retail-chain customers. Where such a sentence served as evidence, either delete it or replace it with a short, general statement based ONLY on the "Agent experience" facts in the system instructions (e.g. experience building multi-agent systems for products with separated roles, memory, RAG, deterministic rules alongside the model, logging of prompts and outputs, and routing across several model providers). No product names, no "in production with customers".
2. Tools: Claude Code is the tool we work with and propose (models via Amazon Bedrock or Vertex AI inside the ministry's cloud account, subject to Nimbus approval). Remove any wording that presents Kiro, Antigravity, BMAD or Spec-kit as tools we would operate or as equivalent alternatives. The only allowed mention: the tender lists them; our artifacts are plain Markdown files in the repository in the same Requirements/Plan/Tasks structure these frameworks use, so the ministry is not locked to Claude Code and can continue with any approved tool later; the decision is recorded with the ministry at G0. In a tools table, replace the rows so the table has: Claude Code (the tool we work with) and one row "Kiro, Antigravity, Spec-kit, BMAD" explaining only compatibility of the artifacts.
3. Do not add new sections, claims or numbers.

--- DOCUMENT TO REVISE ---
# הצעת שיתוף פעולה לספקי מסגרת: הובלת Agentic AI ו-SDD בתיחורי מערך הדיגיטל הלאומי
>> שיתוף פעולה בין ספק מסגרת מוביל לבין Boostart, להעמדת מתודולוגיה, הובלה מקצועית והכשרת צוותים לתיחורי פיתוח WEB עם Agentic AI.

## 1. תקציר

מערך הדיגיטל הלאומי מפרסם תיחורים בתחום פיתוח אפליקציות WEB עם Agentic AI, שבהם נבחנים לא רק ניסיון פיתוח כללי, אלא שיטת עבודה סדורה מבוססת Spec-Driven Development, שימוש מבוקר בכלי AI לאורך ה-SDLC, ואיכות האנשים שיוצגו לראיון.

Boostart מציעה לספקי מסגרת שיתוף פעולה ממוקד. הספק המוביל מגיש את ההצעה, מחזיק באחריות החוזית, בשירות ובצוותי הביצוע. Boostart מובילה את רכיב ה-Agentic SDD, מסייעת בהכנת המענה המקצועי, ומעמידה איש מקצוע שעובד בשיטה זו מדי יום.

## 2. מה התיחורים האלה בודקים

שני התיחורים הרלוונטיים כיום הם תיחור לפיתוח קוד, התאמות למערכות קיימות או הקמת מערכות חדשות לטובת עלייה לענן מבוסס Spec-Driven Development, עבור משימות במשרדי ממשלה לאורך תקופה של כ-24 חודשים; ותיחור המשך פיתוח מערכת "עולים לענן", המבוססת Next.js, React ו-Playwright על AWS, עם קטלוג תוצרים והתחייבויות SLA בימי עבודה לאורך תקופה דומה.

| קריטריון | משקל | מה נדרש בפועל |
|---|---:|---|
| יכולות הספק | 20% | יכולת מוכחת להעמיד צוות, תהליכי פיתוח וכלי עבודה מתאימים. נדרשים גם שני פרויקטים דומים וממליצים. |
| איכות ההצעה | 20% | מענה מפורט ומתודולוגיה פנימית לשימוש בכלי AI לאורך ה-SDLC, לרבות בקרות איכות ותיעוד. |
| התאמה לתיחור | 30% | התאמה מעשית לטכנולוגיות, לתהליכי ענן, לקטלוג התוצרים, לממשקי העבודה ולדרישות השירות. |
| ראיון עם הצוות המוצע | 30% | ראיון עם האנשים שיבצעו בפועל את העבודה. נבחנים עומק מקצועי, שיקול דעת ותהליך עבודה. |

המשקל המצטבר של איכות ההצעה, ההתאמה והראיון מחייב מענה שאינו מסתפק בהצהרה על שימוש ב-AI. נדרשת שיטה שאפשר להסביר, להדגים, ליישם ולהעביר לצוותי הפרויקט.

::: callout
בתיחורים אלה, כלי ה-AI אינם תחליף למשמעת הנדסית. הם נבחנים כחלק מתהליך נשלט של Spec, תכנון, מימוש, בדיקות, Code Review ואישור אנושי.
:::

## 3. מה Boostart מביאה

+ מתודולוגיית AI-Assisted SDLC | פרוטוקול עבודה מבוסס SDD
+ איש מקצוע לראיון | עבודה יומיומית עם Claude Code
+ מסמכי Spec בריפוזיטורי | חוקה פרויקטלית ו-ADRs
+ Traceability מקצה לקצה | Requirement עד PR ובדיקה
+ תהליך HITL מחייב | Code Review אנושי
+ ארכיטקטורות Multi-Agent | בקרה דטרמיניסטית וזיכרון
+ הכשרת מפתחים מעשית | תרגול מפרט עד פריסה
+ ניסיון מוצרי AI פעילים | Aspect בסביבת Production

Boostart מביאה מסמך מתודולוגיה מוכן, מסמכי גישה ייעודיים לשני התיחורים, ואת שלומי זוין כאיש המקצוע המוצע לרכיב ה-Agentic SDD. לשלומי מעל 20 שנות ניסיון בפיתוח תוכנה ויותר מ-50 מוצרים שנבנו מאפס, לצד יותר משנתיים של עבודה עמוקה עם סוכני AI.

Aspect, פלטפורמת Multi-Agent של Boostart, פועלת בסביבת Production עם רשתות קמעונאות בישראל ועל נתונים חיים. הפלטפורמה כוללת Spec לכל רמת Agent ו-Crew, גרסאות ופרסום מבוקר, RAG, זיכרון, כללים דטרמיניסטיים, Observability ו-HITL. זהו בסיס מעשי לשיחה מקצועית על אופן התכנון, הבקרה והתחזוקה של מערכות Agentic.

בתיחור "עולים לענן", שיטת SDD מסייעת לפרק קטלוג תוצרים למשימות מתועדות, עם קריטריוני קבלה, בדיקות ו-Quality Gate. כך ניתן לנהל עבודה לפי ימי SLA באופן מדיד, תוך שמירה על Code Review, תיעוד והעברת ידע.

## 4. מה הספק המוביל מביא

- זכאות כספק מסגרת והגשת ההצעה בשם הספק.
- אחריות חוזית מלאה מול המזמין וניהול ההתקשרות.
- מנהל פרויקט, צוותי פיתוח, DevOps ותשתיות.
- כוח אדם בעל הסיווגים וההרשאות הנדרשים לפי דרישות הפרויקט.
- מוקד שירות, ניהול SLA ומענה תפעולי.
- העמדת ערבות ביצוע בשיעור הנדרש, לרבות 5% ככל שיידרש.
- ניסיון פרויקטים, ממליצים והוכחות התאמה הנדרשים בתיחור.
- היכרות עם תהליכי המשרד, ועדת ענן, יה"ב והסביבה הארגונית הרלוונטית.

Boostart אינה מחליפה את אחריות הספק המוביל. תפקידה הוא לחזק את רכיב המתודולוגיה, ההובלה המקצועית והיכולת להפעיל AI באופן מבוקר בתוך מסגרת הפרויקט שהספק מנהל.

## 5. מודלים אפשריים לשיתוף פעולה

| מודל | מה כולל |
|---|---|
| ספק משנה להובלת Agentic SDD בפרויקטים שיזכו | הובלת החוקה הפרויקטלית, מבנה ה-Spec, תהליכי AI-Assisted SDLC, Quality Gates, הכוונת צוותים וליווי מקצועי שוטף. |
| ליווי כתיבת ההגשה וההכנה לראיון | התאמת המסמכים לתיחור, חידוד המתודולוגיה, בניית מענה לדרישות SDD והכנת האנשים שיוצגו בראיון. |
| הכשרת צוותי הפיתוח של הספק בשיטה | הרצאת "מקלוד לפרוד" וסדנה מעשית על Spec, ניהול הקשר, עבודה מקבילית, בקרת איכות, Git ופריסה. |

המודל יכול להיות מצומצם לשלב ההגשה והראיון, או להתרחב לליווי הפרויקט לאחר זכייה. חלוקת העבודה, היקף המעורבות והממשקים עם מנהל הפרויקט יוגדרו מראש בהתאם לתיחור ולמבנה הצוות.

## 6. חומרים מוכנים

- מסמך מתודולוגיה: AI-Assisted SDLC Protocol / AI Development Methodology.
- מענה מקצועי לתיחור ההגירה לענן מבוסס Spec-Driven Development.
- מענה מקצועי לתיחור "המשך פיתוח מערכת עולים לענן".
- מסמך צוות וניסיון עבור שלומי זוין ו-Boostart.
- החומרים זמינים כעמודים וכקובצי PDF, וניתנים להתאמה למבנה ההצעה של הספק המוביל.

## 7. צעד הבא

מוצעת שיחת התאמה קצרה, לפני מועד ההגשה, לבחינת התאמת הספק, חלוקת האחריות והיקף הליווי הנדרש. לאחר השיחה ניתן להעביר את החומרים המקצועיים ולעבוד על התאמתם לתיחור הרלוונטי.

שלומי זוין  
Boostart  
shlomi@boostart.io  
054-5567213
# OUTPUT FORMAT — follow exactly, it is parsed by a script
Return only the document, in Hebrew, using ONLY these constructs:
- `# ` one line: the document title (H1). Exactly once, first line.
- `>> ` one line right after the title: a one-line subtitle.
- `## ` section heading. Number sections like `## 1. ...`.
- `### ` sub-heading inside a section.
- Plain paragraphs separated by a blank line. Keep paragraphs to 1–3 sentences.
- `- ` bullet list items (single line each).
- `+ ` items of a compact two-column checklist (short items, 2–7 words each). Use for lists of 6+ short items.
- Tables in pipe format. First row is the header. No separator row needed (you may include `|---|` rows, they are ignored). Keep cells short; a cell may contain up to 2 sentences.
- A callout box:
  ::: callout
  one or two sentences
  :::
- `**bold**` is allowed inside text, sparingly. No other markdown (no links, no images, no code blocks, no HTML, no horizontal rules, no nested lists).
Do not add a preface, notes to me, or anything after the document.
