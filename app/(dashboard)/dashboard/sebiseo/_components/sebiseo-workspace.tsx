'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import {
  AudioLines,
  ChevronDown,
  Mic,
  Plus,
} from 'lucide-react'
import type { UpcomingScheduleItem } from '@/lib/tax-calendar'
import {
  findSebiseoPeriodOption,
  type SebiseoPeriodOption,
} from '@/lib/sebiseo/period-options'
import {
  createSebiseoUploadSession,
  uploadSebiseoFiles,
  validateSebiseoUploadFiles,
} from '@/lib/sebiseo/upload-client'
import {
  UPLOAD_ALLOWED_ACCEPT,
  UPLOAD_ALLOWED_TYPES_HINT,
} from '@/lib/upload/allowed-content-types'
import { SebiseoPeriodConfirm } from './sebiseo-period-confirm'

const COMING_SOON = '준비 중 · 곧 연결됩니다'

type ThreadItem = {
  id: string
  kind: 'system'
  body: string
  href?: string
  hrefLabel?: string
}

export type SebiseoWorkspaceProps = {
  readonly upcoming: UpcomingScheduleItem | null
  readonly businessEntity: { readonly id: string; readonly name: string } | null
  readonly periodOptions: readonly SebiseoPeriodOption[]
  readonly defaultPeriodKey: string
}

export function SebiseoWorkspace({
  upcoming,
  businessEntity,
  periodOptions,
  defaultPeriodKey,
}: SebiseoWorkspaceProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [thread, setThread] = useState<ThreadItem[]>([])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [periodOpen, setPeriodOpen] = useState(false)
  const [selectedPeriodKey, setSelectedPeriodKey] = useState(defaultPeriodKey)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canAttach = Boolean(businessEntity) && !uploading

  const pushSystem = (item: Omit<ThreadItem, 'id' | 'kind'>) => {
    setThread((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        kind: 'system',
        ...item,
      },
    ])
  }

  const onPickFiles = (fileList: FileList | null) => {
    if (!fileList || !businessEntity) return
    setError(null)
    const { accepted, error: validationError } = validateSebiseoUploadFiles(Array.from(fileList))
    if (validationError) {
      setError(validationError)
      return
    }
    // Period confirm is required before any staff-direct-upload call.
    setPendingFiles(accepted)
    setSelectedPeriodKey(defaultPeriodKey)
    setPeriodOpen(true)
  }

  const cancelPeriod = () => {
    if (uploading) return
    setPeriodOpen(false)
    setPendingFiles([])
  }

  const confirmPeriodAndUpload = async () => {
    if (!businessEntity || pendingFiles.length === 0) return
    const period = findSebiseoPeriodOption(periodOptions, selectedPeriodKey)
    if (!period) {
      setError('적용 기간을 선택해 주세요.')
      return
    }

    setUploading(true)
    setError(null)
    try {
      const session = await createSebiseoUploadSession({
        businessEntityId: businessEntity.id,
        periodLabel: period.periodLabel,
        accountingPeriod: period.accountingPeriod,
      })
      await uploadSebiseoFiles({ session, files: pendingFiles })

      const names = pendingFiles.map((file) => file.name).join(', ')
      pushSystem({
        body: `${names} · ${period.confirmLabel}에 등록했습니다. 자료수집에서 분석 상태를 확인할 수 있습니다.`,
        href: `/dashboard/direct-upload?period=${period.key}`,
        hrefLabel: '자료수집 열기',
      })
      setPeriodOpen(false)
      setPendingFiles([])
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 업로드에 실패했습니다')
    } finally {
      setUploading(false)
    }
  }

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
            세무·회계 업무 안내를 돕는 세비서입니다. 파일 첨부는 사용할 수 있고, 대화·Instant·음성은
            아직 준비 중입니다.
          </p>
          <p>
            왼쪽 메뉴에서 자료수집·기장검토·부가세·연간신고 화면으로 바로 이동할 수 있습니다.{' '}
            <span className="font-semibold">확정과 신고는 각 표·화면에서 직접</span> 진행해 주세요.
          </p>
          {!businessEntity ? (
            <p className="rounded-xl border border-[#303030] bg-[#212121] px-3.5 py-3 text-[13px] text-[#b4b4b4]">
              사업장이 없어 파일을 올릴 수 없습니다. 온보딩·설정에서 사업장을 등록해 주세요.
            </p>
          ) : null}

          {thread.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-[#303030] bg-[#212121] px-3.5 py-3 text-[14px] leading-relaxed"
            >
              <p>{item.body}</p>
              {item.href && item.hrefLabel ? (
                <Link
                  href={item.href}
                  className="mt-2 inline-flex text-[13px] font-semibold text-[#93c5fd] underline-offset-2 hover:underline"
                >
                  {item.hrefLabel}
                </Link>
              ) : null}
            </div>
          ))}

          {error ? (
            <p className="text-[13px] text-[#fca5a5]" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <div className="sticky bottom-0 bg-gradient-to-t from-[#171717] via-[#171717] to-transparent px-4 pt-8 pb-[18px]">
        <p className="mb-1.5 text-center text-xs text-[#8e8e8e]">
          세비서도 실수할 수 있습니다. 중요한 정보는 다시 확인하세요.
        </p>
        <p className="mb-2.5 text-center text-xs text-[#8e8e8e]">
          대화·Instant·음성은 준비 중입니다. 첨부 후 적용 기간을 확인합니다.
        </p>
        <div
          className="mx-auto flex min-h-[52px] w-full max-w-[768px] items-center gap-0.5 rounded-[28px] border border-[#303030] bg-[#212121] py-1.5 pr-2 pl-1.5"
          role="group"
          aria-label="메시지 입력"
        >
          <button
            type="button"
            disabled={!canAttach}
            aria-disabled={!canAttach}
            title={canAttach ? '파일 첨부' : COMING_SOON}
            aria-label={canAttach ? '파일 첨부' : `첨부 · ${COMING_SOON}`}
            onClick={() => inputRef.current?.click()}
            className={
              canAttach
                ? 'grid size-9 shrink-0 place-items-center rounded-full text-[#ececec] hover:bg-[#2f2f2f]'
                : 'grid size-9 shrink-0 place-items-center rounded-full text-[#6e6e6e] disabled:cursor-not-allowed disabled:opacity-50'
            }
          >
            <Plus className="size-5" strokeWidth={1.5} />
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={UPLOAD_ALLOWED_ACCEPT}
            className="hidden"
            disabled={!canAttach}
            onChange={(event) => {
              onPickFiles(event.target.files)
              event.target.value = ''
            }}
          />
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
        <p className="mx-auto mt-2 max-w-[768px] text-center text-[11px] text-[#6e6e6e]">
          {UPLOAD_ALLOWED_TYPES_HINT}
        </p>
      </div>

      <SebiseoPeriodConfirm
        open={periodOpen}
        fileNames={pendingFiles.map((file) => file.name)}
        options={periodOptions}
        selectedKey={selectedPeriodKey}
        uploading={uploading}
        onSelectedKeyChange={setSelectedPeriodKey}
        onConfirm={() => {
          void confirmPeriodAndUpload()
        }}
        onCancel={cancelPeriod}
      />
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
