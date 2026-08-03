// קטלוג רהיטים — מידות אמיתיות בס"מ, ציור עילי (top-down) לכל פריט.
// מוסכמה: הפריט מצויר סביב (0,0), "החזית" (הצד שפונים אליו) היא +y.

export const PALETTE = [
  '#f2a1bd', '#b39ddb', '#8ab6f5', '#7fd0a8',
  '#f5d06f', '#f0977a', '#a7b4c4', '#6fc7c1',
]

const WOOD = '#cfa97e'
const WOOD_DARK = '#b58f68'
const FABRIC_LIGHT = '#f7f3ec'

export const CATEGORIES = [
  { id: 'sleep', label: 'שינה', emoji: '😴' },
  { id: 'study', label: 'לימודים', emoji: '📚' },
  { id: 'storage', label: 'אחסון', emoji: '🗄️' },
  { id: 'girly', label: 'פינוקים', emoji: '💅' },
  { id: 'chill', label: "צ'יל", emoji: '🎮' },
  { id: 'decor', label: 'דקו', emoji: '🌿' },
]

// zones: אזורי גישה נדרשים בקואורדינטות מקומיות.
// zones עם אותו group — מספיק שאחד מהם פנוי. בלי group — חייב להיות פנוי.
export const CATALOG = [
  {
    type: 'bed90', name: 'מיטת יחיד', w: 90, h: 200, cat: 'sleep', emoji: '🛏️',
    colorable: true, defaultColor: '#8ab6f5',
    zones: (w, h) => [
      { x: -w / 2 - 60, y: -h / 2, w: 60, h, group: 'sides' },
      { x: w / 2, y: -h / 2, w: 60, h, group: 'sides' },
    ],
    zoneMsg: 'למיטה צריך לפחות צד אחד פנוי (60 ס"מ) כדי להיכנס אליה בנוחות',
  },
  {
    type: 'bed140', name: 'מיטה וחצי', w: 140, h: 200, cat: 'sleep', emoji: '🛏️',
    colorable: true, defaultColor: '#b39ddb',
    zones: (w, h) => [
      { x: -w / 2 - 60, y: -h / 2, w: 60, h, group: 'sides' },
      { x: w / 2, y: -h / 2, w: 60, h, group: 'sides' },
    ],
    zoneMsg: 'למיטה צריך לפחות צד אחד פנוי (60 ס"מ) כדי להיכנס אליה בנוחות',
  },
  { type: 'nightstand', name: 'שידת לילה', w: 45, h: 40, cat: 'sleep', emoji: '🕯️' },
  {
    type: 'desk', name: 'שולחן כתיבה', w: 120, h: 60, cat: 'study', emoji: '💻',
    surface: true,
    zones: (w, h) => [{ x: -w / 2, y: h / 2, w, h: 70 }],
    zoneIgnore: ['chair', 'beanbag'],
    zoneMsg: 'צריך 70 ס"מ פנויים מול השולחן — בשביל הכיסא ובשביל לקום ממנו',
  },
  {
    type: 'chair', name: 'כיסא', w: 50, h: 50, cat: 'study', emoji: '🪑',
    colorable: true, defaultColor: '#f2a1bd', sit: true,
  },
  {
    type: 'bookshelf', name: 'כוורת ספרים', w: 80, h: 30, cat: 'study', emoji: '📖',
    tall: true,
    zones: (w, h) => [{ x: -w / 2, y: h / 2, w, h: 40 }],
    zoneMsg: 'צריך קצת מרחב (40 ס"מ) כדי להגיע לספרים',
  },
  {
    type: 'wardrobe', name: 'ארון בגדים', w: 160, h: 60, cat: 'storage', emoji: '👗',
    tall: true,
    zones: (w, h) => [{ x: -w / 2, y: h / 2, w, h: 60 }],
    zoneMsg: 'דלתות הארון צריכות 60 ס"מ פנויים כדי להיפתח',
  },
  {
    type: 'dresser', name: 'שידת מגירות', w: 80, h: 45, cat: 'storage', emoji: '🧺',
    zones: (w, h) => [{ x: -w / 2, y: h / 2, w, h: 50 }],
    zoneMsg: 'המגירות צריכות 50 ס"מ פנויים כדי להיפתח',
  },
  {
    type: 'beanbag', name: 'פוף', w: 80, h: 80, cat: 'chill', emoji: '🫘',
    colorable: true, defaultColor: '#7fd0a8', sit: true,
  },
  { type: 'tvstand', name: 'מזנון + טלוויזיה', w: 120, h: 40, cat: 'chill', emoji: '📺' },
  { type: 'guitar', name: 'גיטרה', w: 40, h: 95, cat: 'chill', emoji: '🎸' },
  {
    type: 'armchair', name: 'כורסא', w: 80, h: 75, cat: 'chill', emoji: '🛋️',
    colorable: true, defaultColor: '#b39ddb', sit: true,
  },
  { type: 'petbed', name: 'מיטת חתול', w: 55, h: 55, cat: 'chill', emoji: '🐱' },
  {
    type: 'tv', name: 'טלוויזיה תלויה', w: 110, h: 12, cat: 'chill', emoji: '📺',
    tall: true,
    zones: (w, h) => [{ x: -w / 2, y: h / 2, w, h: 100 }],
    zoneIgnore: ['chair', 'beanbag', 'armchair', 'sofa', 'stool', 'eggchair', 'petbed'],
    zoneMsg: 'צריך מרחק צפייה של מטר מול הטלוויזיה',
  },
  {
    type: 'sofa', name: 'ספה זוגית', w: 150, h: 80, cat: 'chill', emoji: '🛋️',
    colorable: true, defaultColor: '#8ab6f5', sit: true,
  },
  {
    type: 'piano', name: 'קלידים', w: 130, h: 40, cat: 'chill', emoji: '🎹',
    zones: (w, h) => [{ x: -w / 2, y: h / 2, w, h: 60 }],
    zoneIgnore: ['chair', 'stool', 'beanbag'],
    zoneMsg: 'צריך מקום לשבת מול הקלידים (60 ס"מ)',
  },
  { type: 'aquarium', name: 'אקווריום', w: 70, h: 35, cat: 'decor', emoji: '🐠', tall: true },
  {
    type: 'eggchair', name: 'כיסא תלוי', w: 95, h: 95, cat: 'girly', emoji: '🥚',
    colorable: true, defaultColor: '#f2a1bd', sit: true,
  },
  {
    type: 'stool', name: 'הדום', w: 40, h: 40, cat: 'girly', emoji: '🍩',
    colorable: true, defaultColor: '#f5d06f', sit: true,
  },
  {
    type: 'rack', name: 'סטנדר בגדים', w: 100, h: 45, cat: 'girly', emoji: '👚',
    zones: (w, h) => [{ x: -w / 2, y: h / 2, w, h: 50 }],
    zoneMsg: 'צריך מקום להגיע לבגדים (50 ס"מ)',
  },
  { type: 'jewelry', name: 'מעמד תכשיטים', w: 30, h: 30, cat: 'girly', emoji: '💍' },
  { type: 'sidetable', name: 'שולחן צד', w: 45, h: 45, cat: 'decor', emoji: '🫖' },
  {
    type: 'rug', name: 'שטיח', w: 160, h: 120, cat: 'decor', emoji: '🟪',
    flat: true, colorable: true, defaultColor: '#f2a1bd',
  },
  {
    type: 'rugRound', name: 'שטיח עגול', w: 120, h: 120, cat: 'decor', emoji: '🟣',
    flat: true, colorable: true, defaultColor: '#6fc7c1',
  },
  { type: 'plant', name: 'עציץ', w: 40, h: 40, cat: 'decor', emoji: '🪴' },
  { type: 'lamp', name: 'מנורה עומדת', w: 35, h: 35, cat: 'decor', emoji: '💡' },
  {
    type: 'mirror', name: 'מראה עומדת', w: 55, h: 16, cat: 'girly', emoji: '🪞',
    tall: true,
    zones: (w, h) => [{ x: -w / 2, y: h / 2, w, h: 50 }],
    zoneMsg: 'צריך מקום לעמוד מול המראה (50 ס"מ)',
  },
  {
    type: 'vanity', name: 'פינת איפור', w: 90, h: 40, cat: 'girly', emoji: '💄',
    surface: true,
    zones: (w, h) => [{ x: -w / 2, y: h / 2, w, h: 60 }],
    zoneIgnore: ['chair', 'beanbag'],
    zoneMsg: 'צריך מקום לשבת מול שולחן האיפור (60 ס"מ)',
  },
]

export const DEFS = Object.fromEntries(CATALOG.map((d) => [d.type, d]))

function Bed({ w, h, color }) {
  const pillows = w >= 110 ? 2 : 1
  const pw = pillows === 2 ? (w - 34) / 2 : w - 28
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={9} fill={WOOD} />
      <rect x={-w / 2 + 5} y={-h / 2 + 5} width={w - 10} height={h - 10} rx={6} fill={FABRIC_LIGHT} />
      {Array.from({ length: pillows }, (_, i) => (
        <rect
          key={i}
          x={-w / 2 + 12 + i * (pw + 10)}
          y={-h / 2 + 13}
          width={pw}
          height={28}
          rx={9}
          fill="#ffffff"
          stroke="#e4ddd0"
          strokeWidth={1.5}
        />
      ))}
      <rect x={-w / 2 + 5} y={-h / 2 + 55} width={w - 10} height={h - 60} rx={6} fill={color} />
      <rect x={-w / 2 + 5} y={-h / 2 + 55} width={w - 10} height={16} fill="#ffffff" opacity={0.35} />
    </g>
  )
}

function Nightstand({ w, h }) {
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={6} fill={WOOD} />
      <circle cx={0} cy={0} r={10} fill="#f5d06f" />
      <circle cx={0} cy={0} r={4} fill="#fff" opacity={0.8} />
    </g>
  )
}

function Desk({ w, h }) {
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={5} fill={WOOD} />
      <rect x={-w / 2 + 4} y={-h / 2 + 4} width={w - 8} height={h - 8} rx={4} fill="#dbba90" />
      <rect x={-22} y={-h / 2 + 12} width={44} height={28} rx={3} fill="#454b5c" />
      <rect x={-18} y={-h / 2 + 16} width={36} height={13} rx={2} fill="#8a93ab" />
      <circle cx={w / 2 - 20} cy={0} r={6.5} fill="#f0977a" />
      <circle cx={w / 2 - 20} cy={0} r={4} fill="#8a5a3b" />
    </g>
  )
}

function Chair({ w, h, color }) {
  return (
    <g>
      <rect x={-w / 2 + 4} y={-h / 2 + 8} width={w - 8} height={h - 12} rx={14} fill={color} />
      <rect x={-w / 2 + 6} y={-h / 2} width={w - 12} height={11} rx={5.5} fill={color} filter="brightness(0.85)" opacity={0.75} />
      <circle cx={0} cy={4} r={9} fill="#ffffff" opacity={0.25} />
    </g>
  )
}

function Bookshelf({ w, h }) {
  const books = ['#f2a1bd', '#8ab6f5', '#7fd0a8', '#f5d06f', '#b39ddb', '#f0977a']
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={3} fill={WOOD_DARK} />
      {books.map((c, i) => (
        <rect
          key={i}
          x={-w / 2 + 6 + i * ((w - 12) / books.length)}
          y={-h / 2 + 5}
          width={(w - 12) / books.length - 3}
          height={h - 10}
          rx={2}
          fill={c}
        />
      ))}
    </g>
  )
}

function Wardrobe({ w, h }) {
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4} fill={WOOD} />
      <rect x={-w / 2 + 4} y={-h / 2 + 4} width={w / 2 - 6} height={h - 8} rx={3} fill="#dbba90" />
      <rect x={2} y={-h / 2 + 4} width={w / 2 - 6} height={h - 8} rx={3} fill="#dbba90" />
      <rect x={-7} y={h / 2 - 22} width={4} height={13} rx={2} fill="#7a5a3a" />
      <rect x={3} y={h / 2 - 22} width={4} height={13} rx={2} fill="#7a5a3a" />
    </g>
  )
}

function Dresser({ w, h }) {
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={5} fill={WOOD} />
      <line x1={-w / 2 + 5} y1={0} x2={w / 2 - 5} y2={0} stroke="#a9835c" strokeWidth={2} />
      <circle cx={-w / 4} cy={h / 2 - 9} r={3.5} fill="#7a5a3a" />
      <circle cx={w / 4} cy={h / 2 - 9} r={3.5} fill="#7a5a3a" />
    </g>
  )
}

function Beanbag({ w, h, color }) {
  return (
    <g>
      <ellipse cx={0} cy={0} rx={w / 2 - 3} ry={h / 2 - 3} fill={color} />
      <ellipse cx={-w / 8} cy={-h / 8} rx={w / 4} ry={h / 5} fill="#ffffff" opacity={0.28} />
      <path d={`M ${-w / 5} ${h / 6} Q 0 ${h / 3.2} ${w / 5} ${h / 6}`} stroke="#00000022" strokeWidth={3} fill="none" strokeLinecap="round" />
    </g>
  )
}

function TvStand({ w, h }) {
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={5} fill={WOOD_DARK} />
      <rect x={-w / 2 + 16} y={-4} width={w - 32} height={11} rx={2.5} fill="#23272f" />
      <rect x={-10} y={-h / 2 + 6} width={20} height={8} rx={2} fill="#454b5c" />
    </g>
  )
}

function Guitar({ w, h }) {
  return (
    <g>
      <rect x={-3} y={-h / 2 + 4} width={6} height={h * 0.45} rx={3} fill="#6e4a2e" />
      <ellipse cx={0} cy={h / 2 - h * 0.22} rx={w / 2 - 2} ry={h * 0.24} fill="#d08a45" />
      <ellipse cx={0} cy={h / 2 - h * 0.36} rx={w / 2 - 8} ry={h * 0.13} fill="#d08a45" stroke="#b06f30" strokeWidth={2} />
      <circle cx={0} cy={h / 2 - h * 0.26} r={7} fill="#5c3a1e" />
      <line x1={0} y1={-h / 2 + 6} x2={0} y2={h / 2 - h * 0.26} stroke="#e8d9a0" strokeWidth={1.5} />
    </g>
  )
}

function Rug({ w, h, color, round }) {
  if (round) {
    return (
      <g>
        <ellipse cx={0} cy={0} rx={w / 2} ry={h / 2} fill={color} opacity={0.9} />
        <ellipse cx={0} cy={0} rx={w / 2 - 10} ry={h / 2 - 10} fill="none" stroke="#ffffff" strokeWidth={2.5} strokeDasharray="7 7" opacity={0.7} />
        <ellipse cx={0} cy={0} rx={w / 6} ry={h / 6} fill="#ffffff" opacity={0.22} />
      </g>
    )
  }
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={12} fill={color} opacity={0.9} />
      <rect x={-w / 2 + 9} y={-h / 2 + 9} width={w - 18} height={h - 18} rx={8} fill="none" stroke="#ffffff" strokeWidth={2.5} strokeDasharray="8 8" opacity={0.7} />
    </g>
  )
}

function Plant({ w, h }) {
  const leaves = [0, 60, 120, 180, 240, 300]
  return (
    <g>
      <circle cx={0} cy={0} r={12} fill="#b96a45" />
      {leaves.map((a) => (
        <ellipse key={a} cx={0} cy={0} rx={w / 2 - 4} ry={8} fill="#5fae7f" opacity={0.85} transform={`rotate(${a})`} />
      ))}
      <circle cx={0} cy={0} r={6} fill="#3f8a5f" />
    </g>
  )
}

function Lamp({ w }) {
  return (
    <g>
      <circle cx={0} cy={0} r={w / 2 + 6} fill="#f5d06f" opacity={0.18} />
      <circle cx={0} cy={0} r={w / 2 - 4} fill="#f5d06f" />
      <circle cx={0} cy={0} r={4.5} fill="#a98a3a" />
    </g>
  )
}

function Mirror({ w, h }) {
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4} fill="#9fb6c8" />
      <rect x={-w / 2 + 3} y={-h / 2 + 3} width={w - 6} height={h - 6} rx={3} fill="#d5e8f5" />
      <line x1={-w / 4} y1={h / 4} x2={0} y2={-h / 4} stroke="#ffffff" strokeWidth={2.5} opacity={0.9} />
    </g>
  )
}

function Vanity({ w, h }) {
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={5} fill="#e8cfd8" />
      <ellipse cx={0} cy={-h / 2 + 8} rx={w / 4} ry={6.5} fill="#d5e8f5" stroke="#b9a3ac" strokeWidth={1.5} />
      <circle cx={-w / 3} cy={3} r={5} fill="#f2a1bd" />
      <circle cx={-w / 3 + 13} cy={6} r={4} fill="#b39ddb" />
      <rect x={w / 4} y={0} width={14} height={5} rx={2.5} fill="#a77" />
    </g>
  )
}

function Armchair({ w, h, color }) {
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={16} fill={color} />
      <rect x={-w / 2} y={-h / 2} width={13} height={h} rx={6.5} fill="#000000" opacity={0.14} />
      <rect x={w / 2 - 13} y={-h / 2} width={13} height={h} rx={6.5} fill="#000000" opacity={0.14} />
      <rect x={-w / 2 + 4} y={-h / 2 + 4} width={w - 8} height={14} rx={7} fill="#000000" opacity={0.12} />
      <rect x={-w / 2 + 16} y={-h / 2 + 21} width={w - 32} height={h - 26} rx={9} fill="#ffffff" opacity={0.22} />
    </g>
  )
}

function PetBed({ w, h }) {
  return (
    <g>
      <circle cx={0} cy={0} r={w / 2} fill="#d8b98a" />
      <circle cx={0} cy={0} r={w / 2 - 7} fill="#f3e6d0" />
      {/* חתול ישן */}
      <ellipse cx={-2} cy={2} rx={w / 4 + 2} ry={w / 5} fill="#9aa1ad" />
      <circle cx={w / 6} cy={-w / 8} r={w / 7} fill="#9aa1ad" />
      <path d={`M ${w / 6 - 6} ${-w / 8 - 5} l -3 -6 l 6 1 Z`} fill="#9aa1ad" />
      <path d={`M ${w / 6 + 6} ${-w / 8 - 5} l 3 -6 l -6 1 Z`} fill="#9aa1ad" />
      <path d={`M ${-w / 4} ${6} q -10 4 -6 12`} stroke="#9aa1ad" strokeWidth={4} fill="none" strokeLinecap="round" />
    </g>
  )
}

function EggChair({ w, h, color }) {
  return (
    <g>
      <circle cx={0} cy={0} r={w / 2 - 2} fill="#d8b98a" />
      <circle cx={0} cy={0} r={w / 2 - 9} fill={color} />
      <circle cx={0} cy={3} r={w / 4} fill="#ffffff" opacity={0.28} />
      <path d={`M ${-w / 5} ${h / 2 - 12} A ${w / 4.5} ${w / 4.5} 0 0 0 ${w / 5} ${h / 2 - 12}`} fill="none" stroke="#00000022" strokeWidth={3} strokeLinecap="round" />
      <circle cx={0} cy={-2} r={3.5} fill="#8a6b45" />
    </g>
  )
}

function Stool({ w, h, color }) {
  return (
    <g>
      <circle cx={0} cy={0} r={w / 2 - 2} fill={color} />
      <circle cx={0} cy={0} r={w / 2 - 8} fill="#ffffff" opacity={0.18} />
      {[45, 135, 225, 315].map((a) => (
        <line
          key={a}
          x1={Math.cos((a * Math.PI) / 180) * 6}
          y1={Math.sin((a * Math.PI) / 180) * 6}
          x2={Math.cos((a * Math.PI) / 180) * (w / 2 - 8)}
          y2={Math.sin((a * Math.PI) / 180) * (w / 2 - 8)}
          stroke="#00000022"
          strokeWidth={2}
        />
      ))}
      <circle cx={0} cy={0} r={4} fill="#00000030" />
    </g>
  )
}

function Rack({ w, h }) {
  const clothes = ['#f2a1bd', '#8ab6f5', '#b39ddb', '#7fd0a8', '#f5d06f']
  return (
    <g>
      <circle cx={-w / 2 + 6} cy={0} r={5} fill="#8a93a5" />
      <circle cx={w / 2 - 6} cy={0} r={5} fill="#8a93a5" />
      <rect x={-w / 2 + 4} y={-2.5} width={w - 8} height={5} rx={2.5} fill="#aab3c2" />
      {clothes.map((c, i) => (
        <rect
          key={i}
          x={-w / 2 + 13 + i * ((w - 30) / clothes.length)}
          y={-h / 2 + 6}
          width={(w - 30) / clothes.length - 4}
          height={h - 12}
          rx={6}
          fill={c}
          opacity={0.95}
        />
      ))}
    </g>
  )
}

function Jewelry({ w, h }) {
  return (
    <g>
      <circle cx={0} cy={0} r={w / 2 - 2} fill="#e8cfd8" />
      <circle cx={0} cy={0} r={4} fill="#c9a97e" />
      <circle cx={-w / 5} cy={-w / 6} r={3} fill="none" stroke="#f5d06f" strokeWidth={2} />
      <circle cx={w / 5} cy={-w / 8} r={2.5} fill="none" stroke="#8ab6f5" strokeWidth={2} />
      <circle cx={w / 6} cy={w / 5} r={3} fill="none" stroke="#f2a1bd" strokeWidth={2} />
      <path d="M -6 8 l 2 -3 l 2 3 l -2 3 Z" fill="#ffffff" stroke="#b39ddb" strokeWidth={1} />
    </g>
  )
}

function WallTV({ w, h }) {
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={2.5} fill="#23272f" />
      <rect x={-w / 2 + 4} y={-h / 2 + 2.5} width={w - 8} height={h - 5} rx={1.5} fill="#3d4656" />
      <rect x={-w / 2 + 8} y={h / 2 - 4} width={16} height={2.5} rx={1.2} fill="#6c8cff" opacity={0.9} />
    </g>
  )
}

function Sofa({ w, h, color }) {
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={15} fill={color} />
      <rect x={-w / 2} y={-h / 2} width={14} height={h} rx={7} fill="#000000" opacity={0.14} />
      <rect x={w / 2 - 14} y={-h / 2} width={14} height={h} rx={7} fill="#000000" opacity={0.14} />
      <rect x={-w / 2 + 5} y={-h / 2 + 4} width={w - 10} height={15} rx={7.5} fill="#000000" opacity={0.12} />
      <rect x={-w / 2 + 18} y={-h / 2 + 22} width={w / 2 - 22} height={h - 28} rx={8} fill="#ffffff" opacity={0.22} />
      <rect x={4} y={-h / 2 + 22} width={w / 2 - 22} height={h - 28} rx={8} fill="#ffffff" opacity={0.22} />
    </g>
  )
}

function Piano({ w, h }) {
  const whiteKeys = 14
  const kw = (w - 16) / whiteKeys
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4} fill="#2b2f3a" />
      <rect x={-w / 2 + 8} y={h / 2 - 17} width={w - 16} height={13} rx={2} fill="#f5f2ea" />
      {Array.from({ length: whiteKeys - 1 }, (_, i) => (
        <line
          key={i}
          x1={-w / 2 + 8 + (i + 1) * kw} y1={h / 2 - 17}
          x2={-w / 2 + 8 + (i + 1) * kw} y2={h / 2 - 4}
          stroke="#c9c4b8" strokeWidth={1}
        />
      ))}
      {[1, 2, 4, 5, 6, 8, 9, 11, 12, 13].map((i) => (
        <rect key={i} x={-w / 2 + 8 + i * kw - 2} y={h / 2 - 17} width={4} height={7} fill="#2b2f3a" />
      ))}
      <circle cx={-w / 2 + 14} cy={-h / 2 + 10} r={3} fill="#e05d5d" />
    </g>
  )
}

function Aquarium({ w, h }) {
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4} fill="#454b5c" />
      <rect x={-w / 2 + 4} y={-h / 2 + 4} width={w - 8} height={h - 8} rx={3} fill="#7cc7d6" />
      <ellipse cx={-w / 5} cy={h / 8} rx={5} ry={3.5} fill="#f0977a" />
      <path d={`M ${-w / 5 - 5} ${h / 8} l -5 -3.5 l 0 7 Z`} fill="#f0977a" />
      <ellipse cx={w / 5} cy={-h / 8} rx={4} ry={3} fill="#f5d06f" />
      <path d={`M ${w / 5 + 4} ${-h / 8} l 5 -3 l 0 6 Z`} fill="#f5d06f" />
      <ellipse cx={w / 3} cy={h / 2 - 8} rx={6} ry={4} fill="#5fae7f" />
      <circle cx={-w / 3} cy={h / 2 - 8} r={2.5} fill="#c9c4b8" />
      <circle cx={-w / 3 + 6} cy={h / 2 - 7} r={2} fill="#a9a49a" />
    </g>
  )
}

function SideTable({ w, h }) {
  return (
    <g>
      <circle cx={0} cy={0} r={w / 2} fill={WOOD} />
      <circle cx={0} cy={0} r={w / 2 - 5} fill="#dbba90" />
      <circle cx={-w / 8} cy={-w / 8} r={6} fill="#f7f3ec" stroke="#c9b8a0" strokeWidth={1.5} />
      <circle cx={-w / 8} cy={-w / 8} r={3} fill="#8a5a3b" />
      <rect x={w / 8 - 2} y={w / 8 - 8} width={12} height={16} rx={2} fill="#f2a1bd" transform={`rotate(20 ${w / 8} ${w / 8})`} />
    </g>
  )
}

export function Graphic({ type, color, w: wProp, h: hProp }) {
  const def = DEFS[type]
  const w = wProp ?? def.w
  const h = hProp ?? def.h
  const c = color || def.defaultColor
  switch (type) {
    case 'bed90':
    case 'bed140':
      return <Bed w={w} h={h} color={c} />
    case 'nightstand':
      return <Nightstand w={w} h={h} />
    case 'desk':
      return <Desk w={w} h={h} />
    case 'chair':
      return <Chair w={w} h={h} color={c} />
    case 'bookshelf':
      return <Bookshelf w={w} h={h} />
    case 'wardrobe':
      return <Wardrobe w={w} h={h} />
    case 'dresser':
      return <Dresser w={w} h={h} />
    case 'beanbag':
      return <Beanbag w={w} h={h} color={c} />
    case 'tvstand':
      return <TvStand w={w} h={h} />
    case 'guitar':
      return <Guitar w={w} h={h} />
    case 'rug':
      return <Rug w={w} h={h} color={c} />
    case 'rugRound':
      return <Rug w={w} h={h} color={c} round />
    case 'plant':
      return <Plant w={w} h={h} />
    case 'lamp':
      return <Lamp w={w} h={h} />
    case 'mirror':
      return <Mirror w={w} h={h} />
    case 'vanity':
      return <Vanity w={w} h={h} />
    case 'armchair':
      return <Armchair w={w} h={h} color={c} />
    case 'petbed':
      return <PetBed w={w} h={h} />
    case 'eggchair':
      return <EggChair w={w} h={h} color={c} />
    case 'stool':
      return <Stool w={w} h={h} color={c} />
    case 'rack':
      return <Rack w={w} h={h} />
    case 'jewelry':
      return <Jewelry w={w} h={h} />
    case 'sidetable':
      return <SideTable w={w} h={h} />
    case 'tv':
      return <WallTV w={w} h={h} />
    case 'sofa':
      return <Sofa w={w} h={h} color={c} />
    case 'piano':
      return <Piano w={w} h={h} />
    case 'aquarium':
      return <Aquarium w={w} h={h} />
    default:
      return <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#ccc" />
  }
}
