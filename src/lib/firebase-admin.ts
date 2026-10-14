import {readFileSync, existsSync} from 'fs';
import {join} from 'path';

import {Effect} from 'effect';
import {initializeApp, getApps, cert, App} from 'firebase-admin/app';
import {getAuth, Auth} from 'firebase-admin/auth';

import {AuthError} from './effect/errors';
import {authEmulatorProject, localTestEndpoint} from './local-testing';

let adminApp: App | null = null;
let adminAuth: Auth | null = null;

function initializeAdminApp(): App {
  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (emulatorHost) {
    localTestEndpoint(`http://${emulatorHost}`, process.env.NODE_ENV);
    const projectId = authEmulatorProject(process.env.GOOGLE_PROJECT_ID);
    return getApps()[0] ?? initializeApp({projectId});
  }
  const existing = getApps()[0];
  if (existing) return existing;

  const serviceAccountPath = join(process.cwd(), 'firebase-service-account.json');
  if (existsSync(serviceAccountPath)) {
    return initializeApp({credential: cert(JSON.parse(readFileSync(serviceAccountPath, 'utf-8')))});
  }

  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!privateKey) {
    throw new Error(
      'Firebase credentials not found. Either provide firebase-service-account.json or set GOOGLE_PRIVATE_KEY environment variable.',
    );
  }
  return initializeApp({
    credential: cert({
      projectId: process.env.GOOGLE_PROJECT_ID,
      clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

const getFirebaseAdmin = (): {auth: Auth; app: App} => {
  adminApp ??= initializeAdminApp();
  adminAuth ??= getAuth(adminApp);
  return {auth: adminAuth, app: adminApp};
};

const initializeFirebaseAdmin = (): Effect.Effect<Auth, AuthError> =>
  Effect.try({
    try: () => getFirebaseAdmin().auth,
    catch: (cause) =>
      new AuthError({
        code: 'ADMIN_INIT_FAILED',
        message: 'Failed to initialize Firebase Admin',
        cause,
      }),
  });

export {initializeFirebaseAdmin, getFirebaseAdmin};
