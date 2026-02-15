/**
 * Database client factories for migration script
 */

import {Firestore} from '@google-cloud/firestore';
import {neon} from '@neondatabase/serverless';
import {drizzle} from 'drizzle-orm/neon-http';

export function createFirestoreClient(): Firestore {
  if (!process.env.GOOGLE_PROJECT_ID || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Missing Firestore credentials (GOOGLE_PROJECT_ID, GOOGLE_PRIVATE_KEY)');
  }

  return new Firestore({
    projectId: process.env.GOOGLE_PROJECT_ID,
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.split('\\n').join('\n'),
    },
  });
}

export function createPostgresClient() {
  const databaseUrl = process.env.NETLIFY_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Missing NETLIFY_DATABASE_URL environment variable');
  }

  const sql = neon(databaseUrl);
  return drizzle({client: sql});
}

export type PostgresClient = ReturnType<typeof createPostgresClient>;
