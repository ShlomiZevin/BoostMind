TASK: REVISE the existing document below. It is already approved in style and structure. Apply ONLY the required changes listed here, keep every other sentence, section, table and the exact output format unchanged, and return the FULL revised document.

REQUIRED CHANGES
1. Remove every mention of Aspect, Lybi, Builder / Builder 2.0, Alfred, Codex, "הפלטפורמה שלנו בייצור", "פלטפורמה יצרנית", and retail-chain customers. Where such a sentence served as evidence, either delete it or replace it with a short, general statement based ONLY on the "Agent experience" facts in the system instructions (e.g. experience building multi-agent systems for products with separated roles, memory, RAG, deterministic rules alongside the model, logging of prompts and outputs, and routing across several model providers). No product names, no "in production with customers".
2. Tools: Claude Code is the tool we work with and propose (models via Amazon Bedrock or Vertex AI inside the ministry's cloud account, subject to Nimbus approval). Remove any wording that presents Kiro, Antigravity, BMAD or Spec-kit as tools we would operate or as equivalent alternatives. The only allowed mention: the tender lists them; our artifacts are plain Markdown files in the repository in the same Requirements/Plan/Tasks structure these frameworks use, so the ministry is not locked to Claude Code and can continue with any approved tool later; the decision is recorded with the ministry at G0. In a tools table, replace the rows so the table has: Claude Code (the tool we work with) and one row "Kiro, Antigravity, Spec-kit, BMAD" explaining only compatibility of the artifacts.
3. Do not add new sections, claims or numbers.

EXTRA FOR THIS DOCUMENT: In section "פרויקטים נבחרים" remove the Aspect and Builder 2.0 projects entirely and put first a new project "### מערכות סוכני AI למוצרים" in the same table format (היבט | תיאור): what it is — agent systems he built for products over 2+ years (banking onboarding, sales negotiation, wellness companions, consumer AI chat) with multi-agent architectures; what was done and relevance — separated agent roles, memory, RAG, deterministic rules alongside the model, logging of prompts and outputs, multi-provider routing; this is the agent architecture the tender requires. Then add a second new project "### פיתוח יומיומי ב-Agentic SDD עם Claude Code" — spec first, project constitution, skills, hooks, parallel sessions in isolated worktrees, human review of every change; relevance: the AI-Assisted SDLC the tender asks for, practiced daily. Keep the other projects. In the criteria table, the Agentic AI row must not mention retail chains or a production platform.
--- DOCUMENT TO REVISE ---
# צוות וניסיון: שלומי זוין, Boostart
>> יכולת מקצועית וניסיון מעשי ב-Agentic SDD, במחזור חיים מלא של SDLC ובמערכות Agentic AI

## 1. תקציר

שלומי זוין הוא CTO as a Service, ארכיטקט תוכנה ומוביל פיתוח עם 20+ שנות ניסיון בפיתוח מערכות תוכנה. בפרויקטים מסוג זה הוא מוצע כמוביל Agentic SDD וכארכיטקט הראשי. הוא אחראי על המתודולוגיה, החוקה הפרויקטלית, ה-Specs, שערי האיכות, עבודת ה-Agents וה-Human Reviewers. שלומי ישתתף בריאיון ובמפגשי העבודה המקצועיים מול המשרד, וילווה את הצוות עד למסירה, הטמעה והעברת ידע.

## 2. התאמה לקריטריוני התיחור

| דרישה בתיחור | מה יש לנו |
|---|---|
| ניסיון בניהול ובביצוע SDLC מלא | שלומי הוביל בנייה של 50+ מוצרים מאפס, משלב אפיון ו-Spec, דרך ארכיטקטורה, פיתוח, DevOps ועלייה לאוויר, ועד תחזוקה והרחבת מוצר. הוא כיהן כ-CTO במספר חברות הזנק. |
| ניסיון מעשי בפיתוח והטמעה של Agentic AI | 2+ שנות עבודה עמוקה עם סוכני AI. שלומי מוביל פיתוח של פלטפורמת Agentic AI רב-סוכנית הפועלת בייצור על נתונים חיים של רשתות קמעונאות בישראל. |
| שילוב כלי AI בתהליכי הפיתוח | עבודה יומיומית בשיטת Agentic SDD עם Claude Code, חוקה פרויקטלית, Specs, Skills, Hooks, Worktrees, PR ו-Code Review אנושי. שלומי גם מלמד את השיטה לצוותי פיתוח. |
| מינימום שנה עם Agentic AI | כן. לשלומי 2+ שנות ניסיון מעשי ומעמיק בתכנון, בנייה, תפעול ושיפור של מערכות Agentic AI. |
| ענן, CI/CD ו-IaC | ניסיון מעשי ב-AWS, GCP ו-Azure, לצד Docker, Kubernetes, CI/CD, Cloud Run ותהליכי פריסה מבוקרים. בפרויקט הממשלתי העבודה תותאם לכלים ולמדיניות המאושרים ב-Nimbus. |
| הסטאק של "עולים לענן" | ניסיון ב-Next.js, React, TypeScript ובבניית ממשקי Web מורכבים. ניסיון בפיתוח ובדיקות אוטומטיות, לרבות Playwright לפי צורכי הפרויקט. |
| מערכות רגולציה ופרטיות | ניסיון בפלטפורמות פרטיות, GDPR, ניהול נתונים ומערכות Enterprise מונחות רגולציה. |
| הערכת איכות מודלים | רקע מחקרי בבניית ואימון רשתות נוירונים ומודלי חיזוי, בניתוח הסיבות לחיזוי ובאלגוריתמי אופטימיזציה. ניסיון זה משמש בסיס לתכנון Evals ולמדידת איכות. |

## 3. ניסיון מקצועי

שלומי זוין עוסק בפיתוח תוכנה מקצה לקצה. ניסיונו כולל מערכות B2B ו-B2C, בעיקר מוצרי SaaS עם לוגיקה עסקית מורכבת בצד השרת, ממשקי Web, אינטגרציות, תהליכים אסינכרוניים, נתונים בזמן אמת ותפעול בענן.

במסגרת תפקידיו הוביל החלטות ארכיטקטורה, תכנון מודלי נתונים, פיתוח Backend ו-Frontend, הקמת תהליכי CI/CD, שיפור ביצועים, ניהול חובות טכנולוגיים והעברת מערכות ממצב רעיון למערכת עובדת ומתוחזקת. העבודה נעשית מתוך אחריות לקוד קריא, לבדיקות, ל-Observability וליכולת של צוות נוסף להמשיך את התחזוקה.

במערכות Agentic AI שלומי מתמקד בהפרדה בין החלטות הסתברותיות של מודל לבין בקרות דטרמיניסטיות. הוא מתכנן חלוקת תפקידים בין Agents, זיכרון, RAG, כללים, מעברי מצב, Tracing, רגרסיות ו-HITL. הגישה אינה מסתפקת בכתיבת Prompts, אלא מגדירה מנגנוני שליטה, מדידה ושחזור של התנהגות המערכת.

+ Backend | Node.js, Express, Python
+ APIs | REST, GraphQL
+ Frontend | React, Next.js, TypeScript
+ בסיסי נתונים | PostgreSQL, MongoDB, Redis
+ ביצועי נתונים | אינדקסים ואופטימיזציית שאילתות
+ ענן | AWS, GCP, Azure
+ תפעול | Docker, Kubernetes, Cloud Run
+ CI/CD | Pipelines ופריסה מבוקרת
+ זמן אמת | WebSockets, SSE
+ בדיקות | Playwright ובדיקות רגרסיה
+ Agentic AI | RAG, Memory, Routing
+ איכות AI | Evals, Tracing, HITL

::: callout
שלומי עובד לפי עיקרון של אחריות אנושית מלאה על הקוד. Agent יכול להציע, לייצר או לעדכן מימוש, אך כל שינוי מהותי נבדק, מאושר ומנוהל על ידי מהנדס אנושי.
:::

## 4. פרויקטים נבחרים

### Aspect (Lybi), פלטפורמת סוכני AI רב-סוכנית בייצור

| היבט | תיאור |
|---|---|
| מהו הפרויקט | Aspect היא פלטפורמה רב-דיירית להפעלת סוכני AI על נתונים עסקיים. היא פועלת בייצור עם רשתות קמעונאות בישראל, על נתונים חיים, בערוצי Web Chat ו-WhatsApp. |
| מה בוצע והרלוונטיות | הפלטפורמה כוללת Crews רב-סוכניים עם תפקידים נפרדים, RAG, Memory, Rules דטרמיניסטיים, Transition Router, ניתוב בין מודלים, Observability מלא ופרסום מבוקר של גרסאות. זהו מימוש מעשי של ארכיטקטורת Agentic AI מהסוג הנדרש בתיחור. |

בכל הרצת Addon נשמרים ה-Prompt המלא, הפלט הגולמי והפלט המנותח. בכל קריאת מודל נשמרים הספק, המודל, מספר הטוקנים ומשך ההרצה. יכולת זו מאפשרת Tracing, חקירת תקלות, ניתוח עלויות ושיפור התנהגות מבוסס נתונים.

### Builder 2.0, סביבת בנייה למערכות Agentic AI

| היבט | תיאור |
|---|---|
| מהו הפרויקט | Builder 2.0 הוא רכיב בתוך Aspect לבניית מערכות סוכנים. המבנה שלו הוא Project, Agent, Crew ו-Addons, ולכל רמה נשמר Spec כתוב המתאר כוונה והתנהגות. |
| מה בוצע והרלוונטיות | Agents ו-Crews מנוהלים כמסמכים עם גרסאות, טיוטות, גרסה פעילה ונקודת Publish נפרדת. הפרויקט מדגים Spec-Driven Development ו-HITL בפועל, משום ששינוי אינו עובר לייצור ללא שמירה, בדיקה ופרסום מפורש. |

ה-AI co-builder בשם Alfred יכול להציע שינוי בסוכן, ומודל נפרד יכול לייצר Patch. השינוי עובר ולידציה ונרשם ב-Change Log. כלים חיצוניים, כגון Claude Code או Codex, יכולים לכתוב לטיוטה בלבד, ולאחר מכן אדם בודק ושומר את השינוי.

### פלטפורמות פרטיות ורגולציה

| היבט | תיאור |
|---|---|
| מהו הפרויקט | שלומי עסק בפיתוח פלטפורמות לניהול פרטיות, GDPR, נתונים ודרישות רגולטוריות בארגונים. אלו מערכות Enterprise שבהן המדיניות העסקית והרגולטורית היא חלק מהלוגיקה התפעולית. |
| מה בוצע והרלוונטיות | העבודה כללה תרגום דרישות רגולציה לחוקי מערכת, סיווגים, תהליכי בקרה וניהול נתונים. ניסיון זה רלוונטי למערכת "עולים לענן", שבה נדרש לתרגם מדיניות, הנחיות ותנאי סף לכללים ותהליכים מבוקרים. |

### פלטפורמה מבוססת AI בתחום הבריאות

| היבט | תיאור |
|---|---|
| מהו הפרויקט | פלטפורמה מבוססת AI למטפלים העובדים עם ילדים על הרצף האוטיסטי. המערכת עסקה בניתוח התנהגות, ניהול מפגשים והצגת המלצות לצוות המטפל. |
| מה בוצע והרלוונטיות | העבודה עסקה במערכת המשלבת נתונים רגישים, תהליכי עבודה מקצועיים ותמיכה בקבלת החלטות. הרלוונטיות לתיחור היא בתכנון AI ככלי מסייע תחת בקרה אנושית, ולא כתחליף לאישור מקצועי או תפעולי. |

### ניתוח מערכות ERP

| היבט | תיאור |
|---|---|
| מהו הפרויקט | שלומי עבד בחברה שהתמחתה בניתוח מערכות ERP. העבודה כללה הבנה של מערכות עסקיות ותיקות, מבני נתונים ותהליכים חוצי ארגון. |
| מה בוצע והרלוונטיות | הניסיון כלל זיהוי זרימות עסקיות, ניתוח תלות בין רכיבים והבנת לוגיקה שאינה תמיד מתועדת באופן מלא. יכולת זו רלוונטית לגילוי ידע במערכות Legacy ולהמרתו ל-Specs, כללים ותהליכי עבודה. |

### אלגוריתמיקה ומחקר

| היבט | תיאור |
|---|---|
| מהו הפרויקט | לשלומי רקע מחקרי בבניית ואימון רשתות נוירונים, מודלי חיזוי, עצי החלטה ואלגוריתמים גנטיים ואבולוציוניים. בין היתר עסק באופטימיזציית מסלולים בלוגיסטיקה ובאופטימיזציית צוותים. |
| מה בוצע והרלוונטיות | העבודה כללה בחינת איכות חיזוי והבנת הגורמים להחלטות מודל, ולא רק הפעלת מודלים קיימים. ניסיון זה רלוונטי לתכנון Evals, בדיקות רגרסיה והגדרת מדדים לאיכות של רכיבי AI. |

## 5. הרצאת "מקלוד לפרוד"

שלומי מעביר הרצאה בת 2.5 שעות למפתחים ולצוותי פיתוח בשם "מקלוד לפרוד". ההרצאה עוסקת בעבודה הנדסית עם Claude, בארכיטקטורה לפני קוד, בחוקה פרויקטלית, בבקרת איכות, בניהול Context ועלויות, ובעבודה מקבילית ב-Worktrees ובסשנים מבודדים.

ההרצאה כוללת בנייה חיה של רעיון, משלב ה-Spec ועד מערכת הפועלת בענן, עם Git, תהליך פריסה ובקרות לאורך הדרך. היא מדגימה כי מתודולוגיית Agentic SDD המוצעת אינה תאורטית, וכי ניתן להעביר אותה לצוות פיתוח במסגרת משימת העברת הידע.

## 6. תפקיד מוצע ומבנה צוות

| תפקיד | מי | אחריות |
|---|---|---|
| מוביל Agentic SDD / ארכיטקט ראשי | שלומי זוין | הגדרת המתודולוגיה, החוקה הפרויקטלית, Specs, ADRs, שערי איכות, ארכיטקטורה וליווי מקצועי של הצוות. |
| מנהל פרויקט | מטעם הספק המוביל | ניהול תכנית העבודה, תיאום מול המשרד, מעקב אבני דרך, סיכונים ותלויות. |
| ארכיטקט ענן / DevOps | מטעם הספק המוביל, בליווי שלומי | תכנון אזור נחיתה, CI/CD, IaC, הפרדת סביבות, Observability ותהליכי פריסה. |
| מפתחים סוקרים (Human Reviewers) | צוות הספק, מוכשר בשיטה | פיתוח, Code Review, אימות מימוש מול Spec, טיפול ב-PR ואישור שינויים. |
| QA ואוטומציה | מטעם הספק המוביל | בדיקות פונקציונליות, אוטומציה, בדיקות רגרסיה, Evals ותיעוד איכות. |
| נציג אבטחת מידע | מטעם הספק המוביל ובתיאום המשרד | בחינת דרישות אבטחה, הרשאות, הפרדת סביבות, טיפול בנתונים ובקרות אישור. |

הצוות יעבוד תחת חוקה פרויקטלית אחת ומערכת שערי איכות אחת. שלומי יכשיר את הצוות בשיטת העבודה, בהכנת Specs, בניהול Sessions של Agents, בבקרת PR ובשמירה על עקיבות מדרישה ועד קוד, בדיקות ואישור אנושי.

## 7. פרויקטים דומים וממליצים

פרטי שני הפרויקטים שיוצגו כפרויקטים דומים, וכן פרטי הממליצים הרלוונטיים, יימסרו במסגרת ההגשה הפורמלית ובהתאם לדרישות התיחור ולכללי הסודיות החלים על הלקוחות.

## 8. פרטי קשר

שלומי זוין, Boostart. דוא"ל: shlomi@boostart.io. טלפון: 054-5567213. אתר: boostart.io.
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
