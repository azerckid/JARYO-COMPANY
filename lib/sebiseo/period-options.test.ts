import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DateTime } from '@/lib/time'
import {
  buildSebiseoPeriodOptions,
  findSebiseoPeriodOption,
} from './period-options'

describe('buildSebiseoPeriodOptions', () => {
  it('defaults to H1 mid-year and includes previous half for mis-attribution prevention', () => {
    const today = DateTime.fromObject(
      { year: 2026, month: 7, day: 17 },
      { zone: 'Asia/Seoul' },
    )
    const payload = buildSebiseoPeriodOptions({ today })

    expect(payload.defaultKey).toBe('2026-H1')
    expect(findSebiseoPeriodOption(payload.options, '2026-H1')?.accountingPeriod).toBe(
      '2026-01~2026-06',
    )
    expect(findSebiseoPeriodOption(payload.options, '2026-H2')?.confirmLabel).toBe('2026년 2기')
    expect(findSebiseoPeriodOption(payload.options, '2026-07')?.accountingPeriod).toBe('2026-07')
    expect(findSebiseoPeriodOption(payload.options, '2026-06')?.confirmLabel).toBe('2026년 6월')
  })

  it('defaults to H2 after July', () => {
    const today = DateTime.fromObject(
      { year: 2026, month: 8, day: 1 },
      { zone: 'Asia/Seoul' },
    )
    const payload = buildSebiseoPeriodOptions({ today })
    expect(payload.defaultKey).toBe('2026-H2')
  })

  it('stays client-safe and does not import server-only company-home/db', () => {
    const source = readFileSync(
      join(process.cwd(), 'lib/sebiseo/period-options.ts'),
      'utf8',
    )
    expect(source).not.toMatch(/from ['"]@\/lib\/company-home/)
    expect(source).not.toMatch(/from ['"]@\/lib\/db/)
    expect(source).not.toContain("import 'server-only'")
  })
})
