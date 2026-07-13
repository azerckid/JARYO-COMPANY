# JC-030 VAT Path 1b Field Mapping
> Created: 2026-07-13 KST
> Last Updated: 2026-07-13 KST

## 0. Flow Status

```text
[Flow]
현재: JC-030 부가세 Path 1b — 공식 신고서 필드 매핑 + UI-First Preview 승인 완료
Gate: 프로젝트 오너 승인 완료(2026-07-13)
완료: 부가세 Stage A 1b 판정, 자료대조 Phase 2, VAT provenance, JC-035/037/038/039/041
다음: Preview 승인 -> Pre-Code Brief -> read model/runtime 구현 -> 브라우저 검증
제외: 업로드 파일, 암호화 파일, 자동 홈택스 입력·제출, 화면 캡처 기반 클릭별 튜토리얼
```

## 1. Purpose

부가세 Path 1b는 확정된 SemuAgent 부가세 값을 사용자가 홈택스 신고서의 정확한
행과 칸에 옮겨 적을 수 있게 정리하는 read-only 화면이다. 화면의 중심 질문은 다음과
같다.

> 홈택스 미리채움 값과 무엇을 비교하고, 다르면 어느 신고서 행을 어떤 값으로
> 수정해야 하는가?

이 화면은 부가세 판단 작업대를 반복하지 않는다. AI 출처·근거·증빙·workflow 상태는
기존 `/dashboard/vat`에서 처리하고, Path 1b 화면은 사용자 확정과 provenance를 통과한
값만 소비한다.

## 2. Official Evidence

### 2.1 2026 홈택스 신고 경로

- 국세청 2026년 제1기 부가가치세 확정신고 안내(2026-07-02):
  https://www.nts.go.kr/nts/na/ntt/selectNttInfo.do?mi=2201&nttSn=1352987
- PC 접근 경로: `세금신고 -> 부가가치세 신고`
- 본 v1 대상 화면: `일반과세자 정기신고(확정)`
- 국세청 안내는 2026년 확정신고에서 홈택스 미리채움 서비스를 제공한다고 설명한다.

### 2.2 법정 신고서 행

- 부가가치세법 시행규칙 별지 제21호서식 `일반과세자 부가가치세 신고서`:
  https://taxlaw.nts.go.kr/downloadPDFFile.do?fleId=701000000000997490&fleSn=1
- 이 문서는 신고서 행 번호와 계산 관계의 정본이다. 홈택스의 버튼·탭 배치는 바뀔 수
  있지만, SemuAgent가 표시하는 행 번호와 필드명은 이 법정 신고서를 따른다.

## 3. Product Scope

### 3.1 Included

- 일반과세자 정기 확정신고
- 사업자·과세기간 확인
- 홈택스 메뉴 경로·신고 화면명
- 법정 신고서의 행 번호·금액 칸·세액 칸
- SemuAgent 확정값과 홈택스 미리채움 값의 대조
- 사용자가 직접 입력할 행과 홈택스 자동 계산값을 대조할 행의 구분
- 미지원 조정 항목이 있으면 `입력 준비 완료`로 표시하지 않는 fail-closed gate

### 3.2 Excluded

- 간이과세자 신고, 예정신고, 조기환급, 기한후·수정신고
- 화면 캡처를 이용한 클릭별 튜토리얼
- 홈택스 자동 입력·자동 제출·자동 납부
- Hometax 자격증명·인증서 저장
- 회계프로그램 변환파일, fcrypt, 암호화 파일
- 존재하지 않는 세부값이나 세액의 역산·추정

## 4. Field Mapping Contract

### 4.1 Basic Filing Context

| 홈택스/신고서 항목 | SemuAgent source | 표시 규칙 |
|:---|:---|:---|
| 신고유형 | 고정 계약 | `일반과세자 정기신고(확정)`만 지원 |
| 신고기간 | `VatSummary.period` | 연도·기수·시작월·종료월 표시 |
| 사업자 | `VatSummary.businessEntity` | 사업자명 표시, tenant/business/period 스코프 강제 |

### 4.2 Sales and Output Tax

| 신고서 위치 | 의미 | SemuAgent source / required derivation | UI mode |
|:---|:---|:---|:---|
| (1) 과세 세금계산서 발급분 | 세금계산서 과세 매출 | 확정 sale VAT fact 중 `tax_invoice + taxable` | 직접 입력·대조 |
| (2) 매입자발행 세금계산서 | 매입자발행 과세 매출 | 현재 전용 source flag 없음 | 값이 있으면 blocker |
| (3) 신용카드·현금영수증 발행분 | 카드·현금영수증 과세 매출 | 확정 sale VAT fact 중 `card/receipt + taxable` | 직접 입력·대조 |
| (4) 기타 매출분 | 그 밖의 과세 매출 | (1)~(3)에 속하지 않는 확정 taxable sale | 직접 입력·대조 |
| (5) 영세율 세금계산서 발급분 | 세금계산서 영세율 매출 | 확정 sale VAT fact 중 `tax_invoice + zero_rated` | 직접 입력·대조 |
| (6) 영세율 기타 | 그 밖의 영세율 매출 | (5)에 속하지 않는 확정 zero-rated sale | 직접 입력·대조 |
| (7) 예정신고 누락분 | 누락 매출 조정 | 전용 canonical field 없음 | 0으로 추정 금지, 해당 시 blocker |
| (8) 대손세액 가감 | 대손 조정 | 전용 canonical field 없음 | 0으로 추정 금지, 해당 시 blocker |
| (9) 합계 | 과세·영세율 매출 합계/매출세액 | (1)~(8) 합계. 지원 범위에서는 `taxableSupplyKrw + zeroRatedSupplyKrw`, `outputTaxKrw`와 일치해야 함 | 홈택스 계산값 대조 |
| (84) 면세사업 수입금액 합계 | 면세 매출 | `exemptSupplyKrw` | 값이 0보다 클 때 표시·대조 |

### 4.3 Purchase and Input Tax

| 신고서 위치 | 의미 | SemuAgent source / required derivation | UI mode |
|:---|:---|:---|:---|
| (10) 일반매입 | 세금계산서 일반매입 | 확정 purchase VAT fact 중 `tax_invoice`, 고정자산 제외 | 직접 입력·대조 |
| (11) 고정자산 매입 | 세금계산서 고정자산 | 현재 계정 taxonomy만으로 판정 불가 | 명시적 고정자산 분류 없으면 blocker |
| (12) 예정신고 누락분 | 누락 매입 조정 | 전용 canonical field 없음 | 해당 시 blocker |
| (13) 매입자발행 세금계산서 | 매입자발행 매입 | 현재 전용 source flag 없음 | 해당 시 blocker |
| (14) 그 밖의 공제매입세액 | 카드·현금영수증 등 | 확정 purchase VAT fact 중 `card/receipt`; 법정 세부항목별 합계 필요 | 직접 입력·대조 |
| (15) 합계 | 총 매입세액 | 지원되는 (10)~(14) 확정 VAT fact 합계. 세액은 `inputTaxKrw`와 일치해야 함 | 홈택스 계산값 대조 |
| (16) 공제받지 못할 매입세액 | 불공제·안분 불공제분 | 사용자 확정 `vat_deduction_review`에서 (50)~(53) 합계 | 직접 입력·대조 |
| (17) 차감계 | 공제 가능 매입세액 | `(15) - (16)`, 세액은 `inputTaxDeductibleKrw`와 일치해야 함 | 홈택스 계산값 대조 |

고정자산 여부를 `소모품비` 같은 기존 계정명으로 추정하지 않는다. (11)을 지원하려면
확정 원장에 별도 고정자산 분류 사실이 필요하며, 이 사실이 없고 고정자산 매입 가능성이
남아 있으면 Path 1b gate를 통과시키지 않는다.

### 4.4 Tax Before Credits and Final Tax

| 신고서 위치 | 의미 | SemuAgent source | UI mode |
|:---|:---|:---|:---|
| ㉰ 납부(환급)세액 | 매출세액 ㉮ - 매입세액 ㉯ | `outputTaxKrw - inputTaxDeductibleKrw` | 홈택스 계산값 대조 |
| (18)~(26) | 경감·공제·예정고지·대리납부·가산세 등 | 현재 canonical field 없음 | 별도 확인 필요 |
| (27) 차감·가감 후 최종 납부(환급)세액 | 최종 신고 세액 | 홈택스가 (18)~(26)을 반영해 계산 | SemuAgent 확정값으로 표시 금지, 홈택스 최종값 확인 |

기존 `VatTaxSummary.payableTaxKrw`는 법정 신고서의 ㉰에 해당한다. 이를 (27) 최종
납부세액이라고 표시하지 않는다.

## 5. UI Contract

### 5.1 Entry and Layout

- `/dashboard/vat` 상단의 `홈택스 입력값` CTA에서 별도 화면으로 이동한다.
- 기존 VAT 작업대에 새로운 카드·설명·AI 상태를 추가하지 않는다.
- Path 1b 화면은 한 개의 입력표만 사용한다.
- 기본 열은 `홈택스 신고서 위치 / SemuAgent 확정값 / 확인 방식` 세 개다.
- 직접 입력 행과 홈택스 자동 계산 대조 행을 서로 다른 짧은 label로 구분한다.

### 5.2 State Contract

| 상태 | 화면 |
|:---|:---|
| ready | `입력 준비 완료`, 홈택스 경로와 입력표 표시 |
| blocked | 미완료 원인 개수와 `부가세로 돌아가서 처리` CTA만 표시; 값을 확정값처럼 노출하지 않음 |
| empty | 확정 VAT fact가 없음을 알리고 자료대조/부가세 화면으로 이동 |
| stale | `확정 원장 다시 계산`이 필요한 상태로 안내; 이전 snapshot 값 사용 금지 |
| unsupported | 예정신고 누락·대손·고정자산 미분류·특수 조정 등 현재 범위 밖 항목을 명시하고 준비 완료 차단 |

### 5.3 Information Boundary

- AI provider, 근거 문장, 증빙 trace, confidence, workflow status를 반복하지 않는다.
- 신고서 행 번호와 값만 보여준다.
- `(27)`은 홈택스 최종 계산값임을 하단 한 줄로만 설명한다.
- 자동입력·자동제출이 아니라는 책임 경계는 화면 하단에 한 번만 표시한다.

## 6. Runtime Gap Before Implementation

현재 `VatSummary`는 핵심 합계를 갖지만 신고서 세부 행을 모두 갖지 않는다. Preview
다음 Pre-Code Brief에서 아래 read model을 고정한다.

```ts
type VatHometaxInputSummary = {
  filingType: 'general_regular_final'
  period: { key: string; label: string }
  business: { id: string; name: string }
  gate: { status: 'ready' | 'blocked' | 'empty' | 'stale' | 'unsupported'; reasons: string[] }
  rows: Array<{
    formLine: string
    label: string
    amountKrw: number | null
    taxKrw: number | null
    mode: 'input' | 'calculated_check' | 'hometax_final_check'
  }>
}
```

세부 행은 현재 `vat_period_summary` 합계를 임의 비율로 나누지 않고, provenance에서
검증한 classification VAT fact와 사용자 확정 deduction review를 다시 집계한다.

## 7. Acceptance Criteria for UI-First Gate

- [x] 공식 2026 홈택스 신고 경로와 법정 신고서 행을 기록했다.
- [x] 현재 read model로 가능한 값과 신규 집계가 필요한 값을 분리했다.
- [x] `(27)` 최종세액을 현재 `payableTaxKrw`로 오표시하지 않는 계약을 고정했다.
- [x] HTML Preview에서 사용자가 한 표로 입력 위치와 값을 확인한다.
- [x] 모바일·데스크톱에서 텍스트와 값이 겹치지 않는다.
- [x] 프로젝트 오너가 Preview를 확인·승인한다.
- [ ] 승인 후 Pre-Code Brief와 Component/Library Plan을 작성한다.

## 8. Related Documents

- **Technical_Specs**: [Path 1 Form Fill Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md)
- **Technical_Specs**: [VAT Stage A Audit](./43_JC030_VAT_NONENCRYPTED_UPLOAD_TEMPLATE_AUDIT.md)
- **Technical_Specs**: [VAT Confirmed Ledger Provenance Audit](./42_VAT_CONFIRMED_LEDGER_PROVENANCE_AUDIT.md)
- **Technical_Specs**: [Open Backlog Completion Contracts](./22_OPEN_BACKLOG_COMPLETION_CONTRACTS.md)
- **UI_Screens**: [Screen Flow](../02_UI_Screens/00_SCREEN_FLOW.md)
- **UI_Screens**: [UI Design](../02_UI_Screens/01_UI_DESIGN.md)
- **UI_Screens**: [VAT Path 1b Prototype Review](../02_UI_Screens/14_VAT_PATH1B_PROTOTYPE_REVIEW.md)
- **Logic_Progress**: [Backlog / JC-030](../04_Logic_Progress/00_BACKLOG.md)
