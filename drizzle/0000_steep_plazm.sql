CREATE TYPE "public"."audit_action" AS ENUM('MEMBER_CREATED', 'MEMBER_UPDATED', 'MEMBER_DELETED', 'MEMBERSHIP_EXTENDED', 'MEMBERSHIP_PAUSED', 'EMAIL_CHANGED', 'STRIPE_SYNCED', 'REFUND_ISSUED', 'BULK_IMPORT', 'ADMIN_ROLE_CHANGE', 'MEMBERSHIP_ADJUSTMENT', 'RECONCILIATION');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'trialing', 'unpaid', 'deleted', 'complimentary', 'legacy');--> statement-breakpoint
CREATE TYPE "public"."plan_interval" AS ENUM('year', 'month');--> statement-breakpoint
CREATE TYPE "public"."plan_type" AS ENUM('individual', 'family');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" "audit_action" NOT NULL,
	"performed_by" varchar(128) NOT NULL,
	"performed_by_email" varchar(255),
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"membership_number" varchar(20) NOT NULL,
	"member_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"plan_type" "plan_type" NOT NULL,
	"status" "membership_status" NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"qr_code_data" text NOT NULL,
	"pdf_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_cards_membership_number_unique" UNIQUE("membership_number")
);
--> statement-breakpoint
CREATE TABLE "membership_counters" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"stripe_price_id" varchar(255) NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"interval" "plan_interval" NOT NULL,
	"benefits" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_stats" (
	"id" varchar(50) PRIMARY KEY DEFAULT 'memberships' NOT NULL,
	"total_members" integer DEFAULT 0 NOT NULL,
	"active_members" integer DEFAULT 0 NOT NULL,
	"expired_members" integer DEFAULT 0 NOT NULL,
	"canceled_members" integer DEFAULT 0 NOT NULL,
	"individual_count" integer DEFAULT 0 NOT NULL,
	"family_count" integer DEFAULT 0 NOT NULL,
	"monthly_revenue" numeric(12, 2) DEFAULT '0' NOT NULL,
	"yearly_revenue" numeric(12, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_subscription_id" varchar(255),
	"plan_type" "plan_type" NOT NULL,
	"status" "membership_status" DEFAULT 'incomplete' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"auto_renew" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firebase_uid" varchar(128) NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"phone" varchar(50),
	"address_street" varchar(255),
	"address_city" varchar(100),
	"address_state" varchar(50),
	"address_zip" varchar(20),
	"stripe_customer_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"type" varchar(100) NOT NULL,
	"status" "webhook_status" DEFAULT 'processing' NOT NULL,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_cards" ADD CONSTRAINT "membership_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_cards" ADD CONSTRAINT "membership_cards_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_user_id_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "membership_cards_user_id_idx" ON "membership_cards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "membership_cards_membership_id_idx" ON "membership_cards" USING btree ("membership_id");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_counters_year_idx" ON "membership_counters" USING btree ("year");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_plans_stripe_price_idx" ON "membership_plans" USING btree ("stripe_price_id");--> statement-breakpoint
CREATE INDEX "memberships_user_id_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memberships_stripe_sub_idx" ON "memberships" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "memberships_status_end_date_idx" ON "memberships" USING btree ("status","end_date");--> statement-breakpoint
CREATE INDEX "memberships_user_status_idx" ON "memberships" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "users_stripe_customer_idx" ON "users" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "webhook_events_type_idx" ON "webhook_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "webhook_events_status_idx" ON "webhook_events" USING btree ("status");