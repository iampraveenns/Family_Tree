import { Request, Response, NextFunction } from 'express';
import { archiveExportService } from '../services/archive/archiveExportService.ts';
import { archiveRestoreService } from '../services/archive/archiveRestoreService.ts';
import { familyBackupService } from '../services/archive/familyBackupService.ts';
import { sendSuccess } from '../utils/apiResponse.ts';
import { ValidationError } from '../utils/errors.ts';

export class BackupController {
  /**
   * Export family data and media as a structured, signed ZIP archive.
   * GET /api/families/:familyId/export
   */
  async exportArchive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId } = req.params;
      const user = {
        userId: req.user!.userId,
        displayName: req.user!.displayName,
        email: req.user!.email,
      };

      const { archiveBuffer, filename } = await archiveExportService.exportFamilyArchive(
        familyId,
        user
      );

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', archiveBuffer.length);
      res.status(200).send(archiveBuffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * List all stored backups for a family.
   * GET /api/families/:familyId/backups
   */
  async listBackups(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId } = req.params;
      const backups = await familyBackupService.listBackups(familyId);
      sendSuccess(res, backups, 'Family backups retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new snapshot backup.
   * POST /api/families/:familyId/backups
   */
  async createBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId } = req.params;
      const { description } = req.body || {};
      const user = {
        userId: req.user!.userId,
        displayName: req.user!.displayName,
        email: req.user!.email,
      };

      const backup = await familyBackupService.createBackup(familyId, user, description);
      sendSuccess(res, backup, 'Family backup created and archived successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Download a stored backup archive file.
   * GET /api/families/:familyId/backups/:backupId/download
   */
  async downloadBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId, backupId } = req.params;
      const { backup, buffer } = await familyBackupService.getBackup(familyId, backupId);

      const filename = `familyroots-backup-${backup.backupId}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a stored backup.
   * DELETE /api/families/:familyId/backups/:backupId
   */
  async deleteBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId, backupId } = req.params;
      await familyBackupService.deleteBackup(familyId, backupId, req.user!.userId);
      sendSuccess(res, null, 'Backup deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate an uploaded archive file before restoration.
   * POST /api/families/:familyId/restore/validate
   */
  async validateArchive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId } = req.params;
      let buffer: Buffer | null = null;

      if (req.file && req.file.buffer) {
        buffer = req.file.buffer;
      } else if (req.body.backupId) {
        const result = await familyBackupService.getBackup(familyId, req.body.backupId);
        buffer = result.buffer;
      }

      if (!buffer) {
        throw new ValidationError('Please provide a ZIP archive file or a valid backupId');
      }

      const validation = await archiveRestoreService.validateArchive(
        familyId,
        buffer,
        { userId: req.user!.userId }
      );

      sendSuccess(res, validation, 'Archive validation and dry-run preview complete');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Safely execute restore from an uploaded archive or stored backup.
   * POST /api/families/:familyId/restore/execute
   */
  async executeRestore(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId } = req.params;
      const confirm = req.body.confirm === true || req.body.confirm === 'true';

      if (!confirm) {
        throw new ValidationError(
          'Restore requires explicit confirmation (confirm: true) before proceeding.'
        );
      }

      let buffer: Buffer | null = null;
      if (req.file && req.file.buffer) {
        buffer = req.file.buffer;
      } else if (req.body.backupId) {
        const result = await familyBackupService.getBackup(familyId, req.body.backupId);
        buffer = result.buffer;
      }

      if (!buffer) {
        throw new ValidationError('Please upload an archive file or specify a backupId to restore');
      }

      const result = await archiveRestoreService.executeRestore(
        familyId,
        buffer,
        { userId: req.user!.userId, email: req.user!.email },
        { confirm: true, skipDuplicates: true, restoreMedia: true }
      );

      sendSuccess(res, result, 'Family data successfully restored without overwriting existing records');
    } catch (error) {
      next(error);
    }
  }
}

export const backupController = new BackupController();
