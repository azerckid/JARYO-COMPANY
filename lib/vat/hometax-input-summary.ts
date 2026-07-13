import { z } from 'zod'
import type { CompanyHomePeriod } from '@/lib/company-home/summary'
import type { VatPackageGate } from './package-gate'
import { loadVatPackageGate } from './package-gate'
import {
  loadVatConfirmedLedgerReadModel,
  type VatConfirmedLedgerBuildResult,
  type VatDeductionProvenanceRow,
  type VatFactClassificationRow,
  type VatProvenanceState,
} from './provenance'
import { loadVatSummary } from './summary'
import { buildVatTaxTreatmentGate } from './tax-treatment-gate'

export const vatHometaxInputStatusSchema = z.enum([
  'ready',
  'blocked',
  'empty',
  'stale',
  'unsupported',
])

export const vatHometaxInputRowSchema = z.object({
  formLine: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  amountKrw: z.number().int().nonnegative().nullable(),
  taxKrw: z.number().int().nullable(),
  mode: z.enum(['input', 'calculated_check', 'hometax_final_check']),
}).superRefine((row, context) => {
  if (row.formLine === '(27)') {
    if (row.amountKrw !== null || row.taxKrw !== null || row.mode !== 'hometax_final_check') {
      context.addIssue({
        code: 'custom',
        message: '(27)은 홈택스 최종 확인값으로만 표시해야 합니다.',
      })
    }
  } else if (row.mode === 'hometax_final_check') {
    context.addIssue({
      code: 'custom',
      path: ['mode'],
      message: 'hometax_final_check는 (27)에만 사용할 수 있습니다.',
    })
  }
})

export const vatHometaxInputSummarySchema = z.object({
  filingType: z.literal('general_regular_final'),
  period: z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    startMonth: z.string().regex(/^20\d{2}-\d{2}$/),
    endMonth: z.string().regex(/^20\d{2}-\d{2}$/),
  }),
  business: z.object({ id: z.string().min(1), name: z.string().min(1) }).nullable(),
  gate: z.object({
    status: vatHometaxInputStatusSchema,
    reasons: z.array(z.string().min(1)),
    sourceRowCount: z.number().int().nonnegative(),
  }),
  rows: z.array(vatHometaxInputRowSchema),
}).superRefine((summary, context) => {
  if (summary.gate.status === 'ready' && summary.rows.length === 0) {
    context.addIssue({ code: 'custom', path: ['rows'], message: '준비 완료 상태에는 신고서 입력 행이 필요합니다.' })
  }
  if (summary.gate.status !== 'ready' && summary.rows.length > 0) {
    context.addIssue({ code: 'custom', path: ['rows'], message: '미완료 상태에서는 확정값을 표시할 수 없습니다.' })
  }
})

export type VatHometaxInputStatus = z.infer<typeof vatHometaxInputStatusSchema>
export type VatHometaxInputRow = z.infer<typeof vatHometaxInputRowSchema>
export type VatHometaxInputSummary = z.infer<typeof vatHometaxInputSummarySchema>

type BuildVatHometaxInputSummaryParams = {
  period: Pick<CompanyHomePeriod, 'key' | 'label' | 'startMonth' | 'endMonth'>
  business: { id: string; name: string } | null
  hasPeriodSummary: boolean
  packageGate: Pick<VatPackageGate, 'isReady' | 'reasons'> | null
  provenanceState: VatProvenanceState | null
  ledgerResult: VatConfirmedLedgerBuildResult | null
}

type LineTotals = { amountKrw: number; taxKrw: number }

function sumRows(rows: VatFactClassificationRow[], predicate: (row: VatFactClassificationRow) => boolean): LineTotals {
  return rows.reduce((total, row) => {
    if (!predicate(row)) return total
    total.amountKrw += row.vatSupplyAmountKrw ?? 0
    total.taxKrw += row.vatTaxAmountKrw ?? 0
    return total
  }, { amountKrw: 0, taxKrw: 0 })
}

function inputRow(
  formLine: string,
  label: string,
  description: string,
  totals: LineTotals,
  mode: VatHometaxInputRow['mode'] = 'input',
): VatHometaxInputRow {
  return { formLine, label, description, ...totals, mode }
}

function buildNonDeductibleTotals(reviews: VatDeductionProvenanceRow[]): LineTotals {
  return reviews.reduce((total, review) => {
    if (review.decision === 'non_deductible') {
      total.amountKrw += review.supplyAmountKrw
      total.taxKrw += review.inputTaxKrw
    } else if (review.decision === 'prorated') {
      const ratio = (review.prorationRateBps ?? 0) / 10_000
      total.amountKrw += review.supplyAmountKrw - Math.round(review.supplyAmountKrw * ratio)
      total.taxKrw += review.inputTaxKrw - Math.round(review.inputTaxKrw * ratio)
    }
    return total
  }, { amountKrw: 0, taxKrw: 0 })
}

function buildReadyRows(result: Extract<VatConfirmedLedgerBuildResult, { ok: true }>): {
  rows: VatHometaxInputRow[]
  unsupportedReasons: string[]
} {
  const rows = result.filingRows
  const snapshot = result.snapshot
  const unsupportedReasons: string[] = []
  const taxInvoicePurchases = rows.filter((row) => (
    row.vatDirection === 'purchase' && row.sourceType === 'tax_invoice'
  ))

  if (taxInvoicePurchases.length > 0) {
    unsupportedReasons.push(
      `세금계산서 매입 ${taxInvoicePurchases.length}건의 일반매입·고정자산 매입 구분이 필요합니다.`,
    )
    return { rows: [], unsupportedReasons }
  }

  const taxableTaxInvoices = sumRows(rows, (row) => (
    row.vatDirection === 'sale' && row.vatTaxType === 'taxable' && row.sourceType === 'tax_invoice'
  ))
  const taxableCardReceipts = sumRows(rows, (row) => (
    row.vatDirection === 'sale'
    && row.vatTaxType === 'taxable'
    && (row.sourceType === 'card' || row.sourceType === 'receipt')
  ))
  const taxableOther = sumRows(rows, (row) => (
    row.vatDirection === 'sale'
    && row.vatTaxType === 'taxable'
    && !['tax_invoice', 'card', 'receipt'].includes(row.sourceType)
  ))
  const zeroRatedTaxInvoices = sumRows(rows, (row) => (
    row.vatDirection === 'sale' && row.vatTaxType === 'zero_rated' && row.sourceType === 'tax_invoice'
  ))
  const zeroRatedOther = sumRows(rows, (row) => (
    row.vatDirection === 'sale' && row.vatTaxType === 'zero_rated' && row.sourceType !== 'tax_invoice'
  ))
  const purchases = sumRows(rows, (row) => row.vatDirection === 'purchase')
  const cardReceiptPurchases = sumRows(rows, (row) => (
    row.vatDirection === 'purchase' && (row.sourceType === 'card' || row.sourceType === 'receipt')
  ))
  const nonDeductible = buildNonDeductibleTotals(result.deductionReviews)
  const deductible = {
    amountKrw: purchases.amountKrw - nonDeductible.amountKrw,
    taxKrw: purchases.taxKrw - nonDeductible.taxKrw,
  }
  const salesTotal = {
    amountKrw: taxableTaxInvoices.amountKrw
      + taxableCardReceipts.amountKrw
      + taxableOther.amountKrw
      + zeroRatedTaxInvoices.amountKrw
      + zeroRatedOther.amountKrw,
    taxKrw: taxableTaxInvoices.taxKrw
      + taxableCardReceipts.taxKrw
      + taxableOther.taxKrw
      + zeroRatedTaxInvoices.taxKrw
      + zeroRatedOther.taxKrw,
  }

  if (
    salesTotal.amountKrw !== snapshot.totals.taxableSupplyKrw + snapshot.totals.zeroRatedSupplyKrw
    || salesTotal.taxKrw !== snapshot.totals.outputTaxKrw
    || purchases.taxKrw !== snapshot.totals.inputTaxKrw
    || deductible.taxKrw !== snapshot.totals.inputTaxDeductibleKrw
  ) {
    unsupportedReasons.push('신고서 행 합계가 확정 원장 provenance 합계와 일치하지 않습니다.')
    return { rows: [], unsupportedReasons }
  }

  const displayRows = [
    inputRow('(1)', '과세 · 세금계산서 발급분', '전자·종이 세금계산서 과세 매출', taxableTaxInvoices),
    inputRow('(3)', '과세 · 카드·현금영수증 발행분', '카드·현금영수증 과세 매출', taxableCardReceipts),
    inputRow('(4)', '과세 · 기타 매출분', '정규영수증 외 과세 매출', taxableOther),
    inputRow('(5)', '영세율 · 세금계산서 발급분', '증빙 확인을 마친 영세율 매출', zeroRatedTaxInvoices),
  ]
  if (zeroRatedOther.amountKrw > 0 || zeroRatedOther.taxKrw > 0) {
    displayRows.push(inputRow('(6)', '영세율 · 기타', '세금계산서 외 영세율 매출', zeroRatedOther))
  }
  displayRows.push(
    inputRow('(9)', '과세표준 및 매출세액 합계', '위 매출 항목의 합계', salesTotal, 'calculated_check'),
    inputRow('(10)', '세금계산서 수취분 · 일반매입', '고정자산을 제외한 세금계산서 매입', { amountKrw: 0, taxKrw: 0 }),
    inputRow('(11)', '세금계산서 수취분 · 고정자산 매입', '고정자산으로 확인한 매입', { amountKrw: 0, taxKrw: 0 }),
    inputRow('(14)', '그 밖의 공제매입세액', '카드·현금영수증 등 매입', cardReceiptPurchases),
    inputRow('(15)', '매입세액 합계', '확정 매입 VAT fact 합계', purchases, 'calculated_check'),
    inputRow('(16)', '공제받지 못할 매입세액', '불공제·안분 불공제분 합계', nonDeductible),
    inputRow('(17)', '공제 가능 매입세액 차감계', '(15) 매입세액 합계 - (16) 불공제 매입세액', deductible, 'calculated_check'),
    {
      formLine: '㉰',
      label: '납부(환급)세액',
      description: '매출세액 ㉮ - 매입세액 ㉯',
      amountKrw: null,
      taxKrw: snapshot.totals.payableTaxKrw,
      mode: 'calculated_check',
    },
    inputRow('(84)', '면세사업 수입금액 합계', '면세 매출이 있는 경우만 확인', {
      amountKrw: snapshot.totals.exemptSupplyKrw,
      taxKrw: 0,
    }),
    {
      formLine: '(27)',
      label: '최종 납부(환급)세액',
      description: '경감·공제·예정고지·가산세 반영 후',
      amountKrw: null,
      taxKrw: null,
      mode: 'hometax_final_check',
    },
  )

  return { rows: displayRows.map((row) => vatHometaxInputRowSchema.parse(row)), unsupportedReasons }
}

function nonReadySummary(
  params: BuildVatHometaxInputSummaryParams,
  status: Exclude<VatHometaxInputStatus, 'ready'>,
  reasons: string[],
  sourceRowCount: number,
): VatHometaxInputSummary {
  return vatHometaxInputSummarySchema.parse({
    filingType: 'general_regular_final',
    period: params.period,
    business: params.business,
    gate: { status, reasons, sourceRowCount },
    rows: [],
  })
}

export function buildVatHometaxInputSummary(
  params: BuildVatHometaxInputSummaryParams,
): VatHometaxInputSummary {
  if (!params.business || !params.hasPeriodSummary || !params.ledgerResult) {
    return nonReadySummary(params, 'empty', ['확정된 부가세 기간 요약이 없습니다.'], 0)
  }

  if (!params.ledgerResult.ok) {
    return nonReadySummary(
      params,
      'blocked',
      [`확정 원장 출처 ${params.ledgerResult.issues.length}건을 먼저 확인해야 합니다.`],
      0,
    )
  }

  const sourceRowCount = params.ledgerResult.snapshot.sourceRowCount
  if (sourceRowCount === 0) {
    return nonReadySummary(params, 'empty', ['이 기간에 확정된 부가세 거래가 없습니다.'], 0)
  }
  if (params.provenanceState?.status === 'rebuild_required') {
    return nonReadySummary(params, 'stale', [params.provenanceState.message], sourceRowCount)
  }
  if (!params.packageGate?.isReady) {
    const reasons = params.packageGate?.reasons.map((reason) => reason.message)
      ?? [params.provenanceState?.message ?? '부가세 신고 준비를 먼저 완료해야 합니다.']
    return nonReadySummary(params, 'blocked', reasons, sourceRowCount)
  }

  const ready = buildReadyRows(params.ledgerResult)
  if (ready.unsupportedReasons.length > 0) {
    return nonReadySummary(params, 'unsupported', ready.unsupportedReasons, sourceRowCount)
  }

  return vatHometaxInputSummarySchema.parse({
    filingType: 'general_regular_final',
    period: params.period,
    business: params.business,
    gate: { status: 'ready', reasons: [], sourceRowCount },
    rows: ready.rows,
  })
}

export async function loadVatHometaxInputSummary(params: {
  tenantId: string
  periodKey?: string | null
}): Promise<VatHometaxInputSummary> {
  const summary = await loadVatSummary({
    tenantId: params.tenantId,
    periodKey: params.periodKey,
    includeStoredTaxTreatmentAi: false,
  })
  if (!summary.businessEntity) {
    return buildVatHometaxInputSummary({
      period: summary.period,
      business: null,
      hasPeriodSummary: false,
      packageGate: null,
      provenanceState: null,
      ledgerResult: null,
    })
  }

  const scope = {
    tenantId: params.tenantId,
    clientId: summary.businessEntity.id,
    periodKey: summary.period.key,
  }
  const ledger = await loadVatConfirmedLedgerReadModel(scope)
  const ledgerResult = ledger.result
  const provenanceState = ledger.state
  const taxTreatmentGate = buildVatTaxTreatmentGate(summary.taxTreatmentRows)
  const packageGate = await loadVatPackageGate({
    ...scope,
    hasSummary: summary.hasPeriodSummary,
    pendingDeductionCount: summary.taxSummary.pendingDeductionCount,
    taxTreatmentGate,
    provenanceState,
  })

  return buildVatHometaxInputSummary({
    period: summary.period,
    business: summary.businessEntity,
    hasPeriodSummary: summary.hasPeriodSummary,
    packageGate,
    provenanceState,
    ledgerResult,
  })
}
