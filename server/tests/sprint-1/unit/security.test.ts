// ==============================================================================
// Appointly Server — Unit Tests: Password Hashing, JWT & Session Cookies
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.1 (F-001), 3.1 (unit tier: "Argon2id password
//            hashing/verification, JWT cookie signing/expiry"); SDS Section 7.1
// Pure functions only — no database, no HTTP.
// ==============================================================================

import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { config } from '../../../src/shared/config';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_MS,
  clearAuthCookies,
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
  hashRefreshToken,
  setAuthCookies,
  verifyAccessToken,
  verifyPassword,
  verifyRefreshToken,
} from '../../../src/shared/utils/security';

const payload = { userId: '11111111-1111-4111-8111-111111111111', email: 'doctor@appointly.local', role: 'DOCTOR' as const };

describe('Argon2id password hashing', () => {
  it('produces an Argon2id hash that does not contain the password', async () => {
    const hash = await hashPassword('ChangeMe123!');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('ChangeMe123!');
  });

  it('salts every hash: hashing the same password twice gives different hashes that both verify', async () => {
    const [a, b] = await Promise.all([hashPassword('same-password'), hashPassword('same-password')]);
    expect(a).not.toBe(b);
    expect(await verifyPassword(a, 'same-password')).toBe(true);
    expect(await verifyPassword(b, 'same-password')).toBe(true);
  });

  it('verifies the right password and rejects the wrong one (case-sensitive)', async () => {
    const hash = await hashPassword('Correct Horse 9!');
    expect(await verifyPassword(hash, 'Correct Horse 9!')).toBe(true);
    expect(await verifyPassword(hash, 'correct horse 9!')).toBe(false);
    expect(await verifyPassword(hash, '')).toBe(false);
  });

  it('treats a malformed or empty stored hash as "does not match" instead of throwing', async () => {
    expect(await verifyPassword('not-a-hash', 'x')).toBe(false);
    expect(await verifyPassword('', 'x')).toBe(false);
  });
});

describe('JWT access and refresh tokens', () => {
  it('round-trips the identity claims', () => {
    expect(verifyAccessToken(generateAccessToken(payload))).toEqual(payload);
    expect(verifyRefreshToken(generateRefreshToken(payload))).toEqual(payload);
  });

  it('access token lives 15 minutes and refresh token 7 days (SDS 7.1)', () => {
    const access = jwt.decode(generateAccessToken(payload)) as { iat: number; exp: number };
    const refresh = jwt.decode(generateRefreshToken(payload)) as { iat: number; exp: number };
    expect((access.exp - access.iat) * 1000).toBe(ACCESS_TOKEN_TTL_MS);
    expect((refresh.exp - refresh.iat) * 1000).toBe(REFRESH_TOKEN_TTL_MS);
    expect(ACCESS_TOKEN_TTL_MS).toBe(15 * 60 * 1000);
    expect(REFRESH_TOKEN_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('never puts a password or hash in the token', () => {
    const decoded = jwt.decode(generateAccessToken(payload)) as Record<string, unknown>;
    expect(Object.keys(decoded).sort()).toEqual(['email', 'exp', 'iat', 'role', 'userId']);
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign(payload, config.jwtAccessSecret, { expiresIn: -10 });
    expect(() => verifyAccessToken(expired)).toThrow(/expired/i);
  });

  it('rejects a tampered token', () => {
    const [header, body, signature] = generateAccessToken(payload).split('.');
    const forgedBody = Buffer.from(JSON.stringify({ ...payload, role: 'ADMIN' })).toString('base64url');
    expect(() => verifyAccessToken(`${header}.${forgedBody}.${signature}`)).toThrow();
    expect(() => verifyAccessToken(`${header}.${body}.${signature}x`)).toThrow();
  });

  it('keeps the two token kinds apart: a refresh token is not an access token and vice versa', () => {
    expect(() => verifyAccessToken(generateRefreshToken(payload))).toThrow();
    expect(() => verifyRefreshToken(generateAccessToken(payload))).toThrow();
  });

  it('rejects garbage and the "none" algorithm', () => {
    expect(() => verifyAccessToken('garbage')).toThrow();
    const unsigned = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.`;
    expect(() => verifyAccessToken(unsigned)).toThrow();
  });
});

describe('refresh-token hashing (stored instead of the token itself)', () => {
  it('is a deterministic SHA-256 hex digest that differs per token', () => {
    const token = generateRefreshToken(payload);
    expect(hashRefreshToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
    expect(hashRefreshToken(token)).not.toBe(hashRefreshToken(`${token}x`));
    expect(hashRefreshToken(token)).not.toContain(token);
  });
});

describe('session cookies (HttpOnly; SameSite=Strict)', () => {
  const fakeResponse = () => {
    const res = { cookie: vi.fn(), clearCookie: vi.fn() };
    return { res: res as unknown as Response, spy: res };
  };

  it('sets both cookies HttpOnly + SameSite=Strict with their lifetimes', () => {
    const { res, spy } = fakeResponse();
    setAuthCookies(res, 'access-jwt', 'refresh-jwt');

    expect(spy.cookie).toHaveBeenCalledTimes(2);
    const [[accessName, accessValue, accessOptions], [refreshName, refreshValue, refreshOptions]] = spy.cookie.mock.calls;
    expect([accessName, accessValue]).toEqual([ACCESS_TOKEN_COOKIE, 'access-jwt']);
    expect([refreshName, refreshValue]).toEqual([REFRESH_TOKEN_COOKIE, 'refresh-jwt']);
    expect(accessOptions).toMatchObject({ httpOnly: true, sameSite: 'strict', path: '/', maxAge: ACCESS_TOKEN_TTL_MS });
    expect(refreshOptions).toMatchObject({ httpOnly: true, sameSite: 'strict', path: '/', maxAge: REFRESH_TOKEN_TTL_MS });
  });

  it('clears both cookies with the same attributes so the browser really removes them', () => {
    const { res, spy } = fakeResponse();
    clearAuthCookies(res);
    expect(spy.clearCookie).toHaveBeenCalledTimes(2);
    expect(spy.clearCookie.mock.calls.map((c) => c[0]).sort()).toEqual([ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE].sort());
    for (const call of spy.clearCookie.mock.calls) {
      expect(call[1]).toMatchObject({ httpOnly: true, sameSite: 'strict', path: '/' });
    }
  });
});
