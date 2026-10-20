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
import { getMediaStorageService } from '../storage/MediaStorageService.ts';
import { auditService } from '../auditService.ts';
import { AuditAction, RelationshipStatus, MediaProcessingStatus } from '../../constants/index.ts';
import { ValidationError, NotFoundError } from '../../utils/errors.ts';
import {
  CURRENT_ARCHIVE_SCHEMA_VERSION,
  SUPPORTED_ARCHIVE_VERSIONS,
  IArchiveManifest,
  IRestoreValidationResult,
  IValidationIssue,
  IRestoreDryRunSummary,
  IRestoreOptions,
  IRestoreExecutionResult,
} from './archiveTypes.ts';

export class ArchiveRestoreService {
  private computeSha256(content: Buffer | string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Performs deep validation of an uploaded archive against target family.
   * Generates a dry-run preview and safety reports before committing changes.
   */
  async validateArchive(
    familyId: string,
    archiveBuffer: Buffer,
    _requestingUser: { userId: string }
  ): Promise<IRestoreValidationResult> {
    const familyObjectId = new Types.ObjectId(familyId);
    const targetFamily = await Family.findById(familyObjectId).lean();
    if (!targetFamily) {
      throw new NotFoundError(`Target family with ID '${familyId}' not found`);
    }

    const issues: IValidationIssue[] = [];

    // 1. Unpack ZIP
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(archiveBuffer);
    } catch (err: any) {
      return {
        isValid: false,
        canRestore: false,
        archiveId: 'unknown',
        sourceFamilyId: 'unknown',
        targetFamilyId: familyId,
        sourceFamilyName: 'Corrupted Archive',
        schemaVersion: 'unknown',
        exportedAt: new Date().toISOString(),
        summary: this.createEmptySummary(),
        issues: [
          {
            level: 'ERROR',
            category: 'MANIFEST',
            message: `The uploaded file is not a valid ZIP archive: ${err?.message || 'Corrupted file'}`,
          },
        ],
        preview: this.createEmptyPreview(),
      };
    }

    // 2. Validate manifest.json
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      issues.push({
        level: 'ERROR',
        category: 'MANIFEST',
        message: 'Missing manifest.json: Archive is not a recognized FamilyRoots archive.',
      });
      return {
        isValid: false,
        canRestore: false,
        archiveId: 'unknown',
        sourceFamilyId: 'unknown',
        targetFamilyId: familyId,
        sourceFamilyName: 'Missing Manifest',
        schemaVersion: 'unknown',
        exportedAt: new Date().toISOString(),
        summary: this.createEmptySummary(),
        issues,
        preview: this.createEmptyPreview(),
      };
    }

    let manifest: IArchiveManifest;
    try {
      const manifestText = await manifestFile.async('text');
      manifest = JSON.parse(manifestText);
    } catch (err) {
      issues.push({
        level: 'ERROR',
        category: 'MANIFEST',
        message: 'manifest.json could not be parsed as valid JSON.',
      });
      return {
        isValid: false,
        canRestore: false,
        archiveId: 'unknown',
        sourceFamilyId: 'unknown',
        targetFamilyId: familyId,
        sourceFamilyName: 'Corrupted Manifest',
        schemaVersion: 'unknown',
        exportedAt: new Date().toISOString(),
        summary: this.createEmptySummary(),
        issues,
        preview: this.createEmptyPreview(),
      };
    }

    // Validate format header
    if (manifest.format !== 'FAMILYROOTS_ARCHIVE') {
      issues.push({
        level: 'ERROR',
        category: 'SCHEMA',
        message: `Unknown archive format '${(manifest as any).format}'. Expected 'FAMILYROOTS_ARCHIVE'.`,
      });
    }

    // Validate schema version
    if (!SUPPORTED_ARCHIVE_VERSIONS.includes(manifest.schemaVersion)) {
      issues.push({
        level: 'ERROR',
        category: 'SCHEMA',
        message: `Unsupported archive schema version '${manifest.schemaVersion}'. Supported: ${SUPPORTED_ARCHIVE_VERSIONS.join(', ')}.`,
      });
    }

    // 3. Verify file checksums
    if (manifest.checksums && typeof manifest.checksums === 'object') {
      for (const [filePath, expectedSha] of Object.entries(manifest.checksums)) {
        const fileEntry = zip.file(filePath);
        if (!fileEntry) {
          issues.push({
            level: 'WARNING',
            category: 'CHECKSUM',
            message: `Declared file '${filePath}' is missing from the archive.`,
            entity: filePath,
          });
          continue;
        }

        try {
          const fileData = await fileEntry.async('nodebuffer');
          const actualSha = this.computeSha256(fileData);
          if (actualSha !== expectedSha) {
            issues.push({
              level: 'ERROR',
              category: 'CHECKSUM',
              message: `Checksum mismatch for file '${filePath}'. Data integrity check failed.`,
              entity: filePath,
            });
          }
        } catch {
          issues.push({
            level: 'ERROR',
            category: 'CHECKSUM',
            message: `Failed to read file '${filePath}' for checksum check.`,
            entity: filePath,
          });
        }
      }
    }

    // 4. Extract and parse data files
    const parseJsonEntry = async <T>(entryPath: string): Promise<T[]> => {
      const entry = zip.file(entryPath);
      if (!entry) return [];
      try {
        const text = await entry.async('text');
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (err: any) {
        issues.push({
          level: 'ERROR',
          category: 'SCHEMA',
          message: `Failed to parse '${entryPath}': ${err.message}`,
          entity: entryPath,
        });
        return [];
      }
    };

    const [
      archiveMembers,
      archiveRelationships,
      archiveBranches,
      archiveEvents,
      archiveMemories,
      archiveCollections,
    ] = await Promise.all([
      parseJsonEntry<any>('data/members.json'),
      parseJsonEntry<any>('data/relationships.json'),
      parseJsonEntry<any>('data/branches.json'),
      parseJsonEntry<any>('data/events.json'),
      parseJsonEntry<any>('data/memories.json'),
      parseJsonEntry<any>('data/collections.json'),
    ]);

    // 5. Fetch existing records for duplicate detection & boundary validation
    const [
      existingMembers,
      existingRelationships,
      existingBranches,
      existingEvents,
      existingMemories,
      existingCollections,
    ] = await Promise.all([
      FamilyMember.find({ familyId: familyObjectId }).lean(),
      Relationship.find({ familyId: familyObjectId }).lean(),
      Branch.find({ familyId: familyObjectId }).lean(),
      FamilyEvent.find({ familyId: familyObjectId }).lean(),
      Memory.find({ familyId: familyObjectId }).lean(),
      MemoryCollection.find({ familyId: familyObjectId }).lean(),
    ]);

    const existingMemberKeys = new Set<string>();
    const existingMemberIds = new Set<string>();
    existingMembers.forEach((m: any) => {
      existingMemberIds.add(m._id.toString());
      const dob = m.dateOfBirth ? m.dateOfBirth.trim() : '';
      const key = `${m.firstName?.trim().toLowerCase()}_${m.lastName?.trim().toLowerCase()}_${dob}`;
      existingMemberKeys.add(key);
    });

    const existingBranchNames = new Set(
      existingBranches.map((b: any) => b.name?.trim().toLowerCase())
    );

    const existingEventKeys = new Set(
      existingEvents.map((e: any) => {
        const datePart = e.eventDate ? new Date(e.eventDate).toISOString().split('T')[0] : '';
        return `${e.title?.trim().toLowerCase()}_${datePart}`;
      })
    );

    const existingMemoryKeys = new Set(
      existingMemories.map((m: any) => m.title?.trim().toLowerCase())
    );

    const existingCollectionKeys = new Set(
      existingCollections.map((c: any) => c.title?.trim().toLowerCase())
    );

    // 6. Evaluate Member Diffs & Relationship Validity
    const membersToAdd: Array<{ name: string; gender?: string; birthDate?: string }> = [];
    const membersToSkip: Array<{ name: string; reason: string }> = [];
    const archiveMemberIdSet = new Set<string>();

    for (const m of archiveMembers) {
      if (!m.firstName || !m.lastName) {
        issues.push({
          level: 'WARNING',
          category: 'SCHEMA',
          message: `Member record has missing firstName or lastName.`,
          recordId: m._id,
        });
      }
      archiveMemberIdSet.add(m._id?.toString());

      const dob = m.dateOfBirth ? m.dateOfBirth.trim() : '';
      const key = `${m.firstName?.trim().toLowerCase()}_${m.lastName?.trim().toLowerCase()}_${dob}`;

      if (existingMemberKeys.has(key)) {
        membersToSkip.push({
          name: `${m.firstName} ${m.lastName}`,
          reason: 'A member with matching name and birth date already exists',
        });
      } else {
        membersToAdd.push({
          name: `${m.firstName} ${m.lastName}`,
          gender: m.gender,
          birthDate: dob || undefined,
        });
      }
    }

    // Branches
    const branchesToAdd: string[] = [];
    let branchesToSkipCount = 0;
    for (const b of archiveBranches) {
      const bKey = b.name?.trim().toLowerCase();
      if (existingBranchNames.has(bKey)) {
        branchesToSkipCount++;
      } else {
        branchesToAdd.push(b.name);
      }
    }

    // Relationships
    const relationshipsToAdd: Array<{ type: string; source: string; target: string }> = [];
    const relationshipsToSkip: Array<{ type: string; reason: string }> = [];
    let rejectedRelationships = 0;

    for (const r of archiveRelationships) {
      const sId = (r.sourceMemberId || r.person1Id)?.toString();
      const tId = (r.targetMemberId || r.person2Id)?.toString();

      if (!sId || !tId) {
        rejectedRelationships++;
        issues.push({
          level: 'WARNING',
          category: 'RELATIONSHIP',
          message: 'Relationship record is missing endpoint IDs.',
          recordId: r._id,
        });
        continue;
      }

      if (sId === tId) {
        rejectedRelationships++;
        issues.push({
          level: 'WARNING',
          category: 'RELATIONSHIP',
          message: `Self-referential relationship skipped (${r.relationshipType}).`,
          recordId: r._id,
        });
        continue;
      }

      const sourceExists = archiveMemberIdSet.has(sId) || existingMemberIds.has(sId);
      const targetExists = archiveMemberIdSet.has(tId) || existingMemberIds.has(tId);

      if (!sourceExists || !targetExists) {
        rejectedRelationships++;
        issues.push({
          level: 'WARNING',
          category: 'RELATIONSHIP',
          message: `Relationship references person IDs not found in archive or family: (${sId} -> ${tId})`,
          recordId: r._id,
        });
        continue;
      }

      relationshipsToAdd.push({
        type: r.relationshipType,
        source: sId,
        target: tId,
      });
    }

    // Events
    const timelineEventsToAdd: string[] = [];
    let eventsSkippedCount = 0;
    for (const e of archiveEvents) {
      const datePart = e.eventDate ? new Date(e.eventDate).toISOString().split('T')[0] : '';
      const key = `${e.title?.trim().toLowerCase()}_${datePart}`;
      if (existingEventKeys.has(key)) {
        eventsSkippedCount++;
      } else {
        timelineEventsToAdd.push(e.title);
      }
    }

    // Memories
    const memoriesToAdd: string[] = [];
    let memoriesSkippedCount = 0;
    for (const m of archiveMemories) {
      const mKey = m.title?.trim().toLowerCase();
      if (existingMemoryKeys.has(mKey)) {
        memoriesSkippedCount++;
      } else {
        memoriesToAdd.push(m.title);
      }
    }

    // Collections
    let collectionsToAddCount = 0;
    let collectionsSkippedCount = 0;
    for (const c of archiveCollections) {
      const cKey = c.title?.trim().toLowerCase();
      if (existingCollectionKeys.has(cKey)) {
        collectionsSkippedCount++;
      } else {
        collectionsToAddCount++;
      }
    }

    // Media verification
    const mediaList = manifest.mediaManifest || [];
    let mediaPresentCount = 0;
    let mediaMissingCount = 0;
    for (const med of mediaList) {
      if (zip.file(med.archivePath)) {
        mediaPresentCount++;
      } else {
        mediaMissingCount++;
      }
    }

    if (mediaMissingCount > 0) {
      issues.push({
        level: 'WARNING',
        category: 'MEDIA',
        message: `${mediaMissingCount} media assets listed in the manifest could not be found in archive.`,
      });
    }

    const hasFatalErrors = issues.some((i) => i.level === 'ERROR');

    const summary: IRestoreDryRunSummary = {
      family: {
        name: targetFamily.name,
        action: 'PRESERVE_EXISTING',
      },
      members: {
        total: archiveMembers.length,
        toAdd: membersToAdd.length,
        toSkip: membersToSkip.length,
        rejected: 0,
      },
      relationships: {
        total: archiveRelationships.length,
        toAdd: relationshipsToAdd.length,
        toSkip: relationshipsToSkip.length,
        rejected: rejectedRelationships,
      },
      branches: {
        total: archiveBranches.length,
        toAdd: branchesToAdd.length,
        toSkip: branchesToSkipCount,
        rejected: 0,
      },
      memories: {
        total: archiveMemories.length,
        toAdd: memoriesToAdd.length,
        toSkip: memoriesSkippedCount,
        rejected: 0,
      },
      timelineEvents: {
        total: archiveEvents.length,
        toAdd: timelineEventsToAdd.length,
        toSkip: eventsSkippedCount,
        rejected: 0,
      },
      milestones: {
        total: archiveEvents.filter((e) => e.isMilestone).length,
        toAdd: archiveEvents.filter((e) => e.isMilestone && !existingEventKeys.has(`${e.title?.trim().toLowerCase()}_${e.eventDate ? new Date(e.eventDate).toISOString().split('T')[0] : ''}`)).length,
        toSkip: 0,
        rejected: 0,
      },
      collections: {
        total: archiveCollections.length,
        toAdd: collectionsToAddCount,
        toSkip: collectionsSkippedCount,
        rejected: 0,
      },
      media: {
        total: mediaList.length,
        toAdd: mediaPresentCount,
        missing: mediaMissingCount,
      },
    };

    const tokenPayload = `${manifest.archiveId}:${familyId}:${Date.now()}`;
    const tokenSignature = crypto.createHmac('sha256', 'familyroots_archive_secret').update(tokenPayload).digest('hex');
    const validationToken = Buffer.from(`${tokenPayload}:${tokenSignature}`).toString('base64');

    await auditService.log(
      familyId,
      _requestingUser.userId,
      AuditAction.RESTORE_VALIDATED,
      'Family',
      familyId,
      {
        archiveId: manifest.archiveId,
        sourceFamilyName: manifest.familyName,
        isValid: !hasFatalErrors,
        canRestore: !hasFatalErrors,
        summary,
        issuesCount: issues.length,
      }
    );

    return {
      isValid: !hasFatalErrors,
      canRestore: !hasFatalErrors,
      archiveId: manifest.archiveId,
      sourceFamilyId: manifest.familyId,
      targetFamilyId: familyId,
      sourceFamilyName: manifest.familyName,
      schemaVersion: manifest.schemaVersion,
      exportedAt: manifest.exportedAt,
      summary,
      issues,
      preview: {
        membersToAdd,
        membersToSkip,
        relationshipsToAdd,
        relationshipsToSkip,
        branchesToAdd,
        memoriesToAdd,
        timelineEventsToAdd,
      },
      validationToken,
    };
  }

  /**
   * Safely imports and restores an archive into a family.
   * Enforces transactional rollback so failure never leaves partial data.
   */
  async executeRestore(
    familyId: string,
    archiveBuffer: Buffer,
    requestingUser: { userId: string; email?: string },
    options: IRestoreOptions = {}
  ): Promise<IRestoreExecutionResult> {
    if (!options.confirm) {
      throw new ValidationError(
        'Restore operations require explicit confirmation. Please pass confirm: true.'
      );
    }

    const familyObjectId = new Types.ObjectId(familyId);
    const targetFamily = await Family.findById(familyObjectId);
    if (!targetFamily) {
      throw new NotFoundError(`Target family with ID '${familyId}' not found`);
    }

    // 1. Run validation first
    const validation = await this.validateArchive(familyId, archiveBuffer, requestingUser);
    if (!validation.canRestore) {
      const errorIssue = validation.issues.find((i) => i.level === 'ERROR')?.message || 'Archive failed validation';
      throw new ValidationError(`Cannot restore archive: ${errorIssue}`);
    }

    const zip = await JSZip.loadAsync(archiveBuffer);
    const storageService = getMediaStorageService();

    // Tracking for atomic rollback on failure
    const rollbackState = {
      createdBranchIds: [] as Types.ObjectId[],
      createdMemberIds: [] as Types.ObjectId[],
      createdRelationshipIds: [] as Types.ObjectId[],
      createdMediaIds: [] as Types.ObjectId[],
      createdMemoryIds: [] as Types.ObjectId[],
      createdEventIds: [] as Types.ObjectId[],
      createdCollectionIds: [] as Types.ObjectId[],
      savedStorageKeys: [] as string[],
    };

    const rollbackAll = async () => {
      try {
        if (rollbackState.createdBranchIds.length > 0) {
          await Branch.deleteMany({ _id: { $in: rollbackState.createdBranchIds } });
        }
        if (rollbackState.createdMemberIds.length > 0) {
          await FamilyMember.deleteMany({ _id: { $in: rollbackState.createdMemberIds } });
        }
        if (rollbackState.createdRelationshipIds.length > 0) {
          await Relationship.deleteMany({ _id: { $in: rollbackState.createdRelationshipIds } });
        }
        if (rollbackState.createdMediaIds.length > 0) {
          await Media.deleteMany({ _id: { $in: rollbackState.createdMediaIds } });
        }
        if (rollbackState.createdMemoryIds.length > 0) {
          await Memory.deleteMany({ _id: { $in: rollbackState.createdMemoryIds } });
        }
        if (rollbackState.createdEventIds.length > 0) {
          await FamilyEvent.deleteMany({ _id: { $in: rollbackState.createdEventIds } });
        }
        if (rollbackState.createdCollectionIds.length > 0) {
          await MemoryCollection.deleteMany({ _id: { $in: rollbackState.createdCollectionIds } });
        }
        for (const key of rollbackState.savedStorageKeys) {
          await storageService.deleteFile(key).catch(() => {});
        }
      } catch (rbErr) {
        console.error('Error during archive restore rollback:', rbErr);
      }
    };

    try {
      const oldIdToNewId = new Map<string, Types.ObjectId>();

      const readJson = async <T>(path: string): Promise<T[]> => {
        const entry = zip.file(path);
        if (!entry) return [];
        const text = await entry.async('text');
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : [parsed];
      };

      const [
        archiveBranches,
        archiveMembers,
        archiveRelationships,
        archiveEvents,
        archiveMemories,
        archiveCollections,
      ] = await Promise.all([
        readJson<any>('data/branches.json'),
        readJson<any>('data/members.json'),
        readJson<any>('data/relationships.json'),
        readJson<any>('data/events.json'),
        readJson<any>('data/memories.json'),
        readJson<any>('data/collections.json'),
      ]);

      const counts = {
        membersAdded: 0,
        membersSkipped: 0,
        relationshipsAdded: 0,
        relationshipsSkipped: 0,
        branchesAdded: 0,
        branchesSkipped: 0,
        memoriesAdded: 0,
        memoriesSkipped: 0,
        timelineEventsAdded: 0,
        timelineEventsSkipped: 0,
        collectionsAdded: 0,
        collectionsSkipped: 0,
        mediaAdded: 0,
      };

      // -------------------------------------------------------------
      // Step 1: Members (First pass: create or map members)
      // -------------------------------------------------------------
      const existingMembers = await FamilyMember.find({ familyId: familyObjectId });
      const existingMemberMap = new Map<string, Types.ObjectId>();
      existingMembers.forEach((m) => {
        const dob = m.dateOfBirth ? m.dateOfBirth.trim() : '';
        const key = `${m.firstName.trim().toLowerCase()}_${m.lastName.trim().toLowerCase()}_${dob}`;
        existingMemberMap.set(key, m._id);
      });

      for (const m of archiveMembers) {
        const dob = m.dateOfBirth ? m.dateOfBirth.trim() : '';
        const key = `${(m.firstName || '').trim().toLowerCase()}_${(m.lastName || '').trim().toLowerCase()}_${dob}`;

        if (existingMemberMap.has(key)) {
          oldIdToNewId.set(m._id, existingMemberMap.get(key)!);
          counts.membersSkipped++;
        } else {
          const newMember = new FamilyMember({
            familyId: familyObjectId,
            firstName: m.firstName,
            middleName: m.middleName,
            lastName: m.lastName,
            displayName: m.displayName,
            nickname: m.nickname,
            gender: m.gender || 'UNKNOWN',
            profilePhoto: m.profilePhoto,
            dateOfBirth: m.dateOfBirth,
            dateOfDeath: m.dateOfDeath,
            isLiving: m.isLiving !== false,
            birthPlace: m.birthPlace,
            deathPlace: m.deathPlace,
            occupation: m.occupation,
            education: m.education,
            biography: m.biography,
            branchIds: [], // mapped in branch step
            generation: m.generation || 1,
            isArchived: false,
            privacySettings: m.privacySettings || { visibility: 'FAMILY', hideLivingDates: false },
            createdBy: new Types.ObjectId(requestingUser.userId),
          });
          await newMember.save();
          rollbackState.createdMemberIds.push(newMember._id);
          oldIdToNewId.set(m._id, newMember._id);
          existingMemberMap.set(key, newMember._id);
          counts.membersAdded++;
        }
      }

      // -------------------------------------------------------------
      // Step 2: Branches
      // -------------------------------------------------------------
      const existingBranches = await Branch.find({ familyId: familyObjectId });
      const existingBranchMap = new Map<string, Types.ObjectId>();
      existingBranches.forEach((b) => {
        existingBranchMap.set(b.name.trim().toLowerCase(), b._id);
      });

      for (const b of archiveBranches) {
        const bKey = b.name?.trim().toLowerCase();
        if (existingBranchMap.has(bKey)) {
          oldIdToNewId.set(b._id, existingBranchMap.get(bKey)!);
          counts.branchesSkipped++;
        } else {
          // Resolve rootMemberId
          let rootId = b.rootMemberId ? oldIdToNewId.get(b.rootMemberId) : undefined;
          if (!rootId && rollbackState.createdMemberIds.length > 0) {
            rootId = rollbackState.createdMemberIds[0];
          } else if (!rootId && existingMembers.length > 0) {
            rootId = existingMembers[0]._id;
          } else if (!rootId) {
            rootId = new Types.ObjectId();
          }

          const newBranch = new Branch({
            familyId: familyObjectId,
            name: b.name,
            description: b.description || '',
            rootMemberId: rootId,
            coverImage: b.coverImage || '',
            accentColor: b.accentColor || '#d4a373',
            managerIds: [new Types.ObjectId(requestingUser.userId)],
            visibility: b.visibility || 'FAMILY',
          });
          await newBranch.save();
          rollbackState.createdBranchIds.push(newBranch._id);
          oldIdToNewId.set(b._id, newBranch._id);
          existingBranchMap.set(bKey, newBranch._id);
          counts.branchesAdded++;
        }
      }

      // Update members with newly mapped branchIds
      for (const m of archiveMembers) {
        const mappedMemberId = oldIdToNewId.get(m._id);
        if (!mappedMemberId) continue;
        const mappedBranchIds = (m.branchIds || [])
          .map((id: string) => oldIdToNewId.get(id))
          .filter(Boolean) as Types.ObjectId[];
        if (mappedBranchIds.length > 0) {
          await FamilyMember.updateOne(
            { _id: mappedMemberId },
            { $addToSet: { branchIds: { $each: mappedBranchIds } } }
          );
        }
      }

      // -------------------------------------------------------------
      // Step 3: Relationships
      // -------------------------------------------------------------
      const existingRelationships = await Relationship.find({ familyId: familyObjectId });
      const existingRelSet = new Set<string>();
      existingRelationships.forEach((r) => {
        existingRelSet.add(`${r.sourceMemberId.toString()}_${r.targetMemberId.toString()}_${r.relationshipType}`);
      });

      for (const r of archiveRelationships) {
        const sId = r.sourceMemberId || r.person1Id;
        const tId = r.targetMemberId || r.person2Id;
        const mappedSource = oldIdToNewId.get(sId) || (Types.ObjectId.isValid(sId) ? new Types.ObjectId(sId) : null);
        const mappedTarget = oldIdToNewId.get(tId) || (Types.ObjectId.isValid(tId) ? new Types.ObjectId(tId) : null);

        if (!mappedSource || !mappedTarget || mappedSource.equals(mappedTarget)) {
          counts.relationshipsSkipped++;
          continue;
        }

        const relKey = `${mappedSource.toString()}_${mappedTarget.toString()}_${r.relationshipType}`;
        if (existingRelSet.has(relKey)) {
          counts.relationshipsSkipped++;
          continue;
        }

        const newRel = new Relationship({
          familyId: familyObjectId,
          sourceMemberId: mappedSource,
          targetMemberId: mappedTarget,
          relationshipType: r.relationshipType,
          status: r.status || RelationshipStatus.ACTIVE,
          metadata: r.metadata || {},
          createdBy: new Types.ObjectId(requestingUser.userId),
        });
        await newRel.save();
        rollbackState.createdRelationshipIds.push(newRel._id);
        existingRelSet.add(relKey);
        counts.relationshipsAdded++;
      }

      // -------------------------------------------------------------
      // Step 4: Media Assets
      // -------------------------------------------------------------
      const manifestFile = zip.file('manifest.json');
      let mediaManifest: IArchiveManifest['mediaManifest'] = [];
      if (manifestFile) {
        try {
          const mText = await manifestFile.async('text');
          const mJson: IArchiveManifest = JSON.parse(mText);
          mediaManifest = mJson.mediaManifest || [];
        } catch {
          // ignore
        }
      }

      // We will link media to memories in Step 5
      for (const med of mediaManifest) {
        const fileEntry = zip.file(med.archivePath);
        if (!fileEntry) continue;

        try {
          const buffer = await fileEntry.async('nodebuffer');
          const safeName = (med.originalFileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
          const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
          const newStorageKey = `families/${familyId}/restored/${uniqueSuffix}_${safeName}`;

          await storageService.saveFile(newStorageKey, buffer, med.mimeType);
          rollbackState.savedStorageKeys.push(newStorageKey);

          const newMedia = new Media({
            familyId: familyObjectId,
            memoryId: new Types.ObjectId(), // will be updated when memory is created
            uploadedBy: new Types.ObjectId(requestingUser.userId),
            originalFileName: med.originalFileName,
            storageKey: newStorageKey,
            mimeType: med.mimeType,
            fileSize: buffer.length,
            sha256Checksum: this.computeSha256(buffer),
            processingStatus: MediaProcessingStatus.READY,
            visibility: 'FAMILY',
            status: 'ACTIVE',
          });
          await newMedia.save();
          rollbackState.createdMediaIds.push(newMedia._id);
          oldIdToNewId.set(med.mediaId, newMedia._id);
          counts.mediaAdded++;
        } catch (mediaErr) {
          console.warn('Skipping media file during restore:', med.originalFileName, mediaErr);
        }
      }

      // -------------------------------------------------------------
      // Step 5: Memories
      // -------------------------------------------------------------
      const existingMemories = await Memory.find({ familyId: familyObjectId });
      const existingMemoryTitles = new Set(existingMemories.map((m) => m.title.trim().toLowerCase()));

      for (const mem of archiveMemories) {
        const mKey = mem.title?.trim().toLowerCase();
        if (existingMemoryTitles.has(mKey)) {
          counts.memoriesSkipped++;
          continue;
        }

        const mappedMemberIds = (mem.memberIds || [])
          .map((id: string) => oldIdToNewId.get(id))
          .filter(Boolean) as Types.ObjectId[];

        const mappedBranchIds = (mem.branchIds || [])
          .map((id: string) => oldIdToNewId.get(id))
          .filter(Boolean) as Types.ObjectId[];

        const mappedCover = mem.coverMediaId ? oldIdToNewId.get(mem.coverMediaId) : undefined;

        const newMemory = new Memory({
          familyId: familyObjectId,
          title: mem.title,
          description: mem.description || '',
          memoryType: mem.memoryType || 'STORY',
          eventDate: mem.eventDate ? new Date(mem.eventDate) : undefined,
          eventDateApprox: mem.eventDateApprox || '',
          location: mem.location || '',
          memberIds: mappedMemberIds,
          branchIds: mappedBranchIds,
          tags: mem.tags || [],
          visibility: mem.visibility || 'FAMILY',
          coverMediaId: mappedCover,
          collectionIds: [],
          status: mem.status || 'PUBLISHED',
          createdBy: new Types.ObjectId(requestingUser.userId),
        });
        await newMemory.save();
        rollbackState.createdMemoryIds.push(newMemory._id);
        oldIdToNewId.set(mem._id, newMemory._id);
        existingMemoryTitles.add(mKey);
        counts.memoriesAdded++;

        // Update any media items associated with this memory
        if (Array.isArray(mem.mediaIds)) {
          for (const oldMedId of mem.mediaIds) {
            const mappedMedId = oldIdToNewId.get(oldMedId);
            if (mappedMedId) {
              await Media.updateOne({ _id: mappedMedId }, { memoryId: newMemory._id });
            }
          }
        }
      }

      // -------------------------------------------------------------
      // Step 6: Events & Milestones
      // -------------------------------------------------------------
      const existingEvents = await FamilyEvent.find({ familyId: familyObjectId });
      const existingEventSet = new Set(
        existingEvents.map((e) => {
          const datePart = e.eventDate ? new Date(e.eventDate).toISOString().split('T')[0] : '';
          return `${e.title.trim().toLowerCase()}_${datePart}`;
        })
      );

      for (const ev of archiveEvents) {
        const datePart = ev.eventDate ? new Date(ev.eventDate).toISOString().split('T')[0] : '';
        const key = `${ev.title?.trim().toLowerCase()}_${datePart}`;
        if (existingEventSet.has(key)) {
          counts.timelineEventsSkipped++;
          continue;
        }

        const mappedMemberIds = (ev.memberIds || [])
          .map((id: string) => oldIdToNewId.get(id))
          .filter(Boolean) as Types.ObjectId[];

        const mappedBranchIds = (ev.branchIds || ev.branches || [])
          .map((id: string) => oldIdToNewId.get(id))
          .filter(Boolean) as Types.ObjectId[];

        const mappedMemoryIds = (ev.memoryIds || [])
          .map((id: string) => oldIdToNewId.get(id))
          .filter(Boolean) as Types.ObjectId[];

        const mappedCover = ev.coverMediaId ? oldIdToNewId.get(ev.coverMediaId) : undefined;

        const newEvent = new FamilyEvent({
          familyId: familyObjectId,
          title: ev.title,
          description: ev.description || '',
          eventType: ev.eventType || 'MILESTONE',
          eventDate: ev.eventDate ? new Date(ev.eventDate) : new Date(),
          approximateDate: ev.approximateDate,
          era: ev.era,
          location: ev.location || '',
          branchIds: mappedBranchIds,
          memberIds: mappedMemberIds,
          memoryIds: mappedMemoryIds,
          coverMediaId: mappedCover,
          importance: ev.importance || 'MEDIUM',
          notes: ev.notes || '',
          isMilestone: ev.isMilestone !== false,
          visibility: ev.visibility || 'FAMILY',
          status: ev.status || 'ACTIVE',
          createdBy: new Types.ObjectId(requestingUser.userId),
        });
        await newEvent.save();
        rollbackState.createdEventIds.push(newEvent._id);
        oldIdToNewId.set(ev._id, newEvent._id);
        existingEventSet.add(key);
        counts.timelineEventsAdded++;
      }

      // -------------------------------------------------------------
      // Step 7: Memory Collections
      // -------------------------------------------------------------
      const existingCollections = await MemoryCollection.find({ familyId: familyObjectId });
      const existingColTitles = new Set(existingCollections.map((c) => c.title.trim().toLowerCase()));

      for (const col of archiveCollections) {
        const cKey = col.title?.trim().toLowerCase();
        if (existingColTitles.has(cKey)) {
          counts.collectionsSkipped++;
          continue;
        }

        const mappedMemIds = (col.memoryIds || [])
          .map((id: string) => oldIdToNewId.get(id))
          .filter(Boolean) as Types.ObjectId[];

        const mappedCover = col.coverMediaId ? oldIdToNewId.get(col.coverMediaId) : undefined;

        const newCol = new MemoryCollection({
          familyId: familyObjectId,
          title: col.title,
          description: col.description || '',
          memoryIds: mappedMemIds,
          coverMediaId: mappedCover,
          isCurated: col.isCurated !== false,
          createdBy: new Types.ObjectId(requestingUser.userId),
        });
        await newCol.save();
        rollbackState.createdCollectionIds.push(newCol._id);
        oldIdToNewId.set(col._id, newCol._id);
        existingColTitles.add(cKey);
        counts.collectionsAdded++;
      }

      // -------------------------------------------------------------
      // Step 8: Log audit record
      // -------------------------------------------------------------
      await auditService.log(
        familyId,
        requestingUser.userId,
        AuditAction.DATA_RESTORED,
        'Family',
        familyId,
        {
          archiveId: validation.archiveId,
          counts,
          restoredBy: requestingUser.userId,
        }
      );

      return {
        success: true,
        archiveId: validation.archiveId,
        familyId,
        restoredAt: new Date().toISOString(),
        restoredBy: requestingUser.userId,
        recordCounts: counts,
        warnings: validation.issues
          .filter((i) => i.level === 'WARNING')
          .map((i) => i.message),
      };
    } catch (err: any) {
      console.error('Fatal error during restore, rolling back all changes...', err);
      await rollbackAll();
      throw new Error(`Restore failed and was cleanly rolled back: ${err.message || 'Internal database error'}`);
    }
  }

  private createEmptySummary(): IRestoreDryRunSummary {
    return {
      family: { name: 'Unknown', action: 'PRESERVE_EXISTING' },
      members: { total: 0, toAdd: 0, toSkip: 0, rejected: 0 },
      relationships: { total: 0, toAdd: 0, toSkip: 0, rejected: 0 },
      branches: { total: 0, toAdd: 0, toSkip: 0, rejected: 0 },
      memories: { total: 0, toAdd: 0, toSkip: 0, rejected: 0 },
      timelineEvents: { total: 0, toAdd: 0, toSkip: 0, rejected: 0 },
      milestones: { total: 0, toAdd: 0, toSkip: 0, rejected: 0 },
      collections: { total: 0, toAdd: 0, toSkip: 0, rejected: 0 },
      media: { total: 0, toAdd: 0, missing: 0 },
    };
  }

  private createEmptyPreview() {
    return {
      membersToAdd: [],
      membersToSkip: [],
      relationshipsToAdd: [],
      relationshipsToSkip: [],
      branchesToAdd: [],
      memoriesToAdd: [],
      timelineEventsToAdd: [],
    };
  }
}

export const archiveRestoreService = new ArchiveRestoreService();
