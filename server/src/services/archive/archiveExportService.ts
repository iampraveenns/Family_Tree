import crypto from 'crypto';
import JSZip from 'jszip';
import { Types } from 'mongoose';
import { Family } from '../../models/Family.ts';
import { FamilyMember } from '../../models/FamilyMember.ts';
import { Relationship } from '../../models/Relationship.ts';
import { Branch } from '../../models/Branch.ts';
import { FamilyEvent } from '../../models/FamilyEvent.ts';
import { Memory } from '../../models/Memory.ts';
import { MemoryCollection } from '../../models/MemoryCollection.ts';
import { Media } from '../../models/Media.ts';
import { FamilyMembership } from '../../models/FamilyMembership.ts';
import { AuditLog } from '../../models/AuditLog.ts';
import { getMediaStorageService } from '../storage/MediaStorageService.ts';
import { auditService } from '../auditService.ts';
import { AuditAction } from '../../constants/index.ts';
import { NotFoundError } from '../../utils/errors.ts';
import {
  CURRENT_ARCHIVE_SCHEMA_VERSION,
  IArchiveManifest,
  IArchiveRecordCounts,
} from './archiveTypes.ts';

export class ArchiveExportService {
  private computeSha256(content: Buffer | string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Generates a comprehensive, secure, structured FamilyRoots ZIP archive.
   */
  async exportFamilyArchive(
    familyId: string,
    requestingUser: { userId: string; displayName?: string; email?: string }
  ): Promise<{ archiveBuffer: Buffer; manifest: IArchiveManifest; filename: string }> {
    const familyObjectId = new Types.ObjectId(familyId);

    // 1. Verify family existence
    const family = await Family.findById(familyObjectId).lean();
    if (!family) {
      throw new NotFoundError(`Family with ID '${familyId}' not found`);
    }

    // 2. Fetch all domain entities strictly scoped to this family
    const [
      members,
      relationships,
      branches,
      timelineEvents,
      memories,
      collections,
      memberships,
      auditLogs,
      familyMedia,
    ] = await Promise.all([
      FamilyMember.find({ familyId: familyObjectId }).lean(),
      Relationship.find({ familyId: familyObjectId }).lean(),
      Branch.find({ familyId: familyObjectId }).lean(),
      FamilyEvent.find({ familyId: familyObjectId }).lean(),
      Memory.find({ familyId: familyObjectId }).lean(),
      MemoryCollection.find({ familyId: familyObjectId }).lean(),
      FamilyMembership.find({ familyId: familyObjectId })
        .populate('userId', 'displayName email status')
        .populate('memberId', 'firstName lastName')
        .lean(),
      AuditLog.find({ familyId: familyObjectId })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
      Media.find({ familyId: familyObjectId }).lean(),
    ]);

    // 3. Sanitize data to guarantee zero credential or token leakage
    const sanitizedFamily = {
      _id: family._id.toString(),
      name: family.name,
      description: family.description,
      coverImage: family.coverImage,
      originPlace: family.originPlace,
      motto: family.motto,
      settings: family.settings,
      createdAt: family.createdAt,
      updatedAt: family.updatedAt,
    };

    const sanitizedMembers = members.map((m: any) => ({
      _id: m._id.toString(),
      firstName: m.firstName,
      middleName: m.middleName,
      lastName: m.lastName,
      displayName: m.displayName,
      nickname: m.nickname,
      gender: m.gender,
      profilePhoto: m.profilePhoto,
      dateOfBirth: m.dateOfBirth,
      dateOfDeath: m.dateOfDeath,
      isLiving: m.isLiving,
      birthPlace: m.birthPlace,
      deathPlace: m.deathPlace,
      occupation: m.occupation,
      education: m.education,
      biography: m.biography,
      branchIds: Array.isArray(m.branchIds) ? m.branchIds.map((id: any) => id.toString()) : [],
      generation: m.generation,
      isArchived: m.isArchived,
      privacySettings: m.privacySettings,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));

    const sanitizedRelationships = relationships.map((r: any) => ({
      _id: r._id.toString(),
      sourceMemberId: r.sourceMemberId.toString(),
      targetMemberId: r.targetMemberId.toString(),
      relationshipType: r.relationshipType,
      status: r.status,
      metadata: r.metadata,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    const sanitizedBranches = branches.map((b: any) => ({
      _id: b._id.toString(),
      name: b.name,
      description: b.description,
      rootMemberId: b.rootMemberId ? b.rootMemberId.toString() : null,
      coverImage: b.coverImage,
      accentColor: b.accentColor,
      visibility: b.visibility,
      isArchived: b.isArchived,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));

    const sanitizedEvents = timelineEvents.map((e: any) => ({
      _id: e._id.toString(),
      title: e.title,
      description: e.description,
      eventType: e.eventType,
      eventDate: e.eventDate,
      approximateDate: e.approximateDate,
      era: e.era,
      location: e.location,
      memberIds: Array.isArray(e.memberIds) ? e.memberIds.map((m: any) => m.toString()) : [],
      branchIds: Array.isArray(e.branchIds) ? e.branchIds.map((b: any) => b.toString()) : [],
      memoryIds: Array.isArray(e.memoryIds) ? e.memoryIds.map((m: any) => m.toString()) : [],
      coverMediaId: e.coverMediaId ? e.coverMediaId.toString() : null,
      importance: e.importance,
      notes: e.notes,
      isMilestone: e.isMilestone,
      visibility: e.visibility,
      status: e.status,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));

    const sanitizedMemories = memories.map((m: any) => ({
      _id: m._id.toString(),
      title: m.title,
      description: m.description,
      memoryType: m.memoryType,
      eventDate: m.eventDate,
      eventDateApprox: m.eventDateApprox,
      location: m.location,
      memberIds: Array.isArray(m.memberIds) ? m.memberIds.map((id: any) => id.toString()) : [],
      branchIds: Array.isArray(m.branchIds) ? m.branchIds.map((id: any) => id.toString()) : [],
      tags: m.tags || [],
      visibility: m.visibility,
      coverMediaId: m.coverMediaId ? m.coverMediaId.toString() : null,
      collectionIds: Array.isArray(m.collectionIds) ? m.collectionIds.map((id: any) => id.toString()) : [],
      status: m.status,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));

    const sanitizedCollections = collections.map((c: any) => ({
      _id: c._id.toString(),
      title: c.title,
      description: c.description,
      memoryIds: Array.isArray(c.memoryIds) ? c.memoryIds.map((id: any) => id.toString()) : [],
      coverMediaId: c.coverMediaId ? c.coverMediaId.toString() : null,
      isCurated: c.isCurated,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    // Sanitized memberships: never expose passwordHash, salt, or auth tokens
    const sanitizedMemberships = memberships.map((ms: any) => ({
      _id: ms._id.toString(),
      role: ms.role,
      status: ms.status,
      userDisplayName: ms.userId?.displayName || 'Family Contributor',
      userEmail: ms.userId?.email || '',
      linkedMemberId: ms.memberId ? (ms.memberId._id ? ms.memberId._id.toString() : ms.memberId.toString()) : null,
      createdAt: ms.createdAt,
      updatedAt: ms.updatedAt,
    }));

    // Sanitized audit logs: only family-specific safe historical actions
    const sanitizedAudit = auditLogs.map((a: any) => ({
      _id: a._id.toString(),
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      details: a.details,
      createdAt: a.createdAt,
    }));

    // 4. Build ZIP structure with JSZip
    const zip = new JSZip();
    const storageService = getMediaStorageService();
    const checksums: Record<string, string> = {};

    const addJsonFile = (filePath: string, data: any) => {
      const formatted = JSON.stringify(data, null, 2);
      const buffer = Buffer.from(formatted, 'utf-8');
      checksums[filePath] = this.computeSha256(buffer);
      zip.file(filePath, buffer);
    };

    // Add JSON collections
    addJsonFile('data/family.json', sanitizedFamily);
    addJsonFile('data/members.json', sanitizedMembers);
    addJsonFile('data/relationships.json', sanitizedRelationships);
    addJsonFile('data/branches.json', sanitizedBranches);
    addJsonFile('data/events.json', sanitizedEvents);
    addJsonFile('data/memories.json', sanitizedMemories);
    addJsonFile('data/collections.json', sanitizedCollections);
    addJsonFile('data/memberships.json', sanitizedMemberships);
    addJsonFile('data/audit_summary.json', sanitizedAudit);

    // 5. Gather and package media files
    const mediaManifest: IArchiveManifest['mediaManifest'] = [];
    const mediaFolder = zip.folder('media');

    for (const med of familyMedia) {
      if (!med.storageKey) continue;
      try {
        const fileBuffer = await storageService.getFileBuffer(med.storageKey);
        const safeName = (med.originalFileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
        const mediaPath = `media/${med._id}_${safeName}`;
        const sha = this.computeSha256(fileBuffer);

        checksums[mediaPath] = sha;
        if (mediaFolder) {
          mediaFolder.file(`${med._id}_${safeName}`, fileBuffer);
        }

        mediaManifest.push({
          mediaId: med._id.toString(),
          memoryId: med.memoryId ? med.memoryId.toString() : '',
          originalFileName: med.originalFileName,
          mimeType: med.mimeType,
          fileSize: med.fileSize || fileBuffer.length,
          archivePath: mediaPath,
          sha256Checksum: sha,
        });
      } catch (mediaErr) {
        // Continue gracefully if a single media file is not present on disk
      }
    }

    // 6. Record counts
    const recordCounts: IArchiveRecordCounts = {
      family: 1,
      members: sanitizedMembers.length,
      relationships: sanitizedRelationships.length,
      branches: sanitizedBranches.length,
      timelineEvents: sanitizedEvents.length,
      milestones: sanitizedEvents.filter((e) => e.isMilestone).length,
      memories: sanitizedMemories.length,
      media: mediaManifest.length,
      collections: sanitizedCollections.length,
      userAssociations: sanitizedMemberships.length,
      auditLogs: sanitizedAudit.length,
    };

    const archiveId = `fa_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const exportedAt = new Date().toISOString();

    // 7. Create README.txt
    const readmeContent = `================================================================================
FamilyRoots Heritage Digital Archive
================================================================================
Family Name:    ${family.name}
Family ID:      ${family._id.toString()}
Archive ID:     ${archiveId}
Exported At:    ${exportedAt}
Schema Version: ${CURRENT_ARCHIVE_SCHEMA_VERSION}
Exported By:    ${requestingUser.displayName || requestingUser.email || requestingUser.userId}

ARCHIVE OVERVIEW:
-----------------
This digital preservation archive contains complete multi-generational lineage
data, relationships, historical timelines, treasured family memories, and media assets.

ARCHIVE STRUCTURE:
- manifest.json: Cryptographic manifest with SHA-256 integrity checksums and record metrics.
- README.txt: This document explaining archive structure and restoration procedures.
- data/
  * family.json: Family registry details, motto, and privacy configurations.
  * members.json: Family members, vital dates, bios, and biographical attributes.
  * relationships.json: Kinship links, parent-child, spouse, and sibling connections.
  * branches.json: Distinct branch houses, colors, and ancestral geographical roots.
  * events.json: Chronological timeline records and family milestones.
  * memories.json: Preserved photographs, audio stories, recipes, and document records.
  * collections.json: Curated story albums and memory collections.
  * memberships.json: Contributor affiliations and lineage member bindings.
  * audit_summary.json: Historical timeline of major lineage updates and preservation logs.
- media/
  * Binary assets including photographs, voice recordings, document scans, and culinary notes.

DATA RESTORATION & PORTABILITY:
-------------------------------
To restore or migrate this archive to FamilyRoots:
1. Navigate to Settings > Data & Backup in FamilyRoots.
2. Select "Restore Family Data" and upload this ZIP file.
3. Review the preview and duplicate analysis.
4. Confirm to import without overwriting existing family records.

CONFIDENTIALITY NOTICE:
-----------------------
This archive contains private genealogical records and family heirlooms.
Store securely in an encrypted backup or physical storage vault.
================================================================================
`;
    const readmeBuffer = Buffer.from(readmeContent, 'utf-8');
    checksums['README.txt'] = this.computeSha256(readmeBuffer);
    zip.file('README.txt', readmeBuffer);

    // 8. Create manifest.json
    const manifest: IArchiveManifest = {
      format: 'FAMILYROOTS_ARCHIVE',
      schemaVersion: CURRENT_ARCHIVE_SCHEMA_VERSION,
      archiveId,
      familyId: family._id.toString(),
      familyName: family.name,
      exportedAt,
      exportedBy: {
        userId: requestingUser.userId,
        displayName: requestingUser.displayName || 'Family Administrator',
        email: requestingUser.email || '',
      },
      recordCounts,
      checksums,
      mediaManifest,
    };

    const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8');
    zip.file('manifest.json', manifestBuffer);

    // 9. Generate final ZIP buffer
    const archiveBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    // 10. Audit log
    await auditService.log(
      familyId,
      requestingUser.userId,
      AuditAction.ARCHIVE_EXPORTED,
      'Family',
      familyId,
      {
        archiveId,
        recordCounts,
        archiveSize: archiveBuffer.length,
        mediaCount: mediaManifest.length,
      }
    );

    const safeFamilyName = family.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `familyroots-${safeFamilyName}-${dateStr}-${archiveId.slice(-6)}.zip`;

    return {
      archiveBuffer,
      manifest,
      filename,
    };
  }
}

export const archiveExportService = new ArchiveExportService();
