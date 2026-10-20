import { Types } from 'mongoose';
import { memberRepository, MemberQueryOptions } from '../repositories/memberRepository.ts';
import { relationshipRepository } from '../repositories/relationshipRepository.ts';
import { branchRepository } from '../repositories/branchRepository.ts';
import { familyService } from './familyService.ts';
import { auditService } from './auditService.ts';
import { IFamilyMember } from '../models/FamilyMember.ts';
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

    // Explicit family-ownership validation (Section 31)
    const member = await memberRepository.findByFamilyAndId(familyId, memberId);
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
    const existing = await this.getMemberById(familyId, memberId, context);

    // Validate branch updates if provided
    if (data.branchIds && data.branchIds.length > 0) {
      for (const bId of data.branchIds) {
        const branch = await branchRepository.findByFamilyAndId(familyId, bId);
        if (!branch) {
          throw new ValidationError(`Branch '${bId}' does not belong to family '${familyId}'`);
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
      familyId,
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
