CREATE TABLE "rate_limit_buckets" (
	"scope" varchar(80) NOT NULL,
	"identifier_hash" varchar(64) NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limit_buckets_scope_identifier_idx" ON "rate_limit_buckets" USING btree ("scope","identifier_hash");--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_expires_at_idx" ON "rate_limit_buckets" USING btree ("expires_at");