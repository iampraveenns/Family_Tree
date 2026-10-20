import { Request, Response, NextFunction } from 'express';
import { memoryService } from '../services/memoryService.ts';
import { mediaService } from '../services/mediaService.ts';
import { mediaRepository } from '../repositories/mediaRepository.ts';
import { getMediaStorageService } from '../services/storage/MediaStorageService.ts';
import { sendSuccess } from '../utils/apiResponse.ts';
import { UnauthorizedError, ValidationError } from '../utils/errors.ts';

export class MemoryController {
  async createMemory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new UnauthorizedError('Authentication required to preserve memory');
      }

      const familyId = req.params.familyId;
      const memory = await memoryService.createMemory(familyId, userId, req.body);
      sendSuccess(res, memory, 'Memory preserved successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async getMemories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const familyId = req.params.familyId;
      const {
        page,
        limit,
        type,
        memberId,
        branchId,
        year,
        tag,
        collectionId,
        visibility,
        search,
      } = req.query;

      const memoriesData = await memoryService.getMemories(familyId, userId, {
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        type: type as any,
        memberId: memberId as string,
        branchId: branchId as string,
        year: year ? parseInt(year as string, 10) : undefined,
        tag: tag as string,
        collectionId: collectionId as string,
        visibility: visibility as any,
        search: search as string,
      });

      sendSuccess(res, memoriesData, 'Memories retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async getMemoryById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const { familyId, memoryId } = req.params;
      const memory = await memoryService.getMemoryById(familyId, memoryId, userId);
      sendSuccess(res, memory, 'Memory details retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async updateMemory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const { familyId, memoryId } = req.params;
      const updated = await memoryService.updateMemory(familyId, memoryId, userId, req.body);
      sendSuccess(res, updated, 'Memory updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async deleteMemory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const { familyId, memoryId } = req.params;
      const result = await memoryService.deleteMemory(familyId, memoryId, userId);
      sendSuccess(res, result, 'Memory deleted/archived successfully');
    } catch (err) {
      next(err);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const { familyId } = req.params;
      const stats = await memoryService.getStats(familyId, userId);
      sendSuccess(res, stats, 'Heritage statistics retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async getOnThisDay(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const { familyId } = req.params;
      const historicMemories = await memoryService.getOnThisDay(familyId, userId);
      sendSuccess(res, historicMemories, 'On this day memories retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async uploadMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new UnauthorizedError('Authentication required to upload media');
      }

      if (!req.file) {
        throw new ValidationError('File upload binary is required (multipart field: file)');
      }

      const { familyId, memoryId } = req.params;
      const media = await mediaService.uploadMedia(familyId, memoryId, userId, req.file);
      sendSuccess(res, media, 'Media uploaded and processed successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async getMemoryMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const { familyId, memoryId } = req.params;
      // Validate access to memory
      await memoryService.getMemoryById(familyId, memoryId, userId);

      const mediaList = await mediaRepository.findByMemory(memoryId);
      const storageService = getMediaStorageService();

      const signed = mediaList.map((m) => ({
        ...m,
        streamUrl: storageService.generateSignedUrl(m._id.toString(), { isThumbnail: false }),
        thumbnailUrl: m.thumbnailStorageKey
          ? storageService.generateSignedUrl(m._id.toString(), { isThumbnail: true })
          : undefined,
      }));

      sendSuccess(res, signed, 'Memory media retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async checkDuplicateMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId } = req.params;
      const checksum = (req.query.checksum as string) || req.body?.checksum;

      if (!checksum) {
        sendSuccess(res, { isDuplicate: false });
        return;
      }

      const dupResult = await mediaService.checkDuplicate(familyId, checksum);
      sendSuccess(res, dupResult, 'Duplicate check completed');
    } catch (err) {
      next(err);
    }
  }
}

export const memoryController = new MemoryController();
