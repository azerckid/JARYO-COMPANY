import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const viewSource = readFileSync(new URL('./vat-hometax-input-view.tsx', import.meta.url), 'utf8')
const pageSource = readFileSync(new URL('../page.tsx', import.meta.url), 'utf8')
const summarySource = readFileSync(
  new URL('../../../../../../lib/vat/hometax-input-summary.ts', import.meta.url),
  'utf8',
)

describe('VAT Hometax Path 1b static contract', () => {
  it('uses the approved route, one input table, and three display modes (S-1B4, S-1B6)', () => {
    expect(pageSource).toContain('loadVatHometaxInputSummary')
    expect(viewSource).toContain('일반과세자 부가가치세 신고서')
    expect(viewSource).toContain('홈택스 신고서 위치')
    expect(viewSource).toContain('값 비교·수정')
    expect(viewSource).toContain('자동 계산 대조')
    expect(viewSource).toContain('최종 확인')
  })

  it('keeps values hidden in non-ready states and line 27 Hometax-owned (S-1B5, S-1B7)', () => {
    expect(viewSource).toContain("summary.gate.status === 'ready'")
    expect(summarySource).toContain("summary.gate.status !== 'ready' && summary.rows.length > 0")
    expect(summarySource).toContain("row.formLine === '(27)'")
    expect(viewSource).toContain('(27)은 홈택스에서 최종 확인합니다.')
    expect(viewSource).toContain("if (row.formLine === '(27)') return '홈택스 계산값'")
  })

  it('does not repeat AI workflow or offer files and automated filing (S-1B8)', () => {
    for (const forbidden of [
      'AI 근거',
      'confidence',
      'provider',
      '증빙 trace',
      '파일 생성',
      '파일 다운로드',
      '자동 제출',
    ]) {
      expect(viewSource).not.toContain(forbidden)
    }
    expect(summarySource).toContain('includeStoredTaxTreatmentAi: false')
    expect(viewSource).toContain('홈택스 입력·최종 제출·납부는 사용자가 직접 진행')
  })
})
