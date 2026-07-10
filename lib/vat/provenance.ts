import { createHash } from 'node:crypto'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { pickLatestCompletedRunIdsBySession } from '@/lib/bookkeeping-review/summary'
import { buildCompanyHomePeriod } from '@/lib/company-home/summary'
import {
  bookkeepingClassificationRun,
  bookkeepingTransactionClassification,
  vatDeductionReview,
  vatPeriodSummary,
} from '@/lib/db/schema'
import { resolveActiveSourceBatchSessionIds } from '@/lib/source-batch/scope'
import { now, toDBString } from '@/lib/time'
import { isVatEvidenceSource, parsedVatFactSchema } from './facts'

export const VAT_PROVENANCE_VERSION = 'vat-confirmed-ledger-v1'

export const vatProvenanceIssueCodeSchema = z.enum([
  'classification_date_missing',
  'classification_not_confirmed',
  'vat_fact_unresolved',
  'vat_fact_inconsistent',
  'deduction_review_unlinked',
  'deduction_review_out_of_scope',
  'deduction_review_pending',
  'deduction_review_unconfirmed',
  'deduction_review_duplicate',
  'deduction_review_mismatch',
])

export const vatProvenanceIssueSchema = z.object({
  code: vatProvenanceIssueCodeSchema,
  rowId: z.string().min(1),
  message: z.string().min(1),
})

export const vatConfirmedLedgerTotalsSchema = z.object({
  taxableSupplyKrw: z.number().int().nonnegative(),
  taxableOutputTaxKrw: z.number().int().nonnegative(),
  zeroRatedSupplyKrw: z.number().int().nonnegative(),
  exemptSupplyKrw: z.number().int().nonnegative(),
  outputTaxKrw: z.number().int().nonnegative(),
  inputTaxKrw: z.number().int().nonnegative(),
  inputTaxDeductibleKrw: z.number().int().nonnegative(),
  payableTaxKrw: z.number().int(),
})

export const vatConfirmedLedgerSnapshotSchema = z.object({
  provenanceVersion: z.literal(VAT_PROVENANCE_VERSION),
  tenantId: z.string().min(1),
  clientId: z.string().min(1),
  periodKey: z.string().min(1),
  periodStartMonth: z.string().regex(/^20\d{2}-\d{2}$/),
  periodEndMonth: z.string().regex(/^20\d{2}-\d{2}$/),
  sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  sourceRowCount: z.number().int().nonnegative(),
  totals: vatConfirmedLedgerTotalsSchema,
})

export const vatProvenanceStateSchema = z.object({
  status: z.enum(['verified', 'rebuild_required', 'blocked']),
  isReady: z.boolean(),
  canRebuild: z.boolean(),
  issueCount: z.number().int().nonnegative(),
  message: z.string().min(1),
})

export type VatProvenanceIssue = z.infer<typeof vatProvenanceIssueSchema>
export type VatConfirmedLedgerSnapshot = z.infer<typeof vatConfirmedLedgerSnapshotSchema>
export type VatProvenanceState = z.infer<typeof vatProvenanceStateSchema>

export type VatFactClassificationRow = Pick<
  typeof bookkeepingTransactionClassification.$inferSelect,
  | 'id'
  | 'classificationRunId'
  | 'uploadSessionId'
  | 'sourceType'
  | 'transactionDate'
  | 'amountKrw'
  | 'status'
  | 'vatDirection'
  | 'vatTaxType'
  | 'vatSupplyAmountKrw'
  | 'vatTaxAmountKrw'
  | 'vatGrossAmountKrw'
  | 'vatFactSource'
  | 'vatFactSourceRef'
  | 'vatFactStatus'
>

export type VatDeductionProvenanceRow = Pick<
  typeof vatDeductionReview.$inferSelect,
  | 'id'
  | 'classificationRowId'
  | 'supplyAmountKrw'
  | 'inputTaxKrw'
  | 'decision'
  | 'prorationRateBps'
  | 'confirmedByStaffId'
  | 'confirmedAt'
>

export type VatStoredProvenanceSummary = Pick<
  typeof vatPeriodSummary.$inferSelect,
  | 'id'
  | 'periodStartMonth'
  | 'periodEndMonth'
  | 'taxableSupplyKrw'
  | 'taxableOutputTaxKrw'
  | 'zeroRatedSupplyKrw'
  | 'exemptSupplyKrw'
  | 'outputTaxKrw'
  | 'inputTaxKrw'
  | 'inputTaxDeductibleKrw'
  | 'payableTaxKrw'
  | 'provenanceVersion'
  | 'sourceFingerprint'
  | 'sourceRowCount'
>

type BuildSnapshotParams = {
  tenantId: string
  clientId: string
  periodKey: string
  periodStartMonth: string
  periodEndMonth: string
  rows: VatFactClassificationRow[]
  deductionReviews: VatDeductionProvenanceRow[]
}

export type VatConfirmedLedgerBuildResult =
  | { ok: true; snapshot: VatConfirmedLedgerSnapshot }
  | { ok: false; issues: VatProvenanceIssue[] }

function rowMonth(transactionDate: string | null) {
  if (!transactionDate || !/^20\d{2}-\d{2}-\d{2}$/.test(transactionDate)) return null
  return transactionDate.slice(0, 7)
}

function issue(code: VatProvenanceIssue['code'], rowId: string, message: string): VatProvenanceIssue {
  return vatProvenanceIssueSchema.parse({ code, rowId, message })
}

function validateFilingRow(row: VatFactClassificationRow): VatProvenanceIssue | null {
  if (row.status !== 'confirmed') {
    return issue('classification_not_confirmed', row.id, '확정되지 않은 VAT evidence 거래가 남아 있습니다.')
  }
  if (!['derived', 'confirmed'].includes(row.vatFactStatus ?? '')) {
    return issue('vat_fact_unresolved', row.id, '확정 가능한 VAT fact가 없습니다.')
  }
  if (!row.vatFactSource || !row.vatFactSourceRef) {
    return issue('vat_fact_unresolved', row.id, 'VAT fact의 원본 출처를 확인할 수 없습니다.')
  }

  const parsed = parsedVatFactSchema.safeParse({
    direction: row.vatDirection,
    taxType: row.vatTaxType,
    supplyAmountKrw: row.vatSupplyAmountKrw,
    taxAmountKrw: row.vatTaxAmountKrw,
    grossAmountKrw: row.vatGrossAmountKrw,
    sourceReference: row.vatFactSourceRef,
  })
  if (!parsed.success) {
    return issue('vat_fact_inconsistent', row.id, '공급가액·세액·합계액 또는 과세유형이 일치하지 않습니다.')
  }
  if (row.amountKrw === null || Math.abs(row.amountKrw) !== parsed.data.grossAmountKrw) {
    return issue('vat_fact_inconsistent', row.id, 'VAT fact 합계액이 원장 거래금액과 일치하지 않습니다.')
  }
  return null
}

function buildFingerprint(params: Omit<VatConfirmedLedgerSnapshot, 'sourceFingerprint'> & {
  rows: VatFactClassificationRow[]
  deductionReviews: VatDeductionProvenanceRow[]
}) {
  const payload = {
    provenanceVersion: params.provenanceVersion,
    tenantId: params.tenantId,
    clientId: params.clientId,
    periodKey: params.periodKey,
    periodStartMonth: params.periodStartMonth,
    periodEndMonth: params.periodEndMonth,
    rows: [...params.rows]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((row) => ({
        id: row.id,
        classificationRunId: row.classificationRunId,
        transactionDate: row.transactionDate,
        sourceType: row.sourceType,
        amountKrw: row.amountKrw,
        vatDirection: row.vatDirection,
        vatTaxType: row.vatTaxType,
        vatSupplyAmountKrw: row.vatSupplyAmountKrw,
        vatTaxAmountKrw: row.vatTaxAmountKrw,
        vatGrossAmountKrw: row.vatGrossAmountKrw,
        vatFactSource: row.vatFactSource,
        vatFactSourceRef: row.vatFactSourceRef,
        vatFactStatus: row.vatFactStatus,
      })),
    deductionReviews: [...params.deductionReviews]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((review) => ({
        id: review.id,
        classificationRowId: review.classificationRowId,
        supplyAmountKrw: review.supplyAmountKrw,
        inputTaxKrw: review.inputTaxKrw,
        decision: review.decision,
        prorationRateBps: review.prorationRateBps,
        confirmedByStaffId: review.confirmedByStaffId,
        confirmedAt: review.confirmedAt,
      })),
    totals: params.totals,
  }
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

export function buildVatConfirmedLedgerSnapshot(params: BuildSnapshotParams): VatConfirmedLedgerBuildResult {
  const issues: VatProvenanceIssue[] = []
  const filingRows: VatFactClassificationRow[] = []

  for (const row of params.rows) {
    if (!isVatEvidenceSource(row.sourceType) || row.status === 'excluded') continue
    const month = rowMonth(row.transactionDate)
    if (!month) {
      issues.push(issue('classification_date_missing', row.id, 'VAT evidence 거래일자를 확인할 수 없습니다.'))
      continue
    }
    if (month < params.periodStartMonth || month > params.periodEndMonth) continue
    const rowIssue = validateFilingRow(row)
    if (rowIssue) {
      issues.push(rowIssue)
      continue
    }
    filingRows.push(row)
  }

  const filingRowsById = new Map(filingRows.map((row) => [row.id, row]))
  const reviewedClassificationIds = new Set<string>()
  const validReviews: VatDeductionProvenanceRow[] = []

  for (const review of params.deductionReviews) {
    if (!review.classificationRowId) {
      issues.push(issue('deduction_review_unlinked', review.id, '공제 검토가 확정 원장 거래와 연결되지 않았습니다.'))
      continue
    }
    const sourceRow = filingRowsById.get(review.classificationRowId)
    if (!sourceRow || sourceRow.vatDirection !== 'purchase') {
      issues.push(issue('deduction_review_out_of_scope', review.id, '공제 검토 원천이 같은 기간의 확정 매입 거래가 아닙니다.'))
      continue
    }
    if (reviewedClassificationIds.has(review.classificationRowId)) {
      issues.push(issue('deduction_review_duplicate', review.id, '같은 매입 거래에 공제 검토가 중복 연결됐습니다.'))
      continue
    }
    if (review.decision === 'pending') {
      issues.push(issue('deduction_review_pending', review.id, '공제 여부가 아직 확정되지 않았습니다.'))
      continue
    }
    if (!review.confirmedByStaffId || !review.confirmedAt) {
      issues.push(issue('deduction_review_unconfirmed', review.id, '공제 결정의 사용자 확정 기록이 없습니다.'))
      continue
    }
    if (
      review.supplyAmountKrw !== sourceRow.vatSupplyAmountKrw
      || review.inputTaxKrw !== sourceRow.vatTaxAmountKrw
    ) {
      issues.push(issue('deduction_review_mismatch', review.id, '공제 검토 금액이 연결된 VAT fact와 일치하지 않습니다.'))
      continue
    }
    if (
      review.decision === 'prorated'
      && (review.prorationRateBps === null || review.prorationRateBps < 1 || review.prorationRateBps > 10_000)
    ) {
      issues.push(issue('deduction_review_mismatch', review.id, '안분 공제율을 확인할 수 없습니다.'))
      continue
    }
    reviewedClassificationIds.add(review.classificationRowId)
    validReviews.push(review)
  }

  if (issues.length > 0) return { ok: false, issues }

  const totals = filingRows.reduce((sum, row) => {
    const supply = row.vatSupplyAmountKrw ?? 0
    const tax = row.vatTaxAmountKrw ?? 0
    if (row.vatDirection === 'sale') {
      if (row.vatTaxType === 'taxable') {
        sum.taxableSupplyKrw += supply
        sum.taxableOutputTaxKrw += tax
      } else if (row.vatTaxType === 'zero_rated') {
        sum.zeroRatedSupplyKrw += supply
      } else if (row.vatTaxType === 'exempt') {
        sum.exemptSupplyKrw += supply
      }
      sum.outputTaxKrw += tax
    } else if (row.vatDirection === 'purchase') {
      sum.inputTaxKrw += tax
    }
    return sum
  }, {
    taxableSupplyKrw: 0,
    taxableOutputTaxKrw: 0,
    zeroRatedSupplyKrw: 0,
    exemptSupplyKrw: 0,
    outputTaxKrw: 0,
    inputTaxKrw: 0,
  })

  let inputTaxDeductibleKrw = totals.inputTaxKrw
  for (const review of validReviews) {
    if (review.decision === 'non_deductible') {
      inputTaxDeductibleKrw -= review.inputTaxKrw
    } else if (review.decision === 'prorated') {
      const deductible = Math.round(review.inputTaxKrw * ((review.prorationRateBps ?? 0) / 10_000))
      inputTaxDeductibleKrw -= review.inputTaxKrw - deductible
    }
  }

  const snapshotWithoutFingerprint = {
    provenanceVersion: VAT_PROVENANCE_VERSION,
    tenantId: params.tenantId,
    clientId: params.clientId,
    periodKey: params.periodKey,
    periodStartMonth: params.periodStartMonth,
    periodEndMonth: params.periodEndMonth,
    sourceRowCount: filingRows.length,
    totals: {
      ...totals,
      inputTaxDeductibleKrw,
      payableTaxKrw: totals.outputTaxKrw - inputTaxDeductibleKrw,
    },
  } satisfies Omit<VatConfirmedLedgerSnapshot, 'sourceFingerprint'>

  return {
    ok: true,
    snapshot: vatConfirmedLedgerSnapshotSchema.parse({
      ...snapshotWithoutFingerprint,
      sourceFingerprint: buildFingerprint({
        ...snapshotWithoutFingerprint,
        rows: filingRows,
        deductionReviews: validReviews,
      }),
    }),
  }
}

export function storedSummaryMatchesSnapshot(
  summary: VatStoredProvenanceSummary,
  snapshot: VatConfirmedLedgerSnapshot,
) {
  return summary.periodStartMonth === snapshot.periodStartMonth
    && summary.periodEndMonth === snapshot.periodEndMonth
    && summary.taxableSupplyKrw === snapshot.totals.taxableSupplyKrw
    && summary.taxableOutputTaxKrw === snapshot.totals.taxableOutputTaxKrw
    && summary.zeroRatedSupplyKrw === snapshot.totals.zeroRatedSupplyKrw
    && summary.exemptSupplyKrw === snapshot.totals.exemptSupplyKrw
    && summary.outputTaxKrw === snapshot.totals.outputTaxKrw
    && summary.inputTaxKrw === snapshot.totals.inputTaxKrw
    && summary.inputTaxDeductibleKrw === snapshot.totals.inputTaxDeductibleKrw
    && summary.payableTaxKrw === snapshot.totals.payableTaxKrw
    && summary.provenanceVersion === snapshot.provenanceVersion
    && summary.sourceFingerprint === snapshot.sourceFingerprint
    && summary.sourceRowCount === snapshot.sourceRowCount
}

async function loadVatProvenanceInputs(params: {
  tenantId: string
  clientId: string
  periodKey: string
}) {
  const { db } = await import('@/lib/db')
  const period = buildCompanyHomePeriod({ periodKey: params.periodKey })
  const sessionIds = await resolveActiveSourceBatchSessionIds({
    tenantId: params.tenantId,
    clientId: params.clientId,
    period,
  })

  const runRows = sessionIds.length > 0
    ? await db
      .select({
        id: bookkeepingClassificationRun.id,
        uploadSessionId: bookkeepingClassificationRun.uploadSessionId,
        status: bookkeepingClassificationRun.status,
        createdAt: bookkeepingClassificationRun.createdAt,
      })
      .from(bookkeepingClassificationRun)
      .where(and(
        eq(bookkeepingClassificationRun.tenantId, params.tenantId),
        eq(bookkeepingClassificationRun.status, 'completed'),
        inArray(bookkeepingClassificationRun.uploadSessionId, sessionIds),
      ))
      .orderBy(desc(bookkeepingClassificationRun.createdAt), desc(bookkeepingClassificationRun.id))
    : []
  const latestRunIds = pickLatestCompletedRunIdsBySession(runRows)

  const [rows, deductionReviews, summaryRows] = await Promise.all([
    latestRunIds.length > 0
      ? db
        .select({
          id: bookkeepingTransactionClassification.id,
          classificationRunId: bookkeepingTransactionClassification.classificationRunId,
          uploadSessionId: bookkeepingTransactionClassification.uploadSessionId,
          sourceType: bookkeepingTransactionClassification.sourceType,
          transactionDate: bookkeepingTransactionClassification.transactionDate,
          amountKrw: bookkeepingTransactionClassification.amountKrw,
          status: bookkeepingTransactionClassification.status,
          vatDirection: bookkeepingTransactionClassification.vatDirection,
          vatTaxType: bookkeepingTransactionClassification.vatTaxType,
          vatSupplyAmountKrw: bookkeepingTransactionClassification.vatSupplyAmountKrw,
          vatTaxAmountKrw: bookkeepingTransactionClassification.vatTaxAmountKrw,
          vatGrossAmountKrw: bookkeepingTransactionClassification.vatGrossAmountKrw,
          vatFactSource: bookkeepingTransactionClassification.vatFactSource,
          vatFactSourceRef: bookkeepingTransactionClassification.vatFactSourceRef,
          vatFactStatus: bookkeepingTransactionClassification.vatFactStatus,
        })
        .from(bookkeepingTransactionClassification)
        .where(and(
          eq(bookkeepingTransactionClassification.tenantId, params.tenantId),
          inArray(bookkeepingTransactionClassification.classificationRunId, latestRunIds),
        ))
      : Promise.resolve([]),
    db
      .select({
        id: vatDeductionReview.id,
        classificationRowId: vatDeductionReview.classificationRowId,
        supplyAmountKrw: vatDeductionReview.supplyAmountKrw,
        inputTaxKrw: vatDeductionReview.inputTaxKrw,
        decision: vatDeductionReview.decision,
        prorationRateBps: vatDeductionReview.prorationRateBps,
        confirmedByStaffId: vatDeductionReview.confirmedByStaffId,
        confirmedAt: vatDeductionReview.confirmedAt,
      })
      .from(vatDeductionReview)
      .where(and(
        eq(vatDeductionReview.tenantId, params.tenantId),
        eq(vatDeductionReview.clientId, params.clientId),
        eq(vatDeductionReview.periodKey, period.key),
      )),
    db
      .select({
        id: vatPeriodSummary.id,
        periodStartMonth: vatPeriodSummary.periodStartMonth,
        periodEndMonth: vatPeriodSummary.periodEndMonth,
        taxableSupplyKrw: vatPeriodSummary.taxableSupplyKrw,
        taxableOutputTaxKrw: vatPeriodSummary.taxableOutputTaxKrw,
        zeroRatedSupplyKrw: vatPeriodSummary.zeroRatedSupplyKrw,
        exemptSupplyKrw: vatPeriodSummary.exemptSupplyKrw,
        outputTaxKrw: vatPeriodSummary.outputTaxKrw,
        inputTaxKrw: vatPeriodSummary.inputTaxKrw,
        inputTaxDeductibleKrw: vatPeriodSummary.inputTaxDeductibleKrw,
        payableTaxKrw: vatPeriodSummary.payableTaxKrw,
        provenanceVersion: vatPeriodSummary.provenanceVersion,
        sourceFingerprint: vatPeriodSummary.sourceFingerprint,
        sourceRowCount: vatPeriodSummary.sourceRowCount,
      })
      .from(vatPeriodSummary)
      .where(and(
        eq(vatPeriodSummary.tenantId, params.tenantId),
        eq(vatPeriodSummary.clientId, params.clientId),
        eq(vatPeriodSummary.periodKey, period.key),
        eq(vatPeriodSummary.filingType, 'final'),
      ))
      .limit(1),
  ])

  return {
    period,
    rows,
    deductionReviews,
    summary: summaryRows[0] ?? null,
  }
}

export async function loadVatConfirmedLedgerProvenanceState(params: {
  tenantId: string
  clientId: string
  periodKey: string
}): Promise<VatProvenanceState> {
  const input = await loadVatProvenanceInputs(params)
  if (!input.summary) {
    return vatProvenanceStateSchema.parse({
      status: 'blocked',
      isReady: false,
      canRebuild: false,
      issueCount: 1,
      message: '부가세 기간 요약이 없어 확정 원장을 다시 계산할 수 없습니다.',
    })
  }

  const result = buildVatConfirmedLedgerSnapshot({
    ...params,
    periodStartMonth: input.period.startMonth,
    periodEndMonth: input.period.endMonth,
    rows: input.rows,
    deductionReviews: input.deductionReviews,
  })
  if (!result.ok) {
    return vatProvenanceStateSchema.parse({
      status: 'blocked',
      isReady: false,
      canRebuild: false,
      issueCount: result.issues.length,
      message: `확정 원장 출처 ${result.issues.length}건을 먼저 확인해야 합니다.`,
    })
  }

  if (storedSummaryMatchesSnapshot(input.summary, result.snapshot)) {
    return vatProvenanceStateSchema.parse({
      status: 'verified',
      isReady: true,
      canRebuild: false,
      issueCount: 0,
      message: '현재 확정 원장 fingerprint가 부가세 요약과 일치합니다.',
    })
  }

  return vatProvenanceStateSchema.parse({
    status: 'rebuild_required',
    isReady: false,
    canRebuild: true,
    issueCount: 1,
    message: '확정 원장 값으로 부가세 요약을 다시 계산해야 합니다.',
  })
}

export async function rebuildVatPeriodSummaryFromConfirmedLedger(params: {
  tenantId: string
  clientId: string
  periodKey: string
}) {
  const { db } = await import('@/lib/db')
  const input = await loadVatProvenanceInputs(params)
  if (!input.summary) {
    return {
      ok: false as const,
      status: 404,
      issues: [issue('vat_fact_unresolved', params.periodKey, '부가세 기간 요약을 찾을 수 없습니다.')],
    }
  }

  const result = buildVatConfirmedLedgerSnapshot({
    ...params,
    periodStartMonth: input.period.startMonth,
    periodEndMonth: input.period.endMonth,
    rows: input.rows,
    deductionReviews: input.deductionReviews,
  })
  if (!result.ok) return { ok: false as const, status: 409, issues: result.issues }

  const ts = toDBString(now())
  const updated = await db
    .update(vatPeriodSummary)
    .set({
      ...result.snapshot.totals,
      periodStartMonth: result.snapshot.periodStartMonth,
      periodEndMonth: result.snapshot.periodEndMonth,
      pendingDeductionCount: 0,
      isFinal: true,
      packageStatus: 'ready',
      packageStorageKey: null,
      generatedAt: null,
      provenanceVersion: result.snapshot.provenanceVersion,
      sourceFingerprint: result.snapshot.sourceFingerprint,
      sourceRowCount: result.snapshot.sourceRowCount,
      rebuiltAt: ts,
      updatedAt: ts,
    })
    .where(and(
      eq(vatPeriodSummary.id, input.summary.id),
      eq(vatPeriodSummary.tenantId, params.tenantId),
      eq(vatPeriodSummary.clientId, params.clientId),
      eq(vatPeriodSummary.periodKey, input.period.key),
      eq(vatPeriodSummary.filingType, 'final'),
    ))
    .returning({ id: vatPeriodSummary.id })

  if (updated.length !== 1) {
    return {
      ok: false as const,
      status: 409,
      issues: [issue('vat_fact_unresolved', params.periodKey, '부가세 요약 갱신 대상이 변경되었습니다.')],
    }
  }

  return { ok: true as const, snapshot: result.snapshot, rebuiltAt: ts }
}
