import { NextResponse } from 'next/server'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { client, staff } from '@/lib/db/schema'
import { requireTenantSession } from '@/lib/auth-helpers'
import { parseUpdateBusinessEntityInput } from '@/lib/validations/business-entity'

async function requireTenantAdmin() {
  const { user, tenantId } = await requireTenantSession()
  const staffRows = await db
    .select({ role: staff.role })
    .from(staff)
    .where(and(eq(staff.userId, user.id), eq(staff.tenantId, tenantId)))
    .limit(1)
  if (staffRows[0]?.role !== 'TENANT_ADMIN') throw new Error('Forbidden')
  return { user, tenantId }
}

// v1은 테넌트당 사업장 1개다. 기본(최초 등록) 사업장의 사업자 유형을 갱신한다.
async function loadPrimaryClientId(tenantId: string): Promise<string | null> {
  const rows = await db
    .select({ id: client.id })
    .from(client)
    .where(eq(client.tenantId, tenantId))
    .orderBy(asc(client.createdAt))
    .limit(1)
  return rows[0]?.id ?? null
}

export async function GET() {
  try {
    const { tenantId } = await requireTenantSession()
    const rows = await db
      .select({ id: client.id, name: client.name, taxEntityType: client.taxEntityType })
      .from(client)
      .where(eq(client.tenantId, tenantId))
      .orderBy(asc(client.createdAt))
      .limit(1)
    if (!rows[0]) return NextResponse.json({ error: '사업장을 찾을 수 없습니다' }, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (err) {
    console.error('[GET /api/settings/business-entity]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const { tenantId } = await requireTenantAdmin()
    const parsed = parseUpdateBusinessEntityInput(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: '사업자 유형 값이 올바르지 않습니다.' }, { status: 400 })
    }

    const clientId = await loadPrimaryClientId(tenantId)
    if (!clientId) {
      return NextResponse.json({ error: '사업장을 먼저 등록해 주세요.' }, { status: 404 })
    }

    await db
      .update(client)
      .set({ taxEntityType: parsed.data.taxEntityType })
      .where(and(eq(client.id, clientId), eq(client.tenantId, tenantId)))

    return NextResponse.json({ id: clientId, taxEntityType: parsed.data.taxEntityType })
  } catch (err) {
    if (err instanceof Error && err.message === 'Forbidden') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }
    console.error('[PATCH /api/settings/business-entity]', err)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
