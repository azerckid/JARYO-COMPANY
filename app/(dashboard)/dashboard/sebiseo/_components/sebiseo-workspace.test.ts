import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspaceRoot = process.cwd()
const workspaceSource = readFileSync(
  join(workspaceRoot, 'app/(dashboard)/dashboard/sebiseo/_components/sebiseo-workspace.tsx'),
  'utf8',
)
const pageSource = readFileSync(
  join(workspaceRoot, 'app/(dashboard)/dashboard/sebiseo/page.tsx'),
  'utf8',
)
const previewSource = readFileSync(
  join(workspaceRoot, 'docs/02_UI_Screens/previews/19_sebiseo.html'),
  'utf8',
)

describe('세비서 workspace shell (JC-043 CUI-2)', () => {
  it('shows a neutral empty shell without fake DB-state chat', () => {
    expect(workspaceSource).toContain('bg-[#171717]')
    expect(workspaceSource).toContain('세무 일정(참고)')
    expect(workspaceSource).toContain('공통 세무 일정입니다. 회사별 준비 상태가 아닙니다.')
    expect(workspaceSource).toContain('세비서에게 묻기 (준비 중)')
    expect(workspaceSource).toContain('세비서도 실수할 수 있습니다. 중요한 정보는 다시 확인하세요.')
    expect(workspaceSource).toContain('대화·첨부·음성은 준비 중입니다.')
    expect(workspaceSource).not.toContain('새 채팅')
    expect(workspaceSource).not.toContain('확인 필요')
    expect(workspaceSource).not.toContain('Ready 62%')
    expect(workspaceSource).not.toContain('파일 올렸는데')
    expect(workspaceSource).not.toContain('예외·누락 거래가 있으니')
    expect(previewSource).toContain('세비서')
    expect(previewSource).toContain('세무 일정(참고)')
  })

  it('keeps first-load provider-free and only reads the reference schedule', () => {
    expect(pageSource).toContain('buildUpcomingSchedule')
    expect(pageSource).toContain(', 1)')
    expect(pageSource).toContain('정적 규칙 캘린더')
    expect(pageSource).not.toContain('enhanceVat')
    expect(pageSource).not.toContain('openai')
    expect(pageSource).not.toContain('anthropic')
  })

  it('keeps ChatGPT-shaped composer controls disabled until CUI-3', () => {
    expect(workspaceSource).toContain('Mic')
    expect(workspaceSource).toContain('AudioLines')
    expect(workspaceSource).toContain('Instant')
    expect(workspaceSource).toContain('disabled')
    expect(workspaceSource).toContain('준비 중 · 곧 연결됩니다')
    expect(workspaceSource).not.toContain('hover:bg-[#2f2f2f]')
  })
})
