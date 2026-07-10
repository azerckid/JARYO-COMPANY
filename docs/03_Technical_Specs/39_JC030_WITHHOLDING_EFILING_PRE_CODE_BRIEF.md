# JC-030 Withholding E-Filing File Pre-Code Technical Brief
> Created: 2026-07-07 04:40 KST
> Last Updated: 2026-07-10 15:27 KST

## 0.1 Flow Status

```text
[Flow]
완료: Slice 0b 서식 조사·Part A 매핑, Slice 1a 검증 패널
현재: Slice 1b 선행 W0 — 공식 바이너리 레이아웃 입수
다음: W1 Part B 매핑·Brief 승인 → W2 generator/Preview → W3 API/UI → W4 실제 변환 검증
차단: record type/order/length, encoding, A01 offset을 공식 근거로 확인하기 전 generator 코드 금지
```

## 0. Governing Principle

JC-030 Path 1 **2번 세목**은 JC-012·JC-013이 준비한 **월별 원천징수 집계**를
**원천징수이행상황신고서** 변환제출용 파일 후보로 변환하고, 제출 전 **서식·정합성 사전검증**을 보여준다.

- **자동 제출·자격증명 저장 없음** (JC-023 원칙).
- **self-filing 보조** — 사용자가 홈택스 **신고/납부 → 원천세 → 파일 변환신고**에서 직접 업로드.
- v1은 **근로소득 간이세액(A01) 집계 행**만; 환급조정·부표·타 소득구분 제외.
- 바이너리 레이아웃 **미입수** — [Field Mapping Part B](./38_JC030_WITHHOLDING_EFILING_FIELD_MAPPING.md); **코드 착수 전 추가 입수 필수**.

## 1. Scope

포함한다 (v1, 바이너리 스펙 입수 **후**).

1. `/dashboard/filing-support` 원천세 항목 또는 급여 화면 연동 **JC-030 패널**
2. 귀속월(`payrollPeriodKey`) 선택 — JC-012·JC-013과 동일
3. A01 서식 필드 검증 read model
4. 일회성 메타 입력(Zod): 세무서코드·담당자 등 [갭 — 스펙 확정 후]
5. **Plain 전자신고 파일** 생성 + 결정론적 단위 테스트 (포맷은 Part B 입수 후 확정)
6. fcrypt 암호화 — **Path 3 / 슬라이스 2b**; v1 Path 1은 plain + 검증
7. `POST /api/filing-preparation/withholding-efiling/generate` — stream, 서버 미보관
8. 홈택스 변환제출 단계 안내 ([Layout Acquisition §4](./37_JC030_WITHHOLDING_EFILING_LAYOUT_ACQUISITION.md))

**Slice 0b~1a (바이너리 입수 전, 승인 시):** 패널에 **서식 검증·JC-013 값 대조·blocking 사유**만 표시, 다운로드 버튼 비활성.

제외한다 (v1).

- 연말·반기-only 로직(반기납 사업자)
- A02~A03·환급(⑫~㉑)·부표·타 소득구분
- 지방소득세 위택스 파일(JC-027 별도)
- 간이지급(SC)·지급명세서(1175) 파일
- `국세청 검증 완료` UI
- 직원별 주민번호(집계 신고서)

## 2. Route and Component Boundary

| 항목 | 결정 |
|:---|:---|
| Route | `/dashboard/filing-support` — 원천세 `FilingSupportItem` 확장 **(권장)** |
| 대안 | `/dashboard/payroll` — 급여 마감 직후 맥락 |
| Read model | `lib/efiling-withholding/summary.ts` (신규) |
| Generator | `lib/efiling-withholding/build-records.ts` — **Part B 입수 후** |
| Persistence | 없음 |
| API | `POST /api/filing-preparation/withholding-efiling/generate` |
| 진입 | 신고지원 → 원천징수이행상황신고 항목 → JC-030 패널 |

## 3. Data Sources

[Field Mapping §3](./38_JC030_WITHHOLDING_EFILING_FIELD_MAPPING.md).

| 소스 | 용도 |
|:---|:---|
| `payroll_period_summary` | 마감·인원·총지급·원천 합계 |
| `payroll_employee_line` | `incomeTaxKrw` 합계·`needs_review` |
| `lib/filing-support/summary.ts` | JC-013 가이드 교차 검증 |
| `client` + billing | 사업장 식별 |
| Request body | 세무서코드·암호(8~15) 등 |

## 4. File Format Contract

### 4.1 현재 상태 — **[갭] 바이너리 스펙 미입수**

간이지급(190byte SC)과 달리 원천세는 **공개 HWP 전산매체 제출요령이 확인되지 않음**(Slice 0b).
구현 시 아래를 **전자신고 이용안내 또는 변환프로그램 번들**에서 확정한다.

| 항목 | 상태 |
|------|------|
| 파일명 | [갭] |
| 레코드 구조 | [갭] |
| 인코딩 | EUC-KR/CP949 [추정] |
| A01 집계 필드 위치 | Part A 서식 매핑 완료 → Part B에서 record offset 확정 |

### 4.2 서식 정합 (Part A — 구현 가능 선행)

- **A01 ④⑤⑥** = JC-012/JC-013 live 값
- blocking: `closeStatus !== 'closed'`, `needs_review` 라인, Σ세액 불일치

### 4.3 암호화 (후순위)

- Path 1 plain → Path 3 fcrypt ([NTS Crypto Spec](./31_JC030_NTS_CRYPTO_SPEC_ACQUISITION.md))

## 5. API Contract (Zod 초안)

```typescript
// lib/efiling-withholding/schemas.ts (신규, 구현 시)
const withholdingEfilingGenerateBodySchema = z.object({
  tenantId: z.string().uuid(),
  clientId: z.string().uuid(),
  payrollPeriodKey: z.string().regex(/^\d{4}-\d{2}$/),
  taxOfficeCode: z.string().length(3).optional(),
  submitterPhone: z.string().max(15).optional(),
  filingPassword: z.string().min(8).max(15).optional(), // Slice 2b
})
```

Response: `application/octet-stream` (바이너리 스펙 확정 후) 또는 `422` + validation errors.

## 6. UI Copy (JC-030 공통)

- Scope Gate §5.3: **`국세청 검증 완료` 금지**
- Path 1 한계: plain 파일·변환프로그램 검증은 **사용자 홈택스**에서 수행
- 책임: [Filing Support responsibility](./09_FILING_SUPPORT_PRE_CODE_BRIEF.md)

## 7. Implementation Slices

| Slice | 내용 | 게이트 |
|-------|------|--------|
| **0b** | 참조 PDF 입수·Field Mapping | 완료 (바이너리 갭 명시) |
| **1a** | filing-support 패널 — 서식 검증·JC-013 대조 only | **구현 완료** (바이너리 입수 전) |
| **1b-W0** | 공식 바이너리 레이아웃 입수 | 파일명·record·length·encoding·A01 offset·적용일 확인 |
| **1b-W1** | Field Mapping Part B·Brief 최종 승인 | 모든 v1 필드/검증의 record 위치 확정 |
| **1b-W2** | shared read model + `build-records` + 양식 채움 확인 | 화면 값과 record 값의 동일성 |
| **1b-W3** | generate API + plain 다운로드 UI | tenant/client/month scope, 서버 미보관, blocker 우회 불가 |
| **1b-W4** | file/browser/Hometax verification | byte·encoding·record fixture와 실제 변환/업로드 검증 통과 |
| **1b-W5** | docs/QA closeout | Roadmap §2.1, Backlog, QA, Audit 동기화 |
| **2b** | fcrypt | NTS Crypto PoC |

Slice 1b는 W0부터 W5까지 완료되어야 끝난다. W0·W1 전에는 W2 generator
코드를 작성하지 않는다.

### 7.1 Slice 1b Completion Line

- [ ] 공식 바이너리 규격의 출처·버전·적용일과 로컬 검증본이 기록된다.
- [ ] A01 v1 필드가 exact record offset/length/encoding에 매핑된다.
- [ ] payroll 마감·needs-review·합계 불일치가 Preview와 API 모두에서 생성 차단된다.
- [ ] Preview와 plain record가 동일 read model을 사용한다.
- [ ] 파일명, record 순서·길이, encoding, 필수 코드, 합계가 결정론적으로 검증된다.
- [ ] 다른 tenant·사업장·귀속월 데이터가 섞이지 않는다.
- [ ] 브라우저 다운로드와 대표 파일의 홈택스 변환/업로드 검증이 통과한다.
- [ ] 파일·PII·자격증명은 서버에 영구 저장되지 않는다.
- [ ] 사용자가 직접 업로드·제출하며 직접입력·자동제출 문구가 없다.
- [ ] QA·Backlog·Completion Contract·Audit가 main 상태와 일치한다.

## 8. Preconditions (착수 전)

- [x] Layout Acquisition Slice 0a (37)
- [x] Field Mapping Part A 초안 (38)
- [ ] **바이너리 레이아웃 입수** (전자신고 이용안내 / 변환프로그램)
- [x] UI-First Gate — filing-support 원천세 JC-030 패널 HTML
- [x] Slice 1a — `lib/efiling-withholding` 검증 패널 (다운로드 비활성)
- [ ] Slice 1b W0 공식 바이너리 레이아웃 입수
- [ ] Slice 1b W1 Part B 매핑·Brief 최종 사용자 승인

## 9. Related Documents

- [Field Mapping](./38_JC030_WITHHOLDING_EFILING_FIELD_MAPPING.md)
- [Layout Acquisition](./37_JC030_WITHHOLDING_EFILING_LAYOUT_ACQUISITION.md)
- [Simplified Wage Pre-Code Brief](./30_JC030_EFILING_FILE_PRE_CODE_BRIEF.md) — 패턴 참조
- [Path 1 Roadmap](./36_PATH1_FORM_FILL_ROADMAP.md)
- [Path 1 E2E Readiness Audit](./40_PATH1_END_TO_END_FILING_READINESS_AUDIT.md)
- [Filing Support QA](../05_QA_Validation/07_FILING_SUPPORT_TEST_SCENARIOS.md)
