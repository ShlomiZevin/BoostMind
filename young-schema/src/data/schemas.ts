export type SchemaCode =
  | 'ed' | 'ab' | 'ma' | 'si' | 'ds'
  | 'fa' | 'di' | 'vu' | 'eu' | 'sb'
  | 'ss' | 'ei' | 'us' | 'et' | 'is'
  | 'as' | 'np' | 'pu'

export type DomainCode =
  | 'disconnection'
  | 'autonomy'
  | 'limits'
  | 'other-directed'
  | 'overvigilance'

export type Band = 'low' | 'medium' | 'high' | 'veryhigh'

export interface BandRange {
  band: Band
  min: number
  max: number
}

export interface Schema {
  code: SchemaCode
  nameHe: string
  nameEn: string
  description: string
  domain: DomainCode
  itemStart: number
  itemEnd: number
  itemCount: number
  maxScore: number
  bands: BandRange[]
}

export interface Domain {
  code: DomainCode
  nameHe: string
  schemas: SchemaCode[]
}

export const DOMAINS: Domain[] = [
  {
    code: 'disconnection',
    nameHe: 'ניתוק ודחייה',
    schemas: ['ed', 'ab', 'ma', 'si', 'ds'],
  },
  {
    code: 'autonomy',
    nameHe: 'פגיעה באוטונומיה וביצוע',
    schemas: ['di', 'vu', 'eu', 'fa'],
  },
  {
    code: 'limits',
    nameHe: 'גבולות פגומים',
    schemas: ['et', 'is'],
  },
  {
    code: 'other-directed',
    nameHe: 'מיקוד באחר',
    schemas: ['sb', 'ss', 'as'],
  },
  {
    code: 'overvigilance',
    nameHe: 'דריכות יתר ועיכוב',
    schemas: ['ei', 'us', 'np', 'pu'],
  },
]

const bands = (maxScore: number, bigSchema: boolean): BandRange[] => {
  // YSQ-L3 official bands per scoring grid (from the source document)
  if (bigSchema) {
    return [
      { band: 'low', min: 0, max: 12 },
      { band: 'medium', min: 13, max: 25 },
      { band: 'high', min: 26, max: 39 },
      { band: 'veryhigh', min: 40, max: maxScore },
    ]
  }
  return [
    { band: 'low', min: 0, max: 8 },
    { band: 'medium', min: 9, max: 18 },
    { band: 'high', min: 19, max: 30 },
    { band: 'veryhigh', min: 31, max: maxScore },
  ]
}

export const SCHEMAS: Schema[] = [
  {
    code: 'ed',
    nameHe: 'מחסור רגשי',
    nameEn: 'Emotional Deprivation',
    description: 'תחושה שהצרכים הרגשיים שלי – לחום, לאהבה, להגנה, להבנה, להכוונה – לא יקבלו מענה מאחרים.',
    domain: 'disconnection',
    itemStart: 1, itemEnd: 9, itemCount: 9, maxScore: 54, bands: bands(54, false),
  },
  {
    code: 'ab',
    nameHe: 'נטישה / חוסר יציבות',
    nameEn: 'Abandonment',
    description: 'תחושה שהאנשים הקרובים אליי לא יכולים להישאר ביציבות או להמשיך להעניק תמיכה ויהיו זמינים בעת הצורך.',
    domain: 'disconnection',
    itemStart: 10, itemEnd: 26, itemCount: 17, maxScore: 102, bands: bands(102, true),
  },
  {
    code: 'ma',
    nameHe: 'חוסר אמון / התעללות',
    nameEn: 'Mistrust / Abuse',
    description: 'הציפייה שאחרים יפגעו, ינצלו, ישפילו, ירמו, ישקרו או יתעללו בי.',
    domain: 'disconnection',
    itemStart: 27, itemEnd: 43, itemCount: 17, maxScore: 102, bands: bands(102, true),
  },
  {
    code: 'si',
    nameHe: 'בידוד חברתי / ניכור',
    nameEn: 'Social Isolation / Alienation',
    description: 'תחושה שאני שונה מהעולם, מנותק/ת, לא חלק משום קבוצה.',
    domain: 'disconnection',
    itemStart: 44, itemEnd: 53, itemCount: 10, maxScore: 60, bands: bands(60, false),
  },
  {
    code: 'ds',
    nameHe: 'פגמיות / בושה',
    nameEn: 'Defectiveness / Shame',
    description: 'תחושה שאני פגום/ה, גרוע/ה, לא רצוי/ה או נחות/ה – ואם יראו אותי באמת, ידחו אותי.',
    domain: 'disconnection',
    itemStart: 54, itemEnd: 68, itemCount: 15, maxScore: 90, bands: bands(90, true),
  },
  {
    code: 'fa',
    nameHe: 'כישלון',
    nameEn: 'Failure',
    description: 'אמונה שאני נכשל/ת ואכשל בתחומי הישג (לימודים, עבודה, ספורט) – ושאני נחות/ה מאחרים.',
    domain: 'autonomy',
    itemStart: 69, itemEnd: 77, itemCount: 9, maxScore: 54, bands: bands(54, false),
  },
  {
    code: 'di',
    nameHe: 'תלות / חוסר מסוגלות',
    nameEn: 'Dependence / Incompetence',
    description: 'אמונה שאני לא מסוגל/ת להתמודד עם משימות יומיומיות בלי עזרה משמעותית מאחרים.',
    domain: 'autonomy',
    itemStart: 78, itemEnd: 92, itemCount: 15, maxScore: 90, bands: bands(90, true),
  },
  {
    code: 'vu',
    nameHe: 'פגיעות לפגיעה ולמחלה',
    nameEn: 'Vulnerability to Harm or Illness',
    description: 'פחד מוגזם שאסון – רפואי, פיזי, נפשי או כלכלי – עומד להתרחש בכל רגע.',
    domain: 'autonomy',
    itemStart: 93, itemEnd: 104, itemCount: 12, maxScore: 72, bands: bands(72, false),
  },
  {
    code: 'eu',
    nameHe: 'מעורבות יתר / עצמי לא מפותח',
    nameEn: 'Enmeshment / Undeveloped Self',
    description: 'מעורבות רגשית מופרזת עם דמות משמעותית (לרוב הורה/בן-זוג) על חשבון התפתחות זהות עצמית.',
    domain: 'autonomy',
    itemStart: 105, itemEnd: 115, itemCount: 11, maxScore: 66, bands: bands(66, false),
  },
  {
    code: 'sb',
    nameHe: 'כניעה',
    nameEn: 'Subjugation',
    description: 'מסירה מופרזת של שליטה ואחריות לאחרים מתוך פחד מכעס, נקמה או נטישה.',
    domain: 'other-directed',
    itemStart: 116, itemEnd: 125, itemCount: 10, maxScore: 60, bands: bands(60, false),
  },
  {
    code: 'ss',
    nameHe: 'הקרבה עצמית',
    nameEn: 'Self-Sacrifice',
    description: 'מיקוד מופרז במילוי צרכי האחר על חשבון סיפוק עצמי – לרוב מתוך תחושת אשם.',
    domain: 'other-directed',
    itemStart: 126, itemEnd: 142, itemCount: 17, maxScore: 102, bands: bands(102, true),
  },
  {
    code: 'ei',
    nameHe: 'עיכוב רגשי',
    nameEn: 'Emotional Inhibition',
    description: 'דיכוי של רגשות, פעולות ספונטניות או דחפים – לרוב כדי להימנע מתחושת בושה או אובדן שליטה.',
    domain: 'overvigilance',
    itemStart: 143, itemEnd: 151, itemCount: 9, maxScore: 54, bands: bands(54, false),
  },
  {
    code: 'us',
    nameHe: 'סטנדרטים בלתי-מתפשרים',
    nameEn: 'Unrelenting Standards',
    description: 'אמונה שצריך לעמוד בסטנדרטים גבוהים מאוד של ביצוע והתנהגות – לרוב כדי להימנע מביקורת.',
    domain: 'overvigilance',
    itemStart: 152, itemEnd: 167, itemCount: 16, maxScore: 96, bands: bands(96, true),
  },
  {
    code: 'et',
    nameHe: 'זכאות / גרנדיוזיות',
    nameEn: 'Entitlement / Grandiosity',
    description: 'תחושה שאני עליון/ה על אחרים, זכאי/ת לזכויות מיוחדות, ולא מחויב/ת לחוקים שחלים על אחרים.',
    domain: 'limits',
    itemStart: 168, itemEnd: 178, itemCount: 11, maxScore: 66, bands: bands(66, false),
  },
  {
    code: 'is',
    nameHe: 'חוסר משמעת עצמית',
    nameEn: 'Insufficient Self-Control',
    description: 'קושי בריסון עצמי, סבילות לתסכול ודחיית סיפוקים – נטייה לוותר בקלות.',
    domain: 'limits',
    itemStart: 179, itemEnd: 193, itemCount: 15, maxScore: 90, bands: bands(90, true),
  },
  {
    code: 'as',
    nameHe: 'חיפוש הכרה / אישור',
    nameEn: 'Approval-Seeking / Recognition-Seeking',
    description: 'הצורך לזכות בהערכה או באישור של אחרים מהווה ציר מרכזי בהגדרת הערך העצמי.',
    domain: 'other-directed',
    itemStart: 194, itemEnd: 207, itemCount: 14, maxScore: 84, bands: bands(84, true),
  },
  {
    code: 'np',
    nameHe: 'שליליות / פסימיות',
    nameEn: 'Negativity / Pessimism',
    description: 'מיקוד מתמיד בצדדים השליליים של החיים, ופחד שדברים יסתיימו רע.',
    domain: 'overvigilance',
    itemStart: 208, itemEnd: 218, itemCount: 11, maxScore: 66, bands: bands(66, false),
  },
  {
    code: 'pu',
    nameHe: 'ענישתיות',
    nameEn: 'Punitiveness',
    description: 'אמונה שאנשים – כולל אני – צריכים להיענש בחומרה על טעויות.',
    domain: 'overvigilance',
    itemStart: 219, itemEnd: 232, itemCount: 14, maxScore: 84, bands: bands(84, true),
  },
]

export const SCHEMA_BY_CODE: Record<SchemaCode, Schema> = SCHEMAS.reduce(
  (acc, s) => ({ ...acc, [s.code]: s }),
  {} as Record<SchemaCode, Schema>,
)

export const BAND_LABELS_HE: Record<Band, string> = {
  low: 'נמוך',
  medium: 'בינוני',
  high: 'גבוה',
  veryhigh: 'גבוה מאוד',
}

export const TOTAL_QUESTIONS = 232
