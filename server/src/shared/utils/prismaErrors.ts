// ==============================================================================
// Appointly Server — Prisma Error Helpers
// ==============================================================================
// Race conditions between a "does it exist?" pre-check and the INSERT are closed by
// the database's UNIQUE constraints; these helpers let services turn the resulting
// Prisma error into the domain error code the contract specifies.
// ==============================================================================

import { Prisma } from '@prisma/client';

/** True when `err` is a Prisma known-request error with the given code (e.g. 'P2002', 'P2025'). */
export function isPrismaError(err: unknown, code: string): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;
}

/** P2002 — a UNIQUE constraint was violated. */
export const isUniqueViolation = (err: unknown): boolean => isPrismaError(err, 'P2002');
