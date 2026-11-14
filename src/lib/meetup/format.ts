// Club rides are advertised in Eastern time, independent of the server timezone.
const RIDE_TIME_ZONE = 'America/New_York';

export function formatRideMeta(date: Date, location: string | null): string {
  const formattedDate = date.toLocaleString('en-US', {
    timeZone: RIDE_TIME_ZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return location ? `${formattedDate} · ${location}` : formattedDate;
}

export function formatRideDateBadge(date: Date) {
  const format = (options: Intl.DateTimeFormatOptions) =>
    date.toLocaleDateString('en-US', {...options, timeZone: RIDE_TIME_ZONE});
  return {
    weekday: format({weekday: 'short'}),
    day: format({day: 'numeric'}),
    month: format({month: 'short'}),
  };
}
