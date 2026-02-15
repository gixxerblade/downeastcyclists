# Down East Cyclists Website

[![Netlify Status](https://api.netlify.com/api/v1/badges/47e830dc-27c3-406d-901c-257eb9473523/deploy-status)](https://app.netlify.com/sites/downeast/deploys)

This repository contains the official website for Down East Cyclists, a recreational cycling club in Eastern North Carolina dedicated to promoting safe cycling.

## Site Overview

The Down East Cyclists website is built with Next.js and deployed on Netlify. It serves as the online hub for the cycling club, providing information about the club, trails, membership management with Stripe-powered payments, and admin tools. The site integrates with Contentful CMS for content management, Firestore for dynamic data, and Effect-TS for type-safe error handling throughout the stack.

## Page Descriptions

### Home Page

- Features a full-screen video background showcasing cycling in Eastern NC
- Displays the club's mission statement
- Shows real-time trail status at the bottom of the page

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

### Contact

- Contact form for visitors to reach out to the club
- Protected by hCaptcha to prevent spam
- Form submissions are handled by Netlify Forms

### Membership & Payments

- **Join** (`/join`): Membership signup flow with Stripe checkout (individual and family plans)
- **Member Portal** (`/member`): Authenticated member dashboard with digital membership card and QR code
- **Verify** (`/verify`): Email verification page

### Admin

- **Dashboard** (`/dashboard`): Full admin dashboard for club management (requires authentication)
  - Member management (view, edit, import, export)
  - Payment and subscription management via Stripe
  - Trail status editing
  - QR code membership verification
  - Membership statistics and reporting
  - Payment reconciliation and refunds
  - Audit trails for member changes
- **Login** (`/login`): Authentication page for admin access

## Technical Stack

- **Framework**: Next.js 15, React 19, TypeScript
- **UI**: Material UI 6, TailwindCSS, Emotion
- **CMS**: Contentful for blog posts, bylaws, and static content
- **Database**: Google Firestore for trail status, members, and dynamic data
- **Authentication**: Firebase Authentication
- **Payments**: Stripe (subscriptions, checkout, customer portal, webhooks)
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
```

### Content Management

Content is managed through Contentful. To regenerate the content types:

```bash
pnpm types:contentful
```

This command generates TypeScript types based on your Contentful content models.

### Trail Status Management

Trail status is managed through the admin dashboard. Authenticated users can:

1. Log in to the dashboard
2. Update trail status (open/closed)
3. Add notes about trail conditions

The trail status is stored in Firestore and is available through the `/api/trails` endpoint.

## Netlify Deployment

### Build Configuration

- **Build command**: `scripts/decrypt-credentials.sh && pnpm build`
- **Publish directory**: `.next`
- **Functions directory**: `netlify/functions`

Pushes to the connected GitHub repository trigger automatic builds and deploys.

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

**Stripe:**

- `STRIPE_SECRET_KEY`: Stripe secret API key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret
- `STRIPE_PRICE_INDIVIDUAL`: Stripe price ID for individual membership
- `STRIPE_PRICE_FAMILY`: Stripe price ID for family membership

### Encrypted Credentials

The Firebase service account is encrypted with AES-256-CBC and stored as `firebase-service-account.json.enc` (safe to commit). Decryption happens automatically during the Netlify build via `scripts/decrypt-credentials.sh`. See [NETLIFY_SETUP.md](./NETLIFY_SETUP.md) for details.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Netlify Documentation](https://docs.netlify.com/)
- [Contentful Documentation](https://www.contentful.com/developers/docs/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Stripe Documentation](https://docs.stripe.com/)
- [Effect-TS Documentation](https://effect.website/)
