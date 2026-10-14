export function waiverSigningPath(
  options: {
    household?: boolean;
    templateId?: string;
    returnTo?: string;
  } = {},
) {
  const params = new URLSearchParams();
  if (options.household) params.set('household', '1');
  if (options.templateId) params.set('templateId', options.templateId);
  if (options.returnTo) params.set('returnTo', waiverReturnPath(options.returnTo));
  return `/waivers${params.size ? `?${params}` : ''}`;
}

export function waiverReturnPath(value: string | null | undefined): string {
  return value === '/renew' || value === '/dashboard' ? value : '/member';
}

// Only known internal destinations survive password and magic-link login.
export function safeLoginReturnPath(value: string | null | undefined): string | undefined {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return;
  const url = new URL(value, 'https://internal.invalid');
  if (url.pathname === '/waivers') {
    return waiverSigningPath({
      household: url.searchParams.get('household') === '1',
      templateId: url.searchParams.get('templateId') ?? undefined,
      returnTo: url.searchParams.get('returnTo') ?? undefined,
    });
  }
  if (value === '/renew' || value === '/member' || value === '/dashboard') return value;
}

export function loginReturnPathFromUrl(value: string): string | undefined {
  const url = new URL(value);
  const direct = safeLoginReturnPath(url.searchParams.get('returnTo'));
  if (direct) return direct;
  const continuation = url.searchParams.get('continueUrl');
  if (!continuation) return;
  try {
    return safeLoginReturnPath(new URL(continuation).searchParams.get('returnTo'));
  } catch {
    return;
  }
}
