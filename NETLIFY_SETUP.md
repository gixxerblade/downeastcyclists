# Netlify Environment Variables Setup

## Problem

AWS Lambda (which Netlify uses) has a 4KB limit on environment variables. Storing Firebase service account credentials as separate env vars (`GOOGLE_PRIVATE_KEY`, `GOOGLE_PROJECT_ID`, `GOOGLE_CLIENT_EMAIL`) along with other secrets (Stripe keys, etc.) exceeds this limit.

## Solution

Store the entire Firebase service account JSON as a single base64-encoded environment variable.

## Setup Instructions

### 1. Get Your Firebase Service Account JSON

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** > **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file

### 2. Base64 Encode the File

Run this command in your terminal (replace the path with your downloaded file):

```bash
base64 -i /path/to/your-service-account.json | tr -d '\n' | pbcopy
```

This will copy the base64-encoded content to your clipboard.

### 3. Set Up Netlify Environment Variable

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** > **Environment variables**
3. Click **Add a variable**
4. Set:
   - **Key**: `FIREBASE_SERVICE_ACCOUNT_BASE64`
   - **Value**: Paste the base64-encoded string from your clipboard
   - **Scopes**: Select "All deploys" or specific contexts as needed

### 4. Remove Old Environment Variables

In Netlify, **remove** these old environment variables (they're no longer needed):

- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_PROJECT_ID`
- `GOOGLE_CLIENT_EMAIL`

This reduces your total env var size significantly.

### 5. Keep Other Environment Variables

Keep these environment variables as they are:

- All Stripe-related variables (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, etc.)
- Any other app-specific variables
- `NEXT_PUBLIC_*` variables for client-side use

## How It Works

1. **Build Time**: Netlify's build command decodes the base64 string and writes it to `firebase-service-account.json`
2. **Runtime**: The Firebase Admin SDK reads credentials from the file (see `src/lib/firebase-admin.ts:19-25`)
3. **Local Development**: The code falls back to env vars from `.env.local` (see `src/lib/firebase-admin.ts:27-42`)

## Local Development

For local development, continue using your `.env.local` file with individual env vars:

```env
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_PROJECT_ID="your-project-id"
GOOGLE_CLIENT_EMAIL="firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com"
```

The code automatically detects which method to use.

## Security Notes

- `firebase-service-account.json` is in `.gitignore` and will never be committed
- The file only exists during Netlify builds and in deployed functions
- Base64 encoding is NOT encryption - still treat the env var as a secret
- Use Netlify's "Sensitive variable" option to hide the value in the UI
