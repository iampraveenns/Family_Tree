import { userRepository } from '../repositories/userRepository.ts';
import { refreshTokenRepository } from '../repositories/refreshTokenRepository.ts';
import { membershipRepository } from '../repositories/membershipRepository.ts';
import { auditService } from './auditService.ts';
import { SecurityUtils } from '../utils/security.ts';
import {
  UnauthorizedError,
  ConflictError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
} from '../utils/errors.ts';
import { AuditAction, UserStatus, ErrorCode } from '../constants/index.ts';
import { logger } from '../utils/logger.ts';

export class AuthService {
  /**
   * Registers a new user account with strong password hashing and initial session.
   */
  async register(data: { name: string; email: string; password: string; avatar?: string }) {
    const email = data.email.toLowerCase().trim();

    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError('Name is required');
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ValidationError('A valid email address is required');
    }

    if (!data.password || data.password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    if (!/[A-Za-z]/.test(data.password) || !/[0-9]/.test(data.password)) {
      throw new ValidationError('Password must contain at least one letter and one number');
    }

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictError('An account with this email already exists', ErrorCode.DUPLICATE_ENTITY);
    }

    const passwordHash = await SecurityUtils.hashPassword(data.password);
    const user = await userRepository.create({
      email,
      passwordHash,
      displayName: data.name.trim(),
      avatar: data.avatar || '',
      status: UserStatus.ACTIVE,
    });

    const accessToken = SecurityUtils.generateAccessToken(user);
    const { rawToken, tokenHash, expiresAt } = SecurityUtils.generateRefreshTokenBundle();

    await refreshTokenRepository.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    });

    await auditService.log(
      undefined,
      user._id.toString(),
      AuditAction.USER_REGISTERED,
      'User',
      user._id.toString(),
      { email: user.email }
    );

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
        avatar: user.avatar,
        status: user.status,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken: rawToken,
    };
  }

  /**
   * Authenticates user credentials, records login audit, and issues tokens.
   */
  async login(data: { email: string; password: string; ip?: string; userAgent?: string }) {
    const email = data.email.toLowerCase().trim();

    const user = await userRepository.findByEmail(email);
    if (!user) {
      await auditService.log(
        undefined,
        'unauthenticated',
        AuditAction.SECURITY_VIOLATION,
        'User',
        email,
        {
          attempt: 'LOGIN_FAILURE',
          email,
          reason: 'User not found',
          ip: data.ip,
          userAgent: data.userAgent,
        }
      );
      throw new UnauthorizedError('Invalid email or password');
    }

    const isValidPassword = await SecurityUtils.comparePassword(data.password, user.passwordHash);
    if (!isValidPassword) {
      await auditService.log(
        undefined,
        user._id.toString(),
        AuditAction.SECURITY_VIOLATION,
        'User',
        user._id.toString(),
        {
          attempt: 'LOGIN_FAILURE',
          email,
          reason: 'Invalid credentials',
          ip: data.ip,
          userAgent: data.userAgent,
        }
      );
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenError('This user account has been suspended. Please contact administrator.');
    }

    await userRepository.updateLastLogin(user._id);

    const accessToken = SecurityUtils.generateAccessToken(user);
    const { rawToken, tokenHash, expiresAt } = SecurityUtils.generateRefreshTokenBundle();

    await refreshTokenRepository.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    });

    await auditService.log(
      undefined,
      user._id.toString(),
      AuditAction.USER_LOGIN,
      'User',
      user._id.toString(),
      { ip: data.ip, userAgent: data.userAgent }
    );

    const memberships = await membershipRepository.findByUser(user._id);

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
        avatar: user.avatar,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
      },
      memberships,
      accessToken,
      refreshToken: rawToken,
    };
  }

  /**
   * Rotates a refresh token: invalidates old token, issues new access + refresh pair.
   * Includes token reuse detection: revokes all tokens if an already-revoked token is used.
   */
  async refreshToken(data: { refreshToken: string; ip?: string; userAgent?: string }) {
    if (!data.refreshToken) {
      throw new UnauthorizedError('Refresh token is required');
    }

    const tokenHash = SecurityUtils.hashToken(data.refreshToken);
    const existingToken = await refreshTokenRepository.findByTokenHash(tokenHash);

    if (!existingToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Reuse detection: If token was already revoked, someone may have stolen it
    if (existingToken.revokedAt) {
      logger.warn(
        { userId: existingToken.userId, tokenHash },
        'Revoked refresh token reuse detected! Revoking all user refresh tokens as a security countermeasure.'
      );
      await refreshTokenRepository.revokeAllForUser(existingToken.userId);
      throw new UnauthorizedError('Invalid or reused refresh token. Please sign in again.');
    }

    if (new Date() > existingToken.expiresAt) {
      throw new UnauthorizedError('Refresh token has expired. Please sign in again.');
    }

    const user = await userRepository.findById(existingToken.userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError('User account not found or inactive');
    }

    // Generate new access token and rotated refresh token
    const newAccessToken = SecurityUtils.generateAccessToken(user);
    const { rawToken: newRawToken, tokenHash: newTokenHash, expiresAt: newExpiresAt } =
      SecurityUtils.generateRefreshTokenBundle();

    // Revoke old token and record replacement hash
    await refreshTokenRepository.revoke(tokenHash, newTokenHash);

    // Save newly rotated refresh token
    await refreshTokenRepository.create({
      userId: user._id,
      tokenHash: newTokenHash,
      expiresAt: newExpiresAt,
      familyId: existingToken.familyId,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRawToken,
    };
  }

  /**
   * Revokes the current refresh token on user logout.
   */
  async logout(data: { refreshToken?: string; userId?: string }) {
    if (data.refreshToken) {
      const tokenHash = SecurityUtils.hashToken(data.refreshToken);
      await refreshTokenRepository.revoke(tokenHash);
    }

    if (data.userId) {
      await auditService.log(
        undefined,
        data.userId,
        AuditAction.USER_LOGOUT,
        'User',
        data.userId
      );
    }

    return { success: true };
  }

  /**
   * Retrieves profile and family memberships for the currently authenticated user.
   */
  async getCurrentUser(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const memberships = await membershipRepository.findByUser(userId);

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
        avatar: user.avatar,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
      },
      memberships,
    };
  }
}

export const authService = new AuthService();
