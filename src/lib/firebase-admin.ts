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

      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (!privateKey) {
        throw new Error('GOOGLE_PRIVATE_KEY not configured');
      }

      if (getApps().length === 0) {
        adminApp = initializeApp({
          credential: cert({
            projectId: process.env.GOOGLE_PROJECT_ID,
            clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
            privateKey,
          }),
        });
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

export {initializeFirebaseAdmin};
