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
  it('matches approved Preview: dark entry shell without chat-history rail', () => {
    expect(workspaceSource).toContain('bg-[#171717]')
    expect(workspaceSource).toContain('다가오는 신고')
    expect(workspaceSource).toContain('세비서에게 묻기')
    expect(workspaceSource).toContain('세비서도 실수할 수 있습니다. 중요한 정보는 다시 확인하세요.')
    expect(workspaceSource).not.toContain('새 채팅')
    expect(workspaceSource).not.toContain('확인 필요')
    expect(workspaceSource).not.toContain('Ready 62%')
    expect(previewSource).toContain('세비서')
  })

  it('keeps first-load provider-free and only reads upcoming schedule', () => {
    expect(pageSource).toContain('buildUpcomingSchedule')
    expect(pageSource).toContain(', 1)')
    expect(pageSource).not.toContain('enhanceVat')
    expect(pageSource).not.toContain('openai')
    expect(pageSource).not.toContain('anthropic')
  })

  it('exposes ChatGPT-matching composer icons without wiring product features', () => {
    expect(workspaceSource).toContain('Mic')
    expect(workspaceSource).toContain('AudioLines')
    expect(workspaceSource).toContain('Instant')
    expect(workspaceSource).toContain('Copy')
    expect(workspaceSource).toContain('RefreshCw')
  })
})
