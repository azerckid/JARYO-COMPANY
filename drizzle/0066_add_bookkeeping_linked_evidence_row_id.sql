-- 수동 증분 SQL: JC-010 2b-2 — bookkeeping_transaction_classification에
-- linked_evidence_row_id 컬럼 추가.
-- 통장 행이 사용자가 확정한 증빙 행(세금계산서/현금영수증/카드)을 가리키는
-- 단방향 링크. FK 제약은 두지 않는다(다른 사용자 입력 필드들과 동일
-- 컨벤션) — 연결 대상 행 존재 여부는 서비스 레이어에서 검증한다.
-- 적용 대상: 0065까지 적용된 DB

ALTER TABLE `bookkeeping_transaction_classification` ADD COLUMN `linked_evidence_row_id` text;
--> statement-breakpoint
CREATE INDEX `bookkeeping_tx_linked_evidence_idx`
  ON `bookkeeping_transaction_classification` (`tenant_id`, `linked_evidence_row_id`);
