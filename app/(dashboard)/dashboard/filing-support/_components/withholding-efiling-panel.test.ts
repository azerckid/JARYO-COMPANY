import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  join(process.cwd(), 'app/(dashboard)/dashboard/filing-support/_components/withholding-efiling-panel.tsx'),
  'utf8',
)

describe('withholding-efiling-panel Path 1b copy (JC-030)', () => {
  it('does not reference the abandoned Path 1a conversion-upload flow', () => {
    expect(source).not.toContain('바이너리 레이아웃')
    expect(source).not.toContain('변환 파일제출')
    expect(source).not.toContain('변환제출')
    expect(source).not.toContain('전자신고 파일 다운로드')
    expect(source).not.toContain('HOMETAX_WITHHOLDING_UPLOAD_STEPS')
    expect(source).not.toContain('바이너리 레이아웃 입수 후 활성화됩니다')
  })

  it('presents the confirmed Path 1b direct-entry framing', () => {
    expect(source).toContain('직접입력 정리')
    expect(source).toContain('항목 = 값')
    expect(source).toContain('공식 비암호화 업로드 양식이 없어')
    expect(source).toContain('지방소득세 (참고)')
    expect(source).toContain('efiling.localIncomeTaxKrw')
  })

  it('keeps the responsibility boundary excluding step-by-step Hometax guidance', () => {
    expect(source).toContain('홈택스 메뉴·입력칸 위치 단계별 안내')
    expect(source).not.toContain('STEP {step}')
  })

  it('does not duplicate internal routing/audit info the user does not need to file (JC-030 declutter)', () => {
    // "제공 경로 상태" formatChecks 블록은 헤더·책임 경계 문구와 중복되는
    // 내부 판정 정보였다. 완전히 제거하고 데이터 레이어(formatChecks)도
    // 함께 정리했다 — 화면에 남기지 않는다.
    expect(source).not.toContain('제공 경로 상태')
    expect(source).not.toContain('formatChecks')
    expect(source).not.toContain('검증 결과 보기')
    // 직접 입력 지시문은 헤더에 한 번만 있으면 된다.
    expect(source).not.toContain('직접입력 안내')
  })
})
