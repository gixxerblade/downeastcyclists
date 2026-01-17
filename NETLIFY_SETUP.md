# Netlify Environment Variables Setup

## Problem

AWS Lambda (which Netlify uses) has a 4KB limit on environment variables. Storing Firebase service account credentials as environment variables (whether as separate keys or base64-encoded JSON) along with other secrets (Stripe keys, etc.) exceeds this limit.

Netlify's free tier doesn't support env var scopes, so all env vars get passed to Lambda functions.

## Solution

Encrypt the Firebase service account JSON file and commit the encrypted version to the repository. At build time, decrypt it with a small encryption key (~44 chars) stored as an environment variable.

**Benefits:**

- Only a 44-character encryption key counts toward the 4KB limit
- Encrypted file is safe to commit to git
- Works on Netlify's free tier (no paid features required)
- Secure: AES-256-CBC encryption with PBKDF2 key derivation

## Setup Instructions

### 1. Get Your Firebase Service Account JSON

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** > **Service Accounts**
4. Click **Generate New Private Key**
5. Download and save the JSON file (e.g., `firebase-service-account.json`)

### 2. Encrypt the Service Account File

Run the encryption script from your project root:

```bash
./scripts/encrypt-credentials.sh path/to/your-downloaded-service-account.json
```

This will:

1. Generate a random encryption key
2. Display the encryption key (save this!)
3. Create an encrypted file: `firebase-service-account.json.enc`
4. Show you the next steps

**Example output:**

```
Generated encryption key (save this in Netlify env vars as FIREBASE_ENCRYPTION_KEY):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ab123xyz...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ File encrypted successfully: firebase-service-account.json.enc
```

**IMPORTANT:** Copy the encryption key from the terminal output. You'll need it in the next step.

### 3. Set Up Netlify Environment Variable

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** > **Environment variables**
3. Click **Add a variable**
4. Set:
   - **Key**: `FIREBASE_ENCRYPTION_KEY`
   - **Value**: Paste the encryption key from step 2
   - **Deploy contexts**: Select "All deploys" or specific contexts as needed

This small key (~44 characters) is all you need in env vars!

### 4. Remove Old Environment Variables

In Netlify, **remove** these old environment variables to free up space:

- `FIREBASE_SERVICE_ACCOUNT_BASE64` (if it exists)
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_PROJECT_ID`
- `GOOGLE_CLIENT_EMAIL`

### 5. Commit the Encrypted File

The encrypted file is safe to commit to your repository:

```bash
git add firebase-service-account.json.enc
git add scripts/encrypt-credentials.sh scripts/decrypt-credentials.sh
git commit -m "Add encrypted Firebase service account"
git push
```

**Note:** The original `firebase-service-account.json` (decrypted) is in `.gitignore` and will never be committed.

### 6. Keep Other Environment Variables

Keep these environment variables in Netlify as they are:

- All Stripe-related variables (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, etc.)
- Contentful variables
- `NEXT_PUBLIC_*` variables for client-side use
- Any other app-specific variables

## How It Works

1. **Build Time** (Netlify):
   - Build command runs `scripts/decrypt-credentials.sh`
   - Script reads `firebase-service-account.json.enc` from repo
   - Script uses `FIREBASE_ENCRYPTION_KEY` env var to decrypt
   - Creates `firebase-service-account.json` file

2. **Runtime** (Lambda):
   - Firebase Admin SDK reads credentials from `firebase-service-account.json` (see `src/lib/firebase-admin.ts:19-25`)
   - File is bundled with the function via `netlify.toml` included_files

3. **Local Development**:
   - No encrypted file is decrypted locally
   - Code falls back to reading env vars from `.env.local` (see `src/lib/firebase-admin.ts:27-42`)
   - You keep working as before

## Local Development

For local development, continue using your `.env.local` file with individual env vars:

```env
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_PROJECT_ID="your-project-id"
GOOGLE_CLIENT_EMAIL="firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com"
```

The code automatically detects which method to use.

## Environment Variable Size Comparison

**Before (exceeds 4KB limit):**

```md
FIREBASE_SERVICE_ACCOUNT_BASE64: 2,400 bytes
Other env vars (Stripe, etc.):     1,289 bytes
TOTAL:                             3,689 bytes ⚠️ (close to or over limit)
```

**After (well under 4KB limit):**

```md
FIREBASE_ENCRYPTION_KEY:             44 bytes ✓
Other env vars (Stripe, etc.):    1,289 bytes ✓
TOTAL:                            1,333 bytes ✓ (67% reduction!)
```

## Security Notes

- **Encryption**: Uses AES-256-CBC with PBKDF2 key derivation (industry standard)
- **Encrypted file**: Safe to commit to public or private repos
- **Encryption key**: Treat as a secret (like any other env var)
- **Decrypted file**: Never committed (in `.gitignore`)
- **Local backups**: Keep a backup of your original service account JSON file in a secure location

## Troubleshooting

### Build Error: "FIREBASE_ENCRYPTION_KEY environment variable not set"

- The encryption key env var is missing in Netlify
- Go to Site settings > Environment variables
- Add `FIREBASE_ENCRYPTION_KEY` with the key from step 2

### Build Error: "Encrypted file firebase-service-account.json.enc not found"

- You haven't committed the encrypted file to git
- Run `./scripts/encrypt-credentials.sh` locally
- Commit and push `firebase-service-account.json.enc`

### Build Error: "Failed to decrypt credentials"

- The encryption key in Netlify doesn't match the one used to encrypt
- Verify you copied the correct key from the encryption script output
- If you lost the key, re-run the encryption script to generate a new encrypted file and key

### Runtime Error: "Firebase credentials not found"

If you get this error in production:

- The decrypted file wasn't created during build
- Check Netlify build logs for errors in the decrypt step
- Verify `scripts/decrypt-credentials.sh` ran successfully

If you get this error locally:

- You're missing the Firebase env vars in `.env.local`
- Add `GOOGLE_PRIVATE_KEY`, `GOOGLE_PROJECT_ID`, and `GOOGLE_CLIENT_EMAIL`

### Check Environment Variable Size

To verify your total env var size (excluding the encrypted file, which isn't an env var):

```bash
cat .env.prod | grep -v '^#' | grep -v '^$' | wc -c
```

Should be well under 4096 bytes now.

## Re-encrypting (If Needed)

If you need to update the service account or regenerate the encryption:

1. Download a new service account JSON from Firebase
2. Run the encryption script again:

   ```bash
   ./scripts/encrypt-credentials.sh path/to/new-service-account.json
   ```

3. Update `FIREBASE_ENCRYPTION_KEY` in Netlify with the new key
4. Commit the new `firebase-service-account.json.enc`
5. Push and redeploy
