'use client'

import Link from 'next/link'
import {
  AudioLines,
  ChevronDown,
  Copy,
  Ellipsis,
  Mic,
  Plus,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { UpcomingScheduleItem } from '@/lib/tax-calendar'

export type SebiseoWorkspaceProps = {
  readonly upcoming: UpcomingScheduleItem | null
}

export function SebiseoWorkspace({ upcoming }: SebiseoWorkspaceProps) {
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-1 flex-col bg-[#171717] text-[#ececec] md:min-h-screen">
      <div className="px-6 pt-3.5 pb-2 text-[15px] font-semibold">세비서</div>

      <div className="mx-auto w-full max-w-[768px] px-6 pb-4">
        <UpcomingFilingCard item={upcoming} />
      </div>

      <div className="flex-1 overflow-auto px-6 pb-[150px]">
        <div className="mx-auto flex w-full max-w-[768px] flex-col gap-6">
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-[22px] bg-[#2a2a2a] px-4 py-2.5 text-[15px] leading-relaxed">
              6월 카드랑 통장 파일 올렸는데, 다음에 뭐 하면 돼?
            </div>
          </div>

          <div>
            <div className="space-y-3.5 text-[15.5px] leading-[1.7] text-[#ececec]">
              <p>
                자료수집에 파일이 들어오면, 정규화 후 자료대조원장에서 누락·불일치 항목을 확인하는
                순서가 일반적입니다.
              </p>
              <p>
                지금은 예외·누락 거래가 있으니, 기장검토 &gt; 자료대조원장에서 해당 건부터 보시는
                것을 권합니다. <span className="font-semibold">확정은 표에서 직접</span> 하시고,
                저는 안내와 다음 단계 연결만 돕습니다.
              </p>
              <p>
                원하시면 “자료대조원장 열기” 또는 “부가세에서 수정할 항목 보여줘”라고 말씀해 주세요.
              </p>
            </div>

            <div className="mt-3 flex items-center gap-1" aria-label="메시지 액션">
              <IconButton label="복사"><Copy className="size-[18px]" strokeWidth={1.5} /></IconButton>
              <IconButton label="좋아요"><ThumbsUp className="size-[18px]" strokeWidth={1.5} /></IconButton>
              <IconButton label="싫어요"><ThumbsDown className="size-[18px]" strokeWidth={1.5} /></IconButton>
              <IconButton label="공유"><ShareUpIcon /></IconButton>
              <IconButton label="다시 생성"><RefreshCw className="size-[18px]" strokeWidth={1.5} /></IconButton>
              <IconButton label="더보기"><Ellipsis className="size-[18px]" strokeWidth={1.5} /></IconButton>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 bg-gradient-to-t from-[#171717] via-[#171717] to-transparent px-4 pt-8 pb-[18px]">
        <p className="mb-2.5 text-center text-xs text-[#8e8e8e]">
          세비서도 실수할 수 있습니다. 중요한 정보는 다시 확인하세요.
        </p>
        <div
          className="mx-auto flex min-h-[52px] w-full max-w-[768px] items-center gap-0.5 rounded-[28px] border border-[#303030] bg-[#212121] py-1.5 pr-2 pl-1.5"
          role="group"
          aria-label="메시지 입력"
        >
          <button
            type="button"
            title="첨부"
            aria-label="첨부"
            className="grid size-9 shrink-0 place-items-center rounded-full text-[#ececec] hover:bg-[#2f2f2f]"
          >
            <Plus className="size-5" strokeWidth={1.5} />
          </button>
          <div className="min-w-0 flex-1 px-1.5 py-2 text-[15px] text-[#8e8e8e]">
            세비서에게 묻기
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              title="모드"
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[13px] font-medium text-[#b4b4b4] hover:bg-[#2f2f2f] hover:text-[#ececec]"
            >
              Instant
              <ChevronDown className="size-3.5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              title="음성 입력"
              aria-label="음성 입력"
              className="grid size-9 place-items-center rounded-full text-[#b4b4b4] hover:bg-[#2f2f2f] hover:text-[#ececec]"
            >
              <Mic className="size-[18px]" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              title="음성 모드"
              aria-label="음성 모드"
              className="grid size-9 place-items-center rounded-full bg-white text-[#0d0d0d] hover:bg-[#e8e8e8]"
            >
              <AudioLines className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function UpcomingFilingCard({ item }: { readonly item: UpcomingScheduleItem | null }) {
  if (!item) {
    return (
      <div className="max-w-[280px] rounded-xl border border-[#303030] bg-[#212121] px-3.5 py-3">
        <p className="text-[11.5px] font-semibold text-[#8e8e8e]">다가오는 신고</p>
        <p className="mt-1.5 text-lg font-bold tracking-tight">일정 없음</p>
        <p className="mt-1 text-xs text-[#b4b4b4]">가까운 신고 마감이 없습니다</p>
      </div>
    )
  }

  return (
    <Link
      href={item.href}
      className="block max-w-[280px] rounded-xl border border-[#303030] bg-[#212121] px-3.5 py-3 transition-colors hover:border-[#404040]"
    >
      <p className="text-[11.5px] font-semibold text-[#8e8e8e]">다가오는 신고</p>
      <p className="mt-1.5 text-lg font-bold tracking-tight">{item.dateLabel}</p>
      <p className="mt-1 text-xs text-[#b4b4b4]">
        {item.title} · D-{item.dDay}
      </p>
    </Link>
  )
}

function IconButton({
  label,
  children,
}: {
  readonly label: string
  readonly children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="grid size-8 place-items-center rounded-lg text-[#b4b4b4] hover:bg-[#2a2a2a] hover:text-[#ececec]"
    >
      {children}
    </button>
  )
}

/** ChatGPT-style share: tray + arrow up (not Lucide Share network icon). */
function ShareUpIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
      <path d="M12 3v13" />
      <path d="m8 7 4-4 4 4" />
    </svg>
  )
}
