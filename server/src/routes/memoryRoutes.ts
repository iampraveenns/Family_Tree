import { Router } from 'express';
import multer from 'multer';
import { memoryController } from '../controllers/memoryController.ts';
import { memoryRepository } from '../repositories/memoryRepository.ts';
import { memoryService } from '../services/memoryService.ts';
import { mediaService } from '../services/mediaService.ts';
import { FamilyMembership } from '../models/FamilyMembership.ts';
import { Family } from '../models/Family.ts';
import { Media } from '../models/Media.ts';
import { MemoryType, MediaProcessingStatus, MemoryStatus } from '../constants/index.ts';
import { requireAuthentication } from '../middleware/auth.ts';
import { NotFoundError, ValidationError } from '../utils/errors.ts';
import { sendSuccess } from '../utils/apiResponse.ts';
import { config } from '../config/index.ts';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml', 'image/heic',
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/m4a', 'audio/aac', 'audio/x-m4a',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/ogg',
  'application/pdf', 'text/plain', 'text/markdown',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.MAX_FILE_SIZE_BYTES || 52428800,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new ValidationError(`Unsupported file type: unsupported or dangerous format (${file.mimetype}). Permitted formats: images, audio recordings, video files, PDFs and text documents.`));
    }
  },
});

const router = Router();

// Helper to resolve familyId
async function resolveFamilyId(req: any): Promise<string> {
  if (req.params.familyId) return req.params.familyId;
  if (req.body?.familyId) return req.body.familyId;
  if (req.query?.familyId) return req.query.familyId as string;
  const membership = await FamilyMembership.findOne({ userId: req.user?.userId, status: 'ACTIVE' });
  if (membership) return membership.familyId.toString();
  const family = await Family.findOne();
  if (family) return family._id.toString();
  throw new ValidationError('Family ID is required to access memories');
}

// Top-level POST /api/memories (handles JSON and video/media uploads)
router.post('/', requireAuthentication, upload.single('file') as any, async (req: any, res, next) => {
  try {
    const familyId = await resolveFamilyId(req);
    req.params.familyId = familyId;

    let declaredType = (req.body.memoryType || req.body.type || '').toUpperCase();
    const isVideoFile = req.file && (
      req.file.mimetype.startsWith('video/') ||
      ['.mp4', '.webm', '.mov', '.mkv', '.ogg'].some((ext) => req.file.originalname?.toLowerCase().endsWith(ext))
    );
    const isVideoUrl = req.body.mediaUrl && (
      ['.mp4', '.webm', '.mov', '.mkv'].some((ext) => req.body.mediaUrl.toLowerCase().includes(ext)) ||
      declaredType === 'VIDEO'
    );

    if (isVideoFile || isVideoUrl || declaredType === 'VIDEO') {
      declaredType = MemoryType.VIDEO;
    } else if (req.file && req.file.mimetype.startsWith('audio/')) {
      declaredType = MemoryType.AUDIO;
    } else if (req.file && req.file.mimetype.startsWith('image/')) {
      declaredType = MemoryType.PHOTO;
    } else if (!declaredType) {
      declaredType = req.file ? MemoryType.PHOTO : MemoryType.STORY;
    }

    const title = req.body.title?.trim() ||
      (req.file ? req.file.originalname.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : 'Family Memory');

    // Create memory
    const memory = await memoryService.createMemory(familyId, req.user.userId, {
      ...req.body,
      title,
      memoryType: declaredType,
    });

    let uploadedMedia: any = null;
    if (req.file) {
      uploadedMedia = await mediaService.uploadMedia(familyId, memory._id.toString(), req.user.userId, req.file);
    } else if (req.body.mediaUrl) {
      // Store direct mediaUrl in Media collection
      const isVid = declaredType === MemoryType.VIDEO;
      const mediaDoc = await Media.create({
        familyId,
        memoryId: memory._id,
        uploadedBy: req.user.userId,
        originalFileName: title,
        storageKey: req.body.mediaUrl,
        mimeType: isVid ? 'video/mp4' : 'image/jpeg',
        fileSize: 0,
        sha256Checksum: 'external-' + Date.now(),
        processingStatus: MediaProcessingStatus.READY,
        visibility: memory.visibility,
        status: MemoryStatus.ACTIVE,
      });
      if (mediaDoc) {
        await memoryRepository.update(memory._id, { coverMediaId: mediaDoc._id });
        uploadedMedia = {
          ...mediaDoc.toObject(),
          streamUrl: req.body.mediaUrl,
          url: req.body.mediaUrl,
        };
      }
    }

    const finalMemory = await memoryService.getMemoryById(familyId, memory._id.toString(), req.user.userId);
    sendSuccess(res, finalMemory, 'Memory created successfully', 201);
  } catch (err) {
    next(err);
  }
});

// Top-level GET /api/memories
router.get('/', requireAuthentication, async (req: any, res, next) => {
  try {
    const familyId = await resolveFamilyId(req);
    req.params.familyId = familyId;
    memoryController.getMemories(req, res, next);
  } catch (err) {
    next(err);
  }
});

router.get('/:memoryId', requireAuthentication, async (req, res, next) => {
  try {
    const memory = await memoryRepository.findById(req.params.memoryId);
    if (!memory) throw new NotFoundError('Memory not found');
    req.params.familyId = memory.familyId.toString();
    memoryController.getMemoryById(req, res, next);
  } catch (err) {
    next(err);
  }
});

router.patch('/:memoryId', requireAuthentication, async (req, res, next) => {
  try {
    const memory = await memoryRepository.findById(req.params.memoryId);
    if (!memory) throw new NotFoundError('Memory not found');
    req.params.familyId = memory.familyId.toString();
    memoryController.updateMemory(req, res, next);
  } catch (err) {
    next(err);
  }
});

router.delete('/:memoryId', requireAuthentication, async (req: any, res, next) => {
  try {
    const memory = await memoryRepository.findById(req.params.memoryId as string);
    if (!memory) throw new NotFoundError('Memory not found');
    req.params.familyId = memory.familyId.toString();
    memoryController.deleteMemory(req, res, next);
  } catch (err) {
    next(err);
  }
});

router.post('/:memoryId/media', requireAuthentication, upload.single('file') as any, async (req: any, res, next) => {
  try {
    const memory = await memoryRepository.findById(req.params.memoryId as string);
    if (!memory) throw new NotFoundError('Memory not found');
    req.params.familyId = memory.familyId.toString();
    memoryController.uploadMedia(req, res, next);
  } catch (err) {
    next(err);
  }
});

router.get('/:memoryId/media', requireAuthentication, async (req: any, res, next) => {
  try {
    const memory = await memoryRepository.findById(req.params.memoryId as string);
    if (!memory) throw new NotFoundError('Memory not found');
    req.params.familyId = memory.familyId.toString();
    memoryController.getMemoryMedia(req, res, next);
  } catch (err) {
    next(err);
  }
});

export default router;
