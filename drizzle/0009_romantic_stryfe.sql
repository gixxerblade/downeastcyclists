CREATE TYPE "public"."waiver_scope" AS ENUM('membership', 'ride', 'event');--> statement-breakpoint
CREATE TYPE "public"."waiver_signer_role" AS ENUM('adult', 'guardian');--> statement-breakpoint
CREATE TYPE "public"."waiver_status" AS ENUM('draft', 'published', 'retired');--> statement-breakpoint
CREATE TABLE "waiver_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"waiver_template_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"signer_role" "waiver_signer_role" NOT NULL,
	"participant_name" varchar(255) NOT NULL,
	"participant_birth_date" varchar(10),
	"guardian_name" varchar(255),
	"signer_name" varchar(255) NOT NULL,
	"signer_email" varchar(255) NOT NULL,
	"phone" varchar(50) NOT NULL,
	"address_street" varchar(255) NOT NULL,
	"address_city" varchar(100) NOT NULL,
	"address_state" varchar(50) NOT NULL,
	"address_zip" varchar(20) NOT NULL,
	"template_title" varchar(255) NOT NULL,
	"template_version" integer NOT NULL,
	"terms_snapshot" text NOT NULL,
	"acknowledgment_snapshot" text NOT NULL,
	"signature_text" varchar(255) NOT NULL,
	"consent_text" text NOT NULL,
	"document_digest" varchar(64) NOT NULL,
	"ip_address_hash" varchar(64),
	"user_agent" text,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waiver_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"scope" "waiver_scope" DEFAULT 'membership' NOT NULL,
	"status" "waiver_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"content" text NOT NULL,
	"acknowledgment" text NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"effective_from" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_by" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "waiver_signatures" ADD CONSTRAINT "waiver_signatures_waiver_template_id_waiver_templates_id_fk" FOREIGN KEY ("waiver_template_id") REFERENCES "public"."waiver_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiver_signatures" ADD CONSTRAINT "waiver_signatures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "waiver_signatures_user_template_idx" ON "waiver_signatures" USING btree ("user_id","waiver_template_id");--> statement-breakpoint
CREATE INDEX "waiver_signatures_template_signed_idx" ON "waiver_signatures" USING btree ("waiver_template_id","signed_at");--> statement-breakpoint
CREATE INDEX "waiver_signatures_user_signed_idx" ON "waiver_signatures" USING btree ("user_id","signed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "waiver_templates_title_version_idx" ON "waiver_templates" USING btree ("title","version");--> statement-breakpoint
CREATE INDEX "waiver_templates_status_scope_idx" ON "waiver_templates" USING btree ("status","scope");--> statement-breakpoint
CREATE INDEX "waiver_templates_effective_idx" ON "waiver_templates" USING btree ("effective_from","expires_at");
--> statement-breakpoint
INSERT INTO "waiver_templates" (
  "title",
  "description",
  "scope",
  "status",
  "version",
  "content",
  "acknowledgment",
  "is_required",
  "effective_from",
  "created_by"
) VALUES (
  'DEC Release and Waiver of Liability',
  'Required for club membership, rides, and events.',
  'membership',
  'published',
  1,
  $waiver$RELEASE AND WAIVER OF LIABILITY, ASSUMPTION OF RISK, INDEMNITY, AND PARENTAL CONSENT AGREEMENT ("Agreement") for LEAGUE OF AMERICAN WHEELMAN D/B/A LEAGUE OF AMERICAN BICYCLISTS ("LAB")

(This form is to only be used for Individual Adults or for Adults on behalf of Minors.)

IN CONSIDERATION of being permitted to participate in any way in Down East Cyclists ("Club") sponsored Bicycling Activities ("Activity") I, for myself, my personal representatives, assigns, heirs, and next of kin:

1. ACKNOWLEDGE, agree, and represent that I understand the nature of Bicycling Activities and that I am qualified, in good health, and in proper physical condition to participate in such Activity. I further acknowledge that the Activity will be conducted over public roads and facilities open to the public during the Activity and upon which the hazards of traveling are to be expected. I further agree and warrant that if, at any time, I believe conditions to be unsafe, I will immediately discontinue further participation in the Activity.

2. FULLY UNDERSTAND that (a) BICYCLING ACTIVITIES INVOLVE RISKS AND DANGERS OF SERIOUS BODILY INJURY, INCLUDING PERMANENT DISABILITY, PARALYSIS AND DEATH ("Risks"); (b) these Risks and dangers may be caused by my own actions or inactions, the actions or inactions of others participating in the Activity, the conditions in which the Activity takes place, or THE NEGLIGENCE OF THE "RELEASEES" NAMED BELOW; (c) there may be OTHER RISKS AND SOCIAL AND ECONOMIC LOSSES either not known to me or not readily foreseeable at this time; and I FULLY ACCEPT AND ASSUME ALL SUCH RISKS AND ALL RESPONSIBILITY FOR LOSSES, COSTS, AND DAMAGES I may incur as a result of my participation in the Activity.

3. HEREBY RELEASE, DISCHARGE, AND COVENANT NOT TO SUE the Club, the LAB, its respective administrators, directors, agents, officers, members, volunteers, and employees, other participants, any sponsors, advertisers, and, if applicable, owners and lessors of premises on which the Activity takes place (each considered one of the "RELEASEES" herein) FROM ALL LIABILITY, CLAIMS, DEMANDS, LOSSES, OR DAMAGES ON MY ACCOUNT CAUSED OR ALLEGED TO BE CAUSED IN WHOLE OR IN PART BY THE NEGLIGENCE OF THE "RELEASEES" OR OTHERWISE, INCLUDING NEGLIGENT RESCUE OPERATIONS. And, I FURTHER AGREE that if, despite this RELEASE AND WAIVER OF LIABILITY, ASSUMPTION OF RISK, AND INDEMNITY AGREEMENT, I, or anyone on my behalf, makes a claim against any of the Releasees, I WILL INDEMNIFY, SAVE, AND HOLD HARMLESS EACH OF THE RELEASEES from any litigation expenses, attorney fees, loss, liability, damage, or cost which any may incur as the result of such claim.

ADULT RELEASE

I AM 18 YEARS OF AGE OR OLDER, HAVE READ AND UNDERSTAND THE TERMS OF THIS AGREEMENT, UNDERSTAND THAT I AM GIVING UP SUBSTANTIAL RIGHTS BY SIGNING THIS AGREEMENT, HAVE SIGNED IT VOLUNTARILY AND WITHOUT ANY INDUCEMENT OR ASSURANCE OF ANY NATURE AND INTEND IT TO BE A COMPLETE AND UNCONDITIONAL RELEASE OF ALL LIABILITY TO THE GREATEST EXTENT ALLOWED BY LAW. I AGREE THAT IF ANY PORTION OF THIS AGREEMENT IS HELD TO BE INVALID, THE BALANCE, NOTWITHSTANDING, SHALL CONTINUE IN FULL FORCE AND EFFECT.

MINOR RELEASE

I, THE MINOR'S PARENT AND/OR LEGAL GUARDIAN, UNDERSTAND THE NATURE OF BICYCLING ACTIVITIES AND THE MINOR'S EXPERIENCE AND CAPABILITIES AND BELIEVE THE MINOR TO BE QUALIFIED, IN GOOD HEALTH, AND IN PROPER PHYSICAL CONDITION TO PARTICIPATE IN SUCH ACTIVITY. I HEREBY RELEASE, DISCHARGE, COVENANT NOT TO SUE, AND AGREE TO INDEMNIFY AND SAVE AND HOLD HARMLESS EACH OF THE RELEASEES FROM ALL LIABILITY, CLAIMS, DEMANDS, LOSSES, OR DAMAGES ON THE MINOR'S ACCOUNT CAUSED OR ALLEGED TO BE CAUSED IN WHOLE OR IN PART BY THE NEGLIGENCE OF THE "RELEASEES" OR OTHERWISE, INCLUDING NEGLIGENT RESCUE OPERATIONS AND FURTHER AGREE THAT IF, DESPITE THIS RELEASE, I, THE MINOR, OR ANYONE ON THE MINOR'S BEHALF MAKES A CLAIM AGAINST ANY OF THE RELEASEES NAMED ABOVE, I WILL INDEMNIFY, SAVE, AND HOLD HARMLESS EACH OF THE RELEASEES FROM ANY LITIGATION EXPENSES, ATTORNEY FEES, LOSS, LIABILITY, DAMAGE, OR COST ANY MAY INCUR AS THE RESULT OF ANY SUCH CLAIM.

Based on LAB Form No. LAB Minor W&R, DME #480846 (1/2007).$waiver$,
  'I have read and understand this agreement, I am signing it voluntarily, and I agree that my typed name is my electronic signature.',
  true,
  now(),
  'system:migration'
)
ON CONFLICT ("title", "version") DO NOTHING;
