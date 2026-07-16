import { upload } from '@vercel/blob/client'
import { verifyUploadClientTokenAvailable } from '@/lib/upload/client-token-preflight'
import {
  isUploadAllowedFile,
  UPLOAD_MAX_FILE_BYTES,
} from '@/lib/upload/allowed-content-types'

export type SebiseoUploadSession = {
  id: string
  rawToken: string
}

function extractRawToken(uploadUrl: string | null | undefined) {
  if (!uploadUrl) return null
  try {
    const parsed = new URL(uploadUrl)
    return parsed.pathname.split('/').filter(Boolean).pop() ?? null
  } catch {
    return uploadUrl.split('/').filter(Boolean).pop() ?? null
  }
}

export function validateSebiseoUploadFiles(files: readonly File[]): {
  accepted: File[]
  error: string | null
} {
  if (files.length === 0) {
    return { accepted: [], error: '업로드할 파일을 선택해 주세요.' }
  }

  const oversized = files.find((file) => file.size > UPLOAD_MAX_FILE_BYTES)
  if (oversized) {
    return {
      accepted: [],
      error: `파일당 최대 50MB까지 업로드할 수 있습니다. (${oversized.name})`,
    }
  }

  const rejected = files.find((file) => !isUploadAllowedFile(file))
  if (rejected) {
    return {
      accepted: [],
      error: `지원하지 않는 형식입니다. PDF·XLSX·XLS·이미지만 가능합니다. (${rejected.name})`,
    }
  }

  return { accepted: [...files], error: null }
}

export async function createSebiseoUploadSession(params: {
  businessEntityId: string
  periodLabel: string
  accountingPeriod: string
}): Promise<SebiseoUploadSession> {
  const res = await fetch('/api/staff-direct-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: params.businessEntityId,
      displayLabel: `${params.periodLabel} 세비서 업로드`,
      workType: 'bookkeeping',
      accountingPeriod: params.accountingPeriod,
      bookkeepingPeriodType: null,
      analysisNotes: '',
    }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.error ?? '업로드 세션을 만들지 못했습니다')
  }

  const rawToken = extractRawToken(data.uploadUrl)
  if (!rawToken || typeof data.sessionId !== 'string') {
    throw new Error('업로드 세션을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  }

  return { id: data.sessionId, rawToken }
}

export async function uploadSebiseoFiles(params: {
  session: SebiseoUploadSession
  files: readonly File[]
}): Promise<void> {
  for (const file of params.files) {
    const pathname = `uploads/${crypto.randomUUID()}-${file.name}`
    const clientPayload = JSON.stringify({
      rawToken: params.session.rawToken,
      originalFilename: file.name,
    })

    await verifyUploadClientTokenAvailable({
      handleUploadUrl: '/api/upload',
      pathname,
      clientPayload,
    })

    await upload(pathname, file, {
      access: 'private',
      handleUploadUrl: '/api/upload',
      clientPayload,
    })
  }

  const res = await fetch('/api/upload/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawToken: params.session.rawToken }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.error ?? '제출 처리에 실패했습니다')
  }
}
