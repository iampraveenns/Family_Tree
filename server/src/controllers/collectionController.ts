import { Request, Response, NextFunction } from 'express';
import { collectionService } from '../services/collectionService.ts';
import { UnauthorizedError } from '../utils/errors.ts';

export class CollectionController {
  async getCollections(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId } = req.params;
      const actorUserId = req.user?.userId;
      if (!actorUserId) throw new UnauthorizedError();

      const collections = await collectionService.getCollections(familyId, actorUserId);
      res.json({ success: true, data: collections });
    } catch (error) {
      next(error);
    }
  }

  async getCollectionById(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId, collectionId } = req.params;
      const actorUserId = req.user?.userId;
      if (!actorUserId) throw new UnauthorizedError();

      const collection = await collectionService.getCollectionById(
        familyId,
        collectionId,
        actorUserId
      );
      res.json({ success: true, data: collection });
    } catch (error) {
      next(error);
    }
  }

  async createCollection(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId } = req.params;
      const actorUserId = req.user?.userId;
      if (!actorUserId) throw new UnauthorizedError();

      const collection = await collectionService.createCollection(
        familyId,
        actorUserId,
        req.body
      );
      res.status(201).json({ success: true, data: collection });
    } catch (error) {
      next(error);
    }
  }

  async updateCollection(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId, collectionId } = req.params;
      const actorUserId = req.user?.userId;
      if (!actorUserId) throw new UnauthorizedError();

      const collection = await collectionService.updateCollection(
        familyId,
        collectionId,
        actorUserId,
        req.body
      );
      res.json({ success: true, data: collection });
    } catch (error) {
      next(error);
    }
  }

  async deleteCollection(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId, collectionId } = req.params;
      const actorUserId = req.user?.userId;
      if (!actorUserId) throw new UnauthorizedError();

      const result = await collectionService.deleteCollection(
        familyId,
        collectionId,
        actorUserId
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async addMemory(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId, collectionId } = req.params;
      const { memoryId } = req.body;
      const actorUserId = req.user?.userId;
      if (!actorUserId) throw new UnauthorizedError();

      const updated = await collectionService.addMemoryToCollection(
        familyId,
        collectionId,
        memoryId,
        actorUserId
      );
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  async removeMemory(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId, collectionId, memoryId } = req.params;
      const actorUserId = req.user?.userId;
      if (!actorUserId) throw new UnauthorizedError();

      const updated = await collectionService.removeMemoryFromCollection(
        familyId,
        collectionId,
        memoryId,
        actorUserId
      );
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
}

export const collectionController = new CollectionController();
