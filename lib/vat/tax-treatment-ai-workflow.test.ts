import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  vatTaxTreatmentAiRunRequestSchema,
  vatTaxTreatmentAiRunResponseSchema,
} from '@/lib/validations/vat-tax-treatment-ai-workflow'

describe('VAI-7c async workflow contract', () => {
  it('accepts only bounded automatic and explicit recheck requests', () => {
    expect(vatTaxTreatmentAiRunRequestSchema.parse({ action: 'evaluate_missing' }))
      .toEqual({ action: 'evaluate_missing' })
    expect(vatTaxTreatmentAiRunRequestSchema.parse({
      action: 'reevaluate_row',
      rowId: 'row-1',
      expectedFingerprint: 'a'.repeat(64),
    })).toMatchObject({ action: 'reevaluate_row', rowId: 'row-1' })
    expect(vatTaxTreatmentAiRunRequestSchema.safeParse({
      action: 'reevaluate_row',
      rowId: 'row-1',
      expectedFingerprint: 'stale',
    }).success).toBe(false)
  })

  it('keeps the GET status path provider-free and the package gate isolated', () => {
    const route = readFileSync(
      new URL('../../app/api/vat/periods/[periodKey]/tax-treatment-ai/route.ts', import.meta.url),
      'utf8',
    )
    const gate = readFileSync(new URL('./tax-treatment-gate.ts', import.meta.url), 'utf8')
    expect(route).toContain('includeStoredTaxTreatmentAi: true')
    expect(route).not.toContain('includeTaxTreatmentAi: true')
    expect(gate).toContain('includeStoredAi: false')
  })

  it('requires an active staff record before reading or running AI status, matching the sibling mutation route', () => {
    const route = readFileSync(
      new URL('../../app/api/vat/periods/[periodKey]/tax-treatment-ai/route.ts', import.meta.url),
      'utf8',
    )
    const [getBody, postBody] = route.split('export async function POST(')
    expect(getBody).toContain('getActiveStaffForUser')
    expect(postBody).toContain('getActiveStaffForUser')
    expect(route).toContain("error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 }")
  })

  it('validates all visible workflow states returned to the client', () => {
    const states = ['idle', 'checking', 'ready', 'manual_fallback', 'stale'].map((status, index) => ({
      rowId: `row-${index}`,
      status,
      canEvaluate: true,
      completedAt: status === 'ready' ? '2026-07-12T10:00:00.000+09:00' : null,
      nextRetryAt: null,
    }))
    expect(vatTaxTreatmentAiRunResponseSchema.parse({
      ok: true,
      periodKey: '2026-H1',
      states,
    }).states).toHaveLength(5)
  })

  it('keeps recheck in the AI judgment cell and preserves bounded polling', () => {
    const component = readFileSync(
      new URL('../../app/(dashboard)/dashboard/vat/_components/vat-tax-treatment-ai-workflow.tsx', import.meta.url),
      'utf8',
    )
    const workspace = readFileSync(
      new URL('../../app/(dashboard)/dashboard/vat/_components/vat-workspace.tsx', import.meta.url),
      'utf8',
    )
    expect(component).toContain('POLL_INTERVAL_MS = 3_000')
    expect(component).toContain('MAX_POLL_COUNT = 20')
    expect(component).toContain('AI 다시 확인')
    expect(component).toContain("state.status === 'idle' || state.status === 'stale'")
    expect(workspace.indexOf('VatTaxTreatmentAiWorkflowStatus')).toBeLessThan(
      workspace.indexOf('VatTaxTreatmentActions row={row}'),
    )
  })
})
