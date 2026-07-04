-- 수동 증분 SQL: client에 사업자 유형(taxEntityType) 컬럼 추가
-- 적용 대상: 0058까지 적용된 DB
-- 목적: JC-032 사업자 유형(개인/법인/면세)을 사업장 단위로 저장해
--       신고 준비 허브(JC-029) dimming의 실데이터 소스로 사용한다.
--       null = 미지정(흐림 없음). enum 검증은 Drizzle 레벨에서 수행.

ALTER TABLE `client` ADD COLUMN `tax_entity_type` text;
