import { z } from 'zod'

// 사업자 유형(개인/법인/면세). null = 미지정 → 신고 준비 허브 dimming 없음.
export const TAX_ENTITY_TYPES = ['individual', 'corporation', 'tax_exempt'] as const
export type TaxEntityType = (typeof TAX_ENTITY_TYPES)[number]

export const updateBusinessEntitySchema = z.object({
  taxEntityType: z.enum(TAX_ENTITY_TYPES).nullable(),
})

export type UpdateBusinessEntityInput = z.infer<typeof updateBusinessEntitySchema>

export function parseUpdateBusinessEntityInput(value: unknown) {
  return updateBusinessEntitySchema.safeParse(value)
}

export const TAX_ENTITY_TYPE_LABEL: Record<TaxEntityType, string> = {
  individual: '개인',
  corporation: '법인',
  tax_exempt: '면세 개인',
}
