ALTER TYPE "public"."audit_action" ADD VALUE 'RENEWAL_EMAIL_SENT' BEFORE 'RECONCILIATION';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'RENEWAL_EMAIL_RESENT' BEFORE 'RECONCILIATION';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'AUTOMATED_RENEWAL_EMAIL_SENT' BEFORE 'RECONCILIATION';--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"membership_id" uuid,
	"email_type" varchar(80) NOT NULL,
	"delivery_type" varchar(20) NOT NULL,
	"campaign_key" varchar(255) NOT NULL,
	"recipient_email" varchar(255) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"status" varchar(20) NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"sent_by" varchar(128) NOT NULL,
	"sent_by_email" varchar(255),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_log_user_type_campaign_idx" ON "email_log" USING btree ("user_id","email_type","campaign_key");--> statement-breakpoint
CREATE INDEX "email_log_membership_idx" ON "email_log" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "email_log_created_at_idx" ON "email_log" USING btree ("created_at");