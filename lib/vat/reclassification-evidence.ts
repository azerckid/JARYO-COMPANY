import { z } from 'zod'

// 부가세 매입 재분류 근거 판정 — 접대비 → 복리후생비/회의비 (JC-041 VAI-9a).
//
// 이 함수는 이미 추출된 구조화 신호(참석자 명단·적요 텍스트·과거 확정 이력)를 받아
// 재분류를 제안해도 되는지만 판정하는 순수 함수다. 신호를 원문에서 뽑아내는 작업
// (적요 파싱, 과거 이력 조회, 직원명부 조회)은 VAI-9b evidence resolver의 몫이며,
// 이 함수는 그 결과를 입력으로 받는다.
//
// 근거: Brief 51 §4.1(positive evidence)·§4.2(negative evidence).
// - §4.2 부정 근거가 하나라도 있으면 긍정 근거와 무관하게 제안하지 않는다(부정 근거 우선).
// - 부정 근거가 없어도 긍정 근거가 하나도 없으면 "판단 불가"로 보아 제안하지 않는다
//   (§4.3 No Evidence Means No Proposal) — 확신 없는 제안 금지.
//
// 1차 범위: 법정 불공제 사유 ④ 접대비(기업업무추진비)만 다룬다(Brief 51 §2.1).

export const RECLASSIFICATION_TARGET_CATEGORIES = ['welfare_expense', 'meeting_expense'] as const
export type ReclassificationTargetCategory = (typeof RECLASSIFICATION_TARGET_CATEGORIES)[number]

export const reclassificationEvidenceInputSchema = z.object({
  // 거래 적요/메모 원문. 없으면 빈 문자열.
  memoText: z.string().default(''),
  // 적요·거래처 데이터에서 식별된 거래처명. 없으면 null.
  counterpartyName: z.string().nullable().default(null),
  // 적요 등에서 파싱된 참석자 이름 목록. 파싱 불가/정보 없음이면 반드시 null을 준다
  // (빈 배열을 "참석자 0명 확인"의 의미로 쓰지 않는다 — 정보 없음과 구분되지 않으면
  // 오탐 위험이 있다).
  attendeeNames: z.array(z.string()).nullable().default(null),
  // 같은 tenant·사업장의 활성 직원 표시 이름(대조용).
  employeeDisplayNames: z.array(z.string()).default([]),
  // 거래 금액(원 단위, 절사 전).
  amountKrw: z.number().int().nonnegative(),
  // 반복적인 소액 식대로 볼 수 있는 상한선(원). 이 금액을 넘으면 접대성 지출 특징과
  // 더 가깝다고 보아 부정 근거로 취급한다. 법정 기준이 아니라 운영 임계값이며 실제
  // 데이터로 VAI-9b에서 재조정한다.
  largeAmountThresholdKrw: z.number().int().positive().default(500_000),
  // 같은 tenant에서 유사 패턴(동일 거래처·비슷한 금액대·정기 주기) 거래에 대한
  // 사용자의 과거 확정 이력. 없으면 null.
  pastUserDecisionForSimilarPattern: z
    .enum(['reclassified_as_benefit', 'kept_as_entertainment'])
    .nullable()
    .default(null),
})

export type ReclassificationEvidenceInput = z.input<typeof reclassificationEvidenceInputSchema>

type EvidenceSignal = {
  type:
    | 'attendees_all_internal'
    | 'internal_event_keyword'
    | 'historical_pattern_benefit'
    | 'external_counterparty_named'
    | 'attendees_unknown'
    | 'large_amount'
    | 'historical_pattern_entertainment'
  summary: string
}

export type ReclassificationEvidenceResult =
  | {
      hasEvidence: true
      suggestedCategory: ReclassificationTargetCategory
      evidence: EvidenceSignal[]
    }
  | {
      hasEvidence: false
      reason: string
      blockingEvidence: EvidenceSignal[]
    }

// 아래 두 키워드 목록은 법령 기준이 아니라 초기 휴리스틱이다. 실제 적요 데이터로
// VAI-9b에서 검증·조정한다(오탐이 잦으면 부정 근거 쪽을 더 보수적으로 좁힌다).
const INTERNAL_EVENT_KEYWORDS = ['회식', '워크샵', '워크숍', '전 직원', '전직원', '팀 미팅', '팀미팅', '내부 행사', '단합']
const EXTERNAL_COUNTERPARTY_KEYWORDS = ['대표', '이사', '팀장', '거래처', '고객사', '바이어']
const CORPORATE_SUFFIX_PATTERN = /(주식회사|㈜|\(주\)|상사|물산|기업|산업)/

function normalize(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase()
}

function attendeesAllInternal(attendeeNames: string[], employeeDisplayNames: string[]): boolean {
  if (attendeeNames.length === 0) return false
  const employeeSet = new Set(employeeDisplayNames.map(normalize))
  return attendeeNames.every((name) => employeeSet.has(normalize(name)))
}

function memoMentionsInternalEvent(memoText: string): boolean {
  const normalized = normalize(memoText)
  return INTERNAL_EVENT_KEYWORDS.some((keyword) => normalized.includes(normalize(keyword)))
}

function memoMentionsExternalCounterparty(memoText: string, counterpartyName: string | null): boolean {
  const normalized = normalize(memoText)
  if (EXTERNAL_COUNTERPARTY_KEYWORDS.some((keyword) => normalized.includes(normalize(keyword)))) return true
  if (counterpartyName && CORPORATE_SUFFIX_PATTERN.test(counterpartyName)) return true
  return false
}

export function detectReclassificationEvidence(
  rawInput: ReclassificationEvidenceInput,
): ReclassificationEvidenceResult {
  const input = reclassificationEvidenceInputSchema.parse(rawInput)

  // §4.2 부정 근거를 먼저 확인한다. 하나라도 있으면 긍정 근거와 무관하게 제안하지 않는다.
  const blocking: EvidenceSignal[] = []

  if (memoMentionsExternalCounterparty(input.memoText, input.counterpartyName)) {
    blocking.push({
      type: 'external_counterparty_named',
      summary: '적요 또는 거래처명에 외부 거래처를 특정하는 표현이 있습니다.',
    })
  }

  if (input.attendeeNames === null) {
    blocking.push({
      type: 'attendees_unknown',
      summary: '참석자 정보가 없어 내부/외부 여부를 판단할 수 없습니다.',
    })
  }

  if (input.amountKrw > input.largeAmountThresholdKrw) {
    blocking.push({
      type: 'large_amount',
      summary: `금액(${input.amountKrw.toLocaleString('ko-KR')}원)이 반복적인 소액 식대 패턴보다 큽니다.`,
    })
  }

  if (input.pastUserDecisionForSimilarPattern === 'kept_as_entertainment') {
    blocking.push({
      type: 'historical_pattern_entertainment',
      summary: '같은 tenant에서 유사 패턴 거래를 접대비로 명시 재확정한 이력이 있습니다.',
    })
  }

  if (blocking.length > 0) {
    return {
      hasEvidence: false,
      reason: '부정 근거가 확인되어 원래 분류(접대비/불공제)를 유지합니다.',
      blockingEvidence: blocking,
    }
  }

  // §4.1 긍정 근거를 확인한다. 부정 근거가 없어도 긍정 근거가 하나도 없으면
  // "판단 불가"로 보아 제안하지 않는다(§4.3).
  const positive: EvidenceSignal[] = []

  if (input.attendeeNames && attendeesAllInternal(input.attendeeNames, input.employeeDisplayNames)) {
    positive.push({
      type: 'attendees_all_internal',
      summary: '참석자 전원이 내부 직원 명단과 일치합니다.',
    })
  }

  if (memoMentionsInternalEvent(input.memoText)) {
    positive.push({
      type: 'internal_event_keyword',
      summary: '적요에 내부 행사를 특정하는 표현이 있습니다.',
    })
  }

  if (input.pastUserDecisionForSimilarPattern === 'reclassified_as_benefit') {
    positive.push({
      type: 'historical_pattern_benefit',
      summary: '같은 tenant에서 유사 패턴 거래를 복리후생비·회의비로 재분류 확정한 이력이 있습니다.',
    })
  }

  if (positive.length === 0) {
    return {
      hasEvidence: false,
      reason: '재분류를 뒷받침할 긍정 근거를 찾지 못해 원래 분류를 유지합니다.',
      blockingEvidence: [],
    }
  }

  // 참석자 근거 또는 과거 이력이 있으면 복리후생비(직원 대상 행사)로, 적요 키워드만
  // 있으면 회의비로 우선 제안한다.
  const suggestedCategory: ReclassificationTargetCategory = positive.some(
    (item) => item.type === 'attendees_all_internal' || item.type === 'historical_pattern_benefit',
  )
    ? 'welfare_expense'
    : 'meeting_expense'

  return { hasEvidence: true, suggestedCategory, evidence: positive }
}
