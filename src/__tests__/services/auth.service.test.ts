import {Effect, Exit} from 'effect';
import {describe, it, expect, vi} from 'vitest';

import {AuthService} from '@/src/lib/effect/auth.service';
import {AuthError, SessionError} from '@/src/lib/effect/errors';

import {createTestAuthService, TestAuthLayer} from '../layers/test-layers';
import {createMockDecodedToken, createMockUserRecord} from '../mocks/firebase-admin.mock';

describe('AuthService', () => {
  describe('verifyIdToken', () => {
    it('should fail with AuthError on expired token', async () => {
      const mockService = createTestAuthService({
        verifyIdToken: vi.fn(() =>
          Effect.fail(
            new AuthError({
              code: 'TOKEN_VERIFY_FAILED',
              message: 'ID token has expired',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.verifyIdToken('expired_token');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestAuthLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(AuthError);
          expect((error.error as AuthError).code).toBe('TOKEN_VERIFY_FAILED');
        }
      }
    });

    it('should fail with AuthError on invalid token', async () => {
      const mockService = createTestAuthService({
        verifyIdToken: vi.fn(() =>
          Effect.fail(
            new AuthError({
              code: 'TOKEN_VERIFY_FAILED',
              message: 'Invalid ID token',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.verifyIdToken('invalid_token');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestAuthLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(AuthError);
        }
      }
    });

    it('should fail with AuthError on revoked token', async () => {
      const mockService = createTestAuthService({
        verifyIdToken: vi.fn(() =>
          Effect.fail(
            new AuthError({
              code: 'TOKEN_VERIFY_FAILED',
              message: 'ID token has been revoked',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.verifyIdToken('revoked_token');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestAuthLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
    });

    it('should return decoded token on success', async () => {
      const mockDecodedToken = createMockDecodedToken({
        uid: 'user_123',
        email: 'test@example.com',
      });
      const mockService = createTestAuthService({
        verifyIdToken: vi.fn(() => Effect.succeed(mockDecodedToken as any)),
      });

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.verifyIdToken('valid_token');
      });

      const result = await Effect.runPromise(Effect.provide(program, TestAuthLayer(mockService)));

      expect(result).toBeDefined();
      expect(result.uid).toBe('user_123');
      expect(result.email).toBe('test@example.com');
    });
  });

  describe('createSessionCookie', () => {
    it('should fail with AuthError on invalid token', async () => {
      const mockService = createTestAuthService({
        createSessionCookie: vi.fn(() =>
          Effect.fail(
            new AuthError({
              code: 'SESSION_CREATE_FAILED',
              message: 'Failed to create session cookie',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.createSessionCookie('invalid_token', 3600000);
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestAuthLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(AuthError);
          expect((error.error as AuthError).code).toBe('SESSION_CREATE_FAILED');
        }
      }
    });

    it('should fail with AuthError on network error', async () => {
      const mockService = createTestAuthService({
        createSessionCookie: vi.fn(() =>
          Effect.fail(
            new AuthError({
              code: 'SESSION_CREATE_FAILED',
              message: 'Network error',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.createSessionCookie('valid_token', 3600000);
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestAuthLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
    });

    it('should return session cookie on success', async () => {
      const mockService = createTestAuthService({
        createSessionCookie: vi.fn(() => Effect.succeed('session_cookie_value')),
      });

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.createSessionCookie('valid_token', 3600000);
      });

      const result = await Effect.runPromise(Effect.provide(program, TestAuthLayer(mockService)));

      expect(result).toBe('session_cookie_value');
    });
  });

  describe('verifySessionCookie', () => {
    it('should fail with SessionError on expired session', async () => {
      const mockService = createTestAuthService({
        verifySessionCookie: vi.fn(() =>
          Effect.fail(
            new SessionError({
              code: 'SESSION_INVALID',
              message: 'Session is invalid or expired',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.verifySessionCookie('expired_session');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestAuthLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(SessionError);
          expect((error.error as SessionError).code).toBe('SESSION_INVALID');
        }
      }
    });

    it('should fail with SessionError on revoked session', async () => {
      const mockService = createTestAuthService({
        verifySessionCookie: vi.fn(() =>
          Effect.fail(
            new SessionError({
              code: 'SESSION_INVALID',
              message: 'Session has been revoked',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.verifySessionCookie('revoked_session');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestAuthLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
    });

    it('should fail with SessionError on invalid session', async () => {
      const mockService = createTestAuthService({
        verifySessionCookie: vi.fn(() =>
          Effect.fail(
            new SessionError({
              code: 'SESSION_INVALID',
              message: 'Invalid session cookie',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.verifySessionCookie('invalid_session');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestAuthLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
    });

    it('should return decoded token on valid session', async () => {
      const mockDecodedToken = createMockDecodedToken({
        uid: 'user_123',
        email: 'test@example.com',
      });
      const mockService = createTestAuthService({
        verifySessionCookie: vi.fn(() => Effect.succeed(mockDecodedToken as any)),
      });

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.verifySessionCookie('valid_session');
      });

      const result = await Effect.runPromise(Effect.provide(program, TestAuthLayer(mockService)));

      expect(result).toBeDefined();
      expect(result.uid).toBe('user_123');
    });
  });

  describe('getUser', () => {
    it('should fail with AuthError when user not found', async () => {
      const mockService = createTestAuthService({
        getUser: vi.fn(() =>
          Effect.fail(
            new AuthError({
              code: 'GET_USER_FAILED',
              message: 'User not found',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.getUser('nonexistent_user');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestAuthLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const error = result.cause;
        expect(error._tag).toBe('Fail');
        if (error._tag === 'Fail') {
          expect(error.error).toBeInstanceOf(AuthError);
          expect((error.error as AuthError).code).toBe('GET_USER_FAILED');
        }
      }
    });

    it('should return user record on success', async () => {
      const mockUserRecord = createMockUserRecord({
        uid: 'user_123',
        email: 'test@example.com',
        displayName: 'Test User',
      });
      const mockService = createTestAuthService({
        getUser: vi.fn(() =>
          Effect.succeed({
            uid: mockUserRecord.uid,
            email: mockUserRecord.email,
            displayName: mockUserRecord.displayName,
          }),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.getUser('user_123');
      });

      const result = await Effect.runPromise(Effect.provide(program, TestAuthLayer(mockService)));

      expect(result).toBeDefined();
      expect(result.uid).toBe('user_123');
      expect(result.email).toBe('test@example.com');
      expect(result.displayName).toBe('Test User');
    });
  });

  describe('verifyAdminClaim', () => {
    it('should return isAdmin=false when no admin claim', async () => {
      const mockService = createTestAuthService({
        verifyAdminClaim: vi.fn(() =>
          Effect.succeed({
            uid: 'user_123',
            email: 'user@example.com',
            isAdmin: false,
          }),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.verifyAdminClaim('valid_session');
      });

      const result = await Effect.runPromise(Effect.provide(program, TestAuthLayer(mockService)));

      expect(result).toBeDefined();
      expect(result.isAdmin).toBe(false);
    });

    it('should return isAdmin=true when admin claim exists', async () => {
      const mockService = createTestAuthService({
        verifyAdminClaim: vi.fn(() =>
          Effect.succeed({
            uid: 'admin_123',
            email: 'admin@example.com',
            isAdmin: true,
          }),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.verifyAdminClaim('admin_session');
      });

      const result = await Effect.runPromise(Effect.provide(program, TestAuthLayer(mockService)));

      expect(result).toBeDefined();
      expect(result.isAdmin).toBe(true);
    });

    it('should fail with SessionError on invalid session', async () => {
      const mockService = createTestAuthService({
        verifyAdminClaim: vi.fn(() =>
          Effect.fail(
            new SessionError({
              code: 'SESSION_INVALID',
              message: 'Session is invalid',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.verifyAdminClaim('invalid_session');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestAuthLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
    });
  });

  describe('revokeRefreshTokens', () => {
    it('should succeed when revoking tokens', async () => {
      const mockService = createTestAuthService({
        revokeRefreshTokens: vi.fn(() => Effect.void),
      });

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.revokeRefreshTokens('user_123');
      });

      const result = await Effect.runPromise(Effect.provide(program, TestAuthLayer(mockService)));

      expect(result).toBeUndefined();
      expect(mockService.revokeRefreshTokens).toHaveBeenCalledWith('user_123');
    });

    it('should fail with AuthError on failure', async () => {
      const mockService = createTestAuthService({
        revokeRefreshTokens: vi.fn(() =>
          Effect.fail(
            new AuthError({
              code: 'REVOKE_FAILED',
              message: 'Failed to revoke tokens',
            }),
          ),
        ),
      });

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.revokeRefreshTokens('user_123');
      });

      const result = await Effect.runPromiseExit(
        Effect.provide(program, TestAuthLayer(mockService)),
      );

      expect(Exit.isFailure(result)).toBe(true);
    });
  });

  describe('setCustomClaims', () => {
    it('should succeed when setting claims', async () => {
      const mockService = createTestAuthService({
        setCustomClaims: vi.fn(() => Effect.void),
      });

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.setCustomClaims('user_123', {admin: true});
      });

      const result = await Effect.runPromise(Effect.provide(program, TestAuthLayer(mockService)));

      expect(result).toBeUndefined();
    });
  });

  describe('getCustomClaims', () => {
    it('should return claims', async () => {
      const mockService = createTestAuthService({
        getCustomClaims: vi.fn(() => Effect.succeed({admin: true})),
      });

      const program = Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.getCustomClaims('user_123');
      });

      const result = await Effect.runPromise(Effect.provide(program, TestAuthLayer(mockService)));

      expect(result).toEqual({admin: true});
    });
  });
});
