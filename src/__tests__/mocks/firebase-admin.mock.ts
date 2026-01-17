import {vi} from 'vitest';

export const createMockAuth = () => ({
  verifyIdToken: vi.fn(),
  createSessionCookie: vi.fn(),
  verifySessionCookie: vi.fn(),
  revokeRefreshTokens: vi.fn(),
  getUser: vi.fn(),
  setCustomUserClaims: vi.fn(),
});

// Firebase Auth error codes
export type FirebaseAuthErrorCode =
  | 'auth/email-already-in-use'
  | 'auth/weak-password'
  | 'auth/invalid-email'
  | 'auth/id-token-expired'
  | 'auth/id-token-revoked'
  | 'auth/session-cookie-expired'
  | 'auth/session-cookie-revoked'
  | 'auth/user-not-found';

export const createAuthError = (code: FirebaseAuthErrorCode, message: string) => {
  const error = new Error(message) as Error & {code: string};
  error.code = code;
  return error;
};

export const emailInUseError = () =>
  createAuthError('auth/email-already-in-use', 'Email already in use');

export const weakPasswordError = () =>
  createAuthError('auth/weak-password', 'Password is too weak');

export const tokenExpiredError = () =>
  createAuthError('auth/id-token-expired', 'ID token has expired');

export const tokenRevokedError = () =>
  createAuthError('auth/id-token-revoked', 'ID token has been revoked');

export const sessionExpiredError = () =>
  createAuthError('auth/session-cookie-expired', 'Session cookie has expired');

export const sessionRevokedError = () =>
  createAuthError('auth/session-cookie-revoked', 'Session has been revoked');

export const userNotFoundError = () => createAuthError('auth/user-not-found', 'User not found');

// Mock decoded token
export interface MockDecodedToken {
  uid: string;
  email?: string;
  email_verified?: boolean;
  admin?: boolean;
}

export const createMockDecodedToken = (
  overrides: Partial<MockDecodedToken> = {},
): MockDecodedToken => ({
  uid: 'user_123',
  email: 'test@example.com',
  email_verified: true,
  admin: false,
  ...overrides,
});

// Mock user record
export interface MockUserRecord {
  uid: string;
  email?: string;
  displayName?: string;
  customClaims?: Record<string, unknown>;
}

export const createMockUserRecord = (overrides: Partial<MockUserRecord> = {}): MockUserRecord => ({
  uid: 'user_123',
  email: 'test@example.com',
  displayName: 'Test User',
  customClaims: {admin: false},
  ...overrides,
});
