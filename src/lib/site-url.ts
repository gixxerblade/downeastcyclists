export function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}
