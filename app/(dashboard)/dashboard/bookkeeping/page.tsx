import { redirect } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
import { loadBookkeepingReviewSummary } from '@/lib/bookkeeping-review/summary'
import {
  BookkeepingReviewBusinessEntityEmptyState,
  BookkeepingReviewView,
} from './_components/bookkeeping-review'

type PageProps = {
  searchParams: Promise<{
    period?: string
    tab?: string
    rowId?: string
  }>
}

export default async function BookkeepingReviewPage({ searchParams }: PageProps) {
  const { period, tab, rowId } = await searchParams
  let tenantId: string

  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
  } catch {
    redirect('/sign-in')
  }

  const summary = await loadBookkeepingReviewSummary({
    tenantId,
    periodKey: period,
    tab,
    selectedRowId: rowId,
  })

  if (!summary.businessEntity) {
    return <BookkeepingReviewBusinessEntityEmptyState tenantName={summary.tenant.name} />
  }

  return <BookkeepingReviewView summary={summary} />
}
