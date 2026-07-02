import { and, asc, eq } from 'drizzle-orm'
import { DateTime } from 'luxon'
import { client, payrollEmployeeLine, payrollPeriodSummary, tenant } from '@/lib/db/schema'

export type PayrollTone = 'ok' | 'warn' | 'danger' | 'muted' | 'info'
export type PayrollCloseStatus = 'open' | 'blocked' | 'closed'
export type PayrollLineStatus = 'ready' | 'needs_review' | 'closed'
export type PayrollNoticeMatchStatus = 'matched' | 'missing_notice' | 'ambiguous' | 'unmatched'
export type PayrollDocumentStatus = 'not_generated' | 'ready' | 'generated' | 'failed'

export type PayrollPeriod = {
  key: string
  payrollMonth: string
  paymentDate: string | null
  label: string
}

export type PayrollSummaryTotals = {
  employeeCount: number
  grossPayKrw: number
  withholdingTaxKrw: number
  socialInsuranceKrw: number
  deductionTotalKrw: number
  netPayKrw: number
  issueCount: number
  closeStatus: PayrollCloseStatus
}

export type PayrollIssueAlert = {
  visible: boolean
  title: string
  description: string
  targetEmployeeLineId: string | null
}

export type PayrollRegisterRow = {
  id: string
  employeeCode: string | null
  employeeName: string
  displayName: string
  department: string | null
  jobTitle: string | null
  jobType: string | null
  baseSalaryKrw: number
  allowanceKrw: number
  grossPayKrw: number
  incomeTaxKrw: number
  localIncomeTaxKrw: number
  withholdingTaxKrw: number
  nationalPensionKrw: number
  healthInsuranceKrw: number
  longTermCareKrw: number
  employmentInsuranceKrw: number
  socialInsuranceKrw: number
  otherDeductionKrw: number
  deductionTotalKrw: number
  netPayKrw: number
  status: PayrollLineStatus
  issueLabel: string | null
  noticeMatchStatus: PayrollNoticeMatchStatus
}

export type PayrollDeductionBreakdownItem = {
  id:
    | 'income_tax'
    | 'local_income_tax'
    | 'national_pension'
    | 'health_insurance'
    | 'long_term_care'
    | 'employment_insurance'
  label: string
  amountKrw: number
  source: 'calculated' | 'notice' | 'manual'
  tone: PayrollTone
}

export type PayrollDocumentPreview = {
  id: 'payslip' | 'withholding_statement' | 'insurance_statement'
  title: string
  description: string
  statusLabel: string
  tone: PayrollTone
}

export type PayrollCloseAction = {
  locked: boolean
  lockReason: string | null
  canClose: boolean
}

export type PayrollWorkspaceSummary = {
  tenant: { id: string; name: string; timezone: string }
  businessEntity: { id: string; name: string } | null
  period: PayrollPeriod
  summary: PayrollSummaryTotals
  issueAlert: PayrollIssueAlert
  registerRows: PayrollRegisterRow[]
  deductionBreakdown: PayrollDeductionBreakdownItem[]
  documents: PayrollDocumentPreview[]
  closeAction: PayrollCloseAction
}

type PayrollPeriodSummaryInput = {
  employeeCount: number
  issueCount: number
  grossPayKrw: number
  withholdingTaxKrw: number
  socialInsuranceKrw: number
  deductionTotalKrw: number
  netPayKrw: number
  noticeImportStatus: 'missing' | 'partial' | 'matched'
  closeStatus: PayrollCloseStatus
  paymentDate: string | null
  payslipStatus: PayrollDocumentStatus
  withholdingStatementStatus: PayrollDocumentStatus
  insuranceStatementStatus: PayrollDocumentStatus
}

type PayrollEmployeeLineInput = {
  id: string
  employeeCode: string | null
  employeeName: string
  department: string | null
  jobTitle: string | null
  jobType: string | null
  baseSalaryKrw: number
  allowanceKrw: number
  incomeTaxKrw: number
  localIncomeTaxKrw: number
  nationalPensionKrw: number
  healthInsuranceKrw: number
  longTermCareKrw: number
  employmentInsuranceKrw: number
  otherDeductionKrw: number
  noticeMatchStatus: string
  status: string
  issueCode: string | null
  issueMessage: string | null
}

type LoadPayrollWorkspaceSummaryParams = {
  tenantId: string
  periodKey?: string | null
  today?: DateTime
  canViewEmployeeNames?: boolean
}

const DEFAULT_TZ = 'Asia/Seoul'
const EMPTY_PERIOD_SUMMARY: PayrollPeriodSummaryInput = {
  employeeCount: 0,
  issueCount: 0,
  grossPayKrw: 0,
  withholdingTaxKrw: 0,
  socialInsuranceKrw: 0,
  deductionTotalKrw: 0,
  netPayKrw: 0,
  noticeImportStatus: 'missing',
  closeStatus: 'open',
  paymentDate: null,
  payslipStatus: 'not_generated',
  withholdingStatementStatus: 'not_generated',
  insuranceStatementStatus: 'not_generated',
}

function padMonth(value: number) {
  return String(value).padStart(2, '0')
}

export function resolvePayrollPeriod({
  periodKey,
  today,
  timezone = DEFAULT_TZ,
  paymentDate = null,
}: {
  periodKey?: string | null
  today?: DateTime
  timezone?: string
  paymentDate?: string | null
}): PayrollPeriod {
  const now = today ?? DateTime.now().setZone(timezone)
  const fallback = `${now.year}-${padMonth(now.month)}`
  const key = periodKey && /^20\d{2}-(0[1-9]|1[0-2])$/.test(periodKey) ? periodKey : fallback
  const [year, month] = key.split('-')
  const monthNumber = Number(month)
  return {
    key,
    payrollMonth: key,
    paymentDate,
    label: `${year}년 ${monthNumber}월 급여`,
  }
}

export function normalizePayrollLineStatus(value: string): PayrollLineStatus {
  if (value === 'ready' || value === 'closed') return value
  return 'needs_review'
}

export function normalizeNoticeMatchStatus(value: string): PayrollNoticeMatchStatus {
  if (value === 'matched' || value === 'ambiguous' || value === 'unmatched') return value
  return 'missing_notice'
}

export function maskEmployeeName(name: string, canViewEmployeeNames: boolean): string {
  if (canViewEmployeeNames) return name
  const trimmed = name.trim()
  if (trimmed.length <= 1) return '*'
  return `${trimmed[0]}${'*'.repeat(Math.max(1, trimmed.length - 1))}`
}

export function buildPayrollRegisterRow(
  line: PayrollEmployeeLineInput,
  canViewEmployeeNames = true,
): PayrollRegisterRow {
  const baseSalaryKrw = line.baseSalaryKrw
  const allowanceKrw = line.allowanceKrw
  const grossPayKrw = baseSalaryKrw + allowanceKrw
  const withholdingTaxKrw = line.incomeTaxKrw + line.localIncomeTaxKrw
  const socialInsuranceKrw = (
    line.nationalPensionKrw +
    line.healthInsuranceKrw +
    line.longTermCareKrw +
    line.employmentInsuranceKrw
  )
  const deductionTotalKrw = withholdingTaxKrw + socialInsuranceKrw + line.otherDeductionKrw
  const netPayKrw = grossPayKrw - deductionTotalKrw
  const status = normalizePayrollLineStatus(line.status)

  return {
    id: line.id,
    employeeCode: line.employeeCode,
    employeeName: line.employeeName,
    displayName: maskEmployeeName(line.employeeName, canViewEmployeeNames),
    department: line.department,
    jobTitle: line.jobTitle,
    jobType: line.jobType,
    baseSalaryKrw,
    allowanceKrw,
    grossPayKrw,
    incomeTaxKrw: line.incomeTaxKrw,
    localIncomeTaxKrw: line.localIncomeTaxKrw,
    withholdingTaxKrw,
    nationalPensionKrw: line.nationalPensionKrw,
    healthInsuranceKrw: line.healthInsuranceKrw,
    longTermCareKrw: line.longTermCareKrw,
    employmentInsuranceKrw: line.employmentInsuranceKrw,
    socialInsuranceKrw,
    otherDeductionKrw: line.otherDeductionKrw,
    deductionTotalKrw,
    netPayKrw,
    status,
    issueLabel: status === 'needs_review' ? line.issueMessage ?? line.issueCode ?? '확인 필요' : null,
    noticeMatchStatus: normalizeNoticeMatchStatus(line.noticeMatchStatus),
  }
}

export function buildPayrollSummaryTotals(
  rows: PayrollRegisterRow[],
  summary: Pick<PayrollPeriodSummaryInput, 'closeStatus'> = { closeStatus: 'open' },
): PayrollSummaryTotals {
  return rows.reduce<PayrollSummaryTotals>((acc, row) => ({
    employeeCount: acc.employeeCount + 1,
    grossPayKrw: acc.grossPayKrw + row.grossPayKrw,
    withholdingTaxKrw: acc.withholdingTaxKrw + row.withholdingTaxKrw,
    socialInsuranceKrw: acc.socialInsuranceKrw + row.socialInsuranceKrw,
    deductionTotalKrw: acc.deductionTotalKrw + row.deductionTotalKrw,
    netPayKrw: acc.netPayKrw + row.netPayKrw,
    issueCount: acc.issueCount + (row.status === 'needs_review' ? 1 : 0),
    closeStatus: summary.closeStatus,
  }), {
    employeeCount: 0,
    grossPayKrw: 0,
    withholdingTaxKrw: 0,
    socialInsuranceKrw: 0,
    deductionTotalKrw: 0,
    netPayKrw: 0,
    issueCount: 0,
    closeStatus: summary.closeStatus,
  })
}

export function buildPayrollIssueAlert(rows: PayrollRegisterRow[]): PayrollIssueAlert {
  const target = rows.find((row) => row.status === 'needs_review')
  if (!target) {
    return {
      visible: false,
      title: '확인 필요 직원이 없습니다',
      description: '급여 마감 전 확인할 직원 이슈가 없습니다.',
      targetEmployeeLineId: null,
    }
  }

  return {
    visible: true,
    title: `${target.displayName} 확인 필요`,
    description: target.issueLabel ?? '급여 마감 전 직원별 공제·고지액 상태를 확인하세요.',
    targetEmployeeLineId: target.id,
  }
}

function socialInsuranceSource(rows: PayrollRegisterRow[]): PayrollDeductionBreakdownItem['source'] {
  return rows.some((row) => row.noticeMatchStatus === 'matched') ? 'notice' : 'calculated'
}

export function buildPayrollDeductionBreakdown(rows: PayrollRegisterRow[]): PayrollDeductionBreakdownItem[] {
  const socialSource = socialInsuranceSource(rows)
  const total = (selector: (row: PayrollRegisterRow) => number) => rows.reduce((sum, row) => sum + selector(row), 0)
  return [
    { id: 'income_tax', label: '소득세', amountKrw: total((row) => row.incomeTaxKrw), source: 'calculated', tone: 'danger' },
    { id: 'local_income_tax', label: '지방소득세', amountKrw: total((row) => row.localIncomeTaxKrw), source: 'calculated', tone: 'danger' },
    { id: 'national_pension', label: '국민연금', amountKrw: total((row) => row.nationalPensionKrw), source: socialSource, tone: 'warn' },
    { id: 'health_insurance', label: '건강보험', amountKrw: total((row) => row.healthInsuranceKrw), source: socialSource, tone: 'warn' },
    { id: 'long_term_care', label: '장기요양', amountKrw: total((row) => row.longTermCareKrw), source: socialSource, tone: 'warn' },
    { id: 'employment_insurance', label: '고용보험', amountKrw: total((row) => row.employmentInsuranceKrw), source: socialSource, tone: 'warn' },
  ]
}

function documentStatusLabel(status: PayrollDocumentStatus) {
  switch (status) {
    case 'ready':
      return '준비됨'
    case 'generated':
      return '생성됨'
    case 'failed':
      return '오류'
    case 'not_generated':
    default:
      return '대기'
  }
}

function documentStatusTone(status: PayrollDocumentStatus): PayrollTone {
  switch (status) {
    case 'ready':
    case 'generated':
      return 'ok'
    case 'failed':
      return 'danger'
    case 'not_generated':
    default:
      return 'muted'
  }
}

export function buildPayrollDocuments(summary: Pick<
  PayrollPeriodSummaryInput,
  'payslipStatus' | 'withholdingStatementStatus' | 'insuranceStatementStatus'
>): PayrollDocumentPreview[] {
  return [
    {
      id: 'payslip',
      title: '급여명세서',
      description: '직원별 지급·공제 내역 미리보기',
      statusLabel: documentStatusLabel(summary.payslipStatus),
      tone: documentStatusTone(summary.payslipStatus),
    },
    {
      id: 'withholding_statement',
      title: '원천징수 지급명세서',
      description: '신고지원으로 전달할 원천세 산출물',
      statusLabel: documentStatusLabel(summary.withholdingStatementStatus),
      tone: documentStatusTone(summary.withholdingStatementStatus),
    },
    {
      id: 'insurance_statement',
      title: '4대보험 정산 자료',
      description: '건강보험 EDI/사회보험 고지액 반영 결과',
      statusLabel: documentStatusLabel(summary.insuranceStatementStatus),
      tone: documentStatusTone(summary.insuranceStatementStatus),
    },
  ]
}

export function buildPayrollCloseAction(summary: PayrollSummaryTotals): PayrollCloseAction {
  if (summary.closeStatus === 'closed') {
    return { locked: true, lockReason: '이미 마감된 급여입니다', canClose: false }
  }
  if (summary.issueCount > 0 || summary.closeStatus === 'blocked') {
    return {
      locked: true,
      lockReason: `확인 필요 ${summary.issueCount || 1}건 처리 후 활성화`,
      canClose: false,
    }
  }
  return { locked: false, lockReason: null, canClose: true }
}

export async function loadPayrollWorkspaceSummary({
  tenantId,
  periodKey,
  today,
  canViewEmployeeNames = true,
}: LoadPayrollWorkspaceSummaryParams): Promise<PayrollWorkspaceSummary> {
  const { db } = await import('@/lib/db')

  const tenantRows = await db
    .select({ id: tenant.id, name: tenant.name, timezone: tenant.timezone })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1)
  const tenantRow = tenantRows[0] ?? { id: tenantId, name: '회사', timezone: DEFAULT_TZ }

  const initialPeriod = resolvePayrollPeriod({ periodKey, today, timezone: tenantRow.timezone })

  const businessEntityRows = await db
    .select({ id: client.id, name: client.name })
    .from(client)
    .where(eq(client.tenantId, tenantId))
    .orderBy(asc(client.createdAt))
    .limit(1)
  const businessEntity = businessEntityRows[0] ?? null
  const base = { tenant: tenantRow, businessEntity }

  if (!businessEntity) {
    const summaryTotals = buildPayrollSummaryTotals([])
    return {
      ...base,
      period: initialPeriod,
      summary: summaryTotals,
      issueAlert: buildPayrollIssueAlert([]),
      registerRows: [],
      deductionBreakdown: buildPayrollDeductionBreakdown([]),
      documents: buildPayrollDocuments(EMPTY_PERIOD_SUMMARY),
      closeAction: buildPayrollCloseAction(summaryTotals),
    }
  }

  const periodRows = await db
    .select({
      id: payrollPeriodSummary.id,
      employeeCount: payrollPeriodSummary.employeeCount,
      issueCount: payrollPeriodSummary.issueCount,
      grossPayKrw: payrollPeriodSummary.grossPayKrw,
      withholdingTaxKrw: payrollPeriodSummary.withholdingTaxKrw,
      socialInsuranceKrw: payrollPeriodSummary.socialInsuranceKrw,
      deductionTotalKrw: payrollPeriodSummary.deductionTotalKrw,
      netPayKrw: payrollPeriodSummary.netPayKrw,
      noticeImportStatus: payrollPeriodSummary.noticeImportStatus,
      closeStatus: payrollPeriodSummary.closeStatus,
      paymentDate: payrollPeriodSummary.paymentDate,
      payslipStatus: payrollPeriodSummary.payslipStatus,
      withholdingStatementStatus: payrollPeriodSummary.withholdingStatementStatus,
      insuranceStatementStatus: payrollPeriodSummary.insuranceStatementStatus,
    })
    .from(payrollPeriodSummary)
    .where(and(
      eq(payrollPeriodSummary.tenantId, tenantId),
      eq(payrollPeriodSummary.clientId, businessEntity.id),
      eq(payrollPeriodSummary.payrollPeriod, initialPeriod.key),
    ))
    .limit(1)

  const periodSummaryRow = periodRows[0] ?? null
  const period = resolvePayrollPeriod({
    periodKey: initialPeriod.key,
    today,
    timezone: tenantRow.timezone,
    paymentDate: periodSummaryRow?.paymentDate ?? null,
  })

  if (!periodSummaryRow) {
    const summaryTotals = buildPayrollSummaryTotals([])
    return {
      ...base,
      period,
      summary: summaryTotals,
      issueAlert: buildPayrollIssueAlert([]),
      registerRows: [],
      deductionBreakdown: buildPayrollDeductionBreakdown([]),
      documents: buildPayrollDocuments(EMPTY_PERIOD_SUMMARY),
      closeAction: buildPayrollCloseAction(summaryTotals),
    }
  }

  const lineRows = await db
    .select({
      id: payrollEmployeeLine.id,
      employeeCode: payrollEmployeeLine.employeeCode,
      employeeName: payrollEmployeeLine.employeeName,
      department: payrollEmployeeLine.department,
      jobTitle: payrollEmployeeLine.jobTitle,
      jobType: payrollEmployeeLine.jobType,
      baseSalaryKrw: payrollEmployeeLine.baseSalaryKrw,
      allowanceKrw: payrollEmployeeLine.allowanceKrw,
      incomeTaxKrw: payrollEmployeeLine.incomeTaxKrw,
      localIncomeTaxKrw: payrollEmployeeLine.localIncomeTaxKrw,
      nationalPensionKrw: payrollEmployeeLine.nationalPensionKrw,
      healthInsuranceKrw: payrollEmployeeLine.healthInsuranceKrw,
      longTermCareKrw: payrollEmployeeLine.longTermCareKrw,
      employmentInsuranceKrw: payrollEmployeeLine.employmentInsuranceKrw,
      otherDeductionKrw: payrollEmployeeLine.otherDeductionKrw,
      noticeMatchStatus: payrollEmployeeLine.noticeMatchStatus,
      status: payrollEmployeeLine.status,
      issueCode: payrollEmployeeLine.issueCode,
      issueMessage: payrollEmployeeLine.issueMessage,
    })
    .from(payrollEmployeeLine)
    .where(and(
      eq(payrollEmployeeLine.tenantId, tenantId),
      eq(payrollEmployeeLine.clientId, businessEntity.id),
      eq(payrollEmployeeLine.periodSummaryId, periodSummaryRow.id),
    ))
    .orderBy(asc(payrollEmployeeLine.status), asc(payrollEmployeeLine.employeeName), asc(payrollEmployeeLine.id))

  const registerRows = lineRows.map((row) => buildPayrollRegisterRow(row, canViewEmployeeNames))
  const summaryTotals = buildPayrollSummaryTotals(registerRows, { closeStatus: periodSummaryRow.closeStatus })

  return {
    ...base,
    period,
    summary: summaryTotals,
    issueAlert: buildPayrollIssueAlert(registerRows),
    registerRows,
    deductionBreakdown: buildPayrollDeductionBreakdown(registerRows),
    documents: buildPayrollDocuments(periodSummaryRow),
    closeAction: buildPayrollCloseAction(summaryTotals),
  }
}
