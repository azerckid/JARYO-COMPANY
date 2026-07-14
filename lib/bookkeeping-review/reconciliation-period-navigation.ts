import type { ReconciliationPeriodMode } from './reconciliation-display-model'

export type SupportedReconciliationPeriodMode = Extract<
  ReconciliationPeriodMode,
  'month' | 'quarter' | 'half_year'
>

type ParsedPeriod = {
  year: number
  mode: SupportedReconciliationPeriodMode
  index: number
}

function parsePeriodKey(periodKey: string): ParsedPeriod | null {
  const match = /^(\d{4})-(?:(\d{2})|Q([1-4])|H([12]))$/.exec(periodKey)
  if (!match) return null
  const year = Number(match[1])
  if (match[2]) return { year, mode: 'month', index: Number(match[2]) }
  if (match[3]) return { year, mode: 'quarter', index: Number(match[3]) }
  return { year, mode: 'half_year', index: Number(match[4]) }
}

function midpointMonth(period: ParsedPeriod): number {
  if (period.mode === 'month') return period.index
  if (period.mode === 'quarter') return (period.index - 1) * 3 + 2
  return period.index === 1 ? 3 : 9
}

export function convertReconciliationPeriodKey(
  periodKey: string,
  mode: SupportedReconciliationPeriodMode,
): string {
  const parsed = parsePeriodKey(periodKey)
  if (!parsed) return periodKey
  const month = midpointMonth(parsed)
  if (mode === 'month') return `${parsed.year}-${String(month).padStart(2, '0')}`
  if (mode === 'quarter') return `${parsed.year}-Q${Math.ceil(month / 3)}`
  return `${parsed.year}-H${Math.ceil(month / 6)}`
}

export function shiftReconciliationPeriodKey(periodKey: string, offset: -1 | 1): string {
  const parsed = parsePeriodKey(periodKey)
  if (!parsed) return periodKey
  const unitsPerYear = parsed.mode === 'month' ? 12 : parsed.mode === 'quarter' ? 4 : 2
  const absolute = parsed.year * unitsPerYear + (parsed.index - 1) + offset
  const year = Math.floor(absolute / unitsPerYear)
  const index = ((absolute % unitsPerYear) + unitsPerYear) % unitsPerYear + 1
  if (parsed.mode === 'month') return `${year}-${String(index).padStart(2, '0')}`
  if (parsed.mode === 'quarter') return `${year}-Q${index}`
  return `${year}-H${index}`
}
