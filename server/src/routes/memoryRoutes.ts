import { Router } from 'express';
import multer from 'multer';
import { memoryController } from '../controllers/memoryController.ts';
import { memoryRepository } from '../repositories/memoryRepository.ts';
import { requireAuthentication } from '../middleware/auth.ts';
import { NotFoundError, ValidationError } from '../utils/errors.ts';
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

router.delete('/:memoryId', requireAuthentication, async (req, res, next) => {
  try {
    const memory = await memoryRepository.findById(req.params.memoryId);
    if (!memory) throw new NotFoundError('Memory not found');
    req.params.familyId = memory.familyId.toString();
    memoryController.deleteMemory(req, res, next);
  } catch (err) {
    next(err);
  }
});

router.post('/:memoryId/media', requireAuthentication, upload.single('file'), async (req, res, next) => {
  try {
    const memory = await memoryRepository.findById(req.params.memoryId);
    if (!memory) throw new NotFoundError('Memory not found');
    req.params.familyId = memory.familyId.toString();
    memoryController.uploadMedia(req, res, next);
  } catch (err) {
    next(err);
  }
});

router.get('/:memoryId/media', requireAuthentication, async (req, res, next) => {
  try {
    const memory = await memoryRepository.findById(req.params.memoryId);
    if (!memory) throw new NotFoundError('Memory not found');
    req.params.familyId = memory.familyId.toString();
    memoryController.getMemoryMedia(req, res, next);
  } catch (err) {
    next(err);
  }
});

export default router;
