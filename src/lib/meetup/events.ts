import {asc, gt} from 'drizzle-orm';
import {unstable_cache} from 'next/cache';

import {meetupEvents} from '@/src/db/schema/tables';

export interface UpcomingMeetupRide {
  readonly title: string;
  readonly link: string;
  readonly date: string;
  readonly meta: string;
  readonly location: string | null;
}

function getDb() {
  return (require('@/src/db/client') as typeof import('@/src/db/client')).db;
}

const formatRideMeta = (date: Date, location: string | null) => {
  const formattedDate = date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return location ? `${formattedDate} · ${location}` : formattedDate;
};

const FOUR_HOURS_IN_SECONDS = 60 * 60 * 4;

const getUpcomingMeetupRidesCached = unstable_cache(
  async (limit: number): Promise<UpcomingMeetupRide[]> => {
    try {
      const db = getDb();
      const rows = await db
        .select({
          title: meetupEvents.title,
          link: meetupEvents.url,
          startDate: meetupEvents.startDate,
          location: meetupEvents.location,
        })
        .from(meetupEvents)
        .where(gt(meetupEvents.startDate, new Date()))
        .orderBy(asc(meetupEvents.startDate))
        .limit(limit);

      return rows.map((row) => ({
        title: row.title,
        link: row.link,
        date: row.startDate.toISOString(),
        meta: formatRideMeta(row.startDate, row.location),
        location: row.location,
      }));
    } catch (error) {
      console.error('Failed to load upcoming Meetup rides from Neon:', error);
      return [];
    }
  },
  ['upcoming-meetup-rides'],
  {
    revalidate: FOUR_HOURS_IN_SECONDS,
  },
);

export async function getUpcomingMeetupRides(limit = 5): Promise<UpcomingMeetupRide[]> {
  return getUpcomingMeetupRidesCached(limit);
}
