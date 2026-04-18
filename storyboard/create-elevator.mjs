import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const app = initializeApp({
  apiKey: "AIzaSyB90ncysHNU-fqHfe9dEudVR2sweXQGM90",
  projectId: "boostmind-b052c",
});

const db = getFirestore(app);
let lid = 0;
const l = () => `l${++lid}`;

const scenes = [
  {
    id: 's1', title: 'הפתיחה — המעלית',
    lines: [
      { id: l(), type: 'dialogue', speaker: 'yotam', text: 'אתמול, כשעוד הייתי בין עבודות, הרגשתי כמו Claude Code שפתוח בטרמינל ואף אחד לא כותב לו כלום. כל היכולות בעולם, אפס פרומפטים.' },
    ],
  },
  {
    id: 's2', title: 'ה-PR של עידו',
    lines: [
      { id: l(), type: 'dialogue', speaker: 'ido', text: 'ממ. יצא לך להסתכל על ה\u200DPR שלי?' },
      { id: l(), type: 'dialogue', speaker: 'yotam', text: 'עידו, אמרתי לך — בין עבודות. אני חודש לא הגעתי למשרד. לא שמת לב?' },
      { id: l(), type: 'dialogue', speaker: 'ido', text: 'ממ. אז מחרתיים?' },
      { id: l(), type: 'dialogue', speaker: 'yotam', text: 'עידו. אני לא שם. חודש.' },
    ],
  },
  {
    id: 's3', title: 'הכנס בפראג',
    lines: [
      { id: l(), type: 'dialogue', speaker: 'ido', text: 'רגע, אז לא קראת את מה ששלחתי לך בסלאק?' },
      { id: l(), type: 'dialogue', speaker: 'yotam', text: 'ממש לא. בשבוע האחרון בכלל לא הייתי בארץ. הייתי באירופה, בכנס — קומיקון, בפראג.' },
    ],
  },
  {
    id: 's4', title: 'ה-RAG של עידו',
    lines: [
      { id: l(), type: 'dialogue', speaker: 'ido', text: 'ממ... RAG — אני עושה chunking של אלף טוקנים עם overlap של מאתיים, וה\u200Dretrieval מחזיר לי רק רעש. ניסיתי cosine similarity, ניסיתי BM25, ניסיתי היברידי — שום דבר לא מתכנס. אני חושב שהבעיה ב\u200Dembedding model, אבל לא בטוח כי ניסיתי שלושה.' },
    ],
  },
  {
    id: 's5', title: 'המעבר לטקי-טק', highlight: true,
    lines: [
      { id: l(), type: 'dialogue', speaker: 'yotam', text: 'טוב. היום אני מתחיל. מעלית ישנה, מקום חדש.' },
      { id: l(), type: 'dialogue', speaker: 'ido', text: 'באמת? אתה עוזב?' },
      { id: l(), type: 'dialogue', speaker: 'yotam', text: 'עידו, אנחנו ליטרלי כבר דקה בשיחה שאני מספר לך שעזבתי.' },
    ],
  },
  {
    id: 's6', title: 'למה עזבת?', highlight: true,
    lines: [
      { id: l(), type: 'dialogue', speaker: 'ido', text: 'ממ... מעניין. אז למה אתה עוזב?' },
      { id: l(), type: 'dialogue', speaker: 'yotam', text: 'האמת? הכל אותו דבר. אותו תפקיד, אותו שכר, אותו stack טכנולוגי, אותו עולם תוכן — רק עם Wolt Benefits, שזה פשוט וולט על חשבון החברה. גם ככה אני מזמין וולט כל יום.\nבגדול, רק עברתי קומה בבניין — זה כאילו עשיתי לעצמי deploy ל\u200Dregion אחר באותו cloud, וה\u200Denv היחיד שהשתנה ב\u200DDockerfile זה WOLT_BILLING=TekyTek.' },
    ],
  },
  {
    id: 's7', title: 'ההערות של ווה ועמית',
    lines: [
      { id: l(), type: 'dialogue', speaker: 'veh', text: 'הכל אותו דבר אבל גם אותם דִבילים. אתה מתחיל היום בטקי\u200Dטק? עכשיו אתה תראה שלא הכול וורוד כמו שסיפרו לך' },
      { id: l(), type: 'dialogue', speaker: 'amit', text: 'וחכה... תראה לכמה זומים שלא קשורים אליך יעלו אותך. לא תבין למה.' },
      { id: l(), type: 'direction', speaker: 'direction', text: '(כתובית סיום קופצת על המסך)' },
    ],
  },
  {
    id: 's8', title: 'הסיום — נגמר הקונטקסט', highlight: true,
    lines: [
      { id: l(), type: 'direction', speaker: 'direction', text: '(הדלת נפתחת בקומה שלו)' },
      { id: l(), type: 'dialogue', speaker: 'ido', text: 'טוב ביי. אז איפה המקום החדש?' },
      { id: l(), type: 'dialogue', speaker: 'yotam', text: 'אני ליטרלי איתך במעלית. עידו, אני חושב שנגמר לך הקונטקסט.' },
    ],
  },
];

const boardData = {
  id: 'wolt-elevator',
  title: 'שיחת המעלית — יותם ועידו',
  subtitle: 'Wolt Benefits × דמות ההייטק גיק — סרטון 2',
  description: 'יותם עומד במעלית במגדל הייטק עם עידו, חבר לעבודה. עידו לא מקשיב באמת — ממשיך לשאול שאלות טכניות בלי לשים לב שיותם כבר חודש לא שם ועכשיו מתחיל בטקי-טק. ווה ועמית הם הערות מהצד (pop-ups) של "חברים שבורים". הסיום מגיע כשעידו לא קולט שהוא במעלית עם יותם.',
  speakers: [
    { id: 'yotam', name: 'יותם', color: '#0EA5E9', bgColor: '#F0F9FF' },
    { id: 'ido', name: 'עידו', color: '#7C3AED', bgColor: '#F5F0FF' },
    { id: 'veh', name: 'ווה', color: '#EC4899', bgColor: '#FDF2F8' },
    { id: 'amit', name: 'עמית', color: '#10B981', bgColor: '#ECFDF5' },
    { id: 'direction', name: 'בימוי', color: '#E97316', bgColor: '#FFF7ED', isDirection: true },
  ],
  columns: [{ id: 'text', name: 'טקסט', width: '1fr' }],
  timing: { wordsPerSecond: 3, minDialogueSec: 1, minDirectionSec: 2 },
  approvers: ['דנה', 'דרור'],
  approvals: {},
  globalApprovals: [],
  scenes,
  comments: [],
  versions: [],
  updatedAt: serverTimestamp(),
};

async function main() {
  await setDoc(doc(db, 'storyboards', 'wolt-elevator'), boardData);
  console.log('Done! Storyboard "wolt-elevator" created with approvers דנה, דרור.');
}

main().catch(console.error);
