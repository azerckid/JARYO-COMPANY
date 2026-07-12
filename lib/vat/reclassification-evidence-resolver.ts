import { and, eq, ne } from 'drizzle-orm'
import { employeeProfile, vatDeductionReview } from '@/lib/db/schema'
import {
  detectReclassificationEvidence,
  type ReclassificationEvidenceResult,
} from './reclassification-evidence'

// JC-041 VAI-9b: 실제 데이터에서 재분류 근거 신호를 뽑아 VAI-9a 판정 함수
// (detectReclassificationEvidence)에 넘긴다. 1차 범위(Brief 51 §2.1)는 접대비
// (기업업무추진비)로 분류된 불공제 후보만 다룬다.
//
// 이 모듈은 read-only다. vat_deduction_review의 결정(decision)을 바꾸지 않으며,
// 재분류 확정은 사용자 액션(VAI-9e)에서만 일어난다.

const ENTERTAINMENT_REASON_KEYWORDS = ['접대비', '기업업무추진비']

export type ReclassificationCandidate = {
  reviewRowId: string
  description: string
  counterparty: string | null
  supplyAmountKrw: number
  inputTaxKrw: number
  result: ReclassificationEvidenceResult
}

// 적요 텍스트에서 참석자로 보이는 이름 후보를 뽑는다. "참석자: 홍길동, 김철수"처럼
// 명시적인 패턴만 인정한다. 그 외에는 null(정보 없음)을 반환한다 — 어설픈 추출로
// 오탐을 만드느니 "판단 불가"로 보수적으로 처리하는 게 안전하다(VAI-9a는
// attendeeNames가 null이면 부정 근거로 처리해 제안하지 않는다).
export function extractAttendeeNames(memoText: string): string[] | null {
  const match = /참석자\s*[:：]\s*([^/\n]+)/.exec(memoText)
  if (!match) return null
  const names = match[1]
    .split(/[,、·\s]+/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
  return names.length > 0 ? names : null
}

async function loadActiveEmployeeNames(tenantId: string, clientId: string): Promise<string[]> {
  const { db } = await import('@/lib/db')
  const rows = await db
    .select({ displayName: employeeProfile.displayName })
    .from(employeeProfile)
    .where(and(
      eq(employeeProfile.tenantId, tenantId),
      eq(employeeProfile.clientId, clientId),
      eq(employeeProfile.employeeStatus, 'active'),
    ))
  return rows.map((row) => row.displayName)
}

// 같은 tenant·사업장에서 같은 거래처의 과거(현재 기간 제외) 재분류 결정 이력을
// 찾는다. vat_deduction_review에 재분류 전용 스키마를 새로 만들지 않고 기존
// 감사 이력을 재사용한다: kind가 non_deductible_candidate로 시작했더라도 사용자가
// decision을 deductible로 확정했으면 재분류를 승인한 것이고, decision을
// non_deductible로 명시 확정했으면 접대비를 유지한 것이다.
async function loadPastDecisionForCounterparty(params: {
  tenantId: string
  clientId: string
  periodKey: string
  counterparty: string
}): Promise<'reclassified_as_benefit' | 'kept_as_entertainment' | null> {
  const { db } = await import('@/lib/db')
  const rows = await db
    .select({ decision: vatDeductionReview.decision })
    .from(vatDeductionReview)
    .where(and(
      eq(vatDeductionReview.tenantId, params.tenantId),
      eq(vatDeductionReview.clientId, params.clientId),
      eq(vatDeductionReview.counterparty, params.counterparty),
      eq(vatDeductionReview.kind, 'non_deductible_candidate'),
      ne(vatDeductionReview.periodKey, params.periodKey),
    ))

  if (rows.some((row) => row.decision === 'deductible')) return 'reclassified_as_benefit'
  if (rows.some((row) => row.decision === 'non_deductible')) return 'kept_as_entertainment'
  return null
}

// 현재 기간에 접대비로 분류된 불공제 후보 매입 거래를 찾아 재분류 근거를 판정한다.
export async function resolveReclassificationCandidates(params: {
  tenantId: string
  clientId: string
  periodKey: string
}): Promise<ReclassificationCandidate[]> {
  const { db } = await import('@/lib/db')
  const rows = await db
    .select({
      id: vatDeductionReview.id,
      description: vatDeductionReview.description,
      counterparty: vatDeductionReview.counterparty,
      supplyAmountKrw: vatDeductionReview.supplyAmountKrw,
      inputTaxKrw: vatDeductionReview.inputTaxKrw,
      reason: vatDeductionReview.reason,
    })
    .from(vatDeductionReview)
    .where(and(
      eq(vatDeductionReview.tenantId, params.tenantId),
      eq(vatDeductionReview.clientId, params.clientId),
      eq(vatDeductionReview.periodKey, params.periodKey),
      eq(vatDeductionReview.kind, 'non_deductible_candidate'),
    ))

  // 1차 범위: 접대비(기업업무추진비) 사유만 다룬다(Brief 51 §2.1). reason은
  // 자유 텍스트라 키워드로 걸러낸다.
  const entertainmentRows = rows.filter((row) =>
    ENTERTAINMENT_REASON_KEYWORDS.some((keyword) => row.reason.includes(keyword)))

  if (entertainmentRows.length === 0) return []

  const employeeNames = await loadActiveEmployeeNames(params.tenantId, params.clientId)

  const candidates: ReclassificationCandidate[] = []
  for (const row of entertainmentRows) {
    const pastDecision = row.counterparty
      ? await loadPastDecisionForCounterparty({
        tenantId: params.tenantId,
        clientId: params.clientId,
        periodKey: params.periodKey,
        counterparty: row.counterparty,
      })
      : null

    const result = detectReclassificationEvidence({
      memoText: row.description,
      counterpartyName: row.counterparty,
      attendeeNames: extractAttendeeNames(row.description),
      employeeDisplayNames: employeeNames,
      amountKrw: row.supplyAmountKrw,
      pastUserDecisionForSimilarPattern: pastDecision,
    })

    candidates.push({
      reviewRowId: row.id,
      description: row.description,
      counterparty: row.counterparty,
      supplyAmountKrw: row.supplyAmountKrw,
      inputTaxKrw: row.inputTaxKrw,
      result,
    })
  }

  return candidates
}
