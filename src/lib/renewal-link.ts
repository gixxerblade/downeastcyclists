import {getSiteUrl} from './site-url';

export function buildRenewalUrl(userId: string) {
  const url = new URL('/renew', getSiteUrl());
  url.searchParams.set('userId', userId);
  return url.toString();
}
