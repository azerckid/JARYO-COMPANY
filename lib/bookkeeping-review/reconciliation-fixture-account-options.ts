import { BOOKKEEPING_ACCOUNT_CATEGORIES } from '@/lib/bookkeeping/account-categories'

export type ReconciliationFixtureAccountGroup = {
  label: string
  accounts: string[]
}

export const RECONCILIATION_FIXTURE_ACCOUNT_GROUPS: ReconciliationFixtureAccountGroup[] = [
  {
    label: '매출',
    accounts: ['매출'],
  },
  {
    label: '비용',
    accounts: [
      '소프트웨어비',
      '복리후생비',
      '여비교통비',
      '통신비',
      '지급수수료',
      '소모품비',
      '도메인/호스팅비',
      '운반비 / 배송비',
      '차량유지비',
      '접대비',
      '광고선전비',
      '지급임차료',
      '수도광열비',
      '보험료',
      '세금과공과',
      '인건비성 비용',
      '상품매입 / 원재료비',
    ],
  },
  {
    label: '영업외수익',
    accounts: ['이자수익', '정부지원금', '세금 환급', '잡이익', '외환차익'],
  },
  {
    label: '기타',
    accounts: BOOKKEEPING_ACCOUNT_CATEGORIES.map((category) => category.label).filter(
      (label) => !['매출', '이자수익'].includes(label),
    ),
  },
]

export function filterReconciliationFixtureAccountGroups(query: string): ReconciliationFixtureAccountGroup[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) {
    return RECONCILIATION_FIXTURE_ACCOUNT_GROUPS
  }

  return RECONCILIATION_FIXTURE_ACCOUNT_GROUPS.map((group) => ({
    ...group,
    accounts: group.accounts.filter((account) => account.toLowerCase().includes(normalized)),
  })).filter((group) => group.accounts.length > 0)
}
