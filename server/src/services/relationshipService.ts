import { Types } from 'mongoose';
import { relationshipRepository } from '../repositories/relationshipRepository.ts';
import { memberRepository } from '../repositories/memberRepository.ts';
import { familyService } from './familyService.ts';
import { auditService } from './auditService.ts';
import { IRelationship } from '../models/Relationship.ts';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.ts';
import { AuditAction, ErrorCode, RelationshipType, RelationshipStatus } from '../constants/index.ts';
import { ServiceContext } from './familyService.ts';

export interface CreateRelationshipInput {
  sourceMemberId: string;
  targetMemberId: string;
  relationshipType: RelationshipType;
  status?: RelationshipStatus;
  marriageDate?: string | null;
  siblingOrder?: number | null;
  displayOrder?: number | null;
  metadata?: Record<string, unknown>;
}

export class RelationshipService {
  /**
   * Primary graph validation and relationship creation engine.
   */
  async createRelationship(
    familyId: string,
    input: CreateRelationshipInput,
    context?: ServiceContext
  ): Promise<IRelationship> {
    const { sourceMemberId, targetMemberId, relationshipType, status, metadata } = input;

    // 1. Verify family exists
    await familyService.getFamilyById(familyId, context);

    // 2. Validate self-relationship (Section 6)
    if (sourceMemberId.trim() === targetMemberId.trim()) {
      throw new ValidationError(
        'A member cannot have a relationship with themselves',
        { code: ErrorCode.INVALID_RELATIONSHIP, sourceMemberId, targetMemberId }
      );
    }

    if (!Types.ObjectId.isValid(sourceMemberId) || !Types.ObjectId.isValid(targetMemberId)) {
      throw new ValidationError('Invalid member identifier format');
    }

    // 3. Verify both members exist in MongoDB and belong to the same family (Section 6 & 31)
    const [sourceMember, targetMember] = await Promise.all([
      memberRepository.findByFamilyAndId(familyId, sourceMemberId),
      memberRepository.findByFamilyAndId(familyId, targetMemberId),
    ]);

    if (!sourceMember) {
      throw new NotFoundError(
        `Source member '${sourceMemberId}' not found in family '${familyId}'`,
        ErrorCode.MEMBER_NOT_FOUND
      );
    }

    if (!targetMember) {
      throw new NotFoundError(
        `Target member '${targetMemberId}' not found in family '${familyId}'`,
        ErrorCode.MEMBER_NOT_FOUND
      );
    }

    // 4. Validate duplicate relationships based on symmetry and direction (Section 7)
    const isSymmetric =
      relationshipType === RelationshipType.SPOUSE ||
      relationshipType === RelationshipType.SIBLING ||
      relationshipType === RelationshipType.HALF_SIBLING;

    if (isSymmetric) {
      const existingSymmetric = await relationshipRepository.findSymmetric(
        familyId,
        sourceMemberId,
        targetMemberId,
        relationshipType
      );

      if (existingSymmetric) {
        if (relationshipType === RelationshipType.SPOUSE && input.marriageDate !== undefined) {
          existingSymmetric.marriageDate = input.marriageDate ? input.marriageDate.trim() : null;
          await existingSymmetric.save();
          await auditService.log(
            familyId,
            context?.userId || 'system',
            AuditAction.RELATIONSHIP_UPDATED,
            'Relationship',
            existingSymmetric._id.toString(),
            { marriageDate: existingSymmetric.marriageDate }
          );
          return existingSymmetric;
        }
        throw new ConflictError(
          `A ${relationshipType} relationship already exists between ${sourceMember.displayName || sourceMember.firstName} and ${targetMember.displayName || targetMember.firstName}`,
          ErrorCode.DUPLICATE_ENTITY
        );
      }
    } else {
      // Exact directional duplicate check
      const existingExact = await relationshipRepository.findExact(
        familyId,
        sourceMemberId,
        targetMemberId,
        relationshipType
      );

      if (existingExact) {
        throw new ConflictError(
          `An identical ${relationshipType} relationship already exists between these members`,
          ErrorCode.DUPLICATE_ENTITY
        );
      }
    }

    // 5. Parent-Child graph consistency, cycle prevention, and spouse requirement (Phase 33)
    if (
      relationshipType === RelationshipType.PARENT ||
      relationshipType === RelationshipType.ADOPTIVE_PARENT ||
      relationshipType === RelationshipType.STEP_PARENT
    ) {
      // Phase 33 Business Rule: Parent must have a valid spouse relationship before adding a child
      const parentSpouse = await relationshipRepository.findSpouseForMember(familyId, sourceMemberId);
      if (!parentSpouse) {
        throw new ValidationError(
          `Invalid relationship: Cannot add child: Parent '${sourceMember.displayName || sourceMember.firstName}' must have a registered spouse before adding a child.`,
          { code: ErrorCode.INVALID_RELATIONSHIP, requiresSpouse: true }
        );
      }

      // Direct mutual parenting check: Cannot be parent of someone who is already your parent
      const mutualParent = await relationshipRepository.findExact(
        familyId,
        targetMemberId,
        sourceMemberId,
        RelationshipType.PARENT
      );

      if (mutualParent) {
        throw new ValidationError(
          `Mutual parenting is invalid: ${targetMember.displayName || targetMember.firstName} is already recorded as a parent of ${sourceMember.displayName || sourceMember.firstName}`,
          { code: ErrorCode.INVALID_RELATIONSHIP }
        );
      }

      // Check transitive circular descent (DAG cycle detection)
      // If we are adding edge source (parent) -> target (child):
      // A cycle would form if target is already an ancestor of source
      // (i.e. there exists a directed path of parent edges from target to source).
      const wouldCreateCycle = await this.detectParentCycle(familyId, sourceMemberId, targetMemberId);
      if (wouldCreateCycle) {
        throw new ValidationError(
          `Circular parent-child relationship rejected: adding this relationship would make ${targetMember.displayName || targetMember.firstName} both an ancestor and a descendant of ${sourceMember.displayName || sourceMember.firstName}`,
          { code: ErrorCode.INVALID_RELATIONSHIP }
        );
      }
    }

    // If relationshipType is CHILD / ADOPTED_CHILD / STEP_CHILD: source is child, target is parent
    if (
      relationshipType === RelationshipType.CHILD ||
      relationshipType === RelationshipType.ADOPTED_CHILD ||
      relationshipType === RelationshipType.STEP_CHILD
    ) {
      // Phase 33 Business Rule: Target (parent) must have a valid spouse before adding child
      const parentSpouse = await relationshipRepository.findSpouseForMember(familyId, targetMemberId);
      if (!parentSpouse) {
        throw new ValidationError(
          `Invalid relationship: Cannot add child: Parent '${targetMember.displayName || targetMember.firstName}' must have a registered spouse before adding a child.`,
          { code: ErrorCode.INVALID_RELATIONSHIP, requiresSpouse: true }
        );
      }

      const mutualParent = await relationshipRepository.findExact(
        familyId,
        sourceMemberId,
        targetMemberId,
        RelationshipType.PARENT
      );

      if (mutualParent) {
        throw new ValidationError(
          `Invalid relationship: cannot be child of someone who is recorded as your child`,
          { code: ErrorCode.INVALID_RELATIONSHIP }
        );
      }

      // target is parent, source is child
      const wouldCreateCycle = await this.detectParentCycle(familyId, targetMemberId, sourceMemberId);
      if (wouldCreateCycle) {
        throw new ValidationError(
          `Circular parent-child relationship rejected: adding this relationship would create an invalid generational loop`,
          { code: ErrorCode.INVALID_RELATIONSHIP }
        );
      }
    }

    // 6. Calculate persistent sibling order if this is a child relationship (Phase: Family Tree Child Ordering)
    const isParentType =
      relationshipType === RelationshipType.PARENT ||
      relationshipType === RelationshipType.ADOPTIVE_PARENT ||
      relationshipType === RelationshipType.STEP_PARENT;
    const isChildType =
      relationshipType === RelationshipType.CHILD ||
      relationshipType === RelationshipType.ADOPTED_CHILD ||
      relationshipType === RelationshipType.STEP_CHILD;

    let computedSiblingOrder: number | null = input.siblingOrder ?? input.displayOrder ?? null;
    if (computedSiblingOrder == null && (isParentType || isChildType)) {
      const parentId = isParentType ? sourceMemberId : targetMemberId;
      const childId = isParentType ? targetMemberId : sourceMemberId;

      // Find parent's registered spouse so all children of this parent couple share the ordering sequence
      const parentSpouse = await relationshipRepository.findSpouseForMember(familyId, parentId);
      const parentIds = new Set<string>([parentId.toString()]);
      if (parentSpouse) {
        parentIds.add(parentSpouse.sourceMemberId.toString());
        parentIds.add(parentSpouse.targetMemberId.toString());
      }

      // Query all existing child relationships for these parents
      const existingRels = await relationshipRepository.findByFamilyId(familyId);
      let maxOrder = 0;
      existingRels.forEach((r) => {
        const isRTypeParent =
          r.relationshipType === RelationshipType.PARENT ||
          r.relationshipType === RelationshipType.ADOPTIVE_PARENT ||
          r.relationshipType === RelationshipType.STEP_PARENT;
        const isRTypeChild =
          r.relationshipType === RelationshipType.CHILD ||
          r.relationshipType === RelationshipType.ADOPTED_CHILD ||
          r.relationshipType === RelationshipType.STEP_CHILD;

        const rParentId = isRTypeParent ? r.sourceMemberId.toString() : r.targetMemberId.toString();
        const rChildId = isRTypeParent ? r.targetMemberId.toString() : r.sourceMemberId.toString();

        if (parentIds.has(rParentId) && rChildId !== childId.toString()) {
          const ord = r.siblingOrder ?? r.displayOrder ?? 0;
          if (ord > maxOrder) {
            maxOrder = ord;
          }
        }
      });

      computedSiblingOrder = maxOrder + 1;
    }

    // 7. Persist relationship
    const relationship = await relationshipRepository.create({
      familyId: new Types.ObjectId(familyId),
      sourceMemberId: new Types.ObjectId(sourceMemberId),
      targetMemberId: new Types.ObjectId(targetMemberId),
      relationshipType,
      status: status || RelationshipStatus.ACTIVE,
      marriageDate: input.marriageDate || undefined,
      siblingOrder: computedSiblingOrder ?? undefined,
      displayOrder: computedSiblingOrder ?? undefined,
      metadata: metadata || {},
      createdBy: context?.userId || 'system',
    });

    if (computedSiblingOrder != null && (isParentType || isChildType)) {
      const childMemberId = isParentType ? targetMemberId : sourceMemberId;
      await memberRepository.update(childMemberId, {
        siblingOrder: computedSiblingOrder,
        displayOrder: computedSiblingOrder,
      } as any);
    }

    await auditService.log(
      familyId,
      context?.userId || 'system',
      AuditAction.RELATIONSHIP_CREATED,
      'Relationship',
      relationship._id.toString(),
      {
        relationshipType,
        sourceMemberId,
        targetMemberId,
      }
    );

    return relationship;
  }

  /**
   * Cycle detection using BFS:
   * Returns true if `targetMemberId` can reach `sourceMemberId` following PARENT directed edges.
   */
  private async detectParentCycle(
    familyId: string,
    proposedParentId: string,
    proposedChildId: string
  ): Promise<boolean> {
    const parentRels = await relationshipRepository.findAllParentRelationships(familyId);

    // Build adjacency list: parent -> children[]
    const adjList = new Map<string, string[]>();
    for (const rel of parentRels) {
      const p = rel.sourceMemberId.toString();
      const c = rel.targetMemberId.toString();
      if (!adjList.has(p)) {
        adjList.set(p, []);
      }
      adjList.get(p)!.push(c);
    }

    // Search from proposedChildId to see if we can reach proposedParentId
    const queue: string[] = [proposedChildId];
    const visited = new Set<string>([proposedChildId]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === proposedParentId) {
        return true; // Found path: target -> ... -> source. Adding source -> target creates cycle!
      }

      const children = adjList.get(current) || [];
      for (const child of children) {
        if (!visited.has(child)) {
          visited.add(child);
          queue.push(child);
        }
      }
    }

    return false;
  }

  async getRelationshipsByFamily(familyId: string, context?: ServiceContext): Promise<IRelationship[]> {
    await familyService.getFamilyById(familyId, context);
    const rels = await relationshipRepository.findByFamilyId(familyId);

    // Auto-normalize existing siblings that do not have persistent ordering (Requirement 2)
    let hasNormalizedAny = false;
    const parentChildrenMap = new Map<string, IRelationship[]>();
    rels.forEach((r) => {
      const isParentType =
        r.relationshipType === RelationshipType.PARENT ||
        r.relationshipType === RelationshipType.ADOPTIVE_PARENT ||
        r.relationshipType === RelationshipType.STEP_PARENT;
      if (isParentType) {
        const pId = r.sourceMemberId.toString();
        if (!parentChildrenMap.has(pId)) parentChildrenMap.set(pId, []);
        parentChildrenMap.get(pId)!.push(r);
      }
    });

    for (const [_pId, childRels] of parentChildrenMap.entries()) {
      const unassigned = childRels.some((r) => r.siblingOrder == null && r.displayOrder == null);
      if (unassigned) {
        // Sort by existing createdAt ascending (first added = 1, second added = 2, ...)
        childRels.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return aTime - bTime;
        });

        for (let idx = 0; idx < childRels.length; idx++) {
          const rel = childRels[idx];
          const assignedOrder = rel.siblingOrder ?? rel.displayOrder ?? idx + 1;
          if (rel.siblingOrder !== assignedOrder || rel.displayOrder !== assignedOrder) {
            rel.siblingOrder = assignedOrder;
            rel.displayOrder = assignedOrder;
            hasNormalizedAny = true;
            await relationshipRepository.update(rel._id, {
              siblingOrder: assignedOrder,
              displayOrder: assignedOrder,
            });
            await memberRepository.update(rel.targetMemberId, {
              siblingOrder: assignedOrder,
              displayOrder: assignedOrder,
            } as any);
          }
        }
      }
    }

    if (hasNormalizedAny) {
      return relationshipRepository.findByFamilyId(familyId);
    }

    return rels;
  }

  async getRelationshipsByMember(
    familyId: string,
    memberId: string,
    context?: ServiceContext
  ): Promise<IRelationship[]> {
    await familyService.getFamilyById(familyId, context);

    if (!Types.ObjectId.isValid(memberId)) {
      throw new NotFoundError(`Member '${memberId}' not found`, ErrorCode.MEMBER_NOT_FOUND);
    }

    const member = await memberRepository.findByFamilyAndId(familyId, memberId);
    if (!member) {
      throw new NotFoundError(`Member '${memberId}' not found in family '${familyId}'`, ErrorCode.MEMBER_NOT_FOUND);
    }

    return relationshipRepository.findByMemberId(familyId, memberId);
  }

  async deleteRelationship(
    familyId: string,
    relationshipId: string,
    context?: ServiceContext
  ): Promise<boolean> {
    await familyService.getFamilyById(familyId, context);

    if (!Types.ObjectId.isValid(relationshipId)) {
      throw new NotFoundError('Relationship not found', ErrorCode.NOT_FOUND);
    }

    const existing = await relationshipRepository.findByFamilyAndId(familyId, relationshipId);
    if (!existing) {
      throw new NotFoundError(
        `Relationship '${relationshipId}' not found in family '${familyId}'`,
        ErrorCode.NOT_FOUND
      );
    }

    const deleted = await relationshipRepository.delete(relationshipId);

    await auditService.log(
      familyId,
      context?.userId || 'system',
      AuditAction.RELATIONSHIP_REMOVED,
      'Relationship',
      relationshipId,
      {
        relationshipType: existing.relationshipType,
        sourceMemberId: existing.sourceMemberId.toString(),
        targetMemberId: existing.targetMemberId.toString(),
      }
    );

    return deleted;
  }

  async updateRelationship(
    familyId: string,
    relationshipId: string,
    input: {
      marriageDate?: string | null;
      status?: RelationshipStatus;
      siblingOrder?: number | null;
      displayOrder?: number | null;
      metadata?: Record<string, unknown>;
    },
    context?: ServiceContext
  ): Promise<IRelationship> {
    await familyService.getFamilyById(familyId, context);

    if (!Types.ObjectId.isValid(relationshipId)) {
      throw new NotFoundError('Relationship not found', ErrorCode.NOT_FOUND);
    }

    const existing = await relationshipRepository.findByFamilyAndId(familyId, relationshipId);
    if (!existing) {
      throw new NotFoundError(
        `Relationship '${relationshipId}' not found in family '${familyId}'`,
        ErrorCode.NOT_FOUND
      );
    }

    const updateData: Partial<IRelationship> = {};
    if (input.marriageDate !== undefined) {
      updateData.marriageDate = input.marriageDate ? input.marriageDate.trim() : null;
    }
    if (input.status !== undefined) {
      updateData.status = input.status;
    }
    if (input.siblingOrder !== undefined) {
      updateData.siblingOrder = input.siblingOrder;
      updateData.displayOrder = input.siblingOrder;
    } else if (input.displayOrder !== undefined) {
      updateData.siblingOrder = input.displayOrder;
      updateData.displayOrder = input.displayOrder;
    }
    if (input.metadata !== undefined) {
      updateData.metadata = input.metadata;
    }

    const updated = await relationshipRepository.update(relationshipId, updateData);
    if (!updated) {
      throw new NotFoundError('Relationship not found', ErrorCode.NOT_FOUND);
    }

    if (updateData.siblingOrder !== undefined) {
      const isParentType =
        existing.relationshipType === RelationshipType.PARENT ||
        existing.relationshipType === RelationshipType.ADOPTIVE_PARENT ||
        existing.relationshipType === RelationshipType.STEP_PARENT;
      const childMemberId = isParentType ? existing.targetMemberId : existing.sourceMemberId;
      await memberRepository.update(childMemberId, {
        siblingOrder: updateData.siblingOrder,
        displayOrder: updateData.displayOrder,
      } as any);
    }

    await auditService.log(
      familyId,
      context?.userId || 'system',
      AuditAction.RELATIONSHIP_UPDATED,
      'Relationship',
      relationshipId,
      updateData
    );

    return updated;
  }
}

export const relationshipService = new RelationshipService();
