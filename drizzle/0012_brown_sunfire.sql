ALTER TYPE "public"."waiver_signer_role" ADD VALUE 'household';--> statement-breakpoint
DROP INDEX "waiver_signatures_user_template_idx";--> statement-breakpoint
ALTER TABLE "waiver_signatures" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "waiver_signatures" ADD COLUMN "participants" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "waiver_signatures_user_template_revision_idx" ON "waiver_signatures" USING btree ("user_id","waiver_template_id","revision");
