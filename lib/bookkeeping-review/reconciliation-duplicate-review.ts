import type {
  ReconciliationDuplicateReview,
  ReconciliationLedgerRow,
} from './reconciliation-display-model'

export const DUPLICATE_REVIEW_MEMO = '중복 검토: 별도 거래로 확인'

function normalizeDuplicateText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase()
}

export function isDistinctDuplicateReviewMemo(memo: string | null | undefined): boolean {
  return memo?.split('\n').some((line) => line.trim() === DUPLICATE_REVIEW_MEMO) ?? false
}

export function formatDistinctDuplicateReviewMemo(memo: string | null | undefined): string {
  const current = memo?.trim() ?? ''
  if (isDistinctDuplicateReviewMemo(current)) return current
  return current ? `${current}\n${DUPLICATE_REVIEW_MEMO}` : DUPLICATE_REVIEW_MEMO
}

export function duplicateExclusionReason(): string {
  return '중복 증빙 - 동일 날짜·금액·거래처·적요'
}

function duplicateKey(row: ReconciliationLedgerRow): string | null {
  if (row.evidenceActionState === 'excluded') return null
  if (isDistinctDuplicateReviewMemo(row.explanationMemo)) return null
  if (!row.transactionDate || row.amountKrw === null) return null

  const counterparty = normalizeDuplicateText(row.counterparty)
  const description = normalizeDuplicateText(row.description)
  if (!counterparty || !description) return null

  return [
    row.source,
    row.direction,
    row.transactionDate.slice(0, 10),
    Math.abs(row.amountKrw),
    counterparty,
    description,
  ].join('|')
}

export function buildReconciliationDuplicateReviews(
  rows: ReconciliationLedgerRow[],
): Map<string, ReconciliationDuplicateReview> {
  const groups = new Map<string, ReconciliationLedgerRow[]>()

  for (const row of rows) {
    const key = duplicateKey(row)
    if (!key) continue
    groups.set(key, [...(groups.get(key) ?? []), row])
  }

  const reviews = new Map<string, ReconciliationDuplicateReview>()
  for (const groupRows of groups.values()) {
    if (groupRows.length < 2) continue
    const basisLabel = `같은 날짜·금액·거래처·적요 ${groupRows.length}건`
    for (const row of groupRows) {
      reviews.set(row.id, {
        matchedRowIds: groupRows.filter((candidate) => candidate.id !== row.id).map((candidate) => candidate.id),
        basisLabel,
      })
    }
  }

  return reviews
}

export function applyReconciliationDuplicateReviews(
  rows: ReconciliationLedgerRow[],
): ReconciliationLedgerRow[] {
  const reviews = buildReconciliationDuplicateReviews(rows)

  return rows.map((row) => {
    const duplicateReview = reviews.get(row.id) ?? null
    if (!duplicateReview) return { ...row, duplicateReview: null }

    return {
      ...row,
      duplicateReview,
      matchState: 'duplicate_candidate' as const,
      rowConclusion: {
        headline: '중복 거래인지 확인이 필요합니다.',
        basisLabel: duplicateReview.basisLabel,
        primaryAction: 'review_duplicate' as const,
        actionEnabled: true,
        disabledReason: null,
      },
      blockers: [
        ...row.blockers.filter((blocker) => blocker.code !== 'duplicate_review_required'),
        { code: 'duplicate_review_required' as const, label: '중복 여부 확인 필요' },
      ],
      actions: { ...row.actions, canReviewDuplicate: true },
    }
  })
}
