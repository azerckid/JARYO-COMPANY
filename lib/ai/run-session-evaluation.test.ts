import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  evaluateSessionAgainstCriteria: vi.fn(),
  generateMissingRequestDraft: vi.fn(),
}))

vi.mock('./session-eval', () => ({
  evaluateSessionAgainstCriteria: mocks.evaluateSessionAgainstCriteria,
}))

vi.mock('@/lib/db', () => ({
  db: {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  },
}))

vi.mock('@/lib/db/schema', () => ({
  uploadSession: {
    id: 'upload_session.id',
    tenantId: 'upload_session.tenant_id',
    status: 'upload_session.status',
  },
}))

vi.mock('@/lib/email/missing-request', () => ({
  generateMissingRequestDraft: mocks.generateMissingRequestDraft,
}))

const { runSessionEvaluationPipeline } = await import('./run-session-evaluation')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('runSessionEvaluationPipeline', () => {
  it('keeps needs_resubmission outcomes without creating legacy missing-request drafts', async () => {
    mocks.evaluateSessionAgainstCriteria.mockResolvedValue({
      ok: true,
      status: 'needs_resubmission',
    })

    const result = await runSessionEvaluationPipeline('session-1', 'tenant-1')

    expect(result).toEqual({ ok: true, status: 'needs_resubmission' })
    expect(mocks.generateMissingRequestDraft).not.toHaveBeenCalled()
  })
})
