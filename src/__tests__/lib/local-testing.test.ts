import {describe, expect, it} from 'vitest';

import {authEmulatorProject, localTestEndpoint} from '@/src/lib/local-testing';

describe('isolated local providers', () => {
  it('leaves normal production providers unchanged when not opted in', () => {
    expect(localTestEndpoint(undefined, 'production')).toBeNull();
  });

  it.each(['production', undefined])('rejects overrides outside development/test (%s)', (env) => {
    expect(() => localTestEndpoint('http://127.0.0.1:4311', env)).toThrow();
  });

  it.each([
    'https://127.0.0.1:4311',
    'http://example.com',
    'http://localhost.example.com',
    'http://127.0.0.1@example.com',
    'http://user:password@localhost:4311',
  ])('rejects unsafe provider address %s', (address) => {
    expect(() => localTestEndpoint(address, 'development')).toThrow();
  });

  it.each(['http://127.0.0.1:4311/sql', 'http://localhost:9099'])(
    'accepts loopback %s',
    (address) => {
      expect(localTestEndpoint(address, 'test')?.toString()).toBe(new URL(address).toString());
    },
  );

  it('requires a demo authentication project', () => {
    expect(authEmulatorProject('demo-dec-waivers')).toBe('demo-dec-waivers');
    expect(() => authEmulatorProject('dec-production')).toThrow();
    expect(() => authEmulatorProject(undefined)).toThrow();
  });
});
