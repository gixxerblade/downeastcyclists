ALTER TABLE "email_log" ADD COLUMN "operation_key" varchar(255);--> statement-breakpoint
ALTER TABLE "email_log" ADD COLUMN "provider_email_id" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX "email_log_operation_key_idx" ON "email_log" USING btree ("operation_key");--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_claim_status_check" CHECK ("email_log"."operation_key" IS NULL OR "email_log"."status" IN ('pending', 'uncertain', 'sent'));