import { redirect } from 'next/navigation'
import { requireTenantSession } from '@/lib/auth-helpers'
import { loadPayrollWorkspaceSummary } from '@/lib/payroll-workspace/summary'
import { PayrollBusinessEntityEmptyState, PayrollWorkspace } from './_components/payroll-workspace'

type PageProps = {
  searchParams: Promise<{
    period?: string
  }>
}

export default async function PayrollPage({ searchParams }: PageProps) {
  const { period } = await searchParams
  let tenantId: string

  try {
    const session = await requireTenantSession()
    tenantId = session.tenantId
  } catch {
    redirect('/sign-in')
  }

  const summary = await loadPayrollWorkspaceSummary({ tenantId, periodKey: period })

  if (!summary.businessEntity) {
    return <PayrollBusinessEntityEmptyState tenantName={summary.tenant.name} />
  }

  return <PayrollWorkspace summary={summary} />
}
