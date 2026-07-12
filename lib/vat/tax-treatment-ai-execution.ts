import type { VatTaxTreatmentAiRunner } from './tax-treatment-ai'
import {
  VAT_TAX_TREATMENT_AI_BATCH_SIZE,
  enhanceVatTaxTreatmentRowsWithAi,
  withVatTaxTreatmentAiManualFallback,
} from './tax-treatment-ai'
import {
  completeVatTaxTreatmentAiResult,
  reserveVatTaxTreatmentAiResult,
  startVatTaxTreatmentAiResult,
  type VatTaxTreatmentAiDatabase,
} from './tax-treatment-ai-result'
import type { VatTaxTreatmentDisplayRow } from '@/lib/validations/vat-tax-treatment'

export type VatTaxTreatmentAiExecutionAction =
  | { action: 'evaluate_missing' }
  | { action: 'reevaluate_row'; rowId: string }

export async function executeVatTaxTreatmentAiRows(params: {
  rows: VatTaxTreatmentDisplayRow[]
  action: VatTaxTreatmentAiExecutionAction
  database?: VatTaxTreatmentAiDatabase
  runner?: VatTaxTreatmentAiRunner
}) {
  const requestedRowId = params.action.action === 'reevaluate_row' ? params.action.rowId : null
  const candidates = requestedRowId
    ? params.rows.filter((row) => (
      row.rowId === requestedRowId
      && row.aiWorkflow?.canEvaluate === true
    ))
    : params.rows.filter((row) => (
      row.aiWorkflow?.canEvaluate === true
      && (row.aiWorkflow.status === 'idle' || row.aiWorkflow.status === 'stale')
    ))
  const selected = candidates.slice(0, VAT_TAX_TREATMENT_AI_BATCH_SIZE)

  const reservations = await Promise.all(selected.map(async (row) => ({
    row,
    reservation: await reserveVatTaxTreatmentAiResult({
      row,
      force: params.action.action === 'reevaluate_row',
      database: params.database,
    }),
  })))
  const owners = []
  for (const entry of reservations) {
    if (
      !entry.reservation.shouldRun
      || !entry.reservation.resultId
      || !entry.reservation.executionToken
    ) continue
    const started = await startVatTaxTreatmentAiResult({
      resultId: entry.reservation.resultId,
      executionToken: entry.reservation.executionToken,
      database: params.database,
    })
    if (started) owners.push(entry)
  }

  if (owners.length === 0) return { attemptedCount: selected.length, completedCount: 0 }

  let results: VatTaxTreatmentDisplayRow[]
  try {
    results = await enhanceVatTaxTreatmentRowsWithAi({
      rows: owners.map((entry) => entry.row),
      runner: params.runner,
    })
  } catch {
    results = owners.map((entry) => withVatTaxTreatmentAiManualFallback(entry.row))
  }
  const resultByRowId = new Map(results.map((row) => [row.rowId, row]))

  let completedCount = 0
  for (const entry of owners) {
    const result = resultByRowId.get(entry.row.rowId)
      ?? withVatTaxTreatmentAiManualFallback(entry.row)
    const completed = await completeVatTaxTreatmentAiResult({
      resultId: entry.reservation.resultId!,
      executionToken: entry.reservation.executionToken!,
      inputFingerprint: entry.row.recommendationFingerprint,
      result,
      database: params.database,
    })
    if (completed) completedCount += 1
  }

  return { attemptedCount: selected.length, completedCount }
}
