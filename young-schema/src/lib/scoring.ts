import { SCHEMAS, SCHEMA_BY_CODE, type Schema, type SchemaCode, type Band } from '../data/schemas'
import { QUESTIONS } from '../data/questions'

export type Rating = 1 | 2 | 3 | 4 | 5 | 6
export type Answers = Record<number, Rating | null>

export interface SchemaResult {
  code: SchemaCode
  schema: Schema
  rawScore: number
  maxScore: number
  percent: number       // 0–100
  meanScore: number     // 1–6 average over rated items (excludes nulls)
  endorsedCount: number // items rated >= 4
  itemsAnswered: number
  band: Band
}

export const bandFor = (schema: Schema, score: number): Band => {
  for (const range of schema.bands) {
    if (score >= range.min && score <= range.max) return range.band
  }
  // fallback (shouldn't hit since the last band extends to maxScore)
  return 'veryhigh'
}

export const scoreSchema = (schema: Schema, answers: Answers): SchemaResult => {
  const items = QUESTIONS.filter(q => q.schema === schema.code)
  let raw = 0
  let answered = 0
  let endorsed = 0
  for (const item of items) {
    const v = answers[item.id]
    if (v == null) continue
    raw += v
    answered += 1
    if (v >= 4) endorsed += 1
  }
  const mean = answered > 0 ? raw / answered : 0
  return {
    code: schema.code,
    schema,
    rawScore: raw,
    maxScore: schema.maxScore,
    percent: schema.maxScore > 0 ? Math.round((raw / schema.maxScore) * 1000) / 10 : 0,
    meanScore: Math.round(mean * 100) / 100,
    endorsedCount: endorsed,
    itemsAnswered: answered,
    band: bandFor(schema, raw),
  }
}

export const scoreAll = (answers: Answers): SchemaResult[] => {
  return SCHEMAS.map(s => scoreSchema(s, answers))
}

export const completionPercent = (answers: Answers): number => {
  const total = QUESTIONS.length
  let done = 0
  for (const q of QUESTIONS) if (answers[q.id] != null) done += 1
  return total === 0 ? 0 : Math.round((done / total) * 100)
}

export const isComplete = (answers: Answers): boolean => {
  for (const q of QUESTIONS) if (answers[q.id] == null) return false
  return true
}

export const firstUnansweredId = (answers: Answers): number | null => {
  for (const q of QUESTIONS) if (answers[q.id] == null) return q.id
  return null
}

export { SCHEMA_BY_CODE }
