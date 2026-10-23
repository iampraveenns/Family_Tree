import { Types } from 'mongoose';
import { mediaRepository } from '../repositories/mediaRepository.ts';
import { memoryRepository } from '../repositories/memoryRepository.ts';
import { mediaProcessingService } from './mediaProcessingService.ts';
import { getMediaStorageService } from './storage/MediaStorageService.ts';
import { authorizationService } from './authorizationService.ts';
import { auditService } from './auditService.ts';
import {
  AuditAction,
  Permission,
  MemoryType,
  MemoryStatus,
  MemoryVisibility,
} from '../constants/index.ts';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  UnauthorizedError,
} from '../utils/errors.ts';

export class MediaService {
  async uploadMedia(
    familyId: string,
    memoryId: string,
    actorUserId: string,
    file: Express.Multer.File
  ) {
    const memory = await memoryRepository.findById(memoryId);
    if (!memory) {
      throw new NotFoundError('Memory not found');
    }

    if (memory.familyId.toString() !== familyId) {
      throw new ForbiddenError('Memory does not belong to this family space');
    }

    // RBAC: actor must be able to manage this memory
    const authResult = await authorizationService.canManageMemory(
      actorUserId,
      familyId,
      memory,
      Permission.EDIT_MEMORY
    );
    if (!authResult.allowed) {
      throw new ForbiddenError(authResult.reason || 'Not authorized to upload media to this memory');
    }

    // Pre-validate file
    mediaProcessingService.validateFile(file);

    // Duplicate detection
    const sha256Checksum = mediaProcessingService.computeChecksum(file.buffer);
    const existingDup = await mediaRepository.findDuplicateInMemory(familyId, memoryId, sha256Checksum);
    if (existingDup) {
      throw new ValidationError('A file with identical content checksum already exists in this memory (duplicate prevented)');
    }

    // Run processing pipeline
    const processed = await mediaProcessingService.processUpload(file, familyId, memoryId);

    // Persist media metadata in MongoDB
    const media = await mediaRepository.create({
      familyId: new Types.ObjectId(familyId),
      memoryId: new Types.ObjectId(memoryId),
      uploadedBy: new Types.ObjectId(actorUserId),
      originalFileName: processed.originalFileName,
      storageKey: processed.storageKey,
      mimeType: processed.mimeType,
      fileSize: processed.fileSize,
      sha256Checksum: processed.sha256Checksum,
      width: processed.width,
      height: processed.height,
      duration: processed.duration,
      thumbnailStorageKey: processed.thumbnailStorageKey,
      processingStatus: processed.processingStatus,
      visibility: memory.visibility,
    });

    // Auto-set cover media if not present or if video
    const isVideo = processed.mimeType.startsWith('video/');
    if (!memory.coverMediaId && (processed.thumbnailStorageKey || processed.mimeType.startsWith('image/') || isVideo)) {
      await memoryRepository.update(memoryId, { coverMediaId: media._id });
    }

    // Ensure database memory model correctly saves media type as VIDEO for video uploads
    if (isVideo && memory.memoryType !== MemoryType.VIDEO) {
      await memoryRepository.update(memoryId, { memoryType: MemoryType.VIDEO, coverMediaId: media._id });
    }

    // Audit log
    await auditService.log(
      familyId,
      actorUserId,
      AuditAction.MEDIA_UPLOADED,
      'Media',
      media._id.toString(),
      {
        originalFileName: media.originalFileName,
        fileSize: media.fileSize,
        mimeType: media.mimeType,
        sha256Checksum: media.sha256Checksum,
      }
    );

    const storageService = getMediaStorageService();
    return {
      ...media.toObject(),
      streamUrl: storageService.generateSignedUrl(media._id.toString(), { isThumbnail: false }),
      thumbnailUrl: media.thumbnailStorageKey
        ? storageService.generateSignedUrl(media._id.toString(), { isThumbnail: true })
        : undefined,
    };
  }

  async getMediaById(mediaId: string, actorUserId?: string) {
    const media = await mediaRepository.findById(mediaId);
    if (!media) {
      throw new NotFoundError('Media file not found');
    }

    if (actorUserId) {
      const memory = await memoryRepository.findById(media.memoryId);
      if (memory) {
        const authResult = await authorizationService.canViewMemory(
          actorUserId,
          media.familyId.toString(),
          memory
        );
        if (!authResult.allowed) {
          throw new ForbiddenError('Not authorized to access this media file');
        }
      }
    }

    const storageService = getMediaStorageService();
    return {
      ...media.toObject(),
      streamUrl: storageService.generateSignedUrl(media._id.toString(), { isThumbnail: false }),
      thumbnailUrl: media.thumbnailStorageKey
        ? storageService.generateSignedUrl(media._id.toString(), { isThumbnail: true })
        : undefined,
    };
  }

  async getMediaAccess(mediaId: string, actorUserId: string) {
    const media = await mediaRepository.findById(mediaId);
    if (!media) {
      throw new NotFoundError('Media file not found');
    }

    const memory = await memoryRepository.findById(media.memoryId);
    if (memory) {
      const authResult = await authorizationService.canViewMemory(
        actorUserId,
        media.familyId.toString(),
        memory
      );
      if (!authResult.allowed) {
        throw new ForbiddenError('Not authorized to access this media file');
      }
    }

    const storageService = getMediaStorageService();
    const streamUrl = storageService.generateSignedUrl(media._id.toString(), { isThumbnail: false });
    const thumbnailUrl = media.thumbnailStorageKey
      ? storageService.generateSignedUrl(media._id.toString(), { isThumbnail: true })
      : undefined;

    await auditService.log(
      media.familyId.toString(),
      actorUserId,
      AuditAction.MEDIA_ACCESSED,
      'Media',
      mediaId,
      { fileName: media.originalFileName }
    );

    return {
      mediaId: media._id.toString(),
      originalFileName: media.originalFileName,
      mimeType: media.mimeType,
      fileSize: media.fileSize,
      streamUrl,
      thumbnailUrl,
      expiresInSeconds: 3600,
    };
  }

  async getMediaStream(
    mediaId: string,
    options: {
      token?: string;
      expires?: number;
      isThumbnail?: boolean;
      actorUserId?: string;
      range?: { start: number; end: number };
    }
  ) {
    const media = await mediaRepository.findById(mediaId);
    if (!media) {
      throw new NotFoundError('Media file not found');
    }

    const storageService = getMediaStorageService();

    // Security Verification:
    // Either valid signed token OR valid authenticated user with memory access
    let authorized = false;

    if (options.token && options.expires) {
      authorized = storageService.verifySignedUrl(
        mediaId,
        options.token,
        options.expires,
        !!options.isThumbnail
      );
    } else if (options.actorUserId) {
      const memory = await memoryRepository.findById(media.memoryId);
      if (memory) {
        const auth = await authorizationService.canViewMemory(
          options.actorUserId,
          media.familyId.toString(),
          memory
        );
        authorized = auth.allowed;
      }
    }

    if (!authorized) {
      throw new UnauthorizedError('Invalid, expired, or unauthorized media access token');
    }

    const storageKey =
      options.isThumbnail && media.thumbnailStorageKey
        ? media.thumbnailStorageKey
        : media.storageKey;

    const mimeType = options.isThumbnail ? 'image/webp' : media.mimeType;

    const streamResult = await storageService.getFileStream(storageKey, options.range);

    return {
      ...streamResult,
      mimeType,
      fileName: media.originalFileName,
    };
  }

  async deleteMedia(mediaId: string, actorUserId: string) {
    const media = await mediaRepository.findById(mediaId);
    if (!media) {
      throw new NotFoundError('Media file not found');
    }

    const memory = await memoryRepository.findById(media.memoryId);
    if (!memory) {
      throw new NotFoundError('Associated memory not found');
    }

    const authResult = await authorizationService.canManageMemory(
      actorUserId,
      media.familyId.toString(),
      memory,
      Permission.DELETE_MEMORY
    );
    if (!authResult.allowed) {
      throw new ForbiddenError(authResult.reason || 'Insufficient permissions to delete media file');
    }

    // Delete files from storage
    const storageService = getMediaStorageService();
    try {
      await storageService.deleteFile(media.storageKey);
      if (media.thumbnailStorageKey) {
        await storageService.deleteFile(media.thumbnailStorageKey);
      }
    } catch {
      // Storage cleanup failure shouldn't abort database deletion
    }

    // Delete record
    await mediaRepository.delete(mediaId);

    // If this media was the cover, clear or pick another
    if (memory.coverMediaId && memory.coverMediaId.toString() === mediaId) {
      const remainingMedia = await mediaRepository.findByMemory(memory._id);
      const nextCover = remainingMedia[0]?._id || null;
      await memoryRepository.update(memory._id, { coverMediaId: nextCover });
    }

    await auditService.log(
      media.familyId.toString(),
      actorUserId,
      AuditAction.MEDIA_DELETED,
      'Media',
      mediaId,
      { originalFileName: media.originalFileName }
    );

    return { success: true, message: 'Media successfully deleted' };
  }

  async checkDuplicate(familyId: string, sha256Checksum: string) {
    if (!sha256Checksum || typeof sha256Checksum !== 'string') {
      return { isDuplicate: false };
    }

    const existingMedia = await mediaRepository.findByChecksum(familyId, sha256Checksum.trim());
    if (!existingMedia) {
      return { isDuplicate: false };
    }

    const memory = await memoryRepository.findById(existingMedia.memoryId);
    return {
      isDuplicate: true,
      existingMedia: {
        id: existingMedia._id.toString(),
        originalFileName: existingMedia.originalFileName,
        mimeType: existingMedia.mimeType,
        fileSize: existingMedia.fileSize,
      },
      existingMemory: memory
        ? {
            id: memory._id.toString(),
            title: memory.title,
            memoryType: memory.memoryType,
            eventDate: memory.eventDate,
            eventDateApprox: memory.eventDateApprox,
            location: memory.location,
          }
        : null,
    };
  }
}

export const mediaService = new MediaService();
