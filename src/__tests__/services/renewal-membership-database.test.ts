import {readFileSync} from 'node:fs';

import {PGlite} from '@electric-sql/pglite';
import {eq} from 'drizzle-orm';
import {drizzle} from 'drizzle-orm/pglite';
import {migrate} from 'drizzle-orm/pglite/migrator';
import {Effect, Layer} from 'effect';
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';

import * as schema from '@/src/db/schema';
import {MembershipCardServiceLive} from '@/src/lib/effect/card.service';
import {createCardMethods} from '@/src/lib/effect/database-card.methods';
import {createMembershipMethods} from '@/src/lib/effect/database-membership.methods';
import {MembershipService, MembershipServiceLive} from '@/src/lib/effect/membership.service';
import {QRService} from '@/src/lib/effect/qr.service';
import type {MemberSearchParams} from '@/src/lib/effect/schemas';

import {
  createTestDatabaseService,
  createTestStripeService,
  TestDatabaseLayer,
  TestStripeLayer,
} from '../layers/test-layers';
import {createMockMembershipCard, createMockUserDocument} from '../mocks/database.mock';
import {createMockCheckoutSession, createMockSubscription} from '../mocks/stripe.mock';

const client = new PGlite();
const db = drizzle(client, {schema});
const methods = createMembershipMethods(db);
const cards = createCardMethods(db);
const repairSql = readFileSync('drizzle/0007_repair_renewed_card_links.sql', 'utf8');
const oldStart = new Date('2020-01-01T00:00:00Z');
const oldEnd = new Date('2021-01-01T00:00:00Z');
const renewedStart = new Date('2026-09-20T13:16:33Z');
const renewedEnd = new Date('2099-09-20T13:16:33Z');

async function seedRenewal() {
  const [user] = await db
    .insert(schema.users)
    .values({
      firebaseUid: 'renewed-member',
      email: 'renewed@example.com',
      name: 'Renewed Member',
    })
    .returning();
  const [oldTerm, renewedTerm] = await db
    .insert(schema.memberships)
    .values([
      {
        userId: user.id,
        stripeSubscriptionId: 'import_old',
        planType: 'individual',
        status: 'active',
        startDate: oldStart,
        endDate: oldEnd,
        autoRenew: false,
      },
      {
        userId: user.id,
        stripeSubscriptionId: 'sub_renewed',
        planType: 'family',
        status: 'active',
        startDate: renewedStart,
        endDate: renewedEnd,
      },
    ])
    .returning();
  const [card] = await db
    .insert(schema.membershipCards)
    .values({
      userId: user.id,
      membershipId: oldTerm.id,
      membershipNumber: 'DEC-2026-000049',
      memberName: 'Renewed Member',
      email: user.email,
      planType: 'family',
      status: 'active',
      validFrom: renewedStart,
      validUntil: renewedEnd,
      qrCodeData: 'existing-signed-qr',
    })
    .returning();
  return {user, oldTerm, renewedTerm, card};
}

beforeAll(async () => {
  await migrate(db, {migrationsFolder: 'drizzle'});
}, 30_000);
beforeEach(async () => {
  await db.delete(schema.users);
});
afterAll(async () => {
  await client.close();
});

describe('renewed memberships in the member list', () => {
  it('returns one renewed membership and counts one person while retaining history', async () => {
    const {renewedTerm} = await seedRenewal();
    const result = await Effect.runPromise(methods.getAllMemberships({}));
    expect(result.total).toBe(1);
    expect(result.members).toHaveLength(1);
    expect(result.members[0].membership?.id).toBe(renewedTerm.id);
    expect(await db.select().from(schema.memberships)).toHaveLength(2);
  });

  it('filters the selected term, not old status, plan, or expiration dates', async () => {
    await seedRenewal();
    const filters: MemberSearchParams[] = [
      {status: 'expired'},
      {planType: 'individual'},
      {expiringWithinDays: 90},
    ];
    for (const params of filters) {
      const result = await Effect.runPromise(methods.getAllMemberships(params));
      expect(result).toEqual({members: [], total: 0});
    }
    expect(
      (await Effect.runPromise(methods.getAllMemberships({status: 'active', planType: 'family'})))
        .total,
    ).toBe(1);
  });

  it('prefers current access over a canceled term with a later end date', async () => {
    const {user, renewedTerm} = await seedRenewal();
    await db.insert(schema.memberships).values({
      userId: user.id,
      planType: 'individual',
      status: 'canceled',
      startDate: renewedStart,
      endDate: new Date('2100-01-01'),
    });
    const result = await Effect.runPromise(methods.getAllMemberships({}));
    expect(result.members[0].membership?.id).toBe(renewedTerm.id);
  });

  it('shows the latest expired term when a member has no current membership', async () => {
    const {renewedTerm} = await seedRenewal();
    await db
      .update(schema.memberships)
      .set({endDate: new Date('2022-01-01')})
      .where(eq(schema.memberships.id, renewedTerm.id));
    const result = await Effect.runPromise(methods.getAllMemberships({status: 'expired'}));
    expect(result.total).toBe(1);
    expect(result.members[0].membership?.id).toBe(renewedTerm.id);
  });

  it('paginates distinct people and keeps the same total on every page', async () => {
    await seedRenewal();
    const [other] = await db
      .insert(schema.users)
      .values({firebaseUid: 'other', email: 'other@example.com'})
      .returning();
    await db.insert(schema.memberships).values({
      userId: other.id,
      planType: 'individual',
      status: 'active',
      startDate: renewedStart,
      endDate: renewedEnd,
    });
    const first = await Effect.runPromise(methods.getAllMemberships({pageSize: 1, page: 1}));
    const second = await Effect.runPromise(methods.getAllMemberships({pageSize: 1, page: 2}));
    expect(first.total).toBe(2);
    expect(second.total).toBe(2);
    expect(first.members).toHaveLength(1);
    expect(second.members).toHaveLength(1);
    expect(first.members[0].user?.id).not.toBe(second.members[0].user?.id);
  });

  it('does not multiply member rows when a membership has multiple cards', async () => {
    const {user, renewedTerm, card} = await seedRenewal();
    await db
      .update(schema.membershipCards)
      .set({membershipId: renewedTerm.id})
      .where(eq(schema.membershipCards.id, card.id));
    await db.insert(schema.membershipCards).values({
      userId: user.id,
      membershipId: renewedTerm.id,
      membershipNumber: 'DEC-2026-000050',
      memberName: 'Member',
      email: user.email,
      planType: 'family',
      status: 'active',
      validFrom: renewedStart,
      validUntil: renewedEnd,
      qrCodeData: 'qr',
    });
    const result = await Effect.runPromise(methods.getAllMemberships({}));
    expect(result.total).toBe(1);
    expect(result.members).toHaveLength(1);
  });
});

describe('renewal card persistence and existing-data repair', () => {
  it.each(['sub_renewed', 'uuid'])(
    'links an existing card to the exact requested membership (%s)',
    async (identifier) => {
      const {card, renewedTerm} = await seedRenewal();
      const renewedCard = createMockMembershipCard({
        membershipNumber: card.membershipNumber,
        planType: 'family',
        validFrom: renewedStart.toISOString(),
        validUntil: renewedEnd.toISOString(),
      });
      await Effect.runPromise(
        cards.setMembershipCard(
          'renewed-member',
          renewedCard,
          identifier === 'uuid' ? renewedTerm.id : identifier,
        ),
      );
      const rows = await db.select().from(schema.membershipCards);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: card.id,
        membershipId: renewedTerm.id,
        membershipNumber: card.membershipNumber,
      });
    },
  );

  it('rejects another user’s membership without changing the card', async () => {
    const {card} = await seedRenewal();
    const [other] = await db
      .insert(schema.users)
      .values({firebaseUid: 'other', email: 'other@example.com'})
      .returning();
    await db.insert(schema.memberships).values({
      userId: other.id,
      stripeSubscriptionId: 'sub_other',
      planType: 'individual',
      status: 'active',
      startDate: renewedStart,
      endDate: renewedEnd,
    });
    await expect(
      Effect.runPromise(
        cards.setMembershipCard('renewed-member', createMockMembershipCard(), 'sub_other'),
      ),
    ).rejects.toThrow();
    expect((await db.select().from(schema.membershipCards))[0]).toEqual(card);
  });

  it('repairs the reported stale link, preserving card details and history; repeat execution is harmless', async () => {
    const {card, renewedTerm} = await seedRenewal();
    await client.exec(repairSql);
    const [repaired] = await db.select().from(schema.membershipCards);
    expect(repaired).toEqual({...card, membershipId: renewedTerm.id, updatedAt: expect.any(Date)});
    await client.exec(repairSql);
    expect((await db.select().from(schema.membershipCards))[0]).toEqual(repaired);
    expect(await db.select().from(schema.memberships)).toHaveLength(2);
    const result = await Effect.runPromise(
      methods.getAllMemberships({query: card.membershipNumber}),
    );
    expect(result.total).toBe(1);
    expect(result.members[0].membership?.id).toBe(renewedTerm.id);
    expect(result.members[0].card?.membershipNumber).toBe(card.membershipNumber);
  });

  it('skips ambiguous matching memberships', async () => {
    const {card, user} = await seedRenewal();
    await db.insert(schema.memberships).values({
      userId: user.id,
      planType: 'family',
      status: 'active',
      startDate: renewedStart,
      endDate: renewedEnd,
    });
    await client.exec(repairSql);
    expect((await db.select().from(schema.membershipCards))[0]).toEqual(card);
  });

  it('skips cards without an exact matching term', async () => {
    const {card, renewedTerm} = await seedRenewal();
    await db
      .update(schema.memberships)
      .set({planType: 'individual'})
      .where(eq(schema.memberships.id, renewedTerm.id));
    await client.exec(repairSql);
    expect((await db.select().from(schema.membershipCards))[0]).toEqual(card);
  });
});

describe('checkout renewal through the real membership and card services', () => {
  it.each([true, false])(
    'preserves or creates a card and links it to the checkout term (existing card: %s)',
    async (hasCard) => {
      const {user, card, renewedTerm} = await seedRenewal();
      // Leave only the imported term: checkout must persist the new subscription.
      await db.delete(schema.memberships).where(eq(schema.memberships.id, renewedTerm.id));
      if (!hasCard) await db.delete(schema.membershipCards);
      const subscription = createMockSubscription({id: 'sub_renewed'});
      const database = createTestDatabaseService({
        ...methods,
        ...cards,
        getUserByEmail: () =>
          Effect.succeed(
            createMockUserDocument({
              id: user.firebaseUid,
              email: user.email,
              name: 'Renewed Member',
            }),
          ),
      });
      const qrData = vi.fn(() => Effect.succeed('renewed-signed-qr'));
      const dependencies = Layer.mergeAll(
        TestDatabaseLayer(database),
        TestStripeLayer(
          createTestStripeService({retrieveSubscription: () => Effect.succeed(subscription)}),
        ),
        Layer.succeed(QRService, {
          generateQRData: qrData,
          generateQRImage: () => Effect.die('Unused'),
          verifyQRData: () => Effect.die('Unused'),
        }),
      );
      const cardLayer = Layer.provide(MembershipCardServiceLive, dependencies);
      const liveLayer = Layer.provide(MembershipServiceLive, Layer.merge(dependencies, cardLayer));
      const checkout = createMockCheckoutSession({
        customer_email: user.email,
        subscription: subscription.id,
        metadata: {},
      });
      await Effect.runPromise(
        Effect.provide(
          Effect.gen(function* () {
            const service = yield* MembershipService;
            yield* service.processCheckoutCompleted(checkout);
            // A repeated delivery must preserve the card and membership identity.
            yield* service.processCheckoutCompleted(checkout);
          }),
          liveLayer,
        ),
      );
      const memberships = await db.select().from(schema.memberships);
      expect(memberships).toHaveLength(2);
      const term = memberships.find((m) => m.stripeSubscriptionId === subscription.id);
      const savedCards = await db.select().from(schema.membershipCards);
      expect(savedCards).toHaveLength(1);
      const [savedCard] = savedCards;
      expect(savedCard).toMatchObject({
        membershipId: term?.id,
        memberName: 'Renewed Member',
        qrCodeData: 'renewed-signed-qr',
      });
      expect(savedCard.validUntil).toEqual(term?.endDate);
      if (hasCard) {
        expect(savedCard.id).toBe(card.id);
        expect(savedCard.membershipNumber).toBe(card.membershipNumber);
      }
      expect(qrData).toHaveBeenCalledWith(
        expect.objectContaining({membershipNumber: savedCard.membershipNumber}),
      );
    },
  );
});
