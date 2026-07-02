import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import {
  buildPayrollCloseAction,
  buildPayrollDeductionBreakdown,
  buildPayrollIssueAlert,
  buildPayrollRegisterRow,
  buildPayrollSummaryTotals,
  maskEmployeeName,
  resolvePayrollPeriod,
  type PayrollRegisterRow,
} from './summary'

function line(overrides: Partial<Parameters<typeof buildPayrollRegisterRow>[0]> = {}) {
  return buildPayrollRegisterRow({
    id: 'line-1',
    employeeCode: 'E-001',
    employeeName: '김민서',
    department: '경영지원',
    jobTitle: '매니저',
    jobType: '정규직',
    baseSalaryKrw: 3_000_000,
    allowanceKrw: 200_000,
    incomeTaxKrw: 120_000,
    localIncomeTaxKrw: 12_000,
    nationalPensionKrw: 140_000,
    healthInsuranceKrw: 110_000,
    longTermCareKrw: 14_000,
    employmentInsuranceKrw: 32_000,
    otherDeductionKrw: 0,
    noticeMatchStatus: 'matched',
    status: 'ready',
    issueCode: null,
    issueMessage: null,
    ...overrides,
  })
}

describe('payroll period resolution', () => {
  it('uses YYYY-MM period keys and Korean payroll labels (S-10)', () => {
    expect(resolvePayrollPeriod({
      periodKey: '2026-06',
      today: DateTime.fromISO('2026-07-02T00:00:00', { zone: 'Asia/Seoul' }),
      paymentDate: '2026-06-25',
    })).toEqual({
      key: '2026-06',
      payrollMonth: '2026-06',
      paymentDate: '2026-06-25',
      label: '2026년 6월 급여',
    })
  })

  it('falls back to the current month when the query period is invalid', () => {
    expect(resolvePayrollPeriod({
      periodKey: '2026-H1',
      today: DateTime.fromISO('2026-07-02T00:00:00', { zone: 'Asia/Seoul' }),
    }).key).toBe('2026-07')
  })
})

describe('payroll register derivation', () => {
  it('derives row amounts instead of trusting stored totals (S-20, S-21)', () => {
    expect(line({
      baseSalaryKrw: 4_000_000,
      allowanceKrw: 300_000,
      incomeTaxKrw: 200_000,
      localIncomeTaxKrw: 20_000,
      nationalPensionKrw: 180_000,
      healthInsuranceKrw: 150_000,
      longTermCareKrw: 18_000,
      employmentInsuranceKrw: 36_000,
      otherDeductionKrw: 10_000,
    })).toMatchObject({
      grossPayKrw: 4_300_000,
      withholdingTaxKrw: 220_000,
      socialInsuranceKrw: 384_000,
      deductionTotalKrw: 614_000,
      netPayKrw: 3_686_000,
    })
  })

  it('reproduces the approved preview totals from employee lines (S-03, S-20~23)', () => {
    const rows: PayrollRegisterRow[] = [
      line({
        id: 'line-kim',
        employeeName: '김민서',
        baseSalaryKrw: 5_400_000,
        allowanceKrw: 400_000,
        incomeTaxKrw: 450_000,
        localIncomeTaxKrw: 45_000,
        nationalPensionKrw: 260_000,
        healthInsuranceKrw: 210_000,
        longTermCareKrw: 27_000,
        employmentInsuranceKrw: 53_000,
        status: 'ready',
      }),
      line({
        id: 'line-lee',
        employeeName: '이서준',
        baseSalaryKrw: 4_500_000,
        allowanceKrw: 200_000,
        incomeTaxKrw: 310_000,
        localIncomeTaxKrw: 31_000,
        nationalPensionKrw: 210_000,
        healthInsuranceKrw: 170_000,
        longTermCareKrw: 22_000,
        employmentInsuranceKrw: 42_000,
        status: 'ready',
      }),
      line({
        id: 'line-park',
        employeeName: '박하준',
        baseSalaryKrw: 9_000_000,
        allowanceKrw: 500_000,
        incomeTaxKrw: 1_150_000,
        localIncomeTaxKrw: 114_000,
        nationalPensionKrw: 420_000,
        healthInsuranceKrw: 360_000,
        longTermCareKrw: 46_000,
        employmentInsuranceKrw: 82_000,
        status: 'needs_review',
        issueCode: 'insurance_notice_missing',
        issueMessage: '신규 입사자 4대보험 취득일 확인 필요',
      }),
      line({
        id: 'line-rest',
        employeeName: '최민준 외 8명',
        baseSalaryKrw: 22_400_000,
        allowanceKrw: 200_000,
        incomeTaxKrw: 0,
        localIncomeTaxKrw: 0,
        nationalPensionKrw: 880_000,
        healthInsuranceKrw: 700_000,
        longTermCareKrw: 90_000,
        employmentInsuranceKrw: 168_000,
        status: 'ready',
      }),
    ]

    expect(buildPayrollSummaryTotals(rows)).toMatchObject({
      employeeCount: 4,
      grossPayKrw: 42_600_000,
      withholdingTaxKrw: 2_100_000,
      socialInsuranceKrw: 3_740_000,
      deductionTotalKrw: 5_840_000,
      netPayKrw: 36_760_000,
      issueCount: 1,
    })
  })
})

describe('insurance notice priority and close guard', () => {
  it('marks social insurance breakdown as notice-backed when any employee line is matched (S-35~37)', () => {
    const breakdown = buildPayrollDeductionBreakdown([
      line({ id: 'matched', noticeMatchStatus: 'matched' }),
      line({ id: 'missing', noticeMatchStatus: 'missing_notice' }),
    ])

    expect(breakdown.find((item) => item.id === 'health_insurance')).toMatchObject({
      source: 'notice',
      amountKrw: 220_000,
    })
    expect(breakdown.find((item) => item.id === 'income_tax')).toMatchObject({
      source: 'calculated',
    })
  })

  it('keeps payroll close locked while any employee needs review (S-50, S-70)', () => {
    const rows = [
      line({ id: 'ready', status: 'ready' }),
      line({ id: 'issue', status: 'needs_review', issueMessage: '건강보험 고지액 매칭 필요' }),
    ]
    const totals = buildPayrollSummaryTotals(rows)

    expect(buildPayrollIssueAlert(rows)).toEqual({
      visible: true,
      title: '김민서 확인 필요',
      description: '건강보험 고지액 매칭 필요',
      targetEmployeeLineId: 'issue',
    })
    expect(buildPayrollCloseAction(totals)).toEqual({
      locked: true,
      lockReason: '확인 필요 1건 처리 후 활성화',
      canClose: false,
    })
  })

  it('allows close only when the period is open and issue count is zero', () => {
    expect(buildPayrollCloseAction({
      employeeCount: 12,
      grossPayKrw: 42_600_000,
      withholdingTaxKrw: 2_100_000,
      socialInsuranceKrw: 3_740_000,
      deductionTotalKrw: 5_840_000,
      netPayKrw: 36_760_000,
      issueCount: 0,
      closeStatus: 'open',
    })).toEqual({ locked: false, lockReason: null, canClose: true })

    expect(buildPayrollCloseAction({
      employeeCount: 12,
      grossPayKrw: 42_600_000,
      withholdingTaxKrw: 2_100_000,
      socialInsuranceKrw: 3_740_000,
      deductionTotalKrw: 5_840_000,
      netPayKrw: 36_760_000,
      issueCount: 0,
      closeStatus: 'closed',
    })).toEqual({ locked: true, lockReason: '이미 마감된 급여입니다', canClose: false })
  })
})

describe('payroll privacy helpers', () => {
  it('masks employee names when the viewer lacks payroll PII permission (S-40)', () => {
    expect(maskEmployeeName('김민서', false)).toBe('김**')
    expect(maskEmployeeName('오', false)).toBe('*')
    expect(maskEmployeeName('김민서', true)).toBe('김민서')
  })
})
