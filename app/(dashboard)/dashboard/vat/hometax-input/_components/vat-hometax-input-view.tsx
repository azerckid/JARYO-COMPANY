import Link from 'next/link'
import { ArrowLeft, CircleAlert, CircleCheck, ExternalLink } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import type {
  VatHometaxInputRow,
  VatHometaxInputStatus,
  VatHometaxInputSummary,
} from '@/lib/vat/hometax-input-summary'
import { cn } from '@/lib/utils'

const panelClass = 'overflow-hidden rounded-lg border border-company-border bg-company-surface shadow-company-card'

const modeLabel: Record<VatHometaxInputRow['mode'], string> = {
  input: '값 비교·수정',
  calculated_check: '자동 계산 대조',
  hometax_final_check: '최종 확인',
}

const statusCopy: Record<Exclude<VatHometaxInputStatus, 'ready'>, { title: string; description: string }> = {
  blocked: {
    title: '입력값 준비 전입니다',
    description: '부가세 화면에서 아래 항목을 먼저 처리해야 합니다.',
  },
  empty: {
    title: '확정된 부가세 자료가 없습니다',
    description: '자료대조와 부가세 확정을 마친 뒤 입력값을 확인할 수 있습니다.',
  },
  stale: {
    title: '확정 원장을 다시 계산해야 합니다',
    description: '변경 전 값은 표시하지 않습니다. 부가세 화면에서 최신 확정값으로 다시 계산하세요.',
  },
  unsupported: {
    title: '추가 구분이 필요한 거래가 있습니다',
    description: '현재 정본 데이터로 신고서 행을 안전하게 나눌 수 없어 값을 표시하지 않습니다.',
  },
}

export function VatHometaxInputView({ summary }: { readonly summary: VatHometaxInputSummary }) {
  const companyName = summary.business?.name ?? '회사'
  const vatHref = `/dashboard/vat?period=${encodeURIComponent(summary.period.key)}`

  return (
    <div className="flex min-h-full flex-col bg-company-bg">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-company-border bg-company-surface px-4 py-3 sm:gap-4 sm:px-7 sm:py-3.5">
        <div>
          <p className="text-[12.5px] font-medium text-company-fg-subtle">
            <Link href={vatHref} className="hover:text-company-fg-muted hover:underline">부가세</Link>
            <span aria-hidden="true"> › </span>
            <span>홈택스 입력값</span>
          </p>
          <h1 className="text-base font-semibold tracking-tight text-foreground">홈택스 입력값</h1>
        </div>
        <span className="text-[13px] font-medium text-company-fg-muted">{companyName}</span>
        <span className="ml-auto rounded-lg border border-company-border-strong bg-company-surface px-3 py-1.5 text-[13px] font-medium text-foreground">
          {summary.period.label}
        </span>
      </header>

      <main className="flex w-full max-w-[1180px] flex-col gap-4 px-4 pt-5 pb-10 sm:px-7 sm:pt-6 sm:pb-12">
        <Link href={vatHref} className="inline-flex w-fit items-center gap-1 text-[12.5px] font-semibold text-[#2563eb] hover:underline">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          부가세로 돌아가기
        </Link>

        {summary.gate.status === 'ready' ? (
          <VatHometaxReadyView summary={summary} />
        ) : (
          <VatHometaxInputState summary={summary} vatHref={vatHref} />
        )}
      </main>
    </div>
  )
}

function VatHometaxReadyView({ summary }: { readonly summary: VatHometaxInputSummary }) {
  return (
    <>
      <section className="flex flex-col gap-2 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4" aria-label="신고서 입력 준비 상태">
        <CircleCheck className="size-5 shrink-0 text-[#15803d]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-[#15803d]">입력 준비 완료</h2>
          <p className="mt-0.5 text-[12.5px] text-[#3f6212]">홈택스 미리채움과 아래 확정값을 비교하고, 다르면 해당 행만 수정하세요.</p>
        </div>
        <p className="text-xs font-bold text-[#15803d]">확정 원장 {summary.gate.sourceRowCount}건</p>
      </section>

      <section className="grid gap-1 rounded-lg border border-company-border bg-company-surface px-4 py-3 shadow-company-card sm:grid-cols-[120px_1fr] sm:items-center" aria-label="홈택스 신고 경로">
        <p className="text-xs font-semibold text-company-fg-muted">홈택스 경로</p>
        <p className="text-[13px] font-semibold text-foreground">세금신고 → 부가가치세 신고 → 일반과세자 정기신고</p>
        <p className="text-[11px] text-company-fg-subtle sm:col-start-2">2026년 확정신고 기준. 홈택스 메뉴명은 개편될 수 있습니다.</p>
      </section>

      <VatHometaxInputTable summary={summary} />

      <p className="text-[11.5px] leading-5 text-company-fg-subtle">
        SemuAgent는 확정값과 입력 위치를 정리합니다. 홈택스 입력·최종 제출·납부는 사용자가 직접 진행합니다.
      </p>
    </>
  )
}

function VatHometaxInputState({
  summary,
  vatHref,
}: {
  readonly summary: VatHometaxInputSummary
  readonly vatHref: string
}) {
  const copy = statusCopy[summary.gate.status as Exclude<VatHometaxInputStatus, 'ready'>]
  return (
    <section className={cn(panelClass, 'p-5 sm:p-6')}>
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-[#d97706]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-foreground">{copy.title}</h2>
          <p className="mt-1 text-[12.5px] leading-5 text-company-fg-muted">{copy.description}</p>
          {summary.gate.reasons.length > 0 ? (
            <ul className="mt-4 grid gap-2 border-t border-company-border pt-4">
              {summary.gate.reasons.map((reason) => (
                <li key={reason} className="flex gap-2 text-[12.5px] leading-5 text-company-fg-muted">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-company-fg-subtle" aria-hidden="true" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <Link href={vatHref} className={cn(buttonVariants({ variant: 'outline' }), 'mt-5')}>
            부가세에서 처리
          </Link>
        </div>
      </div>
    </section>
  )
}

function VatHometaxInputTable({ summary }: { readonly summary: VatHometaxInputSummary }) {
  return (
    <section className={panelClass}>
      <div className="flex flex-wrap items-baseline gap-2 border-b border-company-border px-4 py-3.5 sm:px-5">
        <h2 className="text-[15px] font-semibold text-foreground">일반과세자 부가가치세 신고서</h2>
        <p className="text-xs text-company-fg-subtle">별지 제21호서식 · 확정 신고</p>
        <p className="ml-auto text-xs text-company-fg-muted">
          {summary.business?.name} · {formatPeriodRange(summary.period.startMonth, summary.period.endMonth)}
        </p>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] border-collapse" aria-label="홈택스 부가세 입력값">
          <thead>
            <tr className="border-b border-company-border bg-[#fafafa]">
              <TableHead>홈택스 신고서 위치</TableHead>
              <TableHead className="text-right">금액</TableHead>
              <TableHead className="text-right">세액</TableHead>
              <TableHead>확인 방식</TableHead>
            </tr>
          </thead>
          <tbody>{summary.rows.map((row) => <DesktopInputRow key={row.formLine} row={row} />)}</tbody>
        </table>
      </div>

      <div className="divide-y divide-company-border md:hidden">
        {summary.rows.map((row) => <MobileInputRow key={row.formLine} row={row} />)}
      </div>

      <div className="flex flex-col gap-1 border-t border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-xs leading-5 text-[#92400e] sm:flex-row sm:gap-2">
        <strong className="text-[#78350f]">(27)은 홈택스에서 최종 확인합니다.</strong>
        <span>㉰ 값은 경감·공제·예정고지·가산세 반영 전입니다.</span>
      </div>
    </section>
  )
}

function DesktopInputRow({ row }: { readonly row: VatHometaxInputRow }) {
  return (
    <tr className={cn(
      'border-b border-company-border last:border-b-0',
      row.formLine === '㉰' && 'bg-[#eff6ff]',
    )}>
      <td className="px-4 py-3">
        <p className={cn('text-[13px] font-semibold text-foreground', row.formLine === '㉰' && 'text-[#1d4ed8]')}>
          {row.formLine} {row.label}
        </p>
        <p className="mt-0.5 text-[11px] text-company-fg-subtle">{row.description}</p>
      </td>
      <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums">{formatRowAmount(row)}</td>
      <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums">{formatRowTax(row)}</td>
      <td className="px-4 py-3"><ModeChip mode={row.mode} /></td>
    </tr>
  )
}

function MobileInputRow({ row }: { readonly row: VatHometaxInputRow }) {
  return (
    <article className={cn('grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4', row.formLine === '㉰' && 'bg-[#eff6ff]')}>
      <div className="col-span-2">
        <h3 className={cn('text-[13px] font-semibold text-foreground', row.formLine === '㉰' && 'text-[#1d4ed8]')}>
          {row.formLine} {row.label}
        </h3>
        <p className="mt-0.5 text-[11px] leading-4 text-company-fg-subtle">{row.description}</p>
      </div>
      <MobileValue label="금액" value={formatRowAmount(row)} />
      <MobileValue label="세액" value={formatRowTax(row)} />
      <div className="col-span-2"><ModeChip mode={row.mode} /></div>
    </article>
  )
}

function MobileValue({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-company-fg-subtle">{label}</p>
      <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

function ModeChip({ mode }: { readonly mode: VatHometaxInputRow['mode'] }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
      mode === 'input' && 'border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]',
      mode === 'calculated_check' && 'border-company-border bg-company-nav-hover text-company-fg-muted',
      mode === 'hometax_final_check' && 'border-[#fde68a] bg-[#fffbeb] text-[#b45309]',
    )}>
      {mode === 'hometax_final_check' ? <ExternalLink className="size-3" aria-hidden="true" /> : null}
      {modeLabel[mode]}
    </span>
  )
}

function TableHead({ className, children }: { readonly className?: string; readonly children: React.ReactNode }) {
  return <th className={cn('px-4 py-2.5 text-left text-[11.5px] font-semibold text-company-fg-subtle', className)}>{children}</th>
}

function formatCurrency(value: number) {
  return `${value.toLocaleString('ko-KR')}원`
}

function formatRowAmount(row: VatHometaxInputRow) {
  if (row.amountKrw === null) return '-'
  return formatCurrency(row.amountKrw)
}

function formatRowTax(row: VatHometaxInputRow) {
  if (row.formLine === '(27)') return '홈택스 계산값'
  if (row.formLine === '(84)') return '해당 없음'
  if (row.taxKrw === null) return '-'
  return formatCurrency(row.taxKrw)
}

function formatPeriodRange(startMonth: string, endMonth: string) {
  return `${startMonth.replace('-', '.')}~${endMonth.replace('-', '.')}`
}
