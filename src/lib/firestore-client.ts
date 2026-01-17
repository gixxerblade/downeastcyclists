import {Firestore} from '@google-cloud/firestore';
import {readFileSync, existsSync} from 'fs';
import {join} from 'path';

let cachedFirestore: Firestore | null = null;

/**
 * Create or return cached Firestore instance
 *
 * In production (Netlify): Reads from firebase-service-account.json
 * In local development: Reads from environment variables
 */
export function getFirestoreClient(): Firestore {
  if (cachedFirestore) {
    return cachedFirestore;
  }

  // Try to load from service account file first (production)
  const serviceAccountPath = join(process.cwd(), 'firebase-service-account.json');

  if (existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
    cachedFirestore = new Firestore({
      projectId: serviceAccount.project_id,
      credentials: serviceAccount,
    });
    return cachedFirestore;
  }

  // Fall back to environment variables (local development)
  if (!process.env.GOOGLE_PROJECT_ID || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error(
      'Firebase credentials not found. Either provide firebase-service-account.json or set GOOGLE_PROJECT_ID and GOOGLE_PRIVATE_KEY environment variables.'
    );
  }

  cachedFirestore = new Firestore({
    projectId: process.env.GOOGLE_PROJECT_ID,
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.split('\\n').join('\n'),
    },
  });

  return cachedFirestore;
}
