import { describe, expect, it } from 'vitest'
import type { ReconciliationLedgerRow } from './reconciliation-display-model'
import { RECONCILIATION_LEDGER_DISPLAY_FIXTURE } from './reconciliation-display-fixture'
import {
  applyReconciliationDuplicateReviews,
  buildReconciliationDuplicateReviews,
  DUPLICATE_REVIEW_MEMO,
  formatDistinctDuplicateReviewMemo,
} from './reconciliation-duplicate-review'

function row(id: string, overrides: Partial<ReconciliationLedgerRow> = {}): ReconciliationLedgerRow {
  return {
    ...RECONCILIATION_LEDGER_DISPLAY_FIXTURE.rows[0]!,
    id,
    source: 'card',
    direction: 'expense',
    transactionDate: '2026-06-10',
    amountKrw: 231_089,
    counterparty: '오피스 디포 코리아',
    description: '사무 용품',
    evidenceActionState: 'candidate',
    explanationMemo: null,
    duplicateReview: null,
    ...overrides,
  }
}

describe('reconciliation duplicate review', () => {
  it('flags only exact same-source/date/amount/counterparty/description groups', () => {
    const rows = [
      row('a'),
      row('b', { counterparty: '오피스디포코리아', description: '사무용품' }),
      row('different-amount', { amountKrw: 231_090 }),
      row('different-source', { source: 'bank' }),
    ]
    const reviews = buildReconciliationDuplicateReviews(rows)
    expect([...reviews.keys()].sort()).toEqual(['a', 'b'])
    expect(reviews.get('a')?.matchedRowIds).toEqual(['b'])
  })

  it('does not flag excluded, previously reviewed, or incomplete rows', () => {
    const reviews = buildReconciliationDuplicateReviews([
      row('base'),
      row('excluded', { evidenceActionState: 'excluded' }),
      row('reviewed', { explanationMemo: DUPLICATE_REVIEW_MEMO }),
      row('missing-counterparty', { counterparty: null }),
    ])
    expect(reviews.size).toBe(0)
  })

  it('adds a blocker and duplicate action without replacing the underlying row data', () => {
    const [first] = applyReconciliationDuplicateReviews([row('a'), row('b')])
    expect(first?.matchState).toBe('duplicate_candidate')
    expect(first?.rowConclusion.primaryAction).toBe('review_duplicate')
    expect(first?.actions.canReviewDuplicate).toBe(true)
    expect(first?.blockers.some((blocker) => blocker.code === 'duplicate_review_required')).toBe(true)
  })

  it('preserves an existing memo and appends the distinct-transaction audit marker once', () => {
    expect(formatDistinctDuplicateReviewMemo('업무용 사무용품')).toBe(`업무용 사무용품\n${DUPLICATE_REVIEW_MEMO}`)
    expect(formatDistinctDuplicateReviewMemo(DUPLICATE_REVIEW_MEMO)).toBe(DUPLICATE_REVIEW_MEMO)
  })
})
