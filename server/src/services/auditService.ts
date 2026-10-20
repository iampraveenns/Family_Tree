import { Types } from 'mongoose';
import { auditRepository, AuditFilterOptions } from '../repositories/auditRepository.ts';
import { userRepository } from '../repositories/userRepository.ts';
import { AuditAction } from '../constants/index.ts';

export class AuditService {
  private sanitizeMetadata(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!meta || typeof meta !== 'object') return meta;
    const SENSITIVE_KEYS = new Set([
      'password',
      'passwordhash',
      'token',
      'refreshtoken',
      'tokenhash',
      'secret',
      'apikey',
      'authorization',
      'accesstoken',
    ]);

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(meta)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeMetadata(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  async log(
    familyId: string | Types.ObjectId | undefined | null,
    actorUserId: string,
    action: AuditAction,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>
  ) {
    try {
      const sanitizedMeta = this.sanitizeMetadata(metadata);
      await auditRepository.create({
        familyId: familyId && Types.ObjectId.isValid(familyId) ? new Types.ObjectId(familyId) : undefined,
        actorUserId,
        action,
        entityType,
        entityId,
        metadata: sanitizedMeta || {},
      });
    } catch {
      // Audit log errors shouldn't crash the primary business operation
    }
  }

  async getLogs(
    familyId: string | Types.ObjectId,
    optionsOrLimit: number | AuditFilterOptions = 50
  ) {
    const logs = await auditRepository.findByFamily(familyId, optionsOrLimit);
    
    // Enrich unique actor user IDs with email/name if available
    const actorUserIds = [...new Set(logs.map((l) => l.actorUserId).filter(Boolean))];
    const userMap = new Map<string, { email?: string; displayName?: string }>();
    
    await Promise.all(
      actorUserIds.map(async (uid) => {
        if (uid && Types.ObjectId.isValid(uid)) {
          const user = await userRepository.findById(uid);
          if (user) {
            userMap.set(uid, {
              email: user.email,
              displayName: user.displayName || user.email,
            });
          }
        }
      })
    );

    return logs.map((log) => {
      const obj = log.toObject ? log.toObject() : log;
      const actorInfo = log.actorUserId ? userMap.get(log.actorUserId) : null;
      return {
        ...obj,
        actorEmail: actorInfo?.email,
        actorDisplayName: actorInfo?.displayName,
        actorName: actorInfo?.displayName || actorInfo?.email || 'Family Relative',
      };
    });
  }

  async getActivityFeed(familyId: string | Types.ObjectId, limit: number = 20) {
    const logs = await this.getLogs(familyId, limit);
    return logs.map((log: any) => {
      const meta = log.metadata || {};
      let actionPhrase = 'contributed an update to the family archive';

      switch (log.action) {
        case 'MEMBER_CREATED':
          actionPhrase = `added ${meta.firstName ? `${meta.firstName} ${meta.lastName || ''}`.trim() : 'a family relative'} to the family tree`;
          break;
        case 'MEMBER_UPDATED':
          actionPhrase = `updated ${meta.displayName || meta.firstName || 'a relative'}'s biography and details`;
          break;
        case 'MEMBER_DELETED':
          actionPhrase = `removed a member record from the archive`;
          break;
        case 'RELATIONSHIP_CREATED':
          actionPhrase = `added a family relationship (${meta.relationshipType || 'connection'})`;
          break;
        case 'RELATIONSHIP_DELETED':
          actionPhrase = `removed a family relationship link`;
          break;
        case 'MEMORY_CREATED':
          actionPhrase = `added a memory story / photo "${meta.title || 'Family Moment'}"`;
          break;
        case 'MEMORY_UPDATED':
          actionPhrase = `updated memory "${meta.title || 'Family Story'}"`;
          break;
        case 'EVENT_CREATED':
          actionPhrase = `added a family timeline milestone "${meta.title || 'Historical Event'}"`;
          break;
        case 'EVENT_UPDATED':
          actionPhrase = `updated timeline event "${meta.title || 'Milestone'}"`;
          break;
        case 'INVITATION_CREATED':
          actionPhrase = `invited ${meta.invitedEmail || 'a relative'} as ${meta.role || 'Member'}`;
          break;
        case 'INVITATION_ACCEPTED':
          actionPhrase = `accepted their invitation and joined the family!`;
          break;
        case 'INVITATION_REVOKED':
          actionPhrase = `revoked a pending invitation`;
          break;
        case 'ROLE_CHANGED':
          actionPhrase = `updated member role to ${meta.newRole || 'new role'}`;
          break;
        case 'MEMBERSHIP_SUSPENDED':
          actionPhrase = `suspended a member account`;
          break;
        case 'MEMBERSHIP_REACTIVATED':
          actionPhrase = `reactivated a member account`;
          break;
        case 'BRANCH_CREATED':
          actionPhrase = `established the "${meta.name || 'new'}" branch`;
          break;
        case 'BRANCH_MANAGER_ASSIGNED':
          actionPhrase = `assigned a branch manager`;
          break;
        case 'MEMBER_TRANSFERRED':
          actionPhrase = `transferred a relative to a new branch`;
          break;
        case 'PROPOSAL_CREATED':
          actionPhrase = `submitted "${meta.title || 'a proposed update'}" for family review`;
          break;
        case 'PROPOSAL_APPROVED':
          actionPhrase = `approved contribution "${meta.title || 'family update'}"`;
          break;
        case 'PROPOSAL_REJECTED':
          actionPhrase = `reviewed contribution proposal "${meta.title || 'update'}"`;
          break;
        case 'MEMBER_LINKED_TO_USER':
          actionPhrase = `linked a tree relative profile to an active account`;
          break;
        default:
          if (log.action) {
            actionPhrase = log.action.toLowerCase().replace(/_/g, ' ');
          }
      }

      return {
        id: log._id?.toString(),
        actorName: log.actorName,
        actorEmail: log.actorEmail,
        action: log.action,
        actionPhrase,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: log.metadata,
        timestamp: log.createdAt,
      };
    });
  }

  async countLogs(familyId: string | Types.ObjectId, options?: AuditFilterOptions) {
    return auditRepository.countByFamily(familyId, options);
  }
}

export const auditService = new AuditService();
