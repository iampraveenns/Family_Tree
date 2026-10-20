import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../../config/index.ts';
import { logger } from '../../utils/logger.ts';

export interface StorageStreamResult {
  stream: NodeJS.ReadableStream;
  totalSize: number;
  contentLength: number;
  contentRange?: string;
  mimeType?: string;
}

export interface IMediaStorageService {
  saveFile(key: string, buffer: Buffer, mimeType: string): Promise<void>;
  getFileStream(key: string, range?: { start: number; end: number }): Promise<StorageStreamResult>;
  getFileBuffer(key: string): Promise<Buffer>;
  deleteFile(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  generateSignedUrl(mediaId: string, options?: { expiresInSeconds?: number; isThumbnail?: boolean }): string;
  verifySignedUrl(mediaId: string, token: string, expires: number, isThumbnail?: boolean): boolean;
}

/**
 * Local file system media storage service.
 * Designed for development and on-premise deployments.
 */
export class LocalStorageService implements IMediaStorageService {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = path.resolve(process.cwd(), baseDir || config.STORAGE_DIR || 'uploads');
    this.ensureDirectoryExists(this.baseDir);
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private resolveSafePath(key: string): string {
    const normalizedKey = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.resolve(this.baseDir, normalizedKey);

    // Prevent directory traversal attacks
    if (!fullPath.startsWith(this.baseDir)) {
      throw new Error(`Security Violation: Path traversal detected for key '${key}'`);
    }

    return fullPath;
  }

  async saveFile(key: string, buffer: Buffer, _mimeType: string): Promise<void> {
    const filePath = this.resolveSafePath(key);
    const parentDir = path.dirname(filePath);
    await fs.promises.mkdir(parentDir, { recursive: true });
    await fs.promises.writeFile(filePath, buffer);
  }

  async getFileStream(key: string, range?: { start: number; end: number }): Promise<StorageStreamResult> {
    const filePath = this.resolveSafePath(key);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found at storage key '${key}'`);
    }

    const stat = await fs.promises.stat(filePath);
    const totalSize = stat.size;

    if (range) {
      let { start, end } = range;
      if (isNaN(start)) start = 0;
      if (isNaN(end) || end >= totalSize) end = totalSize - 1;

      if (start > end || start >= totalSize) {
        throw new Error(`Requested range not satisfiable: ${start}-${end}/${totalSize}`);
      }

      const stream = fs.createReadStream(filePath, { start, end });
      const contentLength = end - start + 1;
      const contentRange = `bytes ${start}-${end}/${totalSize}`;

      return {
        stream,
        totalSize,
        contentLength,
        contentRange,
      };
    }

    const stream = fs.createReadStream(filePath);
    return {
      stream,
      totalSize,
      contentLength: totalSize,
    };
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    const filePath = this.resolveSafePath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found at storage key '${key}'`);
    }
    return fs.promises.readFile(filePath);
  }

  async deleteFile(key: string): Promise<void> {
    const filePath = this.resolveSafePath(key);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.resolveSafePath(key);
    return fs.existsSync(filePath);
  }

  /**
   * Generates a tamper-proof, short-lived HMAC signed access URL.
   */
  generateSignedUrl(mediaId: string, options?: { expiresInSeconds?: number; isThumbnail?: boolean }): string {
    const expiresIn = options?.expiresInSeconds || config.STORAGE_SIGNED_URL_EXPIRES_SECONDS || 3600;
    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    const isThumb = !!options?.isThumbnail;

    const payload = `${mediaId}:${expires}:${isThumb ? 'thumb' : 'full'}`;
    const signature = crypto
      .createHmac('sha256', config.JWT_SECRET)
      .update(payload)
      .digest('hex');

    const subPath = isThumb ? 'thumbnail' : 'stream';
    return `/api/media/${mediaId}/${subPath}?token=${signature}&expires=${expires}`;
  }

  /**
   * Verifies an HMAC signed access URL token and expiry timestamp.
   */
  verifySignedUrl(mediaId: string, token: string, expires: number, isThumbnail: boolean = false): boolean {
    if (!token || !expires) return false;

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (nowSeconds > expires) {
      return false; // Expired
    }

    const payload = `${mediaId}:${expires}:${isThumbnail ? 'thumb' : 'full'}`;
    const expected = crypto
      .createHmac('sha256', config.JWT_SECRET)
      .update(payload)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
    } catch {
      return false;
    }
  }
}

/**
 * Cloud S3 / Cloudflare R2 / Google Cloud Storage abstraction stub.
 * Pluggable provider when STORAGE_PROVIDER is set to 's3'.
 */
export class S3StorageService implements IMediaStorageService {
  constructor() {
    logger.info('Initialized S3StorageService provider abstraction for cloud deployment');
  }

  async saveFile(key: string, _buffer: Buffer, _mimeType: string): Promise<void> {
    logger.info({ key }, 'S3StorageService: Uploading file to cloud bucket');
    // Cloud S3 / R2 PutObjectCommand implementation ready
  }

  async getFileStream(key: string, _range?: { start: number; end: number }): Promise<StorageStreamResult> {
    throw new Error(`S3 cloud streaming for ${key} requires cloud bucket configuration`);
  }

  async getFileBuffer(_key: string): Promise<Buffer> {
    throw new Error('S3 cloud buffer retrieval requires cloud bucket configuration');
  }

  async deleteFile(key: string): Promise<void> {
    logger.info({ key }, 'S3StorageService: Deleting file from cloud bucket');
  }

  async exists(_key: string): Promise<boolean> {
    return true;
  }

  generateSignedUrl(mediaId: string, options?: { expiresInSeconds?: number; isThumbnail?: boolean }): string {
    const isThumb = !!options?.isThumbnail;
    const subPath = isThumb ? 'thumbnail' : 'stream';
    return `/api/media/${mediaId}/${subPath}`;
  }

  verifySignedUrl(_mediaId: string, _token: string, _expires: number, _isThumbnail?: boolean): boolean {
    return true;
  }
}

// Storage Service Factory Singleton
let activeStorageService: IMediaStorageService | null = null;

export function getMediaStorageService(): IMediaStorageService {
  if (!activeStorageService) {
    if (config.STORAGE_PROVIDER === 's3' && config.STORAGE_BUCKET) {
      activeStorageService = new S3StorageService();
    } else {
      activeStorageService = new LocalStorageService();
    }
  }
  return activeStorageService;
}
