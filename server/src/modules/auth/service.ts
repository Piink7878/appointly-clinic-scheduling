// ==============================================================================
// Appointly Server — Authentication Service Layer
// ==============================================================================
// Reference: System-Level SDS Section 6 & 7 & Sprint 1 Contracts (F-001)
// Handles authentication, password verification, token issuance, and session revocation.
// ==============================================================================

import { prisma } from '../../shared/database';
import { AppError } from '../../shared/middleware/errorHandler';
import {
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyRefreshToken,
} from '../../shared/utils/security';
import { LoginInput } from './validation';
import { AccountStatus } from '@prisma/client';

export class AuthService {
  /**
   * Authenticates user credentials, enforces ACTIVE account status,
   * stores hashed refresh token, and issues Access and Refresh tokens.
   */
  async login(input: LoginInput) {
    const normalizedEmail = input.email.toLowerCase().trim();

    // 1. Case-insensitive user lookup
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // 2. Generic invalid credentials check (anti-enumeration)
    if (!user) {
      throw AppError.unauthorized('Invalid email or password.', 'INVALID_CREDENTIALS');
    }

    const isMatch = await verifyPassword(user.passwordHash, input.password);
    if (!isMatch) {
      throw AppError.unauthorized('Invalid email or password.', 'INVALID_CREDENTIALS');
    }

    // 3. Account status gate
    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw new AppError(
        403,
        'ACCOUNT_INACTIVE',
        'Account is inactive. Please contact your clinic administrator.'
      );
    }

    // 4. Token generation & session persistence
    const userPayload = {
      userId: user.userId,
      email: user.email,
      role: user.role,
    };

    const accessToken = generateAccessToken(userPayload);
    const refreshToken = generateRefreshToken(userPayload);
    const refreshTokenHash = hashRefreshToken(refreshToken);

    await prisma.user.update({
      where: { userId: user.userId },
      data: { refreshTokenHash },
    });

    return {
      user: userPayload,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Validates refresh token against User.refresh_token_hash and rotates tokens.
   */
  async rotateRefreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw AppError.unauthorized('Refresh token is required.', 'REFRESH_TOKEN_REQUIRED');
    }

    // 1. Verify token signature & expiry
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw AppError.unauthorized('Invalid or expired refresh token.', 'INVALID_REFRESH_TOKEN');
    }

    // 2. Retrieve user and verify DB session hash
    const user = await prisma.user.findUnique({
      where: { userId: payload.userId },
    });

    if (!user || user.accountStatus !== AccountStatus.ACTIVE) {
      throw AppError.unauthorized('User account not found or inactive.', 'INVALID_REFRESH_TOKEN');
    }

    const incomingHash = hashRefreshToken(refreshToken);
    if (!user.refreshTokenHash || user.refreshTokenHash !== incomingHash) {
      // Possible token reuse or revoked session: revoke active token
      await prisma.user.update({
        where: { userId: user.userId },
        data: { refreshTokenHash: null },
      });
      throw AppError.unauthorized('Refresh token has been revoked or expired.', 'INVALID_REFRESH_TOKEN');
    }

    // 3. Issue rotated tokens
    const userPayload = {
      userId: user.userId,
      email: user.email,
      role: user.role,
    };

    const newAccessToken = generateAccessToken(userPayload);
    const newRefreshToken = generateRefreshToken(userPayload);
    const newRefreshTokenHash = hashRefreshToken(newRefreshToken);

    await prisma.user.update({
      where: { userId: user.userId },
      data: { refreshTokenHash: newRefreshTokenHash },
    });

    return {
      user: userPayload,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Clears refresh token in DB to revoke active session.
   */
  async logout(userId?: string, refreshToken?: string) {
    if (userId) {
      await prisma.user.update({
        where: { userId },
        data: { refreshTokenHash: null },
      });
      return;
    }

    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        await prisma.user.update({
          where: { userId: payload.userId },
          data: { refreshTokenHash: null },
        });
      } catch {
        // Token was already expired or malformed; cookies will still be cleared
      }
    }
  }

  /**
   * Retrieves authenticated user identity, role, and profile details from database.
   */
  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { userId },
      include: {
        patient: true,
        doctor: true,
      },
    });

    if (!user || user.accountStatus !== AccountStatus.ACTIVE || !user.refreshTokenHash) {
      throw AppError.unauthorized('User account not found, inactive, or session revoked.', 'UNAUTHORIZED');
    }

    let fullName: string | undefined = undefined;
    let profileId: string | undefined = undefined;

    if (user.role === 'PATIENT' && user.patient) {
      fullName = user.patient.fullName;
      profileId = user.patient.patientId;
    } else if (user.role === 'DOCTOR' && user.doctor) {
      fullName = user.doctor.fullName;
      profileId = user.doctor.doctorId;
    } else if (user.role === 'ADMIN') {
      fullName = 'Clinic Administrator';
      profileId = user.userId;
    }

    return {
      userId: user.userId,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
      profileId,
      fullName,
    };
  }
}

export const authService = new AuthService();

