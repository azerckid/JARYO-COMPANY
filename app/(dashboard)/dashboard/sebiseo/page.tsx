import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth-helpers'
import { now } from '@/lib/time'
import { buildUpcomingSchedule } from '@/lib/tax-calendar'
import { SebiseoWorkspace } from './_components/sebiseo-workspace'

export default async function SebiseoPage() {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  const tenantId = session.session.activeOrganizationId
  if (!tenantId) redirect('/onboarding')

  // 첫 화면 로드에서 LLM provider를 호출하지 않는다(JC-043 Trust Contract).
  // 회사별 준비 상태가 아닌 공통 법정 세무 일정 1건만 정적 규칙 캘린더에서 읽는다.
  const [upcoming = null] = buildUpcomingSchedule(now('Asia/Seoul'), 1)

  return <SebiseoWorkspace upcoming={upcoming} />
}
