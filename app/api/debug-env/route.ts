import {existsSync, readdirSync, readFileSync} from 'fs';
import {join} from 'path';

import {NextResponse} from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cwd = process.cwd();
  const serviceAccountPath = join(cwd, 'firebase-service-account.json');

  const debugInfo = {
    // Environment info
    nodeEnv: process.env.NODE_ENV,
    platform: process.platform,
    cwd,

    // File system checks
    serviceAccountExists: existsSync(serviceAccountPath),
    serviceAccountPath,

    // Try to list files in cwd
    cwdFiles: [] as string[],
    cwdError: null as string | null,

    // Try to read first few chars of service account (if it exists)
    serviceAccountReadable: false,
    serviceAccountPreview: null as string | null,
    serviceAccountError: null as string | null,

    // Check for environment variables
    hasGoogleProjectId: !!process.env.GOOGLE_PROJECT_ID,
    hasGooglePrivateKey: !!process.env.GOOGLE_PRIVATE_KEY,
    hasGoogleClientEmail: !!process.env.GOOGLE_CLIENT_EMAIL,
    hasFirebaseEncryptionKey: !!process.env.FIREBASE_ENCRYPTION_KEY,
  };

  // Try to list files in current directory
  try {
    debugInfo.cwdFiles = readdirSync(cwd).slice(0, 20); // Limit to 20 files
  } catch (error) {
    debugInfo.cwdError = error instanceof Error ? error.message : String(error);
  }

  // Try to read service account file
  if (debugInfo.serviceAccountExists) {
    try {
      const content = readFileSync(serviceAccountPath, 'utf-8');
      debugInfo.serviceAccountReadable = true;
      // Only show first 100 chars to avoid exposing secrets
      debugInfo.serviceAccountPreview = content.substring(0, 100) + '...';
    } catch (error) {
      debugInfo.serviceAccountError = error instanceof Error ? error.message : String(error);
    }
  }

  return NextResponse.json(debugInfo, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
