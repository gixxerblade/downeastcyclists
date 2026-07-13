/*
 * Meetup's official event API is GraphQL behind Meetup Pro and OAuth, which this
 * project does not currently have. This ingestion job therefore relies on the
 * public RSS feed plus public event page JSON-LD Event markup. Both surfaces are
 * undocumented and can change without notice; if they break, first re-check
 * whether Meetup's GraphQL API has become affordable or necessary before
 * scraping a changed page structure.
 */

import {inArray} from 'drizzle-orm';
import {Data, Effect, Schedule} from 'effect';

import {meetupEvents} from '../../db/schema/tables';
import {DatabaseError} from '../effect/errors';

export interface MeetupFeedItem {
  readonly guid: string;
  readonly title: string;
  readonly link: string;
  readonly description: string;
}

export interface MeetupEventDetails {
  readonly startDate: string;
  readonly endDate: string | null;
  readonly location: string | null;
}

export interface MeetupIngestResult {
  readonly feedItems: number;
  readonly skippedExisting: number;
  readonly saved: number;
  readonly failed: number;
}

export class MeetupFeedError extends Data.TaggedError('MeetupFeedError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class MeetupEventPageError extends Data.TaggedError('MeetupEventPageError')<{
  readonly link: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

const meetupFeedUrl = 'https://www.meetup.com/down-east-cyclists/events/rss/';

const retryPolicy = Schedule.intersect(Schedule.recurs(2))(Schedule.exponential('500 millis'));

function getDb() {
  return (require('../../db/client') as typeof import('../../db/client')).db;
}

const decodeXml = (value: string) =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .trim();

const tagValue = (item: string, tag: string) => {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
};

const stripHtml = (value: string) => decodeXml(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));

const parseFeedXml = (xml: string): MeetupFeedItem[] => {
  const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  return itemMatches
    .map((item) => {
      const link = tagValue(item, 'link');
      return {
        guid: tagValue(item, 'guid') || link,
        title: tagValue(item, 'title'),
        link,
        description: stripHtml(tagValue(item, 'description')),
      };
    })
    .filter((item) => item.guid && item.title && item.link);
};

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .trim();

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const hasEventType = (value: Record<string, unknown>) => {
  const type = value['@type'];
  return type === 'Event' || (Array.isArray(type) && type.includes('Event'));
};

const findEventBlock = (value: unknown): Record<string, unknown> | null => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findEventBlock(item);
      if (found) return found;
    }
    return null;
  }

  if (!isObject(value)) return null;
  if (hasEventType(value)) return value;

  const graph = value['@graph'];
  if (graph) return findEventBlock(graph);

  for (const nestedValue of Object.values(value)) {
    const found = findEventBlock(nestedValue);
    if (found) return found;
  }

  return null;
};

const compactJoin = (values: Array<unknown>) =>
  values
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())
    .join(', ');

const formatLocation = (location: unknown): string | null => {
  if (typeof location === 'string') return location;
  if (!isObject(location)) return null;

  const address = location.address;
  if (typeof address === 'string') return compactJoin([location.name, address]) || null;

  if (isObject(address)) {
    return (
      compactJoin([
        location.name,
        address.streetAddress,
        address.addressLocality,
        address.addressRegion,
        address.postalCode,
      ]) || null
    );
  }

  return compactJoin([location.name]) || null;
};

const parseEventJsonLd = (html: string, link: string): MeetupEventDetails => {
  const scriptMatches = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );

  for (const match of scriptMatches) {
    try {
      const parsed = JSON.parse(decodeHtmlEntities(match[1]));
      const eventBlock = findEventBlock(parsed);
      if (!eventBlock) continue;

      const startDate = eventBlock.startDate;

      if (typeof startDate !== 'string' || Number.isNaN(new Date(startDate).getTime())) {
        continue;
      }

      const endDate = eventBlock.endDate;
      return {
        startDate,
        endDate: typeof endDate === 'string' ? endDate : null,
        location: formatLocation(eventBlock.location),
      };
    } catch {
      continue;
    }
  }

  throw new Error(`No parseable JSON-LD Event block found at ${link}`);
};

export const fetchFeed = Effect.tryPromise({
  try: async () => {
    const response = await fetch(meetupFeedUrl, {
      headers: {
        Accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8',
        'User-Agent': 'Down East Cyclists website event ingest',
      },
    });

    if (!response.ok) {
      throw new Error(`Meetup RSS returned ${response.status}`);
    }

    const items = parseFeedXml(await response.text());
    if (items.length === 0) {
      throw new Error('Meetup RSS did not contain any usable event items');
    }

    return items;
  },
  catch: (error) =>
    new MeetupFeedError({
      message: 'Failed to fetch or parse Meetup RSS feed',
      cause: error,
    }),
}).pipe(Effect.retry(retryPolicy));

export const fetchEventDetails = (link: string) =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(link, {
        headers: {
          Accept: 'text/html,application/xhtml+xml;q=0.9',
          'User-Agent': 'Down East Cyclists website event ingest',
        },
      });

      if (!response.ok) {
        throw new Error(`Meetup event page returned ${response.status}`);
      }

      return parseEventJsonLd(await response.text(), link);
    },
    catch: (error) =>
      new MeetupEventPageError({
        link,
        message: 'Failed to fetch or parse Meetup event page',
        cause: error,
      }),
  }).pipe(Effect.retry(retryPolicy));

const findExistingGuids = (guids: string[]): Effect.Effect<Set<string>, DatabaseError> =>
  Effect.tryPromise({
    try: async () => {
      if (guids.length === 0) return new Set<string>();
      const db = getDb();
      const rows = await db
        .select({guid: meetupEvents.guid})
        .from(meetupEvents)
        .where(inArray(meetupEvents.guid, guids));

      return new Set(rows.map((row) => row.guid));
    },
    catch: (error) =>
      new DatabaseError({
        code: 'MEETUP_EXISTING_GUIDS_FAILED',
        message: 'Failed to check existing Meetup events',
        cause: error,
      }),
  });

const touchExistingEvents = (guids: string[]): Effect.Effect<void, DatabaseError> =>
  Effect.tryPromise({
    try: async () => {
      if (guids.length === 0) return;
      const db = getDb();
      await db
        .update(meetupEvents)
        .set({lastSeenAt: new Date()})
        .where(inArray(meetupEvents.guid, guids));
    },
    catch: (error) =>
      new DatabaseError({
        code: 'MEETUP_TOUCH_EXISTING_FAILED',
        message: 'Failed to update Meetup event last_seen_at',
        cause: error,
      }),
  });

const upsertMeetupEvent = (
  item: MeetupFeedItem,
  details: MeetupEventDetails,
): Effect.Effect<void, DatabaseError> =>
  Effect.tryPromise({
    try: async () => {
      const startDate = new Date(details.startDate);
      const endDate = details.endDate ? new Date(details.endDate) : null;

      if (Number.isNaN(startDate.getTime())) {
        throw new Error(`Invalid startDate ${details.startDate}`);
      }

      const db = getDb();
      await db
        .insert(meetupEvents)
        .values({
          guid: item.guid,
          title: item.title,
          url: item.link,
          startDate,
          endDate: endDate && !Number.isNaN(endDate.getTime()) ? endDate : null,
          location: details.location,
          description: item.description,
          lastSeenAt: new Date(),
        })
        .onConflictDoUpdate({
          target: meetupEvents.guid,
          set: {
            title: item.title,
            url: item.link,
            startDate,
            endDate: endDate && !Number.isNaN(endDate.getTime()) ? endDate : null,
            location: details.location,
            description: item.description,
            lastSeenAt: new Date(),
          },
        });
    },
    catch: (error) =>
      new DatabaseError({
        code: 'MEETUP_EVENT_UPSERT_FAILED',
        message: `Failed to upsert Meetup event ${item.guid}`,
        cause: error,
      }),
  });

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : JSON.stringify(error);

export const runMeetupIngestion: Effect.Effect<
  MeetupIngestResult,
  MeetupFeedError | DatabaseError
> = Effect.gen(function* () {
  const items = yield* fetchFeed;
  const existingGuids = yield* findExistingGuids(items.map((item) => item.guid));
  const existingFeedGuids = items
    .map((item) => item.guid)
    .filter((guid) => existingGuids.has(guid));
  const newItems = items.filter((item) => !existingGuids.has(item.guid));

  yield* touchExistingEvents(existingFeedGuids);

  const results = yield* Effect.forEach(
    newItems,
    (item) =>
      fetchEventDetails(item.link).pipe(
        Effect.flatMap((details) => upsertMeetupEvent(item, details)),
        Effect.as({ok: true as const}),
        Effect.catchAll((error) =>
          Effect.logWarning(
            `Skipping Meetup event ${item.guid} after page/database failure: ${errorMessage(error)}`,
          ).pipe(Effect.as({ok: false as const})),
        ),
      ),
    {concurrency: 2},
  );

  const saved = results.filter((result) => result.ok).length;

  return {
    feedItems: items.length,
    skippedExisting: existingFeedGuids.length,
    saved,
    failed: newItems.length - saved,
  };
});
