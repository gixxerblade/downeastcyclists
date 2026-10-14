import {Effect} from 'effect';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {DatabaseService} from '@/src/lib/effect/database.service';
import {ensureMemberProfile} from '@/src/lib/effect/membership.service';

import {createTestDatabaseService} from '../layers/test-layers';
import {createMockUserDocument} from '../mocks/database.mock';

const database = createTestDatabaseService();
function ensure(identity: {uid: string; email?: string}, name?: string) {
  return Effect.runPromise(
    ensureMemberProfile(identity, name).pipe(Effect.provideService(DatabaseService, database)),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('ADMIN_EMAIL', 'system@example.test');
  vi.mocked(database.getUser).mockReturnValue(Effect.succeed(null));
});
afterEach(() => vi.unstubAllEnvs());

describe('personal member profile recovery', () => {
  it('lets the system account establish a session without creating or loading a member profile', async () => {
    expect(await ensure({uid: 'system', email: ' SYSTEM@example.test '})).toEqual({
      success: true,
      userId: 'system',
    });
    expect(database.getUser).not.toHaveBeenCalled();
    expect(database.setUser).not.toHaveBeenCalled();
  });

  it('still creates a missing profile for a person after interrupted signup', async () => {
    await ensure({uid: 'rider', email: 'rider@example.test'}, 'Alex Rider');
    expect(database.setUser).toHaveBeenCalledWith(
      'rider',
      expect.objectContaining({id: 'rider', email: 'rider@example.test', name: 'Alex Rider'}),
      true,
    );
  });

  it('preserves an existing organizer profile and its role', async () => {
    vi.mocked(database.getUser).mockReturnValue(
      Effect.succeed(createMockUserDocument({id: 'organizer', isOrganizer: true})),
    );
    await ensure({uid: 'organizer', email: 'rider@example.test'});
    expect(database.getUser).toHaveBeenCalledWith('organizer');
    expect(database.setUser).not.toHaveBeenCalled();
  });
});
