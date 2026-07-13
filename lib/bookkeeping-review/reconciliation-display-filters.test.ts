import { describe, expect, it } from 'vitest'
import {
  filterReconciliationDisplayRows,
  normalizeReconciliationDisplayFilter,
  reconciliationDisplayFilterHref,
  searchReconciliationDisplayRows,
} from './reconciliation-display-filters'
import { RECONCILIATION_LEDGER_DISPLAY_FIXTURE } from './reconciliation-display-fixture'

describe('reconciliation display filters', () => {
  const rows = RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows

  it('normalizes fixture tab query values', () => {
    expect(normalizeReconciliationDisplayFilter('evidence_required')).toBe('evidence_required')
    expect(normalizeReconciliationDisplayFilter('missing_evidence')).toBe('all')
  })

  it('filters evidence and explanation action states', () => {
    expect(filterReconciliationDisplayRows(rows, 'evidence_required').every((row) => row.evidenceActionState === 'evidence_required')).toBe(true)
    expect(filterReconciliationDisplayRows(rows, 'explanation_required').length).toBeGreaterThan(0)
  })

  it('keeps duplicate tab count aligned with duplicate rows', () => {
    const filtered = filterReconciliationDisplayRows(rows, 'duplicate_review')
    expect(filtered).toHaveLength(2)
    expect(filtered.every((row) => row.duplicateReview != null)).toBe(true)
  })

  it('builds default route href without fixture query', () => {
    expect(reconciliationDisplayFilterHref('all')).toBe('/dashboard/bookkeeping/reconciliation-ledger')
    expect(reconciliationDisplayFilterHref('evidence_required')).toBe('/dashboard/bookkeeping/reconciliation-ledger?source=evidence_required')
    expect(reconciliationDisplayFilterHref('duplicate_review', { period: '2026-H1', display: 'fixture' }))
      .toBe('/dashboard/bookkeeping/reconciliation-ledger?source=duplicate_review&period=2026-H1&display=fixture')
  })

  it('searches counterparty, amount, description, date, and account after normalizing spaces and commas', () => {
    expect(searchReconciliationDisplayRows(rows, '오피스 디포').length).toBeGreaterThan(2)
    const amountMatches = searchReconciliationDisplayRows(rows, '231,089')
    expect(amountMatches.some((row) => row.id === 'preview-duplicate-office-01')).toBe(true)
    expect(amountMatches.every((row) => row.amountKrw === 231_089)).toBe(true)
    expect(searchReconciliationDisplayRows(rows, '사무용품').length).toBeGreaterThan(2)
    expect(searchReconciliationDisplayRows(rows, '2026-06-10').length).toBeGreaterThan(0)
    expect(searchReconciliationDisplayRows(rows, '소모품비').length).toBeGreaterThan(0)
  })

  it('filters cash_receipt tab across cash_receipt and receipt sources', () => {
    const filtered = filterReconciliationDisplayRows(rows, 'cash_receipt')
    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every((row) => row.source === 'cash_receipt' || row.source === 'receipt')).toBe(true)
  })

  it('sorts filtered rows by transaction date descending', () => {
    const cardRows = filterReconciliationDisplayRows(rows, 'card')
    const dates = cardRows.map((row) => row.transactionDate)
    const sortedDates = [...dates].sort((left, right) => (right ?? '').localeCompare(left ?? ''))
    expect(dates).toEqual(sortedDates)
  })
})
