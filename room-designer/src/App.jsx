import { useEffect, useMemo, useRef, useState } from 'react'
import { CATALOG, CATEGORIES, DEFS, Graphic, PALETTE } from './catalog.jsx'
import { analyze, doorZone, itemDims, itemRect } from './geometry.js'

const STORAGE_KEY = 'room-designer-v1'
const WALLS = [
  { id: 'bottom', label: 'קיר תחתון' },
  { id: 'top', label: 'קיר עליון' },
  { id: 'left', label: 'קיר שמאלי' },
  { id: 'right', label: 'קיר ימני' },
]

const DEFAULT_ROOM = {
  w: 350,
  h: 400,
  door: { wall: 'bottom', pos: 30 },
  windows: [{ id: 'win1', wall: 'top', pos: 105, width: 140 }],
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data.room || !Array.isArray(data.items)) return null
    data.items = data.items.filter((it) => DEFS[it.type])
    // גרסאות ישנות שמרו חלון יחיד — ממירים לרשימה
    if (data.room.window && !data.room.windows) {
      data.room.windows = [{ id: 'win1', ...data.room.window }]
      delete data.room.window
    }
    if (!Array.isArray(data.room.windows)) data.room.windows = []
    return data
  } catch {
    return null
  }
}

const snap = (v, grid = 5) => Math.round(v / grid) * grid

function clampToRoom(item, room) {
  const r = itemRect(item)
  const halfW = r.w / 2
  const halfH = r.h / 2
  const x = Math.max(halfW, Math.min(item.x, room.w - halfW))
  const y = Math.max(halfH, Math.min(item.y, room.h - halfH))
  return { ...item, x, y }
}

// הצמדה לקיר בזמן גרירה — כשמתקרבים לקיר, הרהיט "ננעל" צמוד אליו
function wallSnap(item, room) {
  const r = itemRect(item)
  const halfW = r.w / 2
  const halfH = r.h / 2
  const WSNAP = 12
  let { x, y } = item
  if (x - halfW < WSNAP) x = halfW
  else if (room.w - (x + halfW) < WSNAP) x = room.w - halfW
  if (y - halfH < WSNAP) y = halfH
  else if (room.h - (y + halfH) < WSNAP) y = room.h - halfH
  return { ...item, x, y }
}

function findSpot(def, items, room) {
  if (def.flat) return { x: room.w / 2, y: room.h / 2 }
  const solids = items.filter((it) => !DEFS[it.type].flat).map(itemRect)
  const candidates = []
  for (let y = def.h / 2 + 10; y <= room.h - def.h / 2 - 10; y += 25)
    for (let x = def.w / 2 + 10; x <= room.w - def.w / 2 - 10; x += 25)
      candidates.push({ x, y, d: (x - room.w / 2) ** 2 + (y - room.h / 2) ** 2 })
  candidates.sort((a, b) => a.d - b.d)
  const dz = doorZone(room)
  for (const c of candidates) {
    const rect = { x: c.x - def.w / 2, y: c.y - def.h / 2, w: def.w, h: def.h }
    const hit =
      solids.some(
        (s) => rect.x < s.x + s.w && s.x < rect.x + rect.w && rect.y < s.y + s.h && s.y < rect.y + rect.h,
      ) ||
      (rect.x < dz.x + dz.w && dz.x < rect.x + rect.w && rect.y < dz.y + dz.h && dz.y < rect.y + rect.h)
    if (!hit) return { x: c.x, y: c.y }
  }
  return { x: room.w / 2, y: room.h / 2 }
}

function DoorGraphic({ room }) {
  const { wall, pos } = room.door
  const D = 80
  const conf = {
    bottom: { hinge: [pos, room.h], open: [pos, room.h - D], closed: [pos + D, room.h], sweep: 1 },
    top: { hinge: [pos, 0], open: [pos, D], closed: [pos + D, 0], sweep: 0 },
    left: { hinge: [0, pos], open: [D, pos], closed: [0, pos + D], sweep: 1 },
    right: { hinge: [room.w, pos], open: [room.w - D, pos], closed: [room.w, pos + D], sweep: 0 },
  }[wall]
  const [hx, hy] = conf.hinge
  const [ox, oy] = conf.open
  const [cx, cy] = conf.closed
  // מחיקת קטע הקיר במקום הדלת
  const gap =
    wall === 'top' || wall === 'bottom'
      ? { x: pos, y: wall === 'top' ? -13 : room.h - 1, w: D, h: 14 }
      : { x: wall === 'left' ? -13 : room.w - 1, y: pos, w: 14, h: D }
  return (
    <g>
      <rect {...{ x: gap.x, y: gap.y, width: gap.w, height: gap.h }} fill="var(--floor)" />
      <path
        d={`M ${ox} ${oy} A ${D} ${D} 0 0 ${conf.sweep} ${cx} ${cy} L ${hx} ${hy} Z`}
        fill="var(--accent)"
        opacity={0.07}
      />
      <path
        d={`M ${ox} ${oy} A ${D} ${D} 0 0 ${conf.sweep} ${cx} ${cy}`}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        strokeDasharray="5 5"
        opacity={0.55}
      />
      <line x1={hx} y1={hy} x2={ox} y2={oy} stroke="var(--accent)" strokeWidth={5} strokeLinecap="round" />
    </g>
  )
}

function WindowGraphic({ room, win, selected, onDown }) {
  const { wall, pos, width } = win
  const horiz = wall === 'top' || wall === 'bottom'
  const r = horiz
    ? { x: pos, y: wall === 'top' ? -12 : room.h, w: width, h: 12 }
    : { x: wall === 'left' ? -12 : room.w, y: pos, w: 12, h: width }
  // אזור לחיצה נדיב יותר מהחלון עצמו — נוח לגרירה גם בטאץ'
  const hit = horiz
    ? { x: r.x, y: r.y - 6, w: r.w, h: r.h + 16 }
    : { x: r.x - 6, y: r.y, w: r.w + 16, h: r.h }
  return (
    <g className="window-item" onPointerDown={onDown}>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#bfe0f5" />
      {horiz ? (
        <line x1={r.x + r.w / 2} y1={r.y} x2={r.x + r.w / 2} y2={r.y + r.h} stroke="#8fb8d4" strokeWidth={2} />
      ) : (
        <line x1={r.x} y1={r.y + r.h / 2} x2={r.x + r.w} y2={r.y + r.h / 2} stroke="#8fb8d4" strokeWidth={2} />
      )}
      {selected && (
        <rect
          x={r.x - 3} y={r.y - 3} width={r.w + 6} height={r.h + 6} rx={3}
          fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="6 4"
        />
      )}
      <rect x={hit.x} y={hit.y} width={hit.w} height={hit.h} fill="transparent" />
    </g>
  )
}

// סליידר + תיבת מספר — עריכת ערך גם בגרירה וגם בהקלדה
function RangeNum({ label, min, max, step = 5, value, onChange }) {
  const [txt, setTxt] = useState(String(value))
  useEffect(() => setTxt(String(value)), [value])
  const commit = (v) => onChange(Math.max(min, Math.min(max, v)))
  return (
    <div className="range-num">
      {label && <span className="rn-label">{label}</span>}
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)}
      />
      <input
        type="number" min={min} max={max} step={step} value={txt}
        onChange={(e) => {
          setTxt(e.target.value)
          const v = +e.target.value
          if (e.target.value !== '' && v >= min && v <= max) onChange(v)
        }}
        onBlur={() => {
          const v = +txt
          if (txt === '' || Number.isNaN(v)) setTxt(String(value))
          else commit(v)
        }}
      />
      <span className="rn-unit">ס"מ</span>
    </div>
  )
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        emoji: ['🎉', '✨', '💖', '🌟', '🎊'][i % 5],
        left: (i * 37 + 11) % 100,
        delay: ((i * 53) % 40) / 100,
        dur: 1.3 + ((i * 29) % 60) / 100,
      })),
    [],
  )
  return (
    <div className="confetti">
      {pieces.map((p, i) => (
        <span key={i} style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}>
          {p.emoji}
        </span>
      ))}
    </div>
  )
}

const scoreFace = (score, count) => {
  if (count === 0) return '🏠'
  if (score >= 100) return '🏆'
  if (score >= 90) return '🌟'
  if (score >= 75) return '😊'
  if (score >= 55) return '🤔'
  return '😵'
}

export default function App() {
  const saved = useMemo(loadSaved, [])
  const [room, setRoom] = useState(saved?.room || DEFAULT_ROOM)
  const [items, setItems] = useState(saved?.items || [])
  const [roomName, setRoomName] = useState(saved?.name || 'החדר שלי')
  const [theme, setTheme] = useState(saved?.theme || 'dark')
  const [sel, setSel] = useState(null)
  const [cat, setCat] = useState('sleep')
  const [showSettings, setShowSettings] = useState(false)
  const [confetti, setConfetti] = useState(false)

  const svgRef = useRef(null)
  const dragRef = useRef(null)
  const undoRef = useRef([])
  const idRef = useRef(1)
  const prevScoreRef = useRef(0)

  const report = useMemo(() => analyze(room, items), [room, items])
  const selItem = items.find((it) => it.id === sel)
  const selWindow = room.windows.find((w) => w.id === sel)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ room, items, name: roomName, theme }))
    }, 300)
    return () => clearTimeout(t)
  }, [room, items, roomName, theme])

  useEffect(() => {
    if (report.score === 100 && items.length >= 4 && prevScoreRef.current < 100) {
      setConfetti(true)
      const t = setTimeout(() => setConfetti(false), 2600)
      return () => clearTimeout(t)
    }
    prevScoreRef.current = report.score
  }, [report.score, items.length])

  const pushUndo = (itemsSnap = items, roomSnap = room) => {
    undoRef.current.push({ items: itemsSnap, room: roomSnap })
    if (undoRef.current.length > 60) undoRef.current.shift()
  }
  const undo = () => {
    const prev = undoRef.current.pop()
    if (prev) {
      setItems(prev.items)
      setRoom(prev.room)
    }
  }

  const addWindow = () => {
    pushUndo()
    const id = `win${Date.now().toString(36)}${idRef.current++}`
    setRoom((cur) => ({
      ...cur,
      windows: [...cur.windows, { id, wall: 'top', pos: 20, width: 120 }],
    }))
    setSel(id)
  }

  const updateWindow = (id, patch) =>
    setRoom((cur) => ({
      ...cur,
      windows: cur.windows.map((w) => {
        if (w.id !== id) return w
        const next = { ...w, ...patch }
        const len = next.wall === 'top' || next.wall === 'bottom' ? cur.w : cur.h
        next.width = Math.min(next.width, len)
        next.pos = Math.max(0, Math.min(next.pos, len - next.width))
        return next
      }),
    }))

  const deleteWindow = (id) => {
    pushUndo()
    setRoom((cur) => ({ ...cur, windows: cur.windows.filter((w) => w.id !== id) }))
    setSel(null)
  }

  const addItem = (def) => {
    pushUndo(items)
    const spot = findSpot(def, items, room)
    const item = {
      id: `it${Date.now().toString(36)}${idRef.current++}`,
      type: def.type,
      x: snap(spot.x),
      y: snap(spot.y),
      rot: 0,
      color: def.defaultColor,
      w: def.w,
      h: def.h,
    }
    setItems([...items, item])
    setSel(item.id)
  }

  const updateItem = (id, patch) =>
    setItems((cur) => cur.map((it) => (it.id === id ? clampToRoom({ ...it, ...patch }, room) : it)))

  const rotateSel = () => {
    if (!selItem) return
    pushUndo(items)
    updateItem(sel, { rot: (selItem.rot + 90) % 360 })
  }
  const deleteSel = () => {
    if (!selItem) return
    pushUndo(items)
    setItems(items.filter((it) => it.id !== sel))
    setSel(null)
  }
  const duplicateSel = () => {
    if (!selItem) return
    pushUndo(items)
    const copy = {
      ...selItem,
      id: `it${Date.now().toString(36)}${idRef.current++}`,
      x: Math.min(selItem.x + 40, room.w - 20),
      y: Math.min(selItem.y + 40, room.h - 20),
    }
    setItems([...items, clampToRoom(copy, room)])
    setSel(copy.id)
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
        return
      }
      if (!sel) return
      const win = room.windows.find((w) => w.id === sel)
      if (win) {
        const step = e.shiftKey ? 1 : 5
        const horiz = win.wall === 'top' || win.wall === 'bottom'
        const keys = horiz ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown']
        if (keys.includes(e.key)) {
          e.preventDefault()
          const delta = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -step : step
          updateWindow(sel, { pos: win.pos + delta })
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          deleteWindow(sel)
        }
        return
      }
      const it = items.find((i) => i.id === sel)
      if (!it) return
      const step = e.shiftKey ? 1 : 5
      const moves = {
        ArrowLeft: { x: it.x - step },
        ArrowRight: { x: it.x + step },
        ArrowUp: { y: it.y - step },
        ArrowDown: { y: it.y + step },
      }
      if (moves[e.key]) {
        e.preventDefault()
        updateItem(sel, moves[e.key])
      } else if (e.key.toLowerCase() === 'r') {
        rotateSel()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const toCm = (e) => {
    const svg = svgRef.current
    const m = svg.getScreenCTM()
    if (!m) return { x: 0, y: 0 }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }

  const onItemDown = (e, item) => {
    e.stopPropagation()
    const p = toCm(e)
    setSel(item.id)
    try {
      svgRef.current.setPointerCapture(e.pointerId)
    } catch {
      return
    }
    dragRef.current = { id: item.id, dx: item.x - p.x, dy: item.y - p.y, moved: false, snapshot: items }
  }
  const onWindowDown = (e, win) => {
    e.stopPropagation()
    setSel(win.id)
    try {
      svgRef.current.setPointerCapture(e.pointerId)
    } catch {
      return
    }
    dragRef.current = { win: win.id, moved: false, snapshot: items, roomSnapshot: room }
  }

  const onMove = (e) => {
    const d = dragRef.current
    if (!d) return
    const p = toCm(e)
    if (!d.moved) {
      d.moved = true
      pushUndo(d.snapshot, d.roomSnapshot || room)
    }
    if (d.win) {
      // חלון נגרר לאורך הקירות — בוחרים את הקיר הקרוב ביותר לסמן
      const win = room.windows.find((w) => w.id === d.win)
      if (!win) return
      const dists = { top: p.y, bottom: room.h - p.y, left: p.x, right: room.w - p.x }
      const wall = Object.keys(dists).reduce((a, b) => (dists[a] <= dists[b] ? a : b))
      const along = wall === 'top' || wall === 'bottom' ? p.x : p.y
      updateWindow(d.win, { wall, pos: snap(along - win.width / 2) })
      return
    }
    setItems((cur) =>
      cur.map((it) =>
        it.id === d.id
          ? wallSnap(clampToRoom({ ...it, x: snap(p.x + d.dx), y: snap(p.y + d.dy) }, room), room)
          : it,
      ),
    )
  }
  const onUp = () => {
    dragRef.current = null
  }

  const updateRoom = (patch) => {
    setRoom((cur) => {
      const next = { ...cur, ...patch }
      // לוודא שדלת וחלון נשארים על הקיר אחרי שינוי מידות
      const clampWall = (obj, width) => {
        const len = obj.wall === 'top' || obj.wall === 'bottom' ? next.w : next.h
        return { ...obj, pos: Math.max(0, Math.min(obj.pos, len - width)) }
      }
      next.door = clampWall(patch.door || cur.door, 80)
      next.windows = (patch.windows || cur.windows).map((w) => {
        const len = w.wall === 'top' || w.wall === 'bottom' ? next.w : next.h
        const width = Math.min(w.width, len)
        return clampWall({ ...w, width }, width)
      })
      return next
    })
    setItems((cur) => cur.map((it) => clampToRoom(it, { ...room, ...patch })))
  }

  const clearAll = () => {
    if (items.length && !window.confirm('לנקות את כל החדר ולהתחיל מחדש?')) return
    pushUndo(items)
    setItems([])
    setSel(null)
  }

  const M = 40
  const flatItems = items.filter((it) => DEFS[it.type].flat)
  const solidItems = items.filter((it) => !DEFS[it.type].flat)
  const gridLines = []
  for (let x = 50; x < room.w; x += 50) gridLines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={room.h} />)
  for (let y = 50; y < room.h; y += 50) gridLines.push(<line key={`h${y}`} x1={0} y1={y} x2={room.w} y2={y} />)

  const renderItem = (item) => {
    const bad = report.badIds.has(item.id)
    const dims = itemDims(item)
    return (
      <g
        key={item.id}
        transform={`translate(${item.x} ${item.y}) rotate(${item.rot})`}
        className={`item ${sel === item.id ? 'selected' : ''}`}
        onPointerDown={(e) => onItemDown(e, item)}
      >
        <Graphic type={item.type} color={item.color} w={dims.w} h={dims.h} />
        <rect
          x={-dims.w / 2}
          y={-dims.h / 2}
          width={dims.w}
          height={dims.h}
          fill="transparent"
          stroke={bad ? 'var(--bad)' : 'none'}
          strokeWidth={bad ? 2.5 : 0}
          strokeDasharray={bad ? '6 4' : 'none'}
        />
      </g>
    )
  }

  const selRect = selItem ? itemRect(selItem) : null

  return (
    <div className="app">
      {confetti && <Confetti />}
      <header>
        <div className="brand">
          <span className="logo">🛋️</span>
          <input
            className="room-name"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            maxLength={24}
            aria-label="שם החדר"
          />
        </div>
        <div className="header-actions">
          <button className="ghost" onClick={undo} title="ביטול (Ctrl+Z)">↩️ ביטול</button>
          <button className="ghost" onClick={clearAll} title="לנקות הכל">🧹 נקה</button>
          <button className="ghost" onClick={() => setShowSettings((s) => !s)}>📐 החדר</button>
          <button className="ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="catalog">
          <div className="cat-tabs">
            {CATEGORIES.map((c) => (
              <button key={c.id} className={cat === c.id ? 'active' : ''} onClick={() => setCat(c.id)}>
                <span>{c.emoji}</span> {c.label}
              </button>
            ))}
          </div>
          <div className="cat-grid">
            {CATALOG.filter((d) => d.cat === cat).map((def) => (
              <button key={def.type} className="cat-card" onClick={() => addItem(def)}>
                <svg viewBox={`${-def.w / 2 - 6} ${-def.h / 2 - 6} ${def.w + 12} ${def.h + 12}`}>
                  <Graphic type={def.type} />
                </svg>
                <div className="cat-name">{def.name}</div>
                <div className="cat-dims">
                  {def.w}×{def.h} ס"מ
                </div>
              </button>
            ))}
          </div>
          <div className="catalog-hint">לוחצים על רהיט כדי להוסיף אותו לחדר 🙂</div>
        </aside>

        <main className="canvas-wrap">
          {showSettings && (
            <div className="settings">
              <div className="settings-row">
                <label>רוחב החדר: <b>{(room.w / 100).toFixed(1)} מ'</b></label>
                <RangeNum min={200} max={800} step={10} value={room.w}
                  onChange={(v) => updateRoom({ w: v })} />
              </div>
              <div className="settings-row">
                <label>אורך החדר: <b>{(room.h / 100).toFixed(1)} מ'</b></label>
                <RangeNum min={200} max={800} step={10} value={room.h}
                  onChange={(v) => updateRoom({ h: v })} />
              </div>
              <div className="settings-row">
                <label>דלת</label>
                <select value={room.door.wall}
                  onChange={(e) => updateRoom({ door: { ...room.door, wall: e.target.value } })}>
                  {WALLS.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
                </select>
                <RangeNum min={0}
                  max={(room.door.wall === 'top' || room.door.wall === 'bottom' ? room.w : room.h) - 80}
                  step={5} value={room.door.pos}
                  onChange={(v) => updateRoom({ door: { ...room.door, pos: v } })} />
              </div>
              <div className="settings-row">
                <label>חלונות ({room.windows.length}) — גוררים אותם לאורך הקירות</label>
                <button className="add-window" onClick={addWindow}>+ הוסף חלון</button>
              </div>
            </div>
          )}

          <div className="board">
            <svg
              ref={svgRef}
              viewBox={`${-M} ${-M} ${room.w + 2 * M} ${room.h + 2 * M}`}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onPointerDown={() => setSel(null)}
            >
              <defs>
                <clipPath id="roomClip">
                  <rect x={0} y={0} width={room.w} height={room.h} />
                </clipPath>
              </defs>
              <rect x={-14} y={-14} width={room.w + 28} height={room.h + 28} rx={6} fill="var(--wall)" />
              <rect x={0} y={0} width={room.w} height={room.h} fill="var(--floor)" />
              <g className="grid-lines">{gridLines}</g>
              {room.windows.map((win) => (
                <WindowGraphic
                  key={win.id}
                  room={room}
                  win={win}
                  selected={sel === win.id}
                  onDown={(e) => onWindowDown(e, win)}
                />
              ))}
              <DoorGraphic room={room} />

              {/* אזורי חלונות מוסתרים — מסומנים בעדינות כשרהיט גבוה מפריע */}
              {report.blockedWindows.map((wz) => (
                <rect
                  key={wz.id}
                  x={wz.rect.x} y={wz.rect.y} width={wz.rect.w} height={wz.rect.h}
                  fill="var(--bad)" opacity={0.12} pointerEvents="none"
                />
              ))}

              {flatItems.map(renderItem)}
              {solidItems.map(renderItem)}

              {/* אזורי גישה: אדום כשחסום, ירוק לרהיט הנבחר */}
              <g clipPath="url(#roomClip)">
                {report.zoneRects
                  .filter((z) => !z.ok || z.itemId === sel)
                  .map((z, i) => (
                    <rect
                      key={i}
                      x={z.rect.x} y={z.rect.y} width={z.rect.w} height={z.rect.h}
                      fill={z.ok ? 'var(--good)' : 'var(--bad)'}
                      opacity={0.13}
                      stroke={z.ok ? 'var(--good)' : 'var(--bad)'}
                      strokeWidth={1.2}
                      strokeDasharray="5 5"
                      pointerEvents="none"
                    />
                  ))}
              </g>

              {selRect && (
                <g pointerEvents="none">
                  <rect
                    x={selRect.x - 4} y={selRect.y - 4} width={selRect.w + 8} height={selRect.h + 8}
                    rx={6} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="8 5"
                  />
                  <text x={selRect.x + selRect.w / 2} y={selRect.y + selRect.h + 18} className="dims-label" textAnchor="middle">
                    {Math.round(selRect.w)}×{Math.round(selRect.h)} ס"מ
                  </text>
                </g>
              )}

              <text x={room.w / 2} y={room.h + 32} className="room-label" textAnchor="middle">
                {(room.w / 100).toFixed(1)} מ'
              </text>
              <text
                x={-24} y={room.h / 2} className="room-label" textAnchor="middle"
                transform={`rotate(-90 ${-24} ${room.h / 2})`}
              >
                {(room.h / 100).toFixed(1)} מ'
              </text>
            </svg>
            {items.length === 0 && (
              <div className="empty-hint">בוחרים רהיט מהקטלוג ומתחילים לעצב את החדר ✨</div>
            )}
          </div>

          {selWindow && (
            <div className="item-toolbar">
              <span className="item-title">🪟 חלון</span>
              <RangeNum
                label="רוחב" min={60} max={250} step={10} value={selWindow.width}
                onChange={(v) => updateWindow(selWindow.id, { width: v })}
              />
              <RangeNum
                label="מיקום" min={0}
                max={(selWindow.wall === 'top' || selWindow.wall === 'bottom' ? room.w : room.h) - selWindow.width}
                step={5} value={selWindow.pos}
                onChange={(v) => updateWindow(selWindow.id, { pos: v })}
              />
              <button className="danger" onClick={() => deleteWindow(selWindow.id)} title="מחיקה (Delete)">
                🗑️ מחיקה
              </button>
            </div>
          )}

          {selItem && (
            <div className="item-toolbar">
              <span className="item-title">
                {DEFS[selItem.type].emoji} {DEFS[selItem.type].name}
              </span>
              <RangeNum
                label="רוחב" min={15} max={400} step={5} value={itemDims(selItem).w}
                onChange={(v) => updateItem(sel, { w: v })}
              />
              <RangeNum
                label="אורך" min={15} max={400} step={5} value={itemDims(selItem).h}
                onChange={(v) => updateItem(sel, { h: v })}
              />
              <button onClick={rotateSel} title="סיבוב (R)">🔄 סיבוב</button>
              {DEFS[selItem.type].colorable && (
                <span className="palette">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      className={`swatch ${selItem.color === c ? 'active' : ''}`}
                      style={{ background: c }}
                      onClick={() => {
                        pushUndo(items)
                        updateItem(sel, { color: c })
                      }}
                      aria-label="צבע"
                    />
                  ))}
                </span>
              )}
              <button onClick={duplicateSel}>👯 שכפול</button>
              <button className="danger" onClick={deleteSel} title="מחיקה (Delete)">🗑️ מחיקה</button>
            </div>
          )}
        </main>

        <aside className="tips">
          <div className="score-card">
            <div className="score-face">{scoreFace(report.score, items.length)}</div>
            <div className="score-num">{items.length === 0 ? '—' : report.score}</div>
            <div className="score-label">ציון עיצוב</div>
            <div className="score-bar">
              <div
                className="score-fill"
                style={{ width: `${items.length === 0 ? 0 : report.score}%` }}
                data-level={report.score >= 90 ? 'great' : report.score >= 65 ? 'ok' : 'low'}
              />
            </div>
          </div>
          <div className="tips-title">הטיפים של המעצבת 💅</div>
          <ul className="tips-list">
            {report.tips.map((t, i) => (
              <li key={i} className={t.level}>
                <span className="tip-icon">{t.level === 'ok' ? '✅' : t.level === 'warn' ? '⚠️' : '❌'}</span>
                {t.msg}
              </li>
            ))}
          </ul>
          <div className="kbd-hints">
            <span><b>גרירה</b> להזזה</span>
            <span><b>R</b> סיבוב</span>
            <span><b>חיצים</b> הזזה עדינה</span>
            <span><b>Delete</b> מחיקה</span>
          </div>
        </aside>
      </div>
    </div>
  )
}
