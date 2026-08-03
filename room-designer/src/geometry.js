// מנוע הבדיקות: חפיפות, אזורי גישה, דלת, חלון, ומסלולי הליכה (BFS על גריד).
import { DEFS } from './catalog.jsx'

function rotPt(x, y, rot) {
  switch (((rot % 360) + 360) % 360) {
    case 90: return [-y, x]
    case 180: return [-x, -y]
    case 270: return [y, -x]
    default: return [x, y]
  }
}

// AABB של רהיט בעולם (הסיבובים הם תמיד כפולות של 90°)
// לרהיט יכולות להיות מידות מותאמות אישית (item.w/item.h) — אחרת מידות הקטלוג
export function itemDims(item) {
  const def = DEFS[item.type]
  return { w: item.w ?? def.w, h: item.h ?? def.h }
}

export function itemRect(item) {
  const { w: iw, h: ih } = itemDims(item)
  const swap = item.rot % 180 !== 0
  const w = swap ? ih : iw
  const h = swap ? iw : ih
  return { x: item.x - w / 2, y: item.y - h / 2, w, h }
}

export function localRectToWorld(item, r) {
  const [x1, y1] = rotPt(r.x, r.y, item.rot)
  const [x2, y2] = rotPt(r.x + r.w, r.y + r.h, item.rot)
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  return { x: item.x + x, y: item.y + y, w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }
}

// מרחק מינימלי בין שני מלבנים (0 אם נוגעים/חופפים)
export function rectDist(a, b) {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)))
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)))
  return Math.hypot(dx, dy)
}

export function rectsOverlap(a, b, tol = 1) {
  return (
    a.x + tol < b.x + b.w &&
    b.x + tol < a.x + a.w &&
    a.y + tol < b.y + b.h &&
    b.y + tol < a.y + a.h
  )
}

// קטע הדלת/חלון על הקיר + מלבן פנימה לחדר
export function wallRect(room, wall, pos, width, depth) {
  switch (wall) {
    case 'top': return { x: pos, y: 0, w: width, h: depth }
    case 'bottom': return { x: pos, y: room.h - depth, w: width, h: depth }
    case 'left': return { x: 0, y: pos, w: depth, h: width }
    default: return { x: room.w - depth, y: pos, w: depth, h: width }
  }
}

export function doorZone(room) {
  const { wall, pos } = room.door
  return wallRect(room, wall, pos, 80, 80)
}

export function windowZones(room) {
  return room.windows.map((w) => ({ id: w.id, rect: wallRect(room, w.wall, w.pos, w.width, 35) }))
}

const pairAllowed = (a, b) => {
  const da = DEFS[a.type]
  const db = DEFS[b.type]
  // כיסא/פוף מותר להם "להיכנס" מתחת לשולחן — ככה מכניסים כיסא פנימה
  return (da.sit && db.surface) || (db.sit && da.surface)
}

function zoneBlocked(zoneWorld, self, solids, ignoreTypes, room) {
  // קיר חוסם את האזור
  if (
    zoneWorld.x < -1 || zoneWorld.y < -1 ||
    zoneWorld.x + zoneWorld.w > room.w + 1 ||
    zoneWorld.y + zoneWorld.h > room.h + 1
  ) return true
  for (const other of solids) {
    if (other.id === self.id) continue
    if (ignoreTypes.includes(other.type)) continue
    if (rectsOverlap(zoneWorld, itemRect(other), 3)) return true
  }
  return false
}

// גריד הליכה: תא 10 ס"מ, "הליכה" דורשת מסדרון ~50 ס"מ (רדיוס 2 תאים)
function computeReachability(room, solids) {
  const CELL = 10
  const R = 2
  const cols = Math.floor(room.w / CELL)
  const rows = Math.floor(room.h / CELL)
  if (cols < 5 || rows < 5) return null

  const blocked = new Uint8Array(cols * rows)
  for (const it of solids) {
    const r = itemRect(it)
    const c0 = Math.max(0, Math.floor(r.x / CELL))
    const c1 = Math.min(cols - 1, Math.ceil((r.x + r.w) / CELL) - 1)
    const r0 = Math.max(0, Math.floor(r.y / CELL))
    const r1 = Math.min(rows - 1, Math.ceil((r.y + r.h) / CELL) - 1)
    for (let ri = r0; ri <= r1; ri++)
      for (let ci = c0; ci <= c1; ci++) blocked[ri * cols + ci] = 1
  }

  // תא "עביר" אם כל הסביבה ברדיוס R פנויה ובתוך החדר
  const walkable = new Uint8Array(cols * rows)
  for (let ri = R; ri < rows - R; ri++) {
    outer: for (let ci = R; ci < cols - R; ci++) {
      for (let dr = -R; dr <= R; dr++)
        for (let dc = -R; dc <= R; dc++)
          if (blocked[(ri + dr) * cols + ci + dc]) continue outer
      walkable[ri * cols + ci] = 1
    }
  }

  // נקודת התחלה: התא העביר הקרוב ביותר למרכז הדלת
  const dz = doorZone(room)
  const doorCx = dz.x + dz.w / 2
  const doorCy = dz.y + dz.h / 2
  let seed = -1
  let best = Infinity
  for (let ri = 0; ri < rows; ri++) {
    for (let ci = 0; ci < cols; ci++) {
      if (!walkable[ri * cols + ci]) continue
      const dx = ci * CELL + CELL / 2 - doorCx
      const dy = ri * CELL + CELL / 2 - doorCy
      const d = dx * dx + dy * dy
      if (d < best) { best = d; seed = ri * cols + ci }
    }
  }
  if (seed < 0) return { cols, rows, CELL, walkable, reachable: new Uint8Array(cols * rows), anyWalkable: false }
  // אם התא העביר הקרוב לדלת רחוק ממנה מדי — הכניסה חסומה בפועל
  const seedFar = best > 120 * 120

  const reachable = new Uint8Array(cols * rows)
  const queue = [seed]
  reachable[seed] = 1
  while (queue.length) {
    const cur = queue.pop()
    const ri = Math.floor(cur / cols)
    const ci = cur % cols
    const next = [cur - 1, cur + 1, cur - cols, cur + cols]
    const valid = [ci > 0, ci < cols - 1, ri > 0, ri < rows - 1]
    for (let k = 0; k < 4; k++) {
      if (valid[k] && walkable[next[k]] && !reachable[next[k]]) {
        reachable[next[k]] = 1
        queue.push(next[k])
      }
    }
  }
  return { cols, rows, CELL, walkable, reachable, anyWalkable: true, seedFar }
}

function rectTouchesReachable(rect, grid, margin = 45) {
  const { cols, rows, CELL, reachable } = grid
  const c0 = Math.max(0, Math.floor((rect.x - margin) / CELL))
  const c1 = Math.min(cols - 1, Math.ceil((rect.x + rect.w + margin) / CELL) - 1)
  const r0 = Math.max(0, Math.floor((rect.y - margin) / CELL))
  const r1 = Math.min(rows - 1, Math.ceil((rect.y + rect.h + margin) / CELL) - 1)
  for (let ri = r0; ri <= r1; ri++)
    for (let ci = c0; ci <= c1; ci++)
      if (reachable[ri * cols + ci]) return true
  return false
}

// הניתוח המלא: מחזיר ציון, רשימת טיפים, ואזורים לציור
export function analyze(room, items) {
  const tips = []
  const badIds = new Set()
  let score = 100

  const solids = items.filter((it) => !DEFS[it.type].flat)

  // 1. חפיפות בין רהיטים
  let overlaps = 0
  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      if (pairAllowed(solids[i], solids[j])) continue
      if (rectsOverlap(itemRect(solids[i]), itemRect(solids[j]), 2)) {
        overlaps++
        badIds.add(solids[i].id)
        badIds.add(solids[j].id)
        tips.push({
          level: 'error',
          msg: `${DEFS[solids[i].type].name} ו${DEFS[solids[j].type].name} עולים אחד על השני — צריך להזיז`,
        })
      }
    }
  }
  score -= overlaps * 18

  // 2. חריגה מגבולות החדר
  for (const it of items) {
    const r = itemRect(it)
    if (r.x < -1 || r.y < -1 || r.x + r.w > room.w + 1 || r.y + r.h > room.h + 1) {
      badIds.add(it.id)
      tips.push({ level: 'error', msg: `${DEFS[it.type].name} חורג מקירות החדר` })
      score -= 15
    }
  }

  // 3. אזורי גישה של רהיטים
  const zoneRects = []
  for (const it of items) {
    const def = DEFS[it.type]
    if (!def.zones) continue
    const dims = itemDims(it)
    const zones = def.zones(dims.w, dims.h).map((z) => ({
      ...z,
      world: localRectToWorld(it, z),
    }))
    const groups = new Map()
    for (const z of zones) {
      const g = z.group || `${it.id}-solo-${zones.indexOf(z)}`
      if (!groups.has(g)) groups.set(g, [])
      groups.get(g).push(z)
    }
    for (const [, gz] of groups) {
      const states = gz.map((z) => zoneBlocked(z.world, it, solids, def.zoneIgnore || [], room))
      const groupOk = states.some((blocked) => !blocked)
      if (!groupOk) {
        score -= 10
        tips.push({ level: 'warn', msg: `${def.name}: ${def.zoneMsg}` })
        badIds.add(it.id)
      }
      gz.forEach((z) => zoneRects.push({ itemId: it.id, rect: z.world, ok: groupOk }))
    }
  }

  // 4. הדלת נפתחת?
  const dz = doorZone(room)
  let doorBlocked = false
  for (const it of solids) {
    if (rectsOverlap(dz, itemRect(it), 3)) {
      doorBlocked = true
      badIds.add(it.id)
    }
  }
  if (doorBlocked) {
    score -= 14
    tips.push({ level: 'error', msg: 'רהיט חוסם את פתיחת הדלת — הדלת צריכה 80 ס"מ פנויים' })
  }

  // 5. חלונות מוסתרים?
  const blockedWindows = []
  for (const wz of windowZones(room)) {
    for (const it of solids) {
      if (DEFS[it.type].tall && rectsOverlap(wz.rect, itemRect(it), 3)) {
        blockedWindows.push(wz)
        badIds.add(it.id)
        break
      }
    }
  }
  const windowBlocked = blockedWindows.length > 0
  if (windowBlocked) {
    score -= 8 * blockedWindows.length
    tips.push({
      level: 'warn',
      msg: blockedWindows.length > 1
        ? 'רהיטים גבוהים מסתירים חלונות — חבל על האור הטבעי'
        : 'רהיט גבוה מסתיר את החלון — חבל על האור הטבעי',
    })
  }

  // 5ב. מראה ופינת איפור — הכי טוב ליד אור טבעי
  const winRects = windowZones(room).map((z) => z.rect)
  if (winRects.length > 0) {
    for (const it of items) {
      if (it.type !== 'vanity' && it.type !== 'mirror') continue
      const r = itemRect(it)
      const d = Math.min(...winRects.map((wr) => rectDist(r, wr)))
      if (it.type === 'vanity') {
        if (d <= 150) {
          tips.push({ level: 'ok', msg: 'פינת האיפור קרובה לחלון — אור טבעי, האיפור ייצא מדויק ✨' })
        } else {
          score -= 4
          tips.push({ level: 'warn', msg: 'טיפ של מעצבות: כדאי לקרב את פינת האיפור לחלון — אור טבעי הוא הכי מחמיא לאיפור' })
        }
      } else if (d <= 180) {
        tips.push({ level: 'ok', msg: 'המראה ליד החלון — מחזירה אור וגורמת לחדר להרגיש גדול יותר' })
      }
    }
  }

  // 6. מסלולי הליכה
  const grid = computeReachability(room, solids)
  let unreachable = 0
  if (grid && grid.anyWalkable) {
    if (grid.seedFar && !doorBlocked) {
      score -= 10
      tips.push({ level: 'warn', msg: 'הכניסה לחדר צפופה — קשה להיכנס פנימה' })
    }
    for (const it of solids) {
      if (!rectTouchesReachable(itemRect(it), grid)) {
        unreachable++
        badIds.add(it.id)
        tips.push({ level: 'warn', msg: `קשה להגיע אל ${DEFS[it.type].name} — אין מסלול הליכה פנוי אליו` })
      }
    }
    score -= unreachable * 8
  } else if (grid && !grid.anyWalkable && solids.length > 0) {
    score -= 20
    tips.push({ level: 'error', msg: 'אין בכלל מקום ללכת בחדר! צריך לפנות מעברים' })
  }

  // 7. צפיפות כללית
  const usedArea = solids.reduce((s, it) => {
    const r = itemRect(it)
    return s + r.w * r.h
  }, 0)
  const density = usedArea / (room.w * room.h)
  if (density > 0.45) {
    score -= 8
    tips.push({ level: 'warn', msg: `הרהיטים תופסים ${Math.round(density * 100)}% מהרצפה — החדר מרגיש צפוף` })
  }

  // חיזוקים חיוביים כשדברים עובדים
  if (items.length > 0) {
    if (!doorBlocked) tips.push({ level: 'ok', msg: 'הדלת נפתחת חופשי' })
    if (grid && grid.anyWalkable && unreachable === 0 && !grid.seedFar && solids.length > 0)
      tips.push({ level: 'ok', msg: 'יש מסלול הליכה פנוי לכל הרהיטים' })
    if (!windowBlocked && room.windows.length > 0)
      tips.push({ level: 'ok', msg: room.windows.length > 1 ? 'האור מהחלונות נכנס בלי הפרעה' : 'האור מהחלון נכנס בלי הפרעה' })
    if (density <= 0.45 && solids.length > 2)
      tips.push({ level: 'ok', msg: `נשארו ${Math.round((1 - density) * 100)}% רצפה פנויה — מרווח ונעים` })
  } else {
    tips.push({ level: 'ok', msg: 'החדר ריק — בוחרים רהיט מהקטלוג ומתחילים לעצב ✨' })
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    tips,
    badIds,
    zoneRects,
    blockedWindows,
  }
}
