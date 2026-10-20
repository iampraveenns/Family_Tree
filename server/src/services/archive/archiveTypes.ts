import { Types } from 'mongoose';

export const CURRENT_ARCHIVE_SCHEMA_VERSION = '1.0.0';
export const SUPPORTED_ARCHIVE_VERSIONS = ['1.0.0', '1.0'];

export interface IArchiveExportedBy {
  userId: string;
  displayName: string;
  email: string;
}

export interface IArchiveRecordCounts {
  family: number;
  members: number;
  relationships: number;
  branches: number;
  timelineEvents: number;
  milestones: number;
  memories: number;
  media: number;
  collections: number;
  userAssociations: number;
  auditLogs: number;
}

export interface IArchiveManifest {
  format: 'FAMILYROOTS_ARCHIVE';
  schemaVersion: string;
  archiveId: string;
  familyId: string;
  familyName: string;
  exportedAt: string;
  exportedBy: IArchiveExportedBy;
  recordCounts: IArchiveRecordCounts;
  checksums: Record<string, string>; // path -> sha256
  mediaManifest?: Array<{
    mediaId: string;
    memoryId: string;
    originalFileName: string;
    mimeType: string;
    fileSize: number;
    archivePath: string;
    sha256Checksum: string;
  }>;
}

export interface IValidationIssue {
  level: 'ERROR' | 'WARNING' | 'INFO';
  category: 'MANIFEST' | 'CHECKSUM' | 'SCHEMA' | 'BOUNDARY' | 'RELATIONSHIP' | 'DUPLICATE' | 'MEDIA';
  message: string;
  entity?: string;
  recordId?: string;
}

export interface IEntityDiffSummary {
  total: number;
  toAdd: number;
  toSkip: number;
  rejected: number;
}

export interface IRestoreDryRunSummary {
  family: { name: string; action: 'KEEP_EXISTING_UPDATE_METADATA' | 'PRESERVE_EXISTING' };
  members: IEntityDiffSummary;
  relationships: IEntityDiffSummary;
  branches: IEntityDiffSummary;
  memories: IEntityDiffSummary;
  timelineEvents: IEntityDiffSummary;
  milestones: IEntityDiffSummary;
  collections: IEntityDiffSummary;
  media: { total: number; toAdd: number; missing: number };
}

export interface IRestoreValidationResult {
  isValid: boolean;
  canRestore: boolean;
  archiveId: string;
  sourceFamilyId: string;
  targetFamilyId: string;
  sourceFamilyName: string;
  schemaVersion: string;
  exportedAt: string;
  summary: IRestoreDryRunSummary;
  issues: IValidationIssue[];
  preview: {
    membersToAdd: Array<{ name: string; gender?: string; birthDate?: string }>;
    membersToSkip: Array<{ name: string; reason: string }>;
    relationshipsToAdd: Array<{ type: string; source: string; target: string }>;
    relationshipsToSkip: Array<{ type: string; reason: string }>;
    branchesToAdd: string[];
    memoriesToAdd: string[];
    timelineEventsToAdd: string[];
  };
  validationToken?: string;
}

export interface IRestoreOptions {
  dryRun?: boolean;
  confirm?: boolean;
  skipDuplicates?: boolean;
  restoreMedia?: boolean;
}

export interface IRestoreExecutionResult {
  success: boolean;
  archiveId: string;
  familyId: string;
  restoredAt: string;
  restoredBy: string;
  recordCounts: {
    membersAdded: number;
    membersSkipped: number;
    relationshipsAdded: number;
    relationshipsSkipped: number;
    branchesAdded: number;
    branchesSkipped: number;
    memoriesAdded: number;
    memoriesSkipped: number;
    timelineEventsAdded: number;
    timelineEventsSkipped: number;
    collectionsAdded: number;
    collectionsSkipped: number;
    mediaAdded: number;
  };
  warnings: string[];
}
