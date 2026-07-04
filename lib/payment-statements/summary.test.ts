import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import {
  buildPaymentStatementBlockers,
  buildPaymentStatementHero,
  buildSimplifiedRow,
  buildYearEndRow,
  employeeKeyOf,
  resolveReportingContext,
  type EmployeeProfileInput,
  type PayrollLineInput,
  type SimplifiedRow,
} from './summary'

function line(period: string, over: Partial<PayrollLineInput> = {}): PayrollLineInput {
  return {
    employeeCode: 'E-001',
    employeeName: '김대표',
    period,
    grossPayKrw: 7_000_000,
    incomeTaxKrw: 490_000,
    status: 'ready',
    ...over,
  }
}

const H1 = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']

const profile = (over: Partial<EmployeeProfileInput> = {}): EmployeeProfileInput => ({
  employeeCode: 'E-001',
  displayName: '김대표',
  employeeStatus: 'active',
  hireDate: '2024-01-01',
  terminationDate: null,
  ...over,
})

describe('resolveReportingContext', () => {
  it('derives H1/H2 from today when no periodKey', () => {
    const h1 = resolveReportingContext(DateTime.fromISO('2026-03-10', { zone: 'Asia/Seoul' }))
    expect(h1.half).toBe(1)
    expect(h1.halfMonths).toEqual(H1)
    expect(h1.yearMonths).toHaveLength(12)
    const h2 = resolveReportingContext(DateTime.fromISO('2026-09-10', { zone: 'Asia/Seoul' }))
    expect(h2.half).toBe(2)
    expect(h2.halfMonths[0]).toBe('2026-07')
    expect(h2.halfMonths[5]).toBe('2026-12')
  })

  it('honors periodKey year + half (YYYY-H2)', () => {
    const ctx = resolveReportingContext(DateTime.fromISO('2026-03-10', { zone: 'Asia/Seoul' }), '2025-H2')
    expect(ctx.year).toBe(2025)
    expect(ctx.half).toBe(2)
    expect(ctx.halfMonths[0]).toBe('2025-07')
  })
})

describe('employeeKeyOf', () => {
  it('prefers employeeCode, falls back to name', () => {
    expect(employeeKeyOf({ employeeCode: 'E-9', employeeName: '홍' })).toBe('code:E-9')
    expect(employeeKeyOf({ employeeCode: null, employeeName: '홍길동' })).toBe('name:홍길동')
  })
})

describe('buildSimplifiedRow (간이지급명세서 반기)', () => {
  const base = { employeeKey: 'code:E-001', employeeName: '김대표', employeeCode: 'E-001', halfMonths: H1 }

  it('is ready when all half months present, confirmed, profile complete', () => {
    const row = buildSimplifiedRow({ ...base, lines: H1.map((m) => line(m)), profile: profile() })
    expect(row.status).toBe('ready')
    expect(row.grossPayKrw).toBe(42_000_000)
    expect(row.withholdingTaxKrw).toBe(2_940_000) // ΣincomeTax = 근로소득세만
  })

  it('flags needs_review when any month is needs_review', () => {
    const lines = H1.map((m) => (m === '2026-03' ? line(m, { status: 'needs_review' }) : line(m)))
    const row = buildSimplifiedRow({ ...base, lines, profile: profile() })
    expect(row.status).toBe('needs_review')
  })

  it('flags missing_months when an expected month has no line', () => {
    const lines = H1.filter((m) => m !== '2026-03').map((m) => line(m))
    const row = buildSimplifiedRow({ ...base, lines, profile: profile() })
    expect(row.status).toBe('missing_months')
  })

  it('does not count pre-hire months as missing', () => {
    // 3월 입사 → 3~6월만 기대, 1·2월 없음은 누락 아님
    const lines = ['2026-03', '2026-04', '2026-05', '2026-06'].map((m) => line(m))
    const row = buildSimplifiedRow({ ...base, lines, profile: profile({ hireDate: '2026-03-05' }) })
    expect(row.status).toBe('ready')
  })

  it('flags profile_incomplete when hireDate missing (주민번호는 검증 대상 아님)', () => {
    const row = buildSimplifiedRow({ ...base, lines: H1.map((m) => line(m)), profile: profile({ hireDate: null }) })
    expect(row.status).toBe('profile_incomplete')
  })
})

describe('buildYearEndRow (연말정산 준비·검토)', () => {
  const base = { employeeKey: 'code:E-001', employeeName: '김대표', employeeCode: 'E-001' }
  const year = Array.from({ length: 12 }, (_, i) => line(`2026-${String(i + 1).padStart(2, '0')}`))

  it('aggregates annual gross + withholding without settlement calc', () => {
    const row = buildYearEndRow({ ...base, lines: year, profile: profile() })
    expect(row.status).toBe('ready')
    expect(row.annualGrossPayKrw).toBe(84_000_000)
    expect(row.annualWithholdingTaxKrw).toBe(5_880_000)
    expect(row.missingLabel).toBe('없음')
  })

  it('marks terminated employees for mid-year settlement review', () => {
    const row = buildYearEndRow({ ...base, lines: year.slice(0, 9), profile: profile({ employeeStatus: 'terminated', terminationDate: '2026-09-30' }) })
    expect(row.status).toBe('mid_year_settlement')
    expect(row.employeeStatusLabel).toBe('중도퇴사')
  })

  it('needs_payroll when a month is unconfirmed', () => {
    const lines = year.map((l, i) => (i === 2 ? { ...l, status: 'needs_review' as const } : l))
    const row = buildYearEndRow({ ...base, lines, profile: profile() })
    expect(row.status).toBe('needs_payroll')
  })

  it('profile_incomplete when no matching profile', () => {
    const row = buildYearEndRow({ ...base, lines: year, profile: undefined })
    expect(row.status).toBe('profile_incomplete')
  })
})

describe('blockers + hero', () => {
  const rows = (statuses: SimplifiedRow['status'][]): SimplifiedRow[] =>
    statuses.map((s, i) => ({
      employeeKey: `k${i}`, employeeName: `e${i}`, employeeCode: null,
      periodLabel: '', grossPayKrw: 0, withholdingTaxKrw: 0,
      status: s, statusLabel: '', tone: 'ok',
    }))

  it('routes payroll vs profile issues to the right workspace', () => {
    const blockers = buildPaymentStatementBlockers({
      simplified: rows(['needs_review', 'profile_incomplete', 'ready']),
      yearEnd: [],
    })
    expect(blockers.find((b) => b.id === 'payroll')?.href).toBe('/dashboard/payroll')
    expect(blockers.find((b) => b.id === 'profile')?.href).toBe('/dashboard/employees')
  })

  it('computes readiness = ready / total', () => {
    const hero = buildPaymentStatementHero(rows(['ready', 'ready', 'needs_review', 'missing_months']))
    expect(hero.totalEmployees).toBe(4)
    expect(hero.readyCount).toBe(2)
    expect(hero.attentionCount).toBe(2)
    expect(hero.readinessPercent).toBe(50)
  })
})
