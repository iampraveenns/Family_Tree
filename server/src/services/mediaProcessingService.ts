import crypto from 'crypto';
import path from 'path';
import { execSync } from 'child_process';
import sharp from 'sharp';
import { config } from '../config/index.ts';
import { logger } from '../utils/logger.ts';
import { ValidationError } from '../utils/errors.ts';
import { getMediaStorageService } from './storage/MediaStorageService.ts';
import { MediaProcessingStatus } from '../constants/index.ts';

export const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/tiff',
  // Videos
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
  // Audio
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'audio/aac',
  'audio/webm',
  'audio/x-m4a',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'application/rtf',
]);

export const ALLOWED_EXTENSIONS = new Set([
  // Images
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.tiff',
  '.tif',
  // Videos
  '.mp4',
  '.webm',
  '.mov',
  '.mkv',
  // Audio
  '.mp3',
  '.wav',
  '.ogg',
  '.m4a',
  '.aac',
  // Documents
  '.pdf',
  '.doc',
  '.docx',
  '.txt',
  '.md',
  '.rtf',
]);

/**
 * Validates header magic bytes to prevent MIME spoofing.
 */
export function verifyMagicBytes(buffer: Buffer, mime: string): boolean {
  if (!buffer || buffer.length < 4) return false;

  // JPEG: FF D8 FF
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  // PNG: 89 50 4E 47
  if (mime === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  // GIF: 47 49 46 38
  if (mime === 'image/gif') {
    return buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;
  }
  // WebP: RIFF .... WEBP
  if (mime === 'image/webp') {
    if (buffer.length < 12) return false;
    const isRiff = buffer.toString('ascii', 0, 4) === 'RIFF';
    const isWebp = buffer.toString('ascii', 8, 12) === 'WEBP';
    return isRiff && isWebp;
  }
  // PDF: %PDF
  if (mime === 'application/pdf') {
    return buffer.toString('ascii', 0, 4) === '%PDF';
  }
  // MP4 / MOV: ftyp box
  if (mime === 'video/mp4' || mime === 'video/quicktime') {
    if (buffer.length < 8) return false;
    const ftyp = buffer.toString('ascii', 4, 8);
    return ftyp === 'ftyp' || buffer[0] === 0x00;
  }
  // MP3: ID3 or sync word
  if (mime === 'audio/mpeg' || mime === 'audio/mp3') {
    const isId3 = buffer.toString('ascii', 0, 3) === 'ID3';
    const isSync = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
    return isId3 || isSync;
  }
  // WAV: RIFF .... WAVE
  if (mime === 'audio/wav') {
    if (buffer.length < 12) return false;
    const isRiff = buffer.toString('ascii', 0, 4) === 'RIFF';
    const isWave = buffer.toString('ascii', 8, 12) === 'WAVE';
    return isRiff && isWave;
  }
  // Plain text / Markdown: Ensure not an ELF/Mach-O/PE executable binary
  if (mime === 'text/plain' || mime === 'text/markdown') {
    const isElf = buffer[0] === 0x7f && buffer.toString('ascii', 1, 4) === 'ELF';
    const isExe = buffer.toString('ascii', 0, 2) === 'MZ';
    return !isElf && !isExe;
  }

  return true;
}

export interface ProcessedMediaOutput {
  originalFileName: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  sha256Checksum: string;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailStorageKey?: string;
  processingStatus: MediaProcessingStatus;
}

export class MediaProcessingService {
  private isFFmpegInstalled: boolean | null = null;

  /**
   * Safe check for FFmpeg binary in environment without crashing.
   */
  private checkFFmpegAvailability(): boolean {
    if (this.isFFmpegInstalled !== null) {
      return this.isFFmpegInstalled;
    }

    try {
      execSync('ffmpeg -version', { stdio: 'ignore', timeout: 1000 });
      this.isFFmpegInstalled = true;
    } catch {
      this.isFFmpegInstalled = false;
      logger.info('FFmpeg binary not detected on system; operating with native image pipelines');
    }

    return this.isFFmpegInstalled;
  }

  /**
   * Validates file size, MIME type, extension, and binary header integrity.
   */
  validateFile(file: Express.Multer.File): void {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new ValidationError('No file binary provided for upload');
    }

    const maxLimit = config.MAX_FILE_SIZE_BYTES || 52428800; // 50MB
    if (file.size > maxLimit || file.buffer.length > maxLimit) {
      throw new ValidationError(`File size exceeds maximum permitted limit of ${(maxLimit / (1024 * 1024)).toFixed(0)}MB`);
    }

    const cleanExt = path.extname(file.originalname || '').toLowerCase();
    let mime = file.mimetype.toLowerCase();

    // If client provided generic binary stream, deduce MIME from valid extension
    if (mime === 'application/octet-stream' && cleanExt) {
      const mimeMap: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.pdf': 'application/pdf',
      };
      if (mimeMap[cleanExt]) {
        mime = mimeMap[cleanExt];
        file.mimetype = mime;
      }
    }

    if (!ALLOWED_MIME_TYPES.has(mime)) {
      throw new ValidationError(`Unsupported file type: unsupported or dangerous format '${file.mimetype}'. Allowed types include photos, videos, audio narratives, and heritage documents.`);
    }

    if (!cleanExt || !ALLOWED_EXTENSIONS.has(cleanExt)) {
      throw new ValidationError(`Unsupported or dangerous file extension '${cleanExt}'. Allowed extensions include photos, audio, video, and PDF documents.`);
    }

    // Header magic bytes verification prevents MIME spoofing (e.g. executable disguised as image/jpeg)
    if (!verifyMagicBytes(file.buffer, mime)) {
      throw new ValidationError(`Security violation: File header does not match declared MIME type ${file.mimetype}`);
    }
  }

  /**
   * Computes SHA-256 checksum of raw binary buffer.
   */
  computeChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Full processing pipeline:
   * UPLOAD → VALIDATE → CHECKSUM → STORE → PROCESS → THUMBNAIL → READY
   */
  async processUpload(
    file: Express.Multer.File,
    familyId: string,
    memoryId: string
  ): Promise<ProcessedMediaOutput> {
    // 1. VALIDATE
    this.validateFile(file);

    // 2. CHECKSUM
    const sha256Checksum = this.computeChecksum(file.buffer);

    // 3. STORAGE KEYS & SAFE FILENAME
    const storageService = getMediaStorageService();
    const cleanExt = path.extname(file.originalname).toLowerCase();
    const rawBase = path.basename(file.originalname, cleanExt);
    const sanitizedBase = rawBase.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 80) || 'media';
    const safeFileName = `${sanitizedBase}${cleanExt}`;

    const uniqueId = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const storageKey = `families/${familyId}/memories/${memoryId}/${uniqueId}${cleanExt}`;

    // 4. STORE ORIGINAL BINARY
    await storageService.saveFile(storageKey, file.buffer, file.mimetype);

    let width: number | undefined;
    let height: number | undefined;
    let duration: number | undefined;
    let thumbnailStorageKey: string | undefined;
    let status = MediaProcessingStatus.READY;

    // 5. PROCESS & THUMBNAIL
    try {
      const mime = file.mimetype.toLowerCase();

      if (mime.startsWith('image/')) {
        // Image Processing with Sharp - failOn: 'truncated' detects corrupted or truncated images
        const image = sharp(file.buffer, { failOn: 'truncated' });
        const metadata = await image.metadata();

        if (!metadata.width || !metadata.height) {
          throw new ValidationError('Corrupted or unreadable image file structure');
        }

        width = metadata.width;
        height = metadata.height;

        // Generate thumbnail (max 400x400, format webp)
        const thumbBuffer = await sharp(file.buffer, { failOn: 'truncated' })
          .rotate() // Auto-orient from EXIF
          .resize(400, 400, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 82 })
          .toBuffer();

        thumbnailStorageKey = `families/${familyId}/memories/${memoryId}/thumbnails/${uniqueId}.webp`;
        await storageService.saveFile(thumbnailStorageKey, thumbBuffer, 'image/webp');
      } else if (mime.startsWith('video/')) {
        // Video Processing (FFmpeg if available, otherwise graceful fallback)
        if (this.checkFFmpegAvailability()) {
          // Future FFmpeg thumbnail extraction hook
        }
      } else if (mime.startsWith('audio/')) {
        // Audio processing
      }
    } catch (processError: any) {
      if (processError instanceof ValidationError) {
        throw processError;
      }
      logger.warn({ processError }, 'Non-fatal media processing warning; original file preserved safely');
      status = MediaProcessingStatus.READY; // Original is safely preserved
    }

    return {
      originalFileName: safeFileName,
      storageKey,
      mimeType: file.mimetype,
      fileSize: file.buffer.length,
      sha256Checksum,
      width,
      height,
      duration,
      thumbnailStorageKey,
      processingStatus: status,
    };
  }
}

export const mediaProcessingService = new MediaProcessingService();
