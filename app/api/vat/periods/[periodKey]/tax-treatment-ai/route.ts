import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { executeVatTaxTreatmentAiRows } from '@/lib/vat/tax-treatment-ai-execution'
import {
  applyVatTaxTreatmentAiWorkflowStates,
  loadVatTaxTreatmentAiResultRows,
} from '@/lib/vat/tax-treatment-ai-result'
import { loadVatSummary } from '@/lib/vat/summary'
import { vatPeriodKeySchema } from '@/lib/validations/vat'
import {
  vatTaxTreatmentAiRunRequestSchema,
  vatTaxTreatmentAiRunResponseSchema,
} from '@/lib/validations/vat-tax-treatment-ai-workflow'

function workflowStates(rows: Awaited<ReturnType<typeof loadVatSummary>>['taxTreatmentRows']) {
  return rows.flatMap((row) => row.aiWorkflow ? [row.aiWorkflow] : [])
}

async function loadBaseRowsWithWorkflow(params: {
  tenantId: string
  periodKey: string
}) {
  const summary = await loadVatSummary({
    tenantId: params.tenantId,
    periodKey: params.periodKey,
    includeStoredTaxTreatmentAi: false,
  })
  if (!summary.businessEntity) return { summary, rows: [] }
  const resultRows = await loadVatTaxTreatmentAiResultRows({
    tenantId: params.tenantId,
    businessEntityId: summary.businessEntity.id,
    periodKey: summary.period.key,
    classificationRowIds: summary.taxTreatmentRows.map((row) => row.classificationRowId),
  })
  return {
    summary,
    rows: applyVatTaxTreatmentAiWorkflowStates({
      rows: summary.taxTreatmentRows,
      resultRows,
    }),
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ periodKey: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const parsedPeriod = vatPeriodKeySchema.safeParse((await params).periodKey)
    if (!parsedPeriod.success) {
      return NextResponse.json({ error: parsedPeriod.error.message }, { status: 400 })
    }
    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const summary = await loadVatSummary({
      tenantId,
      periodKey: parsedPeriod.data,
      includeStoredTaxTreatmentAi: true,
    })
    return NextResponse.json(vatTaxTreatmentAiRunResponseSchema.parse({
      ok: true,
      periodKey: summary.period.key,
      states: workflowStates(summary.taxTreatmentRows),
    }))
  } catch (error) {
    console.error('[GET /api/vat/periods/[periodKey]/tax-treatment-ai]', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'AI 판단 상태를 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ periodKey: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const parsedPeriod = vatPeriodKeySchema.safeParse((await params).periodKey)
    if (!parsedPeriod.success) {
      return NextResponse.json({ error: parsedPeriod.error.message }, { status: 400 })
    }
    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }
    const input = vatTaxTreatmentAiRunRequestSchema.safeParse(await request.json())
    if (!input.success) {
      return NextResponse.json({ error: input.error.message }, { status: 400 })
    }
    const reevaluateInput = input.data.action === 'reevaluate_row' ? input.data : null
    const requestedRowId = reevaluateInput?.rowId ?? null

    if (requestedRowId) {
      const displayed = await loadVatSummary({
        tenantId,
        periodKey: parsedPeriod.data,
        includeStoredTaxTreatmentAi: true,
      })
      const row = displayed.taxTreatmentRows.find((candidate) => candidate.rowId === requestedRowId)
      if (!row) return NextResponse.json({ error: '거래 행을 찾을 수 없습니다.' }, { status: 404 })
      if (row.recommendationFingerprint !== reevaluateInput!.expectedFingerprint) {
        return NextResponse.json({
          error: '판단 근거가 변경되었습니다. 화면을 새로고침한 뒤 다시 확인해 주세요.',
        }, { status: 409 })
      }
    }

    const current = await loadBaseRowsWithWorkflow({
      tenantId,
      periodKey: parsedPeriod.data,
    })
    if (!current.summary.businessEntity) {
      return NextResponse.json({ error: '사업장을 먼저 등록해 주세요.' }, { status: 404 })
    }
    await executeVatTaxTreatmentAiRows({
      rows: current.rows,
      action: requestedRowId
        ? { action: 'reevaluate_row', rowId: requestedRowId }
        : { action: 'evaluate_missing' },
    })

    const refreshed = await loadVatSummary({
      tenantId,
      periodKey: parsedPeriod.data,
      includeStoredTaxTreatmentAi: true,
    })
    revalidatePath('/dashboard/vat')
    return NextResponse.json(vatTaxTreatmentAiRunResponseSchema.parse({
      ok: true,
      periodKey: refreshed.period.key,
      states: workflowStates(refreshed.taxTreatmentRows),
    }))
  } catch (error) {
    console.error('[POST /api/vat/periods/[periodKey]/tax-treatment-ai]', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'AI 판단을 완료하지 못했습니다.' }, { status: 500 })
  }
}
