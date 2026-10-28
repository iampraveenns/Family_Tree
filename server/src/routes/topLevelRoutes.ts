import { Router, Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { requireAuthentication } from '../middleware/auth.ts';
import { memberRepository } from '../repositories/memberRepository.ts';
import { memberService } from '../services/memberService.ts';
import { eventService } from '../services/eventService.ts';
import { FamilyEvent } from '../models/FamilyEvent.ts';
import { MemoryCollection } from '../models/MemoryCollection.ts';
import { collectionService } from '../services/collectionService.ts';
import { Relationship } from '../models/Relationship.ts';
import { relationshipService } from '../services/relationshipService.ts';
import { membershipRepository } from '../repositories/membershipRepository.ts';
import { authorizationService } from '../services/authorizationService.ts';
import { NotFoundError, ForbiddenError } from '../utils/errors.ts';
import { sendSuccess } from '../utils/apiResponse.ts';
import { Permission } from '../constants/index.ts';

const router = Router();

// ==========================================
// 1. TOP-LEVEL /members/:memberId
// ==========================================
router.get('/members/:memberId', requireAuthentication, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { memberId } = req.params;
    if (!Types.ObjectId.isValid(memberId)) {
      throw new NotFoundError(`Member with ID '${memberId}' not found`);
    }

    const member = await memberRepository.findById(memberId);
    if (!member) {
      throw new NotFoundError(`Member with ID '${memberId}' not found`);
    }

    // Enforce family isolation: actor must belong to member's family
    const membership = await membershipRepository.findByUserAndFamily(req.user!.userId, member.familyId.toString());
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Access denied: You do not have permission to view members of another family');
    }

    const authCheck = await authorizationService.canViewMember(req.user!.userId, member);
    if (!authCheck.allowed) {
      throw new ForbiddenError(authCheck.reason || 'You do not have permission to view this member');
    }

    sendSuccess(res, member, 'Member retrieved successfully');
  } catch (error) {
    next(error);
  }
});

router.patch('/members/:memberId', requireAuthentication, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { memberId } = req.params;
    if (!Types.ObjectId.isValid(memberId)) {
      throw new NotFoundError(`Member with ID '${memberId}' not found`);
    }

    const member = await memberRepository.findById(memberId);
    if (!member) {
      throw new NotFoundError(`Member with ID '${memberId}' not found`);
    }

    const familyIdStr = member.familyId.toString();
    const membership = await membershipRepository.findByUserAndFamily(req.user!.userId, familyIdStr);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Access denied: You do not have permission to modify members of another family');
    }

    const authCheck = await authorizationService.canManageMember(
      req.user!.userId,
      familyIdStr,
      memberId,
      Permission.EDIT_MEMBER
    );
    if (!authCheck.allowed) {
      throw new ForbiddenError(authCheck.reason || 'You do not have permission to edit this member');
    }

    const updated = await memberService.updateMember(familyIdStr, memberId, req.body, {
      userId: req.user!.userId,
    });
    sendSuccess(res, updated, 'Member updated successfully');
  } catch (error) {
    next(error);
  }
});

router.put('/members/:memberId', requireAuthentication, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { memberId } = req.params;
    if (!Types.ObjectId.isValid(memberId)) {
      throw new NotFoundError(`Member with ID '${memberId}' not found`);
    }

    const member = await memberRepository.findById(memberId);
    if (!member) {
      throw new NotFoundError(`Member with ID '${memberId}' not found`);
    }

    const familyIdStr = member.familyId.toString();
    const membership = await membershipRepository.findByUserAndFamily(req.user!.userId, familyIdStr);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Access denied: You do not have permission to modify members of another family');
    }

    const authCheck = await authorizationService.canManageMember(
      req.user!.userId,
      familyIdStr,
      memberId,
      Permission.EDIT_MEMBER
    );
    if (!authCheck.allowed) {
      throw new ForbiddenError(authCheck.reason || 'You do not have permission to edit this member');
    }

    const updated = await memberService.updateMember(familyIdStr, memberId, req.body, {
      userId: req.user!.userId,
    });
    sendSuccess(res, updated, 'Member updated successfully');
  } catch (error) {
    next(error);
  }
});

router.post('/members', requireAuthentication, async (req: Request, res: Response, next: NextFunction) => {
  try {
    let familyId = req.body.familyId || req.query.familyId;
    if (!familyId) {
      const memberships = await membershipRepository.findByUser(req.user!.userId);
      if (memberships.length > 0) {
        familyId = (memberships[0].familyId as any)?._id?.toString() || memberships[0].familyId.toString();
      }
    }
    if (!familyId) {
      throw new NotFoundError('Family ID is required to create a member');
    }

    const newMember = await memberService.createMember(familyId, req.body, {
      userId: req.user!.userId,
    });
    sendSuccess(res, newMember, 'Member created successfully', 201);
  } catch (error) {
    next(error);
  }
});

router.delete('/members/:memberId', requireAuthentication, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { memberId } = req.params;
    if (!Types.ObjectId.isValid(memberId)) {
      throw new NotFoundError(`Member with ID '${memberId}' not found`);
    }

    const member = await memberRepository.findById(memberId);
    if (!member) {
      throw new NotFoundError(`Member with ID '${memberId}' not found`);
    }

    const familyIdStr = member.familyId.toString();
    const membership = await membershipRepository.findByUserAndFamily(req.user!.userId, familyIdStr);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Access denied: You do not have permission to delete members of another family');
    }

    const authCheck = await authorizationService.canManageMember(
      req.user!.userId,
      familyIdStr,
      memberId,
      Permission.DELETE_MEMBER
    );
    if (!authCheck.allowed) {
      throw new ForbiddenError(authCheck.reason || 'You do not have permission to delete this member');
    }

    await memberService.deleteMember(familyIdStr, memberId, {
      userId: req.user!.userId,
    });
    sendSuccess(res, { deleted: true }, 'Member deleted successfully');
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 2. TOP-LEVEL /timeline/:eventId
// ==========================================
router.get('/timeline/:eventId', requireAuthentication, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    if (!Types.ObjectId.isValid(eventId)) {
      throw new NotFoundError(`Event with ID '${eventId}' not found`);
    }

    const rawEvent = await FamilyEvent.findById(eventId).lean();
    if (!rawEvent) {
      throw new NotFoundError(`Event with ID '${eventId}' not found`);
    }

    const familyIdStr = rawEvent.familyId.toString();
    const membership = await membershipRepository.findByUserAndFamily(req.user!.userId, familyIdStr);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Access denied: You do not have permission to view timeline events of another family');
    }

    const enrichedEvent = await eventService.getEventById(familyIdStr, eventId, req.user!.userId);
    sendSuccess(res, enrichedEvent, 'Timeline event retrieved successfully');
  } catch (error) {
    next(error);
  }
});

router.delete('/timeline/:eventId', requireAuthentication, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    if (!Types.ObjectId.isValid(eventId)) {
      throw new NotFoundError(`Event with ID '${eventId}' not found`);
    }

    const rawEvent = await FamilyEvent.findById(eventId).lean();
    if (!rawEvent) {
      throw new NotFoundError(`Event with ID '${eventId}' not found`);
    }

    const familyIdStr = rawEvent.familyId.toString();
    const membership = await membershipRepository.findByUserAndFamily(req.user!.userId, familyIdStr);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Access denied: You do not have permission to delete timeline events of another family');
    }

    await eventService.deleteEvent(familyIdStr, eventId, req.user!.userId);
    sendSuccess(res, { deleted: true }, 'Timeline event deleted successfully');
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 3. TOP-LEVEL /collections/:collectionId
// ==========================================
router.get('/collections/:collectionId', requireAuthentication, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { collectionId } = req.params;
    if (!Types.ObjectId.isValid(collectionId)) {
      throw new NotFoundError(`Collection with ID '${collectionId}' not found`);
    }

    const col = await MemoryCollection.findById(collectionId).lean();
    if (!col) {
      throw new NotFoundError(`Collection with ID '${collectionId}' not found`);
    }

    const familyIdStr = col.familyId.toString();
    const membership = await membershipRepository.findByUserAndFamily(req.user!.userId, familyIdStr);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Access denied: You do not have permission to view collections of another family');
    }

    const enriched = await collectionService.getCollectionById(familyIdStr, collectionId, req.user!.userId);
    sendSuccess(res, enriched, 'Collection retrieved successfully');
  } catch (error) {
    next(error);
  }
});

router.delete('/collections/:collectionId', requireAuthentication, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { collectionId } = req.params;
    if (!Types.ObjectId.isValid(collectionId)) {
      throw new NotFoundError(`Collection with ID '${collectionId}' not found`);
    }

    const col = await MemoryCollection.findById(collectionId).lean();
    if (!col) {
      throw new NotFoundError(`Collection with ID '${collectionId}' not found`);
    }

    const familyIdStr = col.familyId.toString();
    const membership = await membershipRepository.findByUserAndFamily(req.user!.userId, familyIdStr);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Access denied: You do not have permission to delete collections of another family');
    }

    await collectionService.deleteCollection(familyIdStr, collectionId, req.user!.userId);
    sendSuccess(res, { deleted: true }, 'Collection deleted successfully');
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 4. TOP-LEVEL /relationships/:relationshipId
// ==========================================
router.get('/relationships/:relationshipId', requireAuthentication, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { relationshipId } = req.params;
    if (!Types.ObjectId.isValid(relationshipId)) {
      throw new NotFoundError(`Relationship with ID '${relationshipId}' not found`);
    }

    const rel = await Relationship.findById(relationshipId).lean();
    if (!rel) {
      throw new NotFoundError(`Relationship with ID '${relationshipId}' not found`);
    }

    const familyIdStr = rel.familyId.toString();
    const membership = await membershipRepository.findByUserAndFamily(req.user!.userId, familyIdStr);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Access denied: You do not have permission to view relationships of another family');
    }

    sendSuccess(res, rel, 'Relationship retrieved successfully');
  } catch (error) {
    next(error);
  }
});

router.delete('/relationships/:relationshipId', requireAuthentication, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { relationshipId } = req.params;
    if (!Types.ObjectId.isValid(relationshipId)) {
      throw new NotFoundError(`Relationship with ID '${relationshipId}' not found`);
    }

    const rel = await Relationship.findById(relationshipId).lean();
    if (!rel) {
      throw new NotFoundError(`Relationship with ID '${relationshipId}' not found`);
    }

    const familyIdStr = rel.familyId.toString();
    const membership = await membershipRepository.findByUserAndFamily(req.user!.userId, familyIdStr);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('Access denied: You do not have permission to delete relationships of another family');
    }

    await relationshipService.deleteRelationship(familyIdStr, relationshipId, {
      userId: req.user!.userId,
    });
    sendSuccess(res, { deleted: true }, 'Relationship deleted successfully');
  } catch (error) {
    next(error);
  }
});

export default router;
