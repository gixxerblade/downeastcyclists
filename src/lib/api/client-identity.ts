import type {NextRequest} from 'next/server';

export function getTrustedClientIp(request: NextRequest): string | null {
  const netlifyClientIp = request.headers.get('x-nf-client-connection-ip')?.trim();
  if (netlifyClientIp) {
    return netlifyClientIp;
  }

  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
}

export function getTrustedClientIdentifier(request: NextRequest): string {
  const clientIp = getTrustedClientIp(request);
  if (clientIp) return `ip:${clientIp}`;

  const userAgent = request.headers.get('user-agent')?.slice(0, 256) || 'unknown';
  return `fallback:${userAgent}`;
}
