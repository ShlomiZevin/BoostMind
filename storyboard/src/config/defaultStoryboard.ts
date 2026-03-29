import { StoryboardConfig, ColumnPreset } from '../types';

export const COLUMN_PRESETS: ColumnPreset[] = [
  {
    name: 'דובר + טקסט',
    columns: [{ id: 'text', name: 'טקסט', width: '1fr' }],
  },
  {
    name: 'רואים + שומעים',
    columns: [
      { id: 'visual', name: 'רואים', width: '1fr' },
      { id: 'audio', name: 'שומעים', width: '1fr' },
    ],
  },
  {
    name: 'רואים + שומעים + הערות',
    columns: [
      { id: 'visual', name: 'רואים', width: '1fr' },
      { id: 'audio', name: 'שומעים', width: '1fr' },
      { id: 'notes', name: 'הערות', width: '0.7fr' },
    ],
  },
  {
    name: 'טקסט + בימוי',
    columns: [
      { id: 'text', name: 'טקסט', width: '2fr' },
      { id: 'direction', name: 'הנחיות בימוי', width: '1fr' },
    ],
  },
];

export const defaultStoryboard: StoryboardConfig = {
  id: 'wolt-storyboard-1',
  title: 'שיחת הגיוס',
  subtitle: 'Wolt Benefits × דמות ההייטק גיק',
  description: 'אסנת, מגייסת הייטק, יושבת בעמדת העבודה שלה. מאחוריה — סוף העולם: טילים נופלים על תל אביב, יירוטים ברקע. מסביבה שקיות Wolt. היא מדי פעם מושיטה יד ומכרסמת משהו. צחוק מזויף שמשולב באופן טבעי בשיחה, בעיקר אחרי "תגובות" מיותם (שלא נשמע — מגולם דרך התגובות שלה).',
  speakers: [
    { id: 'asnat', name: 'אסנת', color: '#7C3AED', bgColor: '#F5F0FF' },
    { id: 'direction', name: 'בימוי', color: '#E97316', bgColor: '#FFF7ED', isDirection: true },
  ],
  columns: [{ id: 'text', name: 'טקסט', width: '1fr' }],
  timing: { wordsPerSecond: 3, minDialogueSec: 1, minDirectionSec: 2 },
  approvers: [],
  approvals: {},
  globalApprovals: [],
  scenes: [
    {
      id: 's1',
      title: 'הפתיחה — אסנת מתקשרת',
      lines: [
        { id: 'l1', type: 'dialogue', speaker: 'asnat', text: 'יותם! היי! אני אסנת מטקי-טק. תקשיב, ככה, עברתי על הקו"ח שלך ועל הלינקדאין ומאוד מאוד התרשמתי. נראה שאתה עושה דברים ממש חשובים. אז רציתי ככה להתקשר ולהבין קצת יותר מה ככה אתה מחפש.' },
      ],
    },
    {
      id: 's2',
      title: 'ה-Division החדש',
      lines: [
        { id: 'l2', type: 'direction', text: '(צחוק מזויף, מהנהנת)' },
        { id: 'l3', type: 'dialogue', speaker: 'asnat', text: 'מעניין. כן כן. תראה, אנחנו ממש עכשיו מקימים פה Agentic LLM Division. לא סתם AI כסיסמה, ממש משהו שאף אחד בשוק לא עושה כרגע.' },
        { id: 'l4', type: 'direction', text: '(צחוק מזויף)' },
        { id: 'l5', type: 'dialogue', speaker: 'asnat', text: 'כן, נכון, יש כבר יותר בוני אייג׳נטים כרגע מבוני אתרים בוורדפרס לפני שני עשורים. אבל אנחנו תוקפים את זה מזווית ככה מעט שונה. אני לא בדיוק הדמות המוסמכת לפרט אבל כשתדבר עם הצוות תבין.' },
      ],
    },
    {
      id: 's3',
      title: 'תיאור התפקיד — "חצי חצי חצי חצי"',
      lines: [
        { id: 'l6', type: 'dialogue', speaker: 'asnat', text: 'אז התפקיד הוא Autonomous LLM Product Orchestrator. זה תפקיד רוחבי, חוצה ארגון, שהוא חצי פרודקט, חצי ריסרץ׳, חצי פיתוח, וחצי BI. אתה יושב בין ה\u200DData Science לפיתוח ל\u200DBusiness וללקוח ולוקח End to End ownership על הכול. והכי יפה? כל ה\u200DAI הזה ממש מקל על החיים — אז אתה בעצם יכול לעשות את כל זה לבד.' },
      ],
    },
    {
      id: 's4',
      title: '"אתה לא בורג"',
      lines: [
        { id: 'l7', type: 'dialogue', speaker: 'asnat', text: 'אנחנו מחפשים מישהו שפורח תחת לחץ, שיודע לעשות Context Switching בלי למצמץ, ושיש לו Bias for Action כי פה אף אחד לא מחכה לאישורים. אתה לא בורג במערכת. אתה ככה… עמוד השדרה שלה.' },
        { id: 'l8', type: 'direction', text: '(צחוק מזויף קצר — תגובה ל"זה נשמע בסדר" של יותם)' },
        { id: 'l9', type: 'dialogue', speaker: 'asnat', text: 'זה לא "בסדר", זה אתגר אמיתי. זה ה\u200DA Team שלנו.' },
      ],
    },
    {
      id: 's5',
      title: 'ההיררכיה והצוות',
      lines: [
        { id: 'l10', type: 'dialogue', speaker: 'asnat', text: 'מדווח? אתה מדווח לרועי — Team Lead שגייסנו לפני חודשיים. אבל אין פה היררכיה, הדלת של ה\u200DCEO תמיד פתוחה. הוא יושב בניו יורק, אבל מגיב מקסימום עד שני ימי עסקים בסלאק.' },
        { id: 'l11', type: 'direction', text: '(מכרסמת משהו מהשקית)' },
        { id: 'l12', type: 'dialogue', speaker: 'asnat', text: 'החברה היום שלוש מאות איש. אבל אתה מגיע לצוות קטן — זה כמו סטארטאפ בתוך סטארטאפ. אתה תראה.' },
      ],
    },
    {
      id: 's6',
      title: 'ההטבות — Wolt Benefits',
      highlight: true,
      lines: [
        { id: 'l13', type: 'dialogue', speaker: 'asnat', text: 'ומבחינת הטבות — התחלנו עכשיו עם Wolt Benefits. אתה מכיר את Wolt נכון? אז זה בעצם פתרון חדש שאנחנו נותנים לכל העובדים. אותו וולט, רק עם עוד הטבות ובעיקר תקציב אוכל שאפשר להשתמש בו בכל מקום — מסעדות, אפילו סופרים, דראגסטורים, מה שבא לך. זה הכי מהיר, הכי מדויק, הכי מגוון בשוק.' },
      ],
    },
    {
      id: 's7',
      title: 'הפאנצ׳ והסיום — "DALL‑E vs ננו-בננה"',
      highlight: true,
      lines: [
        { id: 'l14', type: 'direction', text: '(צחוק מזויף — תגובה ל"אז זה כזה כמו כרטיס אוכל אחר?")' },
        { id: 'l15', type: 'dialogue', speaker: 'asnat', text: 'לא לא! זה ממש לא כמו כל כרטיס אוכל אחר. זה כמו להשוות בין DALL\u200DE לנאנו\u200Dבננה — בשניהם אתה מזמין תמונה, אבל הראשון מיושן, מתעכב, מקרטע, ולרוב זה בכלל לא מה שהזמנת.' },
        { id: 'l16', type: 'dialogue', speaker: 'asnat', text: 'אז תשמע — אצלנו לא רק בונים Agents, גם עובדים Agents. החברה לא רק מממנת לך Claude ו\u200DCursor כדי לעשות הכול, היא מממנת לך גם Wolt כדי לאכול הכול. וזה אחד הדברים שהעובדים הכי מעריכים, במיוחד עכשיו עם כל האכילה הרגשית. למרות שאני באופן אישי משתדלת לא לגעת...' },
        { id: 'l17', type: 'direction', text: '(תוך כדי — נוגסת ביס גדול מאוכל Wolt)' },
        { id: 'l18', type: 'dialogue', speaker: 'asnat', text: 'אנחנו קוראים לזה Wolt Vibe Balance.' },
        { id: 'l19', type: 'direction', text: '(שתיקה. ביט.)' },
        { id: 'l20', type: 'dialogue', speaker: 'asnat', text: 'לא חשבתי על זה ככה... באמת זה קצת נשמע שכל מה שעושים פה זה או לאכול או לעבוד.' },
      ],
    },
  ],
};
