import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {migrate} from 'drizzle-orm/pglite/migrator';
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';

import * as schema from '@/src/db/schema';

const fixture = vi.hoisted((): {client?: PGlite} => ({}));
vi.mock('@/src/db/client', async () => {
  const {PGlite} = await import('@electric-sql/pglite');
  const {drizzle} = await import('drizzle-orm/pglite');
  const schema = await import('@/src/db/schema');
  const client = new PGlite();
  fixture.client = client;
  const database = drizzle(client, {schema});
  return {
    db: {
      select: database.select.bind(database),
      insert: database.insert.bind(database),
      batch: async (queries: Array<{toSQL(): {sql: string; params: unknown[]}}>) =>
        client.transaction(async (tx) => {
          for (const query of queries) {
            const compiled = query.toSQL();
            await tx.query(compiled.sql, compiled.params);
          }
        }),
    },
  };
});
import {createTrailMaintenanceReport} from '@/src/lib/trail-maintenance/repository';

const input = {
  issueType: 'trail_obstruction',
  observedAt: new Date('2026-10-11T12:00:00Z'),
  trailSystemSlug: 'test-trails',
  trailSegmentSlug: 'bridge',
  locationSource: 'manual',
  locationNotes: 'Bridge',
} satisfies import('@/src/lib/trail-maintenance/validation').PublicTrailMaintenanceReportInput;
function database() {
  if (!fixture.client) throw new Error('Missing database');
  return drizzle(fixture.client, {schema});
}
beforeAll(async () => {
  await migrate(database(), {migrationsFolder: 'drizzle'});
}, 30_000);
beforeEach(async () => {
  const db = database();
  await db.delete(schema.trailMaintenanceReports);
  await db.delete(schema.trailSystems);
  const [system] = await db
    .insert(schema.trailSystems)
    .values({slug: 'test-trails', name: 'Test trails'})
    .returning();
  await db
    .insert(schema.trailSegments)
    .values({trailSystemId: system.id, slug: 'bridge', name: 'Bridge'});
});
afterAll(async () => {
  await fixture.client?.close();
});
describe('trail submission persistence', () => {
  it('commits the report, photo metadata, and creation event, and makes repeats idempotent', async () => {
    const args = {
      input,
      photos: [
        {
          bucketName: 'photos',
          objectKey: 'trail/test.jpg',
          originalFilename: 'test.jpg',
          contentType: 'image/jpeg',
          byteSize: 123,
          sortOrder: 0,
        },
      ],
      publicId: 'ABC123ABC123',
      userAgent: null,
      remoteIp: null,
    };
    const first = await createTrailMaintenanceReport(args);
    const again = await createTrailMaintenanceReport(args);
    expect(first.created).toBe(true);
    expect(again).toMatchObject({id: first.id, publicId: first.publicId, created: false});
    const db = database();
    expect(await db.select().from(schema.trailMaintenanceReports)).toHaveLength(1);
    expect(await db.select().from(schema.trailMaintenancePhotos)).toHaveLength(1);
    expect(await db.select().from(schema.trailMaintenanceEvents)).toHaveLength(1);
  });
  it('rolls back the report when photo metadata cannot be saved', async () => {
    const args = {
      input,
      photos: [
        {
          bucketName: 'photos',
          objectKey: 'test.jpg',
          originalFilename: 'x'.repeat(256),
          contentType: 'image/jpeg',
          byteSize: 123,
          sortOrder: 0,
        },
      ],
      publicId: 'ABC123ABC123',
      userAgent: null,
      remoteIp: null,
    };
    await expect(createTrailMaintenanceReport(args)).rejects.toThrow();
    const db = database();
    expect(await db.select().from(schema.trailMaintenanceReports)).toHaveLength(0);
    expect(await db.select().from(schema.trailMaintenanceEvents)).toHaveLength(0);
  });
});
