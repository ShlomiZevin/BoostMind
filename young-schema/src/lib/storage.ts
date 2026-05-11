import type { Answers } from './scoring'

const KEY = 'ysq-l3:answers:v1'
const META_KEY = 'ysq-l3:meta:v1'
const THEME_KEY = 'ysq-l3:theme'

export interface Meta {
  startedAt: string | null
  completedAt: string | null
  lastSavedAt: string
}

export const loadAnswers = (): Answers => {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Answers
  } catch {
    return {}
  }
}

export const saveAnswers = (answers: Answers): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(answers))
  } catch {
    /* quota or disabled — silent */
  }
}

export const loadMeta = (): Meta => {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (raw) return JSON.parse(raw) as Meta
  } catch {
    /* fall through */
  }
  return { startedAt: null, completedAt: null, lastSavedAt: new Date().toISOString() }
}

export const saveMeta = (meta: Meta): void => {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    /* silent */
  }
}

export const clearAll = (): void => {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(META_KEY)
  } catch {
    /* silent */
  }
}

export const loadTheme = (): 'dark' | 'light' => {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* silent */
  }
  return 'dark'
}

export const saveTheme = (theme: 'dark' | 'light'): void => {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* silent */
  }
}
