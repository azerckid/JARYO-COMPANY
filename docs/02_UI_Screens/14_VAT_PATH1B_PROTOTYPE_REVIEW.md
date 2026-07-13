# VAT Path 1b Prototype Review
> Created: 2026-07-13 KST
> Last Updated: 2026-07-13 KST

## 1. HTML UI Preview

- Preview: [부가세 홈택스 입력값](./previews/14_vat_path1b.html)
- 선행 화면: [부가세 작업대](./previews/03_vat.html)
- 확인 방식: 브라우저에서 HTML 파일 직접 열람
- 제작자 검증: Chrome desktop 1440×1100, mobile 390×844 렌더 확인
- 확인 목적: 사용자가 홈택스 미리채움 값과 SemuAgent 확정값을 한 표에서 비교하고,
  다른 행만 수정할 수 있는지 확인

## 2. Prototype Scope

- 기존 부가세 작업대와 별도 화면으로 분리한다.
- 기본 화면은 `일반과세자 정기신고(확정)` 한 종류다.
- 홈택스 경로, 사업자, 과세기간, 신고서 행 번호, 금액, 세액, 확인 방식만 표시한다.
- AI 출처·근거·증빙·workflow 상태와 거래별 판단 액션은 반복하지 않는다.
- 업로드 파일, 자동 홈택스 입력·제출, 화면 캡처 기반 클릭별 안내는 제공하지 않는다.

## 3. Key User Flow

```text
부가세 작업대
  -> 공제·과세유형·안분 사용자 확정
  -> 확정 원장 provenance/gate 통과
  -> 홈택스 입력값
  -> 홈택스 미리채움과 행별 비교
  -> 다른 행만 사용자가 수정
  -> 홈택스가 계산한 (27) 최종 납부(환급)세액 확인
  -> 사용자가 직접 제출
```

## 4. Screen States

- Ready: 녹색 `입력 준비 완료`, 홈택스 경로와 한 개 입력표 표시
- Blocked: 미완료 원인과 `부가세로 돌아가서 처리`만 표시하고 확정값 표는 숨김
- Empty: 확정 VAT fact 없음, 자료대조 또는 부가세 작업대로 이동
- Stale: 확정 원장 다시 계산 필요, 이전 snapshot 값은 표시하지 않음
- Unsupported: 예정신고 누락·대손·고정자산 미분류·특수 조정 등 현재 범위를 표시하고 준비 완료 차단

## 5. Data Flow

- Inputs: 같은 tenant/사업장/기간의 확정 classification VAT fact, 사용자 확정 공제 검토,
  현재 provenance fingerprint, Path 1/VAT package gate
- Displayed data: 일반과세자 정기 확정신고의 (1)~(17), ㉰, (84), (27) 확인 경계
- Mutations: 없음(read-only)
- External dependency: 홈택스 미리채움 현재값은 SemuAgent가 직접 조회하지 않는다. 화면은
  SemuAgent 확정값을 비교 기준으로 제공한다.

## 6. Information Hierarchy

1. 입력 준비 여부
2. 홈택스 메뉴 경로
3. 신고서 행별 금액·세액
4. `값 비교·수정` / `자동 합계 대조` / `최종 확인`
5. (27) 최종세액과 자동제출 책임 경계 한 줄

별도 Hero, 카드 묶음, AI 설명, 증빙 목록, 신고 준비 blocker 반복 영역은 두지 않는다.

## 7. User Confirmation

- 화면/UI 선확인 여부: 확인함
- HTML Preview 확인 여부: 확인함
- 확인자: 프로젝트 오너
- 확인 일시: 2026-07-13
- 승인 결과: 별도 `홈택스 입력값` 화면·단일 표·세 가지 확인 방식·`(27)` 경계 승인
- 다음 단계: Pre-Code Brief와 `VatHometaxInputSummary` 계약 작성

## 8. Review Questions

1. 기존 VAT 작업대와 별도 `홈택스 입력값` 화면으로 분리한 구성이 맞는가?
2. 한 표의 정보량과 `값 비교·수정 / 자동 합계 대조 / 최종 확인` 구분이 이해되는가?
3. `(27)`을 SemuAgent 세액으로 단정하지 않고 홈택스 최종 계산값으로 둔 표현이 맞는가?
4. 모바일에서 각 신고서 행이 한 블록으로 쌓이는 구조가 적절한가?

## 9. Related Documents

- **UI_Screens**: [Screen Flow](./00_SCREEN_FLOW.md)
- **UI_Screens**: [UI Design](./01_UI_DESIGN.md)
- **UI_Screens**: [VAT Prototype Review](./05_VAT_PROTOTYPE_REVIEW.md)
- **Technical_Specs**: [VAT Path 1b Field Mapping](../03_Technical_Specs/52_JC030_VAT_PATH1B_FIELD_MAPPING.md)
- **Technical_Specs**: [Path 1 Form Fill Roadmap](../03_Technical_Specs/36_PATH1_FORM_FILL_ROADMAP.md)
- **Technical_Specs**: [VAT Stage A Audit](../03_Technical_Specs/43_JC030_VAT_NONENCRYPTED_UPLOAD_TEMPLATE_AUDIT.md)
- **Logic_Progress**: [Backlog / JC-030](../04_Logic_Progress/00_BACKLOG.md)
