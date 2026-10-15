import {copyFile, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {PGlite} from '@electric-sql/pglite';
import {eq} from 'drizzle-orm';
import {drizzle} from 'drizzle-orm/pglite';
import {migrate} from 'drizzle-orm/pglite/migrator';
import {describe, expect, it} from 'vitest';

import journal from '@/drizzle/meta/_journal.json';
import * as schema from '@/src/db/schema';
import {DEFAULT_WAIVER_CONTENT, DEFAULT_WAIVER_TITLE} from '@/src/lib/waivers/default-waiver';

describe('waiver migrations after the published membership migrations', () => {
  it('keeps ordered migration timestamps and a continuous snapshot history', async () => {
    let previousId: string | undefined;
    for (const [index, entry] of journal.entries.entries()) {
      expect(entry.idx).toBe(index);
      if (index > 0) expect(entry.when).toBeGreaterThan(journal.entries[index - 1].when);
      const snapshot = JSON.parse(
        await readFile(`drizzle/meta/${String(index).padStart(4, '0')}_snapshot.json`, 'utf8'),
      );
      if (previousId) expect(snapshot.prevId).toBe(previousId);
      previousId = snapshot.id;
      if (index >= 8) {
        expect(snapshot.tables['public.membership_periods']).toBeDefined();
        expect(snapshot.enums['public.audit_action'].values).toContain(
          'AUTOMATED_UPCOMING_RENEWAL_EMAIL_SENT',
        );
      }
    }
  });

  it('upgrades an existing master database without losing members or renewal history', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'dec-waiver-migrations-'));
    const client = new PGlite();
    const db = drizzle(client, {schema});
    try {
      const publishedEntries = journal.entries.filter((entry) => entry.idx <= 8);
      await mkdir(join(folder, 'meta'));
      await writeFile(
        join(folder, 'meta/_journal.json'),
        JSON.stringify({...journal, entries: publishedEntries}),
      );
      await Promise.all(
        publishedEntries.map((entry) =>
          copyFile(`drizzle/${entry.tag}.sql`, join(folder, `${entry.tag}.sql`)),
        ),
      );
      await migrate(db, {migrationsFolder: folder});
      const [member] = await db
        .insert(schema.users)
        .values({firebaseUid: 'existing-member', email: 'existing@example.test'})
        .returning();
      const [membership] = await db
        .insert(schema.memberships)
        .values({
          userId: member.id,
          planType: 'family',
          status: 'active',
          startDate: new Date('2026-01-01T00:00:00Z'),
          endDate: new Date('2027-01-01T00:00:00Z'),
        })
        .returning();
      const originalPeriods = await db.select().from(schema.membershipPeriods);
      // Historical duplicate provider keys must remain valid: only new operation
      // claims are unique, and old delivery history is not rewritten or deleted.
      for (let index = 0; index < 2; index++)
        await client.query(
          `INSERT INTO email_log (user_id, email_type, delivery_type, campaign_key, recipient_email, subject, status, idempotency_key, sent_by)
         VALUES ($1, 'liability_waiver_signature_request', 'one-time', 'waiver/legacy', 'existing@example.test', 'Legacy invitation', 'sent', 'legacy-key', 'admin')`,
          [member.id],
        );

      await migrate(db, {migrationsFolder: 'drizzle'});
      // A second deployment must not rerun the waiver seed or the existing migrations.
      await migrate(db, {migrationsFolder: 'drizzle'});

      expect(await db.select().from(schema.users)).toEqual([member]);
      expect(await db.select().from(schema.memberships)).toEqual([membership]);
      expect(await db.select().from(schema.membershipPeriods)).toEqual(originalPeriods);
      const oldEmails = await db.select().from(schema.emailLog);
      expect(oldEmails).toHaveLength(2);
      expect(
        oldEmails.every(
          (row) =>
            row.operationKey === null && row.providerEmailId === null && row.status === 'sent',
        ),
      ).toBe(true);
      const templates = await db.select().from(schema.waiverTemplates);
      expect(templates).toHaveLength(2);
      expect(templates.find((template) => template.status === 'published')).toMatchObject({
        title: DEFAULT_WAIVER_TITLE,
        version: 2,
        content: DEFAULT_WAIVER_CONTENT,
      });
      expect(await db.select().from(schema.waiverSignatures)).toEqual([]);
      const applied = await client.query('SELECT id FROM drizzle.__drizzle_migrations');
      expect(applied.rows).toHaveLength(journal.entries.length);

      await db
        .update(schema.memberships)
        .set({
          startDate: new Date('2027-01-01T00:00:00Z'),
          endDate: new Date('2028-01-01T00:00:00Z'),
        })
        .where(eq(schema.memberships.id, membership.id));
      expect(await db.select().from(schema.membershipPeriods)).toHaveLength(2);
    } finally {
      await client.close();
      await rm(folder, {recursive: true, force: true});
    }
  }, 30_000);
});
