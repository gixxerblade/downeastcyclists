import type {NextRequest} from 'next/server';

export function getTrustedClientIdentifier(request: NextRequest): string {
  const netlifyClientIp = request.headers.get('x-nf-client-connection-ip')?.trim();
  if (netlifyClientIp) {
    return `ip:${netlifyClientIp}`;
  }

  const forwardedClientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwardedClientIp) {
    return `ip:${forwardedClientIp}`;
  }

  const userAgent = request.headers.get('user-agent')?.slice(0, 256) || 'unknown';
  return `fallback:${userAgent}`;
}
