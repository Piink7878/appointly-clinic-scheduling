// ==============================================================================
// Appointly Server — Security, Password Hashing & JWT Token Helpers
// ==============================================================================
// Reference: System-Level SDS Section 7.1 & Sprint 1 Contracts (F-001)
// Implements Argon2id password verification, JWT Access/Refresh signing,
// and HttpOnly/SameSite=Strict cookie management.
// ==============================================================================

import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Response } from 'express';
import { config } from '../config';
import { AuthUserPayload } from '../types';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Hashes a plaintext password using OWASP-compliant Argon2id parameters.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return argon2.hash(plainPassword);
}

/**
 * Verifies a plaintext password against an Argon2id hash.
 */
export async function verifyPassword(
  hash: string,
  plainPassword: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plainPassword);
  } catch {
    return false;
  }
}

/**
 * Produces a deterministic SHA-256 hash of a refresh token for safe DB storage.
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Signs a short-lived (15 min) JWT Access Token.
 */
export function generateAccessToken(payload: AuthUserPayload): string {
  return jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    },
    config.jwtAccessSecret,
    {
      expiresIn: '15m',
    }
  );
}

/**
 * Signs a long-lived (7 day) JWT Refresh Token.
 */
export function generateRefreshToken(payload: AuthUserPayload): string {
  return jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    },
    config.jwtRefreshSecret,
    {
      expiresIn: '7d',
    }
  );
}

/**
 * Verifies and decodes a JWT Access Token.
 * Throws an error if invalid, tampered, or expired.
 */
export function verifyAccessToken(token: string): AuthUserPayload {
  const decoded = jwt.verify(token, config.jwtAccessSecret) as AuthUserPayload;
  return {
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role,
  };
}

/**
 * Verifies and decodes a JWT Refresh Token.
 * Throws an error if invalid, tampered, or expired.
 */
export function verifyRefreshToken(token: string): AuthUserPayload {
  const decoded = jwt.verify(token, config.jwtRefreshSecret) as AuthUserPayload;
  return {
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role,
  };
}

/**
 * Attaches Access and Refresh tokens to HTTP response as secure cookies.
 * Cookies use HttpOnly and SameSite=Strict.
 * Secure flag is enabled only in production (or when explicitly configured).
 */
export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string
): void {
  const isSecure = config.cookieSecure || config.nodeEnv === 'production';

  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isSecure,
    maxAge: ACCESS_TOKEN_TTL_MS,
    path: '/',
  });

  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isSecure,
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: '/',
  });
}

/**
 * Clears authentication cookies upon logout or session invalidation.
 */
export function clearAuthCookies(res: Response): void {
  const isSecure = config.cookieSecure || config.nodeEnv === 'production';

  res.clearCookie(ACCESS_TOKEN_COOKIE, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isSecure,
    path: '/',
  });

  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isSecure,
    path: '/',
  });
}

