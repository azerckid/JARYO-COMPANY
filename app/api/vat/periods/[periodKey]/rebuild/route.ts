import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { requireTenantSession } from '@/lib/auth-helpers'
import { getActiveStaffForUser } from '@/lib/bookkeeping/classification-service'
import { db } from '@/lib/db'
import { client, vatDeductionReview, vatPeriodSummary } from '@/lib/db/schema'
import { loadVatPackageGate } from '@/lib/vat/package-gate'
import { rebuildVatPeriodSummaryFromConfirmedLedger } from '@/lib/vat/provenance'
import { vatPeriodKeySchema } from '@/lib/validations/vat'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ periodKey: string }> },
) {
  try {
    const { user, tenantId } = await requireTenantSession()
    const { periodKey: rawPeriodKey } = await params
    const periodKey = vatPeriodKeySchema.safeParse(rawPeriodKey)
    if (!periodKey.success) {
      return NextResponse.json({ error: periodKey.error.message }, { status: 400 })
    }

    const staffRecord = await getActiveStaffForUser({ userId: user.id, tenantId })
    if (!staffRecord) {
      return NextResponse.json({ error: '담당자 정보를 찾을 수 없습니다.' }, { status: 403 })
    }

    const [businessEntity] = await db
      .select({ id: client.id })
      .from(client)
      .where(eq(client.tenantId, tenantId))
      .orderBy(client.createdAt)
      .limit(1)
    if (!businessEntity) {
      return NextResponse.json({ error: '사업장을 먼저 등록해 주세요.' }, { status: 404 })
    }

    const [summaryRows, reviewRows] = await Promise.all([
      db
        .select({ id: vatPeriodSummary.id })
        .from(vatPeriodSummary)
        .where(and(
          eq(vatPeriodSummary.tenantId, tenantId),
          eq(vatPeriodSummary.clientId, businessEntity.id),
          eq(vatPeriodSummary.periodKey, periodKey.data),
          eq(vatPeriodSummary.filingType, 'final'),
        ))
        .limit(1),
      db
        .select({ decision: vatDeductionReview.decision })
        .from(vatDeductionReview)
        .where(and(
          eq(vatDeductionReview.tenantId, tenantId),
          eq(vatDeductionReview.clientId, businessEntity.id),
          eq(vatDeductionReview.periodKey, periodKey.data),
        )),
    ])
    if (!summaryRows[0]) {
      return NextResponse.json({ error: '부가세 summary가 아직 생성되지 않았습니다.' }, { status: 404 })
    }

    const packageGate = await loadVatPackageGate({
      tenantId,
      clientId: businessEntity.id,
      periodKey: periodKey.data,
      hasSummary: true,
      pendingDeductionCount: reviewRows.filter((row) => row.decision === 'pending').length,
    })

    if (packageGate.provenance.isReady) {
      return NextResponse.json({ ok: true, alreadyVerified: true })
    }
    if (!packageGate.provenance.canRebuild) {
      return NextResponse.json({
        error: '확정 원장 재계산 조건을 먼저 완료해 주세요.',
        code: 'vat_provenance_rebuild_blocked',
        blockerCount: packageGate.blockerCount,
        reasons: packageGate.reasons,
      }, { status: 409 })
    }

    const result = await rebuildVatPeriodSummaryFromConfirmedLedger({
      tenantId,
      clientId: businessEntity.id,
      periodKey: periodKey.data,
    })
    if (!result.ok) {
      return NextResponse.json({
        error: '확정 원장 재계산에 필요한 거래를 확인해 주세요.',
        code: 'vat_provenance_rebuild_failed',
        issues: result.issues,
      }, { status: result.status })
    }

    revalidatePath('/dashboard/vat')
    revalidatePath('/dashboard')

    return NextResponse.json({
      ok: true,
      provenanceVersion: result.snapshot.provenanceVersion,
      sourceRowCount: result.snapshot.sourceRowCount,
      rebuiltAt: result.rebuiltAt,
    })
  } catch (err) {
    console.error('[POST /api/vat/periods/[periodKey]/rebuild]', err)
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
