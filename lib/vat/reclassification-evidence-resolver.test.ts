import { describe, expect, it } from 'vitest'
import { extractAttendeeNames } from './reclassification-evidence-resolver'

// resolveReclassificationCandidates 등 DB 조회 래퍼는 이 저장소 관례상(다른
// lib/vat/*.ts와 동일) 단위 테스트 대상이 아니다 — 순수 판정 로직은
// reclassification-evidence.test.ts에서 이미 검증했고, DB 연결부는 dev 서비스
// E2E(VAI-9e)에서 검증한다. 여기서는 이번에 새로 추가된 유일한 순수 로직인
// 적요 참석자 파서만 단위 테스트한다.
describe('extractAttendeeNames (JC-041 VAI-9b)', () => {
  it('"참석자: 이름, 이름" 패턴에서 이름 목록을 뽑는다', () => {
    expect(extractAttendeeNames('팀 회식 / 참석자: 김대표, 이수민, 박지훈'))
      .toEqual(['김대표', '이수민', '박지훈'])
  })

  it('전각 콜론(：)도 인식한다', () => {
    expect(extractAttendeeNames('참석자：김대표 이수민')).toEqual(['김대표', '이수민'])
  })

  it('구분자로 공백만 있어도 이름을 나눈다', () => {
    expect(extractAttendeeNames('참석자: 김대표 이수민 박지훈')).toEqual(['김대표', '이수민', '박지훈'])
  })

  it('참석자 패턴이 없으면 null을 반환한다(정보 없음으로 취급)', () => {
    expect(extractAttendeeNames('팀 회식')).toBeNull()
    expect(extractAttendeeNames('')).toBeNull()
  })

  it('"참석자:" 뒤에 실질 내용이 없으면 null을 반환한다', () => {
    expect(extractAttendeeNames('참석자: ')).toBeNull()
  })

  it('슬래시 뒤 다른 필드까지 이름으로 잘못 묶지 않는다', () => {
    expect(extractAttendeeNames('참석자: 김대표, 이수민 / 목적: 분기 회식'))
      .toEqual(['김대표', '이수민'])
  })
})
