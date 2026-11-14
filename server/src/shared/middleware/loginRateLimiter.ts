// ==============================================================================
// Appointly Server — Login Brute-Force Protection
// ==============================================================================
// Reference: System-Level SDS Section 7.1 ("Authentication endpoints enforce IP and
//            account-based rate limiting"), 5.3 (429); Sprint 1 Contracts AC-F001-02
//
// Failed sign-ins (HTTP 401) are counted in a sliding window, per ACCOUNT (the e-mail
// that was tried, from any address) and per IP address. Once a limit is reached further
// attempts get 429 until old failures age out — even with the correct password, so a
// guessing attack cannot simply carry on. A successful sign-in clears that account's count.
//
// Not counted: a 403 ACCOUNT_INACTIVE (the password was right) and validation errors
// (no credential was checked). State is in memory — right for a single instance; run
// several instances behind a load balancer and move it to a shared store (e.g. Redis).
// ==============================================================================

import { type NextFunction, type Request, type Response } from 'express';
import { config } from '../config';
import { sendError } from '../utils/response';

export interface LoginRateLimiterOptions {
  windowMs: number;
  maxPerAccount: number;
  maxPerIp: number;
  /** Injectable clock (tests). */
  now?: () => number;
  /** Upper bound on tracked keys, so hostile traffic cannot grow memory without limit. */
  maxKeys?: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

const ACCOUNT_PREFIX = 'account:';
const IP_PREFIX = 'ip:';

export class LoginRateLimiter {
  private readonly failures = new Map<string, number[]>();
  private readonly now: () => number;
  private readonly maxKeys: number;

  constructor(private readonly options: LoginRateLimiterOptions) {
    this.now = options.now ?? Date.now;
    this.maxKeys = options.maxKeys ?? 10_000;
  }

  /** Failures of `key` still inside the window (oldest first). */
  private recent(key: string): number[] {
    const cutoff = this.now() - this.options.windowMs;
    const kept = (this.failures.get(key) ?? []).filter((t) => t > cutoff);
    if (kept.length === 0) this.failures.delete(key);
    else this.failures.set(key, kept);
    return kept;
  }

  private blockedFor(key: string, limit: number): number {
    const kept = this.recent(key);
    if (kept.length < limit) return 0;
    // free again when the failure that put us at the limit ages out
    const unblockAt = kept[kept.length - limit] + this.options.windowMs;
    return Math.max(1, Math.ceil((unblockAt - this.now()) / 1000));
  }

  /** May this ip / account try to sign in right now? */
  check(ip: string, account: string | null): RateLimitDecision {
    const waits = [this.blockedFor(IP_PREFIX + ip, this.options.maxPerIp)];
    if (account) waits.push(this.blockedFor(ACCOUNT_PREFIX + account, this.options.maxPerAccount));
    const retryAfterSeconds = Math.max(...waits);
    return { allowed: retryAfterSeconds === 0, retryAfterSeconds };
  }

  recordFailure(ip: string, account: string | null): void {
    this.evictIfFull();
    const stamp = this.now();
    for (const key of [IP_PREFIX + ip, ...(account ? [ACCOUNT_PREFIX + account] : [])]) {
      this.failures.set(key, [...this.recent(key), stamp]);
    }
  }

  /** A correct password ends the suspicion for that account (the IP's history stays). */
  recordSuccess(account: string | null): void {
    if (account) this.failures.delete(ACCOUNT_PREFIX + account);
  }

  reset(): void {
    this.failures.clear();
  }

  private evictIfFull(): void {
    if (this.failures.size < this.maxKeys) return;
    for (const key of [...this.failures.keys()]) this.recent(key); // drops fully expired keys
    // still full: forget the oldest entries (Map keeps insertion order)
    for (const key of this.failures.keys()) {
      if (this.failures.size < this.maxKeys) break;
      this.failures.delete(key);
    }
  }
}

/** The e-mail being tried, normalised exactly as the login service does; null when absent or not text. */
export function accountKeyOf(req: Request): string | null {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  if (typeof email !== 'string') return null;
  const normalised = email.toLowerCase().trim();
  return normalised.length > 0 && normalised.length <= 255 ? normalised : null;
}

/** Express middleware for `POST /auth/login`. */
export function loginRateLimit(limiter: LoginRateLimiter) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip ?? 'unknown';
    const account = accountKeyOf(req);

    const decision = limiter.check(ip, account);
    if (!decision.allowed) {
      res.setHeader('Retry-After', String(decision.retryAfterSeconds));
      sendError(
        res,
        429,
        'TOO_MANY_REQUESTS',
        `Too many failed sign-in attempts. Try again in ${Math.ceil(decision.retryAfterSeconds / 60)} minute(s).`
      );
      return;
    }

    res.on('finish', () => {
      if (res.statusCode === 401) limiter.recordFailure(ip, account);
      else if (res.statusCode === 200) limiter.recordSuccess(account);
    });
    next();
  };
}

/** Process-wide limiter, configured from LOGIN_RATE_LIMIT_* (see .env.example). */
export const loginLimiter = new LoginRateLimiter({
  windowMs: config.loginRateLimit.windowMinutes * 60_000,
  maxPerAccount: config.loginRateLimit.maxPerAccount,
  maxPerIp: config.loginRateLimit.maxPerIp,
});
