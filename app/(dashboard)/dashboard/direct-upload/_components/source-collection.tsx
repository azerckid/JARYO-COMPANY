import Link from 'next/link'
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  Landmark,
  Loader2,
  ReceiptText,
  RefreshCw,
  UploadCloud,
} from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { CompanyHomePeriod } from '@/lib/company-home/summary'
import {
  sourceCollectionSourceTypeLabel,
  type SourceCollectionCompleteness,
  type SourceCollectionImportRow,
  type SourceCollectionMissingItem,
  type SourceCollectionSourceTypeTile,
  type SourceCollectionSummary,
  type SourceCollectionTone,
} from '@/lib/source-collection/summary'
import { cn } from '@/lib/utils'

const toneBadgeVariant: Record<SourceCollectionTone, 'success' | 'warning' | 'secondary' | 'info'> = {
  ok: 'success',
  warn: 'warning',
  muted: 'secondary',
  info: 'info',
}

const sourceTypeIcon: Record<SourceCollectionSourceTypeTile['id'], ComponentType<{ className?: string }>> = {
  tax_invoice: FileText,
  bank_statement: Landmark,
  card_purchase: CreditCard,
  receipt_other: ReceiptText,
}

const fileStatusBadgeVariant: Record<string, 'success' | 'warning' | 'destructive' | 'secondary' | 'info'> = {
  matched: 'success',
  needs_review: 'warning',
  analyzing: 'info',
  uploaded: 'secondary',
  failed: 'destructive',
  rejected: 'destructive',
}

function formatPeriodEyebrow(period: CompanyHomePeriod) {
  if (period.key.endsWith('H1')) return `${period.key.slice(0, 4)}년 1기`
  if (period.key.endsWith('H2')) return `${period.key.slice(0, 4)}년 2기`
  return period.label
}

function formatUploadDate(isoDate: string) {
  const [, month, day] = isoDate.split('-')
  if (!month || !day) return isoDate
  return `${month}-${day}`
}

interface SectionHeaderProps {
  readonly id?: string
  readonly title: string
  readonly description: string
  readonly action?: ReactNode
}

function SectionHeader({ id, title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <h2 id={id} className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-xs text-muted-foreground">{description}</p>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  )
}

interface SourceCollectionHeaderProps {
  readonly summary: Pick<SourceCollectionSummary, 'tenant' | 'businessEntity' | 'period'>
}

export function SourceCollectionHeader({ summary }: SourceCollectionHeaderProps) {
  const currentYear = Number(summary.period.key.slice(0, 4))
  const currentHalf = summary.period.key.endsWith('H2') ? 'H2' : 'H1'
  const periodLinks = [
    { key: `${currentYear}-H1`, label: `${currentYear}년 1기` },
    { key: `${currentYear}-H2`, label: `${currentYear}년 2기` },
  ]

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground hover:underline">회사 홈</Link>
          <span aria-hidden="true"> › </span>
          <span>자료수집</span>
        </p>
        <h1 className="mt-1 text-xl font-semibold text-foreground">자료수집</h1>
        {summary.businessEntity && (
          <p className="mt-1 text-sm text-muted-foreground">{summary.businessEntity.name}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {periodLinks.map((period) => (
          <Link
            key={period.key}
            href={`/dashboard/direct-upload?period=${period.key}`}
            className={cn(
              'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
              summary.period.key === period.key || (summary.period.key.endsWith(currentHalf) && period.key.endsWith(currentHalf))
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-background text-muted-foreground hover:bg-muted',
            )}
          >
            {period.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

interface CompletenessHeaderProps {
  readonly completeness: SourceCollectionCompleteness
  readonly period: CompanyHomePeriod
}

export function CompletenessHeader({ completeness, period }: CompletenessHeaderProps) {
  const metaParts: string[] = []
  if (completeness.missingCount > 0) {
    metaParts.push(`필수 자료 ${completeness.missingCount}건 미수집`)
  }
  if (completeness.normalizationPendingCount > 0) {
    metaParts.push(`정규화 대기 ${completeness.normalizationPendingCount}건`)
  }
  if (metaParts.length === 0) {
    metaParts.push('나머지 확정 완료')
  } else if (completeness.collectedCount > 0) {
    metaParts.push('나머지 확정 완료')
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">
            수집 완결성 · {formatPeriodEyebrow(period)}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            자료 {completeness.collectedCount} / {completeness.requiredCount}건 수집됨
          </h2>
          <div className="mt-4 h-2 max-w-xl overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${completeness.progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{metaParts.join(' · ')}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 px-5 py-4 text-left md:text-right">
          <p className="text-xs font-semibold text-muted-foreground">미수집</p>
          <p className="mt-1 text-xl font-semibold text-foreground">
            {completeness.missingCount}
            <span className="text-sm font-normal text-muted-foreground"> 건</span>
          </p>
          <Badge variant={completeness.missingCount > 0 ? 'warning' : 'success'} className="mt-2">
            {completeness.missingCount > 0 ? '확인 필요' : '충족'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

export function SourceTypeTilesSection({ tiles }: { readonly tiles: SourceCollectionSourceTypeTile[] }) {
  return (
    <section className="grid gap-3">
      <SectionHeader
        title="자료유형 정규화"
        description="업로드된 파일을 표준 자료유형으로 자동 분류"
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = sourceTypeIcon[tile.id]
          return (
            <Card key={tile.id}>
              <CardContent className="grid gap-2 p-4">
                <div className="flex items-center gap-2">
                  <div className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{tile.title}</p>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {tile.collectedCount}
                  <span className="text-sm font-normal text-muted-foreground"> / {tile.requiredCount}건</span>
                </p>
                <Badge variant={toneBadgeVariant[tile.tone]} className="w-fit">
                  {tile.statusLabel}
                </Badge>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}

export function ImportStatusTableSection({ rows }: { readonly rows: SourceCollectionImportRow[] }) {
  return (
    <section id="import-status" className="grid gap-3">
      <SectionHeader
        title="수집(가져오기) 상태"
        description="업로드 → 파싱 → 정규화 진행 상황"
        action={(
          <Link href="#import-status" className="text-xs font-semibold text-blue-700 hover:underline">
            전체 보기 →
          </Link>
        )}
      />
      <Card>
        <CardContent className="p-0">
          {rows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>파일</TableHead>
                  <TableHead>자료유형</TableHead>
                  <TableHead>진행</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>업로드</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{row.safeTitle}</p>
                      {row.rowCountLabel && (
                        <p className="text-xs text-muted-foreground">{row.rowCountLabel}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {sourceCollectionSourceTypeLabel(row.sourceType)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="h-1.5 w-[90px] overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full', row.status === 'failed' ? 'bg-red-500' : 'bg-blue-600')}
                          style={{ width: `${row.progressPercent}%` }}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={fileStatusBadgeVariant[row.status] ?? 'secondary'}>
                        {row.statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatUploadDate(row.uploadedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.canRetry ? (
                        <Link href={row.href} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">
                          <RefreshCw className="size-3" />
                          다시 시도
                        </Link>
                      ) : (
                        <Link href={row.href} className="text-xs font-semibold text-blue-700 hover:underline">
                          보기
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="grid place-items-center p-8 text-center">
              <div>
                <UploadCloud className="mx-auto size-8 text-muted-foreground/60" />
                <p className="mt-3 font-medium text-foreground">아직 업로드된 자료가 없습니다</p>
                <p className="mt-1 text-sm text-muted-foreground">위에서 첫 자료를 업로드해 주세요.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

export function MissingChecklistSection({ items }: { readonly items: SourceCollectionMissingItem[] }) {
  if (items.length === 0) {
    return (
      <section className="grid gap-3">
        <SectionHeader title="미수집·확인 필요" description="신고 전 확보해야 할 자료" />
        <Card>
          <CardContent className="grid place-items-center p-8 text-center">
            <div>
              <CheckCircle2 className="mx-auto size-8 text-muted-foreground/60" />
              <p className="mt-3 font-medium text-foreground">확인이 필요한 항목이 없습니다</p>
            </div>
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section className="grid gap-3">
      <SectionHeader title="미수집·확인 필요" description="신고 전 확보해야 할 자료" />
      <Card>
        <CardContent className="grid gap-0 p-0">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3',
                index !== items.length - 1 && 'border-b border-border',
              )}
            >
              <AlertTriangle className={cn('size-4 shrink-0', item.tone === 'danger' ? 'text-red-600' : 'text-amber-600')} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Link href={item.href} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                {item.ctaLabel}
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}

export function StateCoverageSection() {
  return (
    <section className="grid gap-3" aria-labelledby="source-collection-states">
      <SectionHeader
        id="source-collection-states"
        title="화면 상태 예시"
        description="로딩 / 빈 상태 / 오류"
      />
      <div className="grid gap-3 md:grid-cols-3">
        <StateCard
          label="Loading"
          icon={Loader2}
          title="자료를 불러오는 중"
          description="완결성·표는 스켈레톤으로 먼저 표시됩니다."
        />
        <StateCard
          label="Empty"
          icon={UploadCloud}
          title="아직 업로드된 자료가 없습니다"
          description="첫 자료 업로드하기"
        />
        <StateCard
          label="Error"
          icon={AlertCircle}
          title="파일을 처리하지 못했습니다"
          description="지원 형식/용량을 확인한 뒤 다시 업로드해 주세요."
        />
      </div>
    </section>
  )
}

interface StateCardProps {
  readonly label: string
  readonly icon: ComponentType<{ className?: string }>
  readonly title: string
  readonly description: string
}

function StateCard({ label, icon: Icon, title, description }: StateCardProps) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </div>
          <div>
            <CardTitle className="text-sm">{title}</CardTitle>
            <CardDescription className="mt-1 text-xs">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}

interface BusinessEntityEmptyStateProps {
  readonly tenantName: string
}

export function SourceCollectionBusinessEntityEmptyState({ tenantName }: BusinessEntityEmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <Card>
        <CardContent className="grid gap-3 p-6">
          <Badge variant="warning" className="w-fit">사업장 필요</Badge>
          <h2 className="text-lg font-semibold text-foreground">아직 등록된 사업장이 없습니다</h2>
          <p className="text-sm text-muted-foreground">
            {tenantName}에서 자료수집을 시작하려면 사업장 정보를 먼저 등록해야 합니다.
          </p>
          <Link href="/dashboard/clients" className={cn(buttonVariants(), 'w-fit')}>
            <Building2 className="size-4" />
            사업장 등록으로 이동
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
