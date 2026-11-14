// ==============================================================================
// Appointly Server — Unit Tests: Login Brute-Force Limiter
// ==============================================================================
// Reference: System-Level SDS Section 7.1 (IP and account-based rate limiting);
//            Sprint 1 Contracts AC-F001-02
// A fake clock drives the sliding window; no HTTP, no database.
// ==============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import type { Request } from 'express';
import { LoginRateLimiter, accountKeyOf } from '../../../src/shared/middleware/loginRateLimiter';

const MINUTE = 60_000;

describe('LoginRateLimiter', () => {
  let clock = 0;
  let limiter: LoginRateLimiter;

  beforeEach(() => {
    clock = 1_000_000;
    limiter = new LoginRateLimiter({ windowMs: 15 * MINUTE, maxPerAccount: 3, maxPerIp: 5, now: () => clock });
  });

  const fail = (ip: string, account: string | null, times = 1) => {
    for (let i = 0; i < times; i += 1) limiter.recordFailure(ip, account);
  };

  it('lets a fresh visitor in', () => {
    expect(limiter.check('1.1.1.1', 'a@b.co')).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it('blocks an account after its limit of failures — from any IP', () => {
    fail('1.1.1.1', 'a@b.co', 2);
    expect(limiter.check('1.1.1.1', 'a@b.co').allowed).toBe(true); // 2 of 3
    fail('1.1.1.1', 'a@b.co');
    expect(limiter.check('1.1.1.1', 'a@b.co').allowed).toBe(false); // 3 of 3
    expect(limiter.check('9.9.9.9', 'a@b.co').allowed).toBe(false); // an attacker rotating IPs is still stopped
    expect(limiter.check('1.1.1.1', 'other@b.co').allowed).toBe(true); // other accounts unaffected
  });

  it('blocks an IP after its limit — whichever accounts it tries (password spraying)', () => {
    for (let i = 0; i < 5; i += 1) fail('2.2.2.2', `user${i}@b.co`); // 1 failure per account, 5 from the IP
    expect(limiter.check('2.2.2.2', 'fresh@b.co').allowed).toBe(false);
    expect(limiter.check('3.3.3.3', 'fresh@b.co').allowed).toBe(true);
  });

  it('reports how long to wait and unblocks when the window has passed', () => {
    fail('1.1.1.1', 'a@b.co', 3);
    const blocked = limiter.check('1.1.1.1', 'a@b.co');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(15 * 60);

    clock += 10 * MINUTE;
    expect(limiter.check('1.1.1.1', 'a@b.co').retryAfterSeconds).toBe(5 * 60);

    clock += 5 * MINUTE;
    expect(limiter.check('1.1.1.1', 'a@b.co').allowed).toBe(true);
  });

  it('is a sliding window: old failures age out one by one', () => {
    fail('1.1.1.1', 'a@b.co'); // t0
    clock += 6 * MINUTE;
    fail('1.1.1.1', 'a@b.co'); // t0+6
    clock += 6 * MINUTE;
    fail('1.1.1.1', 'a@b.co'); // t0+12 -> 3 in the window
    expect(limiter.check('1.1.1.1', 'a@b.co').allowed).toBe(false);

    clock += 4 * MINUTE; // t0+16: the first failure has expired
    expect(limiter.check('1.1.1.1', 'a@b.co').allowed).toBe(true);
  });

  it('a successful sign-in clears the account but not the IP history', () => {
    fail('1.1.1.1', 'a@b.co', 2);
    limiter.recordSuccess('a@b.co');
    fail('1.1.1.1', 'a@b.co', 2);
    expect(limiter.check('1.1.1.1', 'a@b.co').allowed).toBe(true); // account counter restarted from 0

    fail('1.1.1.1', 'x@b.co'); // the IP is now at 5 failures overall
    expect(limiter.check('1.1.1.1', 'new@b.co').allowed).toBe(false);
  });

  it('works without an account key (non-text e-mail): only the IP counts', () => {
    fail('1.1.1.1', null, 5);
    expect(limiter.check('1.1.1.1', null).allowed).toBe(false);
    expect(limiter.check('1.1.1.1', 'a@b.co').allowed).toBe(false); // IP is blocked for everyone
  });

  it('keeps memory bounded under a flood of distinct keys', () => {
    const small = new LoginRateLimiter({ windowMs: 15 * MINUTE, maxPerAccount: 3, maxPerIp: 5, now: () => clock, maxKeys: 50 });
    for (let i = 0; i < 500; i += 1) small.recordFailure(`10.0.${Math.floor(i / 250)}.${i % 250}`, `user${i}@b.co`);
    expect((small as unknown as { failures: Map<string, number[]> }).failures.size).toBeLessThanOrEqual(52);
  });

  it('reset() forgets everything', () => {
    fail('1.1.1.1', 'a@b.co', 3);
    limiter.reset();
    expect(limiter.check('1.1.1.1', 'a@b.co').allowed).toBe(true);
  });
});

describe('accountKeyOf', () => {
  const req = (body: unknown) => ({ body }) as unknown as Request;

  it('normalises the e-mail the same way the login service does', () => {
    expect(accountKeyOf(req({ email: '  Admin@Appointly.LOCAL ' }))).toBe('admin@appointly.local');
  });

  it.each([undefined, null, {}, { email: 5 }, { email: ['a@b.co'] }, { email: '' }, { email: '   ' }, { email: 'a'.repeat(300) }])(
    'gives no key for %j',
    (body) => {
      expect(accountKeyOf(req(body))).toBeNull();
    }
  );
});
