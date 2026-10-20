import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.ts';

export interface TokenPayload {
  sub: string;
  email: string;
  tokenVersion?: number;
  iat?: number;
  exp?: number;
}

export class SecurityUtils {
  private static readonly BCRYPT_ROUNDS = 12;

  /**
   * Hashes a plaintext password using bcrypt with strong cost factor.
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SecurityUtils.BCRYPT_ROUNDS);
  }

  /**
   * Securely compares plaintext password against stored bcrypt hash.
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Computes SHA-256 hash of a sensitive token (refresh token or invitation token).
   * Storing hashes prevents raw token leaks in database snapshots.
   */
  static hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Generates a cryptographically strong random token (hex-encoded).
   */
  static generateSecureRandomString(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Signs a short-lived JWT access token. Minimal claims: sub, email, tokenVersion.
   * Permissions and roles are deliberately NOT in the JWT; they are resolved server-side.
   */
  static generateAccessToken(user: { _id: string | { toString: () => string }; email: string; tokenVersion?: number }): string {
    const payload: TokenPayload = {
      sub: user._id.toString(),
      email: user.email,
      tokenVersion: user.tokenVersion ?? 0,
    };

    // Short-lived access token: 15 minutes
    return jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: '15m',
    });
  }

  /**
   * Verifies an access token signature and expiration.
   */
  static verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, config.JWT_SECRET) as TokenPayload;
  }

  /**
   * Generates a refresh token bundle: raw token for client, hashed token for database storage.
   */
  static generateRefreshTokenBundle(daysValid = 30): {
    rawToken: string;
    tokenHash: string;
    expiresAt: Date;
  } {
    const rawToken = SecurityUtils.generateSecureRandomString(40);
    const tokenHash = SecurityUtils.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);

    return { rawToken, tokenHash, expiresAt };
  }

  /**
   * Generates an invitation token bundle: raw token for invitation link, tokenHash for database storage.
   */
  static generateInvitationTokenBundle(daysValid = 7): {
    rawToken: string;
    tokenHash: string;
    expiresAt: Date;
  } {
    const rawToken = SecurityUtils.generateSecureRandomString(32);
    const tokenHash = SecurityUtils.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);

    return { rawToken, tokenHash, expiresAt };
  }
}
