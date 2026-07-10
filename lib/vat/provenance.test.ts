import { describe, expect, it } from 'vitest'
import {
  buildVatConfirmedLedgerSnapshot,
  storedSummaryMatchesSnapshot,
  VAT_PROVENANCE_VERSION,
  type VatDeductionProvenanceRow,
  type VatFactClassificationRow,
} from './provenance'

function factRow(overrides: Partial<VatFactClassificationRow> = {}): VatFactClassificationRow {
  return {
    id: 'row-1',
    classificationRunId: 'run-1',
    uploadSessionId: 'session-1',
    sourceType: 'tax_invoice',
    transactionDate: '2026-03-10',
    amountKrw: 110000,
    status: 'confirmed',
    vatDirection: 'sale',
    vatTaxType: 'taxable',
    vatSupplyAmountKrw: 100000,
    vatTaxAmountKrw: 10000,
    vatGrossAmountKrw: 110000,
    vatFactSource: 'parser',
    vatFactSourceRef: 'file-1:Sheet1:2',
    vatFactStatus: 'derived',
    ...overrides,
  }
}

function deductionReview(overrides: Partial<VatDeductionProvenanceRow> = {}): VatDeductionProvenanceRow {
  return {
    id: 'review-1',
    classificationRowId: 'purchase-1',
    supplyAmountKrw: 80000,
    inputTaxKrw: 8000,
    decision: 'deductible',
    prorationRateBps: null,
    confirmedByStaffId: 'staff-1',
    confirmedAt: '2026-07-10T10:00:00+09:00',
    ...overrides,
  }
}

function build(rows: VatFactClassificationRow[], reviews: VatDeductionProvenanceRow[] = []) {
  return buildVatConfirmedLedgerSnapshot({
    tenantId: 'tenant-1',
    clientId: 'client-1',
    periodKey: '2026-H1',
    periodStartMonth: '2026-01',
    periodEndMonth: '2026-06',
    rows,
    deductionReviews: reviews,
  })
}

describe('VAT confirmed-ledger deterministic rebuild', () => {
  it('aggregates taxable, zero-rated, exempt, output, input, and deduction values', () => {
    const rows = [
      factRow(),
      factRow({
        id: 'sale-zero',
        vatTaxType: 'zero_rated',
        vatSupplyAmountKrw: 200000,
        vatTaxAmountKrw: 0,
        vatGrossAmountKrw: 200000,
        amountKrw: 200000,
      }),
      factRow({
        id: 'sale-exempt',
        vatTaxType: 'exempt',
        vatSupplyAmountKrw: 50000,
        vatTaxAmountKrw: 0,
        vatGrossAmountKrw: 50000,
        amountKrw: 50000,
      }),
      factRow({
        id: 'purchase-1',
        vatDirection: 'purchase',
        vatSupplyAmountKrw: 80000,
        vatTaxAmountKrw: 8000,
        vatGrossAmountKrw: 88000,
        amountKrw: 88000,
      }),
      factRow({
        id: 'purchase-2',
        vatDirection: 'purchase',
        vatSupplyAmountKrw: 20000,
        vatTaxAmountKrw: 2000,
        vatGrossAmountKrw: 22000,
        amountKrw: 22000,
      }),
      factRow({
        id: 'bank-payment',
        sourceType: 'bank',
        vatDirection: null,
        vatTaxType: null,
        vatSupplyAmountKrw: null,
        vatTaxAmountKrw: null,
        vatGrossAmountKrw: null,
        vatFactSource: null,
        vatFactSourceRef: null,
        vatFactStatus: null,
      }),
    ]
    const result = build(rows, [
      deductionReview(),
      deductionReview({
        id: 'review-2',
        classificationRowId: 'purchase-2',
        supplyAmountKrw: 20000,
        inputTaxKrw: 2000,
        decision: 'non_deductible',
      }),
    ])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.snapshot).toMatchObject({
      provenanceVersion: VAT_PROVENANCE_VERSION,
      sourceRowCount: 5,
      totals: {
        taxableSupplyKrw: 100000,
        taxableOutputTaxKrw: 10000,
        zeroRatedSupplyKrw: 200000,
        exemptSupplyKrw: 50000,
        outputTaxKrw: 10000,
        inputTaxKrw: 10000,
        inputTaxDeductibleKrw: 8000,
        payableTaxKrw: 2000,
      },
    })
  })

  it('is deterministic regardless of source and review ordering', () => {
    const rows = [
      factRow(),
      factRow({
        id: 'purchase-1',
        vatDirection: 'purchase',
        vatSupplyAmountKrw: 80000,
        vatTaxAmountKrw: 8000,
        vatGrossAmountKrw: 88000,
        amountKrw: 88000,
      }),
    ]
    const forward = build(rows, [deductionReview()])
    const reversed = build([...rows].reverse(), [deductionReview()])

    expect(forward.ok).toBe(true)
    expect(reversed.ok).toBe(true)
    if (forward.ok && reversed.ok) {
      expect(forward.snapshot.sourceFingerprint).toBe(reversed.snapshot.sourceFingerprint)
    }
  })

  it('applies a confirmed proration rate to deductible input tax', () => {
    const result = build([
      factRow({
        id: 'purchase-1',
        vatDirection: 'purchase',
        vatSupplyAmountKrw: 80000,
        vatTaxAmountKrw: 8000,
        vatGrossAmountKrw: 88000,
        amountKrw: 88000,
      }),
    ], [deductionReview({ decision: 'prorated', prorationRateBps: 5000 })])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.snapshot.totals).toMatchObject({
        inputTaxKrw: 8000,
        inputTaxDeductibleKrw: 4000,
        payableTaxKrw: -4000,
      })
    }
  })

  it('changes the fingerprint when a confirmed source value changes', () => {
    const first = build([factRow()])
    const changed = build([factRow({
      vatSupplyAmountKrw: 200000,
      vatTaxAmountKrw: 20000,
      vatGrossAmountKrw: 220000,
      amountKrw: 220000,
    })])

    expect(first.ok).toBe(true)
    expect(changed.ok).toBe(true)
    if (first.ok && changed.ok) {
      expect(first.snapshot.sourceFingerprint).not.toBe(changed.snapshot.sourceFingerprint)
    }
  })

  it('changes the fingerprint when a confirmed deduction decision changes', () => {
    const purchase = factRow({
      id: 'purchase-1',
      vatDirection: 'purchase',
      vatSupplyAmountKrw: 80000,
      vatTaxAmountKrw: 8000,
      vatGrossAmountKrw: 88000,
      amountKrw: 88000,
    })
    const deductible = build([purchase], [deductionReview()])
    const nonDeductible = build([purchase], [deductionReview({ decision: 'non_deductible' })])

    expect(deductible.ok).toBe(true)
    expect(nonDeductible.ok).toBe(true)
    if (deductible.ok && nonDeductible.ok) {
      expect(deductible.snapshot.sourceFingerprint)
        .not.toBe(nonDeductible.snapshot.sourceFingerprint)
    }
  })

  it('rejects unconfirmed and unresolved evidence rows but omits excluded/out-of-period rows', () => {
    const result = build([
      factRow({ id: 'unconfirmed', status: 'suggested' }),
      factRow({ id: 'unresolved', vatFactStatus: 'needs_review', vatSupplyAmountKrw: null, vatTaxAmountKrw: null, vatGrossAmountKrw: null }),
      factRow({ id: 'excluded', status: 'excluded', vatFactStatus: 'excluded' }),
      factRow({ id: 'outside', transactionDate: '2025-12-31' }),
    ])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.map((item) => item.code)).toEqual([
        'classification_not_confirmed',
        'vat_fact_unresolved',
      ])
    }
  })

  it('rejects missing dates and inconsistent VAT arithmetic', () => {
    const result = build([
      factRow({ id: 'missing-date', transactionDate: null }),
      factRow({ id: 'bad-arithmetic', vatTaxAmountKrw: 9000 }),
    ])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.map((item) => item.code)).toEqual([
        'classification_date_missing',
        'vat_fact_inconsistent',
      ])
    }
  })

  it('requires each deduction review to link to one confirmed same-scope purchase fact', () => {
    const purchase = factRow({
      id: 'purchase-1',
      vatDirection: 'purchase',
      vatSupplyAmountKrw: 80000,
      vatTaxAmountKrw: 8000,
      vatGrossAmountKrw: 88000,
      amountKrw: 88000,
    })
    const pendingPurchase = factRow({
      id: 'purchase-2',
      vatDirection: 'purchase',
      vatSupplyAmountKrw: 60000,
      vatTaxAmountKrw: 6000,
      vatGrossAmountKrw: 66000,
      amountKrw: 66000,
    })
    const mismatchedPurchase = factRow({
      id: 'purchase-3',
      vatDirection: 'purchase',
      vatSupplyAmountKrw: 40000,
      vatTaxAmountKrw: 4000,
      vatGrossAmountKrw: 44000,
      amountKrw: 44000,
    })
    const cases = [
      deductionReview({ id: 'unlinked', classificationRowId: null }),
      deductionReview({
        id: 'pending',
        classificationRowId: 'purchase-2',
        supplyAmountKrw: 60000,
        inputTaxKrw: 6000,
        decision: 'pending',
        confirmedByStaffId: null,
        confirmedAt: null,
      }),
      deductionReview({
        id: 'mismatch',
        classificationRowId: 'purchase-3',
        supplyAmountKrw: 30000,
        inputTaxKrw: 4000,
      }),
      deductionReview({ id: 'valid' }),
      deductionReview({ id: 'duplicate' }),
    ]
    const result = build([purchase, pendingPurchase, mismatchedPurchase], cases)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.map((item) => item.code)).toEqual([
        'deduction_review_unlinked',
        'deduction_review_pending',
        'deduction_review_mismatch',
        'deduction_review_duplicate',
      ])
    }
  })

  it('verifies every stored summary value and fingerprint together', () => {
    const result = build([factRow()])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const summary = {
      id: 'summary-1',
      periodStartMonth: result.snapshot.periodStartMonth,
      periodEndMonth: result.snapshot.periodEndMonth,
      ...result.snapshot.totals,
      provenanceVersion: result.snapshot.provenanceVersion,
      sourceFingerprint: result.snapshot.sourceFingerprint,
      sourceRowCount: result.snapshot.sourceRowCount,
    }

    expect(storedSummaryMatchesSnapshot(summary, result.snapshot)).toBe(true)
    expect(storedSummaryMatchesSnapshot({ ...summary, outputTaxKrw: 999 }, result.snapshot)).toBe(false)
  })
})
