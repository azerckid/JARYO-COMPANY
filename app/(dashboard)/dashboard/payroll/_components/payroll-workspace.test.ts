import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const componentsDir = new URL('.', import.meta.url)
const workspaceRoot = join(componentsDir.pathname, '../../../../..')
const workspaceSource = readFileSync(new URL('./payroll-workspace.tsx', import.meta.url), 'utf8')
const pageSource = readFileSync(new URL('../page.tsx', import.meta.url), 'utf8')
const sidebarSource = readFileSync(join(workspaceRoot, 'app/(dashboard)/_components/sidebar.tsx'), 'utf8')
const companyHomeSummarySource = readFileSync(join(workspaceRoot, 'lib/company-home/summary.ts'), 'utf8')

describe('payroll workspace static contract (JC-012)', () => {
  it('renders the approved Preview 4.5 section order (S-01)', () => {
    const sectionOrder = [
      'PayrollSummaryHero',
      'IssueAlert',
      'PayrollRegisterSection',
      'DeductionBreakdownCard',
      'PayrollDocumentsCard',
      'StateCoverageSection',
    ]
    const positions = sectionOrder.map((token) => workspaceSource.indexOf(`<${token}`))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('does not render the old GIWA payroll request workspace at /dashboard/payroll (S-60)', () => {
    const forbidden = [
      'PayrollRequestList',
      'loadPayrollSummaries',
      'clientRequestEvent',
      '요청 목록을 테이블로 스캔',
      '기본업무메일',
    ]

    for (const token of forbidden) {
      expect(pageSource).not.toContain(token)
      expect(workspaceSource).not.toContain(token)
    }
  })

  it('keeps EDI automation and credential storage outside the actionable UI (S-36, S-91)', () => {
    expect(workspaceSource).toContain('건강보험 EDI/사회보험 고지액')
    expect(workspaceSource).toContain('자동 로그인')
    expect(workspaceSource).toContain('공동인증서 저장')
    expect(workspaceSource).not.toContain('EDI 자동 로그인</button>')
    expect(workspaceSource).not.toContain('공동인증서 저장</button>')
  })

  it('keeps the payroll close button visibly locked when closeAction is locked (S-50)', () => {
    expect(workspaceSource).toContain('summary.closeAction.locked')
    expect(workspaceSource).toContain('aria-disabled={summary.closeAction.locked}')
    expect(workspaceSource).toContain('급여 마감·확정 · 잠김')
  })

  it('routes company navigation to the preview-aligned payroll screen (S-02)', () => {
    expect(sidebarSource).toContain("href: '/dashboard/payroll'")
    expect(companyHomeSummarySource).toContain("payroll: '/dashboard/payroll'")
  })
})
