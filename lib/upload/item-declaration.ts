import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { uploadItemDeclaration } from '@/lib/db/schema'

/**
 * 항목에 파일이 매칭(접수)되면 그 항목의 없음/나중에 선언을 자동 해제한다.
 * "없음이라 했는데 파일이 있는" 모순 상태가 남지 않게 한다.
 */
export async function clearUploadItemDeclaration(params: {
  tenantId: string
  uploadSessionId: string
  checklistItemId: string
}): Promise<void> {
  await db
    .delete(uploadItemDeclaration)
    .where(
      and(
        eq(uploadItemDeclaration.tenantId, params.tenantId),
        eq(uploadItemDeclaration.uploadSessionId, params.uploadSessionId),
        eq(uploadItemDeclaration.checklistItemId, params.checklistItemId),
      ),
    )
}
