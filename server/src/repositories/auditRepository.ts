import { Types } from 'mongoose';
import { AuditLog, IAuditLog } from '../models/AuditLog.ts';

export interface AuditFilterOptions {
  action?: string | string[];
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  limit?: number;
  skip?: number;
}

export class AuditRepository {
  async create(data: Partial<IAuditLog>): Promise<IAuditLog> {
    const log = new AuditLog(data);
    return log.save();
  }

  async findByFamily(
    familyId: string | Types.ObjectId,
    optionsOrLimit: number | AuditFilterOptions = 50
  ): Promise<IAuditLog[]> {
    if (!Types.ObjectId.isValid(familyId)) return [];

    if (typeof optionsOrLimit === 'number') {
      return AuditLog.find({ familyId }).sort({ createdAt: -1 }).limit(optionsOrLimit).exec();
    }

    const {
      action,
      entityType,
      entityId,
      actorUserId,
      startDate,
      endDate,
      limit = 50,
      skip = 0,
    } = optionsOrLimit;

    const query: Record<string, unknown> = { familyId: new Types.ObjectId(familyId) };

    if (action) {
      if (Array.isArray(action)) {
        query.action = { $in: action };
      } else {
        query.action = action;
      }
    }

    if (entityType) {
      query.entityType = entityType;
    }

    if (entityId) {
      query.entityId = entityId;
    }

    if (actorUserId) {
      query.actorUserId = actorUserId;
    }

    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
      query.createdAt = dateFilter;
    }

    return AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  async countByFamily(
    familyId: string | Types.ObjectId,
    options?: AuditFilterOptions
  ): Promise<number> {
    if (!Types.ObjectId.isValid(familyId)) return 0;
    const query: Record<string, unknown> = { familyId: new Types.ObjectId(familyId) };

    if (options?.action) {
      query.action = Array.isArray(options.action) ? { $in: options.action } : options.action;
    }
    if (options?.entityType) query.entityType = options.entityType;
    if (options?.entityId) query.entityId = options.entityId;
    if (options?.actorUserId) query.actorUserId = options.actorUserId;
    if (options?.startDate || options?.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (options.startDate) dateFilter.$gte = new Date(options.startDate);
      if (options.endDate) dateFilter.$lte = new Date(options.endDate);
      query.createdAt = dateFilter;
    }

    return AuditLog.countDocuments(query).exec();
  }
}

export const auditRepository = new AuditRepository();
