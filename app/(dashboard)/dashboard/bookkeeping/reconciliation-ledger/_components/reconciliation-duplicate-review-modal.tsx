'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ReconciliationLedgerRow } from '@/lib/bookkeeping-review/reconciliation-display-model'
import {
  duplicateExclusionReason,
  formatDistinctDuplicateReviewMemo,
} from '@/lib/bookkeeping-review/reconciliation-duplicate-review'
import { formatExclusionReasonMemo, formatKrwAmount } from '@/lib/bookkeeping-review/reconciliation-row-actions'
import {
  confirmReconciliationRowAsDistinct,
  saveReconciliationRowExclusion,
  type ReconciliationRowPreviousState,
} from '@/lib/bookkeeping-review/reconciliation-row-mutations'
import { cn } from '@/lib/utils'
import { showUndoableSuccessToast } from './reconciliation-ledger-fixture-interactions'

type ReconciliationDuplicateReviewModalProps = {
  readonly allRows: ReconciliationLedgerRow[]
  readonly isFixtureMode: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly open: boolean
  readonly row: ReconciliationLedgerRow | null
}

export function ReconciliationDuplicateReviewModal({
  allRows,
  isFixtureMode,
  onOpenChange,
  open,
  row,
}: ReconciliationDuplicateReviewModalProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const matchedRows = row?.duplicateReview?.matchedRowIds
    .map((rowId) => allRows.find((candidate) => candidate.id === rowId))
    .filter((candidate): candidate is ReconciliationLedgerRow => candidate !== undefined) ?? []
  const actionDisabled = isFixtureMode || isPending

  function finish(message: string, previous: ReconciliationRowPreviousState | null) {
    if (!row) return
    showUndoableSuccessToast({
      message,
      uploadSessionId: row.uploadSessionId,
      rowId: row.id,
      previous,
      router,
    })
    onOpenChange(false)
    router.refresh()
  }

  function confirmDistinct() {
    if (!row) return
    startTransition(async () => {
      const result = await confirmReconciliationRowAsDistinct({
        uploadSessionId: row.uploadSessionId,
        rowId: row.id,
        memo: formatDistinctDuplicateReviewMemo(row.explanationMemo),
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      finish('별도 거래로 확인했습니다.', result.previous)
    })
  }

  function excludeDuplicate() {
    if (!row) return
    startTransition(async () => {
      const result = await saveReconciliationRowExclusion({
        uploadSessionId: row.uploadSessionId,
        rowId: row.id,
        memo: formatExclusionReasonMemo(duplicateExclusionReason()),
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      finish('현재 거래를 중복으로 제외했습니다.', result.previous)
    })
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex w-full max-w-xl flex-col gap-0 overflow-hidden border-company-border bg-company-surface p-0 sm:max-w-xl">
        {row ? (
          <>
            <DialogHeader className="border-b border-company-border px-5 py-4 pr-12">
              <DialogTitle className="text-base font-semibold text-foreground">중복 거래 확인</DialogTitle>
              <DialogDescription className="text-[13px] text-company-fg-muted">
                자동 제외하지 않습니다. 같은 거래를 비교한 뒤 현재 행의 처리만 선택하세요.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 px-5 py-4">
              {[row, ...matchedRows].map((candidate, index) => (
                <div
                  key={candidate.id}
                  className={cn(
                    'grid grid-cols-[92px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border px-3 py-2.5 text-[12px]',
                    index === 0
                      ? 'border-[#fcd34d] bg-[#fffbeb]'
                      : 'border-company-border bg-[#fcfcfd]',
                  )}
                >
                  <div>
                    <p className="font-semibold text-foreground">{index === 0 ? '현재 거래' : '비교 거래'}</p>
                    <p className="mt-0.5 font-mono text-company-fg-subtle">{candidate.transactionDate ?? '-'}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{candidate.counterparty ?? '거래처 미정'}</p>
                    <p className="mt-0.5 truncate text-company-fg-muted">{candidate.description}</p>
                  </div>
                  <p className="font-mono font-semibold text-foreground">{formatKrwAmount(candidate.amountKrw)}</p>
                </div>
              ))}
              <p className="text-[11.5px] text-company-fg-subtle">
                별도 거래로 확인하면 기존 메모를 보존한 채 확인 이력이 추가됩니다.
              </p>
            </div>
            <DialogFooter className="border-t border-company-border bg-[#fcfcfd] px-5 py-3 sm:justify-between">
              <button
                className="rounded-lg border border-company-border px-3 py-2 text-[12px] font-semibold text-company-fg-muted"
                onClick={() => onOpenChange(false)}
                type="button"
              >
                취소
              </button>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className={cn(
                    'rounded-lg border px-3 py-2 text-[12px] font-semibold',
                    actionDisabled
                      ? 'cursor-not-allowed border-company-border bg-company-nav-hover text-company-fg-subtle'
                      : 'border-[#fecaca] bg-company-surface text-[#dc2626] hover:bg-[#fff7f7]',
                  )}
                  disabled={actionDisabled}
                  onClick={excludeDuplicate}
                  type="button"
                >
                  현재 거래를 중복 제외
                </button>
                <button
                  className={cn(
                    'rounded-lg border px-3 py-2 text-[12px] font-semibold',
                    actionDisabled
                      ? 'cursor-not-allowed border-company-border bg-company-nav-hover text-company-fg-subtle'
                      : 'border-foreground bg-foreground text-white hover:opacity-90',
                  )}
                  disabled={actionDisabled}
                  onClick={confirmDistinct}
                  type="button"
                >
                  별도 거래로 확인
                </button>
              </div>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
