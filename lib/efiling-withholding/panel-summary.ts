import type { FilingTone } from '@/lib/filing-support/summary'
import { digitsOnly, formatPayrollPeriodLabel } from './format'
import type { ValidateWithholdingPanelInput, ValidationIssue, WithholdingFormA01 } from './types'
import { hasBlockingIssues } from './validate'
import { validateWithholdingPanel } from './validate-panel'

export type EfilingPanelTone = FilingTone

export type EfilingValidationDisplayItem = {
  id: string
  tone: EfilingPanelTone
  message: string
  employeeName?: string
  ruleId?: ValidationIssue['ruleId']
}

export type WithholdingEfilingSummary = {
  payrollPeriodKey: string
  payrollLabel: string
  a01: WithholdingFormA01
  stats: {
    confirmedCount: number
    attentionCount: number
    totalLines: number
  }
  validationItems: EfilingValidationDisplayItem[]
  hasBlockingDataIssues: boolean
  businessRegistrationMasked: string | null
  downloadAvailable: false
  binaryLayoutReady: false
  // 참고용(A01 서식 밖) — 원천세 특별징수분 지방소득세.
  localIncomeTaxKrw: number
}

export type WithholdingBusinessContext = {
  businessRegistrationNumber: string | null
  businessName: string
  representativeName: string | null
  maskedBusinessRegistrationNumber: string | null
}

function issueToDisplay(
  issue: ValidationIssue,
  employeeNameByKey: Map<string, string>,
): EfilingValidationDisplayItem {
  const tone: EfilingPanelTone = issue.severity === 'error' ? 'danger' : 'warn'

  return {
    id: `${issue.ruleId}:${issue.employeeKey ?? 'global'}:${issue.message}`,
    tone,
    message: issue.message,
    employeeName: issue.employeeKey ? employeeNameByKey.get(issue.employeeKey) : undefined,
    ruleId: issue.ruleId,
  }
}

export function buildWithholdingEfilingSummary(params: {
  panelInput: ValidateWithholdingPanelInput
  business: WithholdingBusinessContext
}): WithholdingEfilingSummary {
  const { panelInput, business } = params
  const employeeNameByKey = new Map(panelInput.lines.map((line) => [line.employeeKey, line.employeeName]))

  const dataIssues = validateWithholdingPanel(panelInput)

  const validationItems: EfilingValidationDisplayItem[] = []

  for (const issue of dataIssues) {
    validationItems.push(issueToDisplay(issue, employeeNameByKey))
  }

  const regDigits = business.businessRegistrationNumber ? digitsOnly(business.businessRegistrationNumber) : ''
  const structuralOk =
    regDigits.length === 10
    && business.businessName.trim().length > 0
    && (business.representativeName?.trim().length ?? 0) > 0
    && panelInput.closeStatus === 'closed'
    && !hasBlockingIssues(dataIssues)

  if (structuralOk) {
    validationItems.push({
      id: 'structural:a01-guide',
      tone: 'ok',
      message: 'A01 ④⑤⑥ — JC-013 신고 준비값과 일치 · 직접입력 정리 준비됨',
    })
  }

  const attentionCount = panelInput.lines.filter((line) => line.status === 'needs_review').length

  return {
    payrollPeriodKey: panelInput.payrollPeriodKey,
    payrollLabel: formatPayrollPeriodLabel(panelInput.payrollPeriodKey),
    a01: {
      employeeCount: panelInput.periodEmployeeCount,
      grossPayKrw: panelInput.periodGrossPayKrw,
      incomeTaxKrw: panelInput.confirmedIncomeTaxKrw,
    },
    stats: {
      confirmedCount: panelInput.confirmedEmployeeCount,
      attentionCount,
      totalLines: panelInput.lines.length,
    },
    validationItems,
    hasBlockingDataIssues: hasBlockingIssues(dataIssues),
    businessRegistrationMasked: business.maskedBusinessRegistrationNumber,
    downloadAvailable: false,
    binaryLayoutReady: false,
    localIncomeTaxKrw: panelInput.localIncomeTaxKrw,
  }
}
