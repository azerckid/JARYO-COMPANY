/**
 * Synthetic QA fixtures shaped like institution exports, never real company data.
 * H1 bookkeeping/VAT: 2026-01 through 2026-06. Payroll is intentionally separate.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const fixtureRoot = join(scriptDir, '../../docs/05_QA_Validation/fixtures/realistic-upload')
const h1Dir = join(fixtureRoot, '2026-h1')
const julyDir = join(fixtureRoot, '2026-07')
const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']

function iso(month, day) {
  return `${month}-${String(day).padStart(2, '0')}`
}

function writeWorkbook(directory, filename, sheetName, rows) {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName)
  writeFileSync(join(directory, filename), XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
}

function shinhanBankRows() {
  let balance = 24_000_000
  return months.flatMap((month, index) => {
    const transactions = [
      ['입금', '온라인 주문대금', 2_100_000 + index * 50_000],
      ['출금', '카드 결제대금', 840_000 + index * 20_000],
      ['출금', '세금계산서 대금 지급', 550_000 + index * 10_000],
      ['출금', '급여 이체', 4_500_000],
    ]
    return transactions.map(([kind, memo, amount], rowIndex) => {
      balance += kind === '입금' ? amount : -amount
      return {
        거래일시: `${iso(month, 4 + rowIndex * 6)} 09:30:00`,
        출금: kind === '출금' ? amount : 0,
        입금: kind === '입금' ? amount : 0,
        거래후잔액: balance,
        거래내용: memo,
        상대은행: rowIndex === 0 ? 'NH은행' : '신한은행',
        거래구분: '인터넷뱅킹',
      }
    })
  })
}

function kbBankRows() {
  let balance = 9_000_000
  return months.flatMap((month, index) => [
    ['입금', '매출 정산금', 1_600_000 + index * 40_000],
    ['출금', '사무실 임차료', 1_100_000],
  ].map(([kind, memo, amount], rowIndex) => {
    balance += kind === '입금' ? amount : -amount
    return {
      거래일자: iso(month, 9 + rowIndex * 12),
      거래구분: kind,
      거래금액: amount,
      거래후잔액: balance,
      적요: memo,
      거래처: rowIndex === 0 ? '주식회사 페이' : '건물관리단',
    }
  }))
}

function cardRows() {
  return months.flatMap((month, index) => [
    { 승인구분: '승인', 승인일자: iso(month, 6), 가맹점: '클라우드소프트', 승인금액: 132_000 + index * 1_000, 할부개월: '일시불' },
    { 승인구분: '승인', 승인일자: iso(month, 14), 가맹점: '오피스플러스', 승인금액: 88_000, 할부개월: '일시불' },
    { 승인구분: '취소', 승인일자: iso(month, 15), 가맹점: '오피스플러스', 승인금액: -22_000, 할부개월: '일시불' },
  ].map((row) => ({ ...row, 카드번호: '****-****-****-1234', 카드사: '신한카드' })))
}

function secondCardRows() {
  return months.flatMap((month, index) => [
    { 사용일자: iso(month, 8), 사용처: '업무용 주유소', 결제금액: 77_000 + index * 1_000, 승인상태: '정상' },
    { 사용일자: iso(month, 20), 사용처: '문구마트', 결제금액: 44_000, 승인상태: '정상' },
  ].map((row) => ({ ...row, 카드식별번호: '9876', 카드사명: '현대카드' })))
}

function taxInvoiceRows(direction) {
  const counterparties = direction === '매출'
    ? ['주식회사 리테일원', '주식회사 허브커머스']
    : ['주식회사 클라우드소프트', '주식회사 광고플랫폼']
  return months.flatMap((month, index) => counterparties.map((counterparty, rowIndex) => {
    const supply = (direction === '매출' ? 900_000 : 180_000) + index * 30_000 + rowIndex * 20_000
    const tax = Math.round(supply * 0.1)
    return {
      작성일자: iso(month, 10 + rowIndex),
      구분: direction,
      거래처: counterparty,
      품목: direction === '매출' ? '소프트웨어 이용료' : '사업용 서비스',
      공급가액: supply,
      세액: tax,
      합계금액: supply + tax,
      승인번호: `${direction === '매출' ? 'S' : 'P'}-${month.replace('-', '')}-${rowIndex + 1}`,
    }
  }))
}

function cashReceiptRows() {
  return months.flatMap((month, index) => {
    const supply = 33_000 + index * 1_000
    const tax = Math.round(supply * 0.1)
    return [{
      승인일자: iso(month, 22),
      가맹점: '문구마트',
      사용구분: '지출증빙',
      공급가액: supply,
      세액: tax,
      합계금액: supply + tax,
      승인번호: `CR-${month.replace('-', '')}`,
    }]
  })
}

function payrollRows() {
  return [
    ['김민수', 3_200_000],
    ['이서연', 2_800_000],
    ['박지훈', 2_500_000],
  ].map(([employeeName, basePay]) => ({
    지급연월: '2026-07',
    직원명: employeeName,
    기본급: basePay,
    식대: 200_000,
    지급총액: basePay + 200_000,
    국민연금: Math.round(basePay * 0.045),
    건강보험: Math.round(basePay * 0.03545),
    고용보험: Math.round(basePay * 0.009),
    소득세: Math.round(basePay * 0.03),
  }))
}

mkdirSync(h1Dir, { recursive: true })
mkdirSync(julyDir, { recursive: true })

writeWorkbook(h1Dir, '01_bank_shinhan_2026_h1.xlsx', '거래내역조회', shinhanBankRows())
writeWorkbook(h1Dir, '02_bank_kb_2026_h1.xlsx', '과거거래내역', kbBankRows())
writeWorkbook(h1Dir, '03_card_shinhan_purchase_2026_h1.xlsx', '승인내역', cardRows())
writeWorkbook(h1Dir, '04_card_hyundai_purchase_2026_h1.xlsx', '이용내역', secondCardRows())
writeWorkbook(h1Dir, '05_hometax_sales_tax_invoice_2026_h1.xlsx', '매출전자세금계산서', taxInvoiceRows('매출'))
writeWorkbook(h1Dir, '06_hometax_purchase_tax_invoice_2026_h1.xlsx', '매입전자세금계산서', taxInvoiceRows('매입'))
writeWorkbook(h1Dir, '07_hometax_cash_receipt_2026_h1.xlsx', '현금영수증', cashReceiptRows())
writeWorkbook(julyDir, '01_payroll_2026_07.xlsx', '급여대장', payrollRows())

console.log(`Wrote H1 fixtures to ${h1Dir}`)
console.log(`Wrote July payroll fixture to ${julyDir}`)
