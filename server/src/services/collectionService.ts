import { Types } from 'mongoose';
import { collectionRepository } from '../repositories/collectionRepository.ts';
import { memoryRepository } from '../repositories/memoryRepository.ts';
import { membershipRepository } from '../repositories/membershipRepository.ts';
import { auditService } from './auditService.ts';
import { AuditAction, Role, normalizeRole, MemoryStatus, MemoryType } from '../constants/index.ts';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.ts';

export class CollectionService {
  async getCollections(familyId: string, actorUserId: string) {
    const membership = await membershipRepository.findByUserAndFamily(actorUserId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('You must be an active family member to view collections');
    }

    const isOwnerOrAdmin = normalizeRole(membership.role) === Role.ADMIN;
    const allowedBranchIds = membership.branchId ? [membership.branchId.toString()] : [];

    let collections = await collectionRepository.findByFamily(familyId, {
      actorUserId,
      isOwnerOrAdmin,
      allowedBranchIds,
    });

    // If 0 collections exist, bootstrap default heritage collections
    if (collections.length === 0) {
      await this.bootstrapDefaultCollections(familyId, actorUserId);
      collections = await collectionRepository.findByFamily(familyId, {
        actorUserId,
        isOwnerOrAdmin,
        allowedBranchIds,
      });
    }

    return collections;
  }

  async getCollectionById(familyId: string, collectionId: string, actorUserId: string) {
    const membership = await membershipRepository.findByUserAndFamily(actorUserId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('You must be an active family member to view collections');
    }

    const isOwnerOrAdmin = normalizeRole(membership.role) === Role.ADMIN;
    const allowedBranchIds = membership.branchId ? [membership.branchId.toString()] : [];

    const collection = await collectionRepository.findById(familyId, collectionId, {
      actorUserId,
      isOwnerOrAdmin,
      allowedBranchIds,
    });

    if (!collection) {
      throw new NotFoundError('Collection not found');
    }

    return collection;
  }

  async createCollection(
    familyId: string,
    actorUserId: string,
    data: {
      title: string;
      description?: string;
      coverMediaId?: string;
      coverImageUrl?: string;
      memoryIds?: string[];
    }
  ) {
    const membership = await membershipRepository.findByUserAndFamily(actorUserId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('You must be an active family member to create collections');
    }

    if (!data.title || !data.title.trim()) {
      throw new ValidationError('Collection title is required');
    }

    const collection = await collectionRepository.create({
      familyId,
      title: data.title,
      description: data.description,
      coverMediaId: data.coverMediaId,
      coverImageUrl: data.coverImageUrl,
      memoryIds: data.memoryIds,
      createdBy: actorUserId,
    });

    await auditService.log(
      familyId,
      actorUserId,
      AuditAction.MEMORY_CREATED,
      'MemoryCollection',
      collection._id.toString(),
      { title: collection.title }
    );

    return this.getCollectionById(familyId, collection._id.toString(), actorUserId);
  }

  async updateCollection(
    familyId: string,
    collectionId: string,
    actorUserId: string,
    data: {
      title?: string;
      description?: string;
      coverMediaId?: string | null;
      coverImageUrl?: string | null;
      memoryIds?: string[];
    }
  ) {
    const membership = await membershipRepository.findByUserAndFamily(actorUserId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('You must be an active family member to update collections');
    }

    const isOwnerOrAdmin = normalizeRole(membership.role) === Role.ADMIN;

    const collection = await collectionRepository.findById(familyId, collectionId, {
      actorUserId,
      isOwnerOrAdmin,
    });

    if (!collection) {
      throw new NotFoundError('Collection not found');
    }

    const updated = await collectionRepository.update(collectionId, data);

    await auditService.log(
      familyId,
      actorUserId,
      AuditAction.MEMORY_UPDATED,
      'MemoryCollection',
      collectionId,
      { title: updated?.title }
    );

    return this.getCollectionById(familyId, collectionId, actorUserId);
  }

  async deleteCollection(familyId: string, collectionId: string, actorUserId: string) {
    const membership = await membershipRepository.findByUserAndFamily(actorUserId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('You must be an active family member to delete collections');
    }

    const isOwnerOrAdmin = normalizeRole(membership.role) === Role.ADMIN;

    const collection = await collectionRepository.findById(familyId, collectionId, {
      actorUserId,
      isOwnerOrAdmin,
    });

    if (!collection) {
      throw new NotFoundError('Collection not found');
    }

    await collectionRepository.delete(collectionId);

    await auditService.log(
      familyId,
      actorUserId,
      AuditAction.MEMORY_ARCHIVED,
      'MemoryCollection',
      collectionId,
      { title: collection.title }
    );

    return { success: true };
  }

  async addMemoryToCollection(
    familyId: string,
    collectionId: string,
    memoryId: string,
    actorUserId: string
  ) {
    const membership = await membershipRepository.findByUserAndFamily(actorUserId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('You must be an active family member to modify collections');
    }

    await collectionRepository.addMemory(collectionId, memoryId);
    return this.getCollectionById(familyId, collectionId, actorUserId);
  }

  async removeMemoryFromCollection(
    familyId: string,
    collectionId: string,
    memoryId: string,
    actorUserId: string
  ) {
    const membership = await membershipRepository.findByUserAndFamily(actorUserId, familyId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('You must be an active family member to modify collections');
    }

    await collectionRepository.removeMemory(collectionId, memoryId);
    return this.getCollectionById(familyId, collectionId, actorUserId);
  }

  private async bootstrapDefaultCollections(familyId: string, actorUserId: string) {
    const result = await memoryRepository.findWithFilters(familyId, {
      limit: 50,
      isOwnerOrAdmin: true,
    });
    const memories = result.memories || [];

    const defaultCollections = [
      {
        title: 'Grandparents',
        description: 'Cherished memories, wisdom, and ancestral portraits of family matriarchs and patriarchs.',
        filterKeywords: ['govindan', 'lakshmi', 'grand', 'homestead', 'ancestral'],
      },
      {
        title: 'Childhood Memories',
        description: 'Growing up across generations, childhood summers, garden games, and school days.',
        filterKeywords: ['childhood', 'summer', 'plantation', 'tea', 'youth', 'trek'],
      },
      {
        title: 'Family Weddings',
        description: 'Traditional ceremonies, wedding celebrations, joyous reunions, and vows.',
        filterKeywords: ['wedding', 'marriage', 'celebration', 'gathering', 'ceremony'],
      },
      {
        title: 'Our Village',
        description: 'Roots in Palakkad, Kerala courtyards, Western Ghats travels, and local community memories.',
        filterKeywords: ['palakkad', 'courtyard', 'kerala', 'spice', 'village', 'homestead'],
      },
      {
        title: 'Old Family Documents',
        description: 'Historical records, royal accreditation certificates, hand-written letters, and land documents.',
        filterKeywords: ['accreditation', 'certificate', 'letter', 'document', 'manuscript'],
      },
    ];

    for (const def of defaultCollections) {
      const matchingMemories = memories.filter((m: any) => {
        const text = `${m.title} ${m.description || ''} ${(m.tags || []).join(' ')}`.toLowerCase();
        return def.filterKeywords.some((kw) => text.includes(kw));
      });

      const memoryIds = matchingMemories.map((m: any) => m._id.toString());
      const firstMemoryCover = matchingMemories[0]?.coverMediaId;

      await collectionRepository.create({
        familyId,
        title: def.title,
        description: def.description,
        coverMediaId: firstMemoryCover?._id || undefined,
        coverImageUrl: undefined,
        memoryIds,
        createdBy: actorUserId,
      });
    }
  }
}

export const collectionService = new CollectionService();
