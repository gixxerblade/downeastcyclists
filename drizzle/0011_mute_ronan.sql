ALTER TABLE "waiver_signatures" DROP CONSTRAINT "waiver_signatures_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "waiver_signatures" ADD CONSTRAINT "waiver_signatures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
