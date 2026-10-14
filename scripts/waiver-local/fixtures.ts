import type {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {z} from 'zod';

import {users, memberships, membershipCards} from '../../src/db/schema/tables';

export const localAccounts = [
  {email: 'admin@example.test', name: 'Test Administrator', plan: 'individual'},
  {email: 'individual@example.test', name: 'Alex Individual', plan: 'individual'},
  {email: 'family@example.test', name: 'Jordan Family', plan: 'family'},
  {email: 'returning@example.test', name: 'Morgan Returning', plan: 'family'},
  {email: 'outsider@example.test', name: 'Casey Outsider', plan: 'individual'},
] satisfies Array<{email: string; name: string; plan: 'individual' | 'family'}>;
export const localPassword = 'WaiverTest123!';
export const localProject = 'demo-dec-waivers';
export const appUrl = 'http://127.0.0.1:3000';
export const supportUrl = 'http://127.0.0.1:4311';
export const emulatorUrl = 'http://127.0.0.1:9099';
export const webhookSecret = 'whsec_local_waiver_test_only';

export async function seedLocalAccounts(pg: PGlite) {
  const database = drizzle(pg);
  for (const [index, account] of localAccounts.entries()) {
    const response = await fetch(
      `${emulatorUrl}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=local-test-key`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          email: account.email,
          password: localPassword,
          displayName: account.name,
          returnSecureToken: true,
        }),
      },
    );
    if (!response.ok) throw new Error(`Could not create local account ${account.email}`);
    const {localId} = z.object({localId: z.string()}).parse(await response.json());
    if (account.email === 'admin@example.test') {
      const claims = await fetch(
        `${emulatorUrl}/identitytoolkit.googleapis.com/v1/projects/${localProject}/accounts:update`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json', Authorization: 'Bearer owner'},
          body: JSON.stringify({localId, customAttributes: JSON.stringify({admin: true})}),
        },
      );
      if (!claims.ok) throw new Error('Could not grant the local administrator claim');
    }
    const [user] = await database
      .insert(users)
      .values({firebaseUid: localId, email: account.email, name: account.name})
      .returning();
    if (!user) throw new Error('Local fixture user was not created');
    const startDate = new Date('2026-01-01T00:00:00Z');
    const endDate = new Date('2030-01-01T00:00:00Z');
    const [membership] = await database
      .insert(memberships)
      .values({
        userId: user.id,
        planType: account.plan,
        status: 'active',
        startDate,
        endDate,
        autoRenew: false,
      })
      .returning();
    if (!membership) throw new Error('Local fixture membership was not created');
    await database.insert(membershipCards).values({
      userId: user.id,
      membershipId: membership.id,
      membershipNumber: `LOCAL-${index + 1}`,
      memberName: account.name,
      email: account.email,
      planType: account.plan,
      status: 'active',
      validFrom: startDate,
      validUntil: endDate,
      qrCodeData: `local-test-only-${index + 1}`,
    });
  }
}
