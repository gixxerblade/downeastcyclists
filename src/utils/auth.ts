import {cookies} from 'next/headers';

/**
 * Check if the user is authenticated
 * @returns boolean indicating if the user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return !!cookieStore.get('auth-token');
}

/**
 * Get the authentication token
 * @returns the authentication token or null if not authenticated
 */
export async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('auth-token')?.value || null;
}
