import {neon as localNeon, neonConfig} from '@neondatabase/serverless';
import {neon} from '@netlify/neon';
import {drizzle} from 'drizzle-orm/neon-http';

import {localTestEndpoint, LOCAL_TEST_DATABASE_URL} from '@/src/lib/local-testing';

import * as schema from './schema';

const localEndpoint = localTestEndpoint(process.env.LOCAL_NEON_HTTP_URL, process.env.NODE_ENV);
if (localEndpoint) {
  if (process.env.NETLIFY_DATABASE_URL !== LOCAL_TEST_DATABASE_URL) {
    throw new Error('The local SQL gateway requires the isolated test database URL');
  }
  neonConfig.fetchEndpoint = localEndpoint.toString();
}

const sql = localEndpoint ? localNeon(LOCAL_TEST_DATABASE_URL) : neon();

export const db = drizzle({client: sql, schema});

export type Database = typeof db;
