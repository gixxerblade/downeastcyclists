CREATE TYPE "public"."trail_issue_event_type" AS ENUM('created', 'status_changed', 'priority_changed', 'assigned', 'note_added', 'county_email_generated', 'county_email_sent', 'resolved', 'reopened');--> statement-breakpoint
CREATE TYPE "public"."trail_issue_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."trail_issue_status" AS ENUM('new', 'triaged', 'assigned', 'county_needed', 'county_contacted', 'in_progress', 'resolved', 'closed_no_action', 'duplicate');--> statement-breakpoint
CREATE TYPE "public"."trail_issue_type" AS ENUM('trail_obstruction', 'erosion_or_hole', 'standing_water_or_drainage', 'overgrown_vegetation', 'damaged_feature', 'missing_or_damaged_sign', 'trash_or_vandalism', 'other');--> statement-breakpoint
CREATE TYPE "public"."trail_location_source" AS ENUM('browser_geolocation', 'map_pin', 'manual', 'qr_prefill');--> statement-breakpoint
CREATE TABLE "trail_maintenance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"event_type" "trail_issue_event_type" NOT NULL,
	"actor_user_id" uuid,
	"actor_label" varchar(255) NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trail_maintenance_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"author_user_id" uuid,
	"author_email" varchar(255),
	"note" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trail_maintenance_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"bucket_name" varchar(160) NOT NULL,
	"object_key" text NOT NULL,
	"original_filename" varchar(255),
	"content_type" varchar(120) NOT NULL,
	"byte_size" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trail_maintenance_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" varchar(24) NOT NULL,
	"trail_system_id" uuid NOT NULL,
	"trail_segment_id" uuid,
	"issue_type" "trail_issue_type" NOT NULL,
	"issue_type_other" varchar(160),
	"status" "trail_issue_status" DEFAULT 'new' NOT NULL,
	"priority" "trail_issue_priority" DEFAULT 'normal' NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"description" text,
	"location_source" "trail_location_source" DEFAULT 'manual' NOT NULL,
	"location_notes" text,
	"latitude" double precision,
	"longitude" double precision,
	"location_accuracy_meters" double precision,
	"reporter_name" varchar(160),
	"reporter_contact" varchar(255),
	"user_agent" text,
	"submitter_ip_hash" varchar(128),
	"assigned_to_user_id" uuid,
	"county_email_generated_at" timestamp with time zone,
	"county_email_sent_at" timestamp with time zone,
	"resolved_by_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trail_maintenance_reports_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "trail_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trail_system_id" uuid NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"color_label" varchar(80),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trail_systems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trail_systems_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "trail_maintenance_events" ADD CONSTRAINT "trail_maintenance_events_report_id_trail_maintenance_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."trail_maintenance_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_maintenance_events" ADD CONSTRAINT "trail_maintenance_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_maintenance_notes" ADD CONSTRAINT "trail_maintenance_notes_report_id_trail_maintenance_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."trail_maintenance_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_maintenance_notes" ADD CONSTRAINT "trail_maintenance_notes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_maintenance_photos" ADD CONSTRAINT "trail_maintenance_photos_report_id_trail_maintenance_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."trail_maintenance_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_maintenance_reports" ADD CONSTRAINT "trail_maintenance_reports_trail_system_id_trail_systems_id_fk" FOREIGN KEY ("trail_system_id") REFERENCES "public"."trail_systems"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_maintenance_reports" ADD CONSTRAINT "trail_maintenance_reports_trail_segment_id_trail_segments_id_fk" FOREIGN KEY ("trail_segment_id") REFERENCES "public"."trail_segments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_maintenance_reports" ADD CONSTRAINT "trail_maintenance_reports_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_maintenance_reports" ADD CONSTRAINT "trail_maintenance_reports_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_segments" ADD CONSTRAINT "trail_segments_trail_system_id_trail_systems_id_fk" FOREIGN KEY ("trail_system_id") REFERENCES "public"."trail_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trail_maintenance_events_report_idx" ON "trail_maintenance_events" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "trail_maintenance_events_created_at_idx" ON "trail_maintenance_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "trail_maintenance_notes_report_idx" ON "trail_maintenance_notes" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "trail_maintenance_notes_created_at_idx" ON "trail_maintenance_notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "trail_maintenance_photos_report_idx" ON "trail_maintenance_photos" USING btree ("report_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trail_maintenance_photos_object_key_idx" ON "trail_maintenance_photos" USING btree ("object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "trail_maintenance_reports_public_id_idx" ON "trail_maintenance_reports" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "trail_maintenance_reports_status_idx" ON "trail_maintenance_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trail_maintenance_reports_priority_idx" ON "trail_maintenance_reports" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "trail_maintenance_reports_created_at_idx" ON "trail_maintenance_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "trail_maintenance_reports_system_status_idx" ON "trail_maintenance_reports" USING btree ("trail_system_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "trail_segments_system_slug_idx" ON "trail_segments" USING btree ("trail_system_id","slug");--> statement-breakpoint
CREATE INDEX "trail_segments_system_active_sort_idx" ON "trail_segments" USING btree ("trail_system_id","is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "trail_systems_slug_idx" ON "trail_systems" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "trail_systems_active_sort_idx" ON "trail_systems" USING btree ("is_active","sort_order");--> statement-breakpoint
INSERT INTO "trail_systems" ("slug", "name", "description", "is_active", "sort_order")
VALUES (
  'big-branch-bike-park',
  'Big Branch Bike Park',
  'Big Branch Bike Park trail maintenance reports',
  true,
  0
)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "is_active" = EXCLUDED."is_active",
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = now();--> statement-breakpoint
INSERT INTO "trail_segments" ("trail_system_id", "slug", "name", "color_label", "is_active", "sort_order")
SELECT "trail_systems"."id", "segments"."slug", "segments"."name", "segments"."color_label", true, "segments"."sort_order"
FROM "trail_systems"
CROSS JOIN (
  VALUES
    ('phase-1-green-ricochet', 'Phase 1 Green (Ricochet)', 'Green', 0),
    ('phase-1-blue-ridge-runners-loop', 'Phase 1 Blue (Ridge Runners Loop)', 'Blue', 1),
    ('phase-2-blue-trail-dynamic', 'Phase 2 Blue (Trail Dynamic)', 'Blue', 2)
) AS "segments"("slug", "name", "color_label", "sort_order")
WHERE "trail_systems"."slug" = 'big-branch-bike-park'
ON CONFLICT ("trail_system_id", "slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "color_label" = EXCLUDED."color_label",
  "is_active" = EXCLUDED."is_active",
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = now();
