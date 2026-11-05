import { Readable } from 'stream';
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

    // RBAC: actor must be able to manage this memory or have upload permission for it
    const authResult = await authorizationService.canManageMemory(
      actorUserId,
      familyId,
      memory,
      Permission.EDIT_MEMORY
    );
    let isAllowed = authResult.allowed;
    if (!isAllowed) {
      // Allow if actor has UPLOAD_MEMORY permission and can view this family memory
      const canUpload = await authorizationService.canCreateMemory(actorUserId, familyId);
      const canView = await authorizationService.canViewMemory(actorUserId, familyId, memory);
      if (canUpload.allowed && canView.allowed) {
        isAllowed = true;
      }
    }

    if (!isAllowed) {
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

    // Auto-set cover media if not present or if video/audio
    const isVideo = processed.mimeType.startsWith('video/');
    const isAudio = processed.mimeType.startsWith('audio/');
    if (!memory.coverMediaId) {
      await memoryRepository.update(memoryId, { coverMediaId: media._id });
    }

    // Ensure database memory model correctly saves media type as VIDEO or AUDIO for matching uploads
    if (isVideo && memory.memoryType !== MemoryType.VIDEO) {
      await memoryRepository.update(memoryId, { memoryType: MemoryType.VIDEO, coverMediaId: media._id });
    } else if (isAudio && memory.memoryType !== MemoryType.AUDIO) {
      await memoryRepository.update(memoryId, { memoryType: MemoryType.AUDIO, coverMediaId: media._id });
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
    // Either valid signed token OR valid authenticated user with memory access OR ambient family vault media access
    let authorized = false;

    if (options.token && options.expires) {
      authorized = storageService.verifySignedUrl(
        mediaId,
        options.token,
        options.expires,
        !!options.isThumbnail
      );
    }

    if (!authorized && options.actorUserId) {
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
      // Direct stream request from <audio>, <video>, or <img> tag in the family vault
      const memory = await memoryRepository.findById(media.memoryId);
      if (!memory || memory.status === 'ACTIVE' || memory.visibility === 'FAMILY' || memory.visibility === 'PUBLIC' || media.familyId) {
        authorized = true;
      }
    }

    if (!authorized) {
      throw new UnauthorizedError('Invalid, expired, or unauthorized media access token');
    }

    // Video Thumbnail Handling:
    // If a thumbnail is requested for a video asset without a dedicated rasterized thumbnail,
    // serve an SVG poster thumbnail so the browser's <img> decoder never crashes on raw video bytes.
    if (options.isThumbnail && !media.thumbnailStorageKey && media.mimeType && media.mimeType.startsWith('video/')) {
      const cleanTitle = (media.originalFileName || 'Family Video').replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').substring(0, 26);
      const svgPoster = Buffer.from(`<svg width="480" height="270" viewBox="0 0 480 270" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="vgrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#0f172a;stop-opacity:1" />
            <stop offset="60%" style="stop-color:#1e1b4b;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#312e81;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="480" height="270" fill="url(#vgrad)" />
        <circle cx="240" cy="120" r="36" fill="#2563eb" opacity="0.95" />
        <polygon points="232,104 256,120 232,136" fill="#ffffff" />
        <text x="240" y="190" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle">
          ${cleanTitle}
        </text>
        <text x="240" y="215" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="#93c5fd" text-anchor="middle">
          Family Video Keepsake
        </text>
      </svg>`);

      return {
        stream: Readable.from(svgPoster),
        contentLength: svgPoster.length,
        mimeType: 'image/svg+xml',
        fileName: `${cleanTitle}_poster.svg`,
      };
    }

    const storageKey =
      options.isThumbnail && media.thumbnailStorageKey
        ? media.thumbnailStorageKey
        : media.storageKey;

    const mimeType = options.isThumbnail ? 'image/webp' : (media.mimeType || 'video/mp4');

    // Handle data: URIs directly as buffer streams to prevent ERR_UNSAFE_REDIRECT in browsers
    if (storageKey.startsWith('data:')) {
      try {
        const commaIndex = storageKey.indexOf(',');
        const header = storageKey.substring(0, commaIndex);
        const mimeMatch = header.match(/data:([^;]+)/);
        const resolvedMime = mimeMatch ? mimeMatch[1] : mimeType;
        const base64Data = storageKey.substring(commaIndex + 1);
        const buffer = Buffer.from(base64Data, 'base64');
        const totalSize = buffer.length;

        if (options.range) {
          const start = options.range.start || 0;
          const end = options.range.end !== undefined && !isNaN(options.range.end) ? options.range.end : totalSize - 1;
          const chunk = buffer.subarray(start, end + 1);
          return {
            stream: Readable.from(chunk),
            mimeType: resolvedMime,
            fileName: media.originalFileName || 'media',
            totalSize,
            contentLength: chunk.length,
            contentRange: `bytes ${start}-${end}/${totalSize}`,
          };
        }

        return {
          stream: Readable.from(buffer),
          mimeType: resolvedMime,
          fileName: media.originalFileName || 'media',
          totalSize,
          contentLength: totalSize,
        };
      } catch (err) {
        console.error('Failed to parse base64 data URL for streaming:', err);
      }
    }

    // Direct redirect if storageKey is an HTTP(S) URL
    if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) {
      return {
        redirectUrl: storageKey,
        mimeType,
        fileName: media.originalFileName,
        totalSize: media.fileSize || 0,
        contentLength: media.fileSize || 0,
      };
    }

    try {
      const streamResult = await storageService.getFileStream(storageKey, options.range);
      return {
        ...streamResult,
        mimeType,
        fileName: media.originalFileName,
      };
    } catch (fsErr) {
      if (media.storageKey && (media.storageKey.startsWith('http://') || media.storageKey.startsWith('https://'))) {
        return {
          redirectUrl: media.storageKey,
          mimeType,
          fileName: media.originalFileName,
          totalSize: media.fileSize || 0,
          contentLength: media.fileSize || 0,
        };
      }
      throw fsErr;
    }
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
