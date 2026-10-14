/** Local provider endpoints are opt-in, loopback-only, and forbidden in production. */
export function localTestEndpoint(
  value: string | undefined,
  nodeEnv: string | undefined,
): URL | null {
  if (!value) return null;
  if (nodeEnv !== 'development' && nodeEnv !== 'test') {
    throw new Error('Local test providers are only available in development or tests');
  }
  const url = new URL(value);
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.username ||
    url.password
  ) {
    throw new Error('Local test providers must use an HTTP loopback address');
  }
  return url;
}

export function authEmulatorProject(projectId: string | undefined): string {
  if (!projectId?.startsWith('demo-')) {
    throw new Error('Local authentication requires a demo- Firebase project, never a live project');
  }
  return projectId;
}

export const LOCAL_TEST_DATABASE_URL = 'postgresql://local:local@127.0.0.1/dec_waiver_test';
