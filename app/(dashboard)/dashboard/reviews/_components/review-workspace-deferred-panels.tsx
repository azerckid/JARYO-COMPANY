import { getOrCreateFiscalYearLedgerSummary } from '@/lib/bookkeeping/fiscal-year-ledger'
import { listAccumulatedJournalVouchers, toJournalEntryExportLines } from '@/lib/bookkeeping/fiscal-year-ledger-journal-view'
import { resolveBookkeepingPeriodRangeSnapshot } from '@/lib/bookkeeping/period-range'
import { ReviewJournalEntryPreview } from './review-journal-entry-preview'
import { ReviewWorkspaceDeactivatedLedgerPanel } from './review-workspace-deactivated-ledger-panels'
import { ReviewWorkspaceCollapsibleSection } from './review-workspace-collapsible-section'
import { ReviewWorkspaceDeferredError } from './review-workspace-deferred-error'
import type { ReviewSession } from '@/lib/reviews/review-workspace-types'

async function loadPreviewData(
  tenantId: string,
  selectedSession: ReviewSession | null,
  options: { showJournalEntry: boolean },
) {
  if (!options.showJournalEntry || !selectedSession || selectedSession.workType !== 'bookkeeping') {
    return {
      journalEntryPreviewLines: [] as ReturnType<typeof toJournalEntryExportLines>,
    }
  }

  const range = resolveBookkeepingPeriodRangeSnapshot(selectedSession)
  if (!range) {
    return {
      journalEntryPreviewLines: [] as ReturnType<typeof toJournalEntryExportLines>,
    }
  }

  const fiscalYear = Number(range.start.slice(0, 4))
  const ledgerSummary = await getOrCreateFiscalYearLedgerSummary({
    tenantId,
    clientId: selectedSession.clientId,
    fiscalYear,
  })

  if (!ledgerSummary) {
    return {
      journalEntryPreviewLines: [] as ReturnType<typeof toJournalEntryExportLines>,
    }
  }

  const journalResult = options.showJournalEntry
    ? await listAccumulatedJournalVouchers({ tenantId, ledgerId: ledgerSummary.ledger.id, period: range.label })
    : null

  return {
    journalEntryPreviewLines: journalResult?.ok
      ? toJournalEntryExportLines(journalResult.vouchers.filter((item) => !item.stale))
      : ([] as ReturnType<typeof toJournalEntryExportLines>),
  }
}

export async function ReviewWorkspaceDeferredPreviews({
  tenantId,
  selectedSession,
  refreshHref,
  showJournalEntry = true,
}: {
  tenantId: string
  selectedSession: ReviewSession | null
  refreshHref: string
  showJournalEntry?: boolean
}) {
  let journalEntryPreviewLines: ReturnType<typeof toJournalEntryExportLines>

  try {
    const previewData = await loadPreviewData(tenantId, selectedSession, {
      showJournalEntry,
    })
    journalEntryPreviewLines = previewData.journalEntryPreviewLines
  } catch {
    return <ReviewWorkspaceDeferredError section="previews" refreshHref={refreshHref} />
  }

  return (
    <>
      {showJournalEntry ? (
        <ReviewWorkspaceCollapsibleSection
          title="전표분개 미리보기"
          description="선택한 요청의 기간이 걸치는 달에 대해 fiscal-year ledger에 누적된 전표분개 초안을 확인합니다."
          defaultOpen
          badge={{
            label: `${journalEntryPreviewLines.length}줄`,
            variant: journalEntryPreviewLines.length > 0 ? 'success' : 'secondary',
          }}
        >
          <div className="p-4 pt-3">
            <ReviewJournalEntryPreview lines={journalEntryPreviewLines} />
          </div>
        </ReviewWorkspaceCollapsibleSection>
      ) : (
        <ReviewWorkspaceDeactivatedLedgerPanel title="전표분개 미리보기" />
      )}
    </>
  )
}
