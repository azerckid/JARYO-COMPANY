'use client'

import { type ReactNode, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { PayrollRegisterRow } from '@/lib/payroll-workspace/summary'
import { cn } from '@/lib/utils'
import { WithholdingBreakdownCell } from './withholding-breakdown-cell'

function formatCurrency(value: number): string {
  return value.toLocaleString('ko-KR')
}

// 급여대장 행: 직원명·기본급을 클릭하면 인라인 팝오버로 수정할 수 있다.
// 현재는 UI 프로토타입 단계로, 수정값은 이 화면 세션 동안만 로컬 상태로 유지되고
// 서버/DB에는 저장되지 않는다(새로고침 시 초기화). 합계 행은 서버 집계값이라 반영되지 않는다.
// 기본급을 바꾸면 지급계·실지급액만 로컬에서 다시 계산되고, 원천세·4대보험은
// 확정 저장값 그대로 둔다(이 앱은 세액을 계산하지 않음).
export function EditablePayrollRow({ row }: { readonly row: PayrollRegisterRow }) {
  const [name, setName] = useState<string>(row.displayName)
  const [baseSalaryKrw, setBaseSalaryKrw] = useState<number>(row.baseSalaryKrw)

  const grossPayKrw = baseSalaryKrw + row.allowanceKrw
  const netPayKrw = grossPayKrw - row.deductionTotalKrw

  return (
    <tr
      id={`payroll-line-${row.id}`}
      className={cn(
        'border-b border-company-border last:border-b-0 hover:bg-[#fafafa]',
        // 고용형태 구분 바탕색 (근로소득=정규직은 기본 흰색)
        row.jobType === '프리랜서' && 'bg-[#f6f9ff] hover:bg-[#eef3ff]',
        row.jobType === '일용직' && 'bg-[#f4faf6] hover:bg-[#e9f6ee]',
        // 확인 필요 강조는 고용형태 색보다 우선
        row.status === 'needs_review' && 'bg-[#fffdf5] hover:bg-[#fff9e8]',
      )}
    >
      <td className="px-3.5 py-2.5 text-left text-[12.5px] whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <InlineEditPopover
            label="직원 이름"
            ariaLabel={`${name} 이름 수정`}
            initial={name}
            display={<span className="font-semibold text-foreground">{name}</span>}
            onSave={(value) => {
              const next = value.trim()
              if (next) setName(next)
            }}
          />
          {row.issueLabel ? (
            <span className="rounded-[5px] border border-[#fde68a] bg-[#fffbeb] px-1.5 py-0.5 text-[10.5px] font-bold text-[#d97706]">
              확인 필요
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-[11px] text-company-fg-subtle">
          {[row.department, row.jobTitle ?? row.jobType].filter(Boolean).join(' · ') || row.employeeCode || '직원 정보'}
        </p>
      </td>
      <td className="px-3.5 py-2.5 text-right text-[12.5px] tabular-nums whitespace-nowrap">
        <InlineEditPopover
          label="기본급"
          numeric
          align="end"
          ariaLabel={`${name} 기본급 수정`}
          initial={String(baseSalaryKrw)}
          display={<span>{formatCurrency(baseSalaryKrw)}</span>}
          onSave={(value) => {
            const next = Number(value.replaceAll(',', '').trim())
            if (Number.isFinite(next) && next >= 0) setBaseSalaryKrw(Math.round(next))
          }}
        />
      </td>
      <MoneyTd value={row.allowanceKrw} />
      <MoneyTd value={grossPayKrw} strong />
      <WithholdingBreakdownCell
        incomeTaxKrw={row.incomeTaxKrw}
        localIncomeTaxKrw={row.localIncomeTaxKrw}
        withholdingTaxKrw={row.withholdingTaxKrw}
      />
      <MoneyTd value={row.socialInsuranceKrw} danger />
      <MoneyTd value={row.deductionTotalKrw} danger strong />
      <MoneyTd value={netPayKrw} strong />
    </tr>
  )
}

function MoneyTd({ value, danger = false, strong = false }: { readonly value: number; readonly danger?: boolean; readonly strong?: boolean }) {
  return (
    <td
      className={cn(
        'px-3.5 py-2.5 text-right text-[12.5px] tabular-nums whitespace-nowrap',
        danger && 'text-[#dc2626]',
        strong && 'font-bold text-foreground',
      )}
    >
      {formatCurrency(value)}
    </td>
  )
}

function InlineEditPopover({
  label,
  display,
  initial,
  ariaLabel,
  numeric = false,
  align = 'start',
  onSave,
}: {
  readonly label: string
  readonly display: ReactNode
  readonly initial: string
  readonly ariaLabel: string
  readonly numeric?: boolean
  readonly align?: 'start' | 'end'
  readonly onSave: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(initial)

  function commit() {
    onSave(draft)
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(initial)
        setOpen(next)
      }}
    >
      <PopoverTrigger
        aria-label={ariaLabel}
        className="rounded-[4px] underline decoration-dotted decoration-company-fg-subtle/50 underline-offset-4 outline-none transition-colors hover:decoration-company-fg-muted focus-visible:ring-2 focus-visible:ring-[#2563eb]/30"
      >
        {display}
      </PopoverTrigger>
      <PopoverContent align={align} side="bottom" className="w-56 gap-0 text-left">
        <p className="text-[12px] font-semibold text-foreground">{label} 수정</p>
        <input
          autoFocus
          type="text"
          inputMode={numeric ? 'numeric' : undefined}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              setOpen(false)
            }
          }}
          className="mt-2 h-8 w-full rounded-[7px] border border-company-border bg-company-surface px-2 text-[12.5px] font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/30"
        />
        <div className="mt-2 flex justify-end gap-1.5">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-[6px] border border-company-border bg-company-surface px-2.5 py-1 text-[11.5px] font-semibold text-company-fg-muted hover:bg-[#fafafa]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={commit}
            className="rounded-[6px] border border-[#18181b] bg-[#18181b] px-2.5 py-1 text-[11.5px] font-semibold text-white hover:opacity-90"
          >
            저장
          </button>
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed text-company-fg-subtle">
          UI 미리보기입니다. 수정값은 이 화면에만 반영되고 아직 서버에 저장되지 않습니다.
        </p>
      </PopoverContent>
    </Popover>
  )
}
