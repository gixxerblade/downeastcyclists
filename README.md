# Down East Cyclists Website

[![Netlify Status](https://api.netlify.com/api/v1/badges/47e830dc-27c3-406d-901c-257eb9473523/deploy-status)](https://app.netlify.com/sites/downeast/deploys)

This repository contains the official website for Down East Cyclists, a recreational cycling club in Eastern North Carolina dedicated to promoting safe cycling.

## Site Overview

The Down East Cyclists website is built with Next.js and deployed on Netlify. It serves as the online hub for the cycling club, providing information about the club, trails, membership management with Stripe-powered payments, public trail maintenance reporting, and admin tools. The site integrates with Contentful CMS for content management, Neon Postgres for membership and operations data, Firestore for trail status, Cloudflare Turnstile for public report protection, R2-compatible object storage for trail issue photos, Resend for transactional email, and Effect-TS for type-safe error handling throughout the stack.

## Page Descriptions

### Home Page

- Features a full-screen video background showcasing cycling in Eastern NC
- Displays the club's mission statement
- Shows real-time trail status at the bottom of the page
- Highlights upcoming rides imported from the club's Meetup calendar

### About Section

- **Leadership** (`/about/leadership`): Information about the club's leadership team
- **Club Bylaws** (`/about/bylaws`): Official club bylaws and regulations (Contentful-managed)
- **Membership** (`/about/membership`): Information about joining the club
- **Privacy Policy** (`/about/privacy`): The club's privacy policy

### Blog

- Displays news and updates from the club
- Content is managed through Contentful CMS
- Features pagination for browsing through posts
- Individual blog post pages with full content

### Trails

- **Big Branch Bike Park (B3)** (`/trails/b3`): Information about the Big Branch Bike Park
  - Displays trail maps, directions, and usage rules
  - Shows real-time trail status (open/closed)
  - Links to Strava segments for the trails

### Trail Maintenance

- **Report Trail Issue** (`/report-trail-issue`): Public form for riders to report Big Branch trail maintenance issues
  - Supports issue type selection, observed date/time, trail segment, location notes, browser geolocation, optional reporter contact, and up to three 20 MB photos
  - Uses Cloudflare Turnstile when configured
  - Uploads photos directly from the browser to short-lived private R2 staging objects, then validates and normalizes them server-side when the report is finalized
  - Saves reports and photo files on the phone using TanStack DB IndexedDB collections before opening `/report-trail-issue/pending/[id]`; this local status page distinguishes queued, submitting, bot-check-required, failed, and submitted reports
  - Retries transient failures with backoff while any DEC page is running, on reconnect/focus, and when reopening DEC. Mobile browsers can suspend uploads after locking the phone or closing the site; local data is subject to browser deletion/eviction. This does not provide offline startup caching or guaranteed closed-tab uploads
  - Renewals preserve an authorized upload identity for up to seven days from the original bot check; an expired or missing bot check requires the rider to complete it on the pending report page
  - Organizers receive a report only after its images have uploaded and passed server validation. Report, photo metadata, and creation event commit atomically; signed receipt checks and the unique public ID prevent retry duplicates
  - Submitted reports link to `/report-trail-issue/[publicId]`; local photo bytes and upload authorization are removed after receipt confirmation. Organizer email runs after the response and does not block confirmation; notification failures are logged, without a durable email retry queue

### Contact

- Contact form for visitors to reach out to the club
- Protected by hCaptcha to prevent spam
- Form submissions are handled by Netlify Forms

### Membership & Payments

- **Join** (`/join`): Membership signup flow with every currently required membership waiver before Stripe checkout (individual and family plans)
- **Member Portal** (`/member`): Authenticated member dashboard with digital membership card, QR code, required-waiver gate, and print-ready signed records
- **Waivers** (`/waivers`): Authenticated signing and signed-record history for members, former members, and organizers, independent of membership checkout
- **Renew** (`/renew`): Frictionless membership renewal flow that can be linked directly from renewal emails
- **Renew Complete** (`/renew/complete`): Post-checkout confirmation for renewal payments
- **Verify** (`/verify`): Email verification page
- **Reset Password** (`/reset-password`): Firebase password reset flow for members
- Renewal checkout preserves the member's card number and links the card to the renewed membership.
- Checkout reuses a member's linked Stripe customer and blocks a second subscription while an active auto-renewing subscription exists

### Admin

- **Dashboard** (`/dashboard`): Full admin dashboard for club management (requires authentication)
  - Member management (view, edit, import, export): the list shows one current membership per person, with filters and pagination applied after selecting that membership; prior terms remain stored as history
  - Payment and subscription management via Stripe
  - Trail status editing
  - Trail maintenance report triage, complete CSV exports, priority/status updates, internal notes, embedded maps, and county escalation email drafts
  - Organizer access management for current members
  - QR code membership verification
  - Membership statistics and reporting cover all pages of the member list, with date-aware active/expired counts. Failed statistics reads return an error rather than zero totals. Estimated annual dues use the standard $30 individual / $50 family rates for current memberships with active status. Complimentary, legacy, trialing, past-due, canceled, and expired memberships are excluded. This is not collected revenue and does not include fees, discounts, refunds, or taxes.
  - The six-month chart separates new members (each person's first recorded membership period) from renewals (later recorded periods, including returning members), grouped by UTC start month. It does not count renewal emails or payments as new members.
  - Migration `0008_membership_period_history` backfills observed membership periods and installs a database trigger to retain future terms when automatic renewals update subscription dates. Replayed updates are deduplicated; end-date extensions and overlapping date corrections do not create renewals. Incomplete/failed checkouts are excluded. Historical periods already overwritten before this migration cannot be recovered, so the chart explicitly identifies this limitation. Apply migrations before deploying the updated app.
  - Expiring member reports and manual renewal email sends
  - Payment reconciliation and refunds
  - Audit trails for member, payment, renewal email, reconciliation, import, and role changes
  - Versioned liability waiver templates, signed/pending completion tracking, one-time unsigned-member email campaigns, and instant access to signed records
- **Login** (`/login`): Authentication page for admin access

### Scheduled Jobs

- **Membership renewal reminders** (`netlify/functions/membership-renewal-reminders.ts`): Daily Netlify scheduled function that sends manual-renewal members 90-, 60-, and 30-day reminders and auto-renewing members one 30-day upcoming-renewal notice through Resend, with email/audit event logging
- **Meetup event ingest** (`netlify/functions/meetup-events-ingest.ts`): Daily Netlify scheduled function that imports upcoming public events from the Down East Cyclists Meetup RSS feed. The same ingestion can be triggered through the protected internal endpoint at `/api/internal/meetup-ingest`.

## Technical Stack

- **Framework**: Next.js 15, React 19, TypeScript
- **UI**: Material UI 6, TailwindCSS, Emotion
- **CMS**: Contentful for blog posts, bylaws, and static content
- **Database**: PostgreSQL via Neon (serverless) with Drizzle ORM; Google Firestore for trail status
- **Authentication**: Firebase Authentication
- **Payments**: Stripe (subscriptions, checkout, customer portal, webhooks)
- **Email**: Resend transactional email for welcome emails, manual renewal reminders, upcoming automatic-renewal notices, organizer access notifications, and waiver invitations/reminders
- **Bot Protection**: hCaptcha for contact forms; Cloudflare Turnstile for trail issue reports
- **Object Storage**: R2-compatible storage for trail maintenance report photos
- **Error Handling**: Effect-TS for type-safe, composable operations
- **State Management**: TanStack React Query
- **Forms**: React Hook Form with Zod validation
- **Deployment**: Netlify with Edge Functions (geo-blocking)
- **Linting**: Oxlint
- **Formatting**: Oxfmt
- **Testing**: Vitest

## Development Instructions

### Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/)

### Getting Started

1. Clone the repository
2. Install dependencies:

   ```bash
   pnpm install
   ```

   On local installs, the prepare step initializes the Effect source submodule at `.repos/effect`
   when it is missing, then prepares the Effect TypeScript tooling. CI skips the research-only
   source checkout.

3. Create a `.env.local` file with the required environment variables (see below)
4. Run the development server:

   ```bash
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Agent contribution guidance

[AGENTS.md](./AGENTS.md) defines worktree conventions, the required quality checks,
and architecture invariants. The checked-in
[domain-boundaries skill](./.agents/skills/domain-boundaries/SKILL.md) explains how
to apply domain ownership, reuse existing rules, and separate business decisions
from presentation and transport in this Next.js and Effect codebase. Keep
behavior-preserving refactors separately verifiable from behavior changes.
These instructions guide review; they do not add automated architecture enforcement.

### Available Scripts

```bash
pnpm dev              # Start development server
pnpm build            # Production build
pnpm start            # Start production server
pnpm tsc              # TypeScript type-checking
pnpm tsgo             # Fast type-checking with tsgo
pnpm lint             # Run Oxlint
pnpm format           # Format code with Oxfmt
pnpm fmt:check        # Check formatting without writing
pnpm test             # Run tests (watch mode)
pnpm test:run         # Run tests once
pnpm test:coverage    # Generate coverage report
pnpm types:contentful # Regenerate Contentful TypeScript types
pnpm resend:setup-upcoming-renewal-template # Create or update the auto-renew notice template
pnpm db:generate      # Generate Drizzle migration files
pnpm db:migrations:check # Ensure schema changes have committed migrations
pnpm db:migrate       # Run pending database migrations
pnpm db:push          # Push schema directly to database
pnpm db:studio        # Launch Drizzle Studio UI
```

### Content Management

Content is managed through Contentful. To regenerate the content types:

```bash
pnpm types:contentful
```

This command generates TypeScript types based on your Contentful content models.

### Database

The primary database is PostgreSQL via Neon (serverless), managed with Drizzle ORM. Schema definitions live in `src/db/schema/` and migrations are in `drizzle/`.

Liability waiver templates are immutable after publication. The default uses the treasurer's
insurer-approved DOCX wording with transcription errors corrected and the membership application
removed. Migration 0013 replaces only the original system seed with version 2; custom templates
and existing signed records remain intact.

Waiver migrations `0009`–`0013` follow the published membership migrations `0006`–`0008`.
The migration regression test upgrades a populated pre-waiver database, checks that member
and renewal history survives, and verifies that repeated deployments do not repeat the seed.

For family memberships, an adult head of household or initial member signs once for everyone
listed. The signer is included automatically; every additional family member needs a full name
and birth date. No separate adult invitations or child signatures are collected. The join flow
selects family signing for family plans, and family checkout requires a household waiver.
Existing family members complete the same form in the member portal.
Family classification uses the configured price ID at signup/checkout and the stored plan
type for existing memberships, including imported and complimentary memberships; it does
not depend on a plan's display name. The server independently enforces household signing.

Existing-member invitation emails are **admin-triggered**, not sent automatically on
deployment or publication. In the dashboard's waiver section, select the current form and
choose **Email unsigned members once**, use **Send invitation** beside a member, or check
members and choose **Email selected**. The checkboxes select first invitations only.
Every send opens a confirmation showing the exact recipients; sending starts only after
confirmation. The campaign includes current active, trialing,
past-due, legacy, and complimentary memberships; expired memberships are excluded.
Missing email/signing configuration stops the campaign before any send is recorded.
Successful provider submissions are skipped on reruns; failed submissions remain retryable.
"Sent" means Resend accepted the request, not proof of delivery to the recipient's inbox.
Draft, future, expired, retired, and superseded forms cannot start an invitation campaign.

Previously emailed, still-unsigned members have a separate **Resend reminder** action.
It requires confirmation and is bound to the member's last successful email record, so a
replayed/stale confirmation cannot send another reminder after that record changes.
Failed attempts remain retryable with the same provider idempotency key. Last accepted
send time and failed-attempt status appear in the member table. Signed members and the
non-person admin are excluded. Eligibility is rechecked on the server before sending.
The browser processes selections in batches of 20, with sequential paced sends; keep
the confirmation dialog open until it finishes. After an interruption, reselect members
and retry; recorded successes are skipped. Provider acceptance followed by a database
logging failure remains an ambiguous outcome: Resend deduplicates the same key for 24
hours, but this is not a durable transactional outbox or proof of inbox delivery.

**Preview email / send test** loads the published Resend template without sending mail.
The preview uses a sample greeting and is isolated in a sandboxed frame. A template with
unpublished edits must be published before it can be previewed as the outgoing email.
**Send test to me** sends a clearly marked test only to the verified administrative
session's email, never a supplied recipient; it creates no member profile or invitation
history. The administrative account still cannot sign a personal waiver.

The hosted template alias is `liability-waiver-invitation` (override with
`RESEND_WAIVER_TEMPLATE_ID`). It matches the existing club email design. Create and
publish it once with `pnpm resend:setup-waiver-template`; this create-only command does
not overwrite later dashboard edits. Source HTML/text live in `emails/`. Edit and publish
the body/layout in Resend thereafter. The application supplies the subject and the
`MEMBER_NAME`, `WAIVER_TITLE`, `SIGN_URL`, and `INTRO` variables for invitations, reminders,
and tests. HTML uses their `_HTML` variants, escaped by the application; keep the
unsuffixed variables in the plain-text body only. There is no silent plain-email
fallback if the hosted template is missing.
Preview requires a Full access Resend key: use `RESEND_TEMPLATE_API_KEY` if the normal
`RESEND_API_KEY` is sending-only. Sending itself does not require template-read access.

The admin-only `/api/admin/waivers/notifications` endpoint uses GET for preview and POST
for explicit `invite`, confirmed `remind`, or self-only `test` requests. An omitted or
empty recipient selection is rejected instead of meaning "everyone". Email status is
read through the existing email-log owner; no new database migration is required.

Invitation links open `/waivers?templateId=…`. Signed-out recipients log in first, and both
password and email-link login preserve the signing destination. Organizers are members and
must sign their own individual or household waivers; organizer access does not exempt them.
The primary administrator is a non-person administrative account, not a member or signer.
It goes directly to the dashboard, does not receive a member profile during login recovery,
and is excluded from waiver completion counts and invitations. Personal signing APIs reject
it, and its personal signup, renewal, and signing pages redirect to the dashboard. Admin can
still manage waivers, access members' signed records, and assign organizer roles.
Normal member and organizer login also checks for missing required waivers.
Interrupted signup repairs a missing member profile before establishing the session, then
routes unsigned members through signing and back to checkout. Renewal includes a signing
link and a **Sign or view my waivers** link, including for expired members.

For versions sharing a title and scope, the newest published version that has reached its
effective date supersedes earlier versions. Scheduling a future replacement does not close
the current version early, and canceling that future version leaves the current one open.
Retiring or expiring an effective replacement does not revive superseded wording. Different
required membership forms are all shown during signup and all checked again before payment.

Each signature stores the exact terms, acknowledgment, household/electronic signing statement,
complete roster, contact details, authenticated account identity, timestamp, browser evidence,
and a SHA-256 content digest. Dates must be real and not in the future, the signer must be at
least 18, and duplicate name/birth-date entries are rejected. Abandoning the form leaves it
unsigned. A saved signature remains complete even if checkout is abandoned; members can log
in to continue. Identical submission retries return the existing record.

Members can use **Update family details** to add, remove, or correct roster entries and sign
again. Each change creates an immutable revision; concurrent stale changes are rejected.
The portal and admin completion view use the latest revision, and the member can open earlier
copies. Signed records include a name/birth-date table and the household signer's signature,
and can be printed or saved as PDF in the browser. Access requires the owning account or
staff with waiver-read permission. Roster changes never rewrite an earlier signed copy.
Retired, expired, and superseded signed copies remain accessible, including all earlier
revisions. Admin history includes former members, but they do not affect the current-member
completion counts or invitation audience. Private browser caches are keyed by account,
cleared on account changes, and checked against the authenticated response identity.

Domain ownership and lifecycle rules are documented beside the implementation in
[`src/lib/waivers/README.md`](src/lib/waivers/README.md).

Waiver validation, authorization, revision, and migration tests run in the normal
`pnpm test:run` CI suite. Before the one-time production invitation, separately rehearse
actual email delivery and Stripe's hosted checkout with approved test recipients and Stripe
test mode. Current product gaps remain: signed-copy receipt emails are not sent; unsigned
form drafts do not survive a reload; membership-card scans do not enforce waiver completion.
A saved signature survives checkout cancellation. No production emails are sent by the tests.

```bash
pnpm db:generate         # Generate migration from schema changes
pnpm db:migrations:check # Ensure schema changes have committed migrations
pnpm db:migrate          # Apply pending migrations
pnpm db:push             # Push schema directly (development)
pnpm db:studio           # Browse data with Drizzle Studio
```

Trail status is stored separately in Google Firestore and managed through the admin dashboard.

## Netlify Deployment

### Build Configuration

- **Build command**: `scripts/decrypt-credentials.sh && if [ "$CONTEXT" = "production" ]; then pnpm db:migrate; fi && pnpm build`
- **Publish directory**: `.next`
- **Functions directory**: `netlify/functions`

Migration `0007_repair_renewed_card_links` repairs cards whose validity dates, plan, and status uniquely match a different membership for the same user. It preserves membership history and card details, and skips ambiguous matches. This includes the existing imported-member renewal case; no separate manual repair is needed after the migration runs.

Pushes to the connected GitHub repository trigger automatic builds and deploys. Netlify applies pending committed Drizzle migrations before production builds, and GitHub CI runs `pnpm db:migrations:check` to catch schema changes that forgot to commit a matching migration file.

### Security controls

- Renewal emails contain signed, expiring links. The member ID is never accepted directly from a
  renewal URL or checkout request; member identity comes from a verified session or renewal token.
  Legacy unsigned renewal links remain usable by entering the account email, which is normalized
  and matched case-insensitively.
- Checkout rate limits are stored atomically in PostgreSQL so limits are shared by every serverless
  instance. Deploy the committed `rate_limit_buckets` migration before the updated application.
- Contentful rich text is rendered as escaped React nodes. Links and embedded assets pass explicit
  protocol and host allowlists.
- Trail photos are decoded as JPEG, PNG, or WebP, constrained by size and pixel count, and re-encoded
  as metadata-free WebP before private R2 storage. Claimed MIME types and extensions are not trusted.
- Run `pnpm audit --prod` when changing dependencies. Production transitive overrides in
  `pnpm-workspace.yaml` pin patched releases where an upstream package still resolves a vulnerable
  version. Dependency upgrades must also satisfy the repository's minimum-release-age policy; do
  not bypass that policy when regenerating `pnpm-lock.yaml`. The repository pins its pnpm release
  through `packageManager`; `.npmrc` makes older pnpm launchers honor that version.

### Environment Variables

The following environment variables need to be set in Netlify:

**App:**

- `NEXT_PUBLIC_BASE_URL`: The base URL of your site

**Contentful:**

- `CONTENTFUL_SPACE_ID`: Your Contentful space ID
- `CONTENTFUL_ACCESS_TOKEN`: Your Contentful access token
- `CONTENTFUL_MANAGEMENT_TOKEN`: For type generation

**Firebase:**

- `GOOGLE_PROJECT_ID`: Your Google Cloud project ID
- `GOOGLE_CLIENT_EMAIL`: Your Google service account email
- `GOOGLE_PRIVATE_KEY`: Your Google service account private key
- `FIREBASE_ENCRYPTION_KEY`: Key to decrypt the encrypted service account file at build time

**Database:**

- `NETLIFY_DATABASE_URL`: PostgreSQL connection string (auto-provided on Netlify with Neon integration)

**Security:**

- `RENEWAL_LINK_SECRET`: Independent random secret of at least 32 characters used to sign renewal
  links. Generate a new value for each environment.
- `RENEWAL_LINK_TTL_DAYS`: Optional renewal-link lifetime from 1 to 365 days. Defaults to 120.
- `RATE_LIMIT_SECRET`: Independent random secret of at least 32 characters used to protect stored
  rate-limit identifiers.
- `WAIVER_SIGNATURE_SECRET`: Independent random secret of at least 32 characters used to HMAC
  signer IP addresses before they are stored with waiver evidence. Required before signup
  waiver loading, signing, or invitation sending; missing, short, and `replace-with-…`
  placeholder values fail explicitly. This is not an X.509 certificate and does not
  cryptographically sign the PDF. Generate a separate value per environment with
  `openssl rand -hex 32`, put it in local `.env.local` and the deployment's runtime secrets
  as appropriate, and never commit the value. The blank entry is documented in `.env.example`.
  Keep the key securely backed up if historical IP-hash comparisons are needed; rotating it
  does not change stored waivers or their content digests.

**Stripe:**

- `STRIPE_SECRET_KEY`: Stripe secret API key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret
- `STRIPE_PRICE_INDIVIDUAL`: Stripe price ID for individual membership
- `STRIPE_PRICE_FAMILY`: Stripe price ID for family membership

**Email and admin access:**

- `ADMIN_EMAIL`: The single non-person administrator account email, reserved for administration
  rather than membership or waiver signing. Organizer access is granted to personal member
  accounts from this account's dashboard.
- `ADMIN_EMAIL_WHITELIST`: Optional comma-separated list of additional admin/report notification recipients.
- `RESEND_API_KEY`: Resend API key used for transactional email.
- `RESEND_WAIVER_TEMPLATE_ID`: Published waiver email template ID or alias; defaults to `liability-waiver-invitation`.
- `RESEND_TEMPLATE_API_KEY`: Optional server-only Full access key for admin email preview when `RESEND_API_KEY` is sending-only.
- `EMAIL_FROM`: Verified Resend sender address for member and organizer emails.
- `RESEND_RENEWAL_TEMPLATE_ID`: Resend template alias or ID for renewal reminders.
- `RESEND_UPCOMING_RENEWAL_TEMPLATE_ID`: Resend template alias or ID for 30-day automatic-renewal notices.
- `RESEND_ORGANIZER_ACCESS_TEMPLATE_ID`: Resend template alias or ID for organizer access
  notifications. Defaults to `organizer-access-granted`.
- `SUPPORT_EMAIL`: Reply/support address shown in organizer access emails.

**Trail maintenance reports:**

- `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY`: Public Turnstile site key used by the trail issue report form.
- `CLOUDFLARE_TURNSTILE_SECRET_KEY`: Server-side Turnstile verification secret.
- `CLOUDFLARE_TURNSTILE_ALLOWED_HOSTNAMES`: Comma-separated list of hostnames accepted during Turnstile verification; required in production.
- `TRAIL_MAINTENANCE_SKIP_TURNSTILE`: Set to `true` outside production to bypass Turnstile during local testing.
- `TRAIL_MAINTENANCE_UPLOAD_SECRET`: Independent random secret of at least 32 characters used to sign the short-lived photo upload session created after Turnstile verification.
- `R2_ACCOUNT_ID`: Cloudflare R2 account ID for trail issue photo storage.
- `R2_ACCESS_KEY_ID`: R2 access key ID.
- `R2_SECRET_ACCESS_KEY`: R2 secret access key.
- `R2_BUCKET_NAME`: R2 bucket name for uploaded report photos.
- `QR_SIGNING_SECRET`: Secret used when signing trail report rate-limit identifiers and QR/prefill tokens.
- `ONSLOW_PARKS_EMAIL`: Recipient used when drafting Onslow County Parks and Recreation escalation emails.

The private R2 bucket must allow browser `PUT` requests from each deployed site origin. Configure
the bucket CORS policy in Cloudflare with the production and local origins used by this project:

```json
[
  {
    "AllowedOrigins": [
      "https://downeastcyclists.com",
      "https://downeast.netlify.app",
      "http://localhost:3000",
      "http://localhost:8888"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Add an explicit origin to the R2 CORS policy and its hostname to
`CLOUDFLARE_TURNSTILE_ALLOWED_HOSTNAMES` for any deploy preview used to exercise photo uploads.
Presigned upload URLs are valid for 15 minutes, accept only the declared content type, and target a
private staging key. The report endpoint verifies the stored byte count and content type, decodes
and converts each image to WebP, writes the final objects, and removes the staging objects. Also add
an R2 object lifecycle rule that expires objects under `trail-maintenance-staging/` after one day so
abandoned or partially completed uploads are removed automatically.

**Meetup event ingestion:**

- `MEETUP_INGEST_SECRET`: Optional bearer/header secret for manually triggering `/api/internal/meetup-ingest`.

Create or update the Resend templates with:

```shell
pnpm resend:setup-renewal-template
pnpm resend:setup-organizer-template
```

### Encrypted Credentials

The Firebase service account is encrypted with AES-256-CBC and stored as `firebase-service-account.json.enc` (safe to commit). Decryption happens automatically during the Netlify build via `scripts/decrypt-credentials.sh`. See [NETLIFY_SETUP.md](./NETLIFY_SETUP.md) for details.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Netlify Documentation](https://docs.netlify.com/)
- [Contentful Documentation](https://www.contentful.com/developers/docs/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Stripe Documentation](https://docs.stripe.com/)
- [Effect-TS Documentation](https://effect.website/)
