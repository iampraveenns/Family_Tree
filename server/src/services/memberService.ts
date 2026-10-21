import { Types } from 'mongoose';
import { memberRepository, MemberQueryOptions } from '../repositories/memberRepository.ts';
import { membershipRepository } from '../repositories/membershipRepository.ts';
import { relationshipRepository } from '../repositories/relationshipRepository.ts';
import { branchRepository } from '../repositories/branchRepository.ts';
import { familyService } from './familyService.ts';
import { auditService } from './auditService.ts';
import { FamilyMember, IFamilyMember } from '../models/FamilyMember.ts';
import { Memory } from '../models/Memory.ts';
import { FamilyEvent } from '../models/FamilyEvent.ts';
import { FamilyMembership } from '../models/FamilyMembership.ts';
import { FamilyInvitation } from '../models/FamilyInvitation.ts';
import { NotFoundError, ValidationError } from '../utils/errors.ts';
import { AuditAction, ErrorCode } from '../constants/index.ts';
import { ServiceContext } from './familyService.ts';

export class MemberService {
  async createMember(familyId: string, data: Partial<IFamilyMember>, context?: ServiceContext): Promise<IFamilyMember> {
    // 1. Validate family exists
    await familyService.getFamilyById(familyId, context);

    // 2. Validate branch references if provided
    if (data.branchIds && data.branchIds.length > 0) {
      for (const bId of data.branchIds) {
        const branch = await branchRepository.findByFamilyAndId(familyId, bId);
        if (!branch) {
          throw new ValidationError(`Branch '${bId}' does not belong to family '${familyId}'`);
        }
      }
    }

    // 3. Normalize display name
    const firstName = data.firstName?.trim() || '';
    const lastName = data.lastName?.trim() || '';
    const displayName = data.displayName?.trim() || `${firstName} ${lastName}`.trim();

    const member = await memberRepository.create({
      ...data,
      familyId: new Types.ObjectId(familyId),
      displayName,
      createdBy: context?.userId || 'system',
    });

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
      if (!member) {
        const anyMember = await memberRepository.findById(memberId);
        if (anyMember) {
          member = anyMember;
        }
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
      // If member exists in MongoDB under another family or stale session, heal and adopt its true family
      if (!existing) {
        const anyMember = await memberRepository.findById(memberId);
        if (anyMember) {
          existing = anyMember;
          familyId = anyMember.familyId.toString();
        }
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

    // Validate branch updates if provided
    if (data.branchIds && data.branchIds.length > 0) {
      for (const bId of data.branchIds) {
        const branch = await branchRepository.findByFamilyAndId(effectiveFamilyId, bId);
        if (!branch) {
          throw new ValidationError(`Branch '${bId}' does not belong to family '${effectiveFamilyId}'`);
        }
      }
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
