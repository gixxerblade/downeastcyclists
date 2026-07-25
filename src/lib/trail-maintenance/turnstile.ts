export interface TurnstileValidationResult {
  readonly ok: boolean;
  readonly reason?: string;
}

interface TurnstileSiteverifyResponse {
  readonly success?: boolean;
  readonly hostname?: string;
  readonly action?: string;
  readonly 'error-codes'?: string[];
}

function getAllowedHostnames(): ReadonlySet<string> {
  return new Set(
    (process.env.CLOUDFLARE_TURNSTILE_ALLOWED_HOSTNAMES ?? '')
      .split(',')
      .map((hostname) => hostname.trim())
      .filter(Boolean),
  );
}

function shouldSkipTurnstile(isProduction: boolean): boolean {
  return !isProduction && process.env.TRAIL_MAINTENANCE_SKIP_TURNSTILE === 'true';
}

export async function verifyTrailMaintenanceTurnstile({
  token,
  remoteIp,
}: {
  readonly token: string | undefined;
  readonly remoteIp: string | null;
}): Promise<TurnstileValidationResult> {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  const isProduction = process.env.NODE_ENV === 'production';

  if (shouldSkipTurnstile(isProduction)) {
    return {ok: true, reason: 'Turnstile skipped in local development'};
  }

  if (!secret) {
    return isProduction
      ? {ok: false, reason: 'Turnstile is not configured'}
      : {ok: true, reason: 'Turnstile skipped outside production'};
  }

  if (!token || token.length > 2048) {
    return {
      ok: false,
      reason: isProduction
        ? 'Bot check did not complete. Reload the page and try again.'
        : 'Bot check did not complete. For local testing, use Cloudflare Turnstile test keys or set TRAIL_MAINTENANCE_SKIP_TURNSTILE=true.',
    };
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });
  if (remoteIp) {
    body.set('remoteip', remoteIp);
  }

  let result: TurnstileSiteverifyResponse;
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return {ok: false, reason: `Turnstile verification failed with ${response.status}`};
    }
    result = (await response.json()) as TurnstileSiteverifyResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Turnstile verification failed';
    return {ok: false, reason: message};
  }

  if (result.success !== true) {
    return {
      ok: false,
      reason: result['error-codes']?.join(', ') || 'Turnstile verification failed',
    };
  }

  const allowedHostnames = getAllowedHostnames();
  if (allowedHostnames.size > 0 && (!result.hostname || !allowedHostnames.has(result.hostname))) {
    return {ok: false, reason: 'Turnstile hostname is not allowed'};
  }

  return {ok: true};
}
