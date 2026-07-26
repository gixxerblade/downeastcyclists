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
  - Supports issue type selection, observed date/time, trail segment, location notes, browser geolocation, optional reporter contact, and up to three photos
  - Uses Cloudflare Turnstile when configured
  - Redirects submitters to a public confirmation/status page (`/report-trail-issue/[publicId]`)

### Contact

- Contact form for visitors to reach out to the club
- Protected by hCaptcha to prevent spam
- Form submissions are handled by Netlify Forms

### Membership & Payments

- **Join** (`/join`): Membership signup flow with Stripe checkout (individual and family plans)
- **Member Portal** (`/member`): Authenticated member dashboard with digital membership card and QR code
- **Renew** (`/renew`): Frictionless membership renewal flow that can be linked directly from renewal emails
- **Renew Complete** (`/renew/complete`): Post-checkout confirmation for renewal payments
- **Verify** (`/verify`): Email verification page
- **Reset Password** (`/reset-password`): Firebase password reset flow for members

### Admin

- **Dashboard** (`/dashboard`): Full admin dashboard for club management (requires authentication)
  - Member management (view, edit, import, export)
  - Payment and subscription management via Stripe
  - Trail status editing
  - Trail maintenance report triage, priority/status updates, internal notes, embedded maps, and county escalation email drafts
  - Organizer access management for current members
  - QR code membership verification
  - Membership statistics and reporting
  - Expiring member reports and manual renewal email sends
  - Payment reconciliation and refunds
  - Audit trails for member, payment, renewal email, reconciliation, import, and role changes
- **Login** (`/login`): Authentication page for admin access

### Scheduled Jobs

- **Membership renewal reminders** (`netlify/functions/membership-renewal-reminders.ts`): Daily Netlify scheduled function that sends 90-, 60-, and 30-day renewal reminders through Resend and records email/audit events
- **Meetup event ingest** (`netlify/functions/meetup-events-ingest.ts`): Daily Netlify scheduled function that imports upcoming public events from the Down East Cyclists Meetup RSS feed. The same ingestion can be triggered through the protected internal endpoint at `/api/internal/meetup-ingest`.

## Technical Stack

- **Framework**: Next.js 15, React 19, TypeScript
- **UI**: Material UI 6, TailwindCSS, Emotion
- **CMS**: Contentful for blog posts, bylaws, and static content
- **Database**: PostgreSQL via Neon (serverless) with Drizzle ORM; Google Firestore for trail status
- **Authentication**: Firebase Authentication
- **Payments**: Stripe (subscriptions, checkout, customer portal, webhooks)
- **Email**: Resend transactional email for welcome emails, renewal reminders, and organizer access notifications
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

   On local installs, the prepare step clones the Effect source into the ignored `.repos/effect`
   directory when it is missing, then prepares the Effect TypeScript tooling. CI skips the
   research-only source checkout.

3. Create a `.env.local` file with the required environment variables (see below)
4. Run the development server:

   ```bash
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

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

**Stripe:**

- `STRIPE_SECRET_KEY`: Stripe secret API key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret
- `STRIPE_PRICE_INDIVIDUAL`: Stripe price ID for individual membership
- `STRIPE_PRICE_FAMILY`: Stripe price ID for family membership

**Email and admin access:**

- `ADMIN_EMAIL`: The single administrator account email. Organizer access is granted to member
  accounts from the administrator dashboard.
- `ADMIN_EMAIL_WHITELIST`: Optional comma-separated list of additional admin/report notification recipients.
- `RESEND_API_KEY`: Resend API key used for transactional email.
- `EMAIL_FROM`: Verified Resend sender address for member and organizer emails.
- `RESEND_RENEWAL_TEMPLATE_ID`: Resend template alias or ID for renewal reminders.
- `RESEND_ORGANIZER_ACCESS_TEMPLATE_ID`: Resend template alias or ID for organizer access
  notifications. Defaults to `organizer-access-granted`.
- `SUPPORT_EMAIL`: Reply/support address shown in organizer access emails.

**Trail maintenance reports:**

- `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY`: Public Turnstile site key used by the trail issue report form.
- `CLOUDFLARE_TURNSTILE_SECRET_KEY`: Server-side Turnstile verification secret.
- `CLOUDFLARE_TURNSTILE_ALLOWED_HOSTNAMES`: Optional comma-separated list of hostnames accepted during Turnstile verification.
- `TRAIL_MAINTENANCE_SKIP_TURNSTILE`: Set to `true` outside production to bypass Turnstile during local testing.
- `R2_ACCOUNT_ID`: Cloudflare R2 account ID for trail issue photo storage.
- `R2_ACCESS_KEY_ID`: R2 access key ID.
- `R2_SECRET_ACCESS_KEY`: R2 secret access key.
- `R2_BUCKET_NAME`: R2 bucket name for uploaded report photos.
- `QR_SIGNING_SECRET`: Secret used when signing trail report rate-limit identifiers and QR/prefill tokens.
- `ONSLOW_PARKS_EMAIL`: Recipient used when drafting Onslow County Parks and Recreation escalation emails.

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
