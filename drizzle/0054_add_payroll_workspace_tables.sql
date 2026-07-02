-- 수동 증분 SQL: payroll workspace 실행 결과 및 4대보험 고지내역 테이블 추가
-- 적용 대상: 0053까지 적용된 DB
-- 목적: JC-012 급여 화면의 급여대장, 마감 상태, 건강보험 EDI/사회보험징수포털
--       고지액 매칭 결과를 저장한다.
--       포털 로그인 자격증명, 공동인증서, 비밀번호는 저장하지 않는다.

CREATE TABLE `payroll_period_summary` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `payroll_period` text NOT NULL,
  `payment_date` text,
  `employee_count` integer DEFAULT 0 NOT NULL,
  `issue_count` integer DEFAULT 0 NOT NULL,
  `gross_pay_krw` integer DEFAULT 0 NOT NULL,
  `withholding_tax_krw` integer DEFAULT 0 NOT NULL,
  `social_insurance_krw` integer DEFAULT 0 NOT NULL,
  `deduction_total_krw` integer DEFAULT 0 NOT NULL,
  `net_pay_krw` integer DEFAULT 0 NOT NULL,
  `notice_import_status` text DEFAULT 'missing' NOT NULL,
  `close_status` text DEFAULT 'open' NOT NULL,
  `closed_by_staff_id` text,
  `closed_at` text,
  `payslip_status` text DEFAULT 'not_generated' NOT NULL,
  `withholding_statement_status` text DEFAULT 'not_generated' NOT NULL,
  `insurance_statement_status` text DEFAULT 'not_generated' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`closed_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_period_summary_scope_uidx`
  ON `payroll_period_summary` (`tenant_id`, `client_id`, `payroll_period`);
--> statement-breakpoint
CREATE INDEX `payroll_period_summary_period_idx`
  ON `payroll_period_summary` (`tenant_id`, `client_id`, `payroll_period`);
--> statement-breakpoint
CREATE INDEX `payroll_period_summary_close_idx`
  ON `payroll_period_summary` (`tenant_id`, `client_id`, `close_status`);
--> statement-breakpoint
CREATE TABLE `payroll_employee_line` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `period_summary_id` text NOT NULL,
  `source_batch_id` text,
  `source_row_id` text,
  `upload_session_id` text,
  `employee_code` text,
  `employee_name` text NOT NULL,
  `department` text,
  `job_title` text,
  `job_type` text,
  `base_salary_krw` integer DEFAULT 0 NOT NULL,
  `allowance_krw` integer DEFAULT 0 NOT NULL,
  `gross_pay_krw` integer DEFAULT 0 NOT NULL,
  `income_tax_krw` integer DEFAULT 0 NOT NULL,
  `local_income_tax_krw` integer DEFAULT 0 NOT NULL,
  `national_pension_krw` integer DEFAULT 0 NOT NULL,
  `health_insurance_krw` integer DEFAULT 0 NOT NULL,
  `long_term_care_krw` integer DEFAULT 0 NOT NULL,
  `employment_insurance_krw` integer DEFAULT 0 NOT NULL,
  `social_insurance_krw` integer DEFAULT 0 NOT NULL,
  `other_deduction_krw` integer DEFAULT 0 NOT NULL,
  `deduction_total_krw` integer DEFAULT 0 NOT NULL,
  `net_pay_krw` integer DEFAULT 0 NOT NULL,
  `notice_match_status` text DEFAULT 'missing_notice' NOT NULL,
  `notice_line_id` text,
  `status` text DEFAULT 'needs_review' NOT NULL,
  `issue_code` text,
  `issue_message` text,
  `edited_by_staff_id` text,
  `edited_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`period_summary_id`) REFERENCES `payroll_period_summary`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`source_batch_id`) REFERENCES `payroll_extraction_batch`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`source_row_id`) REFERENCES `payroll_extraction_row`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`upload_session_id`) REFERENCES `upload_session`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`edited_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payroll_employee_line_period_idx`
  ON `payroll_employee_line` (`tenant_id`, `client_id`, `period_summary_id`);
--> statement-breakpoint
CREATE INDEX `payroll_employee_line_status_idx`
  ON `payroll_employee_line` (`tenant_id`, `client_id`, `period_summary_id`, `status`);
--> statement-breakpoint
CREATE INDEX `payroll_employee_line_source_row_idx`
  ON `payroll_employee_line` (`tenant_id`, `source_row_id`);
--> statement-breakpoint
CREATE INDEX `payroll_employee_line_notice_match_idx`
  ON `payroll_employee_line` (`tenant_id`, `client_id`, `period_summary_id`, `notice_match_status`);
--> statement-breakpoint
CREATE TABLE `payroll_insurance_notice_import` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `payroll_period` text NOT NULL,
  `source_type` text NOT NULL,
  `original_filename` text,
  `storage_key` text,
  `file_hash` text,
  `status` text DEFAULT 'uploaded' NOT NULL,
  `imported_by_staff_id` text,
  `imported_at` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`imported_by_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payroll_insurance_notice_import_period_idx`
  ON `payroll_insurance_notice_import` (`tenant_id`, `client_id`, `payroll_period`);
--> statement-breakpoint
CREATE INDEX `payroll_insurance_notice_import_status_idx`
  ON `payroll_insurance_notice_import` (`tenant_id`, `client_id`, `status`);
--> statement-breakpoint
CREATE TABLE `payroll_insurance_notice_line` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `client_id` text NOT NULL,
  `notice_import_id` text NOT NULL,
  `employee_code` text,
  `employee_name` text,
  `match_key_hash` text,
  `national_pension_krw` integer DEFAULT 0 NOT NULL,
  `health_insurance_krw` integer DEFAULT 0 NOT NULL,
  `long_term_care_krw` integer DEFAULT 0 NOT NULL,
  `employment_insurance_krw` integer DEFAULT 0 NOT NULL,
  `match_status` text DEFAULT 'unmatched' NOT NULL,
  `matched_employee_line_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`notice_import_id`) REFERENCES `payroll_insurance_notice_import`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`matched_employee_line_id`) REFERENCES `payroll_employee_line`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payroll_insurance_notice_line_import_idx`
  ON `payroll_insurance_notice_line` (`tenant_id`, `notice_import_id`);
--> statement-breakpoint
CREATE INDEX `payroll_insurance_notice_line_match_idx`
  ON `payroll_insurance_notice_line` (`tenant_id`, `client_id`, `match_status`);
--> statement-breakpoint
CREATE INDEX `payroll_insurance_notice_line_employee_line_idx`
  ON `payroll_insurance_notice_line` (`tenant_id`, `matched_employee_line_id`);
