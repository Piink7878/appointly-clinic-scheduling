// ==============================================================================
// Appointly Server — Unit Tests: PII-Safe Logging, Envelopes & UUID Validation
// ==============================================================================
// Reference: System-Level SDS Sections 5.3 (envelopes), 7.2 (PII-safe logging, NFR-006);
//            Sprint 1 Contracts Section 3.1 (unit tier)
// ==============================================================================

import { describe, it, expect, vi } from 'vitest';
import type { Response } from 'express';
import { sanitizeLogData } from '../../../src/shared/utils/logger';
import { sendError, sendSuccess } from '../../../src/shared/utils/response';
import { isValidUuid } from '../../../src/shared/utils/uuid';

describe('sanitizeLogData — secrets and tokens never reach the logs', () => {
  it('redacts sensitive keys at any depth, whatever their casing or separators', () => {
    const out = sanitizeLogData({
      email: 'a@b.co',
      password: 'hunter2',
      user: { passwordHash: '$argon2id$…', Refresh_Token: 'r', nested: [{ 'access-token': 'a', api_key: 'k' }] },
    }) as Record<string, any>;

    expect(out.email).toBe('a@b.co'); // not a secret
    expect(out.password).toBe('[REDACTED]');
    expect(out.user.passwordHash).toBe('[REDACTED]');
    expect(out.user.Refresh_Token).toBe('[REDACTED]');
    expect(out.user.nested[0]['access-token']).toBe('[REDACTED]');
    expect(out.user.nested[0].api_key).toBe('[REDACTED]');
  });

  it('masks bearer tokens inside strings and error messages', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxIn0.c2lnbmF0dXJl';
    expect(sanitizeLogData(`Authorization: Bearer ${jwt}`)).toBe('Authorization: Bearer [REDACTED]');
    const err = sanitizeLogData(new Error(`bad header Bearer ${jwt}`)) as { message: string };
    expect(err.message).toBe('bad header Bearer [REDACTED]');
    expect(JSON.stringify(err)).not.toContain(jwt);
  });

  it('survives circular structures, dates, null and primitives', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a.self = a;
    expect((sanitizeLogData(a) as Record<string, unknown>).self).toBe('[Circular]');
    expect(sanitizeLogData(new Date('2026-11-14T00:00:00Z'))).toBe('2026-11-14T00:00:00.000Z');
    expect(sanitizeLogData(null)).toBeNull();
    expect(sanitizeLogData(undefined)).toBeUndefined();
    expect(sanitizeLogData(42)).toBe(42);
  });

  it('does not mutate its input', () => {
    const input = { password: 'x', list: [{ token: 't' }] };
    sanitizeLogData(input);
    expect(input).toEqual({ password: 'x', list: [{ token: 't' }] });
  });
});

describe('response envelopes (SDS 5.3)', () => {
  const fake = () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    return { res: res as unknown as Response, spy: res };
  };

  it('sendSuccess answers { success: true, data, message } with the given status', () => {
    const { res, spy } = fake();
    sendSuccess(res, { id: 1 }, 'Created.', 201);
    expect(spy.status).toHaveBeenCalledWith(201);
    expect(spy.json).toHaveBeenCalledWith({ success: true, data: { id: 1 }, message: 'Created.' });
  });

  it('sendSuccess defaults to 200 and keeps an explicit null payload but omits an undefined one', () => {
    const withNull = fake();
    sendSuccess(withNull.res, null, 'Logged out.');
    expect(withNull.spy.status).toHaveBeenCalledWith(200);
    expect(withNull.spy.json).toHaveBeenCalledWith({ success: true, data: null, message: 'Logged out.' });

    const withNothing = fake();
    sendSuccess(withNothing.res);
    expect(withNothing.spy.json).toHaveBeenCalledWith({ success: true });
  });

  it('sendError answers exactly { success: false, error: { code, message } }', () => {
    const { res, spy } = fake();
    sendError(res, 409, 'DUPLICATE_ASSIGNMENT', 'Doctor is already assigned.');
    expect(spy.status).toHaveBeenCalledWith(409);
    expect(spy.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'DUPLICATE_ASSIGNMENT', message: 'Doctor is already assigned.' },
    });
  });
});

describe('isValidUuid — one strict check for every identifier', () => {
  it.each([
    '00000000-0000-4000-8000-000000000000',
    '550e8400-e29b-41d4-a716-446655440000',
    '550E8400-E29B-41D4-A716-446655440000',
  ])('accepts %s', (id) => {
    expect(isValidUuid(id)).toBe(true);
  });

  it.each([
    '',
    'not-a-uuid',
    ' 550e8400-e29b-41d4-a716-446655440000', // padded: would be rejected by PostgreSQL after a "trimmed" check
    '550e8400-e29b-41d4-a716-446655440000 ',
    '550e8400-e29b-41d4-a716-44665544000', // too short
    '550e8400-e29b-61d4-a716-446655440000', // bad version
    '550e8400-e29b-41d4-c716-446655440000', // bad variant
    "550e8400'; DROP TABLE users;--",
  ])('rejects %j', (id) => {
    expect(isValidUuid(id)).toBe(false);
  });

  it('rejects non-strings', () => {
    for (const value of [null, undefined, 42, {}, [], ['550e8400-e29b-41d4-a716-446655440000']]) {
      expect(isValidUuid(value)).toBe(false);
    }
  });
});
