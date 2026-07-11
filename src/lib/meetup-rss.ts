export interface MeetupRide {
  title: string;
  link: string;
  date: string;
  meta: string;
}

const meetupFeedUrl = 'https://www.meetup.com/down-east-cyclists/events/rss';

const decodeXml = (value: string) =>
  value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

const tagValue = (item: string, tag: string) => {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
};

export async function getUpcomingMeetupRides(): Promise<MeetupRide[]> {
  try {
    const response = await fetch(meetupFeedUrl, {
      next: {revalidate: 60 * 20},
      headers: {
        Accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8',
      },
    });

    if (!response.ok) return [];

    const xml = await response.text();
    const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

    return itemMatches
      .map((item) => {
        const title = tagValue(item, 'title');
        const link = tagValue(item, 'link');
        const date = tagValue(item, 'pubDate');
        const parsedDate = date ? new Date(date) : null;
        const meta = parsedDate
          ? parsedDate.toLocaleString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })
          : 'Details on Meetup';

        return {title, link, date, meta};
      })
      .filter((ride) => ride.title && ride.link)
      .slice(0, 5);
  } catch (error) {
    console.error('Failed to fetch Meetup RSS feed:', error);
    return [];
  }
}
