import { describe, expect, it } from 'vitest'
import {
  buildVatConfirmedLedgerSnapshot,
  type VatDeductionProvenanceRow,
  type VatFactClassificationRow,
  type VatProvenanceState,
} from './provenance'
import {
  buildVatHometaxInputSummary,
  vatHometaxInputSummarySchema,
} from './hometax-input-summary'

const period = {
  key: '2026-H1' as const,
  label: '2026년 부가세 1기 확정 신고',
  startMonth: '2026-01',
  endMonth: '2026-06',
}

const verifiedState: VatProvenanceState = {
  status: 'verified',
  isReady: true,
  canRebuild: false,
  issueCount: 0,
  message: '현재 확정 원장 fingerprint가 부가세 요약과 일치합니다.',
}

function fact(overrides: Partial<VatFactClassificationRow> = {}): VatFactClassificationRow {
  return {
    id: 'sale-tax-invoice',
    classificationRunId: 'run-1',
    uploadSessionId: 'session-1',
    sourceType: 'tax_invoice',
    transactionDate: '2026-03-10',
    amountKrw: 110_000,
    status: 'confirmed',
    vatDirection: 'sale',
    vatTaxType: 'taxable',
    vatSupplyAmountKrw: 100_000,
    vatTaxAmountKrw: 10_000,
    vatGrossAmountKrw: 110_000,
    vatFactSource: 'parser',
    vatFactSourceRef: 'file-1:Sheet1:2',
    vatFactStatus: 'derived',
    ...overrides,
  }
}

function review(overrides: Partial<VatDeductionProvenanceRow> = {}): VatDeductionProvenanceRow {
  return {
    id: 'review-1',
    classificationRowId: 'purchase-card',
    supplyAmountKrw: 80_000,
    inputTaxKrw: 8_000,
    decision: 'prorated',
    prorationRateBps: 5_000,
    confirmedByStaffId: 'staff-1',
    confirmedAt: '2026-07-13T09:00:00+09:00',
    ...overrides,
  }
}

function ledger(
  extraRows: VatFactClassificationRow[] = [],
  deductionReviews: VatDeductionProvenanceRow[] = [review()],
) {
  return buildVatConfirmedLedgerSnapshot({
    tenantId: 'tenant-1',
    clientId: 'client-1',
    periodKey: period.key,
    periodStartMonth: period.startMonth,
    periodEndMonth: period.endMonth,
    rows: [
      fact(),
      fact({
        id: 'sale-card',
        sourceType: 'card',
        amountKrw: 55_000,
        vatSupplyAmountKrw: 50_000,
        vatTaxAmountKrw: 5_000,
        vatGrossAmountKrw: 55_000,
      }),
      fact({
        id: 'sale-zero',
        vatTaxType: 'zero_rated',
        amountKrw: 20_000,
        vatSupplyAmountKrw: 20_000,
        vatTaxAmountKrw: 0,
        vatGrossAmountKrw: 20_000,
      }),
      fact({
        id: 'sale-exempt',
        vatTaxType: 'exempt',
        amountKrw: 30_000,
        vatSupplyAmountKrw: 30_000,
        vatTaxAmountKrw: 0,
        vatGrossAmountKrw: 30_000,
      }),
      fact({
        id: 'purchase-card',
        sourceType: 'card',
        vatDirection: 'purchase',
        amountKrw: 88_000,
        vatSupplyAmountKrw: 80_000,
        vatTaxAmountKrw: 8_000,
        vatGrossAmountKrw: 88_000,
      }),
      ...extraRows,
    ],
    deductionReviews,
  })
}

function build(overrides: Partial<Parameters<typeof buildVatHometaxInputSummary>[0]> = {}) {
  return buildVatHometaxInputSummary({
    period,
    business: { id: 'client-1', name: '샘플컴퍼니(주)' },
    hasPeriodSummary: true,
    packageGate: { isReady: true, reasons: [] },
    provenanceState: verifiedState,
    ledgerResult: ledger(),
    ...overrides,
  })
}

describe('VAT Hometax Path 1b summary', () => {
  it('maps validated VAT facts to the approved filing rows', () => {
    const summary = build()

    expect(summary.gate).toMatchObject({ status: 'ready', sourceRowCount: 5 })
    expect(summary.rows.find((row) => row.formLine === '(1)')).toMatchObject({ amountKrw: 100_000, taxKrw: 10_000 })
    expect(summary.rows.find((row) => row.formLine === '(3)')).toMatchObject({ amountKrw: 50_000, taxKrw: 5_000 })
    expect(summary.rows.find((row) => row.formLine === '(9)')).toMatchObject({ amountKrw: 170_000, taxKrw: 15_000 })
    expect(summary.rows.find((row) => row.formLine === '(14)')).toMatchObject({ amountKrw: 80_000, taxKrw: 8_000 })
    expect(summary.rows.find((row) => row.formLine === '(16)')).toMatchObject({ amountKrw: 40_000, taxKrw: 4_000 })
    expect(summary.rows.find((row) => row.formLine === '(17)')).toMatchObject({ amountKrw: 40_000, taxKrw: 4_000 })
    expect(summary.rows.find((row) => row.formLine === '㉰')).toMatchObject({ amountKrw: null, taxKrw: 11_000 })
    expect(summary.rows.find((row) => row.formLine === '(84)')).toMatchObject({ amountKrw: 30_000, taxKrw: 0 })
    expect(summary.rows.find((row) => row.formLine === '(27)')).toMatchObject({
      amountKrw: null,
      taxKrw: null,
      mode: 'hometax_final_check',
    })
  })

  it('does not infer the fixed-asset split from a tax-invoice purchase', () => {
    const purchase = fact({
      id: 'purchase-tax-invoice',
      vatDirection: 'purchase',
      amountKrw: 44_000,
      vatSupplyAmountKrw: 40_000,
      vatTaxAmountKrw: 4_000,
      vatGrossAmountKrw: 44_000,
    })
    const result = ledger([purchase], [
      review(),
      review({
        id: 'review-2',
        classificationRowId: purchase.id,
        supplyAmountKrw: 40_000,
        inputTaxKrw: 4_000,
        decision: 'deductible',
        prorationRateBps: null,
      }),
    ])
    const summary = build({ ledgerResult: result })

    expect(summary.gate.status).toBe('unsupported')
    expect(summary.gate.reasons[0]).toContain('일반매입·고정자산 매입 구분')
    expect(summary.rows).toEqual([])
  })

  it('hides all amounts when an upstream gate is blocked', () => {
    const summary = build({
      packageGate: {
        isReady: false,
        reasons: [{
          code: 'vat_deduction_incomplete',
          count: 1,
          message: '부가세 공제 검토 1건을 완료해야 합니다.',
          targetRoute: '/dashboard/vat?period=2026-H1',
        }],
      },
    })

    expect(summary.gate.status).toBe('blocked')
    expect(summary.rows).toEqual([])
  })

  it('marks a mismatched stored snapshot as stale and hides old values', () => {
    const summary = build({
      provenanceState: {
        status: 'rebuild_required',
        isReady: false,
        canRebuild: true,
        issueCount: 1,
        message: '확정 원장 값으로 부가세 요약을 다시 계산해야 합니다.',
      },
    })

    expect(summary.gate.status).toBe('stale')
    expect(summary.rows).toEqual([])
  })

  it('returns empty when there is no business or period summary', () => {
    const summary = build({ business: null, hasPeriodSummary: false, ledgerResult: null })

    expect(summary.gate.status).toBe('empty')
    expect(summary.rows).toEqual([])
  })

  it('rejects any SemuAgent value placed in final Hometax line 27', () => {
    const summary = build()
    const rows = summary.rows.map((row) => (
      row.formLine === '(27)' ? { ...row, taxKrw: 11_000 } : row
    ))

    expect(vatHometaxInputSummarySchema.safeParse({ ...summary, rows }).success).toBe(false)
  })
})
