import crypto from 'crypto';
import { Types } from 'mongoose';
import { FamilyBackup, IFamilyBackup } from '../../models/FamilyBackup.ts';
import { getMediaStorageService } from '../storage/MediaStorageService.ts';
import { archiveExportService } from './archiveExportService.ts';
import { archiveRestoreService } from './archiveRestoreService.ts';
import { auditService } from '../auditService.ts';
import { AuditAction } from '../../constants/index.ts';
import { NotFoundError } from '../../utils/errors.ts';
import { IRestoreExecutionResult, IRestoreValidationResult } from './archiveTypes.ts';

export class FamilyBackupService {
  private computeSha256(content: Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Creates a formal snapshot backup of the family, saves to local storage, and logs audit.
   */
  async createBackup(
    familyId: string,
    requestingUser: { userId: string; displayName?: string; email?: string },
    description?: string
  ): Promise<IFamilyBackup> {
    const familyObjectId = new Types.ObjectId(familyId);
    const userObjectId = new Types.ObjectId(requestingUser.userId);

    // 1. Generate full export archive
    const { archiveBuffer, manifest } = await archiveExportService.exportFamilyArchive(
      familyId,
      requestingUser
    );

    const backupId = `bk_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const storageKey = `families/${familyId}/backups/${backupId}.zip`;
    const checksum = this.computeSha256(archiveBuffer);

    // 2. Persist to storage
    const storageService = getMediaStorageService();
    await storageService.saveFile(storageKey, archiveBuffer, 'application/zip');

    // 3. Create database record
    const backup = new FamilyBackup({
      backupId,
      familyId: familyObjectId,
      storageKey,
      archiveSize: archiveBuffer.length,
      recordCounts: manifest.recordCounts,
      checksum,
      status: 'COMPLETED',
      schemaVersion: manifest.schemaVersion,
      createdBy: userObjectId,
      description: description || `Automated digital heritage snapshot by ${requestingUser.displayName || 'admin'}`,
    });

    await backup.save();

    // 4. Audit log
    await auditService.log(
      familyId,
      requestingUser.userId,
      AuditAction.BACKUP_CREATED,
      'FamilyBackup',
      backup._id.toString(),
      {
        backupId,
        archiveSize: archiveBuffer.length,
        checksum,
        recordCounts: manifest.recordCounts,
      }
    );

    return backup;
  }

  /**
   * Lists historical backups for a family in reverse chronological order.
   */
  async listBackups(familyId: string): Promise<IFamilyBackup[]> {
    const familyObjectId = new Types.ObjectId(familyId);
    return FamilyBackup.find({ familyId: familyObjectId })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'displayName email')
      .lean();
  }

  /**
   * Fetches backup metadata and binary content.
   */
  async getBackup(familyId: string, backupId: string): Promise<{ backup: IFamilyBackup; buffer: Buffer }> {
    const familyObjectId = new Types.ObjectId(familyId);
    const backup = await FamilyBackup.findOne({
      backupId,
      familyId: familyObjectId,
    });

    if (!backup) {
      throw new NotFoundError(`Backup with ID '${backupId}' not found for this family`);
    }

    const storageService = getMediaStorageService();
    const buffer = await storageService.getFileBuffer(backup.storageKey);

    return { backup, buffer };
  }

  /**
   * Deletes a backup record and its archive file from storage.
   */
  async deleteBackup(familyId: string, backupId: string, requestingUserId: string): Promise<void> {
    const familyObjectId = new Types.ObjectId(familyId);
    const backup = await FamilyBackup.findOne({
      backupId,
      familyId: familyObjectId,
    });

    if (!backup) {
      throw new NotFoundError(`Backup with ID '${backupId}' not found`);
    }

    const storageService = getMediaStorageService();
    await storageService.deleteFile(backup.storageKey).catch(() => {});
    await FamilyBackup.deleteOne({ _id: backup._id });

    await auditService.log(
      familyId,
      requestingUserId,
      AuditAction.BACKUP_DELETED,
      'FamilyBackup',
      backup._id.toString(),
      { backupId }
    );
  }

  /**
   * Validates a saved backup prior to restoration.
   */
  async validateBackup(
    familyId: string,
    backupId: string,
    requestingUser: { userId: string }
  ): Promise<IRestoreValidationResult> {
    const { buffer } = await this.getBackup(familyId, backupId);
    return archiveRestoreService.validateArchive(familyId, buffer, requestingUser);
  }

  /**
   * Restores a family from a previously recorded backup.
   */
  async restoreFromBackup(
    familyId: string,
    backupId: string,
    requestingUser: { userId: string; email?: string }
  ): Promise<IRestoreExecutionResult> {
    const { buffer } = await this.getBackup(familyId, backupId);
    return archiveRestoreService.executeRestore(familyId, buffer, requestingUser, {
      confirm: true,
      skipDuplicates: true,
      restoreMedia: true,
    });
  }
}

export const familyBackupService = new FamilyBackupService();
