import { z } from 'zod'
import { DateTime, now } from '@/lib/time'

/**
 * Client-safe period helpers for sebiseo upload confirm.
 * Must NOT import company-home summary or lib/db (server-only).
 * Default key rule mirrors company-home normalizePeriodKey without that module graph.
 */

export const sebiseoPeriodOptionSchema = z.object({
  key: z.string().min(1),
  confirmLabel: z.string().min(1),
  detailLabel: z.string().min(1),
  accountingPeriod: z.string().min(1),
  periodLabel: z.string().min(1),
})

export type SebiseoPeriodOption = z.infer<typeof sebiseoPeriodOptionSchema>

export const sebiseoPeriodOptionsPayloadSchema = z.object({
  defaultKey: z.string().min(1),
  options: z.array(sebiseoPeriodOptionSchema).min(1),
})

export type SebiseoPeriodOptionsPayload = z.infer<typeof sebiseoPeriodOptionsPayloadSchema>

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

/** Same default as company-home normalizePeriodKey (without pulling DB modules). */
export function defaultSebiseoPeriodKey(today: DateTime): string {
  if (today.month === 1 && today.day <= 25) {
    return `${today.year - 1}-H2`
  }
  if (today.month <= 7) {
    return `${today.year}-H1`
  }
  return `${today.year}-H2`
}

function halfOption(year: number, half: 1 | 2): SebiseoPeriodOption {
  const startMonth = half === 1 ? monthKey(year, 1) : monthKey(year, 7)
  const endMonth = half === 1 ? monthKey(year, 6) : monthKey(year, 12)
  return {
    key: `${year}-H${half}`,
    confirmLabel: `${year}년 ${half}기`,
    detailLabel: half === 1 ? `${year}년 부가세 1기 (1~6월)` : `${year}년 부가세 2기 (7~12월)`,
    accountingPeriod: `${startMonth}~${endMonth}`,
    periodLabel: `${year}년 부가세 ${half}기 확정 신고`,
  }
}

function monthOption(year: number, month: number): SebiseoPeriodOption {
  const key = monthKey(year, month)
  return {
    key,
    confirmLabel: `${year}년 ${month}월`,
    detailLabel: `${year}년 ${month}월 기장검토`,
    accountingPeriod: key,
    periodLabel: `${year}년 ${month}월 기장검토`,
  }
}

function uniqueByKey(options: SebiseoPeriodOption[]): SebiseoPeriodOption[] {
  const seen = new Set<string>()
  const out: SebiseoPeriodOption[] = []
  for (const option of options) {
    if (seen.has(option.key)) continue
    seen.add(option.key)
    out.push(sebiseoPeriodOptionSchema.parse(option))
  }
  return out
}

/**
 * Period candidates for sebiseo upload confirm.
 * User must confirm before session create (no silent default attribution).
 */
export function buildSebiseoPeriodOptions(params: {
  today?: DateTime
  timezone?: string
} = {}): SebiseoPeriodOptionsPayload {
  const timezone = params.timezone ?? 'Asia/Seoul'
  const today = (params.today ?? now(timezone)).setZone(timezone)
  const defaultKey = defaultSebiseoPeriodKey(today)
  const year = today.year
  const month = today.month
  const prevMonthDate = today.minus({ months: 1 })

  const options = uniqueByKey([
    halfOption(year, 1),
    halfOption(year, 2),
    halfOption(year - 1, 1),
    halfOption(year - 1, 2),
    monthOption(year, month),
    monthOption(prevMonthDate.year, prevMonthDate.month),
  ])

  const resolvedDefault = options.some((option) => option.key === defaultKey)
    ? defaultKey
    : options[0].key

  return sebiseoPeriodOptionsPayloadSchema.parse({
    defaultKey: resolvedDefault,
    options,
  })
}

export function findSebiseoPeriodOption(
  options: readonly SebiseoPeriodOption[],
  key: string,
): SebiseoPeriodOption | null {
  return options.find((option) => option.key === key) ?? null
}
