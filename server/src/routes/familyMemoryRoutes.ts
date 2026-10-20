import { Router } from 'express';
import multer from 'multer';
import { memoryController } from '../controllers/memoryController.ts';
import { requireAuthentication } from '../middleware/auth.ts';
import { config } from '../config/index.ts';
import { ValidationError } from '../utils/errors.ts';

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

const router = Router({ mergeParams: true });

// Specialized query endpoints (must precede /:memoryId param route)
router.get('/stats', requireAuthentication, (req, res, next) => {
  memoryController.getStats(req, res, next);
});

router.get('/on-this-day', requireAuthentication, (req, res, next) => {
  memoryController.getOnThisDay(req, res, next);
});

router.get('/check-duplicate', requireAuthentication, (req, res, next) => {
  memoryController.checkDuplicateMedia(req, res, next);
});

router.post('/check-duplicate', requireAuthentication, (req, res, next) => {
  memoryController.checkDuplicateMedia(req, res, next);
});

// Primary Memories CRUD
router.post('/', requireAuthentication, (req, res, next) => {
  memoryController.createMemory(req, res, next);
});

router.get('/', requireAuthentication, (req, res, next) => {
  memoryController.getMemories(req, res, next);
});

router.get('/:memoryId', requireAuthentication, (req, res, next) => {
  memoryController.getMemoryById(req, res, next);
});

router.patch('/:memoryId', requireAuthentication, (req, res, next) => {
  memoryController.updateMemory(req, res, next);
});

router.delete('/:memoryId', requireAuthentication, (req, res, next) => {
  memoryController.deleteMemory(req, res, next);
});

// Multipart Media Upload & Media List for Memory
router.post('/:memoryId/media', requireAuthentication, upload.single('file'), (req, res, next) => {
  memoryController.uploadMedia(req, res, next);
});

router.get('/:memoryId/media', requireAuthentication, (req, res, next) => {
  memoryController.getMemoryMedia(req, res, next);
});

export default router;
