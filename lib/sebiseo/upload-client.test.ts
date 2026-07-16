import { describe, expect, it } from 'vitest'
import { validateSebiseoUploadFiles } from './upload-client'

function fakeFile(name: string, type: string, size = 1024) {
  return new File([new Uint8Array(size)], name, { type })
}

describe('validateSebiseoUploadFiles', () => {
  it('accepts server-supported MIME types', () => {
    const result = validateSebiseoUploadFiles([
      fakeFile('a.pdf', 'application/pdf'),
      fakeFile('b.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    ])
    expect(result.error).toBeNull()
    expect(result.accepted).toHaveLength(2)
  })

  it('rejects CSV and ZIP that the server does not allow', () => {
    const csv = validateSebiseoUploadFiles([fakeFile('rows.csv', 'text/csv')])
    expect(csv.error).toContain('지원하지 않는 형식')
    expect(csv.accepted).toHaveLength(0)

    const zip = validateSebiseoUploadFiles([fakeFile('pack.zip', 'application/zip')])
    expect(zip.error).toContain('지원하지 않는 형식')
  })

  it('rejects oversized files', () => {
    const result = validateSebiseoUploadFiles([
      fakeFile('huge.pdf', 'application/pdf', 51 * 1024 * 1024),
    ])
    expect(result.error).toContain('50MB')
  })
})
