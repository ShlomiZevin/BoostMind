import { QUESTIONS } from '../data/questions'
import { SCHEMA_BY_CODE } from '../data/schemas'
import { BAND_LABELS_HE } from '../data/schemas'
import type { Answers, SchemaResult } from './scoring'

const triggerDownload = (filename: string, content: string, mime: string) => {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const stamp = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`
}

export const exportJson = (answers: Answers, results: SchemaResult[]): void => {
  const payload = {
    version: 'YSQ-L3',
    locale: 'he',
    exportedAt: new Date().toISOString(),
    answers,
    results: results.map(r => ({
      code: r.code,
      schema_he: r.schema.nameHe,
      schema_en: r.schema.nameEn,
      domain: r.schema.domain,
      raw_score: r.rawScore,
      max_score: r.maxScore,
      percent: r.percent,
      mean_score: r.meanScore,
      endorsed_count: r.endorsedCount,
      items_answered: r.itemsAnswered,
      items_total: r.schema.itemCount,
      band: r.band,
      band_label_he: BAND_LABELS_HE[r.band],
    })),
  }
  triggerDownload(`ysq-l3-${stamp()}.json`, JSON.stringify(payload, null, 2), 'application/json')
}

const csvEscape = (s: string): string => {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export const exportAnswersCsv = (answers: Answers): void => {
  const header = ['item_id', 'schema_code', 'schema_he', 'rating', 'item_text']
  const rows = QUESTIONS.map(q => [
    String(q.id),
    q.schema,
    SCHEMA_BY_CODE[q.schema].nameHe,
    answers[q.id] != null ? String(answers[q.id]) : '',
    q.text,
  ])
  // BOM for Excel Hebrew/UTF-8
  const csv = '﻿' + [header, ...rows].map(r => r.map(csvEscape).join(',')).join('\n')
  triggerDownload(`ysq-l3-answers-${stamp()}.csv`, csv, 'text/csv')
}

export const exportResultsCsv = (results: SchemaResult[]): void => {
  const header = ['code', 'schema_he', 'schema_en', 'domain', 'raw_score', 'max_score', 'percent', 'mean', 'endorsed_4plus', 'items_answered', 'items_total', 'band', 'band_he']
  const rows = results.map(r => [
    r.code,
    r.schema.nameHe,
    r.schema.nameEn,
    r.schema.domain,
    String(r.rawScore),
    String(r.maxScore),
    String(r.percent),
    String(r.meanScore),
    String(r.endorsedCount),
    String(r.itemsAnswered),
    String(r.schema.itemCount),
    r.band,
    BAND_LABELS_HE[r.band],
  ])
  const csv = '﻿' + [header, ...rows].map(r => r.map(csvEscape).join(',')).join('\n')
  triggerDownload(`ysq-l3-results-${stamp()}.csv`, csv, 'text/csv')
}

export const printResults = (): void => {
  window.print()
}
