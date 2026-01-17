import {cookies} from 'next/headers';

/**
 * Check if the user is authenticated
 * @returns boolean indicating if the user is authenticated
 */
export function isAuthenticated(): boolean {
  const cookieStore = cookies();
  return !!cookieStore.get('auth-token');
}

/**
 * Get the authentication token
 * @returns the authentication token or null if not authenticated
 */
export function getAuthToken(): string | null {
  const cookieStore = cookies();
  return cookieStore.get('auth-token')?.value || null;
}
