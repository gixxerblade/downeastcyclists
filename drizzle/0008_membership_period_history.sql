CREATE TABLE "membership_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "membership_periods" ADD CONSTRAINT "membership_periods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_periods" ADD CONSTRAINT "membership_periods_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "membership_periods_membership_start_idx" ON "membership_periods" USING btree ("membership_id","start_date");--> statement-breakpoint
CREATE INDEX "membership_periods_user_start_idx" ON "membership_periods" USING btree ("user_id","start_date");--> statement-breakpoint
-- Preserve only observed periods. Earlier overwritten renewals cannot be reconstructed.
INSERT INTO membership_periods (user_id, membership_id, start_date, end_date)
SELECT user_id, id, start_date, end_date
FROM memberships
WHERE status IN ('active', 'trialing', 'past_due', 'complimentary', 'legacy', 'canceled', 'unpaid')
  AND end_date > start_date
ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE FUNCTION record_membership_period() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- A failed/incomplete checkout is not a membership start. Cancellations retain history.
  IF NEW.status NOT IN ('active', 'trialing', 'past_due', 'complimentary', 'legacy')
     OR NEW.end_date <= NEW.start_date THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Overlapping date edits correct the current term; they are not renewals.
    -- A renewal starts at or after the previous term's end.
    IF NEW.start_date <> OLD.start_date
       AND (NEW.end_date = OLD.end_date
            OR (NEW.start_date > OLD.start_date AND NEW.start_date < OLD.end_date)) THEN
      DELETE FROM membership_periods
      WHERE membership_id = NEW.id AND start_date = OLD.start_date;
    END IF;
  END IF;

  INSERT INTO membership_periods (user_id, membership_id, start_date, end_date)
  VALUES (NEW.user_id, NEW.id, NEW.start_date, NEW.end_date)
  ON CONFLICT (membership_id, start_date)
  DO UPDATE SET end_date = EXCLUDED.end_date;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER membership_period_history
AFTER INSERT OR UPDATE OF start_date, end_date, status ON memberships
FOR EACH ROW EXECUTE FUNCTION record_membership_period();
