import { Types } from 'mongoose';
import { memberRepository, MemberQueryOptions } from '../repositories/memberRepository.ts';
import { membershipRepository } from '../repositories/membershipRepository.ts';
import { relationshipRepository } from '../repositories/relationshipRepository.ts';
import { branchRepository } from '../repositories/branchRepository.ts';
import { familyService } from './familyService.ts';
import { auditService } from './auditService.ts';
import { Branch } from '../models/Branch.ts';
import { FamilyMember, IFamilyMember } from '../models/FamilyMember.ts';
import { Memory } from '../models/Memory.ts';
import { FamilyEvent } from '../models/FamilyEvent.ts';
import { FamilyMembership } from '../models/FamilyMembership.ts';
import { FamilyInvitation } from '../models/FamilyInvitation.ts';
import { userRepository } from '../repositories/userRepository.ts';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.ts';
import { AuditAction, ErrorCode, Role, DEFAULT_ROLE_PERMISSIONS, BranchVisibility, normalizeRole } from '../constants/index.ts';
import { ServiceContext } from './familyService.ts';

export class MemberService {
  private async resolveAndValidateBranchIds(
    familyId: string,
    branchIds: (string | Types.ObjectId)[],
    fallbackRootMemberId?: Types.ObjectId | string,
    context?: ServiceContext
  ): Promise<Types.ObjectId[]> {
    const resolvedOids: Types.ObjectId[] = [];
    const seen = new Set<string>();

    for (const bId of branchIds) {
      if (!bId) continue;
      const bIdStr = bId.toString().trim();
      if (!bIdStr) continue;

      // 1. If it's a valid 24-character ObjectId
      if (Types.ObjectId.isValid(bIdStr)) {
        const branch = await branchRepository.findByFamilyAndId(familyId, bIdStr);
        if (!branch) {
          throw new ValidationError(`Branch '${bIdStr}' does not belong to family '${familyId}'`);
        }
        const oidStr = branch._id.toString();
        if (!seen.has(oidStr)) {
          seen.add(oidStr);
          resolvedOids.push(branch._id);
        }
        continue;
      }

      // 2. If it's a slug or branch name (e.g. 'branch-arun-branch' or 'Arun Branch')
      const cleanName = bIdStr.replace(/^branch-/, '').replace(/[-_]/g, ' ').trim();
      let branch = await branchRepository.findByName(familyId, cleanName);
      if (!branch) {
        branch = await Branch.findOne({
          familyId: new Types.ObjectId(familyId),
          $or: [
            { name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
            { name: { $regex: new RegExp(`^${bIdStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
          ],
        }).exec();
      }

      if (branch) {
        const oidStr = branch._id.toString();
        if (!seen.has(oidStr)) {
          seen.add(oidStr);
          resolvedOids.push(branch._id);
        }
        continue;
      }

      // 3. Dynamic lineage branch slug (e.g. 'branch-arun-branch')
      // Auto-create or resolve the branch so it becomes a persisted first-class branch for the family
      if (bIdStr.startsWith('branch-') || bIdStr.toLowerCase().includes('branch') || cleanName.length > 0) {
        const formattedName = cleanName
          .split(' ')
          .filter(Boolean)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');

        let rootMemId = fallbackRootMemberId;
        if (!rootMemId || !Types.ObjectId.isValid(rootMemId.toString())) {
          const firstMem = await FamilyMember.findOne({ familyId: new Types.ObjectId(familyId) }).exec();
          if (firstMem) rootMemId = firstMem._id;
        }

        if (rootMemId && Types.ObjectId.isValid(rootMemId.toString())) {
          const newBranch = await branchRepository.create({
            familyId: new Types.ObjectId(familyId),
            name: formattedName || 'Family Branch',
            description: `${formattedName || 'Lineage'} Branch of family`,
            rootMemberId: new Types.ObjectId(rootMemId.toString()),
            createdBy: context?.userId || 'system',
            visibility: BranchVisibility.FAMILY,
          });
          const oidStr = newBranch._id.toString();
          if (!seen.has(oidStr)) {
            seen.add(oidStr);
            resolvedOids.push(newBranch._id);
          }
          continue;
        }
        // If no root member available, skip pseudo-id gracefully without crashing
        continue;
      }

      throw new ValidationError(`Branch '${bIdStr}' does not belong to family '${familyId}'`);
    }

    return resolvedOids;
  }

  async createMember(familyId: string, data: Partial<IFamilyMember>, context?: ServiceContext): Promise<IFamilyMember> {
    // 1. Validate family exists
    await familyService.getFamilyById(familyId, context);

    // 2. Validate and resolve branch references if provided
    if (data.branchIds && data.branchIds.length > 0) {
      data.branchIds = (await this.resolveAndValidateBranchIds(familyId, data.branchIds, undefined, context)) as any;
    }

    // 3. Registered Account Verification Rule
    // Enforce strict rule: A person can only be added to or exist within the family tree
    // if they have a registered account created via JSON authentication system.
    // Link every account directly to its corresponding member node.
    const isDeceased = data.isLiving === false || Boolean(data.dateOfDeath && data.dateOfDeath.trim().length > 0);
    const rawAccountEmail = (data as any).registeredEmail || (data as any).email || (data as any).userEmail || (data as any).accountEmail;
    const accountEmail = typeof rawAccountEmail === 'string' ? rawAccountEmail.trim().toLowerCase() : undefined;
    const accountUserId = (data as any).linkedUserId || (data as any).userId;

    let linkedUser: any = null;
    if (accountEmail) {
      linkedUser = await userRepository.findByEmail(accountEmail);
      if (!linkedUser) {
        throw new ValidationError(`Cannot create member node: No registered account found for "${accountEmail}". Living relatives strictly require a registered account in the authentication database before they can be added.`);
      }
    } else if (accountUserId && Types.ObjectId.isValid(accountUserId)) {
      linkedUser = await userRepository.findById(accountUserId);
      if (!linkedUser) {
        throw new ValidationError('Cannot create member node: The specified user account does not exist.');
      }
    } else if (!isDeceased) {
      const existingCount = await FamilyMember.countDocuments({ familyId: new Types.ObjectId(familyId) });
      if (existingCount === 0 && context?.userId && Types.ObjectId.isValid(context.userId)) {
        linkedUser = await userRepository.findById(context.userId);
      }
      if (!linkedUser) {
        throw new ValidationError('Cannot create member node: A registered account email is required. Living family tree nodes strictly require a registered account in the authentication database before they can be added.');
      }
    }

    if (linkedUser) {
      // Enforce universal 1:1 account-to-node mapping in the family tree
      const existingNodeForUser = await FamilyMember.findOne({
        familyId: new Types.ObjectId(familyId),
        linkedUserId: linkedUser._id,
      });
      if (existingNodeForUser) {
        throw new ValidationError(`The account "${linkedUser.email}" is already linked to member "${existingNodeForUser.displayName}" in this tree.`);
      }

      data.linkedUserId = linkedUser._id;
      data.registeredEmail = linkedUser.email;
    }

    // 4. Normalize display name
    const firstName = data.firstName?.trim() || '';
    const lastName = data.lastName?.trim() || '';
    const displayName = data.displayName?.trim() || `${firstName} ${lastName}`.trim();

    const member = await memberRepository.create({
      ...data,
      familyId: new Types.ObjectId(familyId),
      displayName,
      createdBy: context?.userId || 'system',
    });

    // 5. Ensure the linked registered user is recorded in family memberships and linked directly
    if (data.linkedUserId) {
      try {
        const existingMembership = await membershipRepository.findByUserAndFamily(data.linkedUserId, familyId);
        if (!existingMembership) {
          await membershipRepository.create({
            userId: new Types.ObjectId(data.linkedUserId),
            familyId: new Types.ObjectId(familyId),
            memberId: member._id,
            role: Role.VIEWER,
            status: 'ACTIVE',
            permissions: DEFAULT_ROLE_PERMISSIONS[Role.VIEWER],
          });
        } else {
          existingMembership.memberId = member._id;
          await existingMembership.save();
        }
      } catch (err) {
        // Membership association log if needed
      }
    }

    // 6. Send notification to family members when a new person is added
    try {
      const { notificationService } = await import('./notificationService.ts');
      await notificationService.notifyFamily({
        familyId,
        type: 'MEMBER_ADDED',
        title: 'New Relative Added',
        message: `${member.firstName} ${member.lastName} was added to the family tree`,
        entityType: 'Member',
        entityId: member._id.toString(),
        actorUserId: context?.userId,
        actorName: context?.userName || 'A family member',
      });
    } catch (notifErr) {
      console.warn('Could not dispatch member notification:', notifErr);
    }

    await auditService.log(
      familyId,
      context?.userId || 'system',
      AuditAction.MEMBER_CREATED,
      'FamilyMember',
      member._id.toString(),
      { displayName: member.displayName }
    );

    return member;
  }

  async getMembers(
    familyId: string,
    options: MemberQueryOptions = {},
    context?: ServiceContext
  ): Promise<{ members: IFamilyMember[]; total: number; page: number; limit: number }> {
    await familyService.getFamilyById(familyId, context);
    return memberRepository.findByFamilyId(familyId, options);
  }

  async getMemberById(familyId: string, memberId: string, context?: ServiceContext): Promise<IFamilyMember> {
    await familyService.getFamilyById(familyId, context);

    if (!Types.ObjectId.isValid(memberId)) {
      throw new NotFoundError(`Family member '${memberId}' not found`, ErrorCode.MEMBER_NOT_FOUND);
    }

    const targetFamily = await familyService.getFamilyById(familyId, context);
    const resolvedFamilyId = targetFamily._id.toString();

    let member: IFamilyMember | null = null;
    if (Types.ObjectId.isValid(memberId)) {
      member = await memberRepository.findByFamilyAndId(resolvedFamilyId, memberId);
      if (!member && familyId !== resolvedFamilyId && Types.ObjectId.isValid(familyId)) {
        member = await memberRepository.findByFamilyAndId(familyId, memberId);
      }
    }

    if (!member) {
      throw new NotFoundError(
        `Member with ID '${memberId}' does not exist in family '${familyId}'`,
        ErrorCode.MEMBER_NOT_FOUND
      );
    }

    return member;
  }

  async updateMember(
    familyId: string,
    memberId: string,
    data: Partial<IFamilyMember>,
    context?: ServiceContext
  ): Promise<IFamilyMember> {
    const targetFamily = await familyService.getFamilyById(familyId, context);
    const resolvedFamilyId = targetFamily._id.toString();

    let existing: IFamilyMember | null = null;
    if (Types.ObjectId.isValid(memberId)) {
      existing = await memberRepository.findByFamilyAndId(resolvedFamilyId, memberId);
      if (!existing && familyId !== resolvedFamilyId && Types.ObjectId.isValid(familyId)) {
        existing = await memberRepository.findByFamilyAndId(familyId, memberId);
      }
    }

    // Resilience against stale client IDs: if not found by ID, attempt lookup by matching name within this family
    if (!existing && data.firstName && data.lastName) {
      existing = await FamilyMember.findOne({
        familyId: new Types.ObjectId(resolvedFamilyId),
        firstName: { $regex: new RegExp(`^${data.firstName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        lastName: { $regex: new RegExp(`^${data.lastName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      }).exec();
      if (!existing && familyId !== resolvedFamilyId && Types.ObjectId.isValid(familyId)) {
        existing = await FamilyMember.findOne({
          familyId: new Types.ObjectId(familyId),
          firstName: { $regex: new RegExp(`^${data.firstName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          lastName: { $regex: new RegExp(`^${data.lastName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        }).exec();
      }
      if (existing) {
        memberId = existing._id.toString();
      }
    }

    // Resilience against name edits: if not found, match by existing member in family by display name or first name
    if (!existing && (data.displayName || data.firstName)) {
      const nameToMatch = (data.displayName || data.firstName)!.trim();
      existing = await FamilyMember.findOne({
        familyId: new Types.ObjectId(resolvedFamilyId),
        $or: [
          { displayName: { $regex: new RegExp(nameToMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
          { firstName: { $regex: new RegExp(nameToMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
        ],
      }).exec();
      if (existing) {
        memberId = existing._id.toString();
      }
    }

    if (!existing) {
      throw new NotFoundError(
        `Member with ID '${memberId}' does not exist in family '${familyId}'`,
        ErrorCode.MEMBER_NOT_FOUND
      );
    }

    const effectiveFamilyId = existing.familyId ? existing.familyId.toString() : resolvedFamilyId;

    // Secure Self-Profile Editing (JWT / Account-to-Node Matching)
    if (context?.userId && Types.ObjectId.isValid(context.userId)) {
      const membership = await membershipRepository.findByUserAndFamily(context.userId, effectiveFamilyId);
      const isRoleAdmin = membership ? normalizeRole(membership.role) === Role.ADMIN : false;
      if (!isRoleAdmin) {
        const isSelfNode = Boolean(
          (existing.linkedUserId && existing.linkedUserId.toString() === context.userId) ||
          (membership?.memberId && membership.memberId.toString() === existing._id.toString())
        );
        if (!isSelfNode) {
          throw new ForbiddenError('You are only authorized to edit your own profile node in the family tree');
        }
        delete data.branchIds;
        delete data.linkedUserId;
        delete (data as any).registeredEmail;
        delete (data as any).generation;
      }
    }

    // Validate and resolve branch updates if provided
    if (data.branchIds && data.branchIds.length > 0) {
      data.branchIds = (await this.resolveAndValidateBranchIds(
        effectiveFamilyId,
        data.branchIds,
        existing._id,
        context
      )) as any;
    }

    // Recompute displayName if first or last name changed and displayName wasn't explicitly provided
    if ((data.firstName || data.lastName) && !data.displayName) {
      const fn = (data.firstName ?? existing.firstName).trim();
      const ln = (data.lastName ?? existing.lastName).trim();
      data.displayName = `${fn} ${ln}`.trim();
    }

    const updated = await memberRepository.update(memberId, data);
    if (!updated) {
      throw new NotFoundError('Member not found for update', ErrorCode.MEMBER_NOT_FOUND);
    }

    await auditService.log(
      effectiveFamilyId,
      context?.userId || 'system',
      AuditAction.MEMBER_UPDATED,
      'FamilyMember',
      memberId,
      data as Record<string, unknown>
    );

    return updated;
  }

  async deleteMember(familyId: string, memberId: string, context?: ServiceContext): Promise<boolean> {
    await this.getMemberById(familyId, memberId, context);

    const memberOid = new Types.ObjectId(memberId);
    const familyOid = new Types.ObjectId(familyId);

    // 1. Cascade delete any relationships referencing this member
    await relationshipRepository.deleteByMember(familyId, memberId);

    // 2. Cascade cleanup orphaned member references across memories & events
    await Promise.all([
      Memory.updateMany(
        { familyId: familyOid, memberIds: memberOid },
        { $pull: { memberIds: memberOid } }
      ),
      FamilyEvent.updateMany(
        { familyId: familyOid, memberIds: memberOid },
        { $pull: { memberIds: memberOid } }
      ),
      FamilyMembership.updateMany(
        { familyId: familyOid, memberId: memberOid },
        { $unset: { memberId: '' } }
      ),
      FamilyInvitation.updateMany(
        { familyId: familyOid, targetMemberId: memberOid },
        { $unset: { targetMemberId: '' } }
      ),
    ]);

    const deleted = await memberRepository.delete(memberId);

    await auditService.log(
      familyId,
      context?.userId || 'system',
      AuditAction.MEMBER_DELETED,
      'FamilyMember',
      memberId
    );

    return deleted;
  }
}

export const memberService = new MemberService();
