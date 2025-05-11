# Down East Cyclists Website

[![Netlify Status](https://api.netlify.com/api/v1/badges/47e830dc-27c3-406d-901c-257eb9473523/deploy-status)](https://app.netlify.com/sites/downeast/deploys)

This repository contains the official website for Down East Cyclists, a recreational cycling club in Eastern North Carolina dedicated to promoting safe cycling.

## Site Overview

The Down East Cyclists website is built with Next.js and deployed on Netlify. It serves as the online hub for the cycling club, providing information about the club, events, trails, and a way for visitors to contact the organization. The site integrates with Contentful CMS for content management and Firestore for dynamic data like trail status.

## Page Descriptions

### Home Page

- Features a full-screen video background showcasing cycling in Eastern NC
- Displays the club's mission statement
- Shows real-time trail status at the bottom of the page

### About Section

- **Leadership** (`/about/leadership`): Information about the club's leadership team
- **Club Bylaws** (`/about/bylaws`): Official club bylaws and regulations
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

### Additional Pages

- **Thanks** (`/thanks`): Confirmation page after form submission
- **Dashboard** (`/dashboard`): Admin dashboard for club management (requires authentication)
- **Login** (`/login`): Authentication page for admin access

## Technical Stack

- **Frontend**: Next.js 14, React 18, Material UI 6, TailwindCSS
- **CMS**: Contentful for blog posts, bylaws, and other content
- **Database**: Google Firestore for trail status and dynamic data
- **Authentication**: Firebase Authentication for admin access
- **Deployment**: Netlify
- **Form Handling**: Netlify Forms
- **State Management**: TanStack React Query

## Netlify Deployment Procedures

### Initial Setup

1. Connect your GitHub repository to Netlify
2. Configure the build settings:
   - Build command: `yarn build`
   - Publish directory: `.next`
   - Functions directory: `netlify/functions`

### Environment Variables

The following environment variables need to be set in Netlify:

- `CONTENTFUL_SPACE_ID`: Your Contentful space ID
- `CONTENTFUL_ACCESS_TOKEN`: Your Contentful access token
- `GOOGLE_PROJECT_ID`: Your Google Cloud project ID
- `GOOGLE_CLIENT_EMAIL`: Your Google service account email
- `GOOGLE_PRIVATE_KEY`: Your Google service account private key
- `NEXT_PUBLIC_BASE_URL`: The base URL of your site (for API calls)

### Deployment Process

1. Push changes to the connected GitHub repository
2. Netlify automatically builds and deploys the site
3. The build process includes:
   - Running `yarn build` to build the Next.js application
   - Deploying Netlify functions from the `netlify/functions` directory
   - Setting up redirects as defined in `netlify.toml`

### Form Handling

Form submissions follow this flow:

1. User submits the form on the contact page
2. The form data is sent to `/api/submit-form` (Next.js API route)
3. The API route forwards the data to `/api/form-submission` (Next.js API route in the pages directory)
4. This route forwards the data to the Netlify function at `/.netlify/functions/submission-created`
5. The Netlify function processes the form submission
6. User is redirected to the thanks page

## Development Instructions

### Getting Started

1. Clone the repository
2. Install dependencies:
3.

```bash
   yarn install
   ```

4. Create a `.env.local` file with the required environment variables (see above)
5. Run the development server:

   ```bash
   yarn dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

### Content Management

Content is managed through Contentful. To update the content types:

```bash
yarn types:contentful
```

This command generates TypeScript types based on your Contentful content models.

### Trail Status Management

Trail status is managed through the admin dashboard. Authenticated users can:

1. Log in to the dashboard
2. Update trail status (open/closed)
3. Add notes about trail conditions

The trail status is stored in Firestore and is available through the `/api/trails` endpoint.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Netlify Documentation](https://docs.netlify.com/)
- [Contentful Documentation](https://www.contentful.com/developers/docs/)
- [Firebase Documentation](https://firebase.google.com/docs)
