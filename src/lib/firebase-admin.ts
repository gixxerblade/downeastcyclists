import {readFileSync, existsSync} from 'fs';
import {join} from 'path';

import {Effect} from 'effect';
import {initializeApp, getApps, cert, App} from 'firebase-admin/app';
import {getAuth, Auth} from 'firebase-admin/auth';

import {AuthError} from './effect/errors';

let adminApp: App | null = null;
let adminAuth: Auth | null = null;

const initializeFirebaseAdmin = (): Effect.Effect<Auth, AuthError> =>
  Effect.try({
    try: () => {
      if (adminAuth) return adminAuth;

      if (getApps().length === 0) {
        // Try to load from service account file first (production)
        const serviceAccountPath = join(process.cwd(), 'firebase-service-account.json');

        if (existsSync(serviceAccountPath)) {
          const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
          adminApp = initializeApp({
            credential: cert(serviceAccount),
          });
        } else {
          // Fall back to environment variables (local development)
          const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

          if (!privateKey) {
            throw new Error(
              'Firebase credentials not found. Either provide firebase-service-account.json or set GOOGLE_PRIVATE_KEY environment variable.',
            );
          }

          adminApp = initializeApp({
            credential: cert({
              projectId: process.env.GOOGLE_PROJECT_ID,
              clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
              privateKey,
            }),
          });
        }
      } else {
        adminApp = getApps()[0];
      }

      adminAuth = getAuth(adminApp);
      return adminAuth;
    },
    catch: (error) =>
      new AuthError({
        code: 'ADMIN_INIT_FAILED',
        message: 'Failed to initialize Firebase Admin',
        cause: error,
      }),
  });

// Synchronous getter for Firebase Admin (for use outside Effect context)
// Throws if Firebase Admin is not yet initialized
const getFirebaseAdmin = (): {auth: Auth; app: App} => {
  if (!adminAuth || !adminApp) {
    // Initialize synchronously
    if (getApps().length === 0) {
      const serviceAccountPath = join(process.cwd(), 'firebase-service-account.json');

      if (existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
        adminApp = initializeApp({
          credential: cert(serviceAccount),
        });
      } else {
        const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (!privateKey) {
          throw new Error(
            'Firebase credentials not found. Either provide firebase-service-account.json or set GOOGLE_PRIVATE_KEY environment variable.',
          );
        }

        adminApp = initializeApp({
          credential: cert({
            projectId: process.env.GOOGLE_PROJECT_ID,
            clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
            privateKey,
          }),
        });
      }
    } else {
      adminApp = getApps()[0];
    }

    adminAuth = getAuth(adminApp);
  }

  return {auth: adminAuth, app: adminApp};
};

export {initializeFirebaseAdmin, getFirebaseAdmin};
