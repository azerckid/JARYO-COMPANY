import {
  parseReconciliationLedgerDisplayModel,
  type ReconciliationLedgerDisplayModel,
} from './reconciliation-display-model'
import { RECONCILIATION_LEDGER_DISPLAY_FIXTURE } from './reconciliation-display-fixture'
import { buildLiveReconciliationLedgerDisplayModel } from './reconciliation-live-display-model'
import { loadBookkeepingReviewSummary } from './summary'

export type ReconciliationDisplayLoadMode = 'fixture' | 'live'

export function loadReconciliationLedgerDisplayFixture(): ReconciliationLedgerDisplayModel {
  return parseReconciliationLedgerDisplayModel(RECONCILIATION_LEDGER_DISPLAY_FIXTURE)
}

export function isReconciliationDisplayFixtureMode(display: string | undefined): boolean {
  return display === 'fixture'
}

export async function loadReconciliationLedgerDisplayModel(input: {
  mode: ReconciliationDisplayLoadMode
  tenantId?: string
  periodKey?: string
}): Promise<ReconciliationLedgerDisplayModel> {
  if (input.mode === 'fixture') {
    return loadReconciliationLedgerDisplayFixture()
  }

  if (!input.tenantId) {
    throw new Error('tenantId is required to load a live ReconciliationLedgerDisplayModel')
  }

  const summary = await loadBookkeepingReviewSummary({
    tenantId: input.tenantId,
    periodKey: input.periodKey,
    tab: 'all',
  })

  return buildLiveReconciliationLedgerDisplayModel(summary)
}
