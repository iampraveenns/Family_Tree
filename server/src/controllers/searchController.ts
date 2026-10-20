import { Request, Response, NextFunction } from 'express';
import { searchService, GlobalSearchFilters } from '../services/searchService.ts';
import { sendSuccess } from '../utils/apiResponse.ts';
import { auditService } from '../services/auditService.ts';
import { AuditAction } from '../constants/index.ts';

export class SearchController {
  async globalSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId } = req.params;
      const queryParams = req.query as Record<string, string>;

      const filters: GlobalSearchFilters = {
        q: queryParams.q,
        category: queryParams.category as any,
        generation: queryParams.generation ? Number(queryParams.generation) : undefined,
        branchId: queryParams.branchId,
        gender: queryParams.gender as any,
        ageMin: queryParams.ageMin ? Number(queryParams.ageMin) : undefined,
        ageMax: queryParams.ageMax ? Number(queryParams.ageMax) : undefined,
        birthYearMin: queryParams.birthYearMin ? Number(queryParams.birthYearMin) : undefined,
        birthYearMax: queryParams.birthYearMax ? Number(queryParams.birthYearMax) : undefined,
        birthYear: queryParams.birthYear ? Number(queryParams.birthYear) : undefined,
        location: queryParams.location,
        occupation: queryParams.occupation,
        relationshipType: queryParams.relationshipType,
        memoryType: queryParams.memoryType,
        eventType: queryParams.eventType,
        era: queryParams.era,
        tag: queryParams.tag,
        isLiving: queryParams.isLiving !== undefined ? queryParams.isLiving === 'true' : undefined,
        page: queryParams.page ? Number(queryParams.page) : 1,
        limit: queryParams.limit ? Number(queryParams.limit) : 20,
      };

      const user = (req as any).user;
      const context = user ? { user, userId: user.userId || user.id } : undefined;
      const results = await searchService.globalSearch(familyId, filters, context);

      sendSuccess(res, results, 'Search results retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async getSuggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { familyId } = req.params;
      const query = (req.query.q as string) || '';

      const suggestions = await searchService.getSearchSuggestions(familyId, query);
      sendSuccess(res, suggestions, 'Search suggestions retrieved successfully');
    } catch (err) {
      next(err);
    }
  }
}

export const searchController = new SearchController();
