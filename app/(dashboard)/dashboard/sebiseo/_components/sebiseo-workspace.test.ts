import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspaceRoot = process.cwd()
const workspaceSource = readFileSync(
  join(workspaceRoot, 'app/(dashboard)/dashboard/sebiseo/_components/sebiseo-workspace.tsx'),
  'utf8',
)
const periodConfirmSource = readFileSync(
  join(workspaceRoot, 'app/(dashboard)/dashboard/sebiseo/_components/sebiseo-period-confirm.tsx'),
  'utf8',
)
const pageSource = readFileSync(
  join(workspaceRoot, 'app/(dashboard)/dashboard/sebiseo/page.tsx'),
  'utf8',
)
const uploadClientSource = readFileSync(
  join(workspaceRoot, 'lib/sebiseo/upload-client.ts'),
  'utf8',
)

describe('세비서 workspace shell (JC-043 CUI-3a)', () => {
  it('keeps trust shell and enables attach with period confirm gate', () => {
    expect(workspaceSource).toContain('bg-[#171717]')
    expect(workspaceSource).toContain('세무 일정(참고)')
    expect(workspaceSource).toContain('세비서에게 묻기 (준비 중)')
    expect(workspaceSource).toContain('대화·Instant·음성은 준비 중입니다')
    expect(workspaceSource).toContain('파일 첨부')
    expect(workspaceSource).toContain('SebiseoPeriodConfirm')
    expect(workspaceSource).not.toContain('파일 올렸는데')
    expect(workspaceSource).not.toContain('예외·누락 거래가 있으니')
    expect(periodConfirmSource).toContain('적용 기간 확인')
    expect(periodConfirmSource).toContain('확인 후 업로드')
  })

  it('keeps Instant/Mic/Voice disabled and does not call chat API', () => {
    expect(workspaceSource).toContain('Instant')
    expect(workspaceSource).toContain('AudioLines')
    expect(workspaceSource).toMatch(/title=\{COMING_SOON\}[\s\S]*Instant/)
    expect(workspaceSource).not.toContain('/api/sebiseo/chat')
    expect(pageSource).not.toContain('openai')
    expect(pageSource).not.toContain('anthropic')
  })

  it('wires upload only through confirmed period + existing staff_direct path', () => {
    expect(pageSource).toContain('buildSebiseoPeriodOptions')
    expect(pageSource).toContain('loadSourceCollectionSummary')
    expect(uploadClientSource).toContain('/api/staff-direct-upload')
    expect(uploadClientSource).toContain('/api/upload/submit')
    expect(workspaceSource).toContain('createSebiseoUploadSession')
    expect(workspaceSource).toContain('Period confirm is required before any staff-direct-upload call')
  })
})
