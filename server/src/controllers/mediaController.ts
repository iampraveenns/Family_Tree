import { Request, Response, NextFunction } from 'express';
import { mediaService } from '../services/mediaService.ts';
import { sendSuccess } from '../utils/apiResponse.ts';
import { UnauthorizedError } from '../utils/errors.ts';

export class MediaController {
  async getMediaById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { mediaId } = req.params;
      const media = await mediaService.getMediaById(mediaId, req.user?.userId);
      sendSuccess(res, media, 'Media details retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async getMediaAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new UnauthorizedError('Authentication required to generate signed access token');
      }

      const { mediaId } = req.params;
      const access = await mediaService.getMediaAccess(mediaId, userId);
      sendSuccess(res, access, 'Signed access URL generated successfully');
    } catch (err) {
      next(err);
    }
  }

  async streamMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { mediaId } = req.params;
      const token = req.query.token as string | undefined;
      const expires = req.query.expires ? parseInt(req.query.expires as string, 10) : undefined;
      const download = req.query.download === 'true';

      // Parse HTTP Range header for video / audio seeking
      let range: { start: number; end: number } | undefined;
      const rangeHeader = req.headers.range;
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : NaN;
        if (!isNaN(start)) {
          range = { start, end };
        }
      }

      const streamResult = await mediaService.getMediaStream(mediaId, {
        token,
        expires,
        isThumbnail: false,
        actorUserId: req.user?.userId,
        range,
      });

      res.set({
        'Content-Type': streamResult.mimeType || 'application/octet-stream',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': download
          ? `attachment; filename="${encodeURIComponent(streamResult.fileName)}"`
          : `inline; filename="${encodeURIComponent(streamResult.fileName)}"`,
      });

      if (streamResult.contentRange) {
        res.status(206);
        res.set({
          'Content-Range': streamResult.contentRange,
          'Content-Length': String(streamResult.contentLength),
        });
      } else {
        res.status(200);
        res.set('Content-Length', String(streamResult.contentLength));
      }

      streamResult.stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }

  async streamThumbnail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { mediaId } = req.params;
      const token = req.query.token as string | undefined;
      const expires = req.query.expires ? parseInt(req.query.expires as string, 10) : undefined;

      const streamResult = await mediaService.getMediaStream(mediaId, {
        token,
        expires,
        isThumbnail: true,
        actorUserId: req.user?.userId,
      });

      res.set({
        'Content-Type': 'image/webp',
        'Content-Length': String(streamResult.contentLength),
        'Cache-Control': 'public, max-age=86400', // 24h cache for processed thumbs
      });

      streamResult.stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }

  async deleteMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new UnauthorizedError('Authentication required to delete media');
      }

      const { mediaId } = req.params;
      const result = await mediaService.deleteMedia(mediaId, userId);
      sendSuccess(res, result, 'Media removed successfully');
    } catch (err) {
      next(err);
    }
  }
}

export const mediaController = new MediaController();
