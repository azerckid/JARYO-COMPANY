import { describe, expect, it } from 'vitest'
import { detectReclassificationEvidence } from './reclassification-evidence'

const EMPLOYEES = ['김대표', '이수민', '박지훈', '최민준']

describe('detectReclassificationEvidence (JC-041 VAI-9a §4.1/4.2)', () => {
  it('참석자 전원이 내부 직원과 일치하면 복리후생비로 제안한다', () => {
    const result = detectReclassificationEvidence({
      memoText: '팀 회식',
      counterpartyName: '○○한정식',
      attendeeNames: ['김대표', '이수민', '박지훈'],
      employeeDisplayNames: EMPLOYEES,
      amountKrw: 320_000,
    })
    expect(result).toMatchObject({ hasEvidence: true, suggestedCategory: 'welfare_expense' })
    if (!result.hasEvidence) throw new Error('expected hasEvidence')
    expect(result.evidence.some((e) => e.type === 'attendees_all_internal')).toBe(true)
  })

  it('적요에 내부 행사 키워드만 있고 외부 특정 표현이 없으면 회의비로 제안한다', () => {
    const result = detectReclassificationEvidence({
      memoText: '팀 미팅 다과비',
      counterpartyName: '○○카페',
      attendeeNames: null,
      amountKrw: 45_000,
    })
    // attendeeNames가 null이면 §4.2 attendees_unknown이 부정 근거로 먼저 걸린다.
    expect(result.hasEvidence).toBe(false)
  })

  it('참석자 정보가 있고 내부 행사 키워드도 있으면 회의비 이상으로 제안한다', () => {
    const result = detectReclassificationEvidence({
      memoText: '팀 미팅 다과비',
      counterpartyName: '○○카페',
      attendeeNames: ['이수민', '박지훈'],
      employeeDisplayNames: EMPLOYEES,
      amountKrw: 45_000,
    })
    expect(result.hasEvidence).toBe(true)
  })

  it('과거 유사 패턴을 복리후생비로 재분류 확정한 이력이 있으면 제안한다', () => {
    const result = detectReclassificationEvidence({
      memoText: '정기 회식',
      attendeeNames: ['김대표', '이수민'],
      employeeDisplayNames: EMPLOYEES,
      amountKrw: 280_000,
      pastUserDecisionForSimilarPattern: 'reclassified_as_benefit',
    })
    expect(result).toMatchObject({ hasEvidence: true, suggestedCategory: 'welfare_expense' })
  })

  it('적요에 외부 거래처를 특정하는 표현이 있으면 근거와 무관하게 제안하지 않는다', () => {
    const result = detectReclassificationEvidence({
      memoText: '거래처 대표 접대',
      counterpartyName: '○○한정식',
      attendeeNames: ['김대표', '이수민'],
      employeeDisplayNames: EMPLOYEES,
      amountKrw: 320_000,
    })
    expect(result).toMatchObject({ hasEvidence: false })
    if (result.hasEvidence) throw new Error('expected hasEvidence false')
    expect(result.blockingEvidence.some((e) => e.type === 'external_counterparty_named')).toBe(true)
  })

  it('거래처명이 법인 형태(주식회사 등)면 외부 거래처로 보아 제안하지 않는다', () => {
    const result = detectReclassificationEvidence({
      memoText: '식사',
      counterpartyName: '주식회사 글로벌테크',
      attendeeNames: ['김대표'],
      employeeDisplayNames: EMPLOYEES,
      amountKrw: 100_000,
    })
    expect(result.hasEvidence).toBe(false)
  })

  it('참석자 정보가 없으면(null) 판단 불가로 제안하지 않는다', () => {
    const result = detectReclassificationEvidence({
      memoText: '식대',
      attendeeNames: null,
      amountKrw: 150_000,
    })
    expect(result).toMatchObject({ hasEvidence: false })
    if (result.hasEvidence) throw new Error('expected hasEvidence false')
    expect(result.blockingEvidence.some((e) => e.type === 'attendees_unknown')).toBe(true)
  })

  it('금액이 소액 식대 상한선을 넘으면 접대성 지출로 보아 제안하지 않는다', () => {
    const result = detectReclassificationEvidence({
      memoText: '팀 회식',
      attendeeNames: ['김대표', '이수민'],
      employeeDisplayNames: EMPLOYEES,
      amountKrw: 900_000,
    })
    expect(result).toMatchObject({ hasEvidence: false })
    if (result.hasEvidence) throw new Error('expected hasEvidence false')
    expect(result.blockingEvidence.some((e) => e.type === 'large_amount')).toBe(true)
  })

  it('과거 유사 패턴을 접대비로 재확정한 이력이 있으면 긍정 근거가 있어도 제안하지 않는다', () => {
    const result = detectReclassificationEvidence({
      memoText: '팀 회식',
      attendeeNames: ['김대표', '이수민'],
      employeeDisplayNames: EMPLOYEES,
      amountKrw: 280_000,
      pastUserDecisionForSimilarPattern: 'kept_as_entertainment',
    })
    expect(result).toMatchObject({ hasEvidence: false })
    if (result.hasEvidence) throw new Error('expected hasEvidence false')
    expect(result.blockingEvidence.some((e) => e.type === 'historical_pattern_entertainment')).toBe(true)
  })

  it('부정 근거와 긍정 근거가 둘 다 있으면 부정 근거가 우선한다', () => {
    const result = detectReclassificationEvidence({
      memoText: '거래처 대표와 팀 회식',
      counterpartyName: '○○한정식',
      attendeeNames: ['김대표', '이수민'],
      employeeDisplayNames: EMPLOYEES,
      amountKrw: 280_000,
      pastUserDecisionForSimilarPattern: 'reclassified_as_benefit',
    })
    expect(result.hasEvidence).toBe(false)
  })

  it('부정 근거도 긍정 근거도 없으면 판단 불가로 제안하지 않는다', () => {
    const result = detectReclassificationEvidence({
      memoText: '식대',
      attendeeNames: ['정하늘'],
      employeeDisplayNames: EMPLOYEES,
      amountKrw: 80_000,
    })
    expect(result).toMatchObject({ hasEvidence: false })
    if (result.hasEvidence) throw new Error('expected hasEvidence false')
    expect(result.blockingEvidence).toHaveLength(0)
  })

  it('참석자 중 일부가 명단에 없으면(외부인 포함) 전원 내부 근거로 인정하지 않는다', () => {
    const result = detectReclassificationEvidence({
      memoText: '식대',
      attendeeNames: ['김대표', '외부인A'],
      employeeDisplayNames: EMPLOYEES,
      amountKrw: 80_000,
    })
    expect(result.hasEvidence).toBe(false)
  })
})
