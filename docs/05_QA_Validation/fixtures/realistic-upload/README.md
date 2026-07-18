# 기관형 업로드 테스트 fixture

Created: 2026-07-19 03:45 KST
Last Updated: 2026-07-19 03:45 KST

이 폴더의 XLSX는 실회사·실개인 자료가 아닌 **합성 QA 데이터**다. 다만 SemuAgent 전용 표가 아니라 은행·카드사·홈택스 원본에서 흔히 보는 열 구조와 다른 형식을 의도적으로 사용한다.

## 기간과 업로드 경로

| 묶음 | 기간 | 파일 | 업로드 경로 |
|---|---|---|---|
| H1 기장·부가세 | 2026-01~06 | `2026-h1/`의 7개 파일 | 세비서 또는 자료수집 (`2026-H1`) |
| 7월 급여 | 2026-07 | `2026-07/01_payroll_2026_07.xlsx` | 급여 전용 업로드 |

H1 파일에는 7월 행을 넣지 않는다. PG 정산·카드매출은 회사에 해당할 때만 추가하는 후속 시나리오이며, 이 필수 묶음에는 넣지 않는다.

## H1 파일과 기대 결과

| 파일 | 원본 형식 변형 | 기대 유형 | 핵심 검증 |
|---|---|---|---|
| `01_bank_shinhan_2026_h1.xlsx` | 입금·출금 별도 열 | `bank` | 적요에 카드·세금계산서 단어가 있어도 전 행 통장 |
| `02_bank_kb_2026_h1.xlsx` | 거래금액 한 열 + 입출금 구분 | `bank` | 다른 열 구조에서도 방향 보존 |
| `03_card_shinhan_purchase_2026_h1.xlsx` | 승인·취소·할부 열 | `card` | 승인/취소 원문 보존 |
| `04_card_hyundai_purchase_2026_h1.xlsx` | 다른 날짜·사용처·금액 헤더 | `card` | 카드사별 헤더 변형 |
| `05_hometax_sales_tax_invoice_2026_h1.xlsx` | 홈택스 매출 목록형 | `tax_invoice` | 공급가액·세액·합계로 매출 VAT 사실값 도출 |
| `06_hometax_purchase_tax_invoice_2026_h1.xlsx` | 홈택스 매입 목록형 | `tax_invoice` | 공급가액·세액·합계로 매입 VAT 사실값 도출 |
| `07_hometax_cash_receipt_2026_h1.xlsx` | 현금영수증 지출증빙형 | `receipt` | 매입 증빙·VAT 사실값 도출 |

## 원칙

- 파일명은 원본 종류를 드러내지만, 행의 적요·거래처 문구가 파일 유형을 뒤집어서는 안 된다.
- 일반 과세는 `공급가액 + 세액 = 합계금액`이라는 정확한 관계가 있을 때만 도출한다.
- 영세율·면세는 세액 0만으로 추정하지 않고 원본의 명시 구분 또는 사용자 검토가 필요하다.
- 카드 취소의 원 승인 연결은 별도 대조 시나리오다. 이 fixture는 원문 상태를 보존한다.

## 재생성

```bash
node scripts/qa/create-realistic-upload-fixtures.mjs
```

## Related Documents

- [CUI-3 업로드·채팅 기술 Brief](../../../03_Technical_Specs/62_JC043_CUI3_SEBISEO_UPLOAD_CHAT_PRE_CODE_BRIEF.md) — 허용 형식과 업로드 결과 계약
- [CUI-4 업로드 결과 카드 QA](../../13_JC043_CUI4_SEBISEO_UPLOAD_RESULT_CARD_TEST_SCENARIOS.md) — 자료수집 뒤 사용자 확인 흐름
- [MVP QA Baseline](../../01_MVP_QA_BASELINE.md) — 공통 QA 기준
