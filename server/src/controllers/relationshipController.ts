import { Request, Response, NextFunction } from 'express';
import { relationshipService } from '../services/relationshipService.ts';
import { sendSuccess } from '../utils/apiResponse.ts';

export class RelationshipController {
  async createRelationship(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId } = req.params;
      const relationship = await relationshipService.createRelationship(familyId, req.body, { userId: req.user?.userId });
      sendSuccess(res, relationship, 'Relationship created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async getRelationships(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId } = req.params;
      const relationships = await relationshipService.getRelationshipsByFamily(familyId);
      sendSuccess(res, relationships, 'Family relationships retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async getMemberRelationships(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId, memberId } = req.params;
      const relationships = await relationshipService.getRelationshipsByMember(familyId, memberId);
      sendSuccess(res, relationships, 'Member relationships retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async updateRelationship(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId, relationshipId } = req.params;
      const relationship = await relationshipService.updateRelationship(familyId, relationshipId, req.body, { userId: req.user?.userId });
      sendSuccess(res, relationship, 'Relationship updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async deleteRelationship(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId, relationshipId } = req.params;
      await relationshipService.deleteRelationship(familyId, relationshipId, { userId: req.user?.userId });
      sendSuccess(res, { deleted: true, relationshipId }, 'Relationship removed successfully');
    } catch (err) {
      next(err);
    }
  }
}

export const relationshipController = new RelationshipController();
