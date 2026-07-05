import { retiredLegacyEmailResponse } from '@/lib/legacy-retirement'

export async function GET() {
  return retiredLegacyEmailResponse()
}
