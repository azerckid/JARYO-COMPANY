import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractTransactionCandidates } from './transaction-extraction'

const fixtureRoot = join(process.cwd(), 'docs/05_QA_Validation/fixtures/realistic-upload')

function candidatesFor(relativePath: string) {
  const buffer = readFileSync(join(fixtureRoot, relativePath))
  return extractTransactionCandidates({
    file: {
      id: relativePath,
      originalFilename: relativePath.split('/').at(-1) ?? relativePath,
      fileType: 'excel',
    },
    buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  })
}

describe('realistic upload fixtures', () => {
  it('keeps H1 fixtures separate from July and makes every H1 row parseable', () => {
    const filenames = readdirSync(join(fixtureRoot, '2026-h1')).filter((name) => name.endsWith('.xlsx'))
    expect(filenames).toHaveLength(7)
    for (const filename of filenames) {
      const candidates = candidatesFor(`2026-h1/${filename}`)
      expect(candidates.length, filename).toBeGreaterThan(0)
      expect(candidates.every((row) => !row.transactionDate || row.transactionDate.startsWith('2026-0'))).toBe(true)
      expect(candidates.every((row) => !row.transactionDate || row.transactionDate <= '2026-06-30')).toBe(true)
    }
  })

  it('uses source-file evidence before memo words when classifying bank transactions', () => {
    const candidates = candidatesFor('2026-h1/01_bank_shinhan_2026_h1.xlsx')
    expect(candidates).toHaveLength(24)
    expect(candidates.every((row) => row.sourceType === 'bank')).toBe(true)
    expect(candidates.map((row) => row.description).join('\n')).toContain('카드 결제대금')
    expect(candidates.map((row) => row.description).join('\n')).toContain('세금계산서 대금 지급')
  })

  it('extracts VAT facts from the Hometax tax-invoice and cash-receipt fixtures', () => {
    for (const filename of [
      '05_hometax_sales_tax_invoice_2026_h1.xlsx',
      '06_hometax_purchase_tax_invoice_2026_h1.xlsx',
      '07_hometax_cash_receipt_2026_h1.xlsx',
    ]) {
      const candidates = candidatesFor(`2026-h1/${filename}`)
      expect(candidates.length, filename).toBeGreaterThan(0)
      expect(candidates.every((row) => row.vatFact?.taxType === 'taxable'), filename).toBe(true)
    }
  })
})
