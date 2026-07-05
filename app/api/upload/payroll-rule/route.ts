import { NextResponse } from 'next/server'

// JC-031 Slice 1b: 외부 고객 업로드 포털(/upload/[token]) 전용 API. 포털
// 페이지가 이미 quarantine(redirect)됐으므로 이 엔드포인트도 함께 차단한다.
export async function POST(): Promise<NextResponse> {
  return NextResponse.json({ error: '더 이상 제공되지 않는 기능입니다' }, { status: 410 })
}
