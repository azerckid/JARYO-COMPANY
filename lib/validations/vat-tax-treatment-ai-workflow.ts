import { z } from 'zod'
import { vatPeriodKeySchema } from './vat'

export const vatTaxTreatmentAiWorkflowStatusSchema = z.enum([
  'idle',
  'checking',
  'ready',
  'manual_fallback',
  'stale',
])

export const vatTaxTreatmentAiWorkflowStateSchema = z.object({
  rowId: z.string().min(1),
  status: vatTaxTreatmentAiWorkflowStatusSchema,
  canEvaluate: z.boolean(),
  completedAt: z.string().min(1).nullable(),
  nextRetryAt: z.string().min(1).nullable(),
})

export const vatTaxTreatmentAiRunRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('evaluate_missing') }),
  z.object({
    action: z.literal('reevaluate_row'),
    rowId: z.string().min(1),
    expectedFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  }),
])

export const vatTaxTreatmentAiRunResponseSchema = z.object({
  ok: z.literal(true),
  periodKey: vatPeriodKeySchema,
  states: z.array(vatTaxTreatmentAiWorkflowStateSchema),
})

export type VatTaxTreatmentAiWorkflowStatus = z.infer<typeof vatTaxTreatmentAiWorkflowStatusSchema>
export type VatTaxTreatmentAiWorkflowState = z.infer<typeof vatTaxTreatmentAiWorkflowStateSchema>
export type VatTaxTreatmentAiRunRequest = z.infer<typeof vatTaxTreatmentAiRunRequestSchema>
export type VatTaxTreatmentAiRunResponse = z.infer<typeof vatTaxTreatmentAiRunResponseSchema>
