import {createRenewalToken} from './renewal-token';
import {getSiteUrl} from './site-url';

export function buildRenewalUrl(userId: string) {
  const url = new URL('/renew', getSiteUrl());
  url.searchParams.set('token', createRenewalToken(userId));
  return url.toString();
}
