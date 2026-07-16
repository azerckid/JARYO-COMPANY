'use client'

import Link from 'next/link'
import {
  AudioLines,
  ChevronDown,
  Mic,
  Plus,
} from 'lucide-react'
import type { UpcomingScheduleItem } from '@/lib/tax-calendar'

const COMING_SOON = '준비 중 · 곧 연결됩니다'

export type SebiseoWorkspaceProps = {
  readonly upcoming: UpcomingScheduleItem | null
}

export function SebiseoWorkspace({ upcoming }: SebiseoWorkspaceProps) {
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-1 flex-col bg-[#171717] text-[#ececec] md:min-h-screen">
      <div className="px-6 pt-3.5 pb-2 text-[15px] font-semibold">세비서</div>

      <div className="mx-auto w-full max-w-[768px] px-6 pb-4">
        <ReferenceTaxScheduleCard item={upcoming} />
      </div>

      <div className="flex-1 overflow-auto px-6 pb-[150px]">
        <div className="mx-auto w-full max-w-[768px] space-y-3.5 pt-6 text-[15.5px] leading-[1.7] text-[#ececec]">
          <p className="text-xl font-semibold tracking-tight">무엇을 도와드릴까요?</p>
          <p>
            세무·회계 업무 안내를 돕는 세비서입니다. 지금은 대화·파일 업로드·음성 입력이 준비
            중입니다.
          </p>
          <p>
            왼쪽 메뉴에서 자료수집·기장검토·부가세·연간신고 화면으로 바로 이동할 수 있습니다.{' '}
            <span className="font-semibold">확정과 신고는 각 표·화면에서 직접</span> 진행해 주세요.
          </p>
        </div>
      </div>

      <div className="sticky bottom-0 bg-gradient-to-t from-[#171717] via-[#171717] to-transparent px-4 pt-8 pb-[18px]">
        <p className="mb-1.5 text-center text-xs text-[#8e8e8e]">
          세비서도 실수할 수 있습니다. 중요한 정보는 다시 확인하세요.
        </p>
        <p className="mb-2.5 text-center text-xs text-[#8e8e8e]">
          대화·첨부·음성은 준비 중입니다.
        </p>
        <div
          className="mx-auto flex min-h-[52px] w-full max-w-[768px] items-center gap-0.5 rounded-[28px] border border-[#303030] bg-[#212121] py-1.5 pr-2 pl-1.5"
          role="group"
          aria-label="메시지 입력 (준비 중)"
        >
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={COMING_SOON}
            aria-label={`첨부 · ${COMING_SOON}`}
            className="grid size-9 shrink-0 place-items-center rounded-full text-[#6e6e6e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="size-5" strokeWidth={1.5} />
          </button>
          <div className="min-w-0 flex-1 px-1.5 py-2 text-[15px] text-[#6e6e6e]">
            세비서에게 묻기 (준비 중)
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              disabled
              aria-disabled="true"
              title={COMING_SOON}
              aria-label={`Instant · ${COMING_SOON}`}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[13px] font-medium text-[#6e6e6e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Instant
              <ChevronDown className="size-3.5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              title={COMING_SOON}
              aria-label={`음성 입력 · ${COMING_SOON}`}
              className="grid size-9 place-items-center rounded-full text-[#6e6e6e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Mic className="size-[18px]" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              title={COMING_SOON}
              aria-label={`음성 모드 · ${COMING_SOON}`}
              className="grid size-9 place-items-center rounded-full bg-[#3a3a3a] text-[#8e8e8e] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <AudioLines className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReferenceTaxScheduleCard({ item }: { readonly item: UpcomingScheduleItem | null }) {
  if (!item) {
    return (
      <div className="max-w-[300px] rounded-xl border border-[#303030] bg-[#212121] px-3.5 py-3">
        <p className="text-[11.5px] font-semibold text-[#8e8e8e]">세무 일정(참고)</p>
        <p className="mt-1.5 text-lg font-bold tracking-tight">일정 없음</p>
        <p className="mt-1 text-xs text-[#b4b4b4]">가까운 공통 법정 일정이 없습니다</p>
        <p className="mt-1.5 text-[11px] leading-snug text-[#6e6e6e]">
          공통 세무 일정입니다. 회사별 준비 상태가 아닙니다.
        </p>
      </div>
    )
  }

  return (
    <Link
      href={item.href}
      className="block max-w-[300px] rounded-xl border border-[#303030] bg-[#212121] px-3.5 py-3 transition-colors hover:border-[#404040]"
    >
      <p className="text-[11.5px] font-semibold text-[#8e8e8e]">세무 일정(참고)</p>
      <p className="mt-1.5 text-lg font-bold tracking-tight">{item.dateLabel}</p>
      <p className="mt-1 text-xs text-[#b4b4b4]">
        {item.title} · D-{item.dDay}
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-[#6e6e6e]">
        공통 세무 일정입니다. 회사별 준비 상태가 아닙니다.
      </p>
    </Link>
  )
}
